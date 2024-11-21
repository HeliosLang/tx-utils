import { encodeIntBE, equalsBytes } from "@helios-lang/codec-utils"
import {
    makeTxId,
    makeTxInput,
    makeTxOutput,
    makeTxOutputId,
    makeValue
} from "@helios-lang/ledger"

/**
 * @import { Address, Assets, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
 * @import { EmulatorGenesisTx } from "../index.js"
 */

/**
 * @param {number} id
 * @param {Address} address
 * @param {bigint} lovelace
 * @param {Assets} assets
 * @returns {EmulatorGenesisTx}
 */
export function makeEmulatorGenesisTx(id, address, lovelace, assets) {
    return new EmulatorGenesisTxImpl(id, address, lovelace, assets)
}

/**
 * @implements {EmulatorGenesisTx}
 */
class EmulatorGenesisTxImpl {
    /**
     * @private
     * @readonly
     * @type {number}
     */
    _id

    /**
     * @private
     * @readonly
     * @type {Address}
     */
    _address

    /**
     * @private
     * @readonly
     * @type {bigint}
     */
    _lovelace

    /**
     * @private
     * @readonly
     * @type {Assets}
     */
    _assets

    /**
     * @param {number} id
     * @param {Address} address
     * @param {bigint} lovelace
     * @param {Assets} assets
     */
    constructor(id, address, lovelace, assets) {
        this._id = id
        this._address = address
        this._lovelace = lovelace
        this._assets = assets
    }

    /**
     * @type {"Genesis"}
     */
    get kind() {
        return "Genesis"
    }

    /**
     * Simple incremental txId for genesis transactions.
     * It's very unlikely that regular transactions have the same hash.
     * @return {TxId}
     */
    id() {
        let bytes = encodeIntBE(BigInt(this._id))

        if (bytes.length < 32) {
            bytes = new Array(32 - bytes.length).fill(0).concat(bytes)
        }

        return makeTxId(bytes)
    }

    /**
     * @param {TxInput} utxo
     * @returns {boolean}
     */
    consumes(utxo) {
        return false
    }

    /**
     * @param {Address} address
     * @param {TxInput[]} utxos
     * @returns {TxInput[]}
     */
    collectUtxos(address, utxos) {
        if (equalsBytes(this._address.bytes, address.bytes)) {
            utxos = utxos.slice()

            utxos.push(
                makeTxInput(
                    makeTxOutputId(this.id(), 0),
                    makeTxOutput(
                        this._address,
                        makeValue(this._lovelace, this._assets.copy())
                    )
                )
            )

            return utxos
        } else {
            return utxos
        }
    }

    /**
     * @param {TxOutputId} id
     * @returns {TxInput | undefined}
     */
    getUtxo(id) {
        if (!(this.id().isEqual(id.txId) && id.index == 0)) {
            return undefined
        }

        return makeTxInput(
            makeTxOutputId(this.id(), 0),
            makeTxOutput(this._address, makeValue(this._lovelace, this._assets))
        )
    }

    /**
     * @returns {TxInput[]}
     */
    newUtxos() {
        return [
            makeTxInput(
                makeTxOutputId(this.id(), 0),
                makeTxOutput(
                    this._address,
                    makeValue(this._lovelace, this._assets)
                )
            )
        ]
    }

    /**
     * @returns {TxInput[]}
     */
    consumedUtxos() {
        return []
    }

    /**
     * @returns {void}
     */
    dump() {
        console.log("GENESIS TX")
        console.log(
            `id: ${this._id.toString()},\naddress: ${this._address.toString()},\nlovelace: ${this._lovelace.toString()},\nassets: ${JSON.stringify(this._assets.dump(), undefined, "    ")}`
        )
    }
}
