import { test } from "node:test"
import assert from "node:assert/strict"
import { Program } from "@helios-lang/compiler"
import { makeTxBuilder } from "../txbuilder/TxBuilder.js"
import {
    makePubKeyHash,
    makeShelleyAddress,
    makeTxInput,
    makeTxOutput,
    makeInlineTxOutputDatum,
    makeValidatorHash,
    makeMintingPolicyHash,
    makeAssetClass,
    makeStakingValidatorHash,
    makeStakingAddress,
    makeTokenValue,
    DEFAULT_NETWORK_PARAMS
} from "@helios-lang/ledger"
import { makeIntData } from "@helios-lang/uplc"
const apiKey = "hdbg_" + "aa".repeat(32)
const wallet = makeShelleyAddress(false, makePubKeyHash("22".repeat(28)))
function compile(purpose) {
    const source = `${purpose} capture_${purpose}\nfunc main(${purpose === "spending" ? "_datum: Int, " : ""}redeemer: Int) -> Bool { assert(redeemer == 0, "capture method failure"); true }`
    const program = new Program(source).compile({
        optimize: true,
        withAlt: true
    })
    Object.defineProperty(program, "$debugger", {
        value: {
            apiKey,
            endpoint: "https://debugger.helios-lang.io",
            sources: { [`capture_${purpose}`]: source }
        }
    })
    return program
}
const mint = compile("minting"),
    stake = compile("staking"),
    spend = compile("spending")
const cast = { toUplcData: makeIntData }
const mph = makeMintingPolicyHash(mint.hash(), {
    program: mint,
    redeemer: cast
})
const asset = makeAssetClass(mph, "01")
const hash = makeStakingValidatorHash(stake.hash(), {
    program: stake,
    redeemer: cast
})
const address = makeStakingAddress(false, hash)
const spendingHash = makeValidatorHash(spend.hash(), {
    program: spend,
    datum: cast,
    redeemer: cast
})
const locked = () =>
    makeTxInput(
        "33".repeat(32) + "#0",
        makeTxOutput(
            makeShelleyAddress(false, spendingHash),
            10000000n,
            makeInlineTxOutputDatum(makeIntData(1))
        )
    )
const pool = makePubKeyHash("44".repeat(28))
const cases = [
    {
        name: "spendWithRedeemer",
        add: (b) => b.spendWithRedeemer(locked(), 1n)
    },
    {
        name: "spendWithRedeemer array",
        add: (b) => b.spendWithRedeemer([locked()], 1n)
    },
    {
        name: "spendWithLazyRedeemer",
        add: (b) => b.spendWithLazyRedeemer(locked(), async () => 1n)
    },
    {
        name: "spendWithLazyRedeemer array",
        add: (b) => b.spendWithLazyRedeemer([locked()], () => 1n)
    },
    {
        name: "spendUnsafe",
        add: (b) =>
            b.attachUplcProgram(spend).spendUnsafe(locked(), makeIntData(1))
    },
    {
        name: "mintTokenValueWithRedeemer",
        add: (b) => b.mintTokenValueWithRedeemer(makeTokenValue(asset, 1n), 1n)
    },
    {
        name: "mintAssetClassWithRedeemer",
        add: (b) => b.mintAssetClassWithRedeemer(asset, 1n, 1n)
    },
    {
        name: "mintAssetClassWithLazyRedeemer",
        add: (b) => b.mintAssetClassWithLazyRedeemer(asset, 1n, async () => 1n)
    },
    {
        name: "mintPolicyTokensWithRedeemer",
        add: (b) => b.mintPolicyTokensWithRedeemer(mph, [["01", 1n]], 1n)
    },
    {
        name: "mintAssetClassUnsafe",
        add: (b) =>
            b
                .attachUplcProgram(mint)
                .mintAssetClassUnsafe(asset, 1n, makeIntData(1))
    },
    {
        name: "mintPolicyTokensUnsafe",
        add: (b) =>
            b
                .attachUplcProgram(mint)
                .mintPolicyTokensUnsafe(mph, [["01", 1n]], makeIntData(1))
    },
    {
        name: "delegateWithRedeemer",
        add: (b) => b.delegateWithRedeemer(hash, pool, 1n)
    },
    {
        name: "delegateUnsafe",
        add: (b) =>
            b
                .attachUplcProgram(stake)
                .delegateUnsafe(hash, pool, makeIntData(1))
    },
    {
        name: "deregisterWithRedeemer",
        add: (b) => b.deregisterWithRedeemer(hash, 1n)
    },
    {
        name: "deregisterUnsafe",
        add: (b) =>
            b.attachUplcProgram(stake).deregisterUnsafe(hash, makeIntData(1))
    },
    {
        name: "withdrawWithRedeemer",
        add: (b) => b.withdrawWithRedeemer(address, 1000000n, 1n)
    },
    {
        name: "withdrawWithLazyRedeemer",
        add: (b) =>
            b.withdrawWithLazyRedeemer(address, 1000000n, async () => 1n)
    },
    {
        name: "withdrawUnsafe",
        add: (b) =>
            b
                .attachUplcProgram(stake)
                .withdrawUnsafe(address, 1000000n, makeIntData(1))
    },
    {
        name: "deferred apply",
        add: (b) =>
            b.apply(async (tx) => {
                await Promise.resolve()
                tx.mintAssetClassWithRedeemer(asset, 1n, 1n)
            })
    }
]
test("every builder script-evaluation entry point automatically captures failures in build and buildUnsafe", async () => {
    const previous = globalThis.fetch
    try {
        for (const scenario of cases)
            for (const unsafe of [false, true]) {
                const captures = []
                globalThis.fetch = async (_url, options) => {
                    captures.push(JSON.parse(String(options?.body)))
                    return Response.json({})
                }
                const builder = scenario.add(
                    makeTxBuilder({ isMainnet: false })
                        .spendWithoutRedeemer(
                            makeTxInput(
                                "11".repeat(32) + "#0",
                                makeTxOutput(wallet, 50000000n)
                            )
                        )
                        .addCollateral(
                            makeTxInput(
                                "22".repeat(32) + "#0",
                                makeTxOutput(wallet, 10000000n)
                            )
                        )
                )
                const config = {
                    changeAddress: wallet,
                    networkParams: DEFAULT_NETWORK_PARAMS()
                }
                if (unsafe)
                    assert.ok(
                        (await builder.buildUnsafe(config)).hasValidationError,
                        scenario.name
                    )
                else await assert.rejects(builder.build(config), scenario.name)
                assert.equal(captures.length, 1, scenario.name)
                assert.ok(
                    captures[0].evaluations.some(
                        (e) => e.phase === "construction"
                    ),
                    scenario.name
                )
                if (unsafe)
                    assert.ok(
                        captures[0].evaluations.some(
                            (e) => e.phase === "validation"
                        ),
                        scenario.name
                    )
            }
    } finally {
        globalThis.fetch = previous
    }
})
