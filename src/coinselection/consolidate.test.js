import { describe, it } from "node:test"
import { consolidate } from "./consolidate.js"
import {
    Address,
    AssetClass,
    TxInput,
    TxOutput,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { strictEqual, throws } from "node:assert"

describe(consolidate.name, () => {
    const addr = Address.dummy(true)
    const utxos = [
        new TxInput(
            TxOutputId.new(
                "0ee9edf9bef0cf47afa9bd75a0546040e62c8a13818cc4786148d99ec603db26#0"
            ),
            new TxOutput(
                addr,
                new Value(3938932612n, {
                    "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e":
                        {
                            "776f726c646d6f62696c65746f6b656e": 2233701199n
                        },
                    "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f":
                        {
                            "534e454b": 362627n
                        },
                    f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880: {
                        69555344: 253816039n
                    }
                })
            )
        ),
        new TxInput(
            TxOutputId.new(
                "676bfa6d22032dda9a570149a4f787eef8e795089e803669e6ee38cc1503a9fa#1"
            ),
            new TxOutput(addr, new Value(44789501n))
        ),
        new TxInput(
            TxOutputId.new(
                "73d487ae5018d5f6913697beed670928ae15cf60117adbca9cc0d3898bcec3b8#1"
            ),
            new TxOutput(addr, new Value(171004270n))
        ),
        new TxInput(
            TxOutputId.new(
                "73d487ae5018d5f6913697beed670928ae15cf60117adbca9cc0d3898bcec3b8#0"
            ),
            new TxOutput(
                addr,
                new Value(1193870n, {
                    "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f":
                        {
                            "534e454b": 47782n
                        }
                })
            )
        ),
        new TxInput(
            TxOutputId.new(
                "8c8a7a1d549a0a8db52d8c8ba5e06266b8412aa666305e5ae506d5273403311a#1"
            ),
            new TxOutput(addr, new Value(585435957n))
        ),
        new TxInput(
            TxOutputId.new(
                "cda75bfc35cbe6c7a23c6d0a8f3978fc6a6a82d749fc624e44da5b36ab8774a8#3"
            ),
            new TxOutput(
                addr,
                new Value(1172320n, {
                    f643c8c300085984c09d5a2d7f5b45fd2d5921cbd1512c972981402b: {
                        38: 1n
                    }
                })
            )
        ),
        new TxInput(
            TxOutputId.new(
                "d4ce44bf6801971572a152d7fa2a2033c7499a450ffb201339df2afdf6114c33#1"
            ),
            new TxOutput(addr, new Value(702252110n))
        ),
        new TxInput(
            TxOutputId.new(
                "d4ce44bf6801971572a152d7fa2a2033c7499a450ffb201339df2afdf6114c33#0"
            ),
            new TxOutput(
                addr,
                new Value(1254210n, {
                    "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e":
                        {
                            "776f726c646d6f62696c65746f6b656e": 153736155n
                        }
                })
            )
        )
    ]

    it("cleans up dirty UTxOs", () => {
        const coinSelection = consolidate({
            includeAssets: [
                AssetClass.ADA,
                AssetClass.new(
                    "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e.776f726c646d6f62696c65746f6b656e"
                )
            ],
            excludeAssets: [
                AssetClass.new(
                    "f643c8c300085984c09d5a2d7f5b45fd2d5921cbd1512c972981402b.38"
                )
            ],
            maxUtxos: 3
        })

        const [selectedUtxos] = coinSelection(
            utxos,
            new Value(0, {
                "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e": {
                    "776f726c646d6f62696c65746f6b656e": 2000_000_000n
                }
            })
        )

        strictEqual(selectedUtxos.length, 3) // expect 3 due to consolidation (2 just for WMT)
    })

    it("fails if too much is excluded", () => {
        const coinSelection = consolidate({
            includeAssets: [
                AssetClass.ADA,
                AssetClass.new(
                    "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e.776f726c646d6f62696c65746f6b656e"
                )
            ],
            excludeAssets: [
                AssetClass.new(
                    "f643c8c300085984c09d5a2d7f5b45fd2d5921cbd1512c972981402b.38"
                ),
                AssetClass.new(
                    "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f.534e454b"
                )
            ],
            maxUtxos: 3
        })

        throws(() => {
            coinSelection(
                utxos,
                new Value(0, {
                    "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e":
                        {
                            "776f726c646d6f62696c65746f6b656e": 2000_000_000n
                        }
                })
            )
        })
    })
})
