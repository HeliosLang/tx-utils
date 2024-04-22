import { Address, Tx, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"

/**
 * @typedef {import("@helios-lang/ledger").NetworkParams} NetworkParams
 */

/**
 * @typedef {"preview" | "preprod" | "mainnet"} NetworkName
 */

/**
 *   - isMainnet: returns true for mainnet
 *   - getUtxos: returns a complete list of UTxOs at a given address.
 *   - getUtxo: returns a single TxInput (that might already have been spent).
 *   - now: returns the number of ms since some reference (for mainnet -> since 1970, for emulator -> arbitrary reference)
 *   - parameters: returns the latest network parameters.
 * @typedef {{
 *   now: number
 *   parameters: Promise<NetworkParams>
 *   getUtxo(id: TxOutputId): Promise<TxInput>
 *   getUtxos(address: Address): Promise<TxInput[]>
 *   isMainnet(): boolean
 * }} ReadonlyNetwork
 */

/**
 * Blockchain query layer interface.
 *   - isMainnet: returns true for mainnet
 *   - getUtxos: returns a complete list of UTxOs at a given address.
 *   - getUtxo: returns a single TxInput (that might already have been spent).
 *   - now: returns the number of ms since some reference (for mainnet -> since 1970, for emulator -> arbitrary reference)
 *   - parameters: returns the latest network parameters.
 *   - submitTx: submits a transaction to the blockchain and returns the id of that transaction upon success.
 * @typedef {ReadonlyNetwork & {
 *   submitTx(tx: Tx): Promise<TxId>
 * }} Network
 */
