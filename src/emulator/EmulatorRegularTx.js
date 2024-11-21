import { equalsBytes } from "@helios-lang/codec-utils"
import { makeTxInput, makeTxOutputId } from "@helios-lang/ledger"

/**
 * @import { Address, Tx, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
 * @import { EmulatorRegularTx } from "../index.js"
 */

/**
 * @param {Tx} tx
 * @returns {EmulatorRegularTx}
 */
export function makeEmulatorRegularTx(tx) {
    return new EmulatorRegularTxImpl(tx)
}

/**
 * @implements {EmulatorRegularTx}
 */
class EmulatorRegularTxImpl {
    /**
     * @private
     * @readonly
     * @type {Tx}
     */
    _tx

    /**
     * @param {Tx} tx
     */
    constructor(tx) {
        this._tx = tx
    }

    /**
     * @type {"Regular"}
     */
    get kind() {
        return "Regular"
    }

    /**
     * @returns {TxId}
     */
    id() {
        return this._tx.id()
    }

    /**
     * @param {TxInput} utxo
     * @returns {boolean}
     */
    consumes(utxo) {
        const txInputs = this._tx.body.inputs

        return txInputs.some((txInput) => txInput.isEqual(utxo))
    }

    /**
     * @param {Address} address
     * @param {TxInput[]} utxos
     * @returns {TxInput[]}
     */
    collectUtxos(address, utxos) {
        utxos = utxos.filter((utxo) => !this.consumes(utxo))

        const txOutputs = this._tx.body.outputs

        txOutputs.forEach((txOutput, utxoId) => {
            if (equalsBytes(txOutput.address.bytes, address.bytes)) {
                utxos.push(
                    makeTxInput(
                        makeTxOutputId(this.id(), utxoId),
                        txOutput.copy()
                    )
                )
            }
        })

        return utxos
    }

    /**
     * @param {TxOutputId} id
     * @returns {TxInput | undefined}
     */
    getUtxo(id) {
        if (!id.txId.isEqual(this.id())) {
            return undefined
        }

        /**
         * @type {TxInput | undefined}
         */
        let utxo = undefined

        this._tx.body.outputs.forEach((output, i) => {
            if (i == id.index) {
                utxo = makeTxInput(id, output.copy())
            }
        })

        return utxo
    }

    /**
     * @returns {TxInput[]}
     */
    newUtxos() {
        const id = this.id()

        return this._tx.body.outputs.map((output, i) => {
            return makeTxInput(makeTxOutputId(id, i), output.copy())
        })
    }

    /**
     * @returns {TxInput[]}
     */
    consumedUtxos() {
        return this._tx.body.inputs
    }

    /**
     * @returns {void}
     */
    dump() {
        console.log("REGULAR TX")
        console.log(JSON.stringify(this._tx.dump(), undefined, "  "))
    }
}
