export {}

/**
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
 * @typedef {{ name: string,
 *   icon: string
 *    enable(): Promise<Cip30FullHandle>
 *    isEnabled(): boolean
 * }} Cip30Handle
 *
 * @typedef {{
 *     getNetworkId(): Promise<number>
 *     getUsedAddresses(): Promise<string[]>
 *     getUnusedAddresses(): Promise<string[]>
 *     getUtxos(): Promise<string[]>
 *     getCollateral(): Promise<string[]>
 *     getRewardAddresses(): Promise<string[]>
 *     signData(addr: string, sigStructure: string): Promise<{signature: string, key: string}>
 *     signTx(txHex: string, partialSign: boolean): Promise<string>
 *     submitTx(txHex: string): Promise<string>
 *     experimental: {
 *         getCollateral(): Promise<string[]>
 *     }
 * }} Cip30FullHandle
 */
