import {
    Address,
    Tx,
    TxId,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { expectDefined } from "@helios-lang/type-utils"
import { UplcProgramV2, decodeUplcData } from "@helios-lang/uplc"
import { SHELLEY_GENESIS_PARAMS } from "@helios-lang/ledger-shelley"
import { makeTxSummary } from "../chain/index.js"

/**
 * @import { NetworkParams } from "@helios-lang/ledger"
 * @import { UplcProgramV2I } from "@helios-lang/uplc"
 * @import { BlockfrostV0Client, NetworkName, ReadonlyWallet, TxSummary } from "src/index.js"
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
 *
 * @overload
 * Connects to the same network a given `Wallet` is connected to (preview, preprod or mainnet).
 * @param {ReadonlyWallet} wallet
 * @param {{
 *     preview?: string,
 *     preprod?: string,
 *     mainnet?: string
 * }} projectIds
 * @returns {Promise<BlockfrostV0Client>}
 *
 * @param {TxInput | ReadonlyWallet} utxoOrWallet
 * @param {{
 *     preview?: string,
 *     preprod?: string,
 *     mainnet?: string
 * }} projectIds
 * @returns {Promise<BlockfrostV0Client>}
 */
export async function resolveBlockfrostV0Client(utxoOrWallet, projectIds) {
    if (utxoOrWallet instanceof TxInput) {
        const refUtxo = utxoOrWallet
        const mainnetProjectId = projectIds["mainnet"]
        const preprodProjectId = projectIds["preprod"]
        const previewProjectId = projectIds["preview"]

        if (preprodProjectId !== undefined) {
            const preprodNetwork = new BlockfrostV0ClientImpl(
                "preprod",
                preprodProjectId
            )

            if (await preprodNetwork.hasUtxo(refUtxo)) {
                return preprodNetwork
            }
        }

        if (previewProjectId !== undefined) {
            const previewNetwork = new BlockfrostV0ClientImpl(
                "preview",
                previewProjectId
            )

            if (await previewNetwork.hasUtxo(refUtxo)) {
                return previewNetwork
            }
        }

        if (mainnetProjectId !== undefined) {
            const mainnetNetwork = new BlockfrostV0ClientImpl(
                "mainnet",
                mainnetProjectId
            )

            if (await mainnetNetwork.hasUtxo(refUtxo)) {
                return mainnetNetwork
            }
        }

        throw new Error(
            "refUtxo not found on a network for which you have a project id"
        )
    } else {
        const wallet = utxoOrWallet

        if (await wallet.isMainnet()) {
            return new BlockfrostV0ClientImpl(
                "mainnet",
                expectDefined(projectIds["mainnet"])
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
    }

    /**
     * TODO: proper type
     * @type {Promise<any>}
     */
    get latestEpoch() {
        return (async () => {
            const response = await fetch(
                `https://cardano-${this.networkName}.blockfrost.io/api/v0/epochs/latest`,
                {
                    method: "GET",
                    headers: {
                        project_id: this.projectId
                    }
                }
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
                await fetch(
                    `https://cardano-${this.networkName}.blockfrost.io/api/v0/blocks/latest`,
                    {
                        method: "GET",
                        headers: { project_id: this.projectId }
                    }
                ).then((r) => r.json())
            )

            const bfParams = /** @type {BlockfrostParamsResponse} */ (
                await fetch(
                    `https://cardano-${this.networkName}.blockfrost.io/api/v0/epochs/latest/parameters`,
                    {
                        method: "GET",
                        headers: { project_id: this.projectId }
                    }
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
                secondsPerSlot: SHELLEY_GENESIS_PARAMS.slotLength,
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
                refScriptFeePerByte:
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
        const url = `https://cardano-${this.networkName}.blockfrost.io/api/v0/mempool`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                project_id: this.projectId
            }
        })

        console.log(await response.text())
    }

    /**
     * @param {TxId} id
     * @returns {Promise<TxSummary>}
     */
    async getTx(id) {
        const url = `https://cardano-${this.networkName}.blockfrost.io/api/v0/txs/${id.toHex()}/utxos`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                project_id: this.projectId
            }
        })

        if (!response.ok) {
            throw new Error(`Tx ${id.toString()} not found`)
        } else if (response.status != 200) {
            throw new Error(`Blockfrost error: ${await response.text()}`)
        }

        const responseObj = /** @type {any} */ (await response.json())

        const inputs = responseObj.inputs

        if (!inputs || !Array.isArray(inputs)) {
            console.log(responseObj)
            throw new Error(`unexpected response from Blockfrost`)
        }

        const outputs = responseObj.outputs

        if (!outputs || !Array.isArray(outputs)) {
            console.log(responseObj)
            throw new Error(`unexpected response from Blockfrost`)
        }

        return makeTxSummary({
            id: id,
            timestamp: Date.now(),
            inputs: await Promise.all(
                inputs.map((input) => {
                    return this.restoreTxInput(input)
                })
            ),
            outputs: await Promise.all(
                outputs.map((output) => {
                    return this.restoreTxInput({
                        ...output,
                        tx_hash: id.toHex()
                    })
                })
            )
        })
    }

    /**
     * If the UTxO isn't found an error is throw with the following message format: "UTxO <txId.utxoId> not found".
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        const txId = id.txId

        const url = `https://cardano-${this.networkName}.blockfrost.io/api/v0/txs/${txId.toHex()}/utxos`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                project_id: this.projectId
            }
        })

        if (!response.ok) {
            throw new Error(`UTxO ${id.toString()} not found`)
        } else if (response.status != 200) {
            throw new Error(`Blockfrost error: ${await response.text()}`)
        }

        const responseObj = /** @type {any} */ (await response.json())

        const outputs = responseObj.outputs

        if (!outputs) {
            console.log(responseObj)
            throw new Error(`unexpected response from Blockfrost`)
        }

        const obj = outputs[id.utxoIdx]

        if (!obj) {
            console.log(responseObj)
            throw new Error(`UTxO ${id.toString()} not found`)
        }

        obj["tx_hash"] = txId.toHex()
        obj["output_index"] = Number(id.utxoIdx)

        return await this.restoreTxInput(obj)
    }

    /**
     * Gets a complete list of UTxOs at a given `Address`.
     * Returns oldest UTxOs first, newest last.
     * @param {Address} address
     * @returns {Promise<TxInput[]>}
     */
    async getUtxos(address) {
        /**
         * TODO: pagination
         */

        const url = `https://cardano-${this.networkName}.blockfrost.io/api/v0/addresses/${address.toBech32()}/utxos?order=asc`

        try {
            const response = await fetch(url, {
                headers: {
                    project_id: this.projectId
                }
            })

            if (response.status == 404) {
                return []
            }

            /**
             * @type {any}
             */
            let all = await response.json()

            if (all?.status_code >= 300) {
                all = []
            }

            try {
                return await Promise.all(
                    all.map((obj) => {
                        return this.restoreTxInput(obj)
                    })
                )
            } catch (e) {
                console.error("unable to parse blockfrost utxo format:", all)
                throw e
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
    }

    /**
     * @returns {boolean}
     */
    isMainnet() {
        return this.networkName == "mainnet"
    }

    /**
     * Used by `BlockfrostV0.resolve()`.
     * @param {TxInput} utxo
     * @returns {Promise<boolean>}
     */
    async hasUtxo(utxo) {
        const txId = utxo.id.txId

        const url = `https://cardano-${this.networkName}.blockfrost.io/api/v0/txs/${txId.toHex()}/utxos`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                project_id: this.projectId
            }
        })

        return response.ok
    }

    /**
     * Submits a transaction to the blockchain.
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        const data = new Uint8Array(tx.toCbor())
        const url = `https://cardano-${this.networkName}.blockfrost.io/api/v0/tx/submit`

        const response = await fetch(url, {
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
            return new TxId(JSON.parse(responseText))
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
         * @type {UplcProgramV2I | undefined}
         */
        let refScript = undefined

        if (obj.reference_script_hash !== null) {
            const url = `https://cardano-${this.networkName}.blockfrost.io/api/v0/scripts/${obj.reference_script_hash}/cbor`

            const response = await fetch(url, {
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
                refScript = UplcProgramV2.fromCbor(responseJson.cbor)
            }
        }

        return new TxInput(
            new TxOutputId(TxId.new(obj.tx_hash), obj.output_index),
            new TxOutput(
                Address.fromBech32(obj.address),
                Value.fromBlockfrost(obj.amount),
                obj.inline_datum
                    ? TxOutputDatum.Inline(decodeUplcData(obj.inline_datum))
                    : null,
                refScript
            )
        )
    }
}
