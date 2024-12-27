/**
 * @import { Address, AssetClass, NetworkParams, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
 * @import { ReadonlyCardanoClient, TxSummary } from "../index.js"
 */

/**
 * @param {ReadonlyCardanoClient[]} clients
 * @returns {ReadonlyCardanoClient}
 */
export function makeReadonlyCardanoMultiClient(clients) {
    return new ReadonlyCardanoMultiClientImpl(clients)
}

/**
 * @implements {ReadonlyCardanoClient}
 */
class ReadonlyCardanoMultiClientImpl {
    /**
     * @readonly
     * @type {ReadonlyCardanoClient[]}
     */
    clients

    /**
     * @readonly
     * @type {boolean}
     */
    mainnet

    /**
     * @param {ReadonlyCardanoClient[]} clients
     */
    constructor(clients) {
        this.clients = clients

        this.mainnet = this.clients.every((client) => client.isMainnet())

        if (
            this.mainnet &&
            this.clients.some((client) => !client.isMainnet())
        ) {
            throw new Error("some clients are for mainnet and some for testnet")
        }
    }

    /**
     * @type {number}
     */
    get now() {
        return tryClients(
            this.clients,
            (client) => client.now,
            "ReadonlyCardanoMultiClient.now"
        )
    }

    /**
     * @returns {boolean}
     */
    isMainnet() {
        return this.mainnet
    }

    /**
     * @type {Promise<NetworkParams>}
     */
    get parameters() {
        return tryClients(
            this.clients,
            (client) => client.parameters,
            "ReadonlyCardanoMultiClient.parameters"
        )
    }

    /**
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        return tryClients(
            this.clients,
            (client) => {
                return client.getUtxo(id)
            },
            `ReadonlyCardanoMultiClient.getUtxo(${id.toString()})`
        )
    }

    /**
     * @param {Address} address
     * @returns {Promise<TxInput[]>}
     */
    async getUtxos(address) {
        return tryClients(
            this.clients,
            (client) => {
                return client.getUtxos(address)
            },
            `ReadonlyCardanoMultiClient.getUtxos(${address.toString()})`
        )
    }

    /**
     * @returns {((id: TxId) => Promise<TxSummary>) | undefined}
     */
    get getTx() {
        /**
         * @type {(ReadonlyCardanoClient & {getTx(id: TxId): Promise<TxSummary>})[]}
         */
        const filteredClients = /** @type {any} */ (
            this.clients.filter((c) => !!c.getTx)
        )

        if (filteredClients.length > 0) {
            return (id) => {
                return tryClients(
                    filteredClients,
                    (client) => {
                        return client.getTx(id)
                    },
                    `ReadonlyCardanoMultiClient.getTx(${id.toString()})`
                )
            }
        } else {
            return undefined
        }
    }

    /**
     * @returns {((address: Address, assetClass: AssetClass) => Promise<TxInput[]>) | undefined}
     */
    get getUtxosWithAssetClass() {
        /**
         * @type {(ReadonlyCardanoClient & {getUtxosWithAssetClass(address: Address, assetClass: AssetClass): Promise<TxInput[]>})[]}
         */
        const filteredClients = /** @type {any} */ (
            this.clients.filter((c) => !!c.getUtxosWithAssetClass)
        )

        if (filteredClients.length > 0) {
            return (address, assetClass) => {
                return tryClients(
                    filteredClients,
                    (client) => {
                        return client.getUtxosWithAssetClass(
                            address,
                            assetClass
                        )
                    },
                    `ReadonlyCardanoMultiClient.getUtxosWithAssetClass(${address.toString()}, ${assetClass.toString()})`
                )
            }
        } else {
            return undefined
        }
    }
}

/**
 * @template {ReadonlyCardanoClient} C
 * @template T
 * @param {C[]} clients
 * @param {(client: C) => T} callback
 * @param {string} msg
 * @returns {T}
 */
function tryClients(clients, callback, msg) {
    /**
     * @type {Error[]}
     */
    let errors = []

    for (let i = 0; i < clients.length; i++) {
        try {
            const res = callback(clients[i])

            return res
        } catch (e) {
            if (e instanceof Error) {
                if (i < clients.length - 1) {
                    console.error(
                        `Client ${i} failed in ${msg}, falling back to next client`
                    )
                }

                errors.push(e)
            } else {
                throw e
            }
        }
    }

    if (errors.length == 0) {
        throw new Error(
            "internal error, expeced at least one error caught before"
        )
    }

    throw new Error(
        errors
            .map((e, i) => `Client ${i} failed due to: ${e.message}`)
            .join("; ")
    )
}
