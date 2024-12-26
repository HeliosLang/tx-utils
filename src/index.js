export {
    compareTxSummaries,
    isTxSummaryJsonSafe,
    makeTxChain,
    makeTxChainBuilder,
    makeTxSummary,
    maskWallet,
    summarizeTx,
    superimposeUtxosOnSummaries
} from "./chain/index.js"
export {
    makeBlockfrostV0Client,
    makeCardanoClientHelper,
    makeKoiosV0Client,
    resolveBlockfrostV0Client,
    resolveKoiosV0Client
} from "./clients/index.js"
export {
    consolidate,
    selectLargestFirst,
    selectSmallestFirst,
    selectSingle
} from "./coinselection/index.js"
export {
    MILLISECOND,
    SECOND,
    MINUTE,
    HOUR,
    DAY,
    WEEK,
    DEFAULT_TX_VALIDITY_OFFSETS
} from "./duration/index.js"
export {
    makeEmulator,
    makeEmulatorGenesisTx,
    makeEmulatorRegularTx
} from "./emulator/index.js"
export {
    BIP39_DICT_EN,
    makeBip32PrivateKey,
    makeBip32PrivateKeyWithBip39Entropy,
    makeRandomBip32PrivateKey,
    makeRandomRootPrivateKey,
    makeRootPrivateKey,
    restoreRootPrivateKey
} from "./keys/index.js"
export {
    makeCachedRefScriptRegistry,
    makeRefScriptRegistry,
    makeTxBuilder
} from "./txbuilder/index.js"
export {
    assertOfflineWalletJsonSafe,
    expectOfflineWalletJsonSafe,
    isOfflineWalletJsonSafe,
    makeCip30Wallet,
    makeOfflineWallet,
    makeRandomSimpleWallet,
    makeSimpleWallet,
    makeUnstakedSimpleWallet,
    makeWalletHelper,
    parseOfflineWallet
} from "./wallets/index.js"

/**
 * @import { BytesLike, IntLike } from "@helios-lang/codec-utils"
 * @import { Address, AssetClass, Assets, DatumPaymentContext, DCert, MintingContext, MintingPolicyHash, MintingPolicyHashLike, NativeScript, NetworkParams, PubKey, PubKeyHash, PubKeyHashLike, ShelleyAddress, ShelleyAddressLike, Signature, SpendingContext, SpendingCredential, StakingAddress, StakingAddressLike, StakingContext, StakingValidatorHash, TimeLike, TokenValue, Tx, TxId, TxInfo, TxInput, TxMetadataAttr, TxOutput, TxOutputId, TxOutputDatum, TxOutputDatumCastable, ValidatorHash, Value, ValueLike } from "@helios-lang/ledger"
 * @import { Cost, UplcData, UplcLogger, UplcProgramV1, UplcProgramV2 } from "@helios-lang/uplc"
 */

/**
 * @typedef {object} Bip32PrivateKey
 * @prop {number[]} bytes
 * @prop {(i: number) => Bip32PrivateKey} derive
 * @prop {(path: number[]) => Bip32PrivateKey} derivePath
 * @prop {() => PubKey} derivePubKey
 * @prop {(message: number[]) => Signature} sign
 */

/**
 * @typedef {object} BlockfrostV0Client
 * @prop {NetworkName} networkName
 * @prop {string} projectId
 * @prop {Promise<any>} latestEpoch
 * @prop {number} now
 * ms since 1970
 * Note: the emulator uses an arbitrary reference, so to be able to treat all Networks equally this must be implemented for each CardanoClient
 *
 * @prop {Promise<NetworkParams>} parameters
 * Note: this requires two API calls to blockfrost, because we also need information about the tip
 *
 * @prop {() => Promise<void>} dumpMempool
 * Dumps the live Blockfrost mempool to console.
 *
 * @prop {(id: TxId) => Promise<TxSummary>} getTx
 *
 * @prop {(id: TxOutputId) => Promise<TxInput>} getUtxo
 * If the UTxO isn't found an error is throw with the following message format: "UTxO <txId.utxoId> not found".
 *
 * @prop {(addr: Address) => Promise<TxInput[]>} getUtxos
 * Gets a complete list of UTxOs at a given `Address`.
 * Returns oldest UTxOs first, newest last.
 *
 * @prop {(assetClass: AssetClass) => Promise<{address: Address, quantity: bigint}[]>} getAddressesWithAssetClass
 * Returns a list of addresses containing the given asset class.
 *
 * @prop {(address: Address, assetClass: AssetClass) => Promise<TxInput[]>} getUtxosWithAssetClass
 *
 * @prop {() => boolean} isMainnet
 *
 * @prop {(utxo: TxInput) => Promise<boolean>} hasUtxo
 *
 * @prop {(tx: Tx) => Promise<TxId>} submitTx
 * Submits a transaction to the blockchain.
 */

/**
 * @typedef {object} Cip30Handle
 * Convenience type for browser plugin wallets supporting the CIP 30 dApp connector standard (eg. Eternl, Nami, ...).
 *
 * This is useful in Typescript projects to avoid type errors when accessing the handles in `window.cardano`.
 *
 * ```ts
 * // refer to this file in the 'typeRoots' list in tsconfig.json or jsconfig.json
 * import { Cip30Handle } from "@helios-lang/tx-utils"
 *
 * declare global {
 *   interface Window {
 *     cardano: {
 *       [walletName: string]: Cip30Handle
 *     };
 *   }
 * }
 * ```
 * @prop {string} name
 * @prop {string} icon
 * @prop {() => Promise<Cip30FullHandle>} enable
 * @prop {() => boolean} isEnabled
 */

/**
 * @typedef {object} Cip30FullHandle
 * @prop {() => Promise<number>} getNetworkId
 * @prop {() => Promise<string[]>} getUsedAddresses
 * @prop {() => Promise<string[]>} getUnusedAddresses
 * @prop {() => Promise<string[]>} getUtxos
 * @prop {() => Promise<string[]>} getCollateral
 * @prop {() => Promise<string[]>} getRewardAddresses
 * @prop {(addr: string, sigStructure: string) => Promise<{signature: string, key: string}>} signData
 * @prop {(txHex: string, partialSign: boolean) => Promise<string>} signTx
 * @prop {(txHex: string) => Promise<string>} submitTx
 * @prop {object} experimental
 * @prop {() => Promise<string[]>} getCollateral
 */

/**
 * @typedef {object} Cip30Wallet
 * Wallet that lets you connect to a Cip30 browser plugin wallet.
 *
 * @prop {Cip30FullHandle} handle
 *
 * @prop {() => Promise<boolean>} isMainnet
 * Returns `true` if the wallet is connected to the mainnet.
 *
 * @prop {Promise<StakingAddress[]>} stakingAddresses
 * Gets a list of unique reward addresses which can be used to UTxOs to.
 *
 * @prop {Promise<Address<PubKeyHash>[]>} usedAddresses
 * Gets a list of addresses which contain(ed) UTxOs.
 *
 * @prop {Promise<Address<PubKeyHash>[]>} unusedAddresses
 * Gets a list of unique unused addresses which can be used to UTxOs to.
 *
 * @prop {Promise<TxInput<PubKeyHash>[]>} utxos
 * Gets the complete list of UTxOs (as `TxInput` instances) sitting at the addresses owned by the wallet.
 *
 * @prop {Promise<TxInput<PubKeyHash>[]>} collateral
 *
 * @prop {(addr: Address, data: number[]) => Promise<Signature>} signData
 * Sign a data payload with the users wallet.
 *
 * @prop {(tx: Tx) => Promise<Signature[]>} signTx
 * Signs a transaction, returning a list of signatures needed for submitting a valid transaction.
 *
 * @prop {(tx: Tx) => Promise<TxId>} submitTx
 * Submits a transaction to the blockchain.
 */

/**
 * A function that returns two lists.
 * The first list contains the selected UTxOs, the second list contains the remaining UTxOs.
 * @template {SpendingCredential} [SC=SpendingCredential]
 * @typedef {(
 *   utxos: TxInput<SC>[],
 *   amount: Value
 * ) => [TxInput<SC>[], TxInput<SC>[]]} CoinSelection
 */

/**
 * @typedef {object} ReadonlyCardanoClient
 * Blockchain query interface without the ability to submit transactions.
 *
 * @prop {() => boolean} isMainnet
 * Returns true for mainnet
 *
 * @prop {number} now
 * Returns the number of ms since some reference (for mainnet -> since 1970, for emulator -> arbitrary reference)
 *
 * @prop {Promise<NetworkParams>} parameters
 * Returns the latest network parameters.
 *
 * @prop {(id: TxId) => Promise<TxSummary>} [getTx]
 * Optionally more efficient method of getting all the inputs and outputs of a transaction
 *
 * @prop {(id: TxOutputId) => Promise<TxInput>} getUtxo
 * Returns a single TxInput (that might already have been spent).
 *
 * @prop {(address: Address) => Promise<TxInput[]>} getUtxos
 * Returns a complete list of UTxOs at a given address.
 *
 * @prop {(address: Address, assetClass: AssetClass) => Promise<TxInput[]>} [getUtxosWithAssetClass]
 * Optionally more efficient method to get a complete list of UTxOs at a given address, filtered to contain a given AssetClass
 */

/**
 * @typedef {object} CardanoClient
 * Blockchain query layer interface.
 *
 * @prop {() => boolean} isMainnet
 * Returns true for mainnet
 *
 * @prop {number} now
 * Returns the number of ms since some reference (for mainnet -> since 1970, for emulator -> arbitrary reference)
 *
 * @prop {Promise<NetworkParams>} parameters
 * Returns the latest network parameters.
 *
 * @prop {(id: TxId) => Promise<TxSummary>} [getTx]
 * Optionally more efficient method of getting all the inputs and outputs of a transaction
 *
 * @prop {(id: TxOutputId) => Promise<TxInput>} getUtxo
 * Returns a single TxInput (that might already have been spent).
 *
 * @prop {(address: Address) => Promise<TxInput[]>} getUtxos
 * Returns a complete list of UTxOs at a given address.
 *
 * @prop {(address: Address, assetClass: AssetClass) => Promise<TxInput[]>} [getUtxosWithAssetClass]
 * Optionally more efficient method to get a complete list of UTxOs at a given address, filtered to contain a given AssetClass
 *
 * @prop {(tx: Tx) => Promise<TxId>} submitTx
 * Submits a transaction to the blockchain and returns the id of that transaction upon success.
 */

/**
 * @typedef {{
 *   onSelectUtxoFail?: (address: Address, value: Value) => Promise<void>
 * }} CardanoClientHelperOptions
 */

/**
 * @template {ReadonlyCardanoClient} C
 * @typedef {object} CardanoClientHelper
 * @prop {C} client
 * @prop {CardanoClientHelperOptions} options
 * @prop {number} now
 * @prop {Promise<NetworkParams>} parameters
 * @prop {() => boolean} isMainnet
 * @prop {(addr: Address) => Promise<Value>} calcBalance
 * @prop {<SC extends SpendingCredential=SpendingCredential>(id: TxOutputId, addr?: Address<SC> | undefined) => Promise<TxInput<SC>>} getUtxo
 * @prop {<SC extends SpendingCredential=SpendingCredential>(addr: Address<SC>) => Promise<TxInput<SC>[]>} getUtxos
 * @prop {<SC extends SpendingCredential=SpendingCredential>(addr: Address<SC>, assetClass: AssetClass) => Promise<TxInput<SC>[]>} getUtxosWithAssetClass
 *
 * @prop {<SC extends SpendingCredential=SpendingCredential>(addr: Address<SC>, value: Value) => Promise<TxInput<SC>>} selectUtxo
 * This method is used to select very specific UTxOs that contain known tokens/NFTs
 * If the UTxO isn't found that usually means something is wrong with the network synchronization
 * The onSelectUtxoFail callback can be used to trigger a synchronization action if the UTxO isn' foun
 *
 * @prop {<SC extends SpendingCredential=SpendingCredential>(addr: Address<SC>, value: Value, coinSelection?: CoinSelection<SC>) => Promise<TxInput<SC>[]>} selectUtxos
 * coinSelection defaults to selectSmallestFirst
 *
 * @prop {C extends CardanoClient ? (tx: Tx) => Promise<TxId> : never} submitTx
 * Only available if the underlying client isn't a ReadonlyCardanoClient
 */

/**
 * @typedef {object} Emulator
 * A simple emulated Network.
 * This can be used to do integration tests of whole dApps.
 * Staking is not yet supported.
 *
 * @prop {number} currentSlot
 * @prop {EmulatorGenesisTx[]} genesis
 * @prop {EmulatorTx[]} mempool
 * @prop {EmulatorTx[][]} blocks
 *
 * @prop {number} now
 * Multiplies currentslot by 1000
 * (i.e. each slot is assumed to be 1000 milliseconds)
 *
 * @prop {Promise<NetworkParams>} parameters
 * @prop {NetworkParams} parametersSync
 *
 * @prop {TxId[]} txIds
 * Ignores the genesis txs
 *
 * @prop {(lovelace?: bigint, assets?: Assets) => SimpleWallet} createWallet
 * Creates a new SimpleWallet and populates it with a given lovelace quantity and assets.
 * Special genesis transactions are added to the emulated chain in order to create these assets.
 *
 * @prop {(wallet: SimpleWallet, lovelace: bigint, assets?: Assets) => TxOutputId} createUtxo
 * Creates a UTxO using a GenesisTx.
 *
 * @prop {() => void} dump
 * Dumps to current emulator state to console
 *
 * @prop {(id: TxOutputId) => Promise<TxInput>} getUtxo
 * Throws an error if the UTxO isn't found
 *
 * @prop {(addr: Address) => Promise<TxInput[]>} getUtxos
 *
 * @prop {(utxo: TxInput) => boolean} isConsumed
 *
 * @prop {() => boolean} isMainnet
 * Returns false
 *
 * @prop {(tx: Tx) => Promise<TxId>} submitTx
 *
 * @prop {(nSlots: IntLike) => void} tick
 */

/**
 * @typedef {object} EmulatorGenesisTx
 * @prop {"Genesis"} kind
 * @prop {() => TxId} id
 * @prop {(utxo: TxInput) => boolean} consumes
 * @prop {(addr: Address, utxos: TxInput[]) => TxInput[]} collectUtxos
 * Removes tx inputs from the list, and appends txoutputs sent to the address to the end.
 *
 * @prop {(id: TxOutputId) => (TxInput | undefined)} getUtxo
 * @prop {() => TxInput[]} newUtxos
 * @prop {() => TxInput[]} consumedUtxos
 * @prop {() => void} dump
 */

/**
 * @typedef {object} EmulatorRegularTx
 * @prop {"Regular"} kind
 * @prop {() => TxId} id
 * @prop {(utxo: TxInput) => boolean} consumes
 * @prop {(addr: Address, utxos: TxInput[]) => TxInput[]} collectUtxos
 * Removes tx inputs from the list, and appends txoutputs sent to the address to the end.
 *
 * @prop {(id: TxOutputId) => (TxInput | undefined)} getUtxo
 * @prop {() => TxInput[]} newUtxos
 * @prop {() => TxInput[]} consumedUtxos
 * @prop {() => void} dump
 */

/**
 * @typedef {EmulatorGenesisTx | EmulatorRegularTx} EmulatorTx
 */

/**
 * @typedef {object} KoiosV0Client
 * Koios network interface.
 *
 * @prop {NetworkName} networkName
 *
 * @prop {number} now
 * ms since 1970
 *
 * @prop {Promise<NetworkParams>} parameters
 *
 * @prop {(id: TxOutputId) => Promise<TxInput>} getUtxo
 * @prop {(addr: Address) => Promise<TxInput[]>} getUtxos
 * @prop {() => boolean} isMainnet
 * @prop {(utxo: TxInput) => Promise<boolean>} hasUtxo
 * @prop {(tx: Tx) => Promise<TxId>} submitTx
 */

/**
 * @typedef {"preview" | "preprod" | "mainnet"} NetworkName
 */

/**
 * @typedef {object} OfflineWallet
 * @prop {boolean} isMainnetSync
 * @prop {Address[]} usedAddressesSync
 * @prop {Address[]} unusedAddressesSync
 * @prop {TxInput[]} utxosSync
 * @prop {TxInput[]} collateralSync
 * @prop {StakingAddress[]} stakingAddressesSync
 * @prop {() => Promise<boolean>} isMainnet
 * @prop {Promise<Address[]>} usedAddresses
 * @prop {Promise<Address[]>} unusedAddresses
 * @prop {Promise<TxInput[]>} utxos
 * @prop {Promise<TxInput[]>} collateral
 * @prop {Promise<StakingAddress[]>} stakingAddresses
 * @prop {() => OfflineWalletJsonSafe} toJsonSafe
 */

/**
 * @typedef {object} OfflineWalletJsonSafe
 * OfflineWalletJsonSafe is useful when building transactions remotely as it can be (de)serialized using JSON.parse/JSON.stringify:
 *
 * @prop {boolean} isMainnet
 * @prop {string[]} usedAddresses
 * Array of bech32 encoded `Address`es
 *
 * @prop {string[]} unusedAddresses
 * Array of bech32 encoded `Address`es
 *
 * @prop {string[]} utxos
 * Array of cborhex encoded `TxInput`s (full cbor encoding)
 *
 * @prop {string[]} [collateral]
 * Optional array of cborhex encoded `TxInput`s (full cbor encoding)
 *
 * @prop {string[]} [stakingAddresses]
 * Optional array of bech32 encoded `StakingAddress`es
 */

/**
 * @typedef {object} ReadonlyRefScriptRegistry
 * @prop {(hash: number[]) => Promise<{input: TxInput, program: UplcProgramV2} | undefined>} find
 */

/**
 * @typedef {object} RefScriptRegistry
 * @prop {(hash: number[]) => Promise<{input: TxInput, program: UplcProgramV2} | undefined>} find
 * @prop {(program: UplcProgramV2) => Promise<TxOutputId>} register
 */

/**
 * @typedef {object} RootPrivateKey
 * @prop {number[]} entropy
 * @prop {Bip32PrivateKey} bip32Key
 * @prop {number[]} bytes
 * @prop {(i: number) => Bip32PrivateKey} derive
 * @prop {(path: number[]) => Bip32PrivateKey} derivePath
 * @prop {(accountIndex?: number) => Bip32PrivateKey} deriveSpendingRootKey
 * @prop {(accountIndex?: number) => Bip32PrivateKey} deriveStakingRootKey
 * @prop {(accountIndex?: number, i?: number) => Bip32PrivateKey} deriveSpendingKey
 * @prop {(accountIndex?: number, i?: number) => Bip32PrivateKey} deriveStakingKey
 * @prop {() => PubKey} derivePubKey
 * @prop {(message: number[]) => Signature} sign
 * @prop {(dict?: string[]) => string[]} toPhrase
 */

/**
 * This wallet only has a single private/public key, which isn't rotated. Staking is not yet supported.
 * Requires a Cardano client.
 * @typedef {object} SimpleWallet
 * @prop {CardanoClient} cardanoClient
 * @prop {Bip32PrivateKey} spendingPrivateKey
 * @prop {PubKey} spendingPubKey
 * @prop {PubKey | undefined} stakingPubKey
 * @prop {ShelleyAddress<PubKeyHash>} address
 *
 * @prop {Promise<TxInput<PubKeyHash>[]>} collateral
 * Don't define any collateral, let the TxBuilder use the regular inputs
 *
 * @prop {PubKeyHash} spendingPubKeyHash
 * @prop {StakingAddress | undefined} stakingAddress
 * @prop {Promise<StakingAddress[]>} stakingAddresses
 * @prop {PubKeyHash | undefined} stakingPubKeyHash
 * @prop {Promise<ShelleyAddress<PubKeyHash>[]>} usedAddresses
 * Assumed wallet was initiated with at least 1 UTxO at the pubkeyhash address.
 *
 * @prop {Promise<ShelleyAddress<PubKeyHash>[]>} unusedAddresses
 * Returns an empty list
 *
 * @prop {Promise<TxInput<PubKeyHash>[]>} utxos
 * @prop {() => Promise<boolean>} isMainnet
 *
 * @prop {(addr: Address, data: number[]) => Promise<Signature>} signData
 * @prop {(tx: Tx) => Promise<Signature[]>} signTx
 * Simply assumes the tx needs to by signed by this wallet without checking.
 *
 * @prop {(tx: Tx) => Promise<TxId>} submitTx
 */

/**
 * @typedef {{
 *   isMainnet: boolean
 *   refScriptRegistry?: ReadonlyRefScriptRegistry
 * }} TxBuilderConfig
 */

/**
 * @typedef {(txInfo: TxInfo, purpose: string, index: number, fee: Cost) => Cost} ExBudgetModifier
 */

/**
 * @typedef {object} TxBuilderFinalConfig
 * @prop {ShelleyAddressLike | Promise<ShelleyAddressLike>} changeAddress
 * @prop {TxInput[] | Promise<TxInput[]>} [spareUtxos]
 * @prop {NetworkParams | Promise<NetworkParams>} [networkParams]
 * @prop {number} [maxAssetsPerChangeOutput]
 * Defaults to the largest number of assets in one of the inputs
 *
 * @prop {boolean} [allowDirtyChangeOutput]
 * Defaults to false
 *
 * @prop {UplcLogger} [logOptions]
 * @prop {boolean} [throwBuildPhaseScriptErrors]
 * @prop {(tx: Tx) => (any | Promise<any>)} [beforeValidate]
 * @prop {ExBudgetModifier} [modifyExBudget]
 */

/**
 * @template [T=UplcData]
 * @typedef {(tx?: TxInfo) => (T | Promise<T>)} LazyRedeemerData
 */

/**
 * @typedef {object} TxBuilder
 * @prop {TxBuilderConfig} config
 * @prop {TxInput[]} inputs
 * @prop {Assets} mintedTokens
 * @prop {TxOutput[]} outputs
 * @prop {TxInput[]} refInputs
 * @prop {PubKeyHash[]} signers
 *
 * @prop {(config: TxBuilderFinalConfig) => Promise<Tx>} build
 * Builds and runs validation logic on the transaction, **throwing any validation errors found**
 * The resulting transaction may likely still require {@link Tx.addSignature} / {@link Tx.addSignatures} before
 * it is submitted to the network.
 * The {@link tx.validate|transaction-validation logic} run will throw an
 * error if the transaction is invalid for any reason, including script errors.
 * The `config.throwBuildPhaseScriptErrors` default (true) will throw script errors
 * during the build phase, but you can set it to false to defer those errors to the validate
 * phase.
 * Use {@link buildUnsafe} to get a transaction with possible {@link Tx.hasValidationError} set, and no thrown exception.
 *
 * @prop {(config: TxBuilderFinalConfig) => Promise<Tx>} buildUnsafe
 * Builds and runs validation logic on the transaction
 * Always returns a built transaction that has been validation-checked.
 * if the `throwBuildPhaseScriptErrors` option is true, then any script errors
 * found during transaction-building will be thrown, and the full transaction
 * validation is not run.
 * Caller should check {@link Tx.hasValidationError}, which will be
 * `false` or a validation error string, in case any transaction validations
 * are found.
 * Use {@link TxBuilder.build} if you want validation errors to be thrown.
 *
 * @prop {() => TxBuilder} reset
 * @prop {(utxo: TxInput | TxInput[]) => TxBuilder} addCollateral
 * @prop {(dcert: DCert) => TxBuilder} addDCert
 * @prop {(
 *   ...output: TxOutput[]
 * ) => TxBuilder} addOutput
 * Sorts that assets in the output if not already sorted (mutates `output`s) (needed by the Flint wallet)
 * Throws an error if any the value entries are non-positive
 * Throws an error if the output doesn't include a datum but is sent to a non-nativescript validator
 *
 * @prop {(...hash: PubKeyHash[]) => TxBuilder} addSigners
 * @prop {(fn: (b: TxBuilder) => any | Promise<any>) => TxBuilder} apply
 * Apply a function to the TxBuilder instance
 * Useful for chaining compositions of TxBuilder mutations
 * The return value of fn is unused
 *
 * @prop {(
 *   script: NativeScript
 * ) => TxBuilder} attachNativeScript
 * @prop {(
 *   program: UplcProgramV1 | UplcProgramV2
 * ) => TxBuilder} attachUplcProgram
 *
 * @prop {(
 *   hash: PubKeyHash,
 *   poolId: PubKeyHashLike
 * ) => TxBuilder} delegateWithoutRedeemer
 * @prop {<TRedeemer>(
 *   hash: StakingValidatorHash<StakingContext<any, TRedeemer>>,
 *   poolId: PubKeyHashLike,
 *   redeemer: TRedeemer
 * ) => TxBuilder} delegateWithRedeemer
 * @prop {(
 *   hash: PubKeyHash | StakingValidatorHash<any>,
 *   poolId: PubKeyHashLike,
 *   redeemer?: UplcData | LazyRedeemerData | undefined
 * ) => TxBuilder} delegateUnsafe
 * @prop {(
 *   hash: PubKeyHash
 * ) => TxBuilder} deregisterWithoutRedeemer
 * @prop {<TRedeemer>(
 *   hash: StakingValidatorHash<StakingContext<any, TRedeemer>>,
 *   redeemer: TRedeemer
 * ) => TxBuilder} deregisterWithRedeemer
 * @prop {(
 *   hash: PubKeyHash | StakingValidatorHash<any>,
 *   redeemer?: UplcData | LazyRedeemerData | undefined
 * ) => TxBuilder} deregisterUnsafe
 * @prop {(
 *   token: TokenValue
 * ) => TxBuilder} mintTokenValueWithoutRedeemer
 * Adds minting instructions to the transaction without a redeemer
 *
 * @prop {<TRedeemer>(
 *   token: TokenValue<MintingContext<any, TRedeemer>>,
 *   redeemer: TRedeemer
 * ) => TxBuilder} mintTokenValueWithRedeemer
 * Adds minting instructions to the transaction, given a transaction context supporting redeemer transformation
 *
 * @prop {(
 *   assetClass: AssetClass,
 *   quantity: IntLike
 * ) => TxBuilder} mintAssetClassWithoutRedeemer
 * Adds minting instructions to the transaction without a redeemer
 *
 * @prop {<TRedeemer>(
 *   assetClass: AssetClass<MintingContext<any, TRedeemer>>,
 *   quantity: IntLike,
 *   redeemer: TRedeemer
 * ) => TxBuilder} mintAssetClassWithRedeemer
 * Adds minting instructions to the transaction, given a transaction context supporting redeemer transformation
 *
 * @prop {<TRedeemer>(
 *   assetClass: AssetClass<MintingContext<any, TRedeemer>>,
 *   quantity: IntLike,
 *   redeemer: LazyRedeemerData<TRedeemer>
 * ) => TxBuilder} mintAssetClassWithLazyRedeemer
 * Adds minting instructions to the transaction, given a transaction context supporting redeemer transformation
 *
 * @prop {(
 *   assetClass: AssetClass,
 *   quantity: IntLike,
 *   redeemer?: UplcData | LazyRedeemerData | undefined
 * ) => TxBuilder} mintAssetClassUnsafe
 * @prop {(
 *   policy: MintingPolicyHash,
 *   tokens: [BytesLike, IntLike][]
 * ) => TxBuilder} mintPolicyTokensWithoutRedeemer
 * Adds minting instructions to the transaction without a redeemer
 *
 * @prop {<TRedeemer>(
 *   policy: MintingPolicyHash<MintingContext<any, TRedeemer>>,
 *   tokens: [BytesLike, IntLike][],
 *   redeemer: TRedeemer
 * ) => TxBuilder} mintPolicyTokensWithRedeemer
 * Adds minting instructions to the transaction, given a transaction context supporting redeemer transformation
 *
 * @prop {(
 *   policy: MintingPolicyHashLike,
 *   tokens: [BytesLike, IntLike][],
 *   redeemer?: UplcData | LazyRedeemerData | undefined
 * ) => TxBuilder} mintPolicyTokensUnsafe
 * Mint a list of tokens associated with a given `MintingPolicyHash`.
 * Throws an error if the given `MintingPolicyHash` was already used in a previous call to `mint()`.
 * The token names can either by a list of bytes or a hexadecimal string.
 * Also throws an error if the redeemer is `undefined`, and the minting policy isn't a known `NativeScript`.
 *
 * @prop {(
 *   address: ShelleyAddress<PubKeyHash>,
 *   value: ValueLike
 * ) => TxBuilder} payWithoutDatum
 * @prop {<TDatum>(
 *   address: ShelleyAddress<ValidatorHash<DatumPaymentContext<TDatum>>>,
 *   value: ValueLike,
 *   datum: TxOutputDatumCastable<TDatum>
 * ) => TxBuilder} payWithDatum
 * @prop {(
 *   addr: ShelleyAddressLike,
 *   value: ValueLike,
 *   datum?: TxOutputDatum | undefined
 * ) => TxBuilder} payUnsafe
 * @prop {(
 *   ...utxos: TxInput<any>[]
 * ) => TxBuilder} refer
 * Include a reference input
 *
 * @prop {(
 *   key: number,
 *   value: TxMetadataAttr
 * ) => TxBuilder} setMetadataAttribute
 * @prop {(
 *   attributes: {[key: number]: TxMetadataAttr}
 * ) => TxBuilder} setMetadataAttributes
 * @prop {(
 *   ...utxos: TxInput<PubKeyHash>[]
 * ) => TxBuilder} spendWithoutRedeemer
 * @prop {<TRedeemer>(
 *   utxos: TxInput<ValidatorHash<SpendingContext<any, any, any, TRedeemer>>> | TxInput<ValidatorHash<SpendingContext<any, any, any, TRedeemer>>>[],
 *   redeemer: TRedeemer
 * ) => TxBuilder} spendWithRedeemer
 * @prop {<TRedeemer>(
 *   utxos: TxInput<ValidatorHash<SpendingContext<any, any, any, TRedeemer>>> | TxInput<ValidatorHash<SpendingContext<any, any, any, TRedeemer>>>[],
 *   redeemer: LazyRedeemerData<TRedeemer>
 * ) => TxBuilder} spendWithLazyRedeemer
 * @prop {(
 *   utxos: TxInput<any> | TxInput<any>[],
 *   redeemer?: UplcData | LazyRedeemerData | undefined
 * ) => TxBuilder} spendUnsafe
 * Add a UTxO instance as an input to the transaction being built.
 * Throws an error if the UTxO is locked at a script address but a redeemer isn't specified (unless the script is a known `NativeScript`).
 *
 * @prop {(slot: IntLike) => TxBuilder} validFromSlot
 * Set the start of the valid time range by specifying a slot.
 *
 * @prop {(time: TimeLike) => TxBuilder} validFromTime
 * Set the start of the valid time range by specifying a time.
 *
 * @prop {(slot: IntLike) => TxBuilder} validToSlot
 * Set the end of the valid time range by specifying a slot.
 *
 * @prop {(time: TimeLike) => TxBuilder} validToTime
 * Set the end of the valid time range by specifying a time.
 *
 * @prop {(
 *   addr: StakingAddress<PubKeyHash>,
 *   lovelace: IntLike
 * ) => TxBuilder} withdrawWithoutRedeemer
 * @prop {<TRedeemer>(
 *   addr: StakingAddress<StakingValidatorHash<StakingContext<any, TRedeemer>>>,
 *   lovelace: IntLike,
 *   redeemer: TRedeemer
 * ) => TxBuilder} withdrawWithRedeemer
 * @prop {<TRedeemer>(
 *   addr: StakingAddress<StakingValidatorHash<StakingContext<any, TRedeemer>>>,
 *   lovelace: IntLike,
 *   redeemer: LazyRedeemerData<TRedeemer>
 * ) => TxBuilder} withdrawWithLazyRedeemer
 * @prop {(
 *   addr: StakingAddressLike,
 *   lovelace: IntLike,
 *   redeemer?: UplcData | LazyRedeemerData| undefined
 * ) => TxBuilder} withdrawUnsafe
 * @prop {(data: UplcData) => boolean} hasDatum
 * @prop {() => boolean} hasMetadata
 * @prop {() => boolean} hasUplcScripts
 * @prop {() => Assets} sumInputAndMintedAssets
 * Excludes lovelace
 *
 * @prop {() => Value} sumOutputValue
 * @prop {() => Assets} sumOutputAssets
 * Excludes lovelace
 */

/**
 * @typedef {object} TxChain
 * @prop {Tx[]} txs
 * @prop {(includeRefInputs?: boolean, includeCollateral?: boolean) => TxInput[]} collectInputs
 *  Returns all the inputs that aren't spent by the chain itself
 * (i.e. these inputs must exist before the chain is submitted)
 *
 * @prop {() => TxInput[]} collectOutputs
 * Collects all outputs that are spent by the chain itself
 * (i.e. these outputs will be available as UTxOs once the chain is submitted)
 *
 * Returns as TxInput instead of TxOutput so that TxOutputId is included
 */

/**
 * @typedef {object} TxChainBuilder
 * @prop {(tx: Tx) => TxChainBuilder} with
 * @prop {number} now
 * @prop {Promise<NetworkParams>} parameters
 * @prop {() => TxChain} build
 * @prop {(id: TxOutputId) => Promise<TxInput>} getUtxo
 * @prop {(addr: Address) => Promise<TxInput[]>} getUtxos
 * @prop {(tx: Tx) => Promise<TxId>} submitTx
 * @prop {() => boolean} isMainnet
 */

/**
 * @typedef {{
 *   id: string
 *   inputs: string[]
 *   outputs: string[]
 *   timestamp: number
 * }} TxSummaryJsonSafe
 */

/**
 * @typedef {object} TxSummary
 * @prop {TxId} id
 * @prop {TxInput[]} inputs
 * @prop {TxInput[]} outputs
 * @prop {number} timestamp
 * @prop {<SC extends SpendingCredential=SpendingCredential>(addresses: Address<SC>[]) => TxInput<SC>[]} getUtxosPaidTo
 * @prop {(utxo: TxInput | TxOutputId) => boolean} spends
 * @prop {() => TxSummary} reverse
 * @prop {<SC extends SpendingCredential=SpendingCredential>(utxos: TxInput<SC>[], addresses: Address<SC>[]) => TxInput<SC>[]} superimpose
 * @prop {() => TxSummaryJsonSafe} toJsonSafe
 */

/**
 * @typedef {object} ReadonlyWallet
 * An interface type for a readonly wallet that manages a user's UTxOs and addresses.
 *
 * @prop {() => Promise<boolean>} isMainnet
 * Returns `true` if the wallet is connected to the mainnet.
 *
 * @prop {Promise<Address[]>} usedAddresses
 * Returns a list of addresses which already contain UTxOs.
 *
 * @prop {Promise<Address[]>} unusedAddresses
 * Returns a list of unique unused addresses which can be used to send UTxOs to with increased anonimity.
 *
 * @prop {Promise<TxInput[]>} utxos
 * Returns a list of all the utxos controlled by the wallet.
 *
 * @prop {Promise<TxInput[]>} collateral
 * Returns a list of utxos suitable for use as collateral
 *
 * @prop {Promise<StakingAddress[]>} stakingAddresses
 * Returns a list of the reward addresses.
 */

/**
 * @typedef {object} Wallet
 * An interface type for a wallet that manages a user's UTxOs and addresses.
 *
 * @prop {() => Promise<boolean>} isMainnet
 * Returns `true` if the wallet is connected to the mainnet.
 *
 * @prop {Promise<Address[]>} usedAddresses
 * Returns a list of addresses which already contain UTxOs.
 *
 * @prop {Promise<Address[]>} unusedAddresses
 * Returns a list of unique unused addresses which can be used to send UTxOs to with increased anonimity.
 *
 * @prop {Promise<TxInput[]>} utxos
 * Returns a list of all the utxos controlled by the wallet.
 *
 * @prop {Promise<TxInput[]>} collateral
 * Returns a list of utxos suitable for use as collateral
 *
 * @prop {Promise<StakingAddress[]>} stakingAddresses
 * Returns a list of the reward addresses.
 *
 * @prop {(addr: Address, data: number[]) => Promise<Signature>} signData
 * Signs a message, returning an object containing the Signature that can be used to verify/authenticate the message later.
 *
 * @prop {(tx: Tx) => Promise<Signature[]>} signTx
 * Signs a transaction, returning a list of signatures needed for submitting a valid transaction.
 *
 * @prop {(tx: Tx) => Promise<TxId>} submitTx
 * Submits a transaction to the blockchain and returns the id of that transaction upon success.
 */

/**
 * @template {ReadonlyWallet} W
 * @typedef {object} WalletHelper
 * High-level helper for Wallet instances.
 *
 * @prop {W} wallet
 * Returns the underlying wallet
 *
 * @prop {() => Promise<boolean>} isMainnet
 * Returns `true` if the wallet is connected to the mainnet.
 *
 * @prop {Promise<Address[]>} allAddresses
 * Concatenation of `usedAddresses` and `unusedAddresses`.
 *
 * @prop {Promise<Address>}  baseAddress
 * First `Address` in `allAddresses`.
 * Throws an error if there aren't any addresses.
 *
 * @prop {Promise<Address>} changeAddress
 * First `Address` in `unusedAddresses` (falls back to last `Address` in `usedAddresses` if `unusedAddresses` is empty or not defined).
 *
 * @prop {Promise<Address[]>} usedAddresses
 * Returns a list of addresses which already contain UTxOs.
 *
 * @prop {Promise<Address[]>} unusedAddresses
 * Returns a list of unique unused addresses which can be used to send UTxOs to with increased anonimity.
 *
 * @prop {Promise<TxInput | undefined>} refUtxo
 * First UTxO in `utxos`. Can be used to distinguish between preview and preprod networks.
 *
 * @prop {Promise<TxInput[]>} utxos
 * Uses the fallback if the list returned from underlying wallet is empty.
 *
 * @prop {Promise<TxInput[]>} collateral
 * Returns a list of utxos suitable for use as collateral
 *
 * @prop {Promise<StakingAddress[]>} stakingAddresses
 * Returns a list of the reward addresses.
 *
 * @prop {() => Promise<Value>} calcBalance
 * Sums the values of all the utxos.
 *
 * @prop {(addr: Address) => Promise<boolean>} isOwnAddress
 * Returns `true` if the `PubKeyHash` in the given `Address` is controlled by the wallet.
 *
 * @prop {(pkh: PubKeyHash) => Promise<boolean>} isOwnPubKeyHash
 * Returns `true` if the given `PubKeyHash` is controlled by the wallet.
 *
 * @prop {(amount?: bigint) => Promise<TxInput>} selectCollateral
 * Picks a single UTxO intended as collateral.
 * The amount defaults to 2 Ada, which should cover most things
 *
 * @prop {(value: Value) => Promise<TxInput>} selectUtxo
 * Returns only a single utxo.
 * Throws an error if a UTxO containing the given value isn't found.
 *
 * @prop {(amount: Value, coinSelection?: CoinSelection) => Promise<TxInput[]>} selectUtxos
 * Pick a number of UTxOs needed to cover a given Value.
 * The default coin selection strategy is to pick the smallest first.
 *
 * @prop {() => Promise<OfflineWalletJsonSafe>} toJsonSafe
 *
 * @prop {() => Promise<OfflineWallet>} toOfflineWallet
 *
 * @prop {W extends Wallet ? (addr: Address, data: number[]) => Promise<Signature> : never} signData
 * Signs a message, returning an object containing the Signature that can be used to verify/authenticate the message later.
 * Only available if the underlying wallet isn't a ReadonlyWallet
 *
 * @prop {W extends Wallet ? (tx: Tx) => Promise<Signature[]> : never} signTx
 * Signs a transaction, returning a list of signatures needed for submitting a valid transaction.
 * Only available if the underlying wallet isn't a ReadonlyWallet
 *
 * @prop {W extends Wallet ? (tx: Tx) => Promise<TxId> : never} submitTx
 * Submits a transaction to the blockchain and returns the id of that transaction upon success.
 * Only available if the underlying wallet isn't a ReadonlyWallet
 */
