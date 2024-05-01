import { bytesToHex } from "@helios-lang/codec-utils"
import { Address, PubKeyHash, TxInput, Value } from "@helios-lang/ledger"
import { None, expectSome } from "@helios-lang/type-utils"
import { selectSingle, selectSmallestFirst } from "../coinselection/index.js"

/**
 
 * @typedef {import("../network/Network.js").ReadonlyNetwork} ReadonlyNetwork
 * @typedef {import("./Wallet.js").ReadonlyWallet} ReadonlyWallet
 */

/**
 * @template CSpending
 * @typedef {import("../coinselection/index.js").CoinSelection<CSpending>} CoinSelection
 */

/**
 * High-level helper class for instances that implement the `Wallet` interface.
 * @template {ReadonlyWallet} W
 */
export class WalletHelper {
    /**
     * @readonly
     * @type {W}
     */
    wallet

    /**
     * @readonly
     * @type {Option<ReadonlyNetwork>}
     */
    fallback

    /**
     * @param {W} wallet
     * @param {Option<ReadonlyNetwork>} fallback
     */
    constructor(wallet, fallback = None) {
        this.wallet = wallet
        this.fallback = fallback
    }

    /**
     * Concatenation of `usedAddresses` and `unusedAddresses`.
     * @type {Promise<Address<null, unknown>[]>}
     */
    get allAddresses() {
        return this.wallet.usedAddresses.then((usedAddress) =>
            this.wallet.unusedAddresses.then((unusedAddresses) =>
                usedAddress.concat(unusedAddresses)
            )
        )
    }

    /**
     * First `Address` in `allAddresses`.
     * Throws an error if there aren't any addresses
     * @type {Promise<Address<null, unknown>>}
     */
    get baseAddress() {
        return this.allAddresses.then((addresses) => expectSome(addresses[0]))
    }

    /**
     * First `Address` in `unusedAddresses` (falls back to last `Address` in `usedAddresses` if `unusedAddresses` is empty or not defined).
     * @type {Promise<Address<null, unknown>>}
     */
    get changeAddress() {
        return this.wallet.unusedAddresses.then((addresses) => {
            if (addresses.length == 0) {
                return this.wallet.usedAddresses.then((addresses) => {
                    if (addresses.length == 0) {
                        throw new Error("no addresses found")
                    } else {
                        return addresses[addresses.length - 1]
                    }
                })
            } else {
                return addresses[0]
            }
        })
    }

    /**
     * First UTxO in `utxos`. Can be used to distinguish between preview and preprod networks.
     * @type {Promise<Option<TxInput<null, unknown>>>}
     */
    get refUtxo() {
        return this.utxos.then((utxos) => {
            if (utxos.length == 0) {
                return None
            } else {
                return expectSome(utxos[0])
            }
        })
    }

    /**
     * Falls back to using the network
     * @type {Promise<TxInput<null, unknown>[]>}
     */
    get utxos() {
        return (async () => {
            try {
                const utxos = await this.wallet.utxos

                if (utxos.length > 0) {
                    return utxos
                }
            } catch (e) {
                if (!this.fallback) {
                    console.error("fallback Network not set")
                    throw e
                }
            }

            const fallback = this.fallback
            if (fallback) {
                console.log(
                    "falling back to retrieving UTxOs through query layer"
                )
                return (
                    await Promise.all(
                        (await this.wallet.usedAddresses).map((a) =>
                            fallback.getUtxos(a)
                        )
                    )
                ).flat()
            } else {
                throw new Error(
                    "wallet returned 0 utxos, set the helper getUtxosFallback callback to use an Api query layer instead"
                )
            }
        })()
    }

    /**
     * @returns {Promise<Value>}
     */
    async calcBalance() {
        return Value.sum(await this.utxos)
    }

    /**
     * Returns `true` if the `PubKeyHash` in the given `Address` is controlled by the wallet.
     * @param {Address} addr
     * @returns {Promise<boolean>}
     */
    async isOwnAddress(addr) {
        const pkh = addr.pubKeyHash

        if (!pkh) {
            return false
        } else {
            return this.isOwnPubKeyHash(pkh)
        }
    }

    /**
     * Returns `true` if the given `PubKeyHash` is controlled by the wallet.
     * @param {PubKeyHash} pkh
     * @returns {Promise<boolean>}
     */
    async isOwnPubKeyHash(pkh) {
        const addresses = await this.allAddresses

        for (const addr of addresses) {
            const aPkh = addr.pubKeyHash

            if (aPkh && aPkh.isEqual(pkh)) {
                return true
            }
        }

        return false
    }

    /**
     * Picks a single UTxO intended as collateral.
     * @param {bigint} amount - defaults to 2 Ada, which should cover most things
     * @returns {Promise<TxInput<null, unknown>>}
     */
    async selectCollateral(amount = 2000000n) {
        // first try the collateral utxos that the wallet (might) provide
        const defaultCollateral = await this.wallet.collateral

        if (defaultCollateral.length > 0) {
            const bigEnough = defaultCollateral.filter(
                (utxo) => utxo.value.lovelace >= amount
            )

            if (bigEnough.length > 0) {
                return bigEnough[0]
            }
        }

        const pureUtxos = (await this.utxos).filter((utxo) =>
            utxo.value.assets.isZero()
        )

        if (pureUtxos.length == 0) {
            throw new Error("no pure UTxOs in wallet (needed for collateral)")
        }

        const bigEnough = pureUtxos.filter(
            (utxo) => utxo.value.lovelace >= amount
        )

        if (bigEnough.length == 0) {
            throw new Error(
                "no UTxO in wallet that is big enough to cover collateral"
            )
        }

        bigEnough.sort((a, b) => Number(a.value.lovelace - b.value.lovelace))

        return bigEnough[0]
    }

    /**
     * Throws an error if token not found
     * Returns only a single utxo
     * @param {Value} value
     * @returns {Promise<TxInput<null, unknown>>}
     */
    async selectUtxo(value) {
        const utxos = await this.utxos

        const [selected, _notSelected] = selectSingle(utxos, value)

        return expectSome(selected[0])
    }

    /**
     * Pick a number of UTxOs needed to cover a given Value. The default coin selection strategy is to pick the smallest first.
     * @param {Value} amount
     * @param {CoinSelection<null>} coinSelection
     * @returns {Promise<TxInput<null, unknown>[]>}
     */
    async selectUtxos(amount, coinSelection = selectSmallestFirst()) {
        return coinSelection(await this.utxos, amount)[0]
    }

    /**
     * @returns {Promise<any>}
     */
    async toJson() {
        const isMainnet = await this.wallet.isMainnet()
        const usedAddresses = await this.wallet.usedAddresses
        const unusedAddresses = await this.wallet.unusedAddresses

        return {
            isMainnet: isMainnet,
            usedAddresses: usedAddresses.map((a) => a.toBech32()),
            unusedAddresses: unusedAddresses.map((a) => a.toBech32()),
            utxos: (await this.utxos).map((u) => bytesToHex(u.toCbor(true)))
        }
    }
}
