import { ADA, makeValue } from "@helios-lang/ledger"
import { selectSmallestFirst } from "./extremumFirst.js"
import { InsufficientFundsError } from "./InsufficientFundsError.js"

/**
 * @import { AssetClass, SpendingCredential, TxInput, Value } from "@helios-lang/ledger"
 */

/**
 * First select the smallest utxos that contain only `includeAssets` (ignoring pure-ADA UTXOs if it ADA isn't in `includeAssets`)
 *   - simple use the selectSmallestFirst algorithm for this, filtering out UTxOs that contain asset classes that aren't in `includeAssets` nor in `amount`
 *   - if the first selection fails (eg. due to dirty UTxOs), retry by only filtering out UTxOs that contain asset classes in `excludeAssets`
 *
 * Keep adding utxo for the left-over list (without additional sorting) until maxUtxos is reached
 *
 * All UTxOs contain some lovelace, so require special treatment:
 *   - pure lovelace UTxOs are treated as containing the lovelace assetClass
 *   - UTxOs that contain lovelace in addition to other assetClasses are treated as containing those other assetClasses (but not lovelace)
 * @param {object} props
 * @param {AssetClass[]} props.includeAssets
 * @param {AssetClass[]} props.excludeAssets
 * @param {number} [props.maxUtxos] defaults to 5
 */
export function consolidate(props) {
    const includeAssets = props.includeAssets
    const maxUtxos = props?.maxUtxos ?? 5

    /**
     * @template {SpendingCredential} [SC=SpendingCredential]
     * @param {TxInput<SC>[]} utxos
     * @param {Value} amount
     * @returns {[TxInput<SC>[], TxInput<SC>[]]}
     */
    return (utxos, amount) => {
        /**
         * @type {TxInput<SC>[]}
         */
        let selectedUtxos

        /**
         * @type {TxInput<SC>[]}
         */
        let remainingUtxos

        try {
            const s = collectAssetClasses(amount, includeAssets)

            const filteredUtxos = utxos.filter((utxo) => {
                const utxoAssetClasses = utxo.value.assets.assetClasses

                // ignore pure lovelace utxos if lovelace isn't included assetClasses
                if (utxoAssetClasses.length == 0) {
                    return s.has(ADA.toString())
                } else {
                    return utxoAssetClasses.every((ac) => s.has(ac.toString()))
                }
            })

            const selectionResult = selectSmallestFirst({
                allowSelectingUninvolvedAssets: true
            })(filteredUtxos, amount)

            selectedUtxos = selectionResult[0]
            remainingUtxos = selectionResult[1]
        } catch (e) {
            if (e instanceof InsufficientFundsError) {
                // retry filtering out using `excludeAssets`
                const excludeAssets = props.excludeAssets

                const s = collectAssetClasses(makeValue(0n), excludeAssets)

                const filteredUtxos = utxos.filter((utxo) => {
                    const utxoAssetClasses = utxo.value.assets.assetClasses

                    if (utxoAssetClasses.length == 0) {
                        return !s.has(ADA.toString())
                    } else {
                        return utxoAssetClasses.every(
                            (ac) => !s.has(ac.toString())
                        )
                    }
                })

                const selectionResult = selectSmallestFirst({
                    allowSelectingUninvolvedAssets: true
                })(filteredUtxos, amount)

                selectedUtxos = selectionResult[0]
                remainingUtxos = selectionResult[1]
            } else {
                throw e
            }
        }

        while (selectedUtxos.length < maxUtxos) {
            const nextRemaining = remainingUtxos.shift()

            if (nextRemaining) {
                selectedUtxos.push(nextRemaining)
            } else {
                break
            }
        }

        return [selectedUtxos, remainingUtxos]
    }
}

/**
 * @param {Value} amount
 * @param {AssetClass[]} otherAssetClasses
 * @returns {Set<string>}
 */
function collectAssetClasses(amount, otherAssetClasses) {
    /**
     * @type {Set<string>}
     */
    const s = new Set()

    otherAssetClasses.forEach((ac) => s.add(ac.toString()))
    amount.assetClasses.forEach((ac) => s.add(ac.toString()))

    return s
}
