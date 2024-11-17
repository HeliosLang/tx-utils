import { Address, StakingAddress, TxInput } from "@helios-lang/ledger"
import {
    assert,
    expect,
    isArray,
    isBoolean,
    isFormattedString,
    isObject
} from "@helios-lang/type-utils"

/**
 * @import { NotifyOnFalse } from "@helios-lang/type-utils"
 * @import { OfflineWalletJsonSafe } from "src/index.js"
 */

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
 * @param {string | undefined} msg
 * @returns {asserts input is OfflineWalletJsonSafe}
 */
export function assertOfflineWalletJsonSafe(input, msg = undefined) {
    return assert(input, isOfflineWalletJsonSafe, msg ?? undefined)
}

/**
 * @param {unknown} input
 * @param {string | undefined} msg
 * @returns {OfflineWalletJsonSafe}
 */
export function expectOfflineWalletJsonSafe(input, msg = undefined) {
    return expect(input, isOfflineWalletJsonSafe, msg ?? undefined)
}
