import { describe, it } from "node:test"
import { decodeCip30CoseSign1, makeCip30CoseSign1 } from "./Cip30CoseSign1.js"
import { decodeShelleyAddress } from "@helios-lang/ledger"
import { bytesToHex } from "@helios-lang/codec-utils"
import { strictEqual } from "node:assert"
import { makePubKey } from "@helios-lang/ledger"

/**
 * @import { PubKeyHash, ShelleyAddress } from "@helios-lang/ledger"
 */

describe("Cip30CoseSign1", () => {
    it("encodes correctly", () => {
        const sign1 = makeCip30CoseSign1(
            /** @type {ShelleyAddress<PubKeyHash>} */ (
                decodeShelleyAddress(
                    "603a5904074323a4cddfe1103969962a5807c6c37495db9df48d019f9a"
                )
            ),
            "1b00000194d70e512f",
            "32f4643ec6ae20b5c6b9c71d89eadbbdaf42bffadcb8bbda22203fb98640bf491530541bb659fe019b2ef5b0cefd7d683ea8a945a07333185317b16b2aa0440d"
        )

        const encoded = bytesToHex(sign1.toCbor())

        strictEqual(
            encoded,
            "84582aa201276761646472657373581d603a5904074323a4cddfe1103969962a5807c6c37495db9df48d019f9aa166686173686564f4491b00000194d70e512f584032f4643ec6ae20b5c6b9c71d89eadbbdaf42bffadcb8bbda22203fb98640bf491530541bb659fe019b2ef5b0cefd7d683ea8a945a07333185317b16b2aa0440d"
        )
    })

    it("decodes correctly", () => {
        const sign1 = decodeCip30CoseSign1(
            "84582aa201276761646472657373581d603a5904074323a4cddfe1103969962a5807c6c37495db9df48d019f9aa166686173686564f4491b00000194d70e512f584032f4643ec6ae20b5c6b9c71d89eadbbdaf42bffadcb8bbda22203fb98640bf491530541bb659fe019b2ef5b0cefd7d683ea8a945a07333185317b16b2aa0440d"
        )

        strictEqual(
            sign1.address.toHex(),
            "603a5904074323a4cddfe1103969962a5807c6c37495db9df48d019f9a"
        )
        strictEqual(bytesToHex(sign1.payload), "1b00000194d70e512f")
        strictEqual(
            bytesToHex(sign1.bytes),
            "32f4643ec6ae20b5c6b9c71d89eadbbdaf42bffadcb8bbda22203fb98640bf491530541bb659fe019b2ef5b0cefd7d683ea8a945a07333185317b16b2aa0440d"
        )
    })

    it("verifies correctly", () => {
        const pubKey = makePubKey(
            "2e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d"
        )

        const sign1 = makeCip30CoseSign1(
            /** @type {ShelleyAddress<PubKeyHash>} */ (
                decodeShelleyAddress(
                    "603a5904074323a4cddfe1103969962a5807c6c37495db9df48d019f9a"
                )
            ),
            "1b00000194d70e512f",
            "32f4643ec6ae20b5c6b9c71d89eadbbdaf42bffadcb8bbda22203fb98640bf491530541bb659fe019b2ef5b0cefd7d683ea8a945a07333185317b16b2aa0440d"
        )

        sign1.verify(pubKey)
    })
})
