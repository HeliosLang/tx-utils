import { bytesToHex } from "@helios-lang/codec-utils"
import { makeTxInput, makeTxOutput, makeTxOutputId } from "@helios-lang/ledger"

/**
 * @import { TxInput, TxOutputId } from "@helios-lang/ledger"
 * @import { UplcProgramV2 } from "@helios-lang/uplc"
 * @import { ReadonlyCardanoClient, ReadonlyRefScriptRegistry } from "../index.js"
 */

/**
 * @param {ReadonlyCardanoClient} client
 * @param {Record<string, {program: UplcProgramV2, utxoId: TxOutputId | string}> | [UplcProgramV2, TxOutputId | string][]} scripts
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
                        { program: p, inputId: makeTxOutputId(id) }
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
                            inputId: makeTxOutputId(obj.utxoId)
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
     * @type {Record<string, {program: UplcProgramV2, inputId: TxOutputId}>}
     */
    scripts

    /**
     *
     * @param {ReadonlyCardanoClient} network
     * @param {Record<string, {program: UplcProgramV2, inputId: TxOutputId}>} scripts
     */
    constructor(network, scripts) {
        this.client = network
        this.scripts = scripts
    }

    /**
     * @param {number[]} hash
     * @returns {Promise<{program: UplcProgramV2, input: TxInput} | undefined>}
     */
    async find(hash) {
        const h = bytesToHex(hash)

        if (h in this.scripts) {
            const { program, inputId } = this.scripts[h]

            const input = await this.client.getUtxo(inputId)

            // make a copy of the input with the full original program, so we are sure to get all the additional information (source mapping etc.)
            const inputCopy = makeTxInput(
                inputId,
                makeTxOutput(input.address, input.value, input.datum, program)
            )
            return { program, input: inputCopy }
        } else {
            return undefined
        }
    }
}
