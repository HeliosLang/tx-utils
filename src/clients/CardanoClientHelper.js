import {
    Address,
    Tx,
    TxId,
    TxInput,
    TxOutput,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { selectSmallestFirst } from "../coinselection/index.js"

/**
 * @import { NetworkParams } from "@helios-lang/ledger"
 * @import { CardanoClient, CardanoClientHelper, CardanoClientHelperOptions, CoinSelection, ReadonlyCardanoClient } from "src/index.js"
 */

/**
 * @template {ReadonlyCardanoClient} C
 * @param {C} client
 * @returns {CardanoClientHelper<C>}
 */
export function makeCardanoClientHelper(client) {
    return new CardanoClientHelperImpl(client)
}

/**
 * @template {ReadonlyCardanoClient} C
 * @implements {CardanoClientHelper<C>}
 */
class CardanoClientHelperImpl {
    /**
     * @readonly
     * @type {C}
     */
    client

    /**
     * @readonly
     * @type {CardanoClientHelperOptions}
     */
    options

    /**
     * @param {C} client
     * @param {CardanoClientHelperOptions} options
     */
    constructor(client, options = {}) {
        this.client = client
        this.options = options
    }

    /**
     * @type {number}
     */
    get now() {
        return this.client.now
    }

    /**
     * @type {Promise<NetworkParams>}
     */
    get parameters() {
        return this.client.parameters
    }

    /**
     * @returns {boolean}
     */
    isMainnet() {
        return this.client.isMainnet()
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
     * @param {Address<CSpending, CStaking> | undefined} address
     * @returns {Promise<TxInput<CSpending, CStaking>>}
     */
    async getUtxo(id, address = undefined) {
        const utxo = await this.client.getUtxo(id)

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
        const utxos = await this.client.getUtxos(address)

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
     * @param {CoinSelection<CSpending, CStaking>} coinSelection
     * @returns {Promise<TxInput<CSpending, CStaking>[]>}
     */
    async selectUtxos(address, value, coinSelection = selectSmallestFirst()) {
        const utxos = await this.getUtxos(address)

        return /** @type {TxInput<CSpending, CStaking>[]} */ (
            coinSelection(utxos, value)[0]
        )
    }

    /**
     * @type {C extends CardanoClient ? (tx: Tx) => Promise<TxId> : never}
     */
    get submitTx() {
        const c = this.client

        if (isCardanoClient(c)) {
            /**
             * @param {Tx} tx
             * @returns {Promise<TxId>}
             */
            const fn = async (tx) => {
                return c.submitTx(tx)
            }

            return /** @type {any} */ (fn)
        } else {
            throw new Error("submitTx not available on ReadonlyCardanoClient")
        }
    }
}

/**
 * @param {ReadonlyCardanoClient} c
 * @returns {c is CardanoClient}
 */
function isCardanoClient(c) {
    return "submitTx" in c
}
