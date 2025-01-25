import {
    makeAssetClass,
    makeAssets,
    makeDatumHash,
    makeHashedTxOutputDatum,
    makeInlineTxOutputDatum,
    makeShelleyAddress,
    makeTxId,
    makeTxInput,
    makeTxOutput,
    makeTxOutputId,
    makeValue,
    parseShelleyAddress,
    parseStakingAddress,
    UtxoNotFoundError
} from "@helios-lang/ledger"
import { expectDefined } from "@helios-lang/type-utils"
import { decodeUplcData, decodeUplcProgramV2FromCbor } from "@helios-lang/uplc"

/**
 * @import { Address, AssetClass, NetworkParams, StakingAddress, Tx, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
 * @import { KoiosV0Client, NetworkName } from "../index.js"
 */

/**
 * @param {NetworkName} networkName
 * @returns {KoiosV0Client}
 */
export function makeKoiosV0Client(networkName) {
    return new KoiosV0ClientImpl(networkName)
}

/**
 * @param {TxInput} refUtxo
 * @returns {Promise<KoiosV0Client>}
 */
export async function resolveKoiosV0Client(refUtxo) {
    const preprodNetwork = new KoiosV0ClientImpl("preprod")

    if (await preprodNetwork.hasUtxo(refUtxo)) {
        return preprodNetwork
    }

    const previewNetwork = new KoiosV0ClientImpl("preview")

    if (await previewNetwork.hasUtxo(refUtxo)) {
        return previewNetwork
    }

    const mainnetNetwork = new KoiosV0ClientImpl("mainnet")

    if (await mainnetNetwork.hasUtxo(refUtxo)) {
        return mainnetNetwork
    }

    throw new Error("refUtxo not found on any network")
}

/**
 * Koios network interface.
 * @implements {KoiosV0Client}
 */
class KoiosV0ClientImpl {
    /**
     * @readonly
     * @type {NetworkName}
     */
    networkName

    /**
     * @param {NetworkName} networkName
     */
    constructor(networkName) {
        this.networkName = networkName
    }

    /**
     * ms since 1970
     * Note: the emulator uses an arbitrary reference, so to be able to treat all Networks equally this must be implemented
     * @type {number}
     */
    get now() {
        return Date.now()
    }

    /**
     * @type {Promise<NetworkParams>}
     */
    get parameters() {
        return (async () => {
            const response = await fetch(
                `https://network-status.helios-lang.io/${this.networkName}/config`
            )

            // TODO: build networkParams from Koios endpoints instead
            return /** @type {any} */ (await response.json())
        })()
    }

    /**
     * @private
     * @type {string}
     */
    get rootUrl() {
        return {
            preview: "https://preview.koios.rest",
            preprod: "https://preprod.koios.rest",
            guildnet: "https://guild.koios.rest",
            mainnet: "https://api.koios.rest"
        }[this.networkName]
    }

    /**
     * @private
     * @param {TxOutputId[]} ids
     * @returns {Promise<TxInput[]>}
     */
    async getUtxosInternal(ids) {
        const url = `${this.rootUrl}/api/v0/tx_info`

        /**
         * @type {Map<string, number[]>}
         */
        const txIds = new Map()

        ids.forEach((id) => {
            const prev = txIds.get(id.txId.toHex())

            if (prev) {
                prev.push(id.index)
            } else {
                txIds.set(id.txId.toHex(), [id.index])
            }
        })

        const response = await fetch(url, {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                _tx_hashes: Array.from(txIds.keys())
            })
        })

        const responseText = await response.text()

        if (response.status != 200) {
            // analyze error and throw a different error if it was detected that an input UTxO might not exist
            throw new Error(responseText)
        }

        const obj = JSON.parse(responseText)

        /**
         * @type {Map<string, TxInput>}
         */
        const result = new Map()

        const rawTxs = obj

        if (!Array.isArray(rawTxs)) {
            throw new Error(`unexpected tx_info format: ${responseText}`)
        }

        rawTxs.forEach((rawTx) => {
            const rawOutputs = rawTx["outputs"]

            if (!rawOutputs) {
                throw new Error(
                    `unexpected tx_info format: ${JSON.stringify(rawTx)}`
                )
            }

            const utxoIdxs = expectDefined(
                txIds.get(rawTx.tx_hash),
                `tx ${rawTx.tx_hash} not found in returned map`
            )

            for (let utxoIdx of utxoIdxs) {
                const id = makeTxOutputId(makeTxId(rawTx.tx_hash), utxoIdx)

                const rawOutput = rawOutputs[id.index]

                if (!rawOutput) {
                    throw new Error(`UTxO ${id.toString()} doesn't exist`)
                }

                const rawPaymentAddr = rawOutput.payment_addr?.bech32

                if (!rawPaymentAddr || typeof rawPaymentAddr != "string") {
                    throw new Error(
                        `unexpected tx_info format: ${JSON.stringify(rawTx)}`
                    )
                }

                const rawStakeAddr = rawOutput.stake_addr

                if (rawStakeAddr === undefined) {
                    throw new Error(
                        `unexpected tx_info format: ${JSON.stringify(rawTx)}`
                    )
                }

                const paymentAddr = parseShelleyAddress(rawPaymentAddr)

                /**
                 * @type {StakingAddress | undefined}
                 */
                const stakeAddr = rawStakeAddr
                    ? parseStakingAddress(rawStakeAddr)
                    : undefined

                const address = makeShelleyAddress(
                    this.networkName == "mainnet",
                    paymentAddr.spendingCredential,
                    stakeAddr?.stakingCredential
                )

                const lovelace = BigInt(
                    parseInt(
                        expectDefined(rawOutput.value, "output.value undefined")
                    )
                )

                if (lovelace.toString() != rawOutput.value) {
                    throw new Error(
                        `unexpected tx_info format: ${JSON.stringify(rawTx)}`
                    )
                }

                /**
                 * @type {[AssetClass, bigint][]}
                 */
                const assets = []

                for (let rawAsset of rawOutput.asset_list) {
                    const qty = BigInt(parseInt(rawAsset.quantity))
                    if (qty.toString() != rawAsset.quantity) {
                        throw new Error(
                            `unexpected tx_info format: ${JSON.stringify(rawTx)}`
                        )
                    }

                    assets.push([
                        makeAssetClass(
                            `${rawAsset.policy_id}.${rawAsset.asset_name ?? ""}`
                        ),
                        qty
                    ])
                }

                const datum = rawOutput.inline_datum
                    ? makeInlineTxOutputDatum(
                          decodeUplcData(rawOutput.inline_datum.bytes)
                      )
                    : rawOutput.datum_hash
                      ? makeHashedTxOutputDatum(
                            makeDatumHash(rawOutput.datum_hash)
                        )
                      : undefined

                const refScript = rawOutput.reference_script
                    ? decodeUplcProgramV2FromCbor(rawOutput.reference_script)
                    : undefined

                const txInput = makeTxInput(
                    id,
                    makeTxOutput(
                        address,
                        makeValue(lovelace, makeAssets(assets)),
                        datum,
                        refScript
                    )
                )

                result.set(id.toString(), txInput)
            }
        })

        return ids.map((id) => {
            const input = result.get(id.toString())

            if (!input) {
                throw new UtxoNotFoundError(id)
            } else {
                return input
            }
        })
    }

    /**
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        // TODO: create a KoiosV1Client in order to be able to use the new /utxo_info endpoint
        return expectDefined(
            await this.getUtxosInternal([id])[0],
            `utxo ${id.toString()} not found in KoiosV0Client.getUtxo()`
        )
    }

    /**
     * @param {Address} address
     * @returns {Promise<TxInput[]>}
     */
    async getUtxos(address) {
        const url = `${this.rootUrl}/api/v0/credential_utxos`

        if (address.era != "Shelley") {
            throw new Error("expected Shelley address")
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                _payment_credentials: [address.spendingCredential.toHex()]
            })
        })

        const responseText = await response.text()

        if (response.status != 200) {
            // analyze error and throw a different error if it was detected that an input UTxO might not exist
            throw new Error(responseText)
        }

        const obj = JSON.parse(responseText)

        if (!Array.isArray(obj)) {
            throw new Error(
                `unexpected credential_utxos format: ${responseText}`
            )
        }

        const ids = obj.map((rawId) => {
            const utxoIdx = Number(rawId.tx_index)
            const id = makeTxOutputId(makeTxId(rawId.tx_hash), utxoIdx)

            return id
        })

        return this.getUtxosInternal(ids)
    }

    /**
     * @returns {boolean}
     */
    isMainnet() {
        return this.networkName == "mainnet"
    }

    /**
     * Used by `KoiosV0.resolveUsingUtxo()`.
     * @param {TxInput} utxo
     * @returns {Promise<boolean>}
     */
    async hasUtxo(utxo) {
        const url = `${this.rootUrl}/api/v0/tx_info`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                accept: "application/json",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                _tx_hashes: [utxo.id.txId.toHex()]
            })
        })

        return response.ok
    }

    /**
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        const url = `${this.rootUrl}/api/v0/submittx`

        const response = await fetch(url, {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/cbor"
            },
            body: new Uint8Array(tx.toCbor())
        })

        const responseText = await response.text()

        if (response.status != 200) {
            // analyze error and throw a different error if it was detected that an input UTxO might not exist
            throw new Error(responseText)
        }

        return makeTxId(responseText)
    }
}
