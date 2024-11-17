import { TxInput, Value } from "@helios-lang/ledger"

/**
 * @import { CoinSelection } from "src/index.js"
 */

/**
 * @template CSpending
 * @template CStaking
 * @param {TxInput<CSpending, CStaking>[]} utxos
 * @param {Value} value
 * @returns {[TxInput<CSpending, CStaking>[], TxInput<CSpending, CStaking>[]]}
 */
export function selectSingle(utxos, value) {
    for (let i = 0; i < utxos.length; i++) {
        const utxo = utxos[i]

        if (utxo.value.isGreaterOrEqual(value)) {
            return [[utxo], utxos.slice(0, i).concat(utxos.slice(i + 1))]
        }
    }

    throw new Error(
        `no UTxO found containing ${JSON.stringify(value.dump(), undefined, 2)} in utxos ${JSON.stringify(
            utxos.map((utxo) => utxo.dump()),
            undefined,
            4
        )}`
    )
}
