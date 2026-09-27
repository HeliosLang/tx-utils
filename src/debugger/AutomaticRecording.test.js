import { test } from "node:test"
import assert from "node:assert/strict"
import { Program } from "@helios-lang/compiler"
import {
    makePubKeyHash,
    makeShelleyAddress,
    makeValidatorHash,
    makeTxInput,
    makeTxOutput,
    makeInlineTxOutputDatum,
    DEFAULT_NETWORK_PARAMS
} from "@helios-lang/ledger"
import { makeIntData } from "@helios-lang/uplc"
import { makeTxBuilder } from "../txbuilder/TxBuilder.js"
import { makeDebuggerService } from "./DebuggerService.js"

const source =
    'spending auto_debug\nfunc main(datum: Int, redeemer: Int) -> Bool { assert(datum == redeemer, "automatic project failure"); true }'
const wallet = makeShelleyAddress(false, makePubKeyHash("22".repeat(28)))
const keyA = "hdbg_" + "aa".repeat(32),
    keyB = "hdbg_" + "bb".repeat(32)
function program(key = keyA, filename = "auto_debug") {
    const result = new Program(source).compile({
        optimize: true,
        withAlt: true
    })
    if (key)
        Object.defineProperty(result, "$debugger", {
            value: {
                apiKey: key,
                endpoint: "https://debugger.helios-lang.io",
                sources: { [filename]: source }
            }
        })
    return result
}
function builder(script, config = {}, reference = false, success = false) {
    const b = makeTxBuilder({ isMainnet: false, ...config }).attachUplcProgram(
        script
    )
    if (reference)
        b.refer(
            makeTxInput(
                "33".repeat(32) + "#0",
                makeTxOutput(wallet, 5000000n, undefined, script)
            )
        )
    return b
        .spendUnsafe(
            makeTxInput(
                "11".repeat(32) + "#0",
                makeTxOutput(
                    makeShelleyAddress(false, makeValidatorHash(script.hash())),
                    20000000n,
                    makeInlineTxOutputDatum(makeIntData(1))
                )
            ),
            makeIntData(success ? 1 : 2)
        )
        .addCollateral(
            makeTxInput("22".repeat(32) + "#0", makeTxOutput(wallet, 10000000n))
        )
}
const buildOptions = () => ({
    changeAddress: wallet,
    networkParams: DEFAULT_NETWORK_PARAMS()
})
test("automatic capture, reference scripts, buildUnsafe, disabled capture and explicit override", async () => {
    const previous = globalThis.fetch,
        captures = []
    globalThis.fetch = async (_url, options) => {
        captures.push({
            headers: options?.headers,
            body: JSON.parse(String(options?.body))
        })
        return new Response("{}")
    }
    try {
        await assert.rejects(builder(program()).build(buildOptions()))
        assert.equal(captures.length, 1)
        assert.equal(captures[0].headers.Authorization, `Bearer ${keyA}`)
        assert.ok(captures[0].body.evaluations.length)
        assert.ok(!JSON.stringify(captures[0].body).includes(keyA))
        const unsafe = await builder(program(), {}, true).buildUnsafe(
            buildOptions()
        )
        assert.ok(unsafe.hasValidationError)
        assert.ok(
            captures[1].body.evaluations.some(
                (event) => event.phase === "validation"
            )
        )
        await assert.rejects(
            builder(program(), { debugger: false }).build(buildOptions())
        )
        const unannotated = new Program(source).compile({
            optimize: true,
            withAlt: true
        })
        const before = captures.length
        await assert.rejects(builder(unannotated).build(buildOptions()))
        assert.equal(captures.length, before)
        const manual = makeDebuggerService({ apiKey: keyB })
        await assert.rejects(
            builder(program(), { debugger: manual }).build(buildOptions())
        )
        assert.equal(captures.at(-1).headers.Authorization, `Bearer ${keyB}`)
        const successes = captures.length
        await builder(program(), {}, false, true).build(buildOptions())
        assert.equal(captures.length, successes)
        globalThis.fetch = async () => {
            throw new Error("service unavailable")
        }
        await assert.rejects(
            builder(program()).build(buildOptions()),
            (error) =>
                error instanceof Error &&
                !error.message.includes("service unavailable")
        )
    } finally {
        globalThis.fetch = previous
    }
})
test("mixed-project builds and concurrent builds keep project feeds separate", async () => {
    const previous = globalThis.fetch,
        captures = []
    globalThis.fetch = async (_url, options) => {
        captures.push({
            headers: options?.headers,
            body: JSON.parse(String(options?.body))
        })
        return new Response("{}")
    }
    try {
        const a = program(keyA, "first"),
            b = program(keyB, "second")
        const mixed = builder(a).attachUplcProgram(b)
        await assert.rejects(mixed.build(buildOptions()))
        assert.equal(captures.length, 2)
        assert.deepEqual(
            captures.map((c) => c.headers.Authorization).sort(),
            [`Bearer ${keyA}`, `Bearer ${keyB}`].sort()
        )
        assert.deepEqual(
            captures.find((c) => c.headers.Authorization === `Bearer ${keyA}`)
                .body.sources,
            { first: source }
        )
        assert.deepEqual(
            captures.find((c) => c.headers.Authorization === `Bearer ${keyB}`)
                .body.sources,
            { second: source }
        )
        await Promise.all([
            assert.rejects(builder(a).build(buildOptions())),
            assert.rejects(builder(b).build(buildOptions()))
        ])
        assert.equal(captures.length, 4)
        assert.equal(new Set(captures.map((c) => c.body.captureId)).size, 4)
    } finally {
        globalThis.fetch = previous
    }
})
