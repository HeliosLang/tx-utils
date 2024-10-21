import { Address, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
/**
 * collectUtxos removes tx inputs from the list, and appends txoutputs sent to the address to the end.
 * @typedef {{
 *     id(): TxId
 *     consumes(utxo: TxInput): boolean
 *     collectUtxos(address: Address, utxos: TxInput[]): TxInput[]
 *     getUtxo(id: TxOutputId): Option<TxInput>
 *     newUtxos(): TxInput[]
 *     consumedUtxos(): TxInput[]
 *     dump(): void
 * }} EmulatorTx
 */
