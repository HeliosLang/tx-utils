import { bytesToHex } from "@helios-lang/codec-utils"
import {
    makeAssets,
    makeDatumHash,
    makeHashedTxOutputDatum,
    makeInlineTxOutputDatum,
    makeTxInput,
    makeTxOutput,
    makeValue,
    parseAssetClass,
    parseShelleyAddress,
    parseTxOutputId,
    UtxoNotFoundError
} from "@helios-lang/ledger"
import {
    check,
    expectArray,
    expectDefined,
    expectNumber
} from "@helios-lang/type-utils"
import {
    decodeUplcData,
    decodeUplcProgramV1FromCbor,
    decodeUplcProgramV2FromCbor,
    makeUplcProgramV1
} from "@helios-lang/uplc"

/**
 * @import {
 *   Address,
 *   AssetClass,
 *   NetworkParams,
 *   Tx,
 *   TxId,
 *   TxInput,
 *   TxOutputId,
 *   TxOutputDatum,
 *   Value
 * } from "@helios-lang/ledger"
 * @import { UplcProgramV1, UplcProgramV2 } from "@helios-lang/uplc"
 * @import {
 *   HydraClient,
 *   HydraClientOptions,
 *   HydraPubMessage,
 *   HydraRefScript,
 *   HydraSubMessage,
 *   HydraTxOutput,
 *   WebSocketI,
 *   WebSocketConstructor,
 * } from "../index.js"
 */

const DEFAULT_WS_PORT = 4001
const DEFAULT_HTTP_PORT = 4001
const LOCALHOST = "127.0.0.1"

/** @type {HydraClientOptions} */
const defaultOptions = {
    isForMainnet: false,
    hostname: LOCALHOST,
    httpPort: DEFAULT_HTTP_PORT,
    wsPort: DEFAULT_WS_PORT,
    secure: false
}

/**
 * @param {WebSocketConstructor} ws
 * @param {HydraClientOptions} [options]
 * @returns {HydraClient}
 */
export function makeHydraClient(ws, options = defaultOptions) {
    return new HydraClientImpl(ws, options)
}

/**
 * See: https://hydra.family/head-protocol/api-reference
 * @implements {HydraClient}
 */
class HydraClientImpl {
    /**
     * @private
     * @type {WebSocketConstructor}
     */
    WS

    /**
     * @readonly
     * @type {HydraClientOptions}
     */
    options

    /**
     * @private
     * @type {WebSocketI}
     */
    socket

    // TODO: maintain a snapshot of the UTXO in-memory for faster access, and event-driven abilities
    ///**
    // * @private
    // * @readonly
    // * @type {UTXOSnapshot}
    // */
    //snapshot

    /**
     * A queue that is used during startup only
     * @private
     * @type {HydraPubMessage[]}
     */
    outgoing

    /**
     * @private
     * @type {boolean}
     */
    connected

    /**
     * @private
     * @type {((message: HydraSubMessage) => void)[]}
     */
    asyncListeners

    /**
     * @param {WebSocketConstructor} WS
     * @param {HydraClientOptions} options
     */
    constructor(WS, options) {
        this.WS = WS
        this.options = {
            ...defaultOptions,
            ...options
        }
        this.connected = false
        this.socket = this.initWebSocket()
        this.outgoing = []

        //this.snapshot = makeUTXOSnapshot()

        // TODO: maintain a UTXO snapshot
    }

    /**
     * @private
     * @returns {WebSocketI}
     */
    initWebSocket() {
        if (this.socket) {
            this.connected = false
            console.info("Reconnecting HydraClient websocket...")
        }
        const { hostname, httpPort, wsPort, secure } = this.options
        const connection = new this.WS(
            `${secure ? "wss" : "ws"}://${hostname}:${wsPort}`
        )
        this.socket = connection

        connection.addEventListener("error", this.initWebSocket.bind(this))
        connection.addEventListener("open", (event) => {
            let message = this.outgoing.shift()

            while (message) {
                this.socket.send(JSON.stringify(message))

                message = this.outgoing.shift()
            }

            this.connected = true
        })

        connection.addEventListener("message", (event) => {
            this.receiveMessage(JSON.parse(event.data))
        })
        return connection
    }

    /**
     * @private
     * @type {string}
     */
    get httpBaseUrl() {
        const { hostname, httpPort, secure } = this.options
        return `http${secure ? "s" : ""}://${hostname}:${httpPort}`
    }

    /**
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
            // what about chain slot/time ?

            const response = await fetch(
                `${this.httpBaseUrl}/protocol-parameters`,
                {
                    method: "GET"
                }
            )

            const rawParams = /** @type {HydraProtocolParams} */ (
                await response.json()
            )

            /**
             * @type {NetworkParams}
             */
            const networkParams = {
                txFeeFixed: expectNumber(
                    expectDefined(
                        rawParams.txFeeFixed?.lovelace,
                        "Hydra protocol params: txFeeFixed.lovelace undefined"
                    ),
                    "Hydra protocol params: txFeeFixed.lovelace isn't a number"
                ),
                txFeePerByte: expectNumber(
                    expectDefined(
                        rawParams.txFeePerByte,
                        "Hydra protocol params: txFeePerByte undefined"
                    ),
                    "Hydra protocol params: txFeePerByte isn't a number"
                ),
                exMemFeePerUnit: expectNumber(
                    expectDefined(
                        rawParams.executionUnitPrices?.memory,
                        "Hydra protocol params: executionUnitPrices.memory undefined"
                    ),
                    "Hydra protocol params: executionUnitPrices.memory isn't a number"
                ),
                exCpuFeePerUnit: expectNumber(
                    expectDefined(
                        rawParams.executionUnitPrices?.cpu,
                        "Hydra protocol params: executionUnitPrices.cpu undefined"
                    ),
                    "Hydra protocol params: executionUnitPrices.cpu isn't a number"
                ),
                utxoDepositPerByte: expectNumber(
                    expectDefined(
                        rawParams.utxoCostPerByte,
                        "Hydra protocol params: utxoCostPerByte undefined"
                    ),
                    "Hydra protocol params: utxoCostPerByte isn't a number"
                ),
                refScriptsFeePerByte: 0, // has Hydra been updated to also work with this parameter?
                collateralPercentage: expectNumber(
                    expectDefined(
                        rawParams.collateralPercentage,
                        "Hydra protocol params: collateralPercentage undefined"
                    ),
                    "Hydra protocol params: collateralPercentage isn't a number"
                ),
                maxCollateralInputs: expectNumber(
                    expectDefined(
                        rawParams.maxCollateralInputs,
                        "Hydra protocol params: maxCollateralInputs undefined"
                    ),
                    "Hydra protocol params: maxCollateralInputs isn't a number"
                ),
                maxTxExMem: expectNumber(
                    expectDefined(
                        rawParams.maxTxExecutionUnits?.memory,
                        "Hydra protocol params: maxTxExecutionUnits.memory undefined"
                    ),
                    "Hydra protocol params: maxTxExecutionUnits.memory isn't a number"
                ),
                maxTxExCpu: expectNumber(
                    expectDefined(
                        rawParams.maxTxExecutionUnits?.cpu,
                        "Hydra protocol params: maxTxExecutionUnits.cpu undefined"
                    ),
                    "Hydra protocol params: maxTxExecutionUnits.cpu isn't a number"
                ),
                maxTxSize: expectNumber(
                    expectDefined(
                        rawParams.maxTxSize,
                        "Hydra protocol params: maxTxSize undefined"
                    ),
                    "Hydra protocol params: maxTxSize isn't a number"
                ),
                secondsPerSlot: 1, // can we get this information from Hydra?
                stakeAddrDeposit: expectNumber(
                    expectDefined(
                        rawParams.stakeAddressDeposit?.lovelace,
                        "Hydra protocol params: stakeAddressDeposit.lovelace undefined"
                    ),
                    "Hydra protocol params: stakeAddressDeposit.lovelace isn't a number"
                ),
                refTipSlot: 0,
                refTipTime: 0,
                costModelParamsV1: expectArray(check(expectNumber))(
                    expectDefined(
                        rawParams.costModels?.PlutusV1,
                        "Hydra protocol params: costModels.PlutusV1 undefined"
                    ),
                    "Hydra protocol params: costModels.PlutusV1 isn't a number array"
                ),
                costModelParamsV2: expectArray(check(expectNumber))(
                    expectDefined(
                        rawParams.costModels?.PlutusV2,
                        "Hydra protocol params: costModels.PlutusV1 undefined"
                    ),
                    "Hydra protocol params: costModels.PlutusV1 isn't a number array"
                ),
                costModelParamsV3: expectArray(check(expectNumber))(
                    expectDefined(
                        rawParams.costModels?.PlutusV3,
                        "Hydra protocol params: costModels.PlutusV1 undefined"
                    ),
                    "Hydra protocol params: costModels.PlutusV1 isn't a number array"
                )
            }

            return networkParams
        })()
    }

    /**
     * @param {HydraPubMessage} message
     * @returns {void}
     */
    sendMessage(message) {
        if (this.connected) {
            this.socket.send(JSON.stringify(message))
        } else {
            this.outgoing.push(message)
        }
    }

    /**
     * @private
     * @param {HydraSubMessage} message
     * @returns {void}
     */
    receiveMessage(message) {
        if (this.options.onReceive) {
            this.options.onReceive(message)
        }
        if (this.asyncListeners.length > 0) {
            this.asyncListeners.forEach((listener) => {
                listener(message)
            })
        }
    }

    /**
     * @private
     * @returns {Promise<TxInput[]>}
     */
    async fetchUTXOs() {
        const url = `${this.httpBaseUrl}/snapshot/utxo`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        })

        const obj = await response.json()

        return convertHydraTxOutputsToTxInputs(/** @type {any} */ (obj))
    }

    /**
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        const allUtxos = await this.fetchUTXOs()

        const utxo = allUtxos.find((utxo) => utxo.id.isEqual(id))

        if (!utxo) {
            throw new UtxoNotFoundError(id)
        }

        return utxo
    }

    /**
     * @param {TxOutputId} id
     * @returns {Promise<boolean>}
     */
    async hasUtxo(id) {
        const allUtxos = await this.fetchUTXOs()

        return allUtxos.some((utxo) => utxo.id.isEqual(id))
    }

    /**
     * @returns {boolean}
     */
    isMainnet() {
        return !!this.options.isForMainnet
    }

    /**
     * @param {Address} addr
     * @returns {Promise<TxInput[]>}
     */
    async getUtxos(addr) {
        const allUtxos = await this.fetchUTXOs()

        return allUtxos.filter((utxo) => utxo.address.isEqual(addr))
    }

    /**
     * @param {Tx} tx
     * @param {string} [description]
     * The description can be used to pass simple messages
     * Defaults to "Submitted through Helios HydraClient"
     *
     * @returns {Promise<TxId>}
     */
    async submitTx(tx, description = "Submitted through Helios HydraClient") {
        const txId = tx.id()

        // TODO: how to await?
        let resolve, reject
        const promise = new Promise((res, rej) => {
            resolve = res
            reject = rej
        })
        /**
         * @param {HydraSubMessage} event
         */
        const listener = (event) => {
            console.log(
                "seeking matched event for txId: " + txId.toHex(),
                event
            )

            // if (...matches) {
            // i.e. TxValid, TxInvalid, CommandFailed?
            // probably not PostTxOnChainFailed - looks like an error about main-chain txs
            //       ... do the right thing
            //  call resolve(txId) or reject()
            //      cleanup()
            //   }
        }

        this.asyncListeners.push(listener)
        const cleanup = () => {
            this.asyncListeners = this.asyncListeners.filter(
                (l) => l !== listener
            )
        }

        this.sendMessage({
            tag: "NewTx",
            transaction: {
                type: "Tx ConwayEra",
                cborHex: bytesToHex(tx.toCbor()),
                description: description,
                txId: txId.toHex()
            }
        })
        return promise
    }
}

/**
 * TODO: deserialize on-demand instead of all at once
 * @param {Record<string, HydraTxOutput>} obj
 * @returns {TxInput[]}
 */
function convertHydraTxOutputsToTxInputs(obj) {
    /**
     * @type {TxInput[]}
     */
    const utxos = []

    for (let key in obj) {
        utxos.push(convertHydraTxOutputToTxInput(key, obj[key]))
    }

    return utxos
}

/**
 * @param {string} id
 * @param {HydraTxOutput} output
 * @returns {TxInput}
 */
function convertHydraTxOutputToTxInput(id, output) {
    /**
     * @type {TxOutputDatum | undefined}
     */
    const datum = output.datumHash
        ? makeHashedTxOutputDatum(makeDatumHash(output.datumHash))
        : output.inlineDatumRaw
          ? makeInlineTxOutputDatum(decodeUplcData(output.inlineDatumRaw))
          : output.datum
            ? makeInlineTxOutputDatum(decodeUplcData(output.datum))
            : undefined

    /**
     * @type {UplcProgramV1 | UplcProgramV2 | undefined}
     */
    const refScript = output.referenceScript
        ? /** @param {HydraRefScript} referenceScript */ ((referenceScript) => {
              switch (referenceScript.script.type) {
                  case "PlutusScriptV1":
                      return decodeUplcProgramV1FromCbor(
                          output.referenceScript.script.cborHex
                      )
                  case "PlutusScriptV2":
                      return decodeUplcProgramV2FromCbor(
                          output.referenceScript.script.cborHex
                      )
                  default:
                      throw new Error(
                          `unhandled reference script type ${referenceScript.script.type}`
                      )
              }
          })(output.referenceScript)
        : undefined

    return makeTxInput(
        parseTxOutputId(id),
        makeTxOutput(
            parseShelleyAddress(output.address),
            convertHydraValueToValue(output.value),
            datum,
            refScript
        )
    )
}

/**
 * @param {HydraTxOutput["value"]} rawValue
 * @returns {Value}
 */
function convertHydraValueToValue(rawValue) {
    const lovelace = BigInt(rawValue.lovelace)

    /**
     * @type {[AssetClass, bigint][]}
     */
    const assets = []

    for (let key in rawValue) {
        if (key == "lovelace") {
            continue
        }

        const ac = parseAssetClass(key)
        const qty = BigInt(rawValue[key])
        assets.push([ac, qty])
    }

    return makeValue(lovelace, makeAssets(assets))
}

/**
 * @typedef {number} LargeInt
 */

/**
 * What is `Restricted Any`??
 * @typedef {{lovelace: number}} RestrictedAnyLovelace
 * @typedef {{memory: number, cpu: number}} RestrictedAnyCost
 */

/**
 * Not used externally (immediately converted to NetworkParams)
 * @typedef {{
 *   protocolVersion: {
 *     major: number
 *     minor: number
 *     patch?: number
 *   }
 *   maxBlockBodySize: number
 *   maxBlockHeaderSize: number
 *   maxTxSize: number
 *   txFeeFixed: RestrictedAnyLovelace
 *   txFeePerByte: LargeInt
 *   stakeAddressDeposit: RestrictedAnyLovelace
 *   stakePoolDeposit: RestrictedAnyLovelace
 *   minPoolCost: RestrictedAnyLovelace
 *   poolRetireMaxEpoch: LargeInt
 *   stakePoolTargetNum: number
 *   poolPledeInfluence: number
 *   monetaryExpansion: number
 *   treasuryCut: number
 *   costModels: {
 *     PlutusV1: number[]
 *     PlutusV2: number[]
 *     PlutusV3: number[]
 *   }
 *   executionUnitPrices: RestrictedAnyCost
 *   maxTxExecutionUnits: RestrictedAnyCost
 *   maxBlockExecutionUnits: RestrictedAnyCost
 *   maxValueSize: number
 *   collateralPercentage: number
 *   maxCollateralInputs: number
 *   utxoCostPerByte: RestrictedAnyLovelace
 * }} HydraProtocolParams
 */
