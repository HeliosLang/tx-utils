import { bytesToHex, toBytes } from "@helios-lang/codec-utils"
import {
    decodeTxInput,
    decodeTxWitnesses,
    makeShelleyAddress,
    makeStakingAddress,
    makeTxId
} from "@helios-lang/ledger"
import { decodeCip30CosePubKey, decodeCip30CoseSign1 } from "../keys/index.js"

/**
 * @import { BytesLike } from "@helios-lang/codec-utils"
 * @import { Address, PubKey, PubKeyHash, ShelleyAddress, Signature, StakingAddress, Tx, TxId, TxInput } from "@helios-lang/ledger"
 * @import { Cip30CoseSign1, Cip30FullHandle, Cip30Wallet } from "../index.js"
 */

/**
 * @param {Cip30FullHandle} handle
 * @returns {Cip30Wallet}
 */
export function makeCip30Wallet(handle) {
    return new Cip30WalletImpl(handle)
}

/**
 * @implements {Cip30Wallet}
 */
class Cip30WalletImpl {
    /**
     * @readonly
     * @type {Cip30FullHandle}
     */
    handle

    /**
     * Constructs Cip30Wallet using the Cip30Handle which is available in the browser window.cardano context.
     *
     * ```ts
     * const wallet = new Cip30Wallet(await window.cardano.eternl.enable())
     * ```
     * @param {Cip30FullHandle} handle
     */
    constructor(handle) {
        this.handle = handle
    }

    /**
     * Returns `true` if the wallet is connected to the mainnet.
     * @returns {Promise<boolean>}
     */
    async isMainnet() {
        return (await this.handle.getNetworkId()) == 1
    }

    /**
     * Gets a list of unique reward addresses which can be used to UTxOs to.
     * @type {Promise<StakingAddress[]>}
     */
    get stakingAddresses() {
        return this.handle.getRewardAddresses().then((addresses) => {
            if (!Array.isArray(addresses)) {
                throw new Error(
                    `The wallet getRewardAddresses() call did not return an array.`
                )
            }

            return addresses.map((a) => makeStakingAddress(a))
        })
    }

    /**
     * Gets a list of addresses which contain(ed) UTxOs.
     * @type {Promise<ShelleyAddress<PubKeyHash>[]>}
     */
    get usedAddresses() {
        return this.handle.getUsedAddresses().then((addresses) =>
            addresses.map((a) => {
                const addr = makeShelleyAddress(a)

                if (addr.spendingCredential.kind != "PubKeyHash") {
                    throw new Error("expected PubKeyHash spending credentiel")
                }

                return /** @type {ShelleyAddress<PubKeyHash>} */ (addr)
            })
        )
    }

    /**
     * Gets a list of unique unused addresses which can be used to UTxOs to.
     * @type {Promise<ShelleyAddress<PubKeyHash>[]>}
     */
    get unusedAddresses() {
        return this.handle.getUnusedAddresses().then((addresses) =>
            addresses.map((a) => {
                const addr = makeShelleyAddress(a)

                if (addr.spendingCredential.kind != "PubKeyHash") {
                    throw new Error("expected PubKeyHash spending credentiel")
                }

                return /** @type {ShelleyAddress<PubKeyHash>} */ (addr)
            })
        )
    }

    /**
     * Gets the complete list of UTxOs (as `TxInput` instances) sitting at the addresses owned by the wallet.
     * @type {Promise<TxInput<PubKeyHash>[]>}
     */
    get utxos() {
        return this.handle
            .getUtxos()
            .then((utxos) =>
                utxos.map(
                    (u) => /** @type {TxInput<PubKeyHash>} */ (decodeTxInput(u))
                )
            )
    }

    /**
     * @type {Promise<TxInput<PubKeyHash>[]>}
     */
    get collateral() {
        const getCollateral =
            this.handle.getCollateral || this.handle.experimental.getCollateral
        return getCollateral().then((utxos) =>
            utxos.map(
                (u) => /** @type {TxInput<PubKeyHash>} */ (decodeTxInput(u))
            )
        )
    }

    /**
     * Sign a data payload with the users wallet.
     *
     * @param {ShelleyAddress<PubKeyHash>} addr - A Cardano address object
     * @param {BytesLike} data - The message to sign
     * @return {Promise<{signature: Cip30CoseSign1, key: PubKey}>}
     */
    async signData(addr, data) {
        const dataBytes = toBytes(data)

        if (addr.kind != "Address" || addr.era != "Shelley") {
            throw new Error(
                `The value in the addr parameter is not a Cardano Shelley-era Address object.`
            )
        } else if (dataBytes.length == 0) {
            throw new Error(`The data argument is empty. Must be non-empty`)
        }

        // Convert the string to a hex string since that is what
        //  the underlying signData() method expects.

        const { signature, key } = await this.handle.signData(
            addr.toHex(),
            bytesToHex(dataBytes)
        )

        return {
            signature: decodeCip30CoseSign1(signature),
            key: decodeCip30CosePubKey(key)
        }
    }

    /**
     * Signs a transaction, returning a list of signatures needed for submitting a valid transaction.
     * @param {Tx} tx
     * @returns {Promise<Signature[]>}
     */
    async signTx(tx) {
        const res = await this.handle.signTx(bytesToHex(tx.toCbor()), true)

        return decodeTxWitnesses(res).signatures
    }

    /**
     * Submits a transaction to the blockchain.
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        const responseText = await this.handle.submitTx(bytesToHex(tx.toCbor()))

        return makeTxId(responseText)
    }
}
