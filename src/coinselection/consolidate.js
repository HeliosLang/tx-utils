import { AssetClass, TxInput, Value } from "@helios-lang/ledger"
import { selectSmallestFirst } from "./extremumFirst.js"

/**
 * @typedef {import("./CoinSelection.js").CoinSelection} CoinSelection
 */

/**
 * First select the smallest utxos that contain only the given assets(ignoring lovelace if it isn't in the assetClasses list)
 *   - simple use the selectSmallestFirst algorithm for this, ignoring utxos that contain assetsclasses that aren't included in the given list or the `amount` value
 * Keep adding utxo for the left-over list (without additional sorting) until maxUtxos is reached
 *
 * All UTxOs contain some lovelace, so require special treatment:
 *   - pure lovelace UTxOs are treated as containing the lovelace assetClass
 *   - UTxOs that contain lovelace in addition to other assetClasses are treated as containing those other assetClasses (but not lovelace)
 * @param {AssetClass[]} assetClasses
 * @param {number} maxUtxos
 * @returns {CoinSelection}
 */
export function consolidate(assetClasses, maxUtxos = 5) {
    return (utxos, amount) => {
        const s = collectAssetClasses(amount, assetClasses)

        const filteredUtxos = utxos.filter((utxo) => {
            const utxoAssetClasses = utxo.value.assets.assetClasses

            // ignore pure lovelace utxos if lovelace isn't included assetClasses
            if (utxoAssetClasses.length == 0) {
                return s.has(AssetClass.ADA.toString())
            } else {
                return utxoAssetClasses.every((ac) => s.has(ac.toString()))
            }
        })

        const [selectedUtxos, remainingUtxos] = selectSmallestFirst(
            filteredUtxos,
            amount
        )

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
