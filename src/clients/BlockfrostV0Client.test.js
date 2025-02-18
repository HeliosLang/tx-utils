import { describe, it } from "node:test"
import { makeBlockfrostV0Client } from "./BlockfrostV0Client.js"
import { makeTxId, parseShelleyAddress } from "@helios-lang/ledger"
import { strict, strictEqual } from "assert"

const networkName = "preprod"
const apiKey = "preprodYjh2RkMv6xqgWNKOBhuQ6hoazm0s0iFp"

describe("BlockfrostV0Client", async () => {
    const client = makeBlockfrostV0Client(networkName, apiKey)

    await it("getTx() returns same cbor as ledger serialization", async () => {
        const txId =
            "51819b162fc12523e3e80240f86c52e3a0a3fcca686790f6d616e275617a18c4"

        await client.getTx(makeTxId(txId))
    })

    await it("getTx() works for txs with using set encoding for signatures and inputs", async () => {
        const txId =
            "2b5395c8417739ecf6a8ce447c28f4a027951673ca8fbf6b8b9d77d99715b4a6"

        const tx = await client.getTx(makeTxId(txId))

        strictEqual(tx.id().toHex(), txId)
    })

    await it("getTx() works for ebdf1c4596917e12c295ca66c349d69af1d09878a39320c46c3e62b5184d9054", async () => {
        const txId =
            "ebdf1c4596917e12c295ca66c349d69af1d09878a39320c46c3e62b5184d9054"

        await client.getTx(makeTxId(txId))
    })

    await it("getAddressTxs() returns at least one tx", async () => {
        const address = parseShelleyAddress(
            "addr_test1vz34ylm8ucm0xgq0a72n0r3w7yhgdudxxekvsae5j3w5d5sje670h"
        )

        const txs = await client.getAddressTxs(address)

        /**
         * @type {string[]}
         */
        const knownTxs = [
            "5aaebfaa4994891e62f480f4105e4d8c148e2954a66501a637a851e2a6134f5c",
            "c146c3ac7716b489cee41f84a2a6daab72d29366a7d65123ce1e7d3d0821b905",
            "0d5722d3486c3ca7a482aa4c7653954c8133a9fb3efbe0b6c77cdb96e2439a2a"
        ]

        strictEqual(txs.length > 400, true)
        strictEqual(
            knownTxs.every((knownTx) => {
                const knownTxId = makeTxId(knownTx)
                return txs.some((tx) => tx.id.isEqual(knownTxId))
            }),
            true
        )
    })
})
