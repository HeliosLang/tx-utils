import { describe, it } from "node:test"
import { makeBip32PrivateKey } from "./Bip32PrivateKey.js"
import { deepEqual } from "node:assert"
import { encodeUtf8 } from "@helios-lang/codec-utils"

describe("Bip32PrivateKey", () => {
    it('correctly signs "Hello World"', () => {
        const bytes = [
            0x60, 0xd3, 0x99, 0xda, 0x83, 0xef, 0x80, 0xd8, 0xd4, 0xf8, 0xd2,
            0x23, 0x23, 0x9e, 0xfd, 0xc2, 0xb8, 0xfe, 0xf3, 0x87, 0xe1, 0xb5,
            0x21, 0x91, 0x37, 0xff, 0xb4, 0xe8, 0xfb, 0xde, 0xa1, 0x5a, 0xdc,
            0x93, 0x66, 0xb7, 0xd0, 0x03, 0xaf, 0x37, 0xc1, 0x13, 0x96, 0xde,
            0x9a, 0x83, 0x73, 0x4e, 0x30, 0xe0, 0x5e, 0x85, 0x1e, 0xfa, 0x32,
            0x74, 0x5c, 0x9c, 0xd7, 0xb4, 0x27, 0x12, 0xc8, 0x90, 0x60, 0x87,
            0x63, 0x77, 0x0e, 0xdd, 0xf7, 0x72, 0x48, 0xab, 0x65, 0x29, 0x84,
            0xb2, 0x1b, 0x84, 0x97, 0x60, 0xd1, 0xda, 0x74, 0xa6, 0xf5, 0xbd,
            0x63, 0x3c, 0xe4, 0x1a, 0xdc, 0xee, 0xf0, 0x7a
        ]
        const expectedSignature = [
            0x90, 0x19, 0x4d, 0x57, 0xcd, 0xe4, 0xfd, 0xad, 0xd0, 0x1e, 0xb7,
            0xcf, 0x16, 0x17, 0x80, 0xc2, 0x77, 0xe1, 0x29, 0xfc, 0x71, 0x35,
            0xb9, 0x77, 0x79, 0xa3, 0x26, 0x88, 0x37, 0xe4, 0xcd, 0x2e, 0x94,
            0x44, 0xb9, 0xbb, 0x91, 0xc0, 0xe8, 0x4d, 0x23, 0xbb, 0xa8, 0x70,
            0xdf, 0x3c, 0x4b, 0xda, 0x91, 0xa1, 0x10, 0xef, 0x73, 0x56, 0x38,
            0xfa, 0x7a, 0x34, 0xea, 0x20, 0x46, 0xd4, 0xbe, 0x04
        ]

        const key = makeBip32PrivateKey(bytes)

        deepEqual(key.sign(encodeUtf8("Hello World")).bytes, expectedSignature)
    })
})
