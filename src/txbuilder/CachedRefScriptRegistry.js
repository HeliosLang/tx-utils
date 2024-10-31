import { bytesToHex } from "@helios-lang/codec-utils"
import { TxInput, TxOutput, TxOutputId } from "@helios-lang/ledger"
import { None } from "@helios-lang/type-utils"

/**
 * @typedef {import("@helios-lang/uplc").UplcProgramV2I} UplcProgramV2I
 * @typedef {import("../network/index.js").ReadonlyNetwork} ReadonlyNetwork
 * @typedef {import("./RefScriptRegistry.js").ReadonlyRefScriptRegistry} ReadonlyRefScriptRegistry
 */

/**
 * @param {ReadonlyNetwork} network
 * @param {Record<string, {program: UplcProgramV2I, utxoId: TxOutputId | string}> | [UplcProgramV2I, TxOutputId | string][]} scripts
 * @returns {ReadonlyRefScriptRegistry}
 */
export function makeCachedRefScriptRegistry(network, scripts) {
    if (Array.isArray(scripts)) {
        return new CachedRefScriptRegistry(
            network,
            Object.fromEntries(
                scripts.map(([p, id]) => {
                    return [
                        bytesToHex(p.hash()),
                        { program: p, inputId: TxOutputId.new(id) }
                    ]
                })
            )
        )
    } else {
        return new CachedRefScriptRegistry(
            network,
            Object.fromEntries(
                Object.entries(scripts).map(([h, obj]) => {
                    return [
                        h,
                        {
                            program: obj.program,
                            inputId: TxOutputId.new(obj.utxoId)
                        }
                    ]
                })
            )
        )
    }
}

/**
 * @implements {ReadonlyRefScriptRegistry}
 */
class CachedRefScriptRegistry {
    /**
     * @private
     * @type {ReadonlyNetwork}
     */
    network

    /**
     * @private
     * @type {Record<string, {program: UplcProgramV2I, inputId: TxOutputId}>}
     */
    scripts

    /**
     *
     * @param {ReadonlyNetwork} network
     * @param {Record<string, {program: UplcProgramV2I, inputId: TxOutputId}>} scripts
     */
    constructor(network, scripts) {
        this.network = network
        this.scripts = scripts
    }

    /**
     * @param {number[]} hash
     * @returns {Promise<Option<{program: UplcProgramV2I, input: TxInput}>>}
     */
    async find(hash) {
        const h = bytesToHex(hash)

        if (h in this.scripts) {
            const { program, inputId } = this.scripts[h]

            const input = await this.network.getUtxo(inputId)

            // make a copy of the input with the full original program, so we are sure to get all the additional information (source mapping etc.)
            const inputCopy = new TxInput(
                inputId,
                new TxOutput(input.address, input.value, input.datum, program)
            )
            return { program, input: inputCopy }
        } else {
            return None
        }
    }
}
