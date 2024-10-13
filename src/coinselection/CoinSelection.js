import { TxInput, Value } from "@helios-lang/ledger"

/**
 * A function that returns two lists.
 * The first list contains the selected UTxOs, the second list contains the remaining UTxOs.
 * @template CSpending
 * @template CStaking
 * @typedef {(utxos: TxInput<CSpending, CStaking>[], amount: Value) => [TxInput<CSpending, CStaking>[], TxInput<CSpending, CStaking>[]]} CoinSelection
 */
