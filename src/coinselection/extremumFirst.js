import { makeValue } from "@helios-lang/ledger"
import { InsufficientFundsError } from "./InsufficientFundsError.js"

/**
 * @import { SpendingCredential, TxInput, Value } from "@helios-lang/ledger"
 */

/**
 * Selects UTxOs from a list by iterating through the tokens in the given `Value` and picking the UTxOs containing the largest corresponding amount first.
 * @param {object} props
 * @param {boolean} [props.allowSelectingUninvolvedAssets]
 */
export function selectLargestFirst(props = {}) {
    return selectExtremumFirst({ ...props, largestFirst: true })
}

/**
 * Selects UTxOs from a list by iterating through the tokens in the given `Value` and picking the UTxOs containing the smallest corresponding amount first.
 * This method can be used to eliminate dust UTxOs from a wallet.
 * @param {object} props
 * @param {boolean} [props.allowSelectingUninvolvedAssets]
 */
export function selectSmallestFirst(props = {}) {
    return selectExtremumFirst({ ...props, largestFirst: false })
}

/**
 * Loops through the policies and tokens of `amount`
 *   - if for a given asset there isn't enough already included, select the previously unselected utxos until the necessary quantity is filled (starting with the extremum first)
 * @param {object} props
 * @param {boolean} props.largestFirst
 * @param {boolean} [props.allowSelectingUninvolvedAssets]
 */
function selectExtremumFirst({ largestFirst, allowSelectingUninvolvedAssets }) {
    /**
     * @template {SpendingCredential} [SC=SpendingCredential]
     * @param {TxInput<SC>[]} utxos
     * @param {Value} amount
     * @returns {[TxInput<SC>[], TxInput<SC>[]]}
     */
    return (utxos, amount) => {
        let sum = makeValue(0n)

        /** @type {TxInput<SC>[]} */
        let notSelected = utxos.slice()

        /** @type {TxInput<SC>[]} */
        const selected = []

        /**
         * Selects smallest utxos until 'needed' is reached
         * @param {bigint} neededQuantity
         * @param {(utxo: TxInput) => bigint} getQuantity
         */
        function select(neededQuantity, getQuantity) {
            // first sort notYetPicked in ascending order when picking smallest first,
            // and in descending order when picking largest first
            // sort UTxOs that contain more assets last
            notSelected.sort((a, b) => {
                const qa = getQuantity(a)
                const qb = getQuantity(b)

                const sign = largestFirst ? -1 : 1

                if (qa != 0n && qb == 0n) {
                    return sign
                } else if (qa == 0n && qb != 0n) {
                    return -sign
                } else if (qa == 0n && qb == 0n) {
                    return 0
                } else {
                    const na = a.value.assets.countTokens()
                    const nb = b.value.assets.countTokens()

                    if (na == nb) {
                        return Number(qa - qb) * sign
                    } else if (na < nb) {
                        return sign
                    } else {
                        return -sign
                    }
                }
            })

            let count = 0n
            const remaining = []

            while (count < neededQuantity || count == 0n) {
                // must select at least one utxo if neededQuantity == 0n
                const utxo = notSelected.shift()

                if (utxo === undefined) {
                    throw new InsufficientFundsError(amount, selected)
                } else {
                    const qty = getQuantity(utxo)

                    if (qty > 0n) {
                        count += qty
                        selected.push(utxo)
                        sum = sum.add(utxo.value)
                    } else {
                        remaining.push(utxo)
                    }
                }
            }

            notSelected = notSelected.concat(remaining)
        }

        /**
         * Select UTxOs while looping through (MintingPolicyHash,TokenName) entries
         * If the UTxOs happen to contain Asset classes that shouldn't be involved, then those are mixed in
         */
        const mphs = amount.assets.getPolicies()

        for (const mph of mphs) {
            const tokenNames = amount.assets.getPolicyTokenNames(mph)

            for (const tokenName of tokenNames) {
                const need = amount.assets.getPolicyTokenQuantity(
                    mph,
                    tokenName
                )
                const have = sum.assets.getPolicyTokenQuantity(mph, tokenName)

                if (have < need) {
                    const diff = need - have

                    select(diff, (utxo) =>
                        utxo.value.assets.getPolicyTokenQuantity(mph, tokenName)
                    )
                }
            }
        }

        /**
         * Now use the same strategy for lovelace
         * Except that UTxOs containing Asset classes not involved in this transaction are ignored
         */
        const need = amount.lovelace
        const have = sum.lovelace

        if (have < need) {
            const diff = need - have

            /**
             * @param {TxInput} utxo
             * @returns {boolean}
             */
            const canSelectUtxoForLovelace = (utxo) => {
                if (allowSelectingUninvolvedAssets) {
                    return true
                }

                const acs = utxo.value.assets.assetClasses

                if (acs.length == 0) {
                    return true
                } else {
                    return acs.some((ac) =>
                        amount.assetClasses.some((act) => act.isEqual(ac))
                    )
                }
            }

            const usuableForLovelace = notSelected.filter(
                canSelectUtxoForLovelace
            )
            const unusableForLovelace = notSelected.filter(
                (utxo) => !canSelectUtxoForLovelace(utxo)
            )

            notSelected = usuableForLovelace

            select(diff, (utxo) => utxo.value.lovelace)

            notSelected = notSelected.concat(unusableForLovelace)
        }

        if (selected.length + notSelected.length != utxos.length) {
            throw new Error(
                "internal error: select algorithm doesn't conserve utxos"
            )
        }

        return [selected, notSelected]
    }
}
