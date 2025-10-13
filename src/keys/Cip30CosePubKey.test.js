import { strictEqual } from "node:assert"
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

    it("decodes a501010258390180edfa909a3d40a54fca4c3ee852c7ba2a79391738911dc363580dc2fd98e123e92cfe58a90ffaf5d59529c503223aefff76d765e9497732032720062158208d9578fed65af1d1ce74b1c27e8be3dfe98490157382be39b0b6cb33c268d778 as ...", () => {
        const data =
            "a501010258390180edfa909a3d40a54fca4c3ee852c7ba2a79391738911dc363580dc2fd98e123e92cfe58a90ffaf5d59529c503223aefff76d765e9497732032720062158208d9578fed65af1d1ce74b1c27e8be3dfe98490157382be39b0b6cb33c268d778"

        strictEqual(
            bytesToHex(decodeCip30CosePubKey(data).bytes),
            "8d9578fed65af1d1ce74b1c27e8be3dfe98490157382be39b0b6cb33c268d778"
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
