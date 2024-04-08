import { Address, TxInput, Value } from "@helios-lang/ledger"
import { selectSmallestFirst } from "../coinselection/index.js"

/**
 * @typedef {import("../coinselection/index.js").CoinSelection} CoinSelection
 * @typedef {import("./Network.js").Network} Network
 */

export class NetworkHelper {
    /**
     * @readonly
     * @type {Network}
     */
    network

    /**
     * @param {Network} network
     */
    constructor(network) {
        this.network = network
    }

    /**
     * @template CSpending
     * @template CStaking
     * @param {Address<CSpending, CStaking>} address
     * @param {Value} value
     * @returns {Promise<TxInput<CSpending, CStaking>>}
     */
    async selectUtxo(address, value) {
        const utxos = /** @type {TxInput<CSpending, CStaking>[]} */ (
            await this.network.getUtxos(address)
        )

        for (let utxo of utxos) {
            if (utxo.value.isGreaterOrEqual(value)) {
                return utxo
            }
        }

        throw new Error(
            `no UTxO found at ${address.toBech32()} that is large enough`
        )
    }

    /**
     * @template CSpending
     * @template CStaking
     * @param {Address<CSpending, CStaking>} address
     * @param {Value} value
     * @param {CoinSelection} coinSelection
     * @returns {Promise<TxInput<CSpending, CStaking>[]>}
     */
    async selectUtxos(address, value, coinSelection = selectSmallestFirst) {
        const utxos = await this.network.getUtxos(address)

        return /** @type {TxInput<CSpending, CStaking>[]} */ (
            coinSelection(utxos, value)[0]
        )
    }
}
