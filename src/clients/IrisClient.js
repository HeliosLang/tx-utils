import { decodeList } from "@helios-lang/cbor"
import { bytesToHex } from "@helios-lang/codec-utils"
import {
    decodeTx,
    decodeTxInput,
    makeAddress,
    makeTxId,
    UtxoAlreadySpentError,
    UtxoNotFoundError
} from "@helios-lang/ledger"

/**
 * @import {
 *   Address,
 *   AssetClass,
 *   NetworkParams,
 *   Tx,
 *   TxId,
 *   TxInput,
 *   TxOutputId
 * } from "@helios-lang/ledger"
 * @import { IrisClient } from "../index.js"
 */

/**
 * @param {string} host
 * @param {boolean} isMainnet
 * @returns {IrisClient}
 */
export function makeIrisClient(host, isMainnet) {
    return new IrisClientImpl(host, isMainnet)
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
     * @private
     * @type {boolean}
     */
    isMainnet_

    /**
     * @param {string} host
     * @param {boolean} isMainnet
     */
    constructor(host, isMainnet) {
        this.host = host
        this.isMainnet_ = isMainnet
    }

    /**
     * @private
     * @type {string}
     */
    get baseURL() {
        return `${this.host}/api`
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
            const url = `${this.baseURL}/parameters`

            const response = await fetch(url, {
                headers: {
                    Accept: "application/json"
                }
            })

            if (!response.ok) {
                throw new Error(
                    `IrisClient error in get parameters: ${response.statusText}`
                )
            } else if (response.status != 200) {
                throw new Error(
                    `IrisClient error in get parameters: ${await response.text()}`
                )
            }

            let str = await response.text()

            return JSON.parse(str)
        })()
    }

    /**
     * @returns {boolean}
     */
    isMainnet() {
        return this.isMainnet_
    }

    /**
     * @param {TxId} id
     * @returns {Promise<boolean>}
     */
    async hasTx(id) {
        const url = `${this.baseURL}/tx/${id.toHex()}`

        const response = await fetch(url, {
            headers: {
                Accept: "application/cbor"
            }
        })

        if (response.status == 404) {
            return false
        } else if (response.status == 200) {
            return true
        } else {
            if (!response.ok) {
                throw new Error(
                    `IrisClient error in hasTx(): ${response.statusText}`
                )
            } else {
                throw new Error(
                    `IrisClient error in hasTx(): ${await response.text()}`
                )
            }
        }
    }

    /**
     * @param {TxId} id
     * @returns {Promise<Tx>}
     */
    async getTx(id) {
        const url = `${this.baseURL}/tx/${id.toHex()}`

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
     * @param {AssetClass} assetClass
     * @returns {Promise<{address: Address, quantity: bigint}[]>}
     */
    async getAddressesWithAssetClass(assetClass) {
        const url = `${this.baseURL}/policy/${assetClass.mph.toHex()}/asset/${bytesToHex(assetClass.tokenName)}/addresses`

        const response = await fetch(url, {
            headers: {
                Accept: "application/json"
            }
        })

        const list = await response.json()

        if (!Array.isArray(list)) {
            throw new Error(
                `expected array response in BlockfrostV0Client.getAddressesWithAssetClass, got '${JSON.stringify(list)}`
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
     * @param {TxOutputId} id
     * @returns {Promise<boolean>}
     */
    async hasUtxo(id) {
        const url = `${this.baseURL}/utxo/${id.txId.toHex()}${id.index.toString()}`

        const response = await fetch(url, {
            headers: {
                Accept: "application/cbor"
            }
        })

        if (response.status == 404 || response.status == 409) {
            return false
        } else if (response.status == 200) {
            return true
        } else {
            if (!response.ok) {
                throw new Error(
                    `IrisClient error in hasUtxo(): ${response.statusText}`
                )
            } else {
                throw new Error(
                    `IrisClient error in hasUtxo(): ${await response.text()}`
                )
            }
        }
    }

    /**
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        const url = `${this.baseURL}/utxo/${id.txId.toHex()}${id.index.toString()}`

        const response = await fetch(url, {
            headers: {
                Accept: "application/cbor"
            }
        })

        if (response.status == 404) {
            throw new UtxoNotFoundError(id)
        } else if (response.status == 409) {
            const rawConsumedBy = response.headers.get("Consumed-By")
            const buffer = await response.arrayBuffer()
            const cbor = Array.from(new Uint8Array(buffer))

            throw new UtxoAlreadySpentError(
                decodeTxInput(cbor),
                rawConsumedBy ? makeTxId(rawConsumedBy) : undefined
            )
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
        const url = `${this.baseURL}/address/${address.toString()}/utxos`

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

        const cbor = Array.from(new Uint8Array(buffer))

        return decodeList(cbor, decodeTxInput)
    }

    /**
     * @param {Address} address
     * @param {AssetClass} assetClass
     * @returns {Promise<TxInput[]>}
     */
    async getUtxosWithAssetClass(address, assetClass) {
        const url = `${this.baseURL}/address/${address.toString()}/utxos?asset=${assetClass.mph.toHex()}${bytesToHex(assetClass.tokenName)}`

        const response = await fetch(url, {
            headers: {
                Accept: "application/cbor"
            }
        })

        if (!response.ok) {
            throw new Error(
                `IrisClient error in getUtxosWithAssetClass(): ${response.statusText}`
            )
        } else if (response.status != 200) {
            throw new Error(
                `IrisClient error in getUtxosWithAssetClass(): ${await response.text()}`
            )
        }

        const buffer = await response.arrayBuffer()

        const cbor = Array.from(new Uint8Array(buffer))

        return decodeList(cbor, decodeTxInput)
    }

    /**
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        const url = `${this.baseURL}/tx`

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/cbor"
            },
            body: new Uint8Array(tx.toCbor()).buffer
        })

        if (!response.ok) {
            throw new Error(
                `IrisClient error in submitTx(): ${response.statusText} ${await response.text()}`
            )
        } else if (response.status != 200) {
            throw new Error(
                `IrisClient error in submitTx(): ${await response.text()}`
            )
        }

        // TODO: get TxId from response?
        return tx.id()
    }
}
