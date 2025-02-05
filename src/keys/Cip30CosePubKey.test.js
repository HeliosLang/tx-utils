import { deepEqual, strictEqual } from "node:assert"
import { describe, it } from "node:test"
import {
    decodeCip30CosePubKey,
    encodeCip30CosePubKey
} from "./Cip30CosePubKey.js"
import { makePubKey } from "@helios-lang/ledger"
import { bytesToHex } from "@helios-lang/codec-utils"

describe("decodeCip30CosePubKey", () => {
    it("decodes a40101032720062158202e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d as 2e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d", () => {
        const data =
            "a40101032720062158202e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d"

        strictEqual(
            bytesToHex(decodeCip30CosePubKey(data).bytes),
            "2e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d"
        )
    })
})
describe("encodeCip30CosePubKey", () => {
    it("encodes #2e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d equals a40101032720062158202e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d", () => {
        const pubKey = makePubKey(
            "2e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d"
        )

        strictEqual(
            bytesToHex(encodeCip30CosePubKey(pubKey)),
            "a40101032720062158202e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d"
        )
    })
})
