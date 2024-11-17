import { bytesToHex, equalsBytes } from "@helios-lang/codec-utils"
import {
    Address,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { expectDefined } from "@helios-lang/type-utils"
import { IntData } from "@helios-lang/uplc"
import { makeWalletHelper } from "../wallets/index.js"
import { makeTxBuilder } from "./TxBuilder.js"

/**
 * @import { UplcProgramV2I } from "@helios-lang/uplc"
 * @import { CardanoClient, RefScriptRegistry, Wallet } from "src/index.js"
 */

/**
 * @param {{client: CardanoClient, agent: Wallet, address?: Address<any, any>}} args
 * @returns {RefScriptRegistry}
 */
export function makeRefScriptRegistry(args) {
    return new RefScriptRegistryImpl(args.client, args.agent, args.address)
}

/**
 * @implements {RefScriptRegistry}
 */
class RefScriptRegistryImpl {
    /**
     * @private
     * @type {CardanoClient}
     */
    _network

    /**
     * @private
     * @type {Wallet}
     */
    _agent

    /**
     * @private
     * @type {Address<any, any>}
     */
    _address

    /**
     * @private
     * @type {Record<string, {program: UplcProgramV2I, utxoId: TxOutputId}>}
     */
    _cache

    /**
     * @param {CardanoClient} client
     * @param {Wallet} agent
     */
    constructor(client, agent, address = Address.dummy(client.isMainnet(), 0)) {
        this._network = client
        this._agent = agent
        this._address = address
        this._cache = {}
    }

    /**
     * @private
     * @type {Address<any, any>}
     */
    get address() {
        return this._address
    }

    /**
     * @param {UplcProgramV2I} program
     * @returns {Promise<TxOutputId>}
     */
    async register(program) {
        const h = bytesToHex(program.hash())

        if (h in this._cache) {
            return this._cache[h].utxoId
        }

        const b = makeTxBuilder({ isMainnet: this._network.isMainnet() })

        const output = new TxOutput(
            this.address,
            new Value(0),
            TxOutputDatum.Inline(new IntData(0)),
            program
        )

        const changeAddress = makeWalletHelper(this._agent).changeAddress
        const tx = await b.addOutput(output).build({
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

        return utxoId
    }

    /**
     * @param {number[]} hash
     * @returns {Promise<{input: TxInput<any, any>, program: UplcProgramV2I} | undefined>}
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
                const program = expectDefined(input.output.refScript)

                if (program.plutusVersion != "PlutusScriptV2") {
                    throw new Error("unexpected plutus version")
                }

                this._cache[h] = {
                    program,
                    utxoId: input.id
                }

                return { input, program }
            } else {
                return undefined
            }
        }
    }
}
