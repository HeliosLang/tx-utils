/**
 * @import { TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
 */

export class UtxoNotFoundError extends Error {
    /**
     * @readonly
     * @type {TxOutputId}
     */
    utxoId

    /**
     * @param {TxOutputId} utxoId
     */
    constructor(utxoId) {
        super(`UTxO ${utxoId.toString()} not found`)

        this.utxoId = utxoId
    }
}

export class UtxoAlreadySpentError extends Error {
    /**
     * @readonly
     * @type {TxInput}
     */
    utxo

    /**
     * @readonly
     * @type {TxId | undefined}
     */
    consumedBy

    /**
     * @param {TxInput} utxo
     * @param {TxId | undefined} consumedBy
     */
    constructor(utxo, consumedBy = undefined) {
        const utxoId = utxo.id

        super(
            `UTxO ${utxoId.toString()} already spent${consumedBy ? `(spent by tx ${consumedBy.toString()}` : ""}`
        )

        this.utxo = utxo
        this.consumedBy = consumedBy
    }
}
