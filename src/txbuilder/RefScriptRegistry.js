import { TxInput, TxOutputId } from "@helios-lang/ledger"

/**
 * @typedef {import("@helios-lang/uplc").UplcProgramV2I} UplcProgramV2
 */

/**
 * @typedef {{
 *   find(hash: number[]): Promise<Option<{input: TxInput, program: UplcProgramV2}>>
 * }} ReadonlyRefScriptRegistry
 */

/**
 * @typedef {ReadonlyRefScriptRegistry & {
 *   register(program: UplcProgramV2): Promise<TxOutputId>
 * }} RefScriptRegistry
 */
