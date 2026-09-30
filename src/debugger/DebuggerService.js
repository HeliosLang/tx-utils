import { validCompilationContext } from "./CompilationContext.js"
import { bytesToHex } from "@helios-lang/codec-utils"
import {
    DEFAULT_COST_MODEL_PARAMS_V1,
    DEFAULT_COST_MODEL_PARAMS_V2,
    DEFAULT_COST_MODEL_PARAMS_V3,
    makeUplcSourceMap
} from "@helios-lang/uplc"

/** @typedef {{phase: string, summary: string, script: import('@helios-lang/uplc').UplcProgram, args: import('@helios-lang/uplc').UplcData[], profile: Pick<import('@helios-lang/uplc').CekResult, 'cost' | 'result'>, allocatedBudget?: import('@helios-lang/uplc').Cost}} Evaluation */
/** @typedef {{record: (event: Evaluation) => void, finish: (tx?: import('@helios-lang/ledger').Tx, error?: unknown) => Promise<void>}} RecordingSession */
/** @typedef {{apiKey: string, sources?: Record<string, string>, endpoint?: string, capture?: 'failures' | 'all', timeoutMs?: number, fetch?: typeof fetch}} DebuggerServiceConfig */

/** Best-effort delivery. A service can be shared by independent builders.
 * @param {DebuggerServiceConfig} config
 */
export function makeDebuggerService(config) {
    const endpoint = new URL(
        config.endpoint ?? "https://debugger.helios-lang.io"
    )
    if (
        endpoint.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(endpoint.hostname)
    )
        throw new Error("Debugger endpoint requires HTTPS")
    const timeoutMs = config.timeoutMs ?? 2000
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
        throw new Error("Invalid delivery timeout")
    const pending = new Set()
    let delivery = { state: "idle", captureId: "", error: "" }
    return {
        get deliveryStatus() {
            return { ...delivery }
        },
        async flush() {
            await Promise.all([...pending])
        },
        /** @param {() => import("@helios-lang/uplc").UplcProgram[]} [getPrograms]
         * @returns {RecordingSession} */
        startSession(getPrograms = () => []) {
            const captureId = crypto.randomUUID()
            const sources = { ...config.sources }
            const evaluations = []
            const diagnostics = []
            let finished = false
            return {
                record(event) {
                    if (
                        config.capture !== "all" &&
                        !("left" in event.profile.result)
                    )
                        return
                    try {
                        const encode = (script) => ({
                            programCbor: bytesToHex(script.toCbor()),
                            sourceMap: makeUplcSourceMap({
                                term: script.root
                            }).toJsonSafe()
                        })
                        let compilation
                        try {
                            const hash = bytesToHex(event.script.hash())
                            const candidates = [event.script, ...getPrograms()]
                                .filter((p) => bytesToHex(p.hash()) === hash)
                                .map((p) => /** @type {any} */ (p).$compilation)
                                .filter((c) => c !== undefined)
                            if (candidates.length) {
                                const encoded = candidates.map((c) =>
                                    JSON.stringify(c)
                                )
                                if (
                                    !candidates.every(
                                        validCompilationContext
                                    ) ||
                                    new Set(encoded).size !== 1
                                )
                                    throw new Error(
                                        "Invalid or ambiguous compilation metadata"
                                    )
                                // Whitelist wire fields; never serialize arbitrary program properties or credentials.
                                const c = candidates[0]
                                compilation = JSON.parse(
                                    JSON.stringify({
                                        version: c.version,
                                        compilerVersion: c.compilerVersion,
                                        validator: c.validator,
                                        parameters: c.parameters,
                                        isTestnet: c.isTestnet,
                                        validatorTypes: c.validatorTypes,
                                        optimized: c.optimized,
                                        unoptimized: c.unoptimized
                                    })
                                )
                            } else
                                diagnostics.push(
                                    `Compilation context unavailable for ${hash}`
                                )
                        } catch (error) {
                            diagnostics.push(String(error))
                        }
                        evaluations.push({
                            compilation,
                            phase: event.phase,
                            summary: event.summary,
                            scriptHash: bytesToHex(event.script.hash()),
                            plutusVersion: event.script.plutusVersion,
                            ...encode(event.script),
                            companion: event.script.alt
                                ? encode(event.script.alt)
                                : undefined,
                            arguments: event.args.map((a) =>
                                bytesToHex(a.toCbor())
                            ),
                            evaluation: {
                                costModel: "explicit",
                                uplcVersion: "0.7.20",
                                costModelParams:
                                    event.script.plutusVersion ===
                                    "PlutusScriptV1"
                                        ? DEFAULT_COST_MODEL_PARAMS_V1()
                                        : event.script.plutusVersion ===
                                            "PlutusScriptV2"
                                          ? DEFAULT_COST_MODEL_PARAMS_V2()
                                          : DEFAULT_COST_MODEL_PARAMS_V3()
                            },
                            allocatedBudget: event.allocatedBudget
                                ? {
                                      cpu: event.allocatedBudget.cpu.toString(),
                                      mem: event.allocatedBudget.mem.toString()
                                  }
                                : undefined,
                            budget: {
                                cpu: event.profile.cost.cpu.toString(),
                                mem: event.profile.cost.mem.toString()
                            },
                            result:
                                "left" in event.profile.result
                                    ? { error: event.profile.result.left.error }
                                    : {
                                          value: event.profile.result.right.toString()
                                      }
                        })
                    } catch (error) {
                        diagnostics.push(String(error))
                    }
                },
                async finish(tx, error) {
                    if (finished) return
                    finished = true
                    if (config.capture !== "all" && evaluations.length === 0)
                        return
                    const failedEvaluation = evaluations.find(
                        (e) => "error" in e.result
                    )
                    const failure =
                        error ??
                        (tx?.hasValidationError || undefined) ??
                        (failedEvaluation
                            ? new Error(failedEvaluation.result.error)
                            : undefined)
                    if (!failure && config.capture !== "all") return
                    let body
                    try {
                        body = JSON.stringify({
                            version: 1,
                            captureId,
                            createdAt: new Date().toISOString(),
                            status: failure ? "failed" : "succeeded",
                            error:
                                failure instanceof Error
                                    ? {
                                          name: failure.name,
                                          message: failure.message,
                                          stack: failure.stack
                                      }
                                    : failure,
                            transactionCbor:
                                config.capture === "all" && tx
                                    ? bytesToHex(tx.toCbor())
                                    : undefined,
                            evaluations,
                            sources: { ...config.sources, ...sources },
                            diagnostics
                        })
                    } catch (error) {
                        delivery = {
                            state: "failed",
                            captureId,
                            error: String(error)
                        }
                        return
                    }
                    const controller = new AbortController()
                    let timer
                    delivery = { state: "pending", captureId, error: "" }
                    const task = (async () => {
                        try {
                            const timeout = new Promise((_, reject) => {
                                timer = setTimeout(() => {
                                    controller.abort()
                                    reject(
                                        new Error("Capture delivery timed out")
                                    )
                                }, timeoutMs)
                            })
                            const response = await Promise.race([
                                (config.fetch ?? fetch)(
                                    new URL("/v1/captures", endpoint),
                                    {
                                        method: "POST",
                                        headers: {
                                            Authorization: `Bearer ${config.apiKey}`,
                                            "Content-Type": "application/json"
                                        },
                                        credentials: "omit",
                                        body,
                                        signal: controller.signal,
                                        redirect: "error"
                                    }
                                ),
                                timeout
                            ])
                            if (!response.ok)
                                throw new Error(
                                    `Capture delivery HTTP ${response.status}`
                                )
                            delivery = {
                                state: "delivered",
                                captureId,
                                error: ""
                            }
                        } catch (error) {
                            delivery = {
                                state: "failed",
                                captureId,
                                error: String(error)
                            }
                        } finally {
                            clearTimeout(timer)
                        }
                    })()
                    pending.add(task)
                    await task
                    pending.delete(task)
                }
            }
        }
    }
}
