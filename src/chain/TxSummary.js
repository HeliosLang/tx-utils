import { bytesToHex } from "@helios-lang/codec-utils"
import { Address, Tx, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
import {
    isArray,
    isFormattedString,
    isNumber,
    isObject
} from "@helios-lang/type-utils"

/**
 * @import { AssertExtends, FirstArgType } from "@helios-lang/type-utils"
 * @import { TxSummary, TxSummaryJsonSafe } from "src/index.js"
 */

/**
 * @typedef {{
 *   id: TxId
 *   inputs: TxInput[]
 *   outputs: TxInput[]
 *   timestamp: number
 * }} TxSummaryProps
 */

/**
 * @param {object} props
 * @param {TxId | string} props.id
 * @param {(TxInput | string)[]} props.inputs
 * @param {(TxInput | string)[]} props.outputs
 * @param {number} props.timestamp
 * @returns {TxSummary}
 */
export function makeTxSummary(props) {
    return new TxSummaryImpl({
        id: typeof props.id == "string" ? TxId.new(props.id) : props.id,
        inputs: props.inputs.map(
            /**
             * @param {TxInput | string} utxo
             * @returns {TxInput}
             */
            (utxo) => {
                if (typeof utxo == "string") {
                    return TxInput.fromCbor(utxo)
                } else {
                    return utxo
                }
            }
        ),
        outputs: props.outputs.map(
            /**
             * @param {TxInput | string} utxo
             * @returns {TxInput}
             */
            (utxo) => {
                if (typeof utxo == "string") {
                    return TxInput.fromCbor(utxo)
                } else {
                    return utxo
                }
            }
        ),
        timestamp: props.timestamp
    })
}

/**
 * Mostly based on timestamp, spend chain only used in rare cases where timestamp is the same
 *
 * This is so that reversed TxSummaries (due to rollbacks) can be superimposed as well
 * @param {TxSummary} a
 * @param {TxSummary} b
 * @returns {number}
 */
export function compareTxSummaries(a, b) {
    if (a.id.isEqual(b.id)) {
        return 0
    }

    if (a.timestamp == b.timestamp) {
        if (a.outputs.some((output) => b.spends(output))) {
            return -1
        } else if (b.outputs.some((output) => a.spends(output))) {
            return 1
        } else {
            return 0
        }
    } else {
        return a.timestamp - b.timestamp
    }
}

/**
 * @param {Tx} tx
 * @param {number} timestamp
 * @returns {TxSummary}
 */
export function summarizeTx(tx, timestamp) {
    const id = tx.id()
    const inputs = tx.body.inputs.slice()
    const outputs = tx.body.outputs.map(
        (output, i) => new TxInput(new TxOutputId(id, i), output)
    )

    return new TxSummaryImpl({ id, inputs, outputs, timestamp })
}

/**
 * @template [CSpending=unknown]
 * @template [CStaking=unknown]
 * @param {TxInput<CSpending, CStaking>[]} utxos
 * @param {TxSummary[]} summaries - sorted inplace
 * @param {Address<CSpending, CStaking>[]} addresses - only track a limited number of addresses
 * @returns {TxInput<CSpending, CStaking>[]}
 */
export function superimposeUtxosOnSummaries(utxos, summaries, addresses) {
    summaries.sort(compareTxSummaries)

    summaries.forEach((summary) => {
        utxos = summary.superimpose(utxos, addresses)
    })

    return utxos
}

/**
 * @param {unknown} input
 * @returns {input is TxSummaryJsonSafe}
 */
export function isTxSummaryJsonSafe(input) {
    return isObject(input, {
        id: isFormattedString(TxId.isValid),
        inputs: isArray(isFormattedString(TxInput.isValidCbor(true))),
        outputs: isArray(isFormattedString(TxInput.isValidCbor(true))),
        timestamp: isNumber
    })
}

/**
 * @implements {TxSummary}
 */
class TxSummaryImpl {
    /**
     * @readonly
     * @type {TxId}
     */
    id

    /**
     * Fully resolved inputs
     * @readonly
     * @type {TxInput[]}
     */
    inputs

    /**
     * Outputs as UTxOs (so that rollbacks can simply swap `inputs` <-> `outputs`)
     * @readonly
     * @type {TxInput[]}
     */
    outputs

    /**
     * @readonly
     * @type {number}
     */
    timestamp

    /**
     * @param {TxSummaryProps} props
     */
    constructor({ id, inputs, outputs, timestamp }) {
        this.id = id
        this.inputs = inputs
        this.outputs = outputs
        this.timestamp = timestamp
    }

    /**
     * @template [CSpending=unknown]
     * @template [CStaking=unknown]
     * @param {Address<CSpending, CStaking>[]} addresses
     * @returns {TxInput<CSpending, CStaking>[]}
     */
    getUtxosPaidTo(addresses) {
        return this.outputs.filter((output) =>
            addresses.some((a) => output.address.isEqual(a))
        )
    }

    /**
     * @param {TxInput | TxOutputId} utxo
     * @returns {boolean}
     */
    spends(utxo) {
        const utxoId = utxo instanceof TxOutputId ? utxo : utxo.id

        return this.inputs.some((input) => input.id.isEqual(utxoId))
    }

    /**
     * Used for rollbacks
     * @returns {TxSummary}
     */
    reverse() {
        return new TxSummaryImpl({
            id: this.id,
            inputs: this.outputs.slice(),
            outputs: this.inputs.slice(),
            timestamp: this.timestamp
        })
    }

    /**
     * @template [CSpending=unknown]
     * @template [CStaking=unknown]
     * @param {TxInput<CSpending, CStaking>[]} utxos
     * @param {Address<CSpending, CStaking>[]} addresses
     * @returns {TxInput<CSpending, CStaking>[]}
     */
    superimpose(utxos, addresses) {
        utxos = utxos.filter((utxo) => !this.spends(utxo))

        const extraUtxos = this.getUtxosPaidTo(addresses).filter(
            (extraUtxo) => !utxos.some((utxo) => utxo.isEqual(extraUtxo))
        )

        return utxos.concat(extraUtxos)
    }

    /**
     * @returns {TxSummaryJsonSafe}
     */
    toJsonSafe() {
        return {
            id: this.id.toString(),
            inputs: this.inputs.map((input) => bytesToHex(input.toCbor(true))),
            outputs: this.outputs.map((output) =>
                bytesToHex(output.toCbor(true))
            ),
            timestamp: this.timestamp
        }
    }
}
