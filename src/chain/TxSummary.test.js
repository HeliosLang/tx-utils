import { deepEqual, strictEqual } from "node:assert"
import { describe, it } from "node:test"
import { bytesToHex } from "@helios-lang/codec-utils"
import {
    makeDummyAddress,
    makeDummyTxId,
    makeDummyTxOutputId,
    makeTxInput,
    makeTxOutput,
    makeValue
} from "@helios-lang/ledger"
import { makeTxSummary, isTxSummaryJsonSafe } from "./TxSummary.js"

describe(isTxSummaryJsonSafe.name, () => {
    it("ok for valid", () => {
        const valid = {
            id: makeDummyTxId().toHex(),
            inputs: [
                bytesToHex(
                    makeTxInput(
                        makeDummyTxOutputId(),
                        makeTxOutput(makeDummyAddress(true), makeValue(0n))
                    ).toCbor(true)
                )
            ],
            outputs: [
                bytesToHex(
                    makeTxInput(
                        makeDummyTxOutputId(),
                        makeTxOutput(makeDummyAddress(true), makeValue(0n))
                    ).toCbor(true)
                )
            ],
            timestamp: Date.now()
        }

        strictEqual(isTxSummaryJsonSafe(valid), true)
    })

    it("nok for invalid", () => {
        const valid = {
            id: makeDummyTxId().toHex(),
            inputs: [
                bytesToHex(
                    makeTxInput(
                        makeDummyTxOutputId(),
                        makeTxOutput(makeDummyAddress(true), makeValue(0n))
                    ).toCbor(false)
                )
            ],
            outputs: [
                bytesToHex(
                    makeTxInput(
                        makeDummyTxOutputId(),
                        makeTxOutput(makeDummyAddress(true), makeValue(0n))
                    ).toCbor(true)
                )
            ],
            timestamp: Date.now()
        }

        strictEqual(isTxSummaryJsonSafe(valid), false)
    })
})

describe("TxSummary", () => {
    it("superimpose ignores utxos that have already been included", () => {
        const utxos = [
            makeTxInput(
                makeDummyTxOutputId(),
                makeTxOutput(makeDummyAddress(false), makeValue(0))
            )
        ]

        const summary = makeTxSummary({
            id: makeDummyTxId(),
            inputs: [],
            outputs: [
                makeTxInput(
                    makeDummyTxOutputId(),
                    makeTxOutput(makeDummyAddress(false), makeValue(0))
                )
            ],
            timestamp: 0
        })

        const newUtxos = summary.superimpose(utxos, [makeDummyAddress(false)])

        deepEqual(newUtxos, utxos)
    })
})
