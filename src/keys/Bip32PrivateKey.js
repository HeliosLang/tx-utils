import {
    decodeIntLE,
    encodeIntBE,
    encodeIntLE32
} from "@helios-lang/codec-utils"
import {
    Ed25519,
    generateBytes,
    hmacSha2_512,
    pbkdf2,
    rand
} from "@helios-lang/crypto"
import { PubKey, Signature } from "@helios-lang/ledger"

/**
 * @import { NumberGenerator } from "@helios-lang/crypto"
 * @import { Bip32PrivateKey } from "src/index.js"
 */

/**
 * Used during `Bip32PrivateKey` derivation, to create a new `Bip32PrivateKey` instance with a non-publicly deriveable `PubKey`.
 */
export const BIP32_HARDEN = 0x80000000

/**
 * @param {number[]} bytes
 * @returns {Bip32PrivateKey}
 */
export function makeBip32PrivateKey(bytes) {
    return new Bip32PrivateKeyImpl(bytes)
}

/**
 * Generate a Bip32PrivateKey from a random number generator.
 * This is not cryptographically secure, only use this for testing purpose
 * @param {NumberGenerator} random
 * @returns {Bip32PrivateKey}
 */
export function makeRandomBip32PrivateKey(
    random = rand(Math.random() * Number.MAX_SAFE_INTEGER)
) {
    const bytes = generateBytes(random, 96)

    return new Bip32PrivateKeyImpl(bytes)
}

/**
 * @param {number[]} entropy
 * @param {boolean} force
 * @returns {Bip32PrivateKey}
 */
export function makeBip32PrivateKeyWithBip39Entropy(entropy, force = true) {
    const bytes = pbkdf2(hmacSha2_512, [], entropy, 4096, 96)

    const kl = bytes.slice(0, 32)
    const kr = bytes.slice(32, 64)

    if (!force) {
        if ((kl[31] & 0b00100000) != 0) {
            throw new Error("invalid root secret")
        }
    }

    kl[0] &= 0b11111000
    kl[31] &= 0b00011111
    kl[31] |= 0b01000000

    const c = bytes.slice(64, 96)

    return new Bip32PrivateKeyImpl(kl.concat(kr).concat(c))
}

/**
 * Ed25519-Bip32 extendable `PrivateKey`.
 * @implements {Bip32PrivateKey}
 */
class Bip32PrivateKeyImpl {
    /**
     * 96 bytes
     * @type {number[]}
     */
    bytes

    /**
     * Derived and cached on demand
     * @private
     * @type {PubKey | undefined}
     */
    pubKey

    /**
     * @param {number[]} bytes
     */
    constructor(bytes) {
        if (bytes.length != 96) {
            throw new Error(
                `expected a 96 byte private key, got ${bytes.length} bytes`
            )
        }

        this.bytes = bytes
        this.pubKey = undefined
    }

    /**
     * @private
     * @type {number[]}
     */
    get k() {
        return this.bytes.slice(0, 64)
    }

    /**
     * @private
     * @type {number[]}
     */
    get kl() {
        return this.bytes.slice(0, 32)
    }

    /**
     * @private
     * @type {number[]}
     */
    get kr() {
        return this.bytes.slice(32, 64)
    }

    /**
     * @private
     * @type {number[]}
     */
    get c() {
        return this.bytes.slice(64, 96)
    }

    /**
     * @param {number} i
     * @returns {Bip32PrivateKey}
     */
    derive(i) {
        const Z = this.calcChildZ(i)

        const kl = encodeIntLE32(
            8n * decodeIntLE(Z.slice(0, 28)) + decodeIntLE(this.kl)
        ).slice(0, 32)
        const kr = encodeIntLE32(
            decodeIntLE(Z.slice(32, 64)) +
                (decodeIntLE(this.kr) %
                    115792089237316195423570985008687907853269984665640564039457584007913129639936n)
        ).slice(0, 32)

        const c = this.calcChildC(i).slice(32, 64)

        // TODO: discard child key whose public key is the identity point
        return new Bip32PrivateKeyImpl(kl.concat(kr).concat(c))
    }

    /**
     * @param {number[]} path
     * @returns {Bip32PrivateKey}
     */
    derivePath(path) {
        /**
         * @type {Bip32PrivateKey}
         */
        let pk = this

        path.forEach((i) => {
            pk = pk.derive(i)
        })

        return pk
    }

    /**
     * @returns {PubKey}
     */
    derivePubKey() {
        if (this.pubKey) {
            return this.pubKey
        } else {
            this.pubKey = new PubKey(Ed25519.derivePublicKey(this.k, false))

            return this.pubKey
        }
    }

    /**
     * @param {number[]} message
     * @returns {Signature}
     */
    sign(message) {
        return new Signature(
            this.derivePubKey(),
            Ed25519.sign(message, this.k, false)
        )
    }

    /**
     * @private
     * @param {number} i - child index
     */
    calcChildZ(i) {
        const ib = encodeIntBE(BigInt(i)).reverse()
        while (ib.length < 4) {
            ib.push(0)
        }

        if (ib.length != 4) {
            throw new Error("child index too big")
        }

        if (i < BIP32_HARDEN) {
            const A = this.derivePubKey().bytes

            return hmacSha2_512(this.c, [0x02].concat(A).concat(ib))
        } else {
            return hmacSha2_512(this.c, [0x00].concat(this.k).concat(ib))
        }
    }

    /**
     * @private
     * @param {number} i
     */
    calcChildC(i) {
        const ib = encodeIntBE(BigInt(i)).reverse()
        while (ib.length < 4) {
            ib.push(0)
        }

        if (ib.length != 4) {
            throw new Error("child index too big")
        }

        if (i < BIP32_HARDEN) {
            const A = this.derivePubKey().bytes

            return hmacSha2_512(this.c, [0x03].concat(A).concat(ib))
        } else {
            return hmacSha2_512(this.c, [0x01].concat(this.k).concat(ib))
        }
    }
}
