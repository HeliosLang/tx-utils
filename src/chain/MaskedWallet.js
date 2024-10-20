import { Address, Signature, Tx, TxId, TxInput } from "@helios-lang/ledger"

/**
 * @typedef {import("../network/index.js").Network} Network
 * @typedef {import("../wallets/index.js").Wallet} Wallet
 */

/**
 * @param {Wallet} baseWallet
 * @param {Network} mask
 * @returns {Wallet}
 */
export function maskWallet(baseWallet, mask) {
    return new MaskedWallet(baseWallet, mask)
}

/**
 * @implements {Wallet}
 */
class MaskedWallet {
    /**
     * @type {Wallet}
     */
    baseWallet

    /**
     * @type {Network}
     */
    mask

    /**
     * @param {Wallet} baseWallet
     * @param {Network} mask
     */
    constructor(baseWallet, mask) {
        this.baseWallet = baseWallet
        this.mask = mask
    }

    /**
     * @returns {Promise<boolean>}
     */
    isMainnet() {
        return this.baseWallet.isMainnet()
    }

    get collateral() {
        return this.baseWallet.collateral
    }

    get stakingAddresses() {
        return this.baseWallet.stakingAddresses
    }

    get usedAddresses() {
        return this.baseWallet.usedAddresses
    }

    get unusedAddresses() {
        return this.baseWallet.unusedAddresses
    }

    /**
     * @type {Promise<TxInput<unknown, unknown>[]>}
     */
    get utxos() {
        return this.baseWallet.usedAddresses
            .then((addrs) => {
                return Promise.all(
                    addrs.map((addr) => this.mask.getUtxos(addr))
                )
            })
            .then((utxos) => {
                return utxos.flat()
            })
    }

    /**
     * @param {Tx} tx
     * @returns {Promise<Signature[]>}
     */
    async signTx(tx) {
        return this.baseWallet.signTx(tx)
    }

    /**
     * @param {Address<any, any>} addr
     * @param {number[]} data
     * @returns {Promise<Signature>}
     */
    async signData(addr, data) {
        return this.baseWallet.signData(addr, data)
    }

    /**
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        return this.baseWallet.submitTx(tx)
    }
}
