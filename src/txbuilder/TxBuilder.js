import { bytesToHex, equalsBytes } from "@helios-lang/codec-utils"
import {
    Address,
    Assets,
    AssetClass,
    calcScriptDataHash,
    DCert,
    MintingPolicyHash,
    NativeScript,
    NetworkParamsHelper,
    PubKeyHash,
    ScriptPurpose,
    SpendingCredential,
    StakingAddress,
    timeToDate,
    Tx,
    TxBody,
    TxId,
    TxInput,
    TxMetadata,
    TxOutput,
    TxOutputDatum,
    TxRedeemer,
    TxWitnesses,
    ValidatorHash,
    Value,
    TokenValue
} from "@helios-lang/ledger"
import { None, expectSome, isNone } from "@helios-lang/type-utils"
import { UplcProgramV1, UplcProgramV2, UplcDataValue } from "@helios-lang/uplc"

/**
 * @typedef {import("@helios-lang/codec-utils").ByteArrayLike} ByteArrayLike
 * @typedef {import("@helios-lang/ledger").AddressLike} AddressLike
 * @typedef {import("@helios-lang/ledger").AssetClassLike} AssetClassLike
 * @typedef {import("@helios-lang/ledger").MintingPolicyHashLike} MintingPolicyHashLike
 * @typedef {import("@helios-lang/ledger").NetworkParams} NetworkParams
 * @typedef {import("@helios-lang/ledger").StakingAddressLike} StakingAddressLike
 * @typedef {import("@helios-lang/ledger").TimeLike} TimeLike
 * @typedef {import("@helios-lang/ledger").TxMetadataAttr} TxMetadataAttr
 * @typedef {import("@helios-lang/ledger").ValueLike} ValueLike
 * @typedef {import("@helios-lang/uplc").UplcData} UplcData
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

/**
 * @typedef {"sync" | "async"} TxBuilderKind
 */

/**
 * @typedef {{
 *   changeAddress?: AddressLike
 *   spareUtxos?: TxInput[]
 *   networkParams?: NetworkParams
 * }} TxBuilderFinalConfig
 */

/**
 * @template {TxBuilderKind} [T="sync"]
 * @typedef {{
 *   maxAssetsPerChangeOutput?: number
 *   getFinalConfig?: () => (T extends "sync" ? TxBuilderFinalConfig : Promise<TxBuilderFinalConfig>)
 *   postBuild?: (b: Tx) => (T extends "sync" ? Tx : Promise<Tx>)
 * }} TxBuilderConfig
 */

/**
 * @template {TxBuilderKind} [T="sync"]
 */
export class TxBuilder {
    /**
     * @readonly
     * @type {TxBuilderConfig<T>}
     */
    config

    /**
     * @private
     * @type {TxInput[]}
     */
    collateral

    /**
     * Unique datums
     * @private
     * @type {UplcData[]}
     */
    datums

    /**
     * @private
     * @type {DCert[]}
     */
    dcerts

    /**
     * @private
     * @type {TxInput[]}
     */
    inputs

    /**
     * @private
     * @type {{[key: number]: TxMetadataAttr}}
     */
    metadata

    /**
     * @private
     * @type {Assets}
     */
    mintedTokens

    /**
     * @private
     * @type {[MintingPolicyHash, UplcData][]}
     */
    mintingRedeemers

    /**
     * @private
     * @type {NativeScript[]}
     */
    nativeScripts

    /**
     * @private
     * @type {TxOutput[]}
     */
    outputs

    /**
     * @private
     * @type {TxInput[]}
     */
    refInputs

    /**
     * @private
     * @type {PubKeyHash[]}
     */
    signers

    /**
     * @private
     * @type {[TxInput, UplcData][]}
     */
    spendingRedeemers

    /**
     * Upon finalization the slot is calculated and stored in the body
     * bigint: slot, Date: regular time
     * @private
     * @type {Option<bigint | Date>}
     */
    validTo

    /**
     * Upon finalization the slot is calculated and stored in the body
     * bigint: slot, Date: regular time
     * @private
     * @type {Option<bigint | Date>}
     */
    validFrom

    /**
     * @private
     * @type {UplcProgramV1[]}
     */
    v1Scripts

    /**
     * @private
     * @type {UplcProgramV2[]}
     */
    v2RefScripts

    /**
     * @private
     * @type {UplcProgramV2[]}
     */
    v2Scripts

    /**
     * @private
     * @type {[StakingAddress, bigint][]}
     */
    withdrawals

    /**
     * @param {TxBuilderConfig<T>} config
     */
    constructor(config) {
        this.config = config
        this.reset()
    }

    /**
     * @template {TxBuilderKind} [T="sync"]
     * @param {TxBuilderConfig<T>} config
     * @returns {TxBuilder<T>}
     */
    static new(config = {}) {
        return new TxBuilder(config)
    }

    /**
     * @param {{
     *   changeAddress?: AddressLike
     *   networkParams?: NetworkParams | NetworkParamsHelper
     *   spareUtxos?: TxInput[]
     * }} config
     * @returns {T extends "sync" ? Tx : Promise<Tx>}
     */
    build(config = {}) {
        /**
         * @param {any} config
         */
        const buildWithConfig = (config) => {
            const tx = this.buildInternal(/** @type {any} */ (config))
            return /** @type {any} */ (
                this.config.postBuild ? this.config.postBuild(tx) : tx
            )
        }

        if (
            config.changeAddress &&
            config.networkParams &&
            config.networkParams
        ) {
            return buildWithConfig(config)
        } else if (this.config.getFinalConfig) {
            const config = this.config.getFinalConfig()

            if (config instanceof Promise) {
                return /** @type {any} */ (
                    config.then((config) => {
                        return buildWithConfig(config)
                    })
                )
            } else {
                return buildWithConfig(config)
            }
        } else if (config.changeAddress) {
            return buildWithConfig(config)
        } else {
            throw new Error("changeAddress unspecified")
        }
    }

    /**
     * @returns {TxBuilder<T>}
     */
    reset() {
        this.collateral = []
        this.datums = []
        this.dcerts = []
        this.inputs = []
        this.metadata = {}
        this.mintedTokens = new Assets()
        this.mintingRedeemers = []
        this.nativeScripts = []
        this.outputs = []
        this.refInputs = []
        this.signers = []
        this.spendingRedeemers = []
        this.validTo = None
        this.validFrom = None
        this.v1Scripts = []
        this.v2RefScripts = []
        this.v2Scripts = []
        this.withdrawals = []

        return this
    }

    /**
     * @param {TxInput | TxInput[]} utxo
     * @returns {TxBuilder<T>}
     */
    addCollateral(utxo) {
        if (Array.isArray(utxo)) {
            utxo.forEach((utxo) => this.addCollateral(utxo))
            return this
        } else {
            TxInput.append(this.collateral, utxo, true)
            return this
        }
    }

    /**
     * @param {DCert} dcert
     * @returns {TxBuilder<T>}
     */
    addDCert(dcert) {
        this.dcerts.push(dcert)

        if (dcert.isDelegate() || /** @type {DCert} */ (dcert).isDeregister()) {
            const stakingHash = dcert.credential.expectStakingHash()

            if (stakingHash.isPubKey()) {
                this.addSigners(stakingHash.hash)
            }
        }

        return this
    }

    /**
     * @param {PubKeyHash[]} hash
     * @returns {TxBuilder<T>}
     */
    addSigners(...hash) {
        hash.forEach((hash) => {
            if (!this.signers.some((prev) => prev.isEqual(hash))) {
                this.signers.push(hash)
            }
        })

        return this
    }

    /**
     * @param {NativeScript} script
     * @returns {TxBuilder<T>}
     */
    attachNativeScript(script) {
        if (!this.hasNativeScript(script.hash())) {
            this.nativeScripts.push(script)
        }

        return this
    }

    /**
     * @param {UplcProgramV1 | UplcProgramV2} program
     * @return {TxBuilder<T>}
     */
    attachUplcProgram(program) {
        switch (program.plutusVersion) {
            case "PlutusScriptV1":
                this.addV1Script(program)
                break
            case "PlutusScriptV2":
                this.addV2Script(program)
                break
            default:
                throw new Error(`unhandled UplcProgram type`)
        }

        return this
    }

    /**
     * @template TRedeemer
     * @overload
     * @param {TokenValue<MintingContext<any, TRedeemer>>} token
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder<T>}
     *
     * @overload
     * @param {TokenValue<null>} token
     * @returns {TxBuilder<T>}
     *
     * @overload
     * @param {AssetClass<null>} assetClass
     * @param {bigint | number} quantity
     * @returns {TxBuilder<T>}
     *
     * @overload
     * @param {MintingPolicyHash<null>} policy
     * @param {[ByteArrayLike, bigint | number][]} tokens
     * @returns {TxBuilder<T>}
     *
     * @template TRedeemer
     * @overload
     * @param {AssetClass<MintingContext<any, TRedeemer>>} assetClass
     * @param {bigint | number} quantity
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder<T>}
     *
     * @template TRedeemer
     * @overload
     * @param {MintingPolicyHash<MintingContext<any, TRedeemer>>} policy
     * @param {[ByteArrayLike, bigint | number][]} tokens
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder<T>}
     *
     * @template TRedeemer
     * @param {[
     *   TokenValue<null>
     * ] | [
     *   AssetClass<null> | MintingPolicyHash<null> | TokenValue<MintingContext<any, TRedeemer>>,
     *   bigint | number | [ByteArrayLike, bigint | number][] | TRedeemer
     * ] | [
     *   AssetClass<MintingContext<any, TRedeemer>> | MintingPolicyHash<MintingContext<any, TRedeemer>>,
     *   bigint | number | [ByteArrayLike, bigint | number][],
     *   TRedeemer
     * ]} args
     * @returns {TxBuilder<T>}
     */
    mint(...args) {
        if (args.length == 1) {
            return this.mintUnsafe(args[0].assetClass, args[0].quantity, None)
        } else if (args.length == 2) {
            const [a, b] = args

            if (
                a instanceof AssetClass &&
                (typeof b == "bigint" || typeof b == "number")
            ) {
                return this.mintUnsafe(a, b, None)
            } else if (a instanceof MintingPolicyHash && Array.isArray(b)) {
                return this.mintUnsafe(a, b, None)
            } else if (
                a instanceof TokenValue &&
                !(
                    typeof b == "bigint" ||
                    typeof b == "number" ||
                    Array.isArray(b)
                )
            ) {
                this.attachUplcProgram(a.context.program)

                return this.mintUnsafe(
                    a.assetClass,
                    a.quantity,
                    a.context.redeemer.toUplcData(b)
                )
            } else {
                throw new Error("invalid arguments")
            }
        } else if (args.length == 3) {
            const [a, b, redeemer] = args

            if (
                a instanceof AssetClass &&
                (typeof b == "bigint" || typeof b == "number")
            ) {
                this.attachUplcProgram(a.context.program)

                return this.mintUnsafe(
                    a,
                    b,
                    a.context.redeemer.toUplcData(redeemer)
                )
            } else if (a instanceof MintingPolicyHash && Array.isArray(b)) {
                this.attachUplcProgram(a.context.program)

                return this.mintUnsafe(
                    a,
                    b,
                    a.context.redeemer.toUplcData(redeemer)
                )
            } else {
                throw new Error("invalid arguments")
            }
        } else {
            throw new Error("invalid number of arguments")
        }
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
     * @returns {TxBuilder<T>}
     *
     * @overload
     * @param {MintingPolicyHashLike} policy
     * @param {[ByteArrayLike, number | bigint][]} tokens - list of pairs of [tokenName, quantity], tokenName can be list of bytes or hex-string
     * @param {Option<UplcData>} redeemer - can be None when minting from a Native script (but not set by default)
     * @returns {TxBuilder<T>}
     *
     * @template TRedeemer
     * @param {[
     *   AssetClassLike, bigint | number, Option<UplcData>
     * ] | [
     *   MintingPolicyHashLike, [ByteArrayLike, number | bigint][], Option<UplcData>
     * ]} args
     * @returns {TxBuilder<T>}
     */
    mintUnsafe(...args) {
        const [a, b, redeemer] = args

        // handle the overloads
        const [mph, tokens] = (() => {
            if (typeof b == "bigint" || typeof b == "number") {
                const assetClass = AssetClass.fromAlike(
                    /** @type {AssetClassLike} */ (a)
                )

                return [
                    assetClass.mph,
                    [
                        /** @type {[number[], bigint | number]} */ ([
                            assetClass.tokenName,
                            b
                        ])
                    ]
                ]
            } else if (Array.isArray(b)) {
                return [
                    MintingPolicyHash.fromAlike(
                        /** @type {MintingPolicyHashLike} */ (a)
                    ),
                    b
                ]
            } else {
                throw new Error("invalid arguments")
            }
        })()

        this.mintedTokens.addTokens(mph, tokens)

        if (redeemer) {
            if (this.hasNativeScript(mph.bytes)) {
                throw new Error(
                    "redeemer not required when minting using a native script (hint: omit the redeemer)"
                )
            }

            if (!this.hasUplcScript(mph.bytes)) {
                throw new Error(
                    "mint is witnessed by unknown script (hint: attach the script before calling TxBuilder.mint())"
                )
            }

            this.addMintingRedeemer(mph, redeemer)
        } else {
            if (!this.hasNativeScript(mph.bytes)) {
                throw new Error(
                    "no redeemer specified for minted tokens (hint: if this policy is a NativeScript, attach that script before calling TxBuilder.mint())"
                )
            }
        }

        return this
    }

    /**
     * @overload
     * @param {Address<null, any>} address
     * @param {ValueLike} value
     * @returns {TxBuilder<T>}
     *
     * @template TDatum
     * @overload
     * @param {Address<DatumPaymentContext<TDatum>, any>} address
     * @param {ValueLike} value
     * @param {TxOutputDatumCastable<TDatum>} datum
     * @returns {TxBuilder<T>}
     *
     * @template TDatum
     * @param {[
     *   Address<null, any>, ValueLike
     * ] | [
     *   Address<DatumPaymentContext<TDatum>, any>, ValueLike, TxOutputDatumCastable<TDatum>
     * ]} args
     * @returns {TxBuilder<T>}
     */
    pay(...args) {
        if (args.length == 2) {
            return this.payUnsafe(...args)
        } else if (args.length == 3) {
            const [address, value, datum] = args

            return this.payUnsafe(
                address,
                value,
                TxOutputDatum.fromCast(datum, address.spendingContext.datum)
            )
        } else {
            throw new Error("invalid number of args")
        }
    }

    /**
     * @overload
     * @param {AddressLike} address
     * @param {ValueLike} value
     * @returns {TxBuilder<T>}
     *
     * @overload
     * @param {AddressLike} address
     * @param {ValueLike} value
     * @param {TxOutputDatum} datum
     * @returns {TxBuilder<T>}
     *
     * @overload
     * @param {TxOutput | TxOutput[]} output
     * @returns {TxBuilder<T>}
     *
     * @param {[
     *   AddressLike, ValueLike
     * ] | [
     *   AddressLike, ValueLike, TxOutputDatum
     * ] | [
     *   TxOutput | TxOutput[]
     * ]} args
     * @returns {TxBuilder<T>}
     */
    payUnsafe(...args) {
        // handle overloads
        const outputs = (() => {
            if (args.length == 1) {
                return args[0]
            } else if (args.length == 2) {
                return new TxOutput(Address.fromAlike(args[0]), args[1], None)
            } else if (args.length == 3) {
                const datum = args[2]

                return new TxOutput(Address.fromAlike(args[0]), args[1], datum)
            } else {
                throw new Error("invalid arguments")
            }
        })()

        if (Array.isArray(outputs)) {
            outputs.forEach((output) => this.payUnsafe(output))
            return this
        }

        const output = outputs
        this.addOutput(output)

        return this
    }

    /**
     * Include a reference input
     * @param {TxInput[]} utxos
     * @returns {TxBuilder<T>}
     */
    refer(...utxos) {
        utxos.forEach((utxo) => {
            this.addRefInput(utxo)

            const refScript = utxo.output.refScript

            if (refScript) {
                if (refScript instanceof UplcProgramV2) {
                    this.addV2RefScript(refScript)
                } else {
                    throw new Error(
                        "UplcProgramV1 ref scripts aren't yet handled"
                    )
                }
            }
        })

        return this
    }

    /**
     * @overload
     * @param {number} key
     * @param {TxMetadataAttr} value
     * @returns {TxBuilder<T>}
     *
     * @overload
     * @param {{[key: number]: TxMetadataAttr}} attributes
     * @returns {TxBuilder<T>}
     *
     * @param {[number, TxMetadataAttr] | [{[key: number]: TxMetadataAttr}]} args
     * @returns {TxBuilder<T>}
     */
    setMetadata(...args) {
        if (args.length == 2) {
            const [key, value] = args
            this.metadata[key] = value
        } else {
            Object.entries(args[0]).forEach(([key, value]) =>
                this.setMetadata(Number(key), value)
            )
        }

        return this
    }

    /**
     * @overload
     * @param {TxInput<null, any> | TxInput<null, any>[]} utxos
     * @returns {TxBuilder<T>}
     *
     * @template TRedeemer
     * @overload
     * @param {TxInput<SpendingContext<any, any, any, TRedeemer>, any> | TxInput<SpendingContext<any, any, any, TRedeemer>, any>[]} utxos
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder<T>}
     */
    /**
     * @template TRedeemer
     * @param {[
     *   TxInput<null, any> | TxInput<null, any>[]
     * ] | [
     *   TxInput<SpendingContext<any, any, any, TRedeemer>, any> | TxInput<SpendingContext<any, any, any, TRedeemer>, any>[],
     *   TRedeemer
     * ]} args
     * @returns {TxBuilder<T>}
     */
    spend(...args) {
        if (args.length == 1) {
            return this.spendUnsafe(args[0])
        } else if (args.length == 2) {
            const [utxos, redeemer] = args

            if (Array.isArray(utxos)) {
                if (utxos.length == 0) {
                    throw new Error("expected at least one UTxO")
                }

                utxos.forEach((utxo) =>
                    this.attachUplcProgram(utxo.spendingContext.program)
                )
                return this.spendUnsafe(
                    utxos,
                    utxos[0].spendingContext.redeemer.toUplcData(redeemer)
                )
            } else {
                this.attachUplcProgram(utxos.spendingContext.program)

                return this.spendUnsafe(
                    utxos,
                    utxos.spendingContext.redeemer.toUplcData(redeemer)
                )
            }
        } else {
            throw new Error("invalid number of arguments")
        }
    }

    /**
     * Add a UTxO instance as an input to the transaction being built.
     * Throws an error if the UTxO is locked at a script address but a redeemer isn't specified (unless the script is a known `NativeScript`).
     * @param {TxInput | TxInput[]} utxos
     * @param {Option<UplcData>} redeemer
     * @returns {TxBuilder<T>}
     */
    spendUnsafe(utxos, redeemer = None) {
        if (Array.isArray(utxos)) {
            utxos.forEach((utxo) => this.spendUnsafe(utxo, redeemer))

            return this
        }

        const utxo = utxos

        const origOutput = utxo.output
        const spendingCredential = utxo.address.spendingCredential
        const datum = origOutput?.datum

        // add the input (also sorts the inputs)
        this.addInput(utxo)

        if (redeemer) {
            if (!spendingCredential.isValidator()) {
                throw new Error(
                    "input isn't locked by a script, (hint: omit the redeemer)"
                )
            }

            // this cast is needed because Typescript is failing to properly import the type assertions
            if (
                !this.hasUplcScript(
                    /** @type {SpendingCredential<"Validator">} */ (
                        spendingCredential
                    ).validatorHash.bytes
                )
            ) {
                throw new Error(
                    "input is locked by an unknown script (hint: attach the script before calling TxBuilder.spend()"
                )
            }

            this.addSpendingRedeemer(utxo, redeemer)

            if (!datum) {
                throw new Error("expected non-null datum")
            }

            this.addDatum(datum.data)
        } else if (spendingCredential.isValidator()) {
            // redeemerless spending from a validator is only possible if it is a native script

            // this cast is needed because Typescript is failing to properly import the type assertions
            if (
                !this.hasNativeScript(
                    /** @type {SpendingCredential<"Validator">} */ (
                        spendingCredential
                    ).validatorHash.bytes
                )
            ) {
                throw new Error(
                    "input is locked by a script, but redeemer isn't specified (hint: if this is a NativeScript, attach that script before calling TxBuiilder.spend())"
                )
            }
        }

        return this
    }

    /**
     * Set the start of the valid time range by specifying a slot.
     * @param {bigint | number} slot
     * @returns {TxBuilder<T>}
     */
    validFromSlot(slot) {
        this.validFrom = BigInt(slot)

        return this
    }

    /**
     * Set the start of the valid time range by specifying a time.
     * @param {TimeLike} time
     * @returns {TxBuilder<T>}
     */
    validFromTime(time) {
        this.validFrom = timeToDate(time)

        return this
    }

    /**
     * Set the end of the valid time range by specifying a slot.
     * @param {bigint | number} slot
     * @returns {TxBuilder<T>}
     */
    validToSlot(slot) {
        this.validTo = BigInt(slot)

        return this
    }

    /**
     * Set the end of the valid time range by specifying a time.
     * @param {TimeLike} time
     * @returns {TxBuilder<T>}
     */
    validToTime(time) {
        this.validTo = timeToDate(time)

        return this
    }

    /**
     * @param {StakingAddressLike} addr
     * @param {bigint | number} lovelace
     * @returns {TxBuilder<T>}
     */
    withdraw(addr, lovelace) {
        const stakingAddress = StakingAddress.fromAlike(addr)

        /**
         * @type {[StakingAddress, bigint]}
         */
        const entry = [stakingAddress, BigInt(lovelace)]

        const i = this.withdrawals.findIndex(([prev]) =>
            prev.isEqual(stakingAddress)
        )

        if (i == -1) {
            this.withdrawals.push(entry)
        } else {
            // should we throw an error here instead?
            this.withdrawals[i] = entry
        }

        this.withdrawals.sort(([a], [b]) => StakingAddress.compare(a, b))

        return this
    }

    /**
     * Private methods
     */

    /**
     * Doesn't throw an error if already added before
     * @param {UplcData} data
     */
    addDatum(data) {
        if (!this.hasDatum(data)) {
            this.datums.push(data)
        }
    }

    /**
     * Sorts the inputs immediately upon adding
     * @private
     * @param {TxInput} input
     */
    addInput(input) {
        TxInput.append(this.inputs, input, true)
    }

    /**
     * Index is calculated later
     * @private
     * @param {MintingPolicyHashLike} policy
     * @param {UplcData} data
     */
    addMintingRedeemer(policy, data) {
        const mph = MintingPolicyHash.fromAlike(policy)

        if (this.hasMintingRedeemer(mph)) {
            throw new Error("redeemer already added")
        }

        this.mintingRedeemers.push([mph, data])
    }

    /**
     * Sorts that assets in the output if not already sorted (mutates `output`s) (needed by the Flint wallet)
     * Throws an error if any the value entries are non-positive
     * Throws an error if the output doesn't include a datum but is sent to a non-nativescript validator
     * @private
     * @param {TxOutput} output
     */
    addOutput(output) {
        output.value.assertAllPositive()

        const spendingCredential = output.address.spendingCredential

        if (
            isNone(output.datum) &&
            spendingCredential.isValidator() &&
            !this.hasNativeScript(
                /** @type {SpendingCredential<"Validator">} */ (
                    spendingCredential
                ).validatorHash.bytes
            )
        ) {
            throw new Error(
                "TxOutput must include datum when sending to validator which isn't a known NativeScript (hint: add the NativeScript to this transaction first)"
            )
        }

        // sort the tokens in the outputs, needed by the flint wallet
        output.value.assets.sort()

        this.outputs.push(output)
    }

    /**
     * @param {TxInput} utxo
     */
    addRefInput(utxo) {
        TxInput.append(this.refInputs, utxo, true)
    }

    /**
     * Index is calculated later
     * @private
     * @param {TxInput} utxo
     * @param {UplcData} data
     */
    addSpendingRedeemer(utxo, data) {
        if (this.hasSpendingRedeemer(utxo)) {
            throw new Error("redeemer already added")
        }

        this.spendingRedeemers.push([utxo, data])
    }

    /**
     * Doesn't throw an error if already added before
     * @private
     * @param {UplcProgramV1} script
     */
    addV1Script(script) {
        const h = script.hash()
        if (!this.v1Scripts.some((prev) => equalsBytes(prev.hash(), h))) {
            this.v1Scripts.push(script)
        }
    }

    /**
     * Doesn't throw an error if already added before
     * @private
     * @param {UplcProgramV2} script
     */
    addV2Script(script) {
        const h = script.hash()
        if (!this.v2Scripts.some((prev) => equalsBytes(prev.hash(), h))) {
            this.v2Scripts.push(script)
        }
    }

    /**
     * Doesn't throw an error if already added before
     * @private
     * @param {UplcProgramV2} script
     */
    addV2RefScript(script) {
        const h = script.hash()
        if (!this.v2RefScripts.some((prev) => equalsBytes(prev.hash(), h))) {
            this.v2RefScripts.push(script)
        }
    }

    /**
     * @private
     * @param {number[] | MintingPolicyHash | ValidatorHash} hash
     * @returns {UplcProgramV1 | UplcProgramV2}
     */
    getUplcScript(hash) {
        const bytes = Array.isArray(hash) ? hash : hash.bytes

        const v2Script = this.v2Scripts
            .concat(this.v2RefScripts)
            .find((s) => equalsBytes(s.hash(), bytes))

        if (v2Script) {
            return v2Script
        }

        const v1Script = this.v1Scripts.find((s) =>
            equalsBytes(s.hash(), bytes)
        )

        if (v1Script) {
            return v1Script
        }

        if (hash instanceof MintingPolicyHash) {
            throw new Error(
                `script for minting policy ${hash.toHex()} not found`
            )
        } else if (hash instanceof ValidatorHash) {
            throw new Error(`script for validator ${hash.toHex()} not found`)
        } else {
            throw new Error(`script for ${bytesToHex(hash)} not found`)
        }
    }

    /**
     * @param {UplcData} data
     * @returns {boolean}
     */
    hasDatum(data) {
        return this.datums.some((prev) => prev.isEqual(data))
    }

    /**
     * @returns {boolean}
     */
    hasMetadata() {
        return Object.keys(this.metadata).length > 0
    }

    /**
     * @private
     * @param {MintingPolicyHash} mph
     * @returns {boolean}
     */
    hasMintingRedeemer(mph) {
        return this.mintingRedeemers.some(([prev]) => prev.isEqual(mph))
    }

    /**
     * @private
     * @param {number[]} hash
     * @returns {boolean}
     */
    hasNativeScript(hash) {
        return this.nativeScripts.some((s) => equalsBytes(s.hash(), hash))
    }

    /**
     * @returns {boolean}
     */
    hasUplcScripts() {
        return (
            this.v1Scripts.length > 0 ||
            this.v2Scripts.length > 0 ||
            this.v2RefScripts.length > 0
        )
    }

    /**
     * @private
     * @param {number[]} hash
     * @returns {boolean}
     */
    hasUplcScript(hash) {
        return (
            this.hasV1Script(hash) ||
            this.hasV2RefScript(hash) ||
            this.hasV2Script(hash)
        )
    }

    /**
     * @private
     * @param {number[]} hash
     * @returns {boolean}
     */
    hasV1Script(hash) {
        return this.v1Scripts.some((s) => equalsBytes(s.hash(), hash))
    }

    /**
     * @private
     * @param {number[]} hash
     * @returns {boolean}
     */
    hasV2RefScript(hash) {
        return this.v2RefScripts.some((s) => equalsBytes(s.hash(), hash))
    }

    /**
     * @private
     * @param {number[]} hash
     * @returns {boolean}
     */
    hasV2Script(hash) {
        return this.v2Scripts.some((s) => equalsBytes(s.hash(), hash))
    }

    /**
     * @private
     * @param {number[]} hash
     * @returns {boolean}
     */
    hasScript(hash) {
        return (
            this.hasNativeScript(hash) ||
            this.hasV1Script(hash) ||
            this.hasV2RefScript(hash) ||
            this.hasV2Script(hash)
        )
    }

    /**
     * @private
     * @param {TxInput} utxo
     * @returns {boolean}
     */
    hasSpendingRedeemer(utxo) {
        return this.spendingRedeemers.some(([prev]) => prev.isEqual(utxo))
    }

    /**
     * @private
     * @returns {Value}
     */
    sumInputValue() {
        return this.inputs.reduce(
            (prev, input) => prev.add(input.value),
            new Value()
        )
    }

    /**
     * Throws error if any part of the sum is negative (i.e. more is burned than input)
     * @private
     * @returns {Value}
     */
    sumInputAndMintedValue() {
        return this.sumInputValue()
            .add(new Value(0n, this.mintedTokens))
            .assertAllPositive()
    }

    /**
     * Excludes lovelace
     * @returns {Assets}
     */
    sumInputAndMintedAssets() {
        return this.sumInputAndMintedValue().assets
    }

    /**
     * @returns {Value}
     */
    sumOutputValue() {
        return this.outputs.reduce(
            (prev, output) => prev.add(output.value),
            new Value()
        )
    }

    /**
     * Excludes lovelace
     * @returns {Assets}
     */
    sumOutputAssets() {
        return this.sumOutputValue().assets
    }

    /**
     * Private builder methods
     */

    /**
     * @private
     * @param {Address} changeAddress
     */
    balanceAssets(changeAddress) {
        if (changeAddress.spendingCredential.isValidator()) {
            throw new Error("can't send change to validator")
        }

        const inputAssets = this.sumInputAndMintedAssets()

        const outputAssets = this.sumOutputAssets()

        if (inputAssets.isEqual(outputAssets)) {
            return
        } else if (outputAssets.isGreaterThan(inputAssets)) {
            throw new Error("not enough input assets")
        } else {
            const diff = inputAssets.subtract(outputAssets)

            if (this.config.maxAssetsPerChangeOutput) {
                const maxAssetsPerOutput = this.config.maxAssetsPerChangeOutput

                let changeAssets = new Assets()
                let tokensAdded = 0

                diff.getPolicies().forEach((mph) => {
                    const tokens = diff.getPolicyTokens(mph)
                    tokens.forEach(([token, quantity], i) => {
                        changeAssets.addComponent(mph, token, quantity)
                        tokensAdded += 1
                        if (tokensAdded == maxAssetsPerOutput) {
                            this.addOutput(
                                new TxOutput(
                                    changeAddress,
                                    new Value(0n, changeAssets)
                                )
                            )
                            changeAssets = new Assets()
                            tokensAdded = 0
                        }
                    })
                })

                // If we are here and have No assets, they we're done
                if (!changeAssets.isZero()) {
                    this.addOutput(
                        new TxOutput(changeAddress, new Value(0n, changeAssets))
                    )
                }
            } else {
                const changeOutput = new TxOutput(
                    changeAddress,
                    new Value(0n, diff)
                )

                this.addOutput(changeOutput)
            }
        }
    }

    /**
     * @private
     * @param {NetworkParamsHelper} networkParams
     * @param {Address} changeAddress
     * @param {TxInput[]} spareUtxos
     * @param {bigint} baseFee
     * @returns {Option<TxOutput>} - collateral change output which can be corrected later
     */
    balanceCollateral(networkParams, changeAddress, spareUtxos, baseFee) {
        // don't do this step if collateral was already added explicitly
        if (this.collateral.length > 0 || !this.hasUplcScripts()) {
            return
        }

        const minCollateral =
            (baseFee * BigInt(networkParams.minCollateralPct) + 100n) / 100n // integer division that rounds up

        let collateral = 0n
        /**
         * @type {TxInput[]}
         */
        const collateralInputs = []

        /**
         * @param {TxInput[]} inputs
         */
        function addCollateralInputs(inputs) {
            // first try using the UTxOs that already form the inputs, but are locked at script
            const cleanInputs = inputs
                .filter(
                    (utxo) =>
                        !utxo.address.validatorHash &&
                        utxo.value.assets.isZero()
                )
                .sort((a, b) => Number(a.value.lovelace - b.value.lovelace))

            for (let input of cleanInputs) {
                if (collateral > minCollateral) {
                    break
                }

                while (
                    collateralInputs.length >= networkParams.maxCollateralInputs
                ) {
                    collateralInputs.shift()
                }

                collateralInputs.push(input)
                collateral += input.value.lovelace
            }
        }

        addCollateralInputs(this.inputs.slice())
        addCollateralInputs(spareUtxos.map((utxo) => utxo))

        // create the collateral return output if there is enough lovelace
        const changeOutput = new TxOutput(changeAddress, new Value(0n))
        changeOutput.correctLovelace(networkParams)

        if (collateral < minCollateral) {
            throw new Error("unable to find enough collateral input")
        } else {
            if (collateral > minCollateral + changeOutput.value.lovelace) {
                changeOutput.value = new Value(0n)

                changeOutput.correctLovelace(networkParams)

                if (collateral > minCollateral + changeOutput.value.lovelace) {
                    changeOutput.value = new Value(collateral - minCollateral)
                    this.collateralReturn = changeOutput
                } else {
                    console.log(
                        `not setting collateral return: collateral input too low (${collateral})`
                    )
                }
            }
        }

        collateralInputs.forEach((utxo) => {
            this.addCollateral(utxo)
        })

        return changeOutput
    }

    /**
     * @param {{
     *   changeAddress: AddressLike
     *   networkParams?: NetworkParams | NetworkParamsHelper
     *   spareUtxos?: TxInput[]
     * }} props
     * @returns {Tx}
     */
    buildInternal(props) {
        // extract arguments
        const changeAddress = Address.fromAlike(props.changeAddress)
        const networkParams = NetworkParamsHelper.fromAlikeOrDefault(
            props.networkParams
        )
        const spareUtxos = props.spareUtxos ?? []

        const { metadata, metadataHash } = this.buildMetadata()
        const { firstValidSlot, lastValidSlot } =
            this.buildValidityTimeRange(networkParams)

        // TODO: there is no check here to assure that there aren't any redundant scripts included, this is left up the validation of Tx itself

        // balance the non-ada assets, adding necessary change outputs
        this.balanceAssets(changeAddress)

        // start with the max possible fee, minimize later
        const fee = networkParams.maxTxFee

        // balance collateral (if collateral wasn't already set manually)
        const collateralChangeOutput = this.balanceCollateral(
            networkParams,
            changeAddress,
            spareUtxos.slice(),
            fee
        )

        // make sure that each output contains the necessary minimum amount of lovelace
        this.correctOutputs(networkParams)

        // balance the lovelace using maxTxFee as the fee
        const changeOutput = this.balanceLovelace(
            networkParams,
            changeAddress,
            spareUtxos.slice(),
            fee
        )

        // the final fee will never be higher than the current `fee`, so the inputs and outputs won't change, and we will get redeemers with the right indices
        // the scripts executed at this point will not see the correct txHash nor the correct fee
        const redeemers = this.buildRedeemers({
            networkParams,
            fee,
            firstValidSlot,
            lastValidSlot
        })

        const scriptDataHash = this.buildScriptDataHash(
            networkParams,
            redeemers
        )

        // TODO: correct the fee and the changeOutput

        const tx = new Tx(
            new TxBody({
                inputs: this.inputs,
                outputs: this.outputs,
                refInputs: this.refInputs,
                collateral: this.collateral,
                collateralReturn: this.collateralReturn,
                minted: this.mintedTokens,
                withdrawals: this.withdrawals,
                fee,
                firstValidSlot,
                lastValidSlot,
                signers: this.signers,
                dcerts: this.dcerts,
                metadataHash,
                scriptDataHash
            }),
            new TxWitnesses({
                signatures: [],
                datums: this.datums,
                redeemers,
                nativeScripts: this.nativeScripts,
                v1Scripts: this.v1Scripts,
                v2Scripts: this.v2Scripts,
                v2RefScripts: this.v2RefScripts
            }),
            true,
            metadata
        )

        // calculate the min fee
        const finalFee = tx.calcMinFee(networkParams)
        const feeDiff = fee - finalFee

        if (feeDiff < 0n) {
            throw new Error(
                "internal error: expected finalFee to be smaller than maxTxFee"
            )
        }

        // correct the change outputs
        tx.body.fee = finalFee
        changeOutput.value.lovelace += feeDiff // return part of the fee by adding

        if (collateralChangeOutput) {
            const minCollateral = tx.calcMinCollateral(networkParams)

            if (minCollateral > collateralChangeOutput.value.lovelace) {
                throw new Error(
                    "internal error: expected final Collateral to be smaller than initial collateral"
                )
            }

            collateralChangeOutput.value.lovelace = minCollateral
        }

        // do a final validation of the tx
        tx.validate(networkParams, true)

        return tx
    }

    /**
     * Calculates fee and balances transaction by sending an output back to changeAddress.
     * Assumes the changeOutput is always needed.
     * Sets the fee to the max possible tx fee (will be lowered later)
     * Throws error if transaction can't be balanced.
     * Shouldn't be used directly
     * @private
     * @param {NetworkParamsHelper} networkParams
     * @param {Address} changeAddress
     * @param {TxInput[]} spareUtxos - used when there are yet enough inputs to cover everything (eg. due to min output lovelace requirements, or fees)
     * @param {bigint} fee
     * @returns {TxOutput} - change output, will be corrected once the final fee is known
     */
    balanceLovelace(networkParams, changeAddress, spareUtxos, fee) {
        // don't include the changeOutput in this value
        let nonChangeOutputValue = this.sumOutputValue()

        // assume a change output is always needed
        const changeOutput = new TxOutput(changeAddress, new Value(0n))

        changeOutput.correctLovelace(networkParams)

        this.addOutput(changeOutput)

        const minLovelace = changeOutput.value.lovelace

        let inputValue = this.sumInputAndMintedValue()
        let feeValue = new Value(fee)

        nonChangeOutputValue = feeValue.add(nonChangeOutputValue)

        // stake certificates
        const stakeAddrDeposit = new Value(networkParams.stakeAddressDeposit)
        this.dcerts.forEach((dcert) => {
            if (dcert.isRegister()) {
                // in case of stake registrations, count stake key deposits as additional output ADA
                nonChangeOutputValue =
                    nonChangeOutputValue.add(stakeAddrDeposit)
            } else if (/** @type {DCert} */ (dcert).isDeregister()) {
                // in case of stake de-registrations, count stake key deposits as additional input ADA
                inputValue = inputValue.add(stakeAddrDeposit)
            }
        })

        // this is quite restrictive, but we really don't want to touch UTxOs containing assets just for balancing purposes
        const spareAssetUTxOs = spareUtxos.some(
            (utxo) => !utxo.value.assets.isZero()
        )
        spareUtxos = spareUtxos.filter((utxo) => utxo.value.assets.isZero())

        // use some spareUtxos if the inputValue doesn't cover the outputs and fees
        const totalOutputValue = nonChangeOutputValue.add(changeOutput.value)
        while (!inputValue.isGreaterOrEqual(totalOutputValue)) {
            let spare = spareUtxos.pop()

            if (spare === undefined) {
                if (spareAssetUTxOs) {
                    throw new Error(`UTxOs too fragmented`)
                } else {
                    throw new Error(
                        `need ${totalOutputValue.lovelace} lovelace, but only have ${inputValue.lovelace}`
                    )
                }
            } else {
                this.addInput(spare)

                inputValue = inputValue.add(spare.value)
            }
        }

        // use to the exact diff, which is >= minLovelace
        const diff = inputValue.subtract(nonChangeOutputValue)

        if (!diff.assets.isZero()) {
            throw new Error("unexpected unbalanced assets")
        }

        if (diff.lovelace < minLovelace) {
            throw new Error(
                `diff.lovelace=${diff.lovelace} ${typeof diff.lovelace} vs minLovelace=${minLovelace} ${typeof minLovelace}`
            )
        }

        changeOutput.value = diff

        return changeOutput
    }

    /**
     * @private
     * @returns {{
     *   metadata: Option<TxMetadata>, metadataHash: Option<number[]>
     * }}
     */
    buildMetadata() {
        if (this.hasMetadata()) {
            const metadata = new TxMetadata(this.metadata)
            const metadataHash = metadata.hash()

            return { metadata, metadataHash }
        } else {
            return { metadata: None, metadataHash: None }
        }
    }

    /**
     * Redeemers are returned sorted: first the minting redeemers then the spending redeemers
     * (I'm not sure if the sorting is actually necessary)
     * TODO: return profiling information?
     * @private
     * @param {{
     *   fee: bigint
     *   networkParams: NetworkParamsHelper
     *   firstValidSlot: Option<bigint>
     *   lastValidSlot: Option<bigint>
     * }} execContext
     * @returns {TxRedeemer[]}
     */
    buildRedeemers(execContext) {
        const dummyRedeemers = this.buildMintingRedeemers().concat(
            this.buildSpendingRedeemers()
        )

        // we have all the information to create a dummy tx
        const dummyTx = this.buildDummyTxBody(
            execContext.fee,
            execContext.firstValidSlot,
            execContext.lastValidSlot
        )

        const txData = dummyTx.toTxUplcData(
            execContext.networkParams,
            dummyRedeemers,
            this.datums,
            TxId.dummy()
        )

        // rebuild the redeemers now that we can generate the correct ScriptContext
        const redeemers = this.buildMintingRedeemers({ txData }).concat(
            this.buildSpendingRedeemers({ txData })
        )

        return redeemers
    }

    /**
     * @private
     * @param {bigint} fee
     * @param {Option<bigint>} firstValidSlot
     * @param {Option<bigint>} lastValidSlot
     * @returns {TxBody}
     */
    buildDummyTxBody(fee, firstValidSlot, lastValidSlot) {
        return new TxBody({
            inputs: this.inputs,
            outputs: this.outputs,
            refInputs: this.refInputs,
            fee,
            firstValidSlot,
            lastValidSlot,
            signers: this.signers,
            dcerts: this.dcerts,
            withdrawals: this.withdrawals,
            minted: this.mintedTokens
        })
    }

    /**
     * @typedef {{
     *   txData: UplcData
     * }} RedeemerExecContext
     */

    /**
     * The execution itself might depend on the redeemers, so we must also be able to return the redeemers without any execution first
     * @private
     * @param {Option<RedeemerExecContext>} execContext - execution and budget calculation is only performed when this is set
     * @returns {TxRedeemer[]}
     */
    buildMintingRedeemers(execContext = None) {
        return this.mintingRedeemers.map(([mph, data]) => {
            const i = this.mintedTokens
                .getPolicies()
                .findIndex((mph_) => mph_.isEqual(mph))
            let redeemer = TxRedeemer.Minting(i, data)
            const script = this.getUplcScript(mph)

            if (execContext) {
                const purpose = ScriptPurpose.Minting(redeemer, mph)
                const scriptContext = purpose.toScriptContextUplcData(
                    execContext.txData
                )
                const args = [redeemer.data, scriptContext]

                const profile = script.eval(
                    args.map((a) => new UplcDataValue(a))
                )

                redeemer = TxRedeemer.Minting(i, data, profile.cost)
            }

            return redeemer
        })
    }

    /**
     * @private
     * @param {Option<RedeemerExecContext>} execContext - execution and budget calculation is only performed when this is set
     * @returns {TxRedeemer[]}
     */
    buildSpendingRedeemers(execContext = None) {
        return this.spendingRedeemers.map(([utxo, data]) => {
            const i = this.inputs.findIndex((inp) => inp.isEqual(utxo))
            let redeemer = TxRedeemer.Spending(i, data)

            const vh = expectSome(utxo.address.validatorHash)
            const script = this.getUplcScript(vh)

            if (execContext) {
                const datum = expectSome(utxo.datum?.data)
                const purpose = ScriptPurpose.Spending(redeemer, utxo.id)
                const scriptContext = purpose.toScriptContextUplcData(
                    execContext.txData
                )

                const args = [datum, data, scriptContext]

                const profile = script.eval(
                    args.map((a) => new UplcDataValue(a))
                )

                redeemer = TxRedeemer.Spending(i, data, profile.cost)
            }

            return redeemer
        })
    }

    /**
     * @private
     * @param {NetworkParamsHelper} networkParams
     * @param {TxRedeemer[]} redeemers
     * @returns {Option<number[]>} - returns null if there are no redeemers
     */
    buildScriptDataHash(networkParams, redeemers) {
        if (redeemers.length > 0) {
            return calcScriptDataHash(networkParams, this.datums, redeemers)
        } else {
            return None
        }
    }

    /**
     * @private
     * @param {NetworkParamsHelper} networkParams
     * @returns {{
     *   firstValidSlot: Option<bigint>
     *   lastValidSlot: Option<bigint>
     * }}
     */
    buildValidityTimeRange(networkParams) {
        /**
         * @param {bigint | Date} slotOrTime
         */
        function slotOrTimeToSlot(slotOrTime) {
            if (slotOrTime instanceof Date) {
                return networkParams.timeToSlot(slotOrTime.getTime())
            } else {
                return slotOrTime
            }
        }

        return {
            firstValidSlot: this.validFrom
                ? slotOrTimeToSlot(this.validFrom)
                : None,
            lastValidSlot: this.validTo ? slotOrTimeToSlot(this.validTo) : None
        }
    }

    /**
     * Makes sure each output contains the necessary min lovelace.
     * @private
     * @param {NetworkParamsHelper} networkParams
     */
    correctOutputs(networkParams) {
        this.outputs.forEach((output) => output.correctLovelace(networkParams))
    }
}
