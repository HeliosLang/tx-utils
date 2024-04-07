import {
    Address,
    Signature,
    StakingAddress,
    Tx,
    TxId,
    TxInput
} from "@helios-lang/ledger"

/**
 * @typedef {import("../network/Network.js").NetworkName} NetworkName
 * @typedef {import("./Wallet.js").Wallet} Wallet
 */

/**
 * @implements {Wallet}
 */
export class OfflineWallet {
    /**
     * @readonly
     * @type {NetworkName}
     */
    networkName

    /**
     * @readonly
     * @type {Address[]}
     */
    #usedAddresses

    /**
     * @readonly
     * @type {Address[]}
     */
    #unusedAddresses

    /**
     * @readonly
     * @type {StakingAddress[]}
     */
    #stakingAddresses

    /**
     * @readonly
     * @type {TxInput[]}
     */
    #utxos

    /**
     * @param {NetworkName} networkName
     * @param {Address[]} usedAddresses
     * @param {Address[]} unusedAddresses
     * @param {TxInput[]} utxos
     * @param {StakingAddress[]} stakingAddresses
     */
    constructor(
        networkName,
        usedAddresses,
        unusedAddresses,
        utxos,
        stakingAddresses = []
    ) {
        this.networkName = networkName
        this.#usedAddresses = usedAddresses
        this.#unusedAddresses = unusedAddresses
        this.#stakingAddresses = stakingAddresses
        this.#utxos = utxos
    }

    /**
     * @param {string | Object} obj
     * @returns {OfflineWallet}
     */
    static fromJson(obj) {
        if (typeof obj == "string") {
            return OfflineWallet.fromJson(JSON.parse(obj))
        } else {
            return new OfflineWallet(
                obj.networkName,
                obj.usedAddresses.map((a) => Address.fromBech32(a)),
                obj.unusedAddresses.map((a) => Address.fromBech32(a)),
                obj.utxos.map((u) => TxInput.fromCbor(u))
            )
        }
    }

    /**
     * @type {Promise<TxInput[]>}
     */
    get collateral() {
        return new Promise((resolve, _) => resolve([]))
    }

    /**
     * @type {Promise<StakingAddress[]>}
     */
    get stakingAddresses() {
        return new Promise((resolve, _) => resolve(this.#stakingAddresses))
    }

    /**
     * @type {Promise<Address[]>}
     */
    get usedAddresses() {
        return new Promise((resolve, _) => resolve(this.#usedAddresses))
    }

    /**
     * @type {Promise<Address[]>}
     */
    get unusedAddresses() {
        return new Promise((resolve, _) => resolve(this.#unusedAddresses))
    }

    /**
     * @type {Promise<TxInput[]>}
     */
    get utxos() {
        return new Promise((resolve, _) => resolve(this.#utxos))
    }

    /**
     * @returns {Promise<boolean>}
     */
    async isMainnet() {
        return this.networkName == "mainnet"
    }

    /**
     * Throws an error because OfflineWallets can't sign anything
     * @param {Address} addr
     * @param {number[]} data
     * @return {Promise<Signature>}
     */
    async signData(addr, data) {
        throw new Error("an OfflineWallet can't sign data")
    }

    /**
     * Throws an error because OfflineWallets can't sign anything
     * @param {Tx} tx
     * @returns {Promise<Signature[]>}
     */
    async signTx(tx) {
        throw new Error("an OfflineWallet can't sign transactions")
    }

    /**
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        throw new Error(
            "transactions can't be submitted through an OfflineWallet"
        )
    }
}
