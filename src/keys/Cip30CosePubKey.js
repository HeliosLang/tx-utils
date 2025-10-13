import {
    decodeBytes,
    decodeInt,
    decodeObjectIKey,
    encodeInt,
    encodeObjectIKey
} from "@helios-lang/cbor"
import { decodePubKey } from "@helios-lang/ledger"

/**
 * @import { BytesLike } from "@helios-lang/codec-utils"
 * @import { PubKey } from "@helios-lang/ledger"
 */

/**
 * TODO: verify kid (i.e. field 2) (kid isn't returned by Eternl, so perhaps it isn't that important)
 * @param {BytesLike} bytes
 * @returns {PubKey}
 */
export function decodeCip30CosePubKey(bytes) {
    const {
        1: kty,
        3: alg,
        [-1]: crv,
        [-2]: pubKey
    } = decodeObjectIKey(bytes, {
        1: decodeInt,
        2: decodeBytes, // `kid`, ignored for now
        3: decodeInt,
        [-1]: decodeInt,
        [-2]: decodePubKey
    })

    if (kty === undefined) {
        throw new Error(
            "invalid Cip30 COSE PubKey: kty not set (i.e. field 1 not set)"
        )
    }

    if (kty != 1n) {
        throw new Error(
            `invalid Cip30 COSE PubKey: kty not set to OKP (i.e. field 1 not set to 1), got ${kty}`
        )
    }

    if (alg === undefined) {
        throw new Error(
            "invalid Cip30 COSE PubKey: alg not set (i.e. field 3 not set)"
        )
    }

    if (alg != -8n) {
        throw new Error(
            `invalid Cip30 COSE PubKey: alg not set to EdDSA (i.e. field 3 not set to -8), got ${alg}`
        )
    }

    if (crv === undefined) {
        throw new Error(
            "invalid Cip30 COSE PubKey: crv not set (i.e. field -1 not set)"
        )
    }

    if (crv != 6n) {
        throw new Error(
            `invalid Cip30 COSE PubKey: crv not set to Ed25519 (i.e. field -1 not set to 6), got ${crv}`
        )
    }

    if (!pubKey) {
        throw new Error(
            "invalid Cip30 COSE PubKey: pubKey field noet set (i.e. field -2 not set)"
        )
    }

    return pubKey
}

/**
 * @param {PubKey} pubKey
 * @returns {number[]}
 */
export function encodeCip30CosePubKey(pubKey) {
    return encodeObjectIKey({
        1: encodeInt(1),
        3: encodeInt(-8),
        [-1]: encodeInt(6),
        [-2]: pubKey.toCbor()
    })
}
