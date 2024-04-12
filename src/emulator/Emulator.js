import { generateBytes, mulberry32 } from "@helios-lang/crypto"
import {
    Address,
    Assets,
    DEFAULT_NETWORK_PARAMS,
    NetworkParamsHelper,
    Tx,
    TxId,
    TxInput,
    TxOutputId
} from "@helios-lang/ledger"
import { RootPrivateKey } from "../keys/index.js"
import { SimpleWallet } from "../wallets/index.js"
import { GenesisTx } from "./GenesisTx.js"
import { RegularTx } from "./RegularTx.js"
import { SECOND } from "../duration/index.js"

/**
 * @typedef {import("@helios-lang/codec-utils").IntLike} IntLike
 * @typedef {import("@helios-lang/crypto").NumberGenerator} NumberGenerator
 * @typedef {import("@helios-lang/ledger").NetworkParams} NetworkParams
 * @typedef {import("../network/Network.js").Network} Network
 * @typedef {import("./EmulatorTx.js").EmulatorTx} EmulatorTx
 */

/**
 * A simple emulated Network.
 * This can be used to do integration tests of whole dApps.
 * Staking is not yet supported.
 * @implements {Network}
 */
export class Emulator {
    /**
     * @type {number}
     */
    currentSlot

    /**
     * @type {NumberGenerator}
     */
    #random

    /**
     * @type {GenesisTx[]}
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
     * Instantiates a Emulator at slot 0.
     * An optional seed number can be specified, from which all emulated randomness is derived.
     * @param {number} seed
     */
    constructor(seed = 0) {
        this.currentSlot = 0

        this.#random = mulberry32(seed)

        this.genesis = []
        this.mempool = []
        this.blocks = []
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
            ...DEFAULT_NETWORK_PARAMS,
            latestTip: {
                epoch: 0,
                hash: "", // there are no block hashes in the emulator currently
                slot: this.currentSlot,
                time: this.now
            }
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

        for (let block of this.blocks) {
            for (let tx of block) {
                if (tx instanceof RegularTx) {
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
    createWallet(lovelace = 0n, assets = new Assets([])) {
        const rootKey = new RootPrivateKey(generateBytes(this.#random, 32))
        const wallet = SimpleWallet.fromRootPrivateKey(rootKey, this)

        this.createUtxo(wallet, lovelace, assets)

        return wallet
    }

    /**
     * Creates a UTxO using a GenesisTx.
     * @param {SimpleWallet} wallet
     * @param {bigint} lovelace
     * @param {Assets} assets
     */
    createUtxo(wallet, lovelace, assets = new Assets([])) {
        if (lovelace != 0n || !assets.isZero()) {
            const tx = new GenesisTx(
                this.genesis.length,
                wallet.address,
                lovelace,
                assets
            )

            this.genesis.push(tx)
            this.mempool.push(tx)
        }
    }

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
     * Throws an error if the UTxO isn't found
     * @param {TxOutputId} id
     * @returns {Promise<TxInput>}
     */
    async getUtxo(id) {
        this.warnMempool()

        for (let block of this.blocks) {
            for (let tx of block) {
                const utxo = tx.getUtxo(id)
                if (utxo) {
                    return utxo
                }
            }
        }

        throw new Error(`utxo with id ${id.toString()} doesn't exist`)
    }

    /**
     * @param {Address} address
     * @returns {Promise<TxInput[]>}
     */
    async getUtxos(address) {
        this.warnMempool()

        /**
         * @type {TxInput[]}
         */
        let utxos = []

        for (let block of this.blocks) {
            for (let tx of block) {
                utxos = tx.collectUtxos(address, utxos)
            }
        }

        return utxos
    }

    /**
     * @param {TxInput} utxo
     * @returns {boolean}
     */
    isConsumed(utxo) {
        return (
            this.blocks.some((b) => {
                return b.some((tx) => {
                    return tx.consumes(utxo)
                })
            }) ||
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
            throw new Error(
                `tx invalid (slot out of range, ${this.currentSlot} not in ${tx.body.getValidityTimeRange(new NetworkParamsHelper(this.parametersSync)).toString()})`
            )
        }

        // make sure that none of the inputs have been consumed before
        if (tx.body.inputs.some((input) => this.isConsumed(input))) {
            throw new Error("input already consumed before")
        }

        this.mempool.push(new RegularTx(tx))

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
            this.blocks.push(this.mempool)

            this.mempool = []
        }

        this.currentSlot += Number(nSlots)
    }

    warnMempool() {
        if (this.mempool.length > 0) {
            console.error(
                "Warning: mempool not empty (hint: use 'network.tick()')"
            )
        }
    }
}
