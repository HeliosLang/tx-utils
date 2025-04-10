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
const chainBuilderProxyImpl = /* @__PURE__ */ new Proxy(proxyStateUnused, {
    get(_proxyState, clientPropName, chainBuilder) {
        if (clientPropName == "toString") return undefined
        if (clientPropName == Symbol.toPrimitive) return undefined
        if (clientPropName == Symbol.toStringTag) return undefined

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

const chainBuilderProxyShim = /* @__PURE__ */ (() => {
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
class TxChainBuilderImpl
    extends /* @type {chainBuilderProxy<SpecificSourceType>} */ chainBuilderProxy
{
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
        Object.defineProperty(this, "source", {
            value: source,
            writable: false,
            enumerable: false,
            configurable: false
        })
        this.txs = []
    }

    /**
     * @type {number}
     */
    get now() {
        // it's provided by the proxy base, but is kept here to satisfy the type-system
        return this.source.now
    }

    /**
     * @type {Promise<NetworkParams>}
     */
    get parameters() {
        // it's provided by the proxy base, but is kept here to satisfy the type-system
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
     * @param {TxOutputId} id
     * @returns {Promise<boolean>}
     */
    async hasUtxo(id) {
        return !!(await this.getUtxo(id))
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

        // keep the utxos that haven't been spent by the chain yet
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
        // it's provided by the proxy base, but is kept here to satisfy the type-system
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
