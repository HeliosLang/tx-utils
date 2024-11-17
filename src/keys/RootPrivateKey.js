import { generateBytes, mulberry32 } from "@helios-lang/crypto"
import { PubKey, Signature } from "@helios-lang/ledger"
import {
    BIP32_HARDEN,
    makeBip32PrivateKeyWithBip39Entropy
} from "./Bip32PrivateKey.js"
import {
    BIP39_DICT_EN,
    convertBip39PhraseToEntropy,
    convertEntropyToBip39Phrase
} from "./bip39.js"

/**
 * @import { NumberGenerator } from "@helios-lang/crypto"
 * @import { Bip32PrivateKey, RootPrivateKey } from "src/index.js"
 */

/**
 * @param {number[]} entropy
 * @returns {RootPrivateKey}
 */
export function makeRootPrivateKey(entropy) {
    return new RootPrivateKeyImpl(entropy)
}

/**
 * @param {string[]} phrase
 * @param {string[]} dict
 * @returns {RootPrivateKey}
 */
export function restoreRootPrivateKey(phrase, dict = BIP39_DICT_EN) {
    const entropy = convertBip39PhraseToEntropy(phrase, dict)
    return new RootPrivateKeyImpl(entropy)
}

/**
 * @param {NumberGenerator} rand
 * @returns {RootPrivateKey}
 */
export function makeRandomRootPrivateKey(
    rand = mulberry32(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
) {
    const entropy = generateBytes(rand, 32)
    return new RootPrivateKeyImpl(entropy)
}

/**
 * With a RootPrivateKey any large number of Bip32PrivateKeys can be generated
 * @implements {RootPrivateKey}
 */
class RootPrivateKeyImpl {
    /**
     * @readonly
     * @type {number[]}
     */
    entropy

    /**
     * @readonly
     * @type {Bip32PrivateKey}
     */
    bip32Key

    /**
     * @param {number[]} entropy
     */
    constructor(entropy) {
        if (
            !(
                entropy.length == 16 ||
                entropy.length == 20 ||
                entropy.length == 24 ||
                entropy.length == 28 ||
                entropy.length == 32
            )
        ) {
            throw new Error(
                `expected 16, 20, 24, 28 or 32 bytes for the root entropy, got ${entropy.length}`
            )
        }

        this.entropy = entropy
        this.bip32Key = makeBip32PrivateKeyWithBip39Entropy(entropy)
    }

    /**
     * @param {string[]} phrase
     * @param {string[]} dict
     * @returns {RootPrivateKey}
     */
    static fromPhrase(phrase, dict = BIP39_DICT_EN) {
        const entropy = convertBip39PhraseToEntropy(phrase, dict)

        return new RootPrivateKeyImpl(entropy)
    }

    /**
     * @type {number[]}
     */
    get bytes() {
        return this.bip32Key.bytes
    }

    /**
     * @param {number} i - childIndex
     * @returns {Bip32PrivateKey}
     */
    derive(i) {
        return this.bip32Key.derive(i)
    }

    /**
     * @param {number[]} path
     * @returns {Bip32PrivateKey}
     */
    derivePath(path) {
        return this.bip32Key.derivePath(path)
    }

    /**
     * @param {number} accountIndex
     * @returns {Bip32PrivateKey}
     */
    deriveSpendingRootKey(accountIndex = 0) {
        return this.derivePath([
            1852 + BIP32_HARDEN,
            1815 + BIP32_HARDEN,
            accountIndex + BIP32_HARDEN,
            0
        ])
    }

    /**
     * @param {number} accountIndex
     * @returns {Bip32PrivateKey}
     */
    deriveStakingRootKey(accountIndex = 0) {
        return this.derivePath([
            1852 + BIP32_HARDEN,
            1815 + BIP32_HARDEN,
            accountIndex + BIP32_HARDEN,
            2
        ])
    }

    /**
     * @param {number} accountIndex
     * @param {number} i
     * @returns {Bip32PrivateKey}
     */
    deriveSpendingKey(accountIndex = 0, i = 0) {
        return this.deriveSpendingRootKey(accountIndex).derive(i)
    }

    /**
     * @param {number} accountIndex
     * @param {number} i
     * @returns {Bip32PrivateKey}
     */
    deriveStakingKey(accountIndex = 0, i = 0) {
        return this.deriveStakingRootKey(accountIndex).derive(i)
    }

    /**
     * @returns {PubKey}
     */
    derivePubKey() {
        return this.bip32Key.derivePubKey()
    }

    /**
     * @param {number[]} message
     * @returns {Signature}
     */
    sign(message) {
        return this.bip32Key.sign(message)
    }

    /**
     * @param {string[]} dict
     * @returns {string[]}
     */
    toPhrase(dict = BIP39_DICT_EN) {
        return convertEntropyToBip39Phrase(this.entropy, dict)
    }
}
