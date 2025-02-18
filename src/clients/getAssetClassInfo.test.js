import { describe, it } from "node:test"
import { makeBlockfrostV0Client } from "./BlockfrostV0Client.js"
import {
    getAssetClassInfo,
    getCip68AssetClassInfo
} from "./getAssetClassInfo.js"
import { makeAssetClass, makeMintingPolicyHash } from "@helios-lang/ledger"

const networkName = "preprod"
const apiKey = "preprodYjh2RkMv6xqgWNKOBhuQ6hoazm0s0iFp"

const client = makeBlockfrostV0Client(networkName, apiKey)

describe("getCip68AssetClassInfo()", async () => {
    await it("works for basic Cip68 structure", async () => {
        const assetClass = makeAssetClass(
            makeMintingPolicyHash(
                "112a8d47461cb93ed1205a6cc55fdecf8e80243e687f84f57621f029"
            ),
            "0014df10"
        )

        await getCip68AssetClassInfo(client, assetClass)
    })
})

describe("getAssetClassInfo()", async () => {
    await it("works for basic Cip68 structure", async () => {
        const assetClass = makeAssetClass(
            makeMintingPolicyHash(
                "112a8d47461cb93ed1205a6cc55fdecf8e80243e687f84f57621f029"
            ),
            "0014df10"
        )

        await getAssetClassInfo(client, assetClass)
    })
})
