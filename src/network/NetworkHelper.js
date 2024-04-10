import {
    Address,
    TxInput,
    TxOutput,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { selectSmallestFirst } from "../coinselection/index.js"
import { None } from "@helios-lang/type-utils"

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
     * @param {Address} address
     * @returns {Promise<Value>}
     */
    async calcBalance(address) {
        return Value.sum(await this.getUtxos(address))
    }

    /**
     * @template [CSpending=unknown]
     * @template [CStaking=unknown]
     * @param {TxOutputId} id
     * @param {Option<Address<CSpending, CStaking>>} address
     * @returns {Promise<TxInput<CSpending, CStaking>>}
     */
    async getUtxo(id, address = None) {
        const utxo = await this.network.getUtxo(id)

        if (address) {
            if (!utxo.address.isEqual(address)) {
                throw new Error(
                    `expected Address UTxO ${id.toString()} to be ${address.toString()}, got address ${utxo.address.toString()}`
                )
            }

            return new TxInput(
                id,
                new TxOutput(
                    address,
                    utxo.value,
                    utxo.datum,
                    utxo.output.refScript
                )
            )
        } else {
            return utxo
        }
    }

    /**
     * @template CSpending
     * @template CStaking
     * @param {Address<CSpending, CStaking>} address
     * @returns {Promise<TxInput<CSpending, CStaking>[]>}
     */
    async getUtxos(address) {
        return this.network.getUtxos(address)
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
