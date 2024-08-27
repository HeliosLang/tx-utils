/**
 * @typedef {import("@helios-lang/ledger").NetworkParams} NetworkParams
 * @typedef {import("./Network.js").Network} Network
 * @typedef {import("./Network.js").NetworkName} NetworkName
 */

import {
    Address,
    AssetClass,
    Assets,
    DatumHash,
    StakingAddress,
    Tx,
    TxId,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { None, expectSome } from "@helios-lang/type-utils"
import { UplcProgramV2, decodeUplcData } from "@helios-lang/uplc"

/**
 * Koios network interface.
 * @implements {Network}
 */
export class KoiosV0 {
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
     * @param {TxInput} refUtxo
     * @returns {Promise<KoiosV0>}
     */
    static async resolve(refUtxo) {
        const preprodNetwork = new KoiosV0("preprod")

        if (await preprodNetwork.hasUtxo(refUtxo)) {
            return preprodNetwork
        }

        const previewNetwork = new KoiosV0("preview")

        if (await previewNetwork.hasUtxo(refUtxo)) {
            return previewNetwork
        }

        const mainnetNetwork = new KoiosV0("mainnet")

        if (await mainnetNetwork.hasUtxo(refUtxo)) {
            return mainnetNetwork
        }

        throw new Error("refUtxo not found on any network")
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
                prev.push(id.utxoIdx)
            } else {
                txIds.set(id.txId.toHex(), [id.utxoIdx])
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

            const utxoIdxs = expectSome(txIds.get(rawTx.tx_hash))

            for (let utxoIdx of utxoIdxs) {
                const id = new TxOutputId(new TxId(rawTx.tx_hash), utxoIdx)

                const rawOutput = rawOutputs[id.utxoIdx]

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

                const paymentAddr = Address.fromBech32(rawPaymentAddr)

                /**
                 * @type {Option<StakingAddress>}
                 */
                const stakeAddr = rawStakeAddr
                    ? StakingAddress.fromBech32(rawStakeAddr)
                    : None

                const address = Address.fromHashes(
                    this.networkName == "mainnet",
                    expectSome(
                        paymentAddr.pubKeyHash ?? paymentAddr.validatorHash
                    ),
                    stakeAddr?.stakingHash?.hash
                )

                const lovelace = BigInt(parseInt(expectSome(rawOutput.value)))

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
                        AssetClass.new(
                            `${rawAsset.policy_id}.${rawAsset.asset_name ?? ""}`
                        ),
                        qty
                    ])
                }

                const datum = rawOutput.inline_datum
                    ? TxOutputDatum.Inline(
                          decodeUplcData(rawOutput.inline_datum.bytes)
                      )
                    : rawOutput.datum_hash
                      ? TxOutputDatum.Hash(new DatumHash(rawOutput.datum_hash))
                      : None

                const refScript = rawOutput.reference_script
                    ? UplcProgramV2.fromCbor(rawOutput.reference_script)
                    : None

                const txInput = new TxInput(
                    id,
                    new TxOutput(
                        address,
                        new Value(lovelace, Assets.fromAssetClasses(assets)),
                        datum,
                        refScript
                    )
                )

                result.set(id.toString(), txInput)
            }
        })

        return ids.map((id) => expectSome(result.get(id.toString())))
    }

    /**
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        return expectSome(await this.getUtxosInternal([id])[0])
    }

    /**
     * @param {Address} address
     * @returns {Promise<TxInput[]>}
     */
    async getUtxos(address) {
        const url = `${this.rootUrl}/api/v0/credential_utxos`

        const response = await fetch(url, {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                _payment_credentials: [address.spendingCredential.hash.toHex()]
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
            const id = new TxOutputId(new TxId(rawId.tx_hash), utxoIdx)

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

        return new TxId(responseText)
    }
}
