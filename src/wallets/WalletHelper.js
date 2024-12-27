import { addValues } from "@helios-lang/ledger"
import { expectDefined } from "@helios-lang/type-utils"
import { selectSingle, selectSmallestFirst } from "../coinselection/index.js"
import { makeOfflineWallet } from "./OfflineWallet.js"

/**
 * @import { Address, PubKeyHash, Signature, StakingAddress, Tx, TxId, TxInput, Value } from "@helios-lang/ledger"
 * @import { CoinSelection, OfflineWallet, OfflineWalletJsonSafe, ReadonlyCardanoClient, ReadonlyWallet, Wallet, WalletHelper } from "../index.js"
 */

/**
 * @template {ReadonlyWallet} W
 * @param {W} wallet
 * @param {ReadonlyCardanoClient | undefined} fallback
 * @returns {WalletHelper<W>}
 */
export function makeWalletHelper(wallet, fallback = undefined) {
    return new WalletHelperImpl(wallet)
}

/**
 * @param {ReadonlyWallet} w
 * @returns {w is Wallet}
 */
function isWallet(w) {
    return "submitTx" in w && "signData" in w && "signTx" in w
}

/**
 * High-level helper class for instances that implement the `Wallet` interface.
 * @template {ReadonlyWallet} W
 * @implements {WalletHelper<W>}
 */
class WalletHelperImpl {
    /**
     * @readonly
     * @type {W}
     */
    wallet

    /**
     * @private
     * @readonly
     * @type {ReadonlyCardanoClient | undefined}
     */
    fallback

    /**
     * @param {W} wallet
     * @param {ReadonlyCardanoClient | undefined} fallback
     */
    constructor(wallet, fallback = undefined) {
        this.wallet = wallet
        this.fallback = fallback
    }

    /**
     * @returns {Promise<boolean>}
     */
    isMainnet() {
        return this.wallet.isMainnet()
    }

    /**
     * Concatenation of `usedAddresses` and `unusedAddresses`.
     * @type {Promise<Address[]>}
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
     * @type {Promise<Address>}
     */
    get baseAddress() {
        return this.allAddresses.then((addresses) =>
            expectDefined(addresses[0], "first address undefined")
        )
    }

    /**
     * First `Address` in `unusedAddresses` (falls back to last `Address` in `usedAddresses` if `unusedAddresses` is empty or not defined).
     * @type {Promise<Address>}
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
     * @type {Promise<Address[]>}
     */
    get usedAddresses() {
        return this.wallet.usedAddresses
    }

    /**
     * @type {Promise<Address[]>}
     */
    get unusedAddresses() {
        return this.wallet.unusedAddresses
    }

    /**
     * First UTxO in `utxos`. Can be used to distinguish between preview and preprod networks.
     * @type {Promise<TxInput | undefined>}
     */
    get refUtxo() {
        return this.utxos.then((utxos) => {
            if (utxos.length == 0) {
                return undefined
            } else {
                return expectDefined(utxos[0], "first utxo undefined")
            }
        })
    }

    /**
     * Falls back to using the network
     * @type {Promise<TxInput[]>}
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
     * @type {Promise<TxInput[]>}
     */
    get collateral() {
        return this.wallet.collateral
    }

    /**
     * @type {Promise<StakingAddress[]>}
     */
    get stakingAddresses() {
        return this.wallet.stakingAddresses
    }

    /**
     * @returns {Promise<Value>}
     */
    async calcBalance() {
        return addValues(await this.utxos)
    }

    /**
     * Returns `true` if the `PubKeyHash` in the given `Address` is controlled by the wallet.
     * Assumes wallet only contains Shelley-era address
     * @param {Address} addr
     * @returns {Promise<boolean>}
     */
    async isOwnAddress(addr) {
        if (addr.era == "Shelley") {
            const pkh = addr.spendingCredential

            if (pkh.kind != "PubKeyHash") {
                return false
            } else {
                return this.isOwnPubKeyHash(pkh)
            }
        } else {
            return false
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
            if (addr.era == "Shelley") {
                const aPkh = addr.spendingCredential

                if (aPkh && aPkh.kind == "PubKeyHash" && aPkh.isEqual(pkh)) {
                    return true
                }
            }
        }

        return false
    }

    /**
     * Picks a single UTxO intended as collateral.
     * @param {bigint} amount - defaults to 2 Ada, which should cover most things
     * @returns {Promise<TxInput>}
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
     * @returns {Promise<TxInput>}
     */
    async selectUtxo(value) {
        const utxos = await this.utxos

        const [selected, _notSelected] = selectSingle(utxos, value)

        return expectDefined(selected[0], "unable to select single utxo")
    }

    /**
     * Pick a number of UTxOs needed to cover a given Value. The default coin selection strategy is to pick the smallest first.
     * @param {Value} amount
     * @param {CoinSelection} coinSelection
     * @returns {Promise<TxInput[]>}
     */
    async selectUtxos(amount, coinSelection = selectSmallestFirst()) {
        return coinSelection(await this.utxos, amount)[0]
    }

    /**
     * @returns {Promise<OfflineWalletJsonSafe>}
     */
    async toJsonSafe() {
        const offlineWallet = await this.toOfflineWallet()

        return offlineWallet.toJsonSafe()
    }

    /**
     * @returns {Promise<OfflineWallet>}
     */
    async toOfflineWallet() {
        const [
            isMainnet,
            usedAddresses,
            unusedAddresses,
            utxos,
            collateral,
            stakingAddresses
        ] = await Promise.all([
            this.wallet.isMainnet(),
            this.wallet.usedAddresses,
            this.wallet.unusedAddresses,
            this.wallet.utxos,
            this.wallet.collateral,
            this.wallet.stakingAddresses
        ])

        return makeOfflineWallet({
            isMainnet,
            usedAddresses,
            unusedAddresses,
            utxos,
            collateral,
            stakingAddresses
        })
    }

    /**
     * @type {W extends Wallet ? (addr: Address, data: number[]) => Promise<Signature> : never}
     */
    get signData() {
        const w = this.wallet

        if (isWallet(w)) {
            /**
             * @param {Address} addr
             * @param {number[]} data
             * @returns {Promise<Signature>}
             */
            const fn = async (addr, data) => {
                return w.signData(addr, data)
            }

            return /** @type {any} */ (fn)
        } else {
            throw new Error("signData not defined on ReadonlyWallet")
        }
    }

    /**
     * @type {W extends Wallet ? (tx: Tx) => Promise<Signature[]> : never}
     */
    get signTx() {
        const w = this.wallet

        if (isWallet(w)) {
            /**
             * @param {Tx} tx
             * @returns {Promise<Signature[]>}
             */
            const fn = async (tx) => {
                return w.signTx(tx)
            }

            return /** @type {any} */ (fn)
        } else {
            throw new Error("signTx not defined on ReadonlyWallet")
        }
    }

    /**
     * @type {W extends Wallet ? (tx: Tx) => Promise<TxId> : never}
     */
    get submitTx() {
        const w = this.wallet

        if (isWallet(w)) {
            /**
             * @param {Tx} tx
             * @returns {Promise<TxId>}
             */
            const fn = async (tx) => {
                return w.submitTx(tx)
            }

            return /** @type {any} */ (fn)
        } else {
            throw new Error("submitTx not defined on ReadonlyWallet")
        }
    }
}
