import {
    DEFAULT_NETWORK_PARAMS,
    Address,
    Tx,
    TxId,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { expectSome } from "@helios-lang/type-utils"
import { UplcProgramV2, decodeUplcData } from "@helios-lang/uplc"

/**
 * @typedef {import("@helios-lang/ledger").NetworkParams} NetworkParams
 * @typedef {import("@helios-lang/uplc").CostModelParamsV1} CostModelParamsV1
 * @typedef {import("@helios-lang/uplc").CostModelParamsV2} CostModelParamsV2
 * @typedef {import("./Network.js").Network} Network
 * @typedef {import("./Network.js").NetworkName} NetworkName
 */

/**
 * The minimum wallet interface with which we can resolve which network is being used
 * Don't require full wallet interface, that way we can keep the network directory more decoupled from the wallets directory
 * @typedef {{
 *     utxos: Promise<TxInput[]>
 *     isMainnet: () => Promise<boolean>
 * }} ResolveableWallet
 */

/**
 * @typedef {{
 *   collateral_percent: number
 *   cost_models: {
 *       PlutusV1: CostModelParamsV1
 *       PlutusV2: CostModelParamsV2
 *   }
 *   price_mem: number
 *   price_step: number
 *   max_block_size: number
 *   max_block_ex_mem: string
 *   max_block_ex_steps: string
 *   max_block_header_size: number
 *   max_collateral_inputs: number
 *   max_tx_ex_mem: string
 *   max_tx_ex_steps: string
 *   max_tx_size: string
 *   max_val_size: string
 *   min_pool_cost: string
 *   rho: number
 *   a0: number
 *   e_max: number
 *   protocol_major_ver: number
 *   protocol_minor_ver: number
 *   key_deposit: string
 *   pool_deposit: string
 *   n_opt: number
 *   tau: number
 *   min_fee_b: number
 *   min_fee_a: number
 *   coins_per_utxo_size: string
 * }} BlockfrostParamsResponse
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
 * Blockfrost specific implementation of `Network`.
 * @implements {Network}
 */
export class BlockfrostV0 {
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
     * Connects to the same network a given `Wallet` or the given `TxInput` (preview, preprod or mainnet).
     *
     * Throws an error if a Blockfrost project_id is missing for that specific network.
     * @param {TxInput | ResolveableWallet} utxoOrWallet
     * @param {{
     *     preview?: string,
     *     preprod?: string,
     *     mainnet?: string
     * }} projectIds
     * @returns {Promise<BlockfrostV0>}
     */
    static async resolve(utxoOrWallet, projectIds) {
        if (utxoOrWallet instanceof TxInput) {
            return BlockfrostV0.resolveWithUtxo(utxoOrWallet, projectIds)
        } else {
            return BlockfrostV0.resolveWithWallet(utxoOrWallet, projectIds)
        }
    }

    /**
     * Throws an error if a Blockfrost project_id is missing for that specific network.
     * @private
     * @param {TxInput} refUtxo
     * @param {{
     *     preview?: string,
     *     preprod?: string,
     *     mainnet?: string
     * }} projectIds
     * @returns {Promise<BlockfrostV0>}
     */
    static async resolveWithUtxo(refUtxo, projectIds) {
        const mainnetProjectId = projectIds["mainnet"]
        const preprodProjectId = projectIds["preprod"]
        const previewProjectId = projectIds["preview"]

        if (preprodProjectId !== undefined) {
            const preprodNetwork = new BlockfrostV0("preprod", preprodProjectId)

            if (await preprodNetwork.hasUtxo(refUtxo)) {
                return preprodNetwork
            }
        }

        if (previewProjectId !== undefined) {
            const previewNetwork = new BlockfrostV0("preview", previewProjectId)

            if (await previewNetwork.hasUtxo(refUtxo)) {
                return previewNetwork
            }
        }

        if (mainnetProjectId !== undefined) {
            const mainnetNetwork = new BlockfrostV0("mainnet", mainnetProjectId)

            if (await mainnetNetwork.hasUtxo(refUtxo)) {
                return mainnetNetwork
            }
        }

        throw new Error(
            "refUtxo not found on a network for which you have a project id"
        )
    }

    /**
     * Connects to the same network a given `Wallet` is connected to (preview, preprod or mainnet).
     *
     * Throws an error if a Blockfrost project_id is missing for that specific network.
     * @private
     * @param {ResolveableWallet} wallet
     * @param {{
     *     preview?: string,
     *     preprod?: string,
     *     mainnet?: string
     * }} projectIds
     * @returns {Promise<BlockfrostV0>}
     */
    static async resolveWithWallet(wallet, projectIds) {
        if (await wallet.isMainnet()) {
            return new BlockfrostV0(
                "mainnet",
                expectSome(projectIds["mainnet"])
            )
        } else {
            const refUtxo = (await wallet.utxos)[0]

            if (!refUtxo) {
                throw new Error(
                    "empty wallet, can't determine which testnet you are connecting to"
                )
            } else {
                return BlockfrostV0.resolveWithUtxo(refUtxo, projectIds)
            }
        }
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
             * @type {NetworkParams}
             */
            const params = {
                shelleyGenesis: DEFAULT_NETWORK_PARAMS.shelleyGenesis,
                alonzoGenesis: DEFAULT_NETWORK_PARAMS.alonzoGenesis,
                latestParams: {
                    collateralPercentage: bfParams.collateral_percent,
                    costModels: {
                        PlutusScriptV1: bfParams.cost_models.PlutusV1,
                        PlutusScriptV2: bfParams.cost_models.PlutusV2
                    },
                    executionUnitPrices: {
                        priceMemory: bfParams.price_mem,
                        priceSteps: bfParams.price_step
                    },
                    maxBlockBodySize: bfParams.max_block_size,
                    maxBlockExecutionUnits: {
                        memory: parseInt(bfParams.max_block_ex_mem),
                        steps: parseInt(bfParams.max_block_ex_steps)
                    },
                    maxBlockHeaderSize: bfParams.max_block_header_size,
                    maxCollateralInputs: bfParams.max_collateral_inputs,
                    maxTxExecutionUnits: {
                        memory: parseInt(bfParams.max_tx_ex_mem),
                        steps: parseInt(bfParams.max_tx_ex_steps)
                    },
                    maxTxSize: parseInt(bfParams.max_tx_size),
                    maxValueSize: parseInt(bfParams.max_val_size),
                    minPoolCost: parseInt(bfParams.min_pool_cost),
                    monetaryExpansion: bfParams.rho,
                    poolPledgeInfluence: bfParams.a0,
                    poolRetireMaxEpoch: bfParams.e_max,
                    protocolVersion: {
                        major: bfParams.protocol_major_ver,
                        minor: bfParams.protocol_minor_ver
                    },
                    stakeAddressDeposit: parseInt(bfParams.key_deposit),
                    stakePoolDeposit: parseInt(bfParams.pool_deposit),
                    stakePoolTargetNum: bfParams.n_opt,
                    treasuryCut: bfParams.tau,
                    txFeeFixed: bfParams.min_fee_b,
                    txFeePerByte: bfParams.min_fee_a,
                    utxoCostPerByte: parseInt(bfParams.coins_per_utxo_size)
                },
                latestTip: {
                    epoch: bfTip.epoch,
                    hash: bfTip.hash,
                    slot: bfTip.slot,
                    time: bfTip.time * 1000
                }
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
         * @type {Option<UplcProgramV2>}
         */
        let refScript = null

        if (obj.reference_script_hash !== null) {
            const url = `https://cardano-${this.networkName}.blockfrost.io/api/v0/scripts/${obj.reference_script_hash}/cbor`

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    project_id: this.projectId
                }
            })

            const cbor = /** @type {any} */ (await response.json()).cbor

            refScript = UplcProgramV2.fromCbor(cbor)
        }

        return new TxInput(
            new TxOutputId(TxId.fromAlike(obj.tx_hash), obj.output_index),
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
