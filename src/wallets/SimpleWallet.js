import { mulberry32 } from "@helios-lang/crypto"
import { makeAddress, makeStakingAddress } from "@helios-lang/ledger"
import {
    BIP39_DICT_EN,
    restoreRootPrivateKey,
    makeRandomRootPrivateKey,
    signCip30CoseData
} from "../keys/index.js"
import { expectDefined } from "@helios-lang/type-utils"

/**
 * @import { BytesLike } from "@helios-lang/codec-utils"
 * @import { NumberGenerator } from "@helios-lang/crypto"
 * @import { PubKey, PubKeyHash, ShelleyAddress, Signature, StakingAddress, Tx, TxId, TxInput } from "@helios-lang/ledger"
 * @import { Bip32PrivateKey, CardanoClient, Cip30CoseSign1, RootPrivateKey, SimpleWallet } from "../index.js"
 */

/**
 * @overload
 * @param {RootPrivateKey} key
 * @param {CardanoClient} cardanoClient
 * @returns {SimpleWallet}
 */
/**
 * @overload
 * @param {Bip32PrivateKey} spendingPrivateKey
 * @param {Bip32PrivateKey | undefined} stakingPrivateKey
 * @param {CardanoClient} cardanoClient
 * @returns {SimpleWallet}
 */
/**
 * @param {(
 *   [RootPrivateKey, CardanoClient]
 *   | [Bip32PrivateKey, Bip32PrivateKey | undefined, CardanoClient]
 * )} args
 * @returns {SimpleWallet}
 */
export function makeSimpleWallet(...args) {
    if (args.length == 2) {
        const [key, client] = args

        return new SimpleWalletImpl(
            key.deriveSpendingKey(),
            key.deriveStakingKey(),
            client
        )
    } else if (args.length == 3) {
        return new SimpleWalletImpl(...args)
    } else {
        throw new Error("invalid number of arguments to makeSimpleWallet")
    }
}

/**
 * @param {RootPrivateKey} key
 * @param {CardanoClient} client
 * @returns {SimpleWallet}
 */
export function makeUnstakedSimpleWallet(key, client) {
    return new SimpleWalletImpl(key.deriveSpendingKey(), undefined, client)
}

/**
 * @param {CardanoClient} cardanoClient
 * @param {NumberGenerator} rand
 * @returns {SimpleWallet}
 */
export function makeRandomSimpleWallet(
    cardanoClient,
    rand = mulberry32(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
) {
    const key = makeRandomRootPrivateKey(rand)

    return makeSimpleWallet(key, cardanoClient)
}

/**
 * @param {string[]} phrase
 * @param {CardanoClient} cardanoClient
 * @param {string[]} dict
 * @returns {SimpleWallet}
 */
export function restoreSimpleWallet(
    phrase,
    cardanoClient,
    dict = BIP39_DICT_EN
) {
    return makeSimpleWallet(restoreRootPrivateKey(phrase, dict), cardanoClient)
}

/**
 * This wallet only has a single private/public key, which isn't rotated. Staking is not yet supported.
 * Requires a network interface
 * @implements {SimpleWallet}
 */
class SimpleWalletImpl {
    /**
     * @readonly
     * @type {CardanoClient}
     */
    cardanoClient

    /**
     * @readonly
     * @type {Bip32PrivateKey}
     */
    spendingPrivateKey

    /**
     * @readonly
     * @type {PubKey}
     */
    spendingPubKey

    /**
     * @readonly
     * @type {PubKey | undefined}
     */
    stakingPubKey

    /**
     * @param {Bip32PrivateKey} spendingPrivateKey
     * @param {Bip32PrivateKey | undefined} stakingPrivateKey
     * @param {CardanoClient} network
     */
    constructor(spendingPrivateKey, stakingPrivateKey, network) {
        this.cardanoClient = network
        this.spendingPrivateKey = spendingPrivateKey
        this.stakingPrivateKey = stakingPrivateKey
        this.spendingPubKey = this.spendingPrivateKey.derivePubKey()
        this.stakingPubKey = this.stakingPrivateKey?.derivePubKey()
    }

    /**
     * @type {ShelleyAddress<PubKeyHash>}
     */
    get address() {
        return makeAddress(
            this.cardanoClient.isMainnet(),
            this.spendingPubKeyHash,
            this.stakingPubKeyHash
        )
    }

    /**
     * Don't define any collateral, let the TxBuilder use the regular inputs
     * @type {Promise<TxInput<PubKeyHash>[]>}
     */
    get collateral() {
        return new Promise((resolve, _) => {
            resolve([])
        })
    }

    /**
     * @type {PubKeyHash}
     */
    get spendingPubKeyHash() {
        return this.spendingPubKey.hash()
    }

    /**
     * @type {StakingAddress | undefined}
     */
    get stakingAddress() {
        if (this.stakingPubKey) {
            return makeStakingAddress(
                this.cardanoClient.isMainnet(),
                this.stakingPubKey.hash()
            )
        } else {
            return undefined
        }
    }

    /**
     * @type {Promise<StakingAddress[]>}
     */
    get stakingAddresses() {
        return new Promise((resolve, _) => {
            const stakingAddress = this.stakingAddress

            resolve(stakingAddress ? [stakingAddress] : [])
        })
    }

    /**
     * @type {PubKeyHash | undefined}
     */
    get stakingPubKeyHash() {
        return this.stakingPubKey?.hash()
    }

    /**
     * @type {Promise<ShelleyAddress<PubKeyHash>[]>}
     */
    get unusedAddresses() {
        return new Promise((resolve, _) => {
            resolve([])
        })
    }

    /**
     * Assumed wallet was initiated with at least 1 UTxO at the pubkeyhash address.
     * @type {Promise<ShelleyAddress<PubKeyHash>[]>}
     */
    get usedAddresses() {
        return new Promise((resolve, _) => {
            resolve([this.address])
        })
    }

    /**
     * @type {Promise<TxInput<PubKeyHash>[]>}
     */
    get utxos() {
        return new Promise((resolve, _) => {
            resolve(
                /** @type {any} */ (this.cardanoClient.getUtxos(this.address))
            )
        })
    }

    /**
     * @returns {Promise<boolean>}
     */
    async isMainnet() {
        return this.cardanoClient.isMainnet()
    }

    /**
     * @param {ShelleyAddress<PubKeyHash>} addr
     * @param {BytesLike} data
     * @return {Promise<{signature: Cip30CoseSign1, key: PubKey}>}
     */
    async signData(addr, data) {
        const spendingCredential = addr.spendingCredential
        const stakingCredential = addr.stakingCredential

        if (stakingCredential) {
            if (!addr.isEqual(this.address)) {
                throw new Error(
                    "givend address doesn't correspond to SimpleWallet's address"
                )
            }

            const pubKey = expectDefined(this.stakingPubKey)
            const privateKey = expectDefined(this.stakingPrivateKey)

            return {
                signature: signCip30CoseData(addr, privateKey, data),
                key: pubKey
            }
        } else {
            if (!spendingCredential.isEqual(this.address.spendingCredential)) {
                throw new Error(
                    "given address.spendingCredential doesn't correspond to SimpleWallet's spending credential"
                )
            }

            return {
                signature: signCip30CoseData(
                    addr,
                    this.spendingPrivateKey,
                    data
                ),
                key: this.spendingPubKey
            }
        }
    }

    /**
     * Simply assumes the tx needs to by signed by this wallet without checking.
     * @param {Tx} tx
     * @returns {Promise<Signature[]>}
     */
    async signTx(tx) {
        return [this.spendingPrivateKey.sign(tx.body.hash())]
    }

    /**
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        return await this.cardanoClient.submitTx(tx)
    }
}
