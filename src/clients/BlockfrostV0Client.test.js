import { describe, it } from "node:test"
import { makeBlockfrostV0Client } from "./BlockfrostV0Client.js"
import { makeTxId } from "@helios-lang/ledger"

const networkName = "preprod"
const apiKey = "preprodYjh2RkMv6xqgWNKOBhuQ6hoazm0s0iFp"

describe("BlockfrostV0Client", async () => {
    const client = makeBlockfrostV0Client(networkName, apiKey)

    await it("getTx() returns same cbor as ledger serialization", async () => {
        const txId =
            "51819b162fc12523e3e80240f86c52e3a0a3fcca686790f6d616e275617a18c4"

        await client.getTx(makeTxId(txId))
    })
})
