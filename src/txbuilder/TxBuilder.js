import { bytesToHex, equalsBytes, toInt } from "@helios-lang/codec-utils"
import {
    DEFAULT_NETWORK_PARAMS,
    addValues,
    appendTxInput,
    calcRefScriptsSize,
    calcScriptDataHash,
    compareStakingAddresses,
    hashNativeScript,
    makeAddress,
    makeAssets,
    makeAssetClass,
    makeCertifyingPurpose,
    makeDelegationDCert,
    makeDeregistrationDCert,
    makeDummyTxId,
    makeMintingPolicyHash,
    makeMintingPurpose,
    makeNetworkParamsHelper,
    makeRewardingPurpose,
    makeScriptContextV2,
    makeSpendingPurpose,
    makeTx,
    makeTxBody,
    makeTxCertifyingRedeemer,
    makeTxMetadata,
    makeTxMintingRedeemer,
    makeTxOutput,
    makeTxOutputDatum,
    makeTxRewardingRedeemer,
    makeTxSpendingRedeemer,
    makeTxWitnesses,
    makeValue,
    toTime,
    makePubKeyHash
} from "@helios-lang/ledger"
import {
    expectDefined,
    isLeft,
    isRight,
    isUndefined
} from "@helios-lang/type-utils"
import { makeUplcDataValue, UplcRuntimeError } from "@helios-lang/uplc"

/**
 * @import { BytesLike, IntLike } from "@helios-lang/codec-utils"
 * @import { Address, AssetClass, AssetClassLike, Assets, DatumPaymentContext, DCert, MintingContext, MintingPolicyHash, MintingPolicyHashLike, NativeScript, NetworkParams, NetworkParamsHelper, PubKeyHash, PubKeyHashLike, ShelleyAddress, ShelleyAddressLike, SpendingContext, StakingAddress, StakingAddressLike, StakingCredential, StakingContext, StakingValidatorHash, TimeLike, TokenValue, Tx, TxBody, TxInfo, TxInput, TxMetadata, TxMetadataAttr, TxOutput, TxOutputDatum, TxOutputDatumCastable, TxRedeemer, ValidatorHash, Value, ValueLike } from "@helios-lang/ledger"
 * @import { Either } from "@helios-lang/type-utils"
 * @import { CekResult, Cost, UplcLogger, UplcData, UplcProgramV1, UplcProgramV2 } from "@helios-lang/uplc"
 * @import { BabelFeeAgentOptions, ExBudgetModifier, LazyRedeemerData, TxBuilder, TxBuilderConfig, TxBuilderFinalConfig } from "../index.js"
 */

/**
 * @typedef {Object} RedeemerExecContext
 * @prop {bigint} fee
 * @prop {number | undefined} firstValidSlot
 * @prop {number | undefined} lastValidSlot
 * @prop {boolean} [throwBuildPhaseScriptErrors] - if false, script errors will be thrown only during validate phase of the build.  Default is true for build(), false for buildUnsafe()
 * @prop {UplcLogger} [logOptions] - an externally-provided logger
 * @prop {NetworkParams} networkParams
 * @prop {ExBudgetModifier} [modifyExBudget]
 */

/**
 * @typedef {RedeemerExecContext & {txInfo: TxInfo;}} RedeemerBuildContext
 */

/**
 * @param {TxBuilderConfig} config
 * @returns {TxBuilder}
 */
export function makeTxBuilder(config) {
    return new TxBuilderImpl(config)
}

/**
 * @implements {TxBuilder}
 */
class TxBuilderImpl {
    /**
     * @readonly
     * @type {TxBuilderConfig}
     */
    config

    /**
     * @private
     * @type {TxInput[]}
     */
    collateral

    /**
     * Set when the TxBuilder itself adds collateral.
     * Used for distinguishing between external and internal collateral
     * adds, and for recomputing collateral if the effective fee changes
     * for any reason in case of a second call to build()
     * @private
     * @type {boolean}
     */
    addedCollatoral

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
    _inputs

    /**
     * @private
     * @type {{[key: number]: TxMetadataAttr}}
     */
    metadata

    /**
     * @private
     * @type {Assets}
     */
    _mintedTokens

    /**
     * @private
     * @type {[MintingPolicyHash, UplcData | LazyRedeemerData][]}
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
    _outputs

    /**
     * @private
     * @type {TxInput[]}
     */
    _refInputs

    /**
     * @private
     * @type {PubKeyHash[]}
     */
    _signers

    /**
     * @private
     * @type {[TxInput, UplcData | LazyRedeemerData][]}
     */
    spendingRedeemers

    /**
     * Upon finalization the slot is calculated and stored in the body
     * @private
     * @type {Either<{slot: number}, {timestamp: number}> | undefined}
     */
    validTo

    /**
     * Upon finalization the slot is calculated and stored in the body
     * @private
     * @type {Either<{slot: number}, {timestamp: number}> | undefined}
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
     * @private
     * @type {[StakingAddress, UplcData | LazyRedeemerData][]}
     */
    rewardingRedeemers

    /**
     * @private
     * @type {[DCert, UplcData | LazyRedeemerData][]}
     */
    certifyingRedeemers

    /**
     * this.apply() can take functions that return promises, these must be awaited before doing anything else in .build()
     * @private
     * @type {Promise[]}
     */
    pending

    /**
     * @param {TxBuilderConfig} config
     */
    constructor(config) {
        this.config = config
        this.reset()
    }

    /**
     * @type {TxInput[]}
     */
    get inputs() {
        return this._inputs
    }

    /**
     * @type {Assets}
     */
    get mintedTokens() {
        return this._mintedTokens
    }

    /**
     * @type {TxOutput[]}
     */
    get outputs() {
        return this._outputs
    }

    /**
     * @type {TxInput[]}
     */
    get refInputs() {
        return this._refInputs
    }

    /**
     * @type {PubKeyHash[]}
     */
    get signers() {
        return this._signers
    }

    /**
     * Builds and runs validation logic on the transaction, **throwing any validation errors found**
     * @remarks
     * The resulting transaction may likely still require
     * {@link Tx.addSignature} / {@link Tx.addSignatures} before
     * it is submitted to the network.
     *
     * The
     * {@link tx.validate|transaction-validation logic} run will throw an
     * error if the transaction is invalid for any reason, including script errors.
     *
     * The `config.throwBuildPhaseScriptErrors` default (true) will throw script errors
     * during the build phase, but you can set it to false to defer those errors to the validate
     * phase.
     *
     * Use {@link buildUnsafe} to get a transaction with possible
     * {@link Tx.hasValidationError} set, and no thrown exception.
     *
     * @param {TxBuilderFinalConfig} config
     * @returns {Promise<Tx>}
     */
    async build(config) {
        const tx = await this.buildUnsafe({
            throwBuildPhaseScriptErrors: true,
            ...config
        })

        if (tx.hasValidationError) {
            if ("string" == typeof tx.hasValidationError) {
                throw new Error(tx.hasValidationError)
            }
            // the only type that can be left here is a UplcRuntimeError
            throw tx.hasValidationError
        }

        return tx
    }

    /**
     * Builds and runs validation logic on the transaction
     * @remarks
     * Always returns a built transaction that has been validation-checked
     *
     * ... unless the `throwBuildPhaseScriptErrors` option is true, then any script errors
     * found during transaction-building phase will be thrown, and the full transaction
     * validation is not run.
     *
     * Caller should check {@link Tx.hasValidationError}, which will be
     * `false` or a validation error string, in case any transaction validations
     * are found.
     *
     * Use {@link TxBuilder.build} if you want validation errors to be thrown.
     * @param {TxBuilderFinalConfig} config
     * @returns {Promise<Tx>}
     */
    async buildUnsafe(config) {
        // extract arguments
        const changeAddress = makeAddress(await config.changeAddress)
        const throwBuildPhaseScriptErrors =
            config.throwBuildPhaseScriptErrors ?? false
        /**
         * @type {NetworkParams}
         */
        const params =
            config?.networkParams instanceof Promise
                ? await config.networkParams
                : (config?.networkParams ?? DEFAULT_NETWORK_PARAMS())
        const helper = makeNetworkParamsHelper(params)
        const spareUtxos = (
            config.spareUtxos instanceof Promise
                ? await config.spareUtxos
                : (config.spareUtxos ?? [])
        ).filter((utxo) => !this._inputs.some((input) => input.isEqual(utxo)))
        const babelFeeAgent = config.babelFeeAgent

        // await the remaining pending applications
        for (let p of this.pending) {
            // must be executed in order, hence the for loop instead of Promise.all()
            await p
        }

        const { metadata, metadataHash } = this.buildMetadata()
        const { firstValidSlot, lastValidSlot } =
            this.buildValidityTimeRange(params)

        // TODO: there is no check here to assure that there aren't any redundant scripts included, this is left up the validation of Tx itself

        // balance the non-ada assets, adding necessary change outputs
        let maxAssetsPerChangeOutput = config.maxAssetsPerChangeOutput
        if (!maxAssetsPerChangeOutput) {
            maxAssetsPerChangeOutput = this._inputs
                .concat(spareUtxos)
                .reduce(
                    (prev, utxo) =>
                        Math.max(prev, utxo.value.assets.countTokens()),
                    1
                )
        }

        // these assetChangeOutputs are used to balance babel fees
        let assetChangeOutputs = this.balanceAssets(
            changeAddress,
            maxAssetsPerChangeOutput
        )

        // in the rare case that no asset change outputs are created, look for all UTxOs at the change address
        // if none are found, explicitly create a single change output
        if (babelFeeAgent && assetChangeOutputs.length == 0) {
            assetChangeOutputs = this._outputs.filter((output) =>
                output.address.isEqual(changeAddress)
            )

            if (assetChangeOutputs.length == 0) {
                const output = makeTxOutput(changeAddress, 0)

                this.addOutput(output)
                assetChangeOutputs.push(output)
            }
        }

        // start with the max possible fee, minimize later
        const fee = helper.calcMaxConwayTxFee(
            calcRefScriptsSize(this._inputs, this._refInputs)
        )

        // balance collateral (if collateral wasn't already set manually)
        const collateralChangeOutput = this.balanceCollateral(
            params,
            babelFeeAgent ? babelFeeAgent.address : changeAddress,
            babelFeeAgent ? babelFeeAgent.utxos.slice() : spareUtxos.slice(),
            fee
        )

        // make sure that each output contains the necessary minimum amount of lovelace
        this.correctOutputs(params)

        // balance the lovelace using maxTxFee as the fee
        const changeOutput = this.balanceLovelace(
            params,
            babelFeeAgent ? babelFeeAgent.address : changeAddress,
            babelFeeAgent ? babelFeeAgent.utxos.slice() : spareUtxos.slice(),
            fee,
            config.allowDirtyChangeOutput ?? false
        )

        // returns 0n if babelFeeAgent is undefined
        let babelFeeTokens = this.balanceBabelFee(
            babelFeeAgent,
            changeOutput,
            assetChangeOutputs,
            spareUtxos,
            params
        )

        await this.grabRefScriptsFromRegistry()

        // the final fee will never be higher than the current `fee`, so the inputs and outputs won't change, and we will get redeemers with the right indices
        // the scripts executed at this point will not see the correct txHash nor the correct fee
        const redeemers = await this.buildRedeemers({
            networkParams: params,
            fee,
            firstValidSlot,
            lastValidSlot,
            throwBuildPhaseScriptErrors,
            logOptions: config.logOptions, // NOTE: has an internal default null-logger
            modifyExBudget: config.modifyExBudget
        })

        const scriptDataHash = this.buildScriptDataHash(params, redeemers)

        // TODO: correct the fee and the changeOutput

        const tx = makeTx(
            makeTxBody({
                encodingConfig: config.bodyEncodingConfig,
                inputs: this._inputs,
                outputs: this._outputs,
                refInputs: this._refInputs,
                collateral: this.collateral,
                collateralReturn: this.collateralReturn,
                minted: this._mintedTokens,
                withdrawals: this.withdrawals,
                fee,
                firstValidSlot,
                lastValidSlot,
                signers: this._signers,
                dcerts: this.dcerts,
                metadataHash,
                scriptDataHash
            }),
            makeTxWitnesses({
                encodingConfig: config.witnessesEncodingConfig,
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
        const finalFee = tx.calcMinFee(params)
        const feeDiff = fee - finalFee

        if (feeDiff < 0n) {
            throw new Error(
                "internal error: expected finalFee to be smaller than maxTxFee"
            )
        }

        tx.body.fee = finalFee
        changeOutput.value.lovelace += feeDiff // return part of the fee by adding

        //
        let iter = 0
        while (true) {
            if (iter >= 5) {
                throw new Error(
                    "failed to converge during babel (and collateral) fee correction"
                )
            }

            if (collateralChangeOutput) {
                // console.log(" -- recomputing collateral")
                const minCollateral = tx.calcMinCollateral(params)

                const collateralInput = /** @type {Value} */ (
                    addValues(tx.body.collateral)
                ).lovelace

                collateralChangeOutput.value.lovelace =
                    collateralInput - minCollateral
            }

            if (babelFeeAgent) {
                babelFeeTokens = this.correctBabelFee(
                    babelFeeAgent,
                    babelFeeTokens,
                    changeOutput,
                    assetChangeOutputs,
                    params
                )
            }

            const finalFee = tx.calcMinFee(params)
            if (finalFee > tx.body.fee) {
                // only keep correcting if more fee is needed
                const feeDiff = finalFee - tx.body.fee
                tx.body.fee = finalFee
                changeOutput.value.lovelace -= feeDiff // subtract fee from changeOutput
            } else {
                break
            }

            iter += 1
        }

        if (config.beforeValidate) {
            await config.beforeValidate(tx)
        }
        return tx.validateUnsafe(params, { ...config, strict: true })
    }

    /**
     * @returns {TxBuilder}
     */
    reset() {
        this.collateral = []
        this.addedCollatoral = false
        this.datums = []
        this.dcerts = []
        this._inputs = []
        this.metadata = {}
        this._mintedTokens = makeAssets()
        this.mintingRedeemers = []
        this.nativeScripts = []
        this._outputs = []
        this._refInputs = []
        this._signers = []
        this.spendingRedeemers = []
        this.validTo = undefined
        this.validFrom = undefined
        this.v1Scripts = []
        this.v2RefScripts = []
        this.v2Scripts = []
        this.withdrawals = []
        this.rewardingRedeemers = []
        this.certifyingRedeemers = []
        this.pending = []

        return this
    }

    /**
     * @param {TxInput | TxInput[]} utxo
     * @returns {TxBuilder}
     */
    addCollateral(utxo) {
        if (Array.isArray(utxo)) {
            utxo.forEach((utxo) => this.addCollateral(utxo))
            return this
        } else {
            appendTxInput(this.collateral, utxo, true)
            return this
        }
    }

    /**
     * @param {DCert} dcert
     * @returns {TxBuilder}
     */
    addDCert(dcert) {
        this.dcerts.push(dcert)

        if (
            dcert.kind == "DelegationDCert" ||
            dcert.kind == "DeregistrationDCert"
        ) {
            if (dcert.credential.kind == "PubKeyHash") {
                this.addSigners(dcert.credential)
            }
        }

        return this
    }

    /**
     * Sorts that assets in the output if not already sorted (mutates `output`s) (needed by the Flint wallet)
     * Throws an error if any the value entries are non-positive
     * Throws an error if the output doesn't include a datum but is sent to a non-nativescript validator
     * @param {TxOutput[]} outputs
     * @returns {TxBuilder}
     */
    addOutput(...outputs) {
        for (let output of outputs) {
            output.value.assertAllPositive()

            if (output.address.era != "Shelley") {
                throw new Error(`unhandled ${output.address.era} era address`)
            }

            const spendingCredential = output.address.spendingCredential

            if (
                isUndefined(output.datum) &&
                spendingCredential.kind == "ValidatorHash" &&
                !this.hasNativeScript(spendingCredential.bytes)
            ) {
                throw new Error(
                    "TxOutput must include datum when sending to validator which isn't a known NativeScript (hint: add the NativeScript to this transaction first)"
                )
            }

            // sort the tokens in the outputs, needed by the flint wallet
            output.value.assets.sort()

            this._outputs.push(output)
        }

        return this
    }

    /**
     * @param {PubKeyHash[]} hash
     * @returns {TxBuilder}
     */
    addSigners(...hash) {
        hash.forEach((hash) => {
            if (!this._signers.some((prev) => prev.isEqual(hash))) {
                this._signers.push(hash)
            }
        })

        return this
    }

    /**
     * Apply a function to the TxBuilder instance
     * Useful for chaining compositions of TxBuilder mutations
     * @param {(b: TxBuilder) => any | Promise<any>} fn - the return value is unused
     * @returns {TxBuilder}
     */
    apply(fn) {
        const maybePromise = fn(this)

        if (maybePromise instanceof Promise) {
            this.pending.push(maybePromise)
        }

        return this
    }

    /**
     * @param {NativeScript} script
     * @returns {TxBuilder}
     */
    attachNativeScript(script) {
        if (!this.hasNativeScript(hashNativeScript(script))) {
            this.nativeScripts.push(script)
        }

        return this
    }

    /**
     * @param {UplcProgramV1 | UplcProgramV2} program
     * @return {TxBuilder}
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
     * @param {PubKeyHash} hash
     * @param {PubKeyHashLike} poolId
     * @returns {TxBuilder}
     */
    delegateWithoutRedeemer(hash, poolId) {
        return this.delegateUnsafe(hash, poolId)
    }

    /**
     * @template TRedeemer
     * @param {StakingValidatorHash<StakingContext<any, TRedeemer>>} hash
     * @param {PubKeyHashLike} poolId
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder}
     */
    delegateWithRedeemer(hash, poolId, redeemer) {
        this.attachUplcProgram(hash.context.program)

        const redeemerData = hash.context.redeemer.toUplcData(redeemer)

        return this.delegateUnsafe(hash, poolId, redeemerData)
    }

    /**
     * @param {StakingCredential} hash
     * @param {PubKeyHashLike} poolId
     * @param {UplcData | LazyRedeemerData | undefined} redeemer
     * @returns {TxBuilder}
     */
    delegateUnsafe(hash, poolId, redeemer = undefined) {
        const dcert = makeDelegationDCert(hash, makePubKeyHash(poolId))
        this.addDCert(dcert)

        if (hash.kind == "StakingValidatorHash") {
            if (redeemer) {
                if (this.hasNativeScript(hash.bytes)) {
                    throw new Error(
                        "redeemer not required when certifying using a native script (hint: omit the redeemer)"
                    )
                }

                if (!this.hasUplcScript(hash.bytes)) {
                    throw new Error(
                        "certification is witnessed by unknown script (hint: attach the script before calling TxBuilder.delegate())"
                    )
                }

                this.addCertifyingRedeemer(dcert, redeemer)
            } else {
                if (!this.hasNativeScript(hash.bytes)) {
                    throw new Error(
                        "no redeemer specified for DCert (hint: if this policy is a NativeScript, attach that script before calling TxBuilder.delegate())"
                    )
                }
            }
        }

        return this
    }

    /**
     * @param {PubKeyHash} hash
     * @returns {TxBuilder}
     */
    deregisterWithoutRedeemer(hash) {
        return this.deregisterUnsafe(hash)
    }

    /**
     * @template TRedeemer
     * @param {StakingValidatorHash<StakingContext<any, TRedeemer>>} hash
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder}
     */
    deregisterWithRedeemer(hash, redeemer) {
        this.attachUplcProgram(hash.context.program)

        const redeemerData = hash.context.redeemer.toUplcData(redeemer)

        return this.deregisterUnsafe(hash, redeemerData)
    }

    /**
     * @param {StakingCredential} hash
     * @param {UplcData | LazyRedeemerData | undefined} redeemer
     * @returns {TxBuilder}
     */
    deregisterUnsafe(hash, redeemer = undefined) {
        const dcert = makeDeregistrationDCert(hash)
        this.addDCert(dcert)

        if (hash.kind == "StakingValidatorHash") {
            if (redeemer) {
                if (this.hasNativeScript(hash.bytes)) {
                    throw new Error(
                        "redeemer not required when certifying using a native script (hint: omit the redeemer)"
                    )
                }

                if (!this.hasUplcScript(hash.bytes)) {
                    throw new Error(
                        "certification is witnessed by unknown script (hint: attach the script before calling TxBuilder.delegate())"
                    )
                }

                this.addCertifyingRedeemer(dcert, redeemer)
            } else {
                if (!this.hasNativeScript(hash.bytes)) {
                    throw new Error(
                        "no redeemer specified for DCert (hint: if this policy is a NativeScript, attach that script before calling TxBuilder.delegate())"
                    )
                }
            }
        }

        return this
    }

    /**
     * Adds minting instructions to the transaction without a redeemer
     * @param {TokenValue} token
     * @returns {TxBuilder}
     */
    mintTokenValueWithoutRedeemer(token) {
        return this.mintAssetClassUnsafe(
            token.assetClass,
            token.quantity,
            undefined
        )
    }

    /**
     * Adds minting instructions to the transaction, given a transaction context supporting redeemer transformation
     * @remarks Use {@link mintUnsafe} if you don't have such a transaction context.
     * @template TRedeemer
     * @param {TokenValue<MintingContext<any, TRedeemer>>} token
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder}
     */
    mintTokenValueWithRedeemer(token, redeemer) {
        const context = token.assetClass.mph.context
        // 2-arg form A
        this.attachUplcProgram(context.program)

        return this.mintAssetClassUnsafe(
            token.assetClass,
            token.quantity,
            (_tx) => context.redeemer.toUplcData(redeemer)
        )
    }

    /**
     * Adds minting instructions to the transaction without a redeemer
     * @param {AssetClass} assetClass
     * @param {IntLike} quantity
     * @returns {TxBuilder}
     */
    mintAssetClassWithoutRedeemer(assetClass, quantity) {
        return this.mintAssetClassUnsafe(assetClass, quantity, undefined)
    }

    /**
     * @template TRedeemer
     * Adds minting instructions to the transaction, given a transaction context supporting redeemer transformation
     * @param {AssetClass<MintingContext<any, TRedeemer>>} assetClass
     * @param {IntLike} quantity
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder}
     */
    mintAssetClassWithRedeemer(assetClass, quantity, redeemer) {
        const context = assetClass.mph.context

        this.attachUplcProgram(context.program)

        return this.mintAssetClassUnsafe(assetClass, quantity, (_tx) =>
            context.redeemer.toUplcData(redeemer)
        )
    }

    /**
     * @template TRedeemer
     * Adds minting instructions to the transaction, given a transaction context supporting redeemer transformation
     * @param {AssetClass<MintingContext<any, TRedeemer>>} assetClass
     * @param {IntLike} quantity
     * @param {LazyRedeemerData<TRedeemer>} redeemer
     * @returns {TxBuilder}
     */
    mintAssetClassWithLazyRedeemer(assetClass, quantity, redeemer) {
        const context = assetClass.mph.context

        this.attachUplcProgram(context.program)

        return this.mintAssetClassUnsafe(assetClass, quantity, async (tx) => {
            const r = redeemer(tx)
            const redeemerData = r instanceof Promise ? await r : r

            return context.redeemer.toUplcData(redeemerData)
        })
    }

    /**
     * Adds minting instructions to the transaction without a redeemer
     * @param {MintingPolicyHash} policy
     * @param {[BytesLike, IntLike][]} tokens
     * @returns {TxBuilder}
     */
    mintPolicyTokensWithoutRedeemer(policy, tokens) {
        return this.mintPolicyTokensUnsafe(policy, tokens, undefined)
    }

    /**
     * @template TRedeemer
     * Adds minting instructions to the transaction, given a transaction context supporting redeemer transformation
     * @param {MintingPolicyHash<MintingContext<any, TRedeemer>>} policy
     * @param {[BytesLike, IntLike][]} tokens
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder}
     */
    mintPolicyTokensWithRedeemer(policy, tokens, redeemer) {
        this.attachUplcProgram(policy.context.program)

        return this.mintPolicyTokensUnsafe(policy, tokens, (_tx) =>
            policy.context.redeemer.toUplcData(redeemer)
        )
    }

    /**
     * @param {AssetClassLike} assetClass
     * @param {IntLike} quantity
     * @param {UplcData | LazyRedeemerData | undefined} redeemer - can be None when minting from a Native script (but not set by default)
     * @returns {TxBuilder}
     */
    mintAssetClassUnsafe(assetClass, quantity, redeemer = undefined) {
        const ac = makeAssetClass(assetClass)

        const mph = ac.mph
        const tokens = [
            /** @type {[number[], IntLike]} */ ([ac.tokenName, quantity])
        ]

        return this.mintPolicyTokensUnsafe(mph, tokens, redeemer)
    }

    /**
     * Mint a list of tokens associated with a given `MintingPolicyHash`.
     * @remarks
     * Throws an error if the given `MintingPolicyHash` was already used in a previous call to `mint()`.
     * The token names can either by a list of bytes or a hexadecimal string.
     *
     * Also throws an error if the redeemer is `undefined`, and the minting policy isn't a known `NativeScript`.
     * @param {MintingPolicyHashLike} policy
     * @param {[BytesLike, IntLike][]} tokens - list of pairs of [tokenName, quantity], tokenName can be list of bytes or hex-string
     * @param {UplcData | LazyRedeemerData | undefined} redeemer - can be None when minting from a Native script (but not set by default)
     * @returns {TxBuilder}
     */
    mintPolicyTokensUnsafe(policy, tokens, redeemer = undefined) {
        const mph = makeMintingPolicyHash(policy)

        this._mintedTokens.addPolicyTokens(mph, tokens)

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
     * @param {ShelleyAddress} address
     * @param {ValueLike} value
     * @returns {TxBuilder}
     */
    payWithoutDatum(address, value) {
        return this.payUnsafe(address, value)
    }

    /**
     * @template TDatum
     * @param {ShelleyAddress<ValidatorHash<DatumPaymentContext<TDatum>>>} address
     * @param {ValueLike} value
     * @param {TxOutputDatumCastable<TDatum>} datum
     * @returns {TxBuilder}
     */
    payWithDatum(address, value, datum) {
        const context = address.spendingCredential.context

        return this.payUnsafe(
            address,
            value,
            makeTxOutputDatum(datum, context.datum)
        )
    }

    /**
     * @param {ShelleyAddressLike} address
     * @param {ValueLike} value
     * @param {TxOutputDatum | undefined} datum
     * @returns {TxBuilder}
     */
    payUnsafe(address, value, datum = undefined) {
        const output = makeTxOutput(makeAddress(address), value, datum)

        return this.addOutput(output)
    }

    /**
     * Include a reference input
     * @param {TxInput[]} utxos
     * @returns {TxBuilder}
     */
    refer(...utxos) {
        utxos.forEach((utxo) => {
            this.addRefInput(utxo)

            const refScript = utxo.output.refScript

            if (refScript) {
                if (refScript.plutusVersion == "PlutusScriptV2") {
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
     * @param {number} key
     * @param {TxMetadataAttr} value
     * @returns {TxBuilder}
     */
    setMetadataAttribute(key, value) {
        this.metadata[key] = value

        return this
    }

    /**
     * @param {{[key: number]: TxMetadataAttr}} attributes
     * @returns {TxBuilder}
     */
    setMetadataAttributes(attributes) {
        Object.entries(attributes).forEach(([key, value]) =>
            this.setMetadataAttribute(Number(key), value)
        )

        return this
    }

    /**
     * @param {TxInput<PubKeyHash>[]} utxos
     * @returns {TxBuilder}
     */
    spendWithoutRedeemer(...utxos) {
        return this.spendUnsafe(utxos)
    }

    /**
     * @template TRedeemer
     * @param {TxInput<ValidatorHash<SpendingContext<any, any, any, TRedeemer>>> | TxInput<ValidatorHash<SpendingContext<any, any, any, TRedeemer>>>[]} utxos
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder}
     */
    spendWithRedeemer(utxos, redeemer) {
        if (Array.isArray(utxos)) {
            if (utxos.length == 0) {
                throw new Error("expected at least one UTxO")
            }

            utxos.forEach((utxo) =>
                this.attachUplcProgram(getTxInputSpendingContext(utxo).program)
            )

            return this.spendUnsafe(utxos, (_tx) =>
                getTxInputSpendingContext(utxos[0]).redeemer.toUplcData(
                    redeemer
                )
            )
        } else {
            this.attachUplcProgram(getTxInputSpendingContext(utxos).program)

            return this.spendUnsafe(utxos, (_tx) =>
                getTxInputSpendingContext(utxos).redeemer.toUplcData(redeemer)
            )
        }
    }

    /**
     * @template TRedeemer
     * @param {TxInput<ValidatorHash<SpendingContext<any, any, any, TRedeemer>>> | TxInput<ValidatorHash<SpendingContext<any, any, any, TRedeemer>>>[]} utxos
     * @param {LazyRedeemerData<TRedeemer>} redeemer
     * @returns {TxBuilder}
     */
    spendWithLazyRedeemer(utxos, redeemer) {
        if (Array.isArray(utxos)) {
            if (utxos.length == 0) {
                throw new Error("expected at least one UTxO")
            }

            utxos.forEach((utxo) =>
                this.attachUplcProgram(getTxInputSpendingContext(utxo).program)
            )

            return this.spendUnsafe(utxos, async (tx) => {
                const r = redeemer(tx)
                const redeemerData = r instanceof Promise ? await r : r
                return getTxInputSpendingContext(utxos[0]).redeemer.toUplcData(
                    redeemerData
                )
            })
        } else {
            this.attachUplcProgram(getTxInputSpendingContext(utxos).program)

            return this.spendUnsafe(utxos, async (tx) => {
                const r = redeemer(tx)
                const redeemerData = r instanceof Promise ? await r : r
                return getTxInputSpendingContext(utxos).redeemer.toUplcData(
                    redeemerData
                )
            })
        }
    }

    /**
     * Add a UTxO instance as an input to the transaction being built.
     * Throws an error if the UTxO is locked at a script address but a redeemer isn't specified (unless the script is a known `NativeScript`).
     * @param {TxInput | TxInput[]} utxos
     * @param {UplcData | LazyRedeemerData | undefined} redeemer
     * @returns {TxBuilder}
     */
    spendUnsafe(utxos, redeemer = undefined) {
        if (Array.isArray(utxos)) {
            utxos.forEach((utxo) => this.spendUnsafe(utxo, redeemer))

            return this
        }

        const utxo = utxos

        const origOutput = utxo.output

        if (utxo.address.era != "Shelley") {
            throw new Error(`unexpected ${utxo.address.era} era address`)
        }

        const spendingCredential = utxo.address.spendingCredential
        const datum = origOutput?.datum

        // add the input (also sorts the inputs)
        this.addInput(utxo)

        if (redeemer) {
            if (spendingCredential.kind != "ValidatorHash") {
                throw new Error(
                    "input isn't locked by a script, (hint: omit the redeemer)"
                )
            }

            // this cast is needed because Typescript is failing to properly import the type assertions
            if (!this.hasUplcScript(spendingCredential.bytes)) {
                throw new Error(
                    "input is locked by an unknown script (hint: attach the script before calling TxBuilder.spend()"
                )
            }

            this.addSpendingRedeemer(utxo, redeemer)

            if (!datum) {
                throw new Error("expected non-null datum")
            }

            if (datum.kind == "HashedTxOutputDatum") {
                this.addDatum(
                    expectDefined(
                        datum.data,
                        "datum data of HashedTxOutputDatum undefined"
                    )
                )
            }
        } else if (spendingCredential.kind == "ValidatorHash") {
            // redeemerless spending from a validator is only possible if it is a native script

            // this cast is needed because Typescript is failing to properly import the type assertions
            if (!this.hasNativeScript(spendingCredential.bytes)) {
                throw new Error(
                    "input is locked by a script, but redeemer isn't specified (hint: if this is a NativeScript, attach that script before calling TxBuiilder.spend())"
                )
            }
        }

        return this
    }

    /**
     * Set the start of the valid time range by specifying a slot.
     * @param {IntLike} slot
     * @returns {TxBuilder}
     */
    validFromSlot(slot) {
        this.validFrom = { left: { slot: toInt(slot) } }

        return this
    }

    /**
     * Set the start of the valid time range by specifying a time.
     * @param {TimeLike} time
     * @returns {TxBuilder}
     */
    validFromTime(time) {
        this.validFrom = { right: { timestamp: toTime(time) } }

        return this
    }

    /**
     * Set the end of the valid time range by specifying a slot.
     * @param {IntLike} slot
     * @returns {TxBuilder}
     */
    validToSlot(slot) {
        this.validTo = { left: { slot: toInt(slot) } }

        return this
    }

    /**
     * Set the end of the valid time range by specifying a time.
     * @param {TimeLike} time
     * @returns {TxBuilder}
     */
    validToTime(time) {
        this.validTo = { right: { timestamp: toTime(time) } }

        return this
    }

    /**
     * @param {StakingAddress<PubKeyHash>} address
     * @param {IntLike} lovelace
     * @returns {TxBuilder}
     */
    withdrawWithoutRedeemer(address, lovelace) {
        return this.withdrawUnsafe(address, lovelace)
    }

    /**
     * @template TRedeemer
     * @param {StakingAddress<StakingValidatorHash<StakingContext<any, TRedeemer>>>} address
     * @param {IntLike} lovelace
     * @param {TRedeemer} redeemer
     * @returns {TxBuilder}
     */
    withdrawWithRedeemer(address, lovelace, redeemer) {
        const context = address.stakingCredential.context

        this.attachUplcProgram(context.program)

        return this.withdrawUnsafe(address, lovelace, (_tx) =>
            context.redeemer.toUplcData(redeemer)
        )
    }

    /**
     * @template TRedeemer
     * @param {StakingAddress<StakingValidatorHash<StakingContext<any, TRedeemer>>>} addr
     * @param {IntLike} lovelace
     * @param {LazyRedeemerData<TRedeemer>} redeemer
     * @returns {TxBuilder}
     */
    withdrawWithLazyRedeemer(addr, lovelace, redeemer) {
        return this.withdrawUnsafe(addr, lovelace, async (tx) => {
            const r = redeemer(tx)
            const redeemerData = r instanceof Promise ? await r : r

            return addr.stakingCredential.context.redeemer.toUplcData(
                redeemerData
            )
        })
    }

    /**
     * @param {StakingAddress} stakingAddress
     * @param {IntLike} lovelace
     * @param {UplcData | LazyRedeemerData | undefined} redeemer
     * @returns {TxBuilder}
     */
    withdrawUnsafe(stakingAddress, lovelace, redeemer = undefined) {
        /**
         * @type {[StakingAddress, bigint]}
         */
        const entry = [stakingAddress, BigInt(lovelace)]

        const i = this.withdrawals.findIndex(([prev]) =>
            prev.isEqual(stakingAddress)
        )

        // TODO: more checks required to assure addr has a StakingValidatorHash
        if (redeemer) {
            this.addRewardingRedeemer(stakingAddress, redeemer)
        }

        if (i == -1) {
            this.withdrawals.push(entry)
        } else {
            // should we throw an error here instead?
            this.withdrawals[i] = entry
        }

        this.withdrawals.sort(([a], [b]) => compareStakingAddresses(a, b))

        return this
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
        return this._outputs.reduce(
            (prev, output) => prev.add(output.value),
            makeValue(0n)
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
     * Private methods
     */

    /**
     * Doesn't throw an error if already added before
     * @private
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
        appendTxInput(this._inputs, input, true)
    }

    /**
     * Index is calculated later
     * @private
     * @param {MintingPolicyHashLike} policy
     * @param {UplcData | LazyRedeemerData} data
     */
    addMintingRedeemer(policy, data) {
        const mph = makeMintingPolicyHash(policy)

        if (this.hasMintingRedeemer(mph)) {
            throw new Error("redeemer already added")
        }

        this.mintingRedeemers.push([mph, data])
    }

    /**
     * @private
     * @param {TxInput} utxo
     */
    addRefInput(utxo) {
        appendTxInput(this._refInputs, utxo, true)
    }

    /**
     * Index is calculated later
     * @private
     * @param {TxInput} utxo
     * @param {UplcData | LazyRedeemerData} data
     */
    addSpendingRedeemer(utxo, data) {
        if (this.hasSpendingRedeemer(utxo)) {
            throw new Error("redeemer already added")
        }

        this.spendingRedeemers.push([utxo, data])
    }

    /**
     * Index is calculated later
     * @private
     * @param {StakingAddress} sa
     * @param {UplcData | LazyRedeemerData} data
     */
    addRewardingRedeemer(sa, data) {
        if (this.hasRewardingRedeemer(sa)) {
            throw new Error("redeemer already added")
        }

        this.rewardingRedeemers.push([sa, data])
    }

    /**
     * @private
     * @param {DCert} dcert
     * @param {UplcData | LazyRedeemerData} data
     */
    addCertifyingRedeemer(dcert, data) {
        // TODO: duplicate check
        this.certifyingRedeemers.push([dcert, data])
    }

    /**
     * Doesn't re-add or throw an error if the script was previously added
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
     * Doesn't re-add or throw an error if the script was previously added
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
     * Doesn't re-add or throw an error if the script was previously added
     * Removes the same regular script if it was added before
     * @private
     * @param {UplcProgramV2} script
     */
    addV2RefScript(script) {
        const h = script.hash()
        if (!this.v2RefScripts.some((prev) => equalsBytes(prev.hash(), h))) {
            this.v2RefScripts.push(script)
        }

        // also remove from v2Scrips
        this.v2Scripts = this.v2Scripts.filter((s) => !equalsBytes(s.hash(), h))
    }

    /**
     * @private
     * @param {number[] | MintingPolicyHash | ValidatorHash | StakingValidatorHash} hash
     * @returns {UplcProgramV1 | UplcProgramV2}
     */
    getUplcScript(hash) {
        const hashBytes = Array.isArray(hash) ? hash : hash.bytes

        const v2Script = this.v2Scripts
            .concat(this.v2RefScripts)
            .find((s) => equalsBytes(s.hash(), hashBytes))

        if (v2Script) {
            return v2Script
        }

        const v1Script = this.v1Scripts.find((s) =>
            equalsBytes(s.hash(), hashBytes)
        )

        if (v1Script) {
            return v1Script
        }

        if (Array.isArray(hash)) {
            throw new Error(`script for ${bytesToHex(hash)} not found`)
        } else if (hash.kind == "MintingPolicyHash") {
            throw new Error(
                `script for minting policy ${hash.toHex()} not found`
            )
        } else if (hash.kind == "ValidatorHash") {
            throw new Error(`script for validator ${hash.toHex()} not found`)
        } else if (hash.kind == "StakingValidatorHash") {
            throw new Error(
                `script for staking validator ${hash.toHex()} not found`
            )
        } else {
            throw new Error("unexpected hash type")
        }
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
        return this.nativeScripts.some((s) =>
            equalsBytes(hashNativeScript(s), hash)
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
     * @param {StakingAddress} addr
     * @returns {boolean}
     */
    hasRewardingRedeemer(addr) {
        return this.rewardingRedeemers.some(([sa]) => sa.isEqual(addr))
    }

    /**
     * @private
     * @returns {Value}
     */
    sumInputValue() {
        return this._inputs.reduce(
            (prev, input) => prev.add(input.value),
            makeValue(0n)
        )
    }

    /**
     * Throws error if any part of the sum is negative (i.e. more is burned than input)
     * @private
     * @returns {Value}
     */
    sumInputAndMintedValue() {
        return this.sumInputValue()
            .add(makeValue(0n, this._mintedTokens))
            .assertAllPositive()
    }

    /**
     * Private builder methods
     */

    /**
     * @private
     * @param {ShelleyAddress} changeAddress
     * @param {number} maxAssetsPerChangeOutput
     * @returns {TxOutput[]}
     */
    balanceAssets(changeAddress, maxAssetsPerChangeOutput) {
        if (changeAddress.spendingCredential.kind == "ValidatorHash") {
            throw new Error("can't send change to validator")
        }

        const inputAssets = this.sumInputAndMintedAssets()

        const outputAssets = this.sumOutputAssets()

        if (inputAssets.isEqual(outputAssets)) {
            return []
        } else if (outputAssets.isGreaterThan(inputAssets)) {
            throw new Error("not enough input assets")
        } else {
            const diff = inputAssets.subtract(outputAssets)

            /**
             * Collect the change outputs so they can be used for balancing of babel fees
             * @type {TxOutput[]}
             */
            let changeOutputs = []

            if (maxAssetsPerChangeOutput > 0) {
                const maxAssetsPerOutput = maxAssetsPerChangeOutput

                let changeAssets = makeAssets()
                let tokensAdded = 0

                diff.getPolicies().forEach((mph) => {
                    const tokens = diff.getPolicyTokens(mph)
                    tokens.forEach(([token, quantity], i) => {
                        changeAssets.addPolicyTokenQuantity(
                            mph,
                            token,
                            quantity
                        )
                        tokensAdded += 1
                        if (tokensAdded == maxAssetsPerOutput) {
                            const output = makeTxOutput(
                                changeAddress,
                                makeValue(0n, changeAssets)
                            )

                            changeOutputs.push(output)

                            this.addOutput(output)
                            changeAssets = makeAssets()
                            tokensAdded = 0
                        }
                    })
                })

                // If we are here and have No assets, they we're done
                if (!changeAssets.isZero()) {
                    const output = makeTxOutput(
                        changeAddress,
                        makeValue(0n, changeAssets)
                    )

                    changeOutputs.push(output)

                    this.addOutput(output)
                }
            } else {
                const output = makeTxOutput(changeAddress, makeValue(0n, diff))

                changeOutputs.push(output)

                this.addOutput(output)
            }

            return changeOutputs
        }
    }

    /**
     * @private
     * @param {NetworkParams} params
     * @param {Address} changeAddress
     * @param {TxInput[]} spareUtxos
     * @param {bigint} baseFee
     * @returns {TxOutput | undefined} - collateral change output which can be corrected later
     */
    balanceCollateral(params, changeAddress, spareUtxos, baseFee) {
        // if we previously added collateral, use it
        if (this.addedCollatoral) {
            return this.collateralReturn
        }
        // don't do this step if collateral was already added explicitly outside the TxBuilder
        if (this.collateral.length > 0 || !this.hasUplcScripts()) {
            return
        }

        const helper = makeNetworkParamsHelper(params)

        const minCollateral =
            (baseFee * BigInt(helper.minCollateralPct) + 100n) / 100n // integer division that rounds up

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
                        (utxo.address.era == "Byron" ||
                            utxo.address.spendingCredential.kind !=
                                "ValidatorHash") &&
                        utxo.value.assets.isZero()
                )
                .sort((a, b) => Number(a.value.lovelace - b.value.lovelace))

            for (let input of cleanInputs) {
                if (collateral > minCollateral) {
                    break
                }

                while (collateralInputs.length >= params.maxCollateralInputs) {
                    collateralInputs.shift()
                }

                collateralInputs.push(input)
                collateral += input.value.lovelace
            }
        }

        addCollateralInputs(this._inputs.slice())
        addCollateralInputs(spareUtxos.map((utxo) => utxo))

        // create the collateral return output if there is enough lovelace
        const changeOutput = makeTxOutput(changeAddress, makeValue(0n))
        changeOutput.correctLovelace(params)

        if (collateral < minCollateral) {
            throw new Error("unable to find enough collateral input")
        } else {
            if (collateral > minCollateral + changeOutput.value.lovelace) {
                changeOutput.value = makeValue(0n)

                changeOutput.correctLovelace(params)

                if (collateral > minCollateral + changeOutput.value.lovelace) {
                    changeOutput.value = makeValue(collateral - minCollateral)
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
        this.addedCollatoral = true

        return changeOutput
    }

    /**
     * Calculates fee and balances transaction by sending an output back to changeAddress.
     * Assumes the changeOutput is always needed.
     * Sets the fee to the max possible tx fee (will be lowered later)
     * Throws error if transaction can't be balanced.
     * Shouldn't be used directly
     * @private
     * @param {NetworkParams} params
     * @param {Address} changeAddress
     * @param {TxInput[]} spareUtxos - used when there are yet enough inputs to cover everything (eg. due to min output lovelace requirements, or fees)
     * @param {bigint} fee
     * @param {boolean} allowDirtyChange - allow the change TxOutput to contain assets
     * @returns {TxOutput} - change output, will be corrected once the final fee is known
     */
    balanceLovelace(params, changeAddress, spareUtxos, fee, allowDirtyChange) {
        // don't include the changeOutput in this value
        let nonChangeOutputValue = this.sumOutputValue()

        // assume a change output is always needed
        const changeOutput = makeTxOutput(changeAddress, makeValue(0n))

        changeOutput.correctLovelace(params)

        this.addOutput(changeOutput)

        const minLovelace = changeOutput.value.lovelace

        let inputValue = this.sumInputAndMintedValue()
        let feeValue = makeValue(fee)

        nonChangeOutputValue = feeValue.add(nonChangeOutputValue)

        const helper = makeNetworkParamsHelper(params)

        // stake certificates
        const stakeAddrDeposit = makeValue(helper.stakeAddressDeposit)
        this.dcerts.forEach((dcert) => {
            if (dcert.kind == "RegistrationDCert") {
                // in case of stake registrations, count stake key deposits as additional output ADA
                nonChangeOutputValue =
                    nonChangeOutputValue.add(stakeAddrDeposit)
            } else if (dcert.kind == "DeregistrationDCert") {
                // in case of stake de-registrations, count stake key deposits as additional input ADA
                inputValue = inputValue.add(stakeAddrDeposit)
            }
        })

        // this is quite restrictive, but we really don't want to touch UTxOs containing assets just for balancing purposes
        const spareAssetUTxOs = spareUtxos.some(
            (utxo) => !utxo.value.assets.isZero()
        )

        if (!allowDirtyChange) {
            spareUtxos = spareUtxos.filter((utxo) => utxo.value.assets.isZero())
        }

        // use some spareUtxos if the inputValue doesn't cover the outputs and fees
        const totalOutputValue = nonChangeOutputValue.add(changeOutput.value)
        while (!inputValue.isGreaterOrEqual(totalOutputValue)) {
            const spare = spareUtxos.pop()

            if (spare) {
                if (
                    this._inputs.some((prevInput) => prevInput.isEqual(spare))
                ) {
                    // no need to log any warning about a "spare" that's already in the transaction
                } else {
                    this.addInput(spare)

                    inputValue = inputValue.add(spare.value)
                }
            } else {
                if (!allowDirtyChange && spareAssetUTxOs) {
                    throw new Error(`UTxOs too fragmented`)
                } else {
                    throw new Error(
                        `need ${totalOutputValue.lovelace} lovelace, but only have ${inputValue.lovelace}`
                    )
                }
            }
        }

        // use to the exact diff, which is >= minLovelace
        const diff = inputValue.subtract(nonChangeOutputValue)

        if (!allowDirtyChange && !diff.assets.isZero()) {
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
     *   metadata: TxMetadata | undefined,
     *   metadataHash: number[] | undefined
     * }}
     */
    buildMetadata() {
        if (this.hasMetadata()) {
            const metadata = makeTxMetadata(this.metadata)
            const metadataHash = metadata.hash()

            return { metadata, metadataHash }
        } else {
            return { metadata: undefined, metadataHash: undefined }
        }
    }

    /**
     * Redeemers are returned sorted: first the minting redeemers then the spending redeemers
     * (I'm not sure if the sorting is actually necessary)
     * TODO: return profiling information?
     * @private
     * @param {RedeemerExecContext} execContext
     * @returns {Promise<TxRedeemer[]>}
     */
    async buildRedeemers(execContext) {
        const dummyRedeemers = (await this.buildMintingRedeemers())
            .concat(await this.buildSpendingRedeemers())
            .concat(await this.buildRewardingRedeemers())
            .concat(await this.buildCertifyingRedeemers())

        // we have all the information to create a dummy tx
        const dummyTx = this.buildDummyTxBody(
            execContext.fee,
            execContext.firstValidSlot,
            execContext.lastValidSlot
        )

        const txInfo = dummyTx.toTxInfo(
            execContext.networkParams,
            dummyRedeemers,
            this.datums,
            makeDummyTxId()
        )

        const buildContext = {
            ...execContext,
            txInfo
        }
        // rebuild the redeemers now that we can generate the correct ScriptContext
        const redeemers = (await this.buildMintingRedeemers(buildContext))
            .concat(await this.buildSpendingRedeemers(buildContext))
            .concat(await this.buildRewardingRedeemers(buildContext))
            .concat(await this.buildCertifyingRedeemers(buildContext))

        return redeemers
    }

    /**
     * @private
     * @param {bigint} fee
     * @param {number | undefined} firstValidSlot
     * @param {number | undefined} lastValidSlot
     * @returns {TxBody}
     */
    buildDummyTxBody(fee, firstValidSlot, lastValidSlot) {
        return makeTxBody({
            inputs: this._inputs,
            outputs: this._outputs,
            refInputs: this._refInputs,
            fee,
            firstValidSlot,
            lastValidSlot,
            signers: this._signers,
            dcerts: this.dcerts,
            withdrawals: this.withdrawals,
            minted: this._mintedTokens
        })
    }

    /**
     * @private
     * @returns {number[][]}
     */
    collectUnknownHashes() {
        /**
         * @type {number[][]}
         */
        const allHashes = []

        this.mintingRedeemers.forEach(([mph]) => {
            allHashes.push(mph.bytes)
        })

        this.spendingRedeemers.map(([utxo]) => {
            if (
                utxo.address.era == "Shelley" &&
                utxo.address.spendingCredential.kind == "ValidatorHash"
            ) {
                allHashes.push(utxo.address.spendingCredential.bytes)
            }
        })

        this.rewardingRedeemers.forEach(([stakingAddress]) => {
            const svh = stakingAddress.stakingCredential

            if (svh.kind == "StakingValidatorHash") {
                allHashes.push(svh.bytes)
            }
        })

        this.certifyingRedeemers.forEach(([dcert]) => {
            if (
                "credential" in dcert &&
                dcert.credential.kind == "StakingValidatorHash"
            ) {
                allHashes.push(dcert.credential.bytes)
            }
        })

        // filter out the ones that are known
        return allHashes.filter((h) => {
            const v2Script = this.v2Scripts
                .concat(this.v2RefScripts)
                .find((s) => equalsBytes(s.hash(), h))

            if (v2Script) {
                return false
            }

            const v1Script = this.v1Scripts.find((s) =>
                equalsBytes(s.hash(), h)
            )

            if (v1Script) {
                return false
            }

            return true
        })
    }

    /**
     * The execution itself might depend on the redeemers, so we must also be able to return the redeemers without any execution first
     * @private
     * @param {RedeemerBuildContext | undefined} buildContext - execution and budget calculation is only performed when this is set
     * @returns {Promise<TxRedeemer[]>}
     */
    async buildMintingRedeemers(buildContext = undefined) {
        return Promise.all(
            this.mintingRedeemers.map(async ([mph, redeemerDataOrFn]) => {
                const i = this._mintedTokens
                    .getPolicies()
                    .findIndex((mph_) => mph_.isEqual(mph))
                const dummyRedeemerData =
                    "kind" in redeemerDataOrFn
                        ? redeemerDataOrFn
                        : buildContext
                          ? redeemerDataOrFn(buildContext.txInfo)
                          : redeemerDataOrFn()

                let redeemer = makeTxMintingRedeemer(
                    i,
                    dummyRedeemerData instanceof Promise
                        ? await dummyRedeemerData
                        : dummyRedeemerData
                )
                const script = this.getUplcScript(mph)

                if (buildContext) {
                    const r =
                        "kind" in redeemerDataOrFn
                            ? redeemerDataOrFn
                            : redeemerDataOrFn(buildContext.txInfo)
                    const redeemerData = r instanceof Promise ? await r : r

                    const profile = this.buildRedeemerProfile(script, {
                        summary: `mint @${i}`,
                        args: [
                            redeemerData,
                            makeScriptContextV2(
                                buildContext.txInfo,
                                makeMintingPurpose(mph)
                            ).toUplcData()
                        ],
                        buildContext
                    })

                    const cost = buildContext.modifyExBudget
                        ? buildContext.modifyExBudget(
                              buildContext.txInfo,
                              "minting",
                              i,
                              profile.cost
                          )
                        : profile.cost

                    redeemer = makeTxMintingRedeemer(i, redeemerData, cost)
                }
                return redeemer
            })
        )
    }

    /**
     * @private
     * @param {RedeemerBuildContext | undefined} buildContext - execution and budget calculation is only performed when this is set
     * @returns {Promise<TxRedeemer[]>}
     */
    async buildSpendingRedeemers(buildContext = undefined) {
        return Promise.all(
            this.spendingRedeemers.map(async ([utxo, redeemerDataOrFn]) => {
                const i = this._inputs.findIndex((inp) => inp.isEqual(utxo))
                const dummyRedeemerData =
                    "kind" in redeemerDataOrFn
                        ? redeemerDataOrFn
                        : buildContext
                          ? redeemerDataOrFn(buildContext.txInfo)
                          : redeemerDataOrFn()

                let redeemer = makeTxSpendingRedeemer(
                    i,
                    dummyRedeemerData instanceof Promise
                        ? await dummyRedeemerData
                        : dummyRedeemerData
                )

                // it's tempting to delegate this to TxRedeemer.getRedeemerDetails()
                // this finds the index based on staking address, but ^ uses the index we found here.
                // Possibly the other thing should do the same as this.
                if (utxo.address.era != "Shelley") {
                    throw new Error(
                        `unexpected ${utxo.address.era} era address`
                    )
                }

                if (utxo.address.spendingCredential.kind != "ValidatorHash") {
                    throw new Error(
                        "Address doesn't have a ValidatorHash spending credential"
                    )
                }

                const vh = expectDefined(
                    utxo.address.spendingCredential,
                    "address spending credential undefined"
                )
                const script = this.getUplcScript(vh)

                if (buildContext) {
                    const datum = expectDefined(
                        utxo.datum?.data,
                        "utxo datum data undefined"
                    )
                    const r =
                        "kind" in redeemerDataOrFn
                            ? redeemerDataOrFn
                            : redeemerDataOrFn(buildContext.txInfo)
                    const redeemerData = r instanceof Promise ? await r : r

                    const profile = this.buildRedeemerProfile(script, {
                        summary: `input @${i}`,
                        args: [
                            datum,
                            redeemerData,
                            makeScriptContextV2(
                                buildContext.txInfo,
                                makeSpendingPurpose(utxo.id)
                            ).toUplcData()
                        ],
                        buildContext
                    })

                    const cost = buildContext.modifyExBudget
                        ? buildContext.modifyExBudget(
                              buildContext.txInfo,
                              "spending",
                              i,
                              profile.cost
                          )
                        : profile.cost

                    redeemer = makeTxSpendingRedeemer(i, redeemerData, cost)
                }

                return redeemer
            })
        )
    }

    /**
     * @private
     * @param {RedeemerBuildContext | undefined} buildContext - execution and budget calculation is only performed when this is set
     * @returns {Promise<TxRedeemer[]>}
     */
    async buildRewardingRedeemers(buildContext = undefined) {
        return Promise.all(
            this.rewardingRedeemers.map(
                async ([stakingAddress, redeemerDataOrFn]) => {
                    // it's tempting to delegate this to TxRedeemer.getRedeemerDetails()
                    // this finds the index based on staking address, but ^ uses the index we found here.
                    // Possibly the other thing should do the same as this.

                    const i = this.withdrawals.findIndex(([sa]) =>
                        sa.isEqual(stakingAddress)
                    )
                    // pass dummy data if the lazy can't be evaluated yet
                    const dummyRedeemerData =
                        "kind" in redeemerDataOrFn
                            ? redeemerDataOrFn
                            : buildContext
                              ? redeemerDataOrFn(buildContext.txInfo)
                              : redeemerDataOrFn()
                    let redeemer = makeTxRewardingRedeemer(
                        i,
                        dummyRedeemerData instanceof Promise
                            ? await dummyRedeemerData
                            : dummyRedeemerData
                    )

                    if (
                        stakingAddress.stakingCredential.kind !=
                        "StakingValidatorHash"
                    ) {
                        throw new Error(
                            "StakingAddress doen't have a StakingValidatorHash credential"
                        )
                    }

                    const svh = stakingAddress.stakingCredential
                    const script = this.getUplcScript(svh)

                    if (buildContext) {
                        const r =
                            "kind" in redeemerDataOrFn
                                ? redeemerDataOrFn
                                : redeemerDataOrFn(buildContext.txInfo)
                        const redeemerData = r instanceof Promise ? await r : r
                        const profile = this.buildRedeemerProfile(script, {
                            summary: `rewards @${i}`,
                            args: [
                                redeemerData,
                                makeScriptContextV2(
                                    buildContext.txInfo,
                                    makeRewardingPurpose(
                                        stakingAddress.stakingCredential
                                    )
                                ).toUplcData()
                            ],
                            buildContext
                        })

                        const cost = buildContext.modifyExBudget
                            ? buildContext.modifyExBudget(
                                  buildContext.txInfo,
                                  "rewarding",
                                  i,
                                  profile.cost
                              )
                            : profile.cost

                        redeemer = makeTxRewardingRedeemer(
                            i,
                            redeemerData,
                            cost
                        )
                    }

                    return redeemer
                }
            )
        )
    }

    /**
     * @private
     * @param {RedeemerBuildContext | undefined} buildContext - execution and budget calculation is only performed when this is set
     * @returns {Promise<TxRedeemer[]>}
     */
    async buildCertifyingRedeemers(buildContext = undefined) {
        return Promise.all(
            this.certifyingRedeemers.map(async ([dcert, redeemerDataOrFn]) => {
                if (!("credential" in dcert)) {
                    throw new Error("DCert doesn't have a credential")
                }

                if (dcert.credential.kind != "StakingValidatorHash") {
                    throw new Error(
                        "DCert doesn't have a StakingValidatorHash credential"
                    )
                }

                const svh = dcert.credential

                const i = this.dcerts.findIndex(
                    (dc) =>
                        "credential" in dc &&
                        dc.credential.kind == "StakingValidatorHash" &&
                        dc.credential.isEqual(svh) &&
                        dc.kind == dcert.kind
                )

                // pass dummy data if the lazy can't be evaluated yet
                const dummyRedeemerData =
                    "kind" in redeemerDataOrFn
                        ? redeemerDataOrFn
                        : buildContext
                          ? redeemerDataOrFn(buildContext.txInfo)
                          : redeemerDataOrFn()
                let redeemer = makeTxCertifyingRedeemer(
                    i,
                    dummyRedeemerData instanceof Promise
                        ? await dummyRedeemerData
                        : dummyRedeemerData
                )

                const script = this.getUplcScript(svh)

                if (buildContext) {
                    const r =
                        "kind" in redeemerDataOrFn
                            ? redeemerDataOrFn
                            : redeemerDataOrFn(buildContext.txInfo)
                    const redeemerData = r instanceof Promise ? await r : r
                    const profile = this.buildRedeemerProfile(script, {
                        summary: `dcert ${dcert.kind} @${i}`,
                        args: [
                            redeemerData,
                            makeScriptContextV2(
                                buildContext.txInfo,
                                makeCertifyingPurpose(dcert)
                            ).toUplcData()
                        ],
                        buildContext
                    })

                    const cost = buildContext.modifyExBudget
                        ? buildContext.modifyExBudget(
                              buildContext.txInfo,
                              "certifying",
                              i,
                              profile.cost
                          )
                        : profile.cost

                    redeemer = makeTxCertifyingRedeemer(i, redeemerData, cost)
                }

                return redeemer
            })
        )
    }

    /**
     * @private
     * @param {UplcProgramV1 | UplcProgramV2} script
     * @param {Object} options
     * @param {string} options.summary
     * @param {UplcData[]} options.args
     * @param {RedeemerBuildContext} options.buildContext
     * @returns {CekResult}
     */
    buildRedeemerProfile(script, { args, summary, buildContext }) {
        const throwBuildPhaseScriptErrors =
            buildContext.throwBuildPhaseScriptErrors ?? true

        const { logOptions = { logPrint() {}, lastMessage: "" } } = buildContext

        const argsData = args.map((a) => makeUplcDataValue(a))
        const profile = script.eval(argsData, { logOptions })
        // XXX if the script fails, we signal the logger to emit the diagnostics.
        // if the script runs correctly, logging will arrive during transaction validation instead.
        if (isLeft(profile.result)) {
            if (script.alt) {
                // only (normally) needed to emit logs in case the optimized script failed
                const altProfile = script.alt.eval(argsData, { logOptions })
                if (isLeft(altProfile.result)) {
                    // all is consistent; we can return the profile of the optimized script
                    //   ... even though it failed; the built Tx can provide further diagnostics in validate()
                    if (throwBuildPhaseScriptErrors) {
                        // ensure logs are emitted before throwing:
                        logOptions.flush?.()
                        const scriptContext = args.at(-1)

                        throw new UplcRuntimeError(
                            `TxBuilder:build() failed: ${altProfile.result.left.error}`,
                            altProfile.result.left.callSites,
                            scriptContext
                        )
                    }
                    return profile
                }

                // this would be an exceptional scenario.  Note that logs NOT
                // output above, having been reset, will still be emitted
                // ... by the validation phase below
                logOptions.logError?.(
                    `build: unoptimized script for ${summary} succeeded where optimized script failed`
                )

                const message =
                    `${summary}: in optimized script: ` +
                    profile.result.left.error
                logOptions.logError?.(
                    message,
                    profile.result.left.callSites.slice()?.pop()?.site
                )

                if (throwBuildPhaseScriptErrors) {
                    const scriptContext = args.at(-1)
                    logOptions.flush?.()
                    throw new UplcRuntimeError(
                        message,
                        profile.result.left.callSites,
                        scriptContext
                    )
                } else {
                    // these would be redundant noise.  validate() phase will emit logs
                    // logOptions.logPrint?.(
                    //     "warning: script errors during build() phase; see logs and exceptions in validate() phase below"
                    // )
                    // logOptions.flush?.()
                    logOptions.reset?.("build")
                }
            } else {
                console.warn(
                    `NOTE: ${summary}: no alt script attached; no script logs available.  See \`withAlt\` option in docs to enable logging`
                )
            }
        }
        logOptions.reset?.("build")
        return profile
    }

    /**
     * @private
     * @param {NetworkParams} params
     * @param {TxRedeemer[]} redeemers
     * @returns {number[] | undefined} - returns null if there are no redeemers
     */
    buildScriptDataHash(params, redeemers) {
        if (redeemers.length > 0) {
            return calcScriptDataHash(params, this.datums, redeemers)
        } else {
            return undefined
        }
    }

    /**
     * @private
     * @param {NetworkParams} params
     * @returns {{
     *   firstValidSlot: number | undefined
     *   lastValidSlot: number | undefined
     * }}
     */
    buildValidityTimeRange(params) {
        const helper = makeNetworkParamsHelper(params)

        /**
         * @param {Either<{slot: number}, {timestamp: number}>} slotOrTime
         * @return {number}
         */
        function slotOrTimeToSlot(slotOrTime) {
            if (isRight(slotOrTime)) {
                return helper.timeToSlot(slotOrTime.right.timestamp)
            } else {
                return slotOrTime.left.slot
            }
        }

        return {
            firstValidSlot: this.validFrom
                ? slotOrTimeToSlot(this.validFrom)
                : undefined,
            lastValidSlot: this.validTo
                ? slotOrTimeToSlot(this.validTo)
                : undefined
        }
    }

    /**
     * Makes sure each output contains the necessary min lovelace.
     * @private
     * @param {NetworkParams} params
     */
    correctOutputs(params) {
        this._outputs.forEach((output) => output.correctLovelace(params))
    }

    /**
     * @private
     * @returns {Promise<void>}
     */
    async grabRefScriptsFromRegistry() {
        if (!this.config.refScriptRegistry) {
            return
        }

        const allUnknownHashes = this.collectUnknownHashes()

        for (let h of allUnknownHashes) {
            const found = await this.config.refScriptRegistry.find(h)

            if (found) {
                this.refer(found.input)
            }
        }

        for (let s of this.v2Scripts) {
            const found = await this.config.refScriptRegistry.find(s.hash())

            if (found) {
                this.refer(found.input)
            }
        }
    }

    /**
     * Adds all lovelace in inputs taken from babelFeeAgent.utxos, and then subtracts lovelace in changeOutput
     * Then the lovelace diff is converted to the number of required tokens
     * @private
     * @param {BabelFeeAgentOptions} babelFeeAgent
     * @param {TxOutput} changeOutput
     * @returns {bigint}
     */
    calcBabelFeeTokensRequired(babelFeeAgent, changeOutput) {
        const lovelaceRequired =
            this._inputs.reduce((prev, input) => {
                if (babelFeeAgent.utxos.some((check) => check.isEqual(input))) {
                    return prev + input.value.lovelace
                } else {
                    return prev
                }
            }, 0n) - changeOutput.value.lovelace

        const tokensRequired = BigInt(
            Math.ceil(Number(lovelaceRequired) / babelFeeAgent.price)
        )

        if (tokensRequired < babelFeeAgent.minimum) {
            return babelFeeAgent.minimum
        } else {
            return tokensRequired
        }
    }

    /**
     * at this point we have all necessary outputs for further balancing
     * whatever the babel fee agent loses in ADA, must be recouped in asset class tokens
     * this will increase the siez of the changeOutput, but the fee at this point is still the max possible fee
     * so correcting the changeOutput to include the asset class tokens doesn't yet require adjusting the fee
     * we can still add inputs from the principal agents to cover the babel fee at this point
     * @private
     * @param {BabelFeeAgentOptions | undefined} babelFeeAgent
     * @param {TxOutput} changeOutput
     * @param {TxOutput[]} assetChangeOutputs
     * @param {TxInput[]} spareUtxos
     * @param {NetworkParams} params
     * @returns {bigint}
     */
    balanceBabelFee(
        babelFeeAgent,
        changeOutput,
        assetChangeOutputs,
        spareUtxos,
        params
    ) {
        if (!babelFeeAgent) {
            return 0n
        }

        // number of tokens required to pay for the babel fee
        const tokensRequired = this.calcBabelFeeTokensRequired(
            babelFeeAgent,
            changeOutput
        )

        // number of tokens available in current assetChangeOutputs
        let tokensAvailable = assetChangeOutputs.reduce(
            (prev, output) =>
                prev +
                output.value.assets.getAssetClassQuantity(
                    babelFeeAgent.assetClass
                ),
            0n
        )

        // if the number of tokens available in the assetChangeOutputs is too low, add more inputs containing tokens, and increase the number of tokens in one of the assetChangeOutputs
        while (tokensAvailable < tokensRequired) {
            const spareUtxosWithTokens = spareUtxos.filter((utxo) => {
                return (
                    !this._inputs.some((check) => check.isEqual(utxo)) &&
                    utxo.value.assets.getAssetClassQuantity(
                        babelFeeAgent.assetClass
                    ) > 0n
                )
            })

            const utxoToBeAdded = spareUtxosWithTokens[0]

            if (!utxoToBeAdded) {
                throw new Error(
                    `not enough ${babelFeeAgent.assetClass.toString()} tokens to cover babel fees`
                )
            }

            this.addInput(utxoToBeAdded)

            // pick the assetChangeOutput that contains the least number of assetClasses
            const assetChangeOutput = assetChangeOutputs.reduce(
                (prev, output) => {
                    return output.value.assets.countTokens() <
                        prev.value.assets.countTokens()
                        ? output
                        : prev
                },
                assetChangeOutputs[0]
            )

            assetChangeOutput.value = assetChangeOutput.value.add(
                utxoToBeAdded.value
            )
        }

        // once we know enough tokens are available, add them to the changeOutput, and subtract them from the assetChangeOutputs
        // enough tokens are available in the assetChangeOutputs to cover the max possible babel fees
        changeOutput.value = changeOutput.value.add(
            makeValue(
                0n,
                makeAssets([[babelFeeAgent.assetClass, tokensRequired]])
            )
        )
        changeOutput.value.assets.sort()

        // assume the changeOutput has enough lovelace to cover the required min-deposit after this change

        let tokensToBeExtracted = tokensRequired
        assetChangeOutputs.forEach((output) => {
            if (tokensToBeExtracted > 0n) {
                const nInOutput = output.value.assets.getAssetClassQuantity(
                    babelFeeAgent.assetClass
                )

                if (nInOutput < tokensToBeExtracted) {
                    output.value = output.value.subtract(
                        makeValue(
                            0n,
                            makeAssets([[babelFeeAgent.assetClass, nInOutput]])
                        )
                    )
                    tokensToBeExtracted -= nInOutput
                } else {
                    output.value = output.value.subtract(
                        makeValue(
                            0n,
                            makeAssets([
                                [babelFeeAgent.assetClass, tokensToBeExtracted]
                            ])
                        )
                    )
                    tokensToBeExtracted = 0n
                }

                output.value.assets.sort()
            }
        })

        if (tokensToBeExtracted > 0n) {
            throw new Error("unexpected (should've thrown an error before)")
        }

        return tokensRequired
    }

    /**
     * @private
     * @param {BabelFeeAgentOptions} babelFeeAgent
     * @param {bigint} babelFeeTokens - number of babel fee tokens returned by this.balanceBabelFee(), which should be an over-estimation
     * @param {TxOutput} changeOutput
     * @param {TxOutput[]} assetChangeOutputs
     * @param {NetworkParams} params
     * @returns {bigint} - corrected babel fee tokens
     */
    correctBabelFee(
        babelFeeAgent,
        babelFeeTokens,
        changeOutput,
        assetChangeOutputs,
        params
    ) {
        const tokensRequired = this.calcBabelFeeTokensRequired(
            babelFeeAgent,
            changeOutput
        )

        // add the difference to the assetChangeOutput which already has the most tokens (least amount of lovelace that must be added for correcting the min-deposit)
        const assetChangeOutput = assetChangeOutputs.reduce((prev, output) => {
            return output.value.assets.getAssetClassQuantity(
                babelFeeAgent.assetClass
            ) >
                prev.value.assets.getAssetClassQuantity(
                    babelFeeAgent.assetClass
                )
                ? output
                : prev
        }, assetChangeOutputs[0])

        const oldChangeOutputValue = assetChangeOutput.value

        let nDiffTokens = babelFeeTokens - tokensRequired
        let nDiffLovelace = 0n

        while (nDiffTokens != 0n) {
            assetChangeOutput.value = assetChangeOutput.value.add(
                makeValue(
                    0,
                    makeAssets([[babelFeeAgent.assetClass, nDiffTokens]])
                )
            )
            const prevLovelace = assetChangeOutput.value.lovelace
            assetChangeOutput.correctLovelace(params)
            nDiffLovelace = assetChangeOutput.value.lovelace - prevLovelace // if the amount of lovelace increased, the number of returned tokens decreases

            nDiffTokens = -BigInt(
                Math.ceil(Number(nDiffLovelace) / babelFeeAgent.price)
            )
        }

        // whatever is added to the assetChangeOutput, must be subtracted from the changeOutput
        const valueTakenFromBabelFeeChange =
            assetChangeOutput.value.subtract(oldChangeOutputValue)

        const oldDeposit = changeOutput.calcDeposit(params)
        changeOutput.value = changeOutput.value.subtract(
            valueTakenFromBabelFeeChange
        )
        changeOutput.value.assets.sort()

        if (oldDeposit < changeOutput.calcDeposit(params)) {
            throw new Error(
                "unexpected: min deposit increased for babel change output"
            )
        }

        assetChangeOutput.value.assets.sort()

        return tokensRequired
    }
}

/**
 * @template TRedeemer
 * @param {TxInput<ValidatorHash<SpendingContext<any, any, any, TRedeemer>>>} utxo
 * @returns {SpendingContext<any, any, any, TRedeemer>}
 */
function getTxInputSpendingContext(utxo) {
    const address = utxo.address

    if (address.era != "Shelley") {
        throw new Error(`unexpected ${address.era} era address`)
    }

    return address.spendingCredential.context
}
