import { makeTxInput } from "@helios-lang/ledger"
import { expectDefined } from "@helios-lang/type-utils"
import { makeTxChain } from "./TxChain.js"

/**
 * @import { Address, NetworkParams, Tx, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
 * @import { ReadonlyCardanoClient, TxChain, TxChainBuilder } from "../index.js"
 */

/**
 * has a type-parameter for the source network type
 * @template {ReadonlyCardanoClient} SpecificSourceType
 * @param {SpecificSourceType} source
 * @returns {TxChainBuilder & SpecificSourceType}
 */
export function makeTxChainBuilder(source) {
    return /** @type{any} */ (new TxChainBuilderImpl(source))
}

const proxyStateUnused = {}
const chainBuilderProxyImpl = new Proxy(proxyStateUnused, {
    get(_proxyState, clientPropName, chainBuilder) {
        const result = Reflect.get(
            chainBuilder.source,
            clientPropName,
            chainBuilder.source
        )
        if ("function" == typeof result) {
            return result.bind(chainBuilder.source)
        }
        return result
    }
})

const chainBuilderProxyShim = (() => {
    const t = function () {}
    t.prototype = chainBuilderProxyImpl
    return t
})()
/**
 * @template {ReadonlyCardanoClient} SpecificSourceType
 * @implements {SpecificSourceType}
 */
//@ts-expect-error because it doesn't APPEAR to implement the SpecificSourceType interface
class chainBuilderProxy extends chainBuilderProxyShim {}

/**
 * @template {ReadonlyCardanoClient} SpecificSourceType
 * @implements {TxChainBuilder}
 */
class TxChainBuilderImpl extends chainBuilderProxy {
    /**
     * @private
     * @readonly
     * @type {SpecificSourceType}
     */
    source

    /**
     * @private
     * @readonly
     * @type {Tx[]}
     */
    txs

    /**
     * @param {SpecificSourceType} source
     */
    constructor(source) {
        super()
        this.source = source
        this.txs = []
    }

    /**
     * @type {number}
     */
    get now() {
        return this.source.now
        // todo: allow the base proxy to take the responsibility for this getter
        //   ... keeping for now because with() doesn't want to believe `this` is a TxChainBuilder without it.
    }

    /**
     * @type {Promise<NetworkParams>}
     */
    get parameters() {
        return this.source.parameters
        // todo: allow the base proxy to take the responsibility for this getter
        //   ... keeping for now because with() doesn't want to believe `this` is a TxChainBuilder without it.
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
                const output = expectDefined(
                    tx.body.outputs[id.index],
                    `UTxO with index ${id.index} not found in TxChainBuilder tx ${id.txId.toHex()}`
                )

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
        // todo: allow the base proxy to take the responsibility for this method;
        //   ... keeping for now because with() doesn't want to believe `this` is a TxChainBuilder without it.
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
