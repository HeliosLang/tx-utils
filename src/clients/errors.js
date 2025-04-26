/**
 * @import { TxOutputId } from "@helios-lang/ledger"
 */

/**
 * @typedef {Object} ExpiryDetails
 * @property {true} isExpired
 * @property {true} isPremature
 */

/**
 * Detects if the tx is not submittable due to validity interval.
 * @param {string} message
 * @remarks
 * Note that different clients may not be able to distinguish between
 * expired txs and txs that are not yet valid.
 *
 * Client code getting this error with the `isIndeterminate` flag may need to query
 * through the client for current-slot/time to determine if the tx is expired
 * or premature.
 *
 * The `isDeterminate` flag is set by default; client implementations should use the
 * `expired()` or `premature()` method to indicate a definite state if available.
 * @extends {Error}
 */
export class SubmissionExpiryError extends Error {
    kind = "SubmissionExpiryError"
    /**
     * If true, the tx is definitely expired.  If not, it may be either expired or premature.
     * @type {boolean | undefined}
     */
    isExpired

    /**
     * If true, the tx is definitely premature.  If undefined, it may be either expired or premature.
     * @type {boolean | undefined}
     */
    isPremature

    /**
     * If true, the client does not have enough information to determine if the tx is expired or premature.
     * @type {boolean}
     */
    isIndeterminate

    /**
     * @argument {string} message
     * @argument {ExpiryDetails} [options]
     */
    constructor(message, options) {
        super(message)
        if (options) {
            const { isExpired, isPremature } = options
            this.isExpired = isExpired
            this.isPremature = isPremature
            if (isExpired && isPremature) {
                throw new Error("isExpired and isPremature cannot both be true")
            }
            this.isIndeterminate = !(isExpired || isPremature)
        } else {
            this.isExpired = undefined
            this.isPremature = undefined
            this.isIndeterminate = true
        }
    }
}

/**
 * An error indicating that a tx is not submittable due to a utxo error
 * @extends {Error}
 * @remarks
 * A utxo error may be linked to a specific utxo, or the client may not have
 * enough information to determine the offending utxo.  Additionally, the
 * client may be unable to distinguish between utxos that are not yet known
 * and utxos that have already been spent.  You should inspect the error
 * details to determine how to proceed.
 *
 * The `message` and `jsonError` attributes are client-specific, and may contain
 * more detailed context about the error.
 *
 * If these included details are insufficient to identify the problem, you can
 * fall back to querying for the utxo (or, if needed, for each of the tx inputs):
 * status: known / unspent, already-spent, or not (yet?) known.
 *
 * Implementors of client code that throws this error SHOULD set all available
 * details in the error object.
 */
export class SubmissionUtxoError extends Error {
    kind = "SubmissionUtxoError"
    /**
     * @readonly
     * @type {TxOutputId | undefined}
     */
    utxoId

    /**
     * @readonly
     * @type {Object}
     */
    jsonError

    /**
     * @argument {string} message
     * @argument {TxOutputId} [utxoId]
     * @argument {Object} [jsonError]
     */
    constructor(message, utxoId, jsonError) {
        super(message)
        this.utxoId = utxoId
        this.jsonError = jsonError
    }
}
