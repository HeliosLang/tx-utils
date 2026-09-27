import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
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
import {
    makeListData,
    makeIntData,
    makeByteArrayData,
    makeConstrData,
    decodeUplcData,
    makeUplcDataValue,
    decodeUplcProgramV2FromCbor
} from "@helios-lang/uplc"
import { makeDebuggerService, makeTxBuilder } from "../../src/index.js"
const name = fileURLToPath(new URL("./time_lock.hl", import.meta.url)),
    source = await readFile(name, "utf8")
const program = new Program(source).compile(true, { withAlt: true })
const wallet = makeShelleyAddress(false, makePubKeyHash("22".repeat(28)))
const lockedAddress = makeShelleyAddress(
    false,
    makeValidatorHash(program.hash())
)
const params = DEFAULT_NETWORK_PARAMS()
const datum = makeListData([
    makeIntData(Date.now() + 86400000),
    makeByteArrayData("11".repeat(28)),
    makeByteArrayData("22".repeat(28))
])
const captures = []
const service = makeDebuggerService({
    apiKey: "test",
    sources: { [name]: source, time_lock: source },
    fetch: async (_url, options) => {
        captures.push(JSON.parse(options.body))
        return new Response("{}")
    }
})
const makeBuilder = () =>
    makeTxBuilder({ isMainnet: false, debugger: service })
        .attachUplcProgram(program)
        .spendUnsafe(
            makeTxInput(
                "11".repeat(32) + "#0",
                makeTxOutput(
                    lockedAddress,
                    20000000n,
                    makeInlineTxOutputDatum(datum)
                )
            ),
            makeConstrData(1, [])
        )
        .addCollateral(
            makeTxInput("22".repeat(32) + "#0", makeTxOutput(wallet, 10000000n))
        )
        .addSigners(makePubKeyHash("22".repeat(28)))
        .validFromTime(Date.now())
await assert.rejects(
    makeBuilder().build({ changeAddress: wallet, networkParams: params }),
    /time lock not yet expired|script failed|evaluation/i
)
assert.equal(captures.length, 1)
const capture = captures[0],
    evaluation = capture.evaluations[0]
assert.ok("error" in evaluation.result)
assert.ok(evaluation.companion)
const args = evaluation.arguments.map((a) =>
    makeUplcDataValue(decodeUplcData(a))
)
const production = decodeUplcProgramV2FromCbor(evaluation.programCbor, {
    sourceMap: evaluation.sourceMap
}).eval(args, { costModelParams: evaluation.evaluation.costModelParams })
assert.ok("left" in production.result)
assert.equal(production.result.left.error, evaluation.result.error)
assert.equal(production.cost.cpu.toString(), evaluation.budget.cpu)
const companion = decodeUplcProgramV2FromCbor(
    evaluation.companion.programCbor,
    { sourceMap: evaluation.companion.sourceMap }
).eval(args)
assert.ok("left" in companion.result)
assert.match(companion.result.left.error, /time lock not yet expired/)
const unsafe = await makeBuilder().buildUnsafe({
    changeAddress: wallet,
    networkParams: params
})
assert.ok(unsafe.hasValidationError)
assert.ok(captures[1].evaluations.some((e) => e.phase === "validation"))
if (process.env.CAPTURE_OUTPUT)
    await writeFile(
        process.env.CAPTURE_OUTPUT,
        JSON.stringify(capture, null, 2)
    )
console.log(
    "PASS: compiler 0.17.33 time_lock early-unlock → builder capture → exact production CBOR, result and CPU replay; separate companion diagnostic"
)
