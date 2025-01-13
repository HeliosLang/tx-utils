import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { rollup } from "rollup"
import resolve from "@rollup/plugin-node-resolve"

async function main() {
    const repoRoot = join(dirname(process.argv[1]), "./")
    const entryPoint = join(repoRoot, "src", "index.js")
    const dst = join(repoRoot, "dist", "rollup", "index.mjs")

    try {
        const bundle = await rollup({
            input: entryPoint,
            plugins: [
                resolve({
                    moduleDirectories: ["node_modules"],
                    extensions: [".js"],
                    preferBuiltins: true
                })
            ]
        })

        await bundle.write({
            file: dst,
            format: "es"
        })
    } catch (error) {
        console.error("Error during build:", error)
    }

    const n = readFileSync(dst).toString().trim().length

    if (n != 0) {
        throw new Error(
            `Some top-level statements are not PURE according to rollup, see '${dst}'`
        )
    }
}

main()
