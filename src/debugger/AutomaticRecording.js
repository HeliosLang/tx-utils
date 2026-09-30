import { bytesToHex } from "@helios-lang/codec-utils"
import { makeDebuggerService } from "./DebuggerService.js"
/** @typedef {{apiKey:string, endpoint:string, projectId?:string, name?:string, sources?:Record<string,string>}} BundleDebuggerContext */
/** @typedef {import('@helios-lang/uplc').UplcProgram & {$debugger?:BundleDebuggerContext}} DebugProgram */
/**
 * Each project gets only matching evaluations and sources. Credentials never enter captures.
 * @param {() => DebugProgram[]} getPrograms
 * @returns {import('./DebuggerService.js').RecordingSession}
 */
export function makeAutomaticRecording(getPrograms) {
    /** @type {Map<string, {hashes:Set<string>, sources:Record<string,string>, service:ReturnType<typeof makeDebuggerService>, session:import('./DebuggerService.js').RecordingSession}>} */
    const groups = new Map()
    const seen = new WeakSet()
    function discover() {
        for (const program of getPrograms()) {
            if (seen.has(program)) continue
            seen.add(program)
            const context = program.$debugger
            if (
                !context ||
                typeof context.apiKey !== "string" ||
                !/^hdbg_[a-f0-9]{64}$/.test(context.apiKey)
            )
                continue
            try {
                const id = JSON.stringify([context.endpoint, context.apiKey])
                let group = groups.get(id)
                if (!group) {
                    const sources = { ...context.sources }
                    const service = makeDebuggerService({
                        apiKey: context.apiKey,
                        endpoint: context.endpoint,
                        sources
                    })
                    group = {
                        hashes: new Set(),
                        sources,
                        service,
                        session: service.startSession(() =>
                            getPrograms().filter(
                                (p) =>
                                    p.$debugger?.apiKey === context.apiKey &&
                                    p.$debugger?.endpoint === context.endpoint
                            )
                        )
                    }
                    groups.set(id, group)
                }
                Object.assign(group.sources, context.sources)
                group.hashes.add(bytesToHex(program.hash()))
            } catch {
                // Invalid diagnostic metadata must not change transaction behavior.
            }
        }
    }
    return {
        record(event) {
            discover()
            if (!groups.size) return
            const hash = bytesToHex(event.script.hash())
            for (const group of groups.values())
                if (group.hashes.has(hash)) group.session.record(event)
        },
        async finish(tx, error) {
            discover()
            await Promise.all(
                [...groups.values()].map((group) =>
                    group.session.finish(tx, error)
                )
            )
        }
    }
}
