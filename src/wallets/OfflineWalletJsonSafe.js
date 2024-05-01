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
 * @param {Option<string>} msg - optional error message
 * @returns {asserts input is OfflineWalletJsonSafe}
 */
export function expectOfflineWalletJsonSafe(input, msg = undefined) {
    if (!(input instanceof Object)) {
        throw new TypeError(msg ?? "invalid OfflineWalletJsonSafe")
    }

    if (
        "isMainnet" in input &&
        "usedAddresses" in input &&
        "unusedAddresses" in input &&
        "utxos" in input
    ) {
        if (typeof input.isMainnet != "boolean") {
            throw new TypeError(
                msg ?? "invalid OfflineWalletJsonSafe.isMainnet"
            )
        }

        expectStringArray(
            input.usedAddresses,
            "invalid OfflineWalletJsonSafe.usedAddresses"
        )
        if (!input.usedAddresses.every((addr) => Address.isValidBech32(addr))) {
            throw new TypeError("invalid OfflineWalletJsonSafe.usedAddresses")
        }

        expectStringArray(
            input.unusedAddresses,
            "invalid OfflineWalletJsonSafe.unusedAddresses"
        )
        if (
            !input.unusedAddresses.every((addr) => Address.isValidBech32(addr))
        ) {
            throw new TypeError("invalid OfflineWalletJsonSafe.unusedAddresses")
        }

        expectStringArray(input.utxos, "invalid OfflineWalletJsonSafe.utxos")
        if (!input.utxos.every((utxo) => TxInput.isValidCbor(utxo, true))) {
            throw new TypeError("invalid OfflineWalletJsonSafe.utxos")
        }

        if ("collateral" in input) {
            expectStringArray(
                input.collateral,
                "invalid OfflineWalletJsonSafe.collateral"
            )
            if (
                !input.collateral.every((utxo) =>
                    TxInput.isValidCbor(utxo, true)
                )
            ) {
                throw new TypeError("invalid OfflineWalletJsonSafe.collateral")
            }
        }

        if ("stakingAddresses" in input) {
            expectStringArray(
                input.stakingAddresses,
                "invalid OfflineWalletJsonSafe.stakingAddresses"
            )
            if (
                !input.stakingAddresses.every((addr) =>
                    StakingAddress.isValidBech32(addr)
                )
            ) {
                throw new TypeError(
                    "invalid OfflineWalletJsonSafe.stakingAddresses"
                )
            }
        }
    } else {
        throw new TypeError(msg ?? "invalid OfflineWalletJsonSafe")
    }
}
