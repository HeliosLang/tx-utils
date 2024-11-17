import { bytesToHex } from "@helios-lang/codec-utils"
import { TxInput, TxOutput, TxOutputId } from "@helios-lang/ledger"

/**
 * @import { UplcProgramV2I } from "@helios-lang/uplc"
 * @import { ReadonlyCardanoClient, ReadonlyRefScriptRegistry } from "src/index.js"
 */

/**
 * @param {ReadonlyCardanoClient} client
 * @param {Record<string, {program: UplcProgramV2I, utxoId: TxOutputId | string}> | [UplcProgramV2I, TxOutputId | string][]} scripts
 * @returns {ReadonlyRefScriptRegistry}
 */
export function makeCachedRefScriptRegistry(client, scripts) {
    if (Array.isArray(scripts)) {
        return new CachedRefScriptRegistry(
            client,
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
            client,
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
     * @type {ReadonlyCardanoClient}
     */
    client

    /**
     * @private
     * @type {Record<string, {program: UplcProgramV2I, inputId: TxOutputId}>}
     */
    scripts

    /**
     *
     * @param {ReadonlyCardanoClient} network
     * @param {Record<string, {program: UplcProgramV2I, inputId: TxOutputId}>} scripts
     */
    constructor(network, scripts) {
        this.client = network
        this.scripts = scripts
    }

    /**
     * @param {number[]} hash
     * @returns {Promise<{program: UplcProgramV2I, input: TxInput} | undefined>}
     */
    async find(hash) {
        const h = bytesToHex(hash)

        if (h in this.scripts) {
            const { program, inputId } = this.scripts[h]

            const input = await this.client.getUtxo(inputId)

            // make a copy of the input with the full original program, so we are sure to get all the additional information (source mapping etc.)
            const inputCopy = new TxInput(
                inputId,
                new TxOutput(input.address, input.value, input.datum, program)
            )
            return { program, input: inputCopy }
        } else {
            return undefined
        }
    }
}
