import { describe, it } from "node:test"
import { KoiosV0 } from "../network/index.js"
import { SimpleWallet } from "../wallets/index.js"
import { AgentTxBuilder } from "./AgentTxBuilder.js"
import { Address, PubKeyHash, Value } from "@helios-lang/ledger"

describe(AgentTxBuilder.name, () => {
    it("typechecks ok", () => {
        const network = new KoiosV0("preprod")
        const agent = SimpleWallet.random(network)

        const b = new AgentTxBuilder(agent, network)

        b.payUnsafe(Address.fromHash(PubKeyHash.dummy()), new Value(1000000n))
    })
})
