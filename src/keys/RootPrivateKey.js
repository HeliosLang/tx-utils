import { BitWriter, padBits } from "@helios-lang/codec-utils"
import { sha2_256 } from "@helios-lang/crypto"
import { PubKey, Signature } from "@helios-lang/ledger"
import { isNone } from "@helios-lang/type-utils"
import { Bip32PrivateKey, BIP32_HARDEN } from "./Bip32PrivateKey.js"
import {
    BIP39_DICT_EN,
    convertBip39PhraseToEntropy,
    convertEntropyToBip39Phrase,
    isValidBip39Phrase
} from "./bip39.js"

/**
 * @typedef {import("./PrivateKey.js").PrivateKey} PrivateKey
 */

/**
 * With a RootPrivateKey any large number of Bip32PrivateKeys can be generated
 * @implements {PrivateKey}
 */
export class RootPrivateKey {
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
        this.bip32Key = Bip32PrivateKey.fromBip39Entropy(entropy)
    }

    /**
     * @param {string[]} phrase
     * @param {string[]} dict
     * @returns {RootPrivateKey}
     */
    static fromPhrase(phrase, dict = BIP39_DICT_EN) {
        const entropy = convertBip39PhraseToEntropy(phrase, dict)

        return new RootPrivateKey(entropy)
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
    deriveStakingRootKey(accountIndex) {
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
