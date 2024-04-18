import { TxInput, Value } from "@helios-lang/ledger"

export class InsufficientFundsError extends Error {
    /**
     * @param {Value} need
     * @param {TxInput[]} have
     */
    constructor(need, have) {
        super(
            `Insufficient funds error: need ${JSON.stringify(need.dump(), undefined, 2)}, have UTxOs ${have.map((utxo) => JSON.stringify(utxo.dump(), undefined, 2))} (total ${JSON.stringify(Value.sum(have).dump(), undefined, 2)})`
        )
    }
}
