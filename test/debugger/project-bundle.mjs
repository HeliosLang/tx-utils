// node test/debugger/project-bundle.mjs /path/to/contract-utils
import assert from "node:assert/strict"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { makeTxBuilder } from "../../src/index.js"
import {
    makePubKeyHash,
    makeShelleyAddress,
    makeTxInput,
    makeTxOutput,
    makeInlineTxOutputDatum,
    DEFAULT_NETWORK_PARAMS
} from "@helios-lang/ledger"
import { makeIntData } from "@helios-lang/uplc"
const contractRoot = resolve(process.argv[2])
const { compile } = await import(
    pathToFileURL(join(contractRoot, "src/cli/compile.js"))
)
const { installProjects } = await import(
    pathToFileURL(join(contractRoot, "src/cli/config.mjs"))
)
const { makeContractContextBuilder } = await import(
    pathToFileURL(join(contractRoot, "src/index.js"))
)
const directory = await mkdtemp(join(contractRoot, ".project-test-"))
const previousFetch = globalThis.fetch,
    previousCwd = process.cwd(),
    previousConfig = process.env.HELIOS_CONFIG_HOME
const project = {
    id: "12345678-1234-1234-1234-123456789012",
    name: "App",
    created_at: 0,
    apiKey: "hdbg_" + "aa".repeat(32)
}
const captures = []
try {
    process.env.HELIOS_CONFIG_HOME = join(directory, "config")
    await installProjects(
        "11".repeat(28),
        [project],
        "https://debugger.helios-lang.io"
    )
    const source =
        'spending auto_bundle\nfunc main(datum: Int, redeemer: Int) -> Bool { assert(datum == redeemer, "bundle project failure"); true }'
    await writeFile(join(directory, "main.hl"), source)
    globalThis.fetch = async (url, options) => {
        assert.equal(options.headers.Authorization, `Bearer ${project.apiKey}`)
        if (String(url).endsWith("/v1/project"))
            return Response.json({
                id: project.id,
                name: project.name,
                created_at: 0
            })
        assert.equal(String(url), "https://debugger.helios-lang.io/v1/captures")
        captures.push(JSON.parse(options.body))
        return Response.json({})
    }
    process.chdir(directory)
    await compile([
        "--project",
        "App",
        "--format",
        "javascript",
        "--out-dir",
        join(directory, "generated")
    ])
    const bundle = await import(
        pathToFileURL(join(directory, "generated", "index.js"))
    )
    assert.equal(bundle.$debugger.apiKey, project.apiKey)
    const contract = makeContractContextBuilder()
        .with(bundle.auto_bundle)
        .build({ isMainnet: false })
    const wallet = makeShelleyAddress(false, makePubKeyHash("22".repeat(28)))
    const address = makeShelleyAddress(false, contract.auto_bundle.$hash)
    const builder = makeTxBuilder({ isMainnet: false })
        .spendWithRedeemer(
            makeTxInput(
                "11".repeat(32) + "#0",
                makeTxOutput(
                    address,
                    20000000n,
                    makeInlineTxOutputDatum(makeIntData(1))
                )
            ),
            2n
        )
        .addCollateral(
            makeTxInput("22".repeat(32) + "#0", makeTxOutput(wallet, 10000000n))
        )
    await assert.rejects(
        builder.build({
            changeAddress: wallet,
            networkParams: DEFAULT_NETWORK_PARAMS()
        })
    )
    assert.equal(captures.length, 1)
    assert.equal(captures[0].status, "failed")
    assert.ok(captures[0].evaluations.length)
    assert.equal(captures[0].sources.auto_bundle, source)
    assert.ok(!JSON.stringify(captures[0]).includes(project.apiKey))
    console.log(
        "PASS: --project → validated key → generated bundle → high-level spend → automatic failed-tx upload"
    )
} finally {
    globalThis.fetch = previousFetch
    process.chdir(previousCwd)
    if (previousConfig === undefined) delete process.env.HELIOS_CONFIG_HOME
    else process.env.HELIOS_CONFIG_HOME = previousConfig
    await rm(directory, { recursive: true, force: true })
}
