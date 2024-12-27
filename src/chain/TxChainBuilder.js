import { makeTxInput } from "@helios-lang/ledger"
import { expectDefined } from "@helios-lang/type-utils"
import { makeTxChain } from "./TxChain.js"

/**
 * @import { Address, NetworkParams, Tx, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
 * @import { ReadonlyCardanoClient, TxChain, TxChainBuilder } from "../index.js"
 */

/**
 *
 * @param {ReadonlyCardanoClient} source
 * @returns {TxChainBuilder}
 */
export function makeTxChainBuilder(source) {
    return new TxChainBuilderImpl(source)
}

/**
 * @implements {TxChainBuilder}
 */
class TxChainBuilderImpl {
    /**
     * @private
     * @readonly
     * @type {ReadonlyCardanoClient}
     */
    source

    /**
     * @private
     * @readonly
     * @type {Tx[]}
     */
    txs

    /**
     * @param {ReadonlyCardanoClient} source
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
        return makeTxChain(this.txs)
    }

    /**
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        for (let i = 0; i < this.txs.length; i++) {
            const tx = this.txs[i]

            if (tx.id().isEqual(id.txId)) {
                const output = expectDefined(tx.body.outputs[id.index], `UTxO with index ${id.index} not found in TxChainBuilder tx ${id.txId.toHex()}`)

                return makeTxInput(id, output)
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

        const chain = makeTxChain(this.txs)

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
