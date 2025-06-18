import { describe, it } from "node:test"
import { makeIrisClient } from "./IrisClient.js"
import {
    makeAddress,
    makeTxId,
    makeTxOutputId,
    parseTxOutputId
} from "@helios-lang/ledger"
import assert from "node:assert"

const host = "https://ns5037712.ip-148-113-219.net"
describe("IrisClient", async () => {
    const client = makeIrisClient(host)

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

    await it("getUtxos() returns some UTXOs", async () => {
        const addr =
            "addr_test1wq0a8zn7z544qvlxkt69g37thxrg8fepfuat9dcmnla2qjcysrmal"

        const utxos = await client.getUtxos(makeAddress(addr))

        assert(utxos.length > 0, "expected more than 0 UTXOs, got 0")
        assert(
            utxos.every((utxo) => utxo.address.isEqual(makeAddress(addr))),
            "some utxos at unexpected address"
        )
    })
})
