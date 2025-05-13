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
    decodeUplcData,
    decodeUplcProgramV1FromCbor,
    decodeUplcProgramV2FromCbor,
    makeUplcProgramV1
} from "@helios-lang/uplc"

/**
 * @import { Address, AssetClass, Tx, TxId, TxInput, TxOutputId, TxOutputDatum, Value } from "@helios-lang/ledger"
 * @import { JsonSafe } from "@helios-lang/type-utils"
 * @import { UplcProgramV1, UplcProgramV2 } from "@helios-lang/uplc"
 * @import {
 *   HydraClient,
 *   HydraClientOptions,
 *   HydraPubMessage,
 *   HydraRefScript,
 *   HydraSubMessage,
 *   HydraTxOutput,
 *   WebSocketI,
 *   WebSocketConstructor
 * } from "../index.js"
 */

const DEFAULT_WS_PORT = 4001
const DEFAULT_HTTP_PORT = 4001
const LOCALHOST = "127.0.0.1"

/**
 * @param {WebSocketConstructor} ws
 * @param {HydraClientOptions} options
 * @returns {HydraClient}
 */
export function makeHydraClient(ws, options = {}) {
    return new HydraClientImpl(ws, options)
}

/**
 * See: https://hydra.family/head-protocol/api-reference
 * @implements {HydraClient}
 */
class HydraClientImpl {
    /**
     * @private
     * @readonly
     * @type {WebSocketI}
     */
    socket

    /**
     * @readonly
     * @type {HydraClientOptions}
     */
    options

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
     * @param {WebSocketConstructor} WS
     * @param {HydraClientOptions} [options]
     */
    constructor(WS, options = {}) {
        this.socket = new WS(`ws://${LOCALHOST}:${DEFAULT_WS_PORT}`)
        this.options = options
        this.connected = false
        this.outgoing = []

        //this.snapshot = makeUTXOSnapshot()

        // TODO: connection persistence
        this.socket.addEventListener("open", (event) => {
            let message = this.outgoing.shift()

            while (message) {
                this.socket.send(JSON.stringify(message))

                message = this.outgoing.shift()
            }

            this.connected = true
        })

        this.socket.addEventListener("message", (event) => {
            this.receiveMessage(JSON.parse(event.data))
        })

        // TODO: maintain a UTXO snapshot
    }

    /**
     * @type {number}
     */
    get now() {
        return Date.now()
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
    }

    /**
     * @private
     * @returns {Promise<TxInput[]>}
     */
    async fetchUTXOs() {
        const url = `http://${LOCALHOST}:${DEFAULT_HTTP_PORT}/snapshot/utxo`

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
        this.sendMessage({
            tag: "NewTx",
            transaction: {
                type: "Tx ConwayEra",
                cborHex: bytesToHex(tx.toCbor()),
                description: description,
                txId: txId.toHex()
            }
        })

        return txId
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
