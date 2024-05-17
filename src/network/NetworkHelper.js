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
 * @typedef {import("@helios-lang/ledger").NetworkParams} NetworkParams
 * @typedef {import("./Network.js").ReadonlyNetwork} ReadonlyNetwork
 */

/**
 * @template CSpending
 * @typedef {import("../coinselection/index.js").CoinSelection<CSpending>} CoinSelection
 */

/**
 * @typedef {{
 *   onSelectUtxoFail?: (address: Address, value: Value) => Promise<void>
 * }} NetworkHelperOptions
 */

/**
 * @implements {ReadonlyNetwork}
 */
export class NetworkHelper {
    /**
     * @readonly
     * @type {ReadonlyNetwork}
     */
    network

    /**
     * @readonly
     * @type {NetworkHelperOptions}
     */
    options

    /**
     * @param {ReadonlyNetwork} network
     * @param {NetworkHelperOptions} options
     */
    constructor(network, options = {}) {
        this.network = network
        this.options = options
    }

    /**
     * @type {number}
     */
    get now() {
        return this.network.now
    }

    /**
     * @type {Promise<NetworkParams>}
     */
    get parameters() {
        return this.network.parameters
    }

    /**
     * @returns {boolean}
     */
    isMainnet() {
        return this.network.isMainnet()
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
        const utxos = await this.network.getUtxos(address)

        return utxos.map((utxo) => {
            return new TxInput(
                utxo.id,
                new TxOutput(
                    address,
                    utxo.value,
                    utxo.datum,
                    utxo.output.refScript
                )
            )
        })
    }

    /**
     * This method is used to select very specific UTxOs that contain known tokens/NFTs
     * If the UTxO isn't found that usually means something is wrong with the network synchronization
     * The onSelectUtxoFail callback can be used to trigger a synchronization action if the UTxO isn' found
     * @template CSpending
     * @template CStaking
     * @param {Address<CSpending, CStaking>} address
     * @param {Value} value
     * @returns {Promise<TxInput<CSpending, CStaking>>}
     */
    async selectUtxo(address, value) {
        const findUtxo = async () => {
            const utxos = /** @type {TxInput<CSpending, CStaking>[]} */ (
                await this.getUtxos(address)
            )

            for (let utxo of utxos) {
                if (utxo.value.isGreaterOrEqual(value)) {
                    return utxo
                }
            }

            return
        }

        const utxo = await findUtxo()

        if (utxo) {
            return utxo
        }

        if (this.options.onSelectUtxoFail) {
            await this.options.onSelectUtxoFail(address, value)

            const utxo = await findUtxo()

            if (utxo) {
                return utxo
            }
        }

        throw new Error(
            `no UTxO found at ${address.toBech32()} that is large enough to cover ${JSON.stringify(value.dump(), undefined, 4)}`
        )
    }

    /**
     * @template CSpending
     * @template CStaking
     * @param {Address<CSpending, CStaking>} address
     * @param {Value} value
     * @param {CoinSelection<CSpending>} coinSelection
     * @returns {Promise<TxInput<CSpending, CStaking>[]>}
     */
    async selectUtxos(address, value, coinSelection = selectSmallestFirst()) {
        const utxos = await this.getUtxos(address)

        return /** @type {TxInput<CSpending, CStaking>[]} */ (
            coinSelection(utxos, value)[0]
        )
    }
}
