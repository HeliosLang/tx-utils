import { test } from "node:test"
import assert from "node:assert/strict"
import { makeDebuggerService } from "./DebuggerService.js"
import { makeTxBuilder } from "../txbuilder/TxBuilder.js"
import {
    makeTxInput,
    makeTxOutput,
    makeShelleyAddress,
    makeValidatorHash,
    makeInlineTxOutputDatum
} from "@helios-lang/ledger"
import {
    makeUplcProgramV2,
    makeUplcLambda,
    makeUplcError,
    makeIntData,
    makeUplcDataValue,
    decodeUplcProgramV2FromCbor,
    decodeUplcData
} from "@helios-lang/uplc"
import { bytesToHex } from "@helios-lang/codec-utils"
const wallet = "addr_test1vzzcg26lxj3twnnx889lrn60pqn0z3km2yahhsz0fvpyxdcj5qp8w"
const input = () =>
    makeTxInput(
        "d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e83#0",
        makeTxOutput(wallet, 100000000n)
    )
const failing = makeUplcProgramV2(
    makeUplcLambda({
        body: makeUplcLambda({
            body: makeUplcLambda({ body: makeUplcError() })
        })
    })
)
/** @param {'all' | 'failures'} [capture] */
function service(capture = "failures") {
    const captures = []
    const debuggerService = makeDebuggerService({
        apiKey: "test",
        capture,
        fetch: async (_url, options) => {
            captures.push(JSON.parse(String(options?.body)))
            return new Response("{}")
        }
    })
    return { captures, debuggerService }
}
function failingBuilder(debuggerService, reference = false) {
    const address = makeShelleyAddress(false, makeValidatorHash(failing.hash()))
    const locked = makeTxInput(
        "11".repeat(32) + "#0",
        makeTxOutput(
            address,
            20000000n,
            makeInlineTxOutputDatum(makeIntData(0))
        )
    )
    const builder = makeTxBuilder({
        isMainnet: false,
        debugger: debuggerService
    })
    if (reference)
        builder.refer(
            makeTxInput(
                "33".repeat(32) + "#0",
                makeTxOutput(wallet, 20000000n, undefined, failing)
            )
        )
    else builder.attachUplcProgram(failing)
    return builder.spendUnsafe(locked, makeIntData(0)).addCollateral(input())
}
test("disabled/all/default capture preserve transaction bytes and isolate concurrent builds", async () => {
    const { captures, debuggerService } = service("all")
    const build = (debuggerService) =>
        makeTxBuilder({ isMainnet: false, debugger: debuggerService })
            .spendUnsafe(input())
            .build({ changeAddress: wallet })
    const original = await build(undefined)
    const txs = await Promise.all([
        build(debuggerService),
        build(debuggerService)
    ])
    assert.equal(captures.length, 2)
    assert.notEqual(captures[0].captureId, captures[1].captureId)
    for (const tx of txs)
        assert.equal(bytesToHex(tx.toCbor()), bytesToHex(original.toCbor()))
    const defaults = service()
    await build(defaults.debuggerService)
    assert.equal(defaults.captures.length, 0)
})
test("construction failures preserve original errors; buildUnsafe records validation and exact CBOR", async () => {
    const { captures, debuggerService } = service()
    await assert.rejects(
        failingBuilder(debuggerService).build({ changeAddress: wallet })
    )
    assert.equal(captures.length, 1)
    assert.equal(captures[0].evaluations[0].phase, "construction")
    const unsafe = await failingBuilder(debuggerService).buildUnsafe({
        changeAddress: wallet
    })
    assert.ok(unsafe.hasValidationError)
    const capture = captures[1]
    assert.equal(capture.transactionCbor, undefined)
    assert.ok(capture.evaluations.some((e) => e.phase === "validation"))
    for (const e of capture.evaluations) {
        const p = decodeUplcProgramV2FromCbor(e.programCbor, {
            sourceMap: e.sourceMap
        })
        assert.equal(bytesToHex(p.toCbor()), e.programCbor)
        assert.ok(
            "left" in
                p.eval(
                    e.arguments.map((a) => makeUplcDataValue(decodeUplcData(a)))
                ).result
        )
    }
})
test("unavailable service and ignored abort signal remain bounded, flush exposes failure", async () => {
    const debuggerService = makeDebuggerService({
        apiKey: "test",
        timeoutMs: 20,
        fetch: () => new Promise(() => {})
    })
    const error = new Error("original failure"),
        session = debuggerService.startSession()
    session.record({
        phase: "construction",
        summary: "failed",
        script: failing,
        args: [],
        profile: {
            cost: { cpu: 0n, mem: 0n },
            result: { left: { error: "failed", callSites: [] } }
        }
    })
    const start = Date.now()
    await session.finish(undefined, error)
    await debuggerService.flush()
    assert.ok(Date.now() - start < 1000)
    assert.equal(debuggerService.deliveryStatus.state, "failed")
})

test("reference script failures capture the resolved program", async () => {
    const { captures, debuggerService } = service()
    await assert.rejects(
        failingBuilder(debuggerService, true).build({ changeAddress: wallet })
    )
    assert.equal(
        captures[0].evaluations[0].programCbor,
        bytesToHex(failing.toCbor())
    )
})

test("non-script build failures are not uploaded and preserve the original exception", async () => {
    const debuggerService = makeDebuggerService({
        apiKey: "test",
        fetch: async () => {
            throw new Error("offline")
        }
    })
    const original = new Error("beforeValidate failed")
    await assert.rejects(
        makeTxBuilder({ isMainnet: false, debugger: debuggerService })
            .spendUnsafe(input())
            .build({
                changeAddress: wallet,
                beforeValidate: () => {
                    throw original
                }
            }),
        (error) => error === original
    )
    assert.equal(debuggerService.deliveryStatus.state, "idle")
})
