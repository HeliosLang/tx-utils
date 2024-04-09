import {
    Address,
    AssetClass,
    DCert,
    MintingPolicyHash,
    NativeScript,
    PubKeyHash,
    Tx,
    TxInput,
    TxOutput,
    TxOutputDatum,
    timeToDate
} from "@helios-lang/ledger"
import { TxBuilder } from "./TxBuilder.js"
import { WalletHelper } from "../wallets/index.js"
import { UplcProgramV1, UplcProgramV2 } from "@helios-lang/uplc"
import { None } from "@helios-lang/type-utils"

/**
 * @typedef {import("@helios-lang/codec-utils").ByteArrayLike} ByteArrayLike
 * @typedef {import("@helios-lang/ledger").AddressLike} AddressLike
 * @typedef {import("@helios-lang/ledger").AssetClassLike} AssetClassLike
 * @typedef {import("@helios-lang/ledger").MintingPolicyHashLike} MintingPolicyHashLike
 * @typedef {import("@helios-lang/ledger").StakingAddressLike} StakingAddressLike
 * @typedef {import("@helios-lang/ledger").TimeLike} TimeLike
 * @typedef {import("@helios-lang/ledger").TxMetadataAttr} TxMetadataAttr
 * @typedef {import("@helios-lang/ledger").ValueLike} ValueLike
 * @typedef {import("@helios-lang/uplc").UplcData} UplcData
 * @typedef {import("../network/Network.js").Network} Network
 * @typedef {import("../wallets/index.js").Wallet} Wallet
 * @typedef {import("./TxBuilder.js").TxBuilderConfig} TxBuilderConfig
 */

/**
 * @template TDatumPermissive
 * @typedef {import("@helios-lang/ledger").DatumPaymentContext<TDatumPermissive>} DatumPaymentContext
 */
/**
 * @template TRedeemerStrict
 * @template TRedeemerPermissive
 * @typedef {import("@helios-lang/ledger").MintingContext<TRedeemerStrict, TRedeemerPermissive>} MintingContext
 */

/**
 * @template TDatumStrict
 * @template TDatumPermissive
 * @template TRedeemerStrict
 * @template TRedeemerPermissive
 * @typedef {import("@helios-lang/ledger").SpendingContext<TDatumStrict, TDatumPermissive, TRedeemerStrict, TRedeemerPermissive>} SpendingContext
 */

/**
 * @template T
 * @typedef {import("@helios-lang/ledger").TxOutputDatumCastable<T>} TxOutputDatumCastable
 */

export class AgentTxBuilder {
    /**
     * @private
     * @readonly
     * @type {Wallet}
     */
    agent

    /**
     * @private
     * @readonly
     * @type {Network}
     */
    network

    /**
     * @param {Wallet} agent
     * @param {Network} network
     * @param {TxBuilderConfig} config
     */
    constructor(agent, network, config = {}) {
        this.agent = agent
        this.network = network
        this.builder = TxBuilder.new(config)
    }

    /**
     * @returns {Promise<Tx>}
     */
    async build() {
        const walletHelper = new WalletHelper(this.agent)

        const tx = this.builder.build({
            changeAddress: await walletHelper.changeAddress,
            spareUtxos: await walletHelper.utxos,
            networkParams: await this.network.parameters
        })

        return tx
    }

    /**
     * @returns {AgentTxBuilder}
     */
    reset() {
        this.builder.reset()

        return this
    }

    /**
     * @param {TxInput | TxInput[]} utxo
     * @returns {AgentTxBuilder}
     */
    addCollateral(utxo) {
        this.builder.addCollateral(utxo)

        return this
    }

    /**
     * @param {DCert} dcert
     * @returns {AgentTxBuilder}
     */
    addDCert(dcert) {
        this.builder.addDCert(dcert)

        return this
    }

    /**
     * @param {PubKeyHash[]} hash
     * @returns {AgentTxBuilder}
     */
    addSigners(...hash) {
        this.builder.addSigners(...hash)

        return this
    }

    /**
     * @param {NativeScript} script
     * @returns {AgentTxBuilder}
     */
    attachNativeScript(script) {
        this.builder.attachNativeScript(script)

        return this
    }

    /**
     * @param {UplcProgramV1 | UplcProgramV2} program
     * @return {AgentTxBuilder}
     */
    attachUplcProgram(program) {
        this.builder.attachUplcProgram(program)

        return this
    }

    /**
     * @overload
     * @param {AssetClass<null>} assetClass
     * @param {bigint | number} quantity
     * @returns {AgentTxBuilder}
     *
     * @overload
     * @param {MintingPolicyHash<null>} policy
     * @param {[ByteArrayLike, bigint | number][]} tokens
     * @returns {AgentTxBuilder}
     *
     * @template TRedeemer
     * @overload
     * @param {AssetClass<MintingContext<any, TRedeemer>>} assetClass
     * @param {bigint | number} quantity
     * @param {TRedeemer} redeemer
     * @returns {AgentTxBuilder}
     *
     * @template TRedeemer
     * @overload
     * @param {MintingPolicyHash<MintingContext<any, TRedeemer>>} policy
     * @param {[ByteArrayLike, bigint | number][]} tokens
     * @param {TRedeemer} redeemer
     * @returns {AgentTxBuilder}
     *
     * @template TRedeemer
     * @param {[
     *   AssetClass<null> | MintingPolicyHash<null>,
     *   bigint | number | [ByteArrayLike, bigint | number][]
     * ] | [
     *   AssetClass<MintingContext<any, TRedeemer>> | MintingPolicyHash<MintingContext<any, TRedeemer>>,
     *   bigint | number | [ByteArrayLike, bigint | number][],
     *   TRedeemer
     * ]} args
     * @returns {AgentTxBuilder}
     */
    mint(...args) {
        this.builder.mint(.../** @type {[any, any, any]} */ (args))

        return this
    }

    /**
     * Mint a list of tokens associated with a given `MintingPolicyHash`.
     * Throws an error if the given `MintingPolicyHash` was already used in a previous call to `mint()`.
     * The token names can either by a list of bytes or a hexadecimal string.
     *
     * Also throws an error if the redeemer is `null`, and the minting policy isn't a known `NativeScript`.
     *
     * @overload
     * @param {AssetClassLike} assetClass
     * @param {bigint | number} quantity
     * @param {Option<UplcData>} redeemer - can be None when minting from a Native script (but not set by default)
     * @returns {AgentTxBuilder}
     *
     * @overload
     * @param {MintingPolicyHashLike} policy
     * @param {[ByteArrayLike, number | bigint][]} tokens - list of pairs of [tokenName, quantity], tokenName can be list of bytes or hex-string
     * @param {Option<UplcData>} redeemer - can be None when minting from a Native script (but not set by default)
     * @returns {AgentTxBuilder}
     *
     * @template TRedeemer
     * @param {[
     *   AssetClassLike, bigint | number, Option<UplcData>
     * ] | [
     *   MintingPolicyHashLike, [ByteArrayLike, number | bigint][], Option<UplcData>
     * ]} args
     * @returns {AgentTxBuilder}
     */
    mintUnsafe(...args) {
        this.builder.mintUnsafe(.../** @type {[any, any, any]} */ (args))

        return this
    }

    /**
     * @overload
     * @param {Address<null, any>} address
     * @param {ValueLike} value
     * @returns {AgentTxBuilder}
     *
     * @template TDatum
     * @overload
     * @param {Address<DatumPaymentContext<TDatum>, any>} address
     * @param {ValueLike} value
     * @param {TxOutputDatumCastable<TDatum>} datum
     * @returns {AgentTxBuilder}
     *
     * @template TDatum
     * @param {[
     *   Address<null, any>, ValueLike
     * ] | [
     *   Address<DatumPaymentContext<TDatum>, any>, ValueLike, TxOutputDatumCastable<TDatum>
     * ]} args
     * @returns {AgentTxBuilder}
     */
    pay(...args) {
        this.builder.pay(.../** @type {[any, any, any]} */ (args))

        return this
    }

    /**
     * @overload
     * @param {AddressLike} address
     * @param {ValueLike} value
     * @returns {AgentTxBuilder}
     *
     * @overload
     * @param {AddressLike} address
     * @param {ValueLike} value
     * @param {TxOutputDatum} datum
     * @returns {AgentTxBuilder}
     *
     * @overload
     * @param {TxOutput | TxOutput[]} output
     * @returns {AgentTxBuilder}
     *
     * @param {[
     *   AddressLike, ValueLike
     * ] | [
     *   AddressLike, ValueLike, TxOutputDatum
     * ] | [
     *   TxOutput | TxOutput[]
     * ]} args
     * @returns {AgentTxBuilder}
     */
    payUnsafe(...args) {
        this.builder.payUnsafe(.../** @type {[any, any, any]} */ (args))

        return this
    }

    /**
     * Include a reference input
     * @param {TxInput[]} utxos
     * @returns {AgentTxBuilder}
     */
    refer(...utxos) {
        this.builder.refer(...utxos)

        return this
    }

    /**
     * @overload
     * @param {number} key
     * @param {TxMetadataAttr} value
     * @returns {AgentTxBuilder}
     *
     * @overload
     * @param {{[key: number]: TxMetadataAttr}} attributes
     * @returns {AgentTxBuilder}
     *
     * @param {[number, TxMetadataAttr] | [{[key: number]: TxMetadataAttr}]} args
     * @returns {AgentTxBuilder}
     */
    setMetadata(...args) {
        this.builder.setMetadata(.../** @type {[any, any]} */ (args))

        return this
    }

    /**
     * @overload
     * @param {TxInput<null, any> | TxInput<null, any>[]} utxos
     * @returns {AgentTxBuilder}
     *
     * @template TRedeemer
     * @overload
     * @param {TxInput<SpendingContext<any, any, any, TRedeemer>, any> | TxInput<SpendingContext<any, any, any, TRedeemer>, any>[]} utxos
     * @param {TRedeemer} redeemer
     * @returns {AgentTxBuilder}
     */
    /**
     * @template TRedeemer
     * @param {[
     *   TxInput<null, any> | TxInput<null, any>[]
     * ] | [
     *   TxInput<SpendingContext<any, any, any, TRedeemer>, any> | TxInput<SpendingContext<any, any, any, TRedeemer>, any>[],
     *   TRedeemer
     * ]} args
     * @returns {AgentTxBuilder}
     */
    spend(...args) {
        this.builder.spend(.../** @type {[any, any]} */ (args))

        return this
    }

    /**
     * Add a UTxO instance as an input to the transaction being built.
     * Throws an error if the UTxO is locked at a script address but a redeemer isn't specified (unless the script is a known `NativeScript`).
     * @param {TxInput | TxInput[]} utxos
     * @param {Option<UplcData>} redeemer
     * @returns {AgentTxBuilder}
     */
    spendUnsafe(utxos, redeemer = None) {
        this.builder.spendUnsafe(utxos, redeemer)

        return this
    }

    /**
     * Set the start of the valid time range by specifying a slot.
     * @param {bigint | number} slot
     * @returns {AgentTxBuilder}
     */
    validFromSlot(slot) {
        this.validFrom = BigInt(slot)

        return this
    }

    /**
     * Set the start of the valid time range by specifying a time.
     * @param {TimeLike} time
     * @returns {AgentTxBuilder}
     */
    validFromTime(time) {
        this.validFrom = timeToDate(time)

        return this
    }

    /**
     * Set the end of the valid time range by specifying a slot.
     * @param {bigint | number} slot
     * @returns {AgentTxBuilder}
     */
    validToSlot(slot) {
        this.validTo = BigInt(slot)

        return this
    }

    /**
     * Set the end of the valid time range by specifying a time.
     * @param {TimeLike} time
     * @returns {AgentTxBuilder}
     */
    validToTime(time) {
        this.validTo = timeToDate(time)

        return this
    }

    /**
     * @param {StakingAddressLike} addr
     * @param {bigint | number} lovelace
     * @returns {AgentTxBuilder}
     */
    withdraw(addr, lovelace) {
        this.builder.withdraw(addr, lovelace)

        return this
    }
}
