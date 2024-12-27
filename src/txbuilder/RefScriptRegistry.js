import { bytesToHex, equalsBytes } from "@helios-lang/codec-utils"
import {
    makeDummyAddress,
    makeInlineTxOutputDatum,
    makeTxOutput,
    makeTxOutputId,
    makeValue
} from "@helios-lang/ledger"
import { expectDefined } from "@helios-lang/type-utils"
import { makeIntData } from "@helios-lang/uplc"
import { makeWalletHelper } from "../wallets/index.js"
import { makeTxBuilder } from "./TxBuilder.js"

/**
 * @import { ShelleyAddress, TxInput, TxOutputId } from "@helios-lang/ledger"
 * @import { UplcProgramV2 } from "@helios-lang/uplc"
 * @import { CardanoClient, RefScriptRegistry, Wallet } from "../index.js"
 */

/**
 * @param {{client: CardanoClient, agent: Wallet, address?: ShelleyAddress}} args
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
     * @type {ShelleyAddress}
     */
    _address

    /**
     * @private
     * @type {Record<string, {program: UplcProgramV2, utxoId: TxOutputId}>}
     */
    _cache

    /**
     * @param {CardanoClient} client
     * @param {Wallet} agent
     * @param {ShelleyAddress} address
     */
    constructor(
        client,
        agent,
        address = makeDummyAddress(client.isMainnet(), 0)
    ) {
        this._network = client
        this._agent = agent
        this._address = address
        this._cache = {}
    }

    /**
     * @private
     * @type {ShelleyAddress}
     */
    get address() {
        return this._address
    }

    /**
     * @param {UplcProgramV2} program
     * @returns {Promise<TxOutputId>}
     */
    async register(program) {
        const h = bytesToHex(program.hash())

        if (h in this._cache) {
            return this._cache[h].utxoId
        }

        const b = makeTxBuilder({ isMainnet: this._network.isMainnet() })

        const output = makeTxOutput(
            this.address,
            makeValue(0),
            makeInlineTxOutputDatum(makeIntData(0)),
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

        const utxoId = makeTxOutputId(id, 0)

        this._cache[h] = {
            program,
            utxoId
        }

        return utxoId
    }

    /**
     * @param {number[]} hash
     * @returns {Promise<{input: TxInput, program: UplcProgramV2} | undefined>}
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
                const program = expectDefined(input.output.refScript, "refScript undefined")

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
