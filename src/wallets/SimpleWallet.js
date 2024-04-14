import {
    Address,
    PubKey,
    PubKeyHash,
    Signature,
    StakingAddress,
    Tx,
    TxId,
    TxInput
} from "@helios-lang/ledger"
import {
    Bip32PrivateKey,
    BIP39_DICT_EN,
    RootPrivateKey
} from "../keys/index.js"
import { None } from "@helios-lang/type-utils"
import { mulberry32 } from "@helios-lang/crypto"

/**
 * @typedef {import("@helios-lang/crypto").NumberGenerator} NumberGenerator
 * @typedef {import("../network/Network.js").Network} Network
 * @typedef {import("../network/Network.js").NetworkName} NetworkName
 * @typedef {import("./Wallet.js").Wallet} Wallet
 */

/**
 * This wallet only has a single private/public key, which isn't rotated. Staking is not yet supported.
 * Requires a network interface
 * @implements {Wallet}
 */
export class SimpleWallet {
    /**
     * @readonly
     * @type {Network}
     */
    network

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
     * @type {Option<PubKey>}
     */
    stakingPubKey

    /**
     * @param {Bip32PrivateKey} spendingPrivateKey
     * @param {Option<Bip32PrivateKey>} stakingPrivateKey
     * @param {Network} network
     */
    constructor(spendingPrivateKey, stakingPrivateKey, network) {
        this.network = network
        this.spendingPrivateKey = spendingPrivateKey
        this.stakingPrivateKey = stakingPrivateKey
        this.spendingPubKey = this.spendingPrivateKey.derivePubKey()
        this.stakingPubKey = this.stakingPrivateKey?.derivePubKey()
    }

    /**
     * @param {string[]} phrase
     * @param {Network} network
     * @param {string[]} dict
     * @returns {SimpleWallet}
     */
    static fromPhrase(phrase, network, dict = BIP39_DICT_EN) {
        return SimpleWallet.fromRootPrivateKey(
            RootPrivateKey.fromPhrase(phrase, dict),
            network
        )
    }

    /**
     * @param {RootPrivateKey} key
     * @param {Network} network
     * @returns {SimpleWallet}
     */
    static fromRootPrivateKey(key, network) {
        return new SimpleWallet(
            key.deriveSpendingKey(),
            key.deriveStakingKey(),
            network
        )
    }

    /**
     * @param {Network} network
     * @param {NumberGenerator} rand - the default random number generator IS NOT cryptographically secure
     * @returns {SimpleWallet}
     */
    static random(
        network,
        rand = mulberry32(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
    ) {
        const key = RootPrivateKey.random(rand)

        return SimpleWallet.fromRootPrivateKey(key, network)
    }

    /**
     * @type {Address}
     */
    get address() {
        return Address.fromHashes(
            this.network.isMainnet(),
            this.spendingPubKeyHash,
            this.stakingPubKeyHash
        )
    }

    /**
     * Don't define any collateral, let the TxBuilder use the regular inputs
     * @type {Promise<TxInput[]>}
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
        return this.spendingPubKey.toHash()
    }

    /**
     * @type {Option<StakingAddress>}
     */
    get stakingAddress() {
        if (this.stakingPubKey) {
            return StakingAddress.fromHash(
                this.network.isMainnet(),
                this.stakingPubKey.toHash()
            )
        } else {
            return None
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
     * @type {Option<PubKeyHash>}
     */
    get stakingPubKeyHash() {
        return this.stakingPubKey?.toHash()
    }

    /**
     * @type {Promise<Address[]>}
     */
    get unusedAddresses() {
        return new Promise((resolve, _) => {
            resolve([])
        })
    }

    /**
     * Assumed wallet was initiated with at least 1 UTxO at the pubkeyhash address.
     * @type {Promise<Address[]>}
     */
    get usedAddresses() {
        return new Promise((resolve, _) => {
            resolve([this.address])
        })
    }

    /**
     * @type {Promise<TxInput[]>}
     */
    get utxos() {
        return new Promise((resolve, _) => {
            resolve(this.network.getUtxos(this.address))
        })
    }

    /**
     * @returns {Promise<boolean>}
     */
    async isMainnet() {
        return this.network.isMainnet()
    }

    /**
     * Not yet implemented.
     * @param {Address} addr
     * @param {number[]} data
     * @return {Promise<Signature>}
     */
    async signData(addr, data) {
        throw new Error("not yet implemented")
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
        return await this.network.submitTx(tx)
    }
}
