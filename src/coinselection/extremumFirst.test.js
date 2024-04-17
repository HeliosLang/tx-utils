import { describe, it } from "node:test"
import {
    Address,
    Assets,
    TxInput,
    TxOutput,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { selectSmallestFirst } from "./extremumFirst.js"
import { strictEqual } from "node:assert"

describe(selectSmallestFirst.name, () => {
    const utxos = [
        new TxInput(
            TxOutputId.dummy(),
            new TxOutput(
                Address.dummy(false),
                new Value(
                    2_000_000n,
                    new Assets({
                        "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e":
                            {
                                "776f726c646d6f62696c65746f6b656e": 314_000_000n
                            }
                    })
                )
            )
        ),
        new TxInput(
            TxOutputId.dummy(),
            new TxOutput(
                Address.dummy(false),
                new Value(
                    2_000_000n,
                    new Assets({
                        c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad:
                            {
                                "0014df105553444d": 239_000_000n
                            }
                    })
                )
            )
        ),
        new TxInput(
            TxOutputId.dummy(),
            new TxOutput(Address.dummy(false), new Value(5_000_000n))
        ),
        new TxInput(
            TxOutputId.dummy(),
            new TxOutput(Address.dummy(false), new Value(10_000_000n))
        )
    ]

    it("don't select UTxOs containing assets no involved in the selection", () => {
        const [selected] = selectSmallestFirst(utxos, new Value(10_000_000n))

        const valueSelected = Value.sum(selected)
        const lovelaceSelected = valueSelected.lovelace
        const nAssetClasses = valueSelected.assets.assetClasses.length

        strictEqual(selected.length, 2)
        strictEqual(lovelaceSelected, 15_000_000n)
        strictEqual(nAssetClasses, 0)
    })
})
