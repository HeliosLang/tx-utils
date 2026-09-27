import * as ledger from "@helios-lang/ledger"
if (ledger.TX_EVALUATION_OBSERVER_VERSION !== 1) {
    throw new Error(
        "Publish the ledger evaluation-observer change first, then update tx-utils to that released ledger version before publishing tx-utils."
    )
}
