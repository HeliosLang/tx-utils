import {
    decodeBool,
    decodeBytes,
    decodeInt,
    decodeMap,
    decodeString,
    decodeTuple,
    encodeBool,
    encodeBytes,
    encodeInt,
    encodeMap,
    encodeString,
    encodeTuple,
    isBytes,
    isInt
} from "@helios-lang/cbor"
import { toBytes } from "@helios-lang/codec-utils"
import { makeSignature } from "@helios-lang/ledger"
import { decodeShelleyAddress } from "@helios-lang/ledger"

/**
 * @import { BytesLike } from "@helios-lang/codec-utils"
 * @import { PubKey, PubKeyHash, ShelleyAddress } from "@helios-lang/ledger"
 * @import { Bip32PrivateKey, Cip30CoseSign1 } from "../index.js"
 */

/**
 * @param {ShelleyAddress<PubKeyHash>} address
 * @param {BytesLike} payload
 * @param {BytesLike} bytes
 * @returns {Cip30CoseSign1}
 */
export function makeCip30CoseSign1(address, payload, bytes) {
    return new Cip30CoseSign1Impl(address, toBytes(payload), toBytes(bytes))
}

/**
 * Low-level signing method for creating a valid Cip30CoseSign1 data-structure
 * Doesn't check that the address actually corresponds to the given privateKey
 * @param {ShelleyAddress<PubKeyHash>} address
 * @param {Bip32PrivateKey} privateKey
 * @param {BytesLike} payload
 * @returns {Cip30CoseSign1}
 */
export function signCip30CoseData(address, privateKey, payload) {
    const payloadBytes = toBytes(payload)

    const wrappedPayload = wrapPayloadForSigning(address, payloadBytes)

    const signature = privateKey.sign(wrappedPayload)

    return new Cip30CoseSign1Impl(address, payloadBytes, signature.bytes)
}

/**
 * @param {BytesLike} bytes
 * @returns {Cip30CoseSign1}
 */
export function decodeCip30CoseSign1(bytes) {
    const [protectedHeaderBytes, _unprotectedHeader, payload, signatureBytes] =
        decodeTuple(bytes, [
            decodeBytes,
            (bytes) => decodeMap(bytes, decodeString, decodeBool),
            decodeBytes,
            decodeBytes
        ])

    const protectedHeader = Object.fromEntries(
        decodeMap(
            protectedHeaderBytes,
            (bytes) => {
                if (isInt(bytes)) {
                    return decodeInt(bytes).toString()
                } else {
                    return decodeString(bytes)
                }
            },
            (bytes) => {
                if (isInt(bytes)) {
                    return decodeInt(bytes)
                } else {
                    return decodeBytes(bytes)
                }
            }
        )
    )

    const alg = protectedHeader["1"]

    if (alg === undefined) {
        throw new Error(
            "invalid Cip30 COSE Sign1 header: alg not set (i.e. field 1 not set)"
        )
    }

    if (alg != -8n) {
        throw new Error(
            `invalid Cip30 COSE Sign1 header: alg not set to EdDSA (i.e. field 1 not set to -8), got ${alg}`
        )
    }

    const addressBytes = protectedHeader["address"]

    if (addressBytes === undefined) {
        throw new Error("invalid Cip30 COSE Sign1 header: address not set")
    }

    if (!Array.isArray(addressBytes)) {
        throw new Error(
            "invalid Cip30 COSE Sign1 header: invalid address format"
        )
    }

    const address = decodeShelleyAddress(addressBytes)

    if (address.spendingCredential.kind != "PubKeyHash") {
        throw new Error(
            "invalid Cip30 COSE Sign1 header address: not a PubKeyHash address"
        )
    }

    return new Cip30CoseSign1Impl(
        /** @type {ShelleyAddress<PubKeyHash>} */ (address),
        payload,
        signatureBytes
    )
}

/**
 * @implements {Cip30CoseSign1}
 */
class Cip30CoseSign1Impl {
    /**
     * @readonly
     * @type {ShelleyAddress<PubKeyHash>}
     */
    address

    /**
     * @readonly
     * @type {number[]}
     */
    payload

    /**
     * @readonly
     * @type {number[]}
     */
    bytes

    /**
     * @param {ShelleyAddress<PubKeyHash>} address
     * @param {number[]} payload
     * @param {number[]} bytes
     */
    constructor(address, payload, bytes) {
        this.address = address
        this.payload = payload
        this.bytes = bytes
    }

    /**
     * @returns {number[]}
     */
    toCbor() {
        const protectedHeader = encodeProtectedHeader(this.address)

        const unprotectedHeader = encodeMap([
            [encodeString("hashed"), encodeBool(false)]
        ])

        return encodeTuple([
            encodeBytes(protectedHeader),
            unprotectedHeader,
            encodeBytes(this.payload),
            encodeBytes(this.bytes)
        ])
    }

    /**
     * Throws an error if the signature is wrong
     * @param {PubKey} pubKey
     * @returns {void}
     */
    verify(pubKey) {
        const signature = makeSignature(pubKey, this.bytes)
        const wrappedPayload = wrapPayloadForSigning(this.address, this.payload)

        signature.verify(wrappedPayload)
    }
}

/**
 * @param {ShelleyAddress<PubKeyHash>} address
 * @returns {number[]}
 */
function encodeProtectedHeader(address) {
    return encodeMap([
        [encodeInt(1), encodeInt(-8)],
        [encodeString("address"), encodeBytes(address.bytes)]
    ])
}

/**
 * @param {ShelleyAddress<PubKeyHash>} address
 * @param {number[]} payload
 * @returns {number[]}
 */
function wrapPayloadForSigning(address, payload) {
    return encodeTuple([
        encodeString("Signature1"),
        encodeBytes(encodeProtectedHeader(address)),
        encodeBytes([]), // this is the external_aad field in the CIP-8 spec and in RFC-8152. According to CIP-30 this is empty
        encodeBytes(payload)
    ])
}
