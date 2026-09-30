import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { makeDebuggerService } from "./DebuggerService.js"
import { validCompilationContext } from "./CompilationContext.js"
import {
    makeUplcProgramV2,
    makeUplcError,
    decodeUplcProgramV2FromCbor
} from "@helios-lang/uplc"
const compilation = JSON.parse(
    readFileSync(
        new URL("../../test/debugger/compilation.json", import.meta.url),
        "utf8"
    )
)
test("compilation capture survives reconstructed scripts and invalid metadata never drops the evaluation", async () => {
    const script = makeUplcProgramV2(makeUplcError())
    Object.defineProperty(script, "$compilation", {
        value: compilation,
        configurable: true
    })
    const evaluated = decodeUplcProgramV2FromCbor(script.toCbor())
    const captures = []
    const service = makeDebuggerService({
        apiKey: "secret",
        fetch: async (_, options) => {
            captures.push(JSON.parse(String(options?.body)))
            return new Response("{}")
        }
    })
    const event = {
        phase: "validation",
        summary: "oracle",
        script: evaluated,
        args: [],
        profile: {
            cost: { cpu: 1n, mem: 1n },
            result: { left: { error: "not enough signatures", callSites: [] } }
        }
    }
    const session = service.startSession(() => [script])
    session.record(event)
    await session.finish(undefined, new Error("failed"))
    assert.deepEqual(captures[0].evaluations[0].compilation, compilation)
    assert(!JSON.stringify(captures[0]).includes("secret"))
    Object.defineProperty(script, "$compilation", {
        value: { ...compilation, parameters: { bad: "00" } }
    })
    const invalid = service.startSession(() => [script])
    invalid.record(event)
    await invalid.finish(undefined, new Error("failed"))
    assert.equal(captures[1].evaluations.length, 1)
    assert.equal(captures[1].evaluations[0].compilation, undefined)
    assert.match(captures[1].diagnostics.join(), /Invalid/)
})
test("metadata distinguishes empty overrides and rejects malformed fields", () => {
    assert(validCompilationContext(compilation))
    assert(validCompilationContext({ ...compilation, parameters: {} }))
    for (const change of [
        { parameters: undefined },
        { version: 2 },
        { isTestnet: "false" },
        { parameters: { "oracle_delegate::ORACLE_KEYS": "zz" } },
        { apiKey: "secret" }
    ])
        assert(!validCompilationContext({ ...compilation, ...change }))
})
