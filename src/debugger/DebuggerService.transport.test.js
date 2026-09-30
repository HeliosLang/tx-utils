import { test } from "node:test"
import assert from "node:assert/strict"
import { bytesToHex } from "@helios-lang/codec-utils"
import {
    makeUplcProgramV2,
    makeUplcError,
    makeUplcConst,
    makeUplcDelay,
    makeUplcInt
} from "@helios-lang/uplc"
import { makeDebuggerService } from "./DebuggerService.js"

test("capture transport is one fetch with a JSON payload and bearer header", async () => {
    const requests = []
    const service = makeDebuggerService({
        apiKey: "transport-test-secret",
        endpoint: "https://debugger.example.com",
        sources: { "test.hl": "testing test" },
        fetch: async (url, options) => {
            requests.push({ url: String(url), options })
            return new Response(null, { status: 201 })
        }
    })
    const session = service.startSession()
    const script = makeUplcProgramV2(makeUplcError())
    session.record({
        phase: "construction",
        summary: "test script",
        script,
        args: [],
        profile: script.eval([])
    })
    await session.finish(undefined, new Error("script failed"))
    await session.finish(undefined, new Error("duplicate finish"))
    await service.flush()

    assert.equal(requests.length, 1)
    const { url, options } = requests[0]
    assert.equal(url, "https://debugger.example.com/v1/captures")
    assert.equal(options.method, "POST")
    assert.deepEqual(options.headers, {
        Authorization: "Bearer transport-test-secret",
        "Content-Type": "application/json"
    })
    assert.equal(options.credentials, "omit")
    assert.equal(options.redirect, "error")
    assert.ok(options.signal instanceof AbortSignal)
    assert.ok(!options.body.includes("transport-test-secret"))
    const payload = JSON.parse(String(options?.body))
    assert.equal(payload.version, 1)
    assert.equal(payload.status, "failed")
    assert.equal(payload.error.message, "script failed")
    assert.equal(payload.evaluations.length, 1)
    assert.equal(
        payload.evaluations[0].programCbor,
        bytesToHex(script.toCbor())
    )
    assert.deepEqual(payload.evaluations[0].arguments, [])
    assert.deepEqual(payload.sources, { "test.hl": "testing test" })
    assert.match(payload.diagnostics.join(), /Compilation context unavailable/)
    assert.equal(service.deliveryStatus.state, "delivered")
    assert.equal(service.deliveryStatus.captureId, payload.captureId)
})

test("HTTP failure is reported without retries or throwing into the builder", async () => {
    let requests = 0
    const service = makeDebuggerService({
        apiKey: "test",
        fetch: async () => {
            requests++
            return new Response(null, { status: 503 })
        }
    })
    const session = service.startSession()
    const script = makeUplcProgramV2(makeUplcError())
    session.record({
        phase: "construction",
        summary: "failed",
        script,
        args: [],
        profile: script.eval([])
    })
    await session.finish(undefined, new Error("original"))
    await service.flush()
    assert.equal(requests, 1)
    assert.equal(service.deliveryStatus.state, "failed")
    assert.match(service.deliveryStatus.error, /HTTP 503/)
})

test("failure-only capture excludes successful executions and transaction CBOR", async () => {
    const captures = []
    const service = makeDebuggerService({
        apiKey: "test",
        fetch: async (_url, options) => {
            captures.push(JSON.parse(String(options?.body)))
            return new Response(null, { status: 201 })
        }
    })
    const good = makeUplcProgramV2(
        makeUplcDelay({ arg: makeUplcConst({ value: makeUplcInt(1) }) })
    )
    assert("right" in good.eval([]).result)
    const bad = makeUplcProgramV2(makeUplcError())
    const record = (session, script, summary) =>
        session.record({
            phase: "validation",
            summary,
            script,
            args: [],
            profile: script.eval([])
        })
    const mixed = service.startSession()
    record(mixed, good, "successful assets")
    record(mixed, bad, "failed oracle")
    record(mixed, good, "successful portfolio")
    await mixed.finish(
        /** @type {any} */ ({
            toCbor() {
                throw new Error("must not serialize whole transaction")
            }
        }),
        new Error("tx failed")
    )
    assert.equal(captures.length, 1)
    assert.deepEqual(
        captures[0].evaluations.map((e) => e.summary),
        ["failed oracle"]
    )
    assert.equal(captures[0].transactionCbor, undefined)
    const before = service.startSession()
    await before.finish(undefined, new Error("coin selection failed"))
    const after = service.startSession()
    record(after, good, "valid script")
    await after.finish(undefined, new Error("non-script build error"))
    assert.equal(captures.length, 1)
    const manual = service.startSession()
    record(manual, bad, "failed without outer exception")
    await manual.finish()
    assert.equal(captures.length, 2)
    assert.equal(captures[1].status, "failed")
})
