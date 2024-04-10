import { equalsBytes } from "@helios-lang/codec-utils"
import { Address, Tx, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
/**
 * @typedef {import("./EmulatorTx.js").EmulatorTx} EmulatorTx
 */

/**
 * @implements {EmulatorTx}
 */
export class RegularTx {
    /**
     * @type {Tx}
     */
    #tx

    /**
     * @param {Tx} tx
     */
    constructor(tx) {
        this.#tx = tx
    }

    /**
     * @returns {TxId}
     */
    id() {
        return this.#tx.id()
    }

    /**
     * @param {TxInput} utxo
     * @returns {boolean}
     */
    consumes(utxo) {
        const txInputs = this.#tx.body.inputs

        return txInputs.some((txInput) => txInput.isEqual(utxo))
    }

    /**
     * @param {Address} address
     * @param {TxInput[]} utxos
     * @returns {TxInput[]}
     */
    collectUtxos(address, utxos) {
        utxos = utxos.filter((utxo) => !this.consumes(utxo))

        const txOutputs = this.#tx.body.outputs

        txOutputs.forEach((txOutput, utxoId) => {
            if (equalsBytes(txOutput.address.bytes, address.bytes)) {
                utxos.push(
                    new TxInput(new TxOutputId(this.id(), utxoId), txOutput)
                )
            }
        })

        return utxos
    }

    /**
     * @param {TxOutputId} id
     * @returns {null | TxInput}
     */
    getUtxo(id) {
        if (!id.txId.isEqual(this.id())) {
            return null
        }

        /**
         * @type {null | TxInput}
         */
        let utxo = null

        this.#tx.body.outputs.forEach((output, i) => {
            if (i == id.utxoIdx) {
                utxo = new TxInput(id, output)
            }
        })

        return utxo
    }

    dump() {
        console.log("REGULAR TX")
        console.log(JSON.stringify(this.#tx.dump(), undefined, "  "))
    }
}
