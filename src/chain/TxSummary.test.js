import { describe, it } from "node:test"
import { isTxSummaryJsonSafe } from "./TxSummary.js"
import {
    Address,
    TxId,
    TxInput,
    TxOutput,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { bytesToHex } from "@helios-lang/codec-utils"
import { strictEqual } from "node:assert"

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
