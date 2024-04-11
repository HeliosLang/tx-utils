import { encodeIntBE, equalsBytes } from "@helios-lang/codec-utils"
import {
    Address,
    Assets,
    TxId,
    TxInput,
    TxOutput,
    TxOutputId,
    Value
} from "@helios-lang/ledger"

/**
 * @typedef {import("./EmulatorTx.js").EmulatorTx} EmulatorTx
 */

/**
 * @implements {EmulatorTx}
 */
export class GenesisTx {
    #id
    #address
    #lovelace
    #assets

    /**
     * @param {number} id
     * @param {Address} address
     * @param {bigint} lovelace
     * @param {Assets} assets
     */
    constructor(id, address, lovelace, assets) {
        this.#id = id
        this.#address = address
        this.#lovelace = lovelace
        this.#assets = assets
    }

    /**
     * Simple incremental txId for genesis transactions.
     * It's very unlikely that regular transactions have the same hash.
     * @return {TxId}
     */
    id() {
        let bytes = encodeIntBE(BigInt(this.#id))

        if (bytes.length < 32) {
            bytes = new Array(32 - bytes.length).fill(0).concat(bytes)
        }

        return new TxId(bytes)
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
        if (equalsBytes(this.#address.bytes, address.bytes)) {
            utxos = utxos.slice()

            utxos.push(
                new TxInput(
                    new TxOutputId(this.id(), 0),
                    new TxOutput(
                        this.#address,
                        new Value(this.#lovelace, this.#assets.copy())
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
     * @returns {null | TxInput}
     */
    getUtxo(id) {
        if (!(this.id().isEqual(id.txId) && id.utxoIdx == 0)) {
            return null
        }

        return new TxInput(
            new TxOutputId(this.id(), 0),
            new TxOutput(this.#address, new Value(this.#lovelace, this.#assets))
        )
    }

    dump() {
        console.log("GENESIS TX")
        console.log(
            `id: ${this.#id.toString()},\naddress: ${this.#address.toBech32()},\nlovelace: ${this.#lovelace.toString()},\nassets: ${JSON.stringify(this.#assets.dump(), undefined, "    ")}`
        )
    }
}
