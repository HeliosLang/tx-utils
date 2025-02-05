/**
 * @import { BytesLike } from "@helios-lang/codec-utils"
 * @import { PubKey, PubKeyHash, Signature, ShelleyAddress, SpendingCredential, Tx, TxId, TxInput } from "@helios-lang/ledger"
 * @import { CardanoClient, Cip30CoseSign1, Wallet } from "../index.js"
 */

/**
 * @param {Wallet} baseWallet
 * @param {CardanoClient} mask
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
     * @type {CardanoClient}
     */
    mask

    /**
     * @param {Wallet} baseWallet
     * @param {CardanoClient} mask
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
     * @type {Promise<TxInput<SpendingCredential>[]>}
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
     * @param {ShelleyAddress<PubKeyHash>} addr
     * @param {BytesLike} data
     * @returns {Promise<{signature: Cip30CoseSign1, key: PubKey}>}
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
