import { bytesToHex } from "@helios-lang/codec-utils"
import {
    Address,
    Signature,
    StakingAddress,
    Tx,
    TxId,
    TxInput,
    TxWitnesses
} from "@helios-lang/ledger"

/**
 * @typedef {import("./Cip30Handle.js").Cip30FullHandle} Cip30FullHandle
 * @typedef {import("./Wallet.js").Wallet} Wallet
 */

/**
 * Implementation of `Wallet` that lets you connect to a browser plugin wallet.
 * @implements {Wallet}
 */
export class Cip30Wallet {
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

            return addresses.map((a) => new StakingAddress(a))
        })
    }

    /**
     * Gets a list of addresses which contain(ed) UTxOs.
     * @type {Promise<Address<null, unknown>[]>}
     */
    get usedAddresses() {
        return this.handle
            .getUsedAddresses()
            .then((addresses) => addresses.map((a) => new Address(a)))
    }

    /**
     * Gets a list of unique unused addresses which can be used to UTxOs to.
     * @type {Promise<Address<null, unknown>[]>}
     */
    get unusedAddresses() {
        return this.handle
            .getUnusedAddresses()
            .then((addresses) => addresses.map((a) => new Address(a)))
    }

    /**
     * Gets the complete list of UTxOs (as `TxInput` instances) sitting at the addresses owned by the wallet.
     * @type {Promise<TxInput<null, unknown>[]>}
     */
    get utxos() {
        return this.handle
            .getUtxos()
            .then((utxos) =>
                utxos.map(
                    (u) =>
                        /** @type {TxInput<null, unknown>} */ (
                            TxInput.fromCbor(u)
                        )
                )
            )
    }

    /**
     * @type {Promise<TxInput<null, unknown>[]>}
     */
    get collateral() {
        const getCollateral =
            this.handle.getCollateral || this.handle.experimental.getCollateral
        return getCollateral().then((utxos) =>
            utxos.map(
                (u) =>
                    /** @type {TxInput<null, unknown>} */ (TxInput.fromCbor(u))
            )
        )
    }

    /**
     * Sign a data payload with the users wallet.
     *
     * @param {Address} addr - A Cardano address object
     * @param {number[]} data - The message to sign
     * @return {Promise<Signature>}
     */
    async signData(addr, data) {
        if (!(addr instanceof Address)) {
            throw new Error(
                `The value in the addr parameter is not a Cardano Address object.`
            )
        } else if (data.length == 0) {
            throw new Error(`The data argument is empty. Must be non-empty`)
        }

        // Convert the string to a hex string since that is what
        //  the underlying signData() method expects.

        const { signature, key } = await this.handle.signData(
            addr.toHex(),
            bytesToHex(data)
        )

        return new Signature(key, signature)
    }

    /**
     * Signs a transaction, returning a list of signatures needed for submitting a valid transaction.
     * @param {Tx} tx
     * @returns {Promise<Signature[]>}
     */
    async signTx(tx) {
        const res = await this.handle.signTx(bytesToHex(tx.toCbor()), true)

        return TxWitnesses.fromCbor(res).signatures
    }

    /**
     * Submits a transaction to the blockchain.
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        const responseText = await this.handle.submitTx(bytesToHex(tx.toCbor()))

        return new TxId(responseText)
    }
}
