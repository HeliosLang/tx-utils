import { bytesToHex, equalsBytes } from "@helios-lang/codec-utils"
import {
    Address,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { None } from "@helios-lang/type-utils"
import { IntData } from "@helios-lang/uplc"
import { WalletHelper } from "../wallets/index.js"
import { TxBuilder } from "./TxBuilder.js"
import { expectSome } from "@helios-lang/type-utils"

/**
 * @typedef {import("@helios-lang/uplc").UplcProgramV2I} UplcProgramV2I
 * @typedef {import("../network/index.js").Network} Network
 * @typedef {import("../wallets/index.js").Wallet} Wallet
 * @typedef {import("./RefScriptRegistry.js").RefScriptRegistry} RefScriptRegistry
 */

/**
 * @param {{network: Network, agent: Wallet}} args
 * @returns {RefScriptRegistry}
 */
export function makeRefScriptRegistry(args) {
    return new RefScriptRegistryImpl(args.network, args.agent)
}

/**
 * @implements {RefScriptRegistry}
 */
class RefScriptRegistryImpl {
    /**
     * @private
     * @type {Network}
     */
    _network

    /**
     * @private
     * @type {Wallet}
     */
    _agent

    /**
     * @private
     * @type {Record<string, {program: UplcProgramV2I, utxoId: TxOutputId}>}
     */
    _cache

    /**
     * @param {Network} network
     * @param {Wallet} agent
     */
    constructor(network, agent) {
        this._network = network
        this._agent = agent
        this._cache = {}
    }

    /**
     * TODO: configurable lock address that is based in always_fails native script
     * @private
     * @type {Address<any, any>}
     */
    get address() {
        return Address.dummy(this._network.isMainnet(), 0)
    }

    /**
     * @param {UplcProgramV2I} program
     * @returns {Promise<void>}
     */
    async register(program) {
        const h = bytesToHex(program.hash())

        if (h in this._cache) {
            return
        }

        const b = new TxBuilder({ isMainnet: this._network.isMainnet() })

        const output = new TxOutput(
            this.address,
            new Value(0),
            TxOutputDatum.Inline(new IntData(0)),
            program
        )

        const changeAddress = new WalletHelper(this._agent).changeAddress
        const tx = await b.payUnsafe(output).build({
            spareUtxos: this._agent.utxos,
            changeAddress,
            networkParams: this._network.parameters
        })

        const id = await this._network.submitTx(
            tx.addSignatures(await this._agent.signTx(tx))
        )

        const utxoId = new TxOutputId(id, 0)

        this._cache[h] = {
            program,
            utxoId
        }
    }

    /**
     * @param {number[]} hash
     * @returns {Promise<Option<{input: TxInput<any, any>, program: UplcProgramV2I}>>}
     */
    async find(hash) {
        const h = bytesToHex(hash)

        if (h in this._cache) {
            const input = await this._network.getUtxo(this._cache[h].utxoId)

            return {
                program: this._cache[h].program,
                input
            }
        } else {
            const utxos = await this._network.getUtxos(this.address)

            const input = utxos.find((utxo) =>
                equalsBytes(utxo.output.refScript?.hash() ?? [], hash)
            )

            if (input) {
                const program = expectSome(input.output.refScript)

                if (program.plutusVersion != "PlutusScriptV2") {
                    throw new Error("unexpected plutus version")
                }

                this._cache[h] = {
                    program,
                    utxoId: input.id
                }

                return { input, program }
            } else {
                return None
            }
        }
    }
}
