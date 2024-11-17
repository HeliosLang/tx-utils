import { strictEqual } from "node:assert"
import { describe, it } from "node:test"
import { encodeUtf8 } from "@helios-lang/codec-utils"
import {
    AssetClass,
    Assets,
    DEFAULT_NETWORK_PARAMS,
    MintingPolicyHash,
    TokenValue
} from "@helios-lang/ledger"
import { makeCardanoClientHelper } from "../clients/index.js"
import { makeEmulator } from "../emulator/index.js"
import { makeTxBuilder } from "../txbuilder/index.js"
import { makeWalletHelper } from "../wallets/index.js"
import { makeTxChainBuilder } from "./TxChainBuilder.js"

describe("TxChainBuilder", async () => {
    it("second transaction uses utxo from first transaction", async () => {
        const mph = new MintingPolicyHash(new Array(28).fill(0))
        const tokenName = encodeUtf8("hello world")
        const assetClass = new AssetClass(mph, tokenName)
        const token = new TokenValue(assetClass, 1n)

        const emulator = makeEmulator()
        const chain = makeTxChainBuilder(emulator)
        const helper = makeCardanoClientHelper(chain)

        const wallet1 = makeWalletHelper(
            emulator.createWallet(
                100_000_000n,
                new Assets([[mph, [[tokenName, 1]]]])
            ),
            chain
        )
        const wallet1Addr = await wallet1.changeAddress

        const wallet2 = makeWalletHelper(
            emulator.createWallet(200_000_000n),
            chain
        )
        const wallet2Addr = await wallet2.changeAddress

        emulator.tick(1n)

        console.log(
            (await wallet1.utxos).map((utxo) =>
                JSON.stringify(utxo.dump(), undefined, 4)
            )
        )

        // tx1: send token from wallet1 to wallet2
        const tx1 = await makeTxBuilder({ isMainnet: false })
            .spendWithoutRedeemer(await wallet1.selectUtxo(token))
            .payWithoutDatum(wallet2Addr, token)
            .build({
                changeAddress: wallet1Addr,
                networkParams: DEFAULT_NETWORK_PARAMS()
            })

        chain.with(tx1)

        // tx2: send token back to wallet1
        const tx2 = await makeTxBuilder({ isMainnet: false })
            .spendWithoutRedeemer(await helper.selectUtxo(wallet2Addr, token))
            .payWithoutDatum(wallet1Addr, token)
            .build({
                changeAddress: wallet2Addr,
                networkParams: DEFAULT_NETWORK_PARAMS(),
                spareUtxos: (await helper.getUtxos(wallet2Addr)).filter(
                    (utxo) => utxo.value.assets.isZero()
                )
            })

        strictEqual(
            tx2.body.inputs.some((utxo) => utxo.id.txId.isEqual(tx1.id())),
            true
        )
    })
})
