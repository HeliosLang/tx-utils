import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { build } from "esbuild"

async function main() {
    const repoRoot = join(dirname(process.argv[1]), "./")
    const entryPoint = join(repoRoot, "src", "index.js")
    const dst = join(repoRoot, "dist", "esbuild", "index.mjs")

    await build({
        bundle: true,
        splitting: false,
        treeShaking: true,
        format: "esm",
        platform: "node",
        minify: false,
        outfile: dst,
        entryPoints: [entryPoint],
        define: {},
        plugins: []
    })

    const n = readFileSync(dst).toString().trim().length

    if (n != 0) {
        throw new Error(
            `Some top-level statements are not PURE according to esbuild, see '${dst}'`
        )
    }
}

main()
