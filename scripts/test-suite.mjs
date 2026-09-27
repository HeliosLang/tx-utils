import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
async function tests(dir) {
    const paths = []
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) paths.push(...(await tests(path)))
        else if (entry.name.endsWith(".test.js")) paths.push(path)
    }
    return paths.sort()
}
const result = spawnSync(
    process.execPath,
    ["--test", "--experimental-test-coverage", ...(await tests("src"))],
    { stdio: "inherit" }
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
