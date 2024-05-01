import {
    Address,
    Signature,
    StakingAddress,
    Tx,
    TxId,
    TxInput
} from "@helios-lang/ledger"

/**
 * An interface type for a readonly wallet that manages a user's UTxOs and addresses.
 *  - isMainnet: returns `true` if the wallet is connected to the mainnet.
 *  - usedAddresses: returns a list of addresses which already contain UTxOs.
 *  - unusedAddresses: returns a list of unique unused addresses which can be used to send UTxOs to with increased anonimity.
 *  - utxos: Returns a list of all the utxos controlled by the wallet.
 *  - collateral: returns a list of utxos suitable for use as collateral
 *  - stakingAddresses: returns a list of the reward addresses.
 *
 * @typedef {{
 *   isMainnet(): Promise<boolean>
 *   usedAddresses: Promise<Address[]>
 *   unusedAddresses: Promise<Address[]>
 *   utxos: Promise<TxInput[]>
 *   collateral: Promise<TxInput[]>
 *   stakingAddresses: Promise<StakingAddress[]>
 * }} ReadonlyWallet
 */

/**
 * An interface type for a wallet that manages a user's UTxOs and addresses.
 *  - isMainnet: returns `true` if the wallet is connected to the mainnet.
 *  - usedAddresses: returns a list of addresses which already contain UTxOs.
 *  - unusedAddresses: returns a list of unique unused addresses which can be used to send UTxOs to with increased anonimity.
 *  - utxos: Returns a list of all the utxos controlled by the wallet.
 *  - collateral: returns a list of utxos suitable for use as collateral
 *  - stakingAddresses: returns a list of the reward addresses.
 *  - signData: signs a message, returning an object containing the Signature that can be used to verify/authenticate the message later.
 *  - signTx: signs a transaction, returning a list of signatures needed for submitting a valid transaction.
 *  - submitTx: submits a transaction to the blockchain and returns the id of that transaction upon success.
 *
 * @typedef {ReadonlyWallet & {
 *   signData(addr: Address, data: number[]): Promise<Signature>
 *   signTx(tx: Tx): Promise<Signature[]>
 *   submitTx(tx: Tx): Promise<TxId>
 * }} Wallet
 */
