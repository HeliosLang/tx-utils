import { bytesToHex } from "@helios-lang/codec-utils"
import { Address, StakingAddress, TxInput } from "@helios-lang/ledger"
import { JSON, assert } from "@helios-lang/type-utils"
import { isOfflineWalletJsonSafe } from "./OfflineWalletJsonSafe.js"

/**
 * @import { OfflineWallet, OfflineWalletJsonSafe } from "src/index.js"
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
 * @param {object} props
 * @param {boolean} props.isMainnet
 * @param {(Address | string)[]} props.usedAddresses
 * @param {(Address | string)[]} props.unusedAddresses
 * @param {(TxInput | string)[]} props.utxos
 * @param {(TxInput | string)[]} [props.collateral]
 * @param {(StakingAddress | string)[]} [props.stakingAddresses]
 * @returns {OfflineWallet}
 */
export function makeOfflineWallet(props) {
    return new OfflineWalletImpl({
        isMainnet: props.isMainnet,
        usedAddresses: props.usedAddresses.map((addr) =>
            typeof addr == "string" ? Address.fromBech32(addr) : addr
        ),
        unusedAddresses: props.unusedAddresses.map((addr) =>
            typeof addr == "string" ? Address.fromBech32(addr) : addr
        ),
        utxos: props.utxos.map((utxo) =>
            typeof utxo == "string" ? TxInput.fromCbor(utxo) : utxo
        ),
        collateral: props.collateral?.map((utxo) =>
            typeof utxo == "string" ? TxInput.fromCbor(utxo) : utxo
        ),
        stakingAddresses: props.stakingAddresses?.map((addr) =>
            typeof addr == "string" ? StakingAddress.fromBech32(addr) : addr
        )
    })
}

/**
 * Throws an error if the input doesn't have the correct format.
 * @param {string | JsonSafe} json
 * @returns {OfflineWallet}
 */
export function parseOfflineWallet(json) {
    if (typeof json == "string") {
        return parseOfflineWallet(JSON.parse(json))
    } else if (isOfflineWalletJsonSafe(json)) {
        return makeOfflineWallet(json)
    } else {
        throw new Error("invalid format")
    }
}

/**
 * @implements {OfflineWallet}
 */
class OfflineWalletImpl {
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
