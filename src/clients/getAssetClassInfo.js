import {
    decodeUtf8,
    equalsBytes,
    encodeUtf8,
    hexToBytes
} from "@helios-lang/codec-utils"
import { makeAssetClass } from "@helios-lang/ledger"
import { expectDefined } from "@helios-lang/type-utils"
import {
    expectByteArrayData,
    expectConstrData,
    expectIntData,
    expectMapData
} from "@helios-lang/uplc"

/**
 * @import { AssetClass } from "@helios-lang/ledger"
 * @import { AssetClassInfo, BlockfrostV0Client, NetworkName } from "../index.js"
 */

/**
 * TODO: support more clients
 * @param {BlockfrostV0Client} cardanoClient
 * @param {AssetClass} assetClass
 * @returns {Promise<AssetClassInfo>}
 */
export async function getAssetClassInfo(cardanoClient, assetClass) {
    // if the token name starts with the Cip68 (333) prefix, find the corresponding (100) token
    if (equalsBytes(assetClass.tokenName.slice(0, 4), hexToBytes("0014df10"))) {
        try {
            return await getCip68AssetClassInfo(cardanoClient, assetClass)
        } catch (e) {
            console.error(
                `Falling back to CIP26 for ${assetClass.toString()} because there is a CIP68 metadata token error: ${e.message}`
            )
        }
    }

    return await getCip26AssetClassInfo(cardanoClient.networkName, assetClass)
}

/**
 * @param {NetworkName} networkName
 * @param {AssetClass} assetClass
 * @returns {Promise<AssetClassInfo>}
 */
export async function getCip26AssetClassInfo(networkName, assetClass) {
    /**
     * @type {string}
     */
    const baseUrl = {
        mainnet: "https://tokens.cardano.org/metadata",
        preprod: "https://metadata.world.dev.cardano.org/metadata", // preprod and preview use the same?
        preview: "https://metadata.world.dev.cardano.org/metadata"
    }[networkName]

    const url = `${baseUrl}/${assetClass.toString().replace(".", "")}`

    const response = await fetch(url)

    if (!response.ok || response.status == 204) {
        throw new Error(
            `Failed to fetch CIP26 metadata for ${assetClass.toString()}`
        )
    }

    /**
     * @type {any}
     */
    const obj = await response.json()

    /**
     * @type {unknown}
     */
    const ticker = expectDefined(
        obj.ticker?.value,
        `${assetClass.toString()} CIP26 ticker.value undefined`
    )

    /**
     * @type {unknown}
     */
    const decimals = expectDefined(
        obj.decimals?.value,
        `${assetClass.toString()} CIP26 decimals.value undefined`
    )

    if (typeof ticker != "string") {
        throw new Error(
            `${assetClass.toString()} CIP26 ticker.value isn't a string`
        )
    }

    if (typeof decimals != "number") {
        throw new Error(
            `${assetClass.toString()} CIP26 decimals.value isn't a number`
        )
    }

    return {
        ticker,
        decimals
    }
}

/**
 * @param {BlockfrostV0Client} client
 * @param {AssetClass} assetClass
 * @returns {Promise<AssetClassInfo>}
 */
export async function getCip68AssetClassInfo(client, assetClass) {
    if (
        !equalsBytes(assetClass.tokenName.slice(0, 4), hexToBytes("0014df10"))
    ) {
        throw new Error("AssetClass tokenName doesn't have (333) prefix")
    }

    const metadataAssetClass = makeAssetClass(
        assetClass.mph,
        hexToBytes("000643b0").concat(assetClass.tokenName.slice(4))
    )

    const metadataAddresses =
        await client.getAddressesWithAssetClass(metadataAssetClass)

    if (metadataAddresses.length == 1) {
        const { address, quantity } = metadataAddresses[0]

        if (quantity != 1n) {
            throw new Error("multiple tokens")
        }

        const utxos = await client.getUtxosWithAssetClass(
            address,
            metadataAssetClass
        )

        if (utxos.length != 1) {
            throw new Error("multiple utxos")
        }

        const utxo = utxos[0]

        const datum = expectDefined(utxo.datum?.data, "no inline datum")

        const fields = expectConstrData(datum, 0).fields

        const content = expectMapData(
            expectDefined(fields[0], "bad constrdata first field"),
            "expected map data"
        )

        const tickerI = content.items.findIndex(([key]) => {
            return equalsBytes(
                expectByteArrayData(key).bytes,
                encodeUtf8("ticker")
            )
        })

        if (tickerI == -1) {
            throw new Error("ticker entry not found")
        }

        const decimalsI = content.items.findIndex(([key]) => {
            return equalsBytes(
                expectByteArrayData(key).bytes,
                encodeUtf8("decimals")
            )
        })

        if (decimalsI == -1) {
            throw new Error("decimals entry not found")
        }

        const ticker = decodeUtf8(
            expectByteArrayData(
                content.items[tickerI][1],
                "ticker isn't bytearraydata"
            ).bytes
        )
        const decimals = Number(
            expectIntData(content.items[decimalsI][1], "decimals isn't IntData")
                .value
        )

        return {
            ticker,
            decimals
        }
    } else {
        throw new Error("multiple addresses")
    }
}
