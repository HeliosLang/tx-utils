import assert, { strictEqual } from "node:assert"
import { describe, it } from "node:test"
import { hexToBytes } from "@helios-lang/codec-utils"
import {
    addValues,
    makeAddress,
    makeAssetClass,
    makeInlineTxOutputDatum,
    makeMintingPolicyHash,
    makeNetworkParamsHelper,
    makeTxId,
    makeTxInput,
    makeTxOutputId,
    makeValue,
    parseTxOutputId
} from "@helios-lang/ledger"
import { makeIntData } from "@helios-lang/uplc"
import { makeTxChainBuilder } from "../chain/index.js"
import { restoreRootPrivateKey } from "../keys/index.js"
import { makeTxBuilder } from "../txbuilder/index.js"
import { makeUnstakedSimpleWallet } from "../wallets/index.js"
import { makeIrisClient } from "./IrisClient.js"

const host = "https://ns5037712.ip-148-113-219.net"

// phrase of a funded wallet
// make empty before pushing code
const phrase = []

describe("IrisClient", async () => {
    const client = makeIrisClient(host, false)

    await it("get parameters return object with expected fields", async () => {
        const params = await client.parameters

        assert(
            Object.keys(params).length > 5,
            "expected at least 5 entries in network parameters"
        )

        // roundtrip time-to-slot and slot-to-time is the same
        const helper = makeNetworkParamsHelper(params)
        const time = 1750768620000
        strictEqual(
            helper.slotToTime(helper.timeToSlot(time)),
            time,
            "slot-to-time roundtrip not equal"
        )
    })

    await it("getTx() returns a known Tx with a UTXO at an expected addr", async () => {
        const txID =
            "33b2cad72d0f0ddafcfc16fabcf92d2ab0e9d4034ea40ab1bc1f4dfffb15fbc9"

        const tx = await client.getTx(makeTxId(txID))

        const expectedAddr = makeAddress(
            "addr_test1wrnpd4l7jtfs0sgzuks7w0wvxwkcul6uag34xjvhgsxwj2qk5yq82"
        )
        assert(
            tx.body.outputs.some((utxo) => utxo.address.isEqual(expectedAddr)),
            `expected at least 1 addr ${expectedAddr.toString()}`
        )
    })

    await it("getUtxo() returns a known UTXO containing a ref script", async () => {
        const utxoID =
            "33b2cad72d0f0ddafcfc16fabcf92d2ab0e9d4034ea40ab1bc1f4dfffb15fbc9#0"

        const utxo = await client.getUtxo(parseTxOutputId(utxoID))

        const expectedAddr = makeAddress(
            "addr_test1wrnpd4l7jtfs0sgzuks7w0wvxwkcul6uag34xjvhgsxwj2qk5yq82"
        )
        assert(utxo.address.isEqual(expectedAddr), "utxo at unexpected address")
    })

    await it("getUtxo() throws a UtxoAlreadySpentError for a UTXO that is known to be already spent", async () => {
        const utxoID =
            "33b2cad72d0f0ddafcfc16fabcf92d2ab0e9d4034ea40ab1bc1f4dfffb15fbc9#1"

        try {
            await client.getUtxo(parseTxOutputId(utxoID))

            throw new Error("expected utxo to be already spent")
        } catch (e) {
            if ("consumedBy" in e) {
                assert(
                    e.consumedBy.isEqual(
                        makeTxId(
                            "2a710139fe3d83dc16f9dd3e9e267a98a38d8d5c23ab8b4742f0c0cc8a947ef0"
                        )
                    )
                )
            } else {
                throw e
            }
        }
    })

    await it("getUtxos() returns some UTXOs", async () => {
        let addr =
            "addr_test1wq0a8zn7z544qvlxkt69g37thxrg8fepfuat9dcmnla2qjcysrmal"
        addr = "addr_test1wqyp8f3s30t0kvqa3vfgq8lrhv7vtxrn9w9k9vh5s4syzacyjcr9g"

        const utxos = await client.getUtxos(makeAddress(addr))

        assert(utxos.length > 0, "expected more than 0 UTXOs, got 0")
        assert(
            utxos.every((utxo) => utxo.address.isEqual(makeAddress(addr))),
            "some utxos at unexpected address"
        )
    })

    await it("getUtxosWithAssetClass() returns some UTXOs with known assets", async () => {
        const addr =
            "addr_test1wqyp8f3s30t0kvqa3vfgq8lrhv7vtxrn9w9k9vh5s4syzacyjcr9g"
        const asset = makeAssetClass(
            makeMintingPolicyHash(
                "1fd38a7e152b5033e6b2f45447cbb98683a7214f3ab2b71b9ffaa04b"
            ),
            hexToBytes("7450424720737570706c79")
        )

        const utxos = await client.getUtxosWithAssetClass(
            makeAddress(addr),
            asset
        )
        strictEqual(
            utxos.length,
            1,
            "unexpected number of utxos at address " + addr
        )
        assert(
            utxos.every(
                (utxo) =>
                    utxo.address.isEqual(makeAddress(addr)) &&
                    utxo.value.assets.getAssetClassQuantity(asset) == 1n
            ),
            "some utxos at unexpected address without asset class"
        )
    })

    await it("getAddressesWithAssetClass() returns a single address for a known NFT", async () => {
        const asset = makeAssetClass(
            makeMintingPolicyHash(
                "1fd38a7e152b5033e6b2f45447cbb98683a7214f3ab2b71b9ffaa04b"
            ),
            hexToBytes("7450424720737570706c79")
        )

        const addresses = await client.getAddressesWithAssetClass(asset)

        strictEqual(addresses.length, 1, "expected exactly a single address")

        assert(
            addresses.every((addr) =>
                addr.address.isEqual(
                    makeAddress(
                        "addr_test1wqyp8f3s30t0kvqa3vfgq8lrhv7vtxrn9w9k9vh5s4syzacyjcr9g"
                    )
                )
            )
        )
    })

    await it("getUtxosWithAssetClass() returns a known UTXO containg a datum", async () => {
        const utxos = await client.getUtxosWithAssetClass(
            makeAddress(
                "addr_test1wqyp8f3s30t0kvqa3vfgq8lrhv7vtxrn9w9k9vh5s4syzacyjcr9g"
            ),
            makeAssetClass(
                makeMintingPolicyHash(
                    "1fd38a7e152b5033e6b2f45447cbb98683a7214f3ab2b71b9ffaa04b"
                ),
                hexToBytes("7450424720737570706c79")
            )
        )

        assert(utxos.length == 1, "expected exactly 1 utxo")
        console.log(utxos[0].dump())
    })

    if (phrase.length > 0) {
        // | n   | blockfrost | iris |
        // | 10  | ok         | ok   |
        // | 25  | ok         | ok   |
        // | 50  | ok         | ok   |
        // | 100 | ok         | ok   |
        // | 500 | ok         | ok   |

        const n = 500
        await it(`tx chain with ${n} txs`, async () => {
            // each tx pays everything to itself
            const chain = makeTxChainBuilder(client)
            const key = restoreRootPrivateKey(phrase)
            const wallet = makeUnstakedSimpleWallet(key, chain)
            console.log(wallet.address.toString())

            // the first tx creates a ref input for the latter
            const tx0 = await makeTxBuilder({ isMainnet: false })
                .spendUnsafe(await wallet.utxos)
                .payUnsafe(
                    wallet.address,
                    makeValue(5_000_000n),
                    makeInlineTxOutputDatum(makeIntData(0))
                )
                .build({
                    changeAddress: wallet.address
                })

            const refID = makeTxOutputId(tx0.id(), 0)
            const ref = makeTxInput(refID, tx0.body.outputs[0])

            tx0.addSignatures(await wallet.signTx(tx0))
            await chain.submitTx(tx0)

            for (let i = 1; i < n; i++) {
                const allUtxos = (await wallet.utxos).filter(
                    (utxo) => !utxo.id.isEqual(refID)
                )

                console.log(
                    `Spending ${allUtxos.map((utxo) => utxo.id.toString())}`
                )
                const tx = await makeTxBuilder({ isMainnet: false })
                    .refer(ref)
                    .spendUnsafe(allUtxos)
                    .payUnsafe(
                        wallet.address,
                        addValues(allUtxos).subtract(makeValue(5_000_000n))
                    )
                    .build({
                        changeAddress: wallet.address
                    })

                tx.addSignatures(await wallet.signTx(tx))
                await chain.submitTx(tx)
            }

            const txs = chain.build()

            console.log(`submitting ${n} txs`)
            for (let tx of txs.txs) {
                const id = await client.submitTx(tx)
                console.log("submitted " + id.toString())
            }
        })
    }
})
