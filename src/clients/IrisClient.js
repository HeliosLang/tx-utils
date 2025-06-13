import { decodeTx, decodeTxInput, UtxoNotFoundError } from "@helios-lang/ledger"

/**
 * @import {
 *   Address,
 *   Tx,
 *   TxId,
 *   TxInput,
 *   TxOutputId
 * } from "@helios-lang/ledger"
 * @import { IrisClient } from "../index.js"
 */

/**
 * @param {string} host
 * @returns {IrisClient}
 */
export function makeIrisClient(host) {
    return new IrisClientImpl(host)
}

/**
 * @implements {IrisClient}
 */
class IrisClientImpl {
    /**
     * @readonly
     * @type {string}
     */
    host

    /**
     * @param {string} host
     */
    constructor(host) {
        this.host = host
    }

    /**
     * @type {number}
     */
    get now() {
        return Date.now()
    }

    /**
     * @param {TxId} id
     * @returns {Promise<Tx>}
     */
    async getTx(id) {
        const url = `${this.host}/tx/${id.toHex()}`
        const response = await fetch(url, {
            headers: {
                Accept: "application/cbor"
            }
        })

        if (response.status == 404) {
            throw new Error(`Tx ${id.toHex()} not found`)
        } else if (!response.ok) {
            throw new Error(
                `IrisClient error in getTx(): ${response.statusText}`
            )
        } else if (response.status != 200) {
            throw new Error(
                `IrisClient error in getTx(): ${await response.text()}`
            )
        }

        const buffer = await response.arrayBuffer()

        const cbor = Array.from(new Uint8Array(buffer))

        const tx = decodeTx(cbor)

        if (!tx.id().isEqual(id)) {
            throw new Error("Tx serialization mismatch")
        }

        return tx
    }

    /**
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        const url = `${this.host}/tx/${id.txId.toHex()}/utxo/${id.index.toString()}`

        const response = await fetch(url, {
            headers: {
                Accept: "application/cbor"
            }
        })

        if (response.status == 404) {
            throw new UtxoNotFoundError(id)
        } else if (!response.ok) {
            throw new Error(
                `IrisClient error in getUtxo(): ${response.statusText}`
            )
        } else if (response.status != 200) {
            throw new Error(
                `IrisClient error in getUtxo(): ${await response.text()}`
            )
        }

        const buffer = await response.arrayBuffer()

        const cbor = Array.from(new Uint8Array(buffer))

        return decodeTxInput(cbor)
    }

    /**
     * @param {Address} address
     * @returns {Promise<TxInput[]>}
     */
    async getUtxos(address) {
        const url = `${this.host}/address/${address.toString()}/utxos`

        const response = await fetch(url, {
            headers: {
                Accept: "application/cbor"
            }
        })

        if (!response.ok) {
            throw new Error(
                `IrisClient error in getUtxos(): ${response.statusText}`
            )
        } else if (response.status != 200) {
            throw new Error(
                `IrisClient error in getUtxos(): ${await response.text()}`
            )
        }

        const buffer = await response.arrayBuffer()

        const _cbor = Array.from(new Uint8Array(buffer))

        throw new Error(
            "decoding of Iris address utxo cbor format not yet implemented"
        )
    }
}
