import { generateBytes, mulberry32 } from "@helios-lang/crypto"
import {
    makeAssets,
    DEFAULT_NETWORK_PARAMS,
    makeTxOutputId
} from "@helios-lang/ledger"
import { SECOND } from "../duration/index.js"
import { makeRootPrivateKey } from "../keys/index.js"
import { makeSimpleWallet } from "../wallets/index.js"
import { makeEmulatorGenesisTx } from "./EmulatorGenesisTx.js"
import { makeEmulatorRegularTx } from "./EmulatorRegularTx.js"
import {
    SubmissionExpiryError,
    SubmissionUtxoError
} from "../clients/errors.js"

/**
 * @import { IntLike } from "@helios-lang/codec-utils"
 * @import { NumberGenerator } from "@helios-lang/crypto"
 * @import { Address, Assets, NetworkParams, Tx, TxId, TxInput, TxOutputId } from "@helios-lang/ledger"
 * @import { Emulator, EmulatorTx, EmulatorGenesisTx, SimpleWallet } from "../index.js"
 */

/**
 * @param {number} seed
 * @returns {Emulator}
 */
export function makeEmulator(seed = 0) {
    return new EmulatorImpl(seed)
}

/**
 * A simple emulated Network.
 * This can be used to do integration tests of whole dApps.
 * Staking is not yet supported.
 * @implements {Emulator}
 */
class EmulatorImpl {
    /**
     * @type {number}
     */
    currentSlot

    /**
     * @private
     * @type {NumberGenerator}
     */
    _random

    /**
     * @type {EmulatorGenesisTx[]}
     */
    genesis

    /**
     * @type {EmulatorTx[]}
     */
    mempool

    /**
     * @type {EmulatorTx[][]}
     */
    blocks

    /**
     * Cached map of all UTxOs ever created
     * @private
     * @type {Record<string, TxInput>}
     */
    _allUtxos

    /**
     * Cached set of all UTxOs ever consumed
     * @private
     * @type {Set<string>}
     */
    _consumedUtxos

    /**
     * Cached map of UTxOs at addresses
     * @private
     * @type {Record<string, TxInput[]>}
     */
    _addressUtxos

    /**
     * Instantiates a Emulator at slot 0.
     * An optional seed number can be specified, from which all emulated randomness is derived.
     * @param {number} seed
     */
    constructor(seed = 0) {
        this.currentSlot = 0

        this._random = mulberry32(seed)

        this.genesis = []
        this.mempool = []
        this.blocks = []

        this._allUtxos = {}
        this._consumedUtxos = new Set()
        this._addressUtxos = {}
    }

    /**
     * Each slot is assumed to be 1000 milliseconds
     * @returns {number} - milliseconds since start of emulation
     */
    get now() {
        return SECOND * this.currentSlot
    }

    /**
     * @returns {Promise<NetworkParams>}
     */
    get parameters() {
        return new Promise((resolve, _) => resolve(this.parametersSync))
    }

    /**
     * @returns {NetworkParams}
     */
    get parametersSync() {
        return {
            ...DEFAULT_NETWORK_PARAMS(),
            refTipSlot: this.currentSlot,
            refTipTime: this.now
        }
    }

    /**
     * Ignores the genesis txs
     * @type {TxId[]}
     */
    get txIds() {
        /**
         * @type {TxId[]}
         */
        const res = []

        // TODO: the current approach is very slow, use a snapshot
        for (let block of this.blocks) {
            for (let tx of block) {
                if (tx.kind == "Regular") {
                    res.push(tx.id())
                }
            }
        }

        return res
    }

    /**
     * Creates a new SimpleWallet and populates it with a given lovelace quantity and assets.
     * Special genesis transactions are added to the emulated chain in order to create these assets.
     * @param {bigint} lovelace
     * @param {Assets} assets
     * @returns {SimpleWallet}
     */
    createWallet(lovelace = 0n, assets = makeAssets([])) {
        const rootKey = makeRootPrivateKey(generateBytes(this._random, 32))
        const wallet = makeSimpleWallet(rootKey, this)

        this.createUtxo(wallet, lovelace, assets)

        return wallet
    }

    /**
     * Creates a UTxO using a GenesisTx.
     * @param {SimpleWallet} wallet
     * @param {bigint} lovelace
     * @param {Assets} assets
     * @returns {TxOutputId}
     */
    createUtxo(wallet, lovelace, assets = makeAssets([])) {
        const tx = makeEmulatorGenesisTx(
            this.genesis.length,
            wallet.address,
            lovelace,
            assets
        )

        this.genesis.push(tx)
        this.mempool.push(tx)

        return makeTxOutputId(tx.id(), 0)
    }

    /**
     * @returns {void}
     */
    dump() {
        console.log(`${this.blocks.length} BLOCKS`)
        this.blocks.forEach((block, i) => {
            console.log(`${block.length} TXs in BLOCK ${i}`)
            for (let tx of block) {
                tx.dump()
            }
        })
    }

    /**
     * @param {TxId} id
     * @returns {Promise<Tx>}
     */
    async getTx(id) {
        const found = this.mempool.find((tx) => tx.id() === id)

        if (!found) {
            throw new Error(`Tx ${id.toString()} not found`)
        }

        return /** @type {any} */ (found)
    }

    /**
     * Throws an error if the UTxO isn't found
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        this.warnMempool()

        const utxo = this._allUtxos[id.toString()]

        if (!utxo) {
            throw new Error(`utxo with id ${id.toString()} doesn't exist`)
        } else {
            return utxo
        }
    }

    /**
     * @param {Address} address
     * @returns {Promise<TxInput[]>}
     */
    async getUtxos(address) {
        this.warnMempool()

        return this._addressUtxos[address.toString()] ?? []
    }

    /**
     * @param {TxOutputId} id
     * @returns {Promise<boolean>}
     */
    async hasUtxo(id) {
        return id.toString() in this._allUtxos
    }

    /**
     * @param {TxInput} utxo
     * @returns {boolean}
     */
    isConsumed(utxo) {
        return (
            this._consumedUtxos.has(utxo.id.toString()) ||
            this.mempool.some((tx) => {
                return tx.consumes(utxo)
            })
        )
    }

    /**
     * @returns {boolean}
     */
    isMainnet() {
        return false
    }

    /**
     * @param {Tx} tx
     * @returns {Promise<TxId>}
     */
    async submitTx(tx) {
        this.warnMempool()

        if (!tx.isValidSlot(BigInt(this.currentSlot))) {
            // TODO: add isExpired or isPremature, when other preferred clients also have positive detection
            //  of these details
            throw new SubmissionExpiryError(
                `tx invalid (slot out of range, ${this.currentSlot} not in ${tx.body.getValidityTimeRange(this.parametersSync).toString()})`
            )
        }

        // make sure that each input exists
        for (const input of tx.body.inputs) {
            if (!this.hasUtxo(input.id)) {
                throw new SubmissionUtxoError(
                    "some inputs don't exist",
                    input.id
                )
            }
        }

        // make sure that each ref input exists
        for (const input of tx.body.refInputs) {
            if (!this.hasUtxo(input.id)) {
                throw new SubmissionUtxoError(
                    "some ref inputs don't exist",
                    input.id
                )
            }
        }

        // make sure that none of the inputs have been consumed before
        for (const input of tx.body.inputs) {
            if (this.isConsumed(input)) {
                throw new SubmissionUtxoError(
                    "input already consumed before",
                    input.id
                )
            }
        }

        this.mempool.push(makeEmulatorRegularTx(tx))

        return tx.id()
    }

    /**
     * Mint a block with the current mempool, and advance the slot by a number of slots.
     * @param {IntLike} nSlots
     */
    tick(nSlots) {
        if (Number(nSlots) == 0) {
            throw new Error(`nSlots must be > 0, got ${nSlots.toString()}`)
        }

        if (this.mempool.length > 0) {
            this.pushBlock(this.mempool)

            this.mempool = []
        }

        this.currentSlot += Number(nSlots)
    }

    /**
     * @private
     */
    warnMempool() {
        if (this.mempool.length > 0) {
            console.error(
                "Warning: mempool not empty (hint: use 'network.tick()')"
            )
        }
    }

    /**
     * @private
     * @param {EmulatorTx[]} txs
     */
    pushBlock(txs) {
        this.blocks.push(txs)

        // add all new utxos
        txs.forEach((tx) => {
            tx.newUtxos().forEach((utxo) => {
                const key = utxo.id.toString()
                this._allUtxos[key] = utxo

                const addr = utxo.address.toString()

                if (addr in this._addressUtxos) {
                    this._addressUtxos[addr].push(utxo)
                } else {
                    this._addressUtxos[addr] = [utxo]
                }
            })

            tx.consumedUtxos().forEach((utxo) => {
                this._consumedUtxos.add(utxo.id.toString())

                const addr = utxo.address.toString()

                if (addr in this._addressUtxos) {
                    this._addressUtxos[addr] = this._addressUtxos[addr].filter(
                        (inner) => !inner.isEqual(utxo)
                    )
                }
            })
        })
    }
}
