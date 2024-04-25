import { TxInput, Value } from "@helios-lang/ledger"

/**
 * A function that returns two lists.
 * The first list contains the selected UTxOs, the second list contains the remaining UTxOs.
 * @template CSpending
 * @typedef {(utxos: TxInput<CSpending, unknown>[], amount: Value) => [TxInput<CSpending, unknown>[], TxInput<CSpending, unknown>[]]} CoinSelection
 */
