import { PubKey, Signature } from "@helios-lang/ledger"

/**
 * @import { AssertExtends } from "@helios-lang/type-utils"
 * @import { Bip32PrivateKey, BlockfrostV0Client, CardanoClient, CardanoClientHelper, Cip30Wallet, Emulator, KoiosV0Client, OfflineWallet, RootPrivateKey, ReadonlyCardanoClient, ReadonlyWallet, ReadonlyRefScriptRegistry, RefScriptRegistry, SimpleWallet, TxChainBuilder, Wallet, WalletHelper } from "src/index.js"
 */

/**
 * @typedef {{
 *   derivePubKey(): PubKey
 *   sign(data: number[]): Signature
 * }} PrivateKey
 */

/**
 * ReadonlyCardanoClient implementations
 * @typedef {AssertExtends<ReadonlyCardanoClient, CardanoClient>} _CardanoClientExtendsReadonlyCardanoClient
 * @typedef {AssertExtends<ReadonlyCardanoClient, CardanoClientHelper<ReadonlyCardanoClient>>} _CardanoClientHelperOfReadonlyCardanoClientExtendsReadonlyCardanoClient
 */

/**
 * CardanoClient implementations
 * @typedef {AssertExtends<CardanoClient, BlockfrostV0Client>} _BlockfrostV0ClientExtendsCardanoClient
 * @typedef {AssertExtends<CardanoClient, Emulator>} _EmulatorExtendsCardanoClient
 * @typedef {AssertExtends<CardanoClient, KoiosV0Client>} _KoiosV0ClientExtendsCardanoClient
 * @typedef {AssertExtends<CardanoClient, TxChainBuilder>} _TxChainBuilderExtendsCardanoClient
 */

/**
 * PrivateKey implementations
 * @typedef {AssertExtends<PrivateKey, Bip32PrivateKey>} _Bip32PrivateKeyExtendsPrivateKey
 * @typedef {AssertExtends<PrivateKey, RootPrivateKey>} _RootPrivateKeyExtendsPrivateKey
 */

/**
 * ReadonlyRefScriptRegistry implementations
 * @typedef {AssertExtends<ReadonlyRefScriptRegistry, RefScriptRegistry>} _RefScriptRegistryExtendsReadonlyRefScriptRegistry
 */

/**
 * ReadonlyWallet implementations
 * @typedef {AssertExtends<ReadonlyWallet, OfflineWallet>} _OfflineWalletExtendsReadonlyWallet
 * @typedef {AssertExtends<ReadonlyWallet, Wallet>} _WalletExtendsReadonlyWallet
 * @typedef {AssertExtends<ReadonlyWallet, WalletHelper<ReadonlyWallet>>} _WalletHelperOfReadonlyWalletExtendsReadonlyWallet
 */

/**
 * Wallet implementations
 * @typedef {AssertExtends<Wallet, Cip30Wallet>} _Cip30WalletExtendsWallet
 * @typedef {AssertExtends<Wallet, SimpleWallet>} _SimpleWalletExtendsWallet
 * @typedef {AssertExtends<Wallet, WalletHelper<Wallet>>} _WalletHelperOfWalletExtendsWallet
 */
