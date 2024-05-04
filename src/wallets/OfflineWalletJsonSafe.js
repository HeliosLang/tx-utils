/**
 * @typedef {import("@helios-lang/type-utils").NotifyOnFalse} NotifyOnFalse
 */

/**
 * OfflineWalletJsonSafe is useful when building transactions remotely as it can be (de)serialized using JSON.parse/JSON.stringify:
 *   - isMainnet
 *   - usedAddresses: array of bech32 encoded `Address`es
 *   - unusedAddresses: array of bech32 encoded `Address`es
 *   - utxos: array of cborhex encoded `TxInput`s (full cbor encoding)
 *   - collateral: optional array of cborhex encoded `TxInput`s (full cbor encoding)
 *   - stakingAddresses: array of bech32 encoded `StakingAddress`es
 * @typedef {{
 *   isMainnet: boolean
 *   usedAddresses: string[]
 *   unusedAddresses: string[]
 *   utxos: string[]
 *   collateral?: string[]
 *   stakingAddresses?: string[]
 * }} OfflineWalletJsonSafe
 */

import { Address, StakingAddress, TxInput } from "@helios-lang/ledger"
import {
    None,
    assert,
    expect,
    isArray,
    isBoolean,
    isFormattedString,
    isObject
} from "@helios-lang/type-utils"

/**
 * @param {unknown} input
 * @param {string} msg
 * @returns {asserts input is string[]}
 */
function expectStringArray(input, msg) {
    if (!Array.isArray(input)) {
        throw new TypeError(msg)
    }

    if (!input.every((item) => typeof item == "string")) {
        throw new TypeError(msg)
    }
}

/**
 * Asserts the content of input
 * Superfluous properties are ignored
 * @param {unknown} input
 * @param {NotifyOnFalse} onFalse - optional error message notifier
 * @returns {input is OfflineWalletJsonSafe}
 */
export function isOfflineWalletJsonSafe(input, onFalse = undefined) {
    if (
        !isObject(input, {
            isMainnet: isBoolean,
            usedAddresses: isArray(isFormattedString(Address.isValidBech32)),
            unusedAddresses: isArray(isFormattedString(Address.isValidBech32)),
            utxos: isArray(isFormattedString(TxInput.isValidCbor(true)))
        })
    ) {
        if (onFalse) {
            onFalse("invalid OfflineWalletJsonSafe")
        }
        return false
    }

    if (
        "collateral" in input &&
        !isArray(input.collateral, isFormattedString(TxInput.isValidCbor(true)))
    ) {
        if (onFalse) {
            onFalse("invalid OfflineWalletJsonSafe.collateral")
        }
        return false
    }

    if (
        "stakingAddresses" in input &&
        !isArray(
            input.stakingAddresses,
            isFormattedString(StakingAddress.isValidBech32)
        )
    ) {
        if (onFalse) {
            onFalse("invalid OfflineWalletJsonSafe.stakingAddresses")
        }
        return false
    }

    return true
}

/**
 * @param {unknown} input
 * @param {Option<string>} msg
 * @returns {asserts input is OfflineWalletJsonSafe}
 */
export function assertOfflineWalletJsonSafe(input, msg = None) {
    return assert(input, isOfflineWalletJsonSafe, msg ?? undefined)
}

/**
 * @param {unknown} input
 * @param {Option<string>} msg
 * @returns {OfflineWalletJsonSafe}
 */
export function expectOfflineWalletJsonSafe(input, msg = None) {
    return expect(input, isOfflineWalletJsonSafe, msg ?? undefined)
}
