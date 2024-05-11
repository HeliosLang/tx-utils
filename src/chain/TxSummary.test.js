import { describe, it } from "node:test"
import { TxSummary, isTxSummaryJsonSafe } from "./TxSummary.js"
import {
    Address,
    TxId,
    TxInput,
    TxOutput,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { bytesToHex } from "@helios-lang/codec-utils"
import { deepEqual, strictEqual } from "node:assert"

describe(isTxSummaryJsonSafe.name, () => {
    it("ok for valid", () => {
        const valid = {
            id: TxId.dummy().toHex(),
            inputs: [
                bytesToHex(
                    new TxInput(
                        TxOutputId.dummy(),
                        new TxOutput(Address.dummy(true), new Value(0n))
                    ).toCbor(true)
                )
            ],
            outputs: [
                bytesToHex(
                    new TxInput(
                        TxOutputId.dummy(),
                        new TxOutput(Address.dummy(true), new Value(0n))
                    ).toCbor(true)
                )
            ],
            timestamp: Date.now()
        }

        strictEqual(isTxSummaryJsonSafe(valid), true)
    })

    it("nok for invalid", () => {
        const valid = {
            id: TxId.dummy().toHex(),
            inputs: [
                bytesToHex(
                    new TxInput(
                        TxOutputId.dummy(),
                        new TxOutput(Address.dummy(true), new Value(0n))
                    ).toCbor(false)
                )
            ],
            outputs: [
                bytesToHex(
                    new TxInput(
                        TxOutputId.dummy(),
                        new TxOutput(Address.dummy(true), new Value(0n))
                    ).toCbor(true)
                )
            ],
            timestamp: Date.now()
        }

        strictEqual(isTxSummaryJsonSafe(valid), false)
    })
})

describe(TxSummary.name, () => {
    it("superimpose ignores utxos that have already been included", () => {
        const utxos = [
            new TxInput(
                TxOutputId.dummy(),
                new TxOutput(Address.dummy(false), new Value(0))
            )
        ]

        const summary = new TxSummary({
            id: TxId.dummy(),
            inputs: [],
            outputs: [
                new TxInput(
                    TxOutputId.dummy(),
                    new TxOutput(Address.dummy(false), new Value(0))
                )
            ],
            timestamp: 0
        })

        const newUtxos = summary.superimpose(utxos, [Address.dummy(false)])

        deepEqual(newUtxos, utxos)
    })
})
