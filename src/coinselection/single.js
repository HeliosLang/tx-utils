import { Value } from "@helios-lang/ledger"

/**
 * @typedef {import("./CoinSelection.js").CoinSelection} CoinSelection
 */

/**
 * @type {CoinSelection}
 */
export const selectSingle = (utxos, value) => {
    for (let i = 0; i < utxos.length; i++) {
        const utxo = utxos[i]

        if (utxo.value.isGreaterOrEqual(value)) {
            return [[utxo], utxos.slice(0, i).concat(utxos.slice(i + 1))]
        }
    }

    throw new Error(`no UTxO found containing ${value.dump()}`)
}
