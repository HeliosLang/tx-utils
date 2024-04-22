import { Tx, TxInput, TxOutput, TxOutputId } from "@helios-lang/ledger"

export class TxChain {
    /**
     * @readonly
     * @type {Tx[]}
     */
    txs

    /**
     * @param {Tx[]} txs
     */
    constructor(txs) {
        this.txs = txs
    }

    /**
     * Returns all the inputs that aren't spent by the chain itself
     * (i.e. these inputs must exist before the chain is submitted)
     * @param {boolean} includeRefInputs
     * @param {boolean} includeCollateral
     * @returns {TxInput[]}
     */
    collectInputs(includeRefInputs = false, includeCollateral = false) {
        const txIds = this.txs.map((tx) => tx.id())

        /**
         * @type {TxInput[]}
         */
        const res = []

        /**
         *
         * @param {TxInput} inp
         * @param {number} txI
         * @returns {void}
         */
        const pushInput = (inp, txI) => {
            if (res.some((prev) => prev.isEqual(inp))) {
                return
            }

            if (txIds.slice(0, txI).some((txId) => txId.isEqual(inp.id.txId))) {
                return
            }

            res.push(inp)
        }

        /**
         * @param {TxInput[]} inps
         * @param {number} txI
         */
        const pushInputs = (inps, txI) => {
            inps.forEach(pushInput, txI)
        }

        this.txs.forEach((tx, i) => {
            pushInputs(tx.body.inputs, i)

            if (includeRefInputs) {
                pushInputs(tx.body.refInputs, i)
            }

            if (includeCollateral) {
                pushInputs(tx.body.collateral, i)
            }
        })

        return res
    }

    /**
     * Collects all outputs that are spent by the chain itself
     * (i.e. these outputs will be available as UTxOs once the chain is submitted)
     *
     * Returns as TxInput instead of TxOutput so that TxOutputId is included
     * @returns {TxInput[]}
     */
    collectOutputs() {
        const txIds = this.txs.map((tx) => tx.id())

        /**
         * @type {TxInput[]}
         */
        const res = []

        /**
         * @param {TxOutput} output
         * @param {number} txI
         * @param {number} utxoId
         * @returns {void}
         */
        const pushOutput = (output, txI, utxoId) => {
            const utxo = new TxInput(new TxOutputId(txIds[txI], utxoId), output)

            if (
                this.txs
                    .slice(txI + 1)
                    .some((tx) =>
                        tx.body.inputs.some((input) => input.isEqual(utxo))
                    )
            ) {
                return
            }

            res.push(utxo)
        }

        /**
         * @param {TxOutput[]} outputs
         * @param {number} txI
         */
        const pushOutputs = (outputs, txI) => {
            outputs.forEach((output, i) => pushOutput(output, txI, i))
        }

        for (let i = this.txs.length - 1; i >= 0; i--) {
            const tx = this.txs[i]

            pushOutputs(tx.body.outputs, i)
        }

        return res
    }
}
