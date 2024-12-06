import { addValues, makeTxInput, makeTxOutput } from "@helios-lang/ledger"
import { selectSmallestFirst } from "../coinselection/index.js"

/**
 * @import { Address, NetworkParams, SpendingCredential, Tx, TxId, TxInput, TxOutputId, Value } from "@helios-lang/ledger"
 * @import { CardanoClient, CardanoClientHelper, CardanoClientHelperOptions, CoinSelection, ReadonlyCardanoClient } from "../index.js"
 */

/**
 * @template {ReadonlyCardanoClient} C
 * @param {C} client
 * @param {CardanoClientHelperOptions} options
 * @returns {CardanoClientHelper<C>}
 */
export function makeCardanoClientHelper(client, options = {}) {
    return new CardanoClientHelperImpl(client, options)
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
        return addValues(await this.getUtxos(address))
    }

    /**
     * @template {SpendingCredential} [SC=SpendingCredential]
     * @param {TxOutputId} id
     * @param {Address<SC> | undefined} address
     * @returns {Promise<TxInput<SC>>}
     */
    async getUtxo(id, address = undefined) {
        const utxo = await this.client.getUtxo(id)

        if (address) {
            if (!utxo.address.isEqual(address)) {
                throw new Error(
                    `expected Address UTxO ${id.toString()} to be ${address.toString()}, got address ${utxo.address.toString()}`
                )
            }

            return makeTxInput(
                id,
                makeTxOutput(
                    address,
                    utxo.value,
                    utxo.datum,
                    utxo.output.refScript
                )
            )
        } else {
            return /** @type {any} */ (utxo)
        }
    }

    /**
     * @template {SpendingCredential} [SC=SpendingCredential]
     * @param {Address<SC>} address
     * @returns {Promise<TxInput<SC>[]>}
     */
    async getUtxos(address) {
        const utxos = await this.client.getUtxos(address)

        return utxos.map((utxo) => {
            return makeTxInput(
                utxo.id,
                makeTxOutput(
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
     * @template {SpendingCredential} [SC=SpendingCredential]
     * @param {Address<SC>} address
     * @param {Value} value
     * @returns {Promise<TxInput<SC>>}
     */
    async selectUtxo(address, value) {
        const findUtxo = async () => {
            const utxos = /** @type {TxInput<SC>[]} */ (
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
            `no UTxO found at ${address.toString()} that is large enough to cover ${JSON.stringify(value.dump(), undefined, 4)}`
        )
    }

    /**
     * @template {SpendingCredential} [SC=SpendingCredential]
     * @param {Address<SC>} address
     * @param {Value} value
     * @param {CoinSelection<SC>} coinSelection
     * @returns {Promise<TxInput<SC>[]>}
     */
    async selectUtxos(address, value, coinSelection = selectSmallestFirst()) {
        const utxos = await this.getUtxos(address)

        return /** @type {TxInput<SC>[]} */ (coinSelection(utxos, value)[0])
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
