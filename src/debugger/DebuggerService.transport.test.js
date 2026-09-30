import { test } from "node:test"
import assert from "node:assert/strict"
import { bytesToHex } from "@helios-lang/codec-utils"
import { makeUplcProgramV2, makeUplcError } from "@helios-lang/uplc"
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
    const payload = JSON.parse(options.body)
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
    await service.startSession().finish(undefined, new Error("original"))
    await service.flush()
    assert.equal(requests, 1)
    assert.equal(service.deliveryStatus.state, "failed")
    assert.match(service.deliveryStatus.error, /HTTP 503/)
})
