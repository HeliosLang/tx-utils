import { TxInput } from "@helios-lang/ledger"

/**
 * @typedef {import("@helios-lang/uplc").UplcProgramV2I} UplcProgramV2
 */

/**
 * @typedef {{
 *   register(program: UplcProgramV2): Promise<void>
 *   find(hash: number[]): Promise<Option<{input: TxInput, program: UplcProgramV2}>>
 * }} RefScriptRegistry
 */
