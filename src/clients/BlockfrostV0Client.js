import { bytesToHex } from "@helios-lang/codec-utils"
import {
    decodeTx,
    makeAddress,
    makeInlineTxOutputDatum,
    makeTxId,
    makeTxInput,
    makeTxOutput,
    makeTxOutputId,
    parseBlockfrostValue,
    parseShelleyAddress,
    UtxoAlreadySpentError,
    UtxoNotFoundError
} from "@helios-lang/ledger"
import { expectDefined } from "@helios-lang/type-utils"
import { decodeUplcData, decodeUplcProgramV2FromCbor } from "@helios-lang/uplc"

/**
 * @import { Address, AssetClass, NetworkParams, Tx, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
 * @import { UplcProgramV2 } from "@helios-lang/uplc"
 * @import { BlockfrostV0Client, NetworkName, ReadonlyWallet, TxSummary } from "../index.js"
 */

/**
 * @typedef {string} LargeNumber
 */

/**
 * TODO: what is the type of `extraEntropy`?
 * @typedef {{
 *   a0: number
 *   coins_per_utxo_size: LargeNumber
 *   coins_per_utxo_word: LargeNumber
 *   collateral_percent: number
 *   cost_models: {
 *       PlutusV1: Record<string, number>
 *       PlutusV2: Record<string, number>
 *       PlutusV3: number[]
 *   }
 *   e_max: number
 *   extra_entropy: null
 *   key_deposit: LargeNumber
 *   max_block_size: number
 *   max_block_ex_mem: LargeNumber
 *   max_block_ex_steps: string
 *   max_block_header_size: number
 *   max_collateral_inputs: number
 *   max_tx_ex_mem: LargeNumber
 *   max_tx_ex_steps: LargeNumber
 *   max_tx_size: number
 *   max_val_size: LargeNumber
 *   min_fee_a: number
 *   min_fee_b: number
 *   min_pool_cost: LargeNumber
 *   min_utxo: LargeNumber
 *   n_opt: number
 *   nonce: string
 *   pool_deposit: LargeNumber
 *   price_mem: number
 *   price_step: number
 *   protocol_major_ver: number
 *   protocol_minor_ver: number
 *   rho: number
 *   tau: number
 * }} BabbageBlockfrostParamsResponse
 */

/**
 * @typedef {BabbageBlockfrostParamsResponse & {
 *   decentralization_param: number
 *   pvt_motion_no_confidence: number
 *   pvt_committee_normal: number
 *   pvt_committee_no_confidence: number
 *   pvt_hard_fork_initiation: number
 *   dvt_motion_no_confidence: number
 *   dvt_committee_normal: number
 *   dvt_committee_no_confidence: number
 *   dvt_update_to_constitution: number
 *   dvt_hard_fork_initiation: number
 *   dvt_p_p_network_group: number
 *   dvt_p_p_economic_group: number
 *   dvt_p_p_technical_group: number
 *   dvt_p_p_gov_group: number
 *   dvt_treasury_withdrawal: number
 *   committee_min_size: LargeNumber
 *   committee_max_term_length: LargeNumber
 *   gov_action_lifetime: LargeNumber
 *   gov_action_deposit: LargeNumber
 *   drep_deposit: LargeNumber
 *   drep_activity: LargeNumber
 *   pvtpp_security_group: number
 *   min_fee_ref_script_cost_per_byte: number
 * }} ConwayBlockfrostParamsResponse
 */

/**
 * Union type as long as the Chang HFC hasn't passed on all networks
 * @typedef {BabbageBlockfrostParamsResponse | ConwayBlockfrostParamsResponse} BlockfrostParamsResponse
 */

/**
 * @typedef {{
 *   epoch: number
 *   hash: string
 *   time: number
 *   slot: number
 * }} BlockfrostTipResponse
 */

/**
 * @param {NetworkName} networkName
 * @param {string} projectId
 * @returns {BlockfrostV0Client}
 */
export function makeBlockfrostV0Client(networkName, projectId) {
    return new BlockfrostV0ClientImpl(networkName, projectId)
}

/**
 * Connects to the same network a given `Wallet` or the given `TxInput` (preview, preprod or mainnet).
 *
 * Throws an error if a Blockfrost project_id is missing for that specific network.
 * @overload
 * @param {TxInput} utxo
 * @param {{
 *     preview?: string,
 *     preprod?: string,
 *     mainnet?: string
 * }} projectIds
 * @returns {Promise<BlockfrostV0Client>}
 */
/**
 * @overload
 * Connects to the same network a given `Wallet` is connected to (preview, preprod or mainnet).
 * @param {ReadonlyWallet} wallet
 * @param {{
 *     preview?: string,
 *     preprod?: string,
 *     mainnet?: string
 * }} projectIds
 * @returns {Promise<BlockfrostV0Client>}
 */
/**
 * @param {TxInput | ReadonlyWallet} utxoOrWallet
 * @param {{
 *     preview?: string,
 *     preprod?: string,
 *     mainnet?: string
 * }} projectIds
 * @returns {Promise<BlockfrostV0Client>}
 */
export async function resolveBlockfrostV0Client(utxoOrWallet, projectIds) {
    if ("kind" in utxoOrWallet && utxoOrWallet.kind == "TxInput") {
        const refUtxo = utxoOrWallet
        const mainnetProjectId = projectIds["mainnet"]
        const preprodProjectId = projectIds["preprod"]
        const previewProjectId = projectIds["preview"]

        if (preprodProjectId !== undefined) {
            const preprodNetwork = new BlockfrostV0ClientImpl(
                "preprod",
                preprodProjectId
            )

            if (await preprodNetwork.hasUtxo(refUtxo.id)) {
                return preprodNetwork
            }
        }

        if (previewProjectId !== undefined) {
            const previewNetwork = new BlockfrostV0ClientImpl(
                "preview",
                previewProjectId
            )

            if (await previewNetwork.hasUtxo(refUtxo.id)) {
                return previewNetwork
            }
        }

        if (mainnetProjectId !== undefined) {
            const mainnetNetwork = new BlockfrostV0ClientImpl(
                "mainnet",
                mainnetProjectId
            )

            if (await mainnetNetwork.hasUtxo(refUtxo.id)) {
                return mainnetNetwork
            }
        }

        throw new Error(
            "refUtxo not found on a network for which you have a project id"
        )
    } else {
        /**
         * @type {ReadonlyWallet}
         */
        const wallet = /** @type {any} */ (utxoOrWallet)

        if (await wallet.isMainnet()) {
            return new BlockfrostV0ClientImpl(
                "mainnet",
                expectDefined(
                    projectIds["mainnet"],
                    "mainnet project id undefined"
                )
            )
        } else {
            const refUtxo = (await wallet.utxos)[0]

            if (!refUtxo) {
                throw new Error(
                    "empty wallet, can't determine which testnet you are connecting to"
                )
            } else {
                return resolveBlockfrostV0Client(refUtxo, projectIds)
            }
        }
    }
}

/**
 * Blockfrost specific implementation of `Network`.
 * @implements {BlockfrostV0Client}
 */
class BlockfrostV0ClientImpl {
    /**
     * @readonly
     * @type {NetworkName}
     */
    networkName

    /**
     * @readonly
     * @type {string}
     */
    projectId

    /**
     * Constructs a BlockfrostV0 using the network name (preview, preprod or mainnet) and your Blockfrost `project_id`.
     * @param {NetworkName} networkName
     * @param {string} projectId
     */
    constructor(networkName, projectId) {
        this.networkName = networkName
        this.projectId = projectId

        this.burst = 0
        this.lastRequest = 0
    }

    /**
     * Rate limits:
     *   - Bursts of 500 requests
     *   - 10 requests per second steady rate
     *   - After a burst 10 requests per second are "restored"
     * There will always be a non-zero difference wrt. the lastRequest: `d`
     *   - upon entry deduct d/100ms from the burst capacity (0 as minimum)
     *   - then add 1 to burst capacity
     *   - if burst usage is 500, wait at least 100ms
     * @private
     * @param {string} url
     * @param {RequestInit} options
     * @returns {Promise<Response>}
     */
    async fetchRateLimited(
        url,
        options = { method: "GET", headers: { project_id: this.projectId } }
    ) {
        const d = Date.now() - this.lastRequest
        this.burst = Math.max(this.burst - d / 100, 0)
        if (this.burst >= 500) {
            await new Promise((resolve) =>
                setTimeout(resolve, (this.burst - 499) * 100)
            )
        }
        this.burst += 1

        const tryFetch = async () => {
            return await fetch(url, options)
        }

        let response = await tryFetch()

        if (response.status == 429) {
            let attempt = 1
            while (attempt < 3) {
                // wait 100 ms
                await new Promise((resolve) => setTimeout(resolve, 100))

                response = await tryFetch()

                if (response.status != 429) {
                    return response
                }

                attempt += 1
            }

            throw new Error(
                `BlockfrostV0Client: rate limited, too many requests ${url}`
            )
        } else {
            return response
        }
    }

    /**
     * TODO: proper type
     * @type {Promise<any>}
     */
    get latestEpoch() {
        return (async () => {
            const response = await this.fetchRateLimited(
                `https://cardano-${this.networkName}.blockfrost.io/api/v0/epochs/latest`
            )

            return await response.json()
        })()
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
     * Note: this requires two API calls to blockfrost, because we also need information about the tip
     * @returns {Promise<NetworkParams>}
     */
    get parameters() {
        return (async () => {
            const bfTip = /** @type {BlockfrostTipResponse} */ (
                await this.fetchRateLimited(
                    `https://cardano-${this.networkName}.blockfrost.io/api/v0/blocks/latest`
                ).then((r) => r.json())
            )

            const bfParams = /** @type {BlockfrostParamsResponse} */ (
                await this.fetchRateLimited(
                    `https://cardano-${this.networkName}.blockfrost.io/api/v0/epochs/latest/parameters`
                ).then((r) => r.json())
            )

            /**
             * @param {Record<string, number>} obj
             * @returns {number[]}
             */
            const convertOldCostModels = (obj) => {
                const keys = Object.keys(obj).sort()

                return keys.map((k) => obj[k])
            }

            /**
             * @type {NetworkParams}
             */
            const params = {
                secondsPerSlot: 1,
                collateralPercentage: bfParams.collateral_percent,
                costModelParamsV1: convertOldCostModels(
                    bfParams.cost_models.PlutusV1
                ),
                costModelParamsV2: convertOldCostModels(
                    bfParams.cost_models.PlutusV2
                ),
                costModelParamsV3: bfParams.cost_models?.PlutusV3 ?? [],
                exCpuFeePerUnit: bfParams.price_step,
                exMemFeePerUnit: bfParams.price_mem,
                maxCollateralInputs: 3,
                maxTxExCpu: parseInt(bfParams.max_tx_ex_steps),
                maxTxExMem: parseInt(bfParams.max_tx_ex_mem),
                maxTxSize: bfParams.max_tx_size,
                refScriptsFeePerByte:
                    "min_fee_ref_script_cost_per_byte" in bfParams
                        ? bfParams.min_fee_ref_script_cost_per_byte
                        : 0,
                stakeAddrDeposit: parseInt(bfParams.key_deposit),
                txFeeFixed: bfParams.min_fee_b,
                txFeePerByte: bfParams.min_fee_a,
                utxoDepositPerByte: parseInt(bfParams.coins_per_utxo_size),
                refTipSlot: bfTip.slot,
                refTipTime: bfTip.time * 1000
            }

            return params
        })()
    }

    /**
     * Allows inspecting the live Blockfrost mempool.
     * @returns {Promise<void>} - prints to console instead of returning anything
     */
    async dumpMempool() {
        const response = await this.fetchRateLimited(
            `https://cardano-${this.networkName}.blockfrost.io/api/v0/mempool`
        )

        console.log(await response.text())
    }

    /**
     * The inputs in the returned Tx aren't restored (i.e. aren't full TxInputs)
     * @param {TxId} id
     * @returns {Promise<Tx>}
     */
    async getTx(id) {
        const response = await this.fetchRateLimited(
            `https://cardano-${this.networkName}.blockfrost.io/api/v0/txs/${id.toHex()}/cbor`
        )

        if (response.status == 404) {
            throw new Error(`Tx ${id.toString()} not found`)
        } else if (!response.ok) {
            throw new Error(
                `Blockfrost error in getTx(): ${response.statusText}`
            )
        } else if (response.status != 200) {
            throw new Error(
                `Blockfrost error in getTx(): ${await response.text()}`
            )
        }

        const responseObj = /** @type {any} */ (await response.json())

        const cbor = responseObj.cbor

        if (!cbor || typeof cbor != "string") {
            console.log(responseObj)
            throw new Error(`unexpected response from Blockfrost`)
        }

        // ensure that serializing the tx again results in the same txId
        const tx = decodeTx(cbor)

        if (!tx.id().isEqual(id)) {
            throw new Error("Tx serialization mismatch")
        }

        return tx
    }

    /**
     * If the UTxO isn't found a UtxoNotFoundError is thrown
     * If The UTxO has already been spent a UtxoAlreadySpentError is thrown
     * TODO: take into account rate-limiting
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        const txId = id.txId

        const response = await this.fetchRateLimited(
            `https://cardano-${this.networkName}.blockfrost.io/api/v0/txs/${txId.toHex()}/utxos`
        )

        if (response.status == 404) {
            throw new UtxoNotFoundError(id)
        } else if (!response.ok) {
            throw new Error(
                `Blockfrost error in getUtxo(): ${response.statusText}`
            )
        } else if (response.status != 200) {
            throw new Error(
                `Blockfrost error in getUtxo(): ${await response.text()}`
            )
        }

        const responseObj = /** @type {any} */ (await response.json())

        const outputs = responseObj.outputs

        if (!outputs) {
            console.log(responseObj)
            throw new Error(`unexpected response from Blockfrost`)
        }

        const outputObj = outputs[id.index]

        if (!outputObj) {
            console.log(responseObj)
            throw new UtxoNotFoundError(id)
        }

        outputObj["tx_hash"] = txId.toHex()
        outputObj["output_index"] = Number(id.index)

        const utxo = await this.restoreTxInput(outputObj)

        if (
            "consumed_by_tx" in outputObj &&
            typeof outputObj.consumed_by_tx == "string"
        ) {
            const txId = makeTxId(outputObj.consumed_by_tx)

            throw new UtxoAlreadySpentError(utxo, txId)
        }

        return utxo
    }

    /**
     * Gets a complete list of UTxOs at a given `Address`.
     * Returns oldest UTxOs first, newest last.
     * @param {Address} address
     * @returns {Promise<TxInput[]>}
     */
    async getUtxos(address) {
        return this.getAddressUtxosWithOptionalAssetClass(address)
    }

    /**
     * @param {Address} address
     * @param {AssetClass} assetClass
     * @returns {Promise<TxInput[]>}
     */
    async getUtxosWithAssetClass(address, assetClass) {
        return this.getAddressUtxosWithOptionalAssetClass(address, assetClass)
    }

    /**
     * Gets a complete list of UTxOs at a given `Address` with an optional given asset class
     * Returns oldest UTxOs first, newest last.
     * @private
     * @param {Address} address
     * @param {AssetClass} [assetClass]
     * @returns {Promise<TxInput[]>}
     */
    async getAddressUtxosWithOptionalAssetClass(
        address,
        assetClass = undefined
    ) {
        const MAX = 100
        const assetClassStr = assetClass
            ? `/${assetClass.mph.toHex()}${bytesToHex(assetClass.tokenName)}`
            : ""
        const baseUrl = `https://cardano-${this.networkName}.blockfrost.io/api/v0/addresses/${address.toString()}/utxos/${assetClassStr}?count=${MAX}&order=asc`
        let page = 1
        let hasMorePages = true

        /**
         * TODO: correct blockfrost type
         * @type {any[]}
         */
        let results = []

        try {
            while (hasMorePages) {
                const url = `${baseUrl}&page=${page}`
                const response = await this.fetchRateLimited(url)

                if (response.status == 404) {
                    return []
                }

                /**
                 * @type {any}
                 */
                const obj = await response.json()

                if (obj?.status_code >= 300) {
                    hasMorePages = false
                } else {
                    if (!Array.isArray(obj)) {
                        throw new Error("expected")
                    }

                    results = results.concat(obj)

                    hasMorePages = obj.length == MAX
                }
                page += 1
            }
        } catch (e) {
            if (
                e.message.includes("The requested component has not been found")
            ) {
                return []
            } else {
                throw e
            }
        }

        try {
            return await Promise.all(
                results.map((obj) => {
                    return this.restoreTxInput(obj)
                })
            )
        } catch (e) {
            console.error("unable to parse blockfrost utxo format:", results)
            throw e
        }
    }

    /**
     * @param {AssetClass} assetClass
     * @returns {Promise<{address: Address, quantity: bigint}[]>}
     */
    async getAddressesWithAssetClass(assetClass) {
        const response = await this.fetchRateLimited(
            `https://cardano-mainnet.blockfrost.io/api/v0/assets/${assetClass.toString().replace(".", "")}/addresses`
        )

        const list = await response.json()

        if (!Array.isArray(list)) {
            throw new Error(
                `expected array response in BlockfrostV0Client.getAddressesWithAssetClass, got '${await response.text()}`
            )
        }

        return list.map((item) => {
            return {
                address: makeAddress(item.address),
                quantity: BigInt(item.quantity)
            }
        })
    }

    /**
     * @returns {boolean}
     */
    isMainnet() {
        return this.networkName == "mainnet"
    }

    /**
     * Used by `BlockfrostV0.resolve()`.
     * @param {TxId} txId
     * @returns {Promise<boolean>}
     */
    async hasTx(txId) {
        const response = await this.fetchRateLimited(
            `https://cardano-${this.networkName}.blockfrost.io/api/v0/txs/${txId.toHex()}/utxos`
        )

        if (response.status == 404) {
            return false
        } else if (!response.ok) {
            throw new Error(
                `Blockfrost error in hasTx(): ${response.statusText}`
            )
        } else {
            return true
        }
    }

    /**
     * Used by `BlockfrostV0.resolve()`.
     * Returns false if the UTxO has already been spent
     * @param {TxOutputId} utxoId
     * @returns {Promise<boolean>}
     */
    async hasUtxo(utxoId) {
        const txId = utxoId.txId

        const response = await this.fetchRateLimited(
            `https://cardano-${this.networkName}.blockfrost.io/api/v0/txs/${txId.toHex()}/utxos`
        )

        if (response.status == 404) {
            return false
        } else if (!response.ok) {
            throw new Error(
                `Blockfrost error in hasUtxo(): ${response.statusText}`
            )
        }

        const responseObj = /** @type {any} */ (await response.json())

        const outputs = responseObj.outputs

        if (!outputs || !Array.isArray(outputs)) {
            console.log(responseObj)
            throw new Error(`unexpected response from Blockfrost`)
        }

        const outputObj = outputs[utxoId.index]

        if (outputObj) {
            return !("consumed_by_tx" in outputObj)
        } else {
            return false
        }
    }

    /**
     * Submits a transaction to the blockchain.
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        const data = new Uint8Array(tx.toCbor())
        const url = `https://cardano-${this.networkName}.blockfrost.io/api/v0/tx/submit`

        const response = await this.fetchRateLimited(url, {
            method: "POST",
            headers: {
                "content-type": "application/cbor",
                project_id: this.projectId
            },
            body: data
        }).catch((e) => {
            console.error(e)
            throw e
        })

        const responseText = await response.text()

        if (response.status != 200) {
            // analyze error and throw a different error if it was detected that an input UTxO might not exist
            throw new Error(responseText)
        } else {
            return makeTxId(JSON.parse(responseText))
        }
    }

    /**
     * @private
     * @param {{
     *   address: string
     *   tx_hash: string
     *   output_index: number
     *   amount: {unit: string, quantity: string}[]
     *   inline_datum: null | string
     *   data_hash: null | string
     *   collateral: boolean
     *   reference_script_hash: null | string
     * }} obj
     */
    async restoreTxInput(obj) {
        /**
         * @type {UplcProgramV2 | undefined}
         */
        let refScript = undefined

        if (obj.reference_script_hash !== null) {
            const url = `https://cardano-${this.networkName}.blockfrost.io/api/v0/scripts/${obj.reference_script_hash}/cbor`

            const response = await this.fetchRateLimited(url, {
                method: "GET",
                headers: {
                    project_id: this.projectId
                }
            })

            /**
             * @type {any}
             */
            const responseJson = await response.json()

            if (!responseJson) {
                console.error("blockfrost response is null or undefined")
            } else if (!("cbor" in responseJson)) {
                console.error(`reponse.cbor not found in ${responseJson}`)
            } else if (responseJson.cbor == null) {
                console.error(`reponseJson.cbor is null`)
            } else {
                refScript = decodeUplcProgramV2FromCbor(responseJson.cbor)
            }
        }

        return makeTxInput(
            makeTxOutputId(makeTxId(obj.tx_hash), obj.output_index),
            makeTxOutput(
                parseShelleyAddress(obj.address),
                parseBlockfrostValue(obj.amount),
                obj.inline_datum
                    ? makeInlineTxOutputDatum(decodeUplcData(obj.inline_datum))
                    : undefined,
                refScript
            )
        )
    }
}
