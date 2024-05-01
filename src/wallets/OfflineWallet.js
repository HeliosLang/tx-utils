import { bytesToHex } from "@helios-lang/codec-utils"
import { Address, StakingAddress, TxInput } from "@helios-lang/ledger"
import { expectOfflineWalletJsonSafe } from "./OfflineWalletJsonSafe.js"

/**
 * @typedef {import("../network/Network.js").NetworkName} NetworkName
 * @typedef {import("./OfflineWalletJsonSafe.js").OfflineWalletJsonSafe} OfflineWalletJsonSafe
 * @typedef {import("./Wallet.js").ReadonlyWallet} ReadonlyWallet
 */

/**
 * @typedef {{
 *   isMainnet: boolean
 *   usedAddresses: Address[]
 *   unusedAddresses: Address[]
 *   utxos: TxInput[]
 *   collateral?: TxInput[]
 *   stakingAddresses?: StakingAddress[]
 * }} OfflineWalletProps
 */

/**
 * @implements {ReadonlyWallet}
 */
export class OfflineWallet {
    /**
     * @readonly
     * @type {boolean}
     */
    isMainnetSync

    /**
     * @readonly
     * @type {Address[]}
     */
    usedAddressesSync

    /**
     * @readonly
     * @type {Address[]}
     */
    unusedAddressesSync

    /**
     * @readonly
     * @type {TxInput[]}
     */
    utxosSync

    /**
     * @readonly
     * @type {TxInput[]}
     */
    collateralSync

    /**
     * @readonly
     * @type {StakingAddress[]}
     */
    stakingAddressesSync

    /**
     * @param {OfflineWalletProps} props
     */
    constructor({
        isMainnet,
        usedAddresses,
        unusedAddresses,
        utxos,
        collateral = [],
        stakingAddresses = []
    }) {
        this.isMainnetSync = isMainnet
        this.usedAddressesSync = usedAddresses
        this.unusedAddressesSync = unusedAddresses
        this.utxosSync = utxos
        this.collateralSync = collateral
        this.stakingAddressesSync = stakingAddresses
    }

    /**
     * Throws an error if the input is invalid
     * @param {string | JsonSafe} input
     * @returns {OfflineWallet}
     */
    static fromJson(input) {
        if (typeof input == "string") {
            return OfflineWallet.fromJson(JSON.parse(input))
        } else {
            expectOfflineWalletJsonSafe(input)

            return new OfflineWallet({
                isMainnet: input.isMainnet,
                usedAddresses: input.usedAddresses.map(Address.fromBech32),
                unusedAddresses: input.unusedAddresses.map(Address.fromBech32),
                utxos: input.utxos.map(TxInput.fromCbor),
                collateral: input.collateral?.map(TxInput.fromCbor),
                stakingAddresses: input.stakingAddresses?.map(
                    StakingAddress.fromBech32
                )
            })
        }
    }

    /**
     * @returns {Promise<boolean>}
     */
    async isMainnet() {
        return this.isMainnetSync
    }

    /**
     * @type {Promise<Address[]>}
     */
    get usedAddresses() {
        return new Promise((resolve, _) => resolve(this.usedAddressesSync))
    }

    /**
     * @type {Promise<Address[]>}
     */
    get unusedAddresses() {
        return new Promise((resolve, _) => resolve(this.unusedAddressesSync))
    }

    /**
     * @type {Promise<TxInput[]>}
     */
    get utxos() {
        return new Promise((resolve, _) => resolve(this.utxosSync))
    }

    /**
     * @type {Promise<TxInput[]>}
     */
    get collateral() {
        return new Promise((resolve, _) => resolve(this.collateralSync))
    }

    /**
     * @type {Promise<StakingAddress[]>}
     */
    get stakingAddresses() {
        return new Promise((resolve, _) => resolve(this.stakingAddressesSync))
    }

    /**
     * @returns {OfflineWalletJsonSafe}
     */
    toJsonSafe() {
        return {
            isMainnet: this.isMainnetSync,
            usedAddresses: this.usedAddressesSync.map((a) => a.toBech32()),
            unusedAddresses: this.unusedAddressesSync.map((a) => a.toBech32()),
            utxos: this.utxosSync.map((u) => bytesToHex(u.toCbor(true))),
            collateral: this.collateralSync.map((u) =>
                bytesToHex(u.toCbor(true))
            ),
            stakingAddresses: this.stakingAddressesSync.map((a) => a.toBech32())
        }
    }
}
