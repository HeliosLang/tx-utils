import { Address, Tx, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
import { expectSome } from "@helios-lang/type-utils"
import { TxChain } from "./TxChain.js"

/**
 * @typedef {import("@helios-lang/ledger").NetworkParams} NetworkParams
 * @typedef {import("../network/index.js").Network} Network
 * @typedef {import("../network/index.js").ReadonlyNetwork} ReadonlyNetwork
 */

/**
 * @implements {Network}
 */
export class TxChainBuilder {
    /**
     * @private
     * @readonly
     * @type {ReadonlyNetwork}
     */
    source

    /**
     * @private
     * @readonly
     * @type {Tx[]}
     */
    txs

    /**
     * @param {ReadonlyNetwork} source
     */
    constructor(source) {
        this.source = source
        this.txs = []
    }

    /**
     * @type {number}
     */
    get now() {
        return this.source.now
    }
    /**
     * @type {Promise<NetworkParams>}
     */
    get parameters() {
        return this.source.parameters
    }

    /**
     * @returns {TxChain}
     */
    build() {
        return new TxChain(this.txs)
    }

    /**
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        for (let i = 0; i < this.txs.length; i++) {
            const tx = this.txs[i]

            if (tx.id().isEqual(id.txId)) {
                const output = expectSome(tx.body.outputs[id.utxoIdx])

                return new TxInput(id, output)
            }
        }

        return this.source.getUtxo(id)
    }

    /**
     * @param {Address} addr
     * @returns {Promise<TxInput[]>}
     */
    async getUtxos(addr) {
        let utxos = await this.source.getUtxos(addr)

        const chain = new TxChain(this.txs)

        const chainInputs = chain.collectInputs(false, false)
        const chainOutputs = chain.collectOutputs()

        // keep the utxos that haven't been spent by the chai yet
        utxos = utxos.filter(
            (utxo) => !chainInputs.some((ci) => ci.isEqual(utxo))
        )

        utxos = utxos.concat(
            chainOutputs.filter((co) => co.address.isEqual(addr))
        )

        return utxos
    }

    /**
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        this.txs.push(tx)
        return tx.id()
    }

    /**
     * @returns {boolean}
     */
    isMainnet() {
        return this.source.isMainnet()
    }

    /**
     * @param {Tx} tx
     * @returns {TxChainBuilder}
     */
    with(tx) {
        this.txs.push(tx)
        return this
    }
}
