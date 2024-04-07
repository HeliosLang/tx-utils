import { TxInput, Value } from "@helios-lang/ledger"

/**
 * A function that returns two lists.
 * The first list contains the selected UTxOs, the second list contains the remaining UTxOs.
 * @typedef {(utxos: TxInput[], amount: Value) => [TxInput[], TxInput[]]} CoinSelection
 */
