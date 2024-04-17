import { describe, it } from "node:test"
import { strictEqual } from "node:assert"
import { Tx, TxInput, TxOutput } from "@helios-lang/ledger"
import { TxBuilder } from "./TxBuilder.js"

describe(`basic ${TxBuilder.name}`, () => {
    /**
     * send 10 tAda on preview net from wallet1 to wallet 2
     * (input is 10000 tAda, change is 9990 tAda minus fees)
     * wallet1 address: addr_test1vzzcg26lxj3twnnx889lrn60pqn0z3km2yahhsz0fvpyxdcj5qp8w
     * wallet2 address: addr_test1vqzhgmkqsyyzxthk7vzxet4283wx8wwygu9nq0v94mdldxs0d56ku
     * input utxo: d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e83#0
     * command: cardano-cli transaction build --tx-in d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e83#0 --tx-out addr_test1vqzhgmkqsyyzxthk7vzxet4283wx8wwygu9nq0v94mdldxs0d56ku+10000000 --change-address addr_test1vzzcg26lxj3twnnx889lrn60pqn0z3km2yahhsz0fvpyxdcj5qp8w --testnet-magic 2 --out-file /data/preview/transactions/202209042119.tx --babbage-era --cddl-format
     */
    const signedRefHex =
        "84a30081825820d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e83000182a200581d6085842b5f34a2b74e6639cbf1cf4f0826f146db513b7bc04f4b024337011b000000025370c627a200581d6005746ec08108232ef6f3046caeaa3c5c63b9c4470b303d85aedbf69a011a00989680021a00028759a10081825820a0e006bbd52e9db2dcd904e90c335212d2968fcae92ee9dd01204543c314359b584073afc3d75355883cd9a83140ed6480354578148f861f905d65a75b773d004eca5869f7f2a580c6d9cc7d54da3b307aa6cb1b8d4eb57603e37eff83ca56ec620cf5f6"
    const signedRef = Tx.fromCbor(signedRefHex)

    it("building basic tx leads to lower or same fee than cardano-cli", async () => {
        const wallet1 =
            "addr_test1vzzcg26lxj3twnnx889lrn60pqn0z3km2yahhsz0fvpyxdcj5qp8w"
        const wallet2 =
            "addr_test1vqzhgmkqsyyzxthk7vzxet4283wx8wwygu9nq0v94mdldxs0d56ku"

        const input1 = new TxInput(
            "d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e83#0",
            new TxOutput(wallet1, 10_000_000_000n)
        )
        const tx = await TxBuilder.new({ isMainnet: false })
            .spendUnsafe(input1)
            .payUnsafe(wallet2, 10_000_000n)
            .build({ changeAddress: wallet1 })

        strictEqual(tx.body.fee <= signedRef.body.fee, true)

        // the txId will sadly not be the same because Helios txs in general have slightly lower fees than those produced by cardano-cli
    })
})
