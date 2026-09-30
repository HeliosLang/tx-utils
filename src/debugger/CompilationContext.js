/**
 * Compilation metadata v1. Parameter values are UPLC Data CBOR hex overrides;
 * omitted constants retain their source defaults. No credentials belong here.
 * @typedef {{hashDependencies: Record<string,string>, dependsOnOwnHash: boolean, validatorIndices?: Record<string,number>, ownHash?: string}} CompilationOptions
 * @typedef {{version: 1, compilerVersion: string, validator: {name:string,purpose:string}, parameters: Record<string,string>, isTestnet: boolean, validatorTypes: Record<string,string>, optimized: CompilationOptions, unoptimized: CompilationOptions}} CompilationContext
 */
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
const name = (v) =>
    typeof v === "string" &&
    /^[A-Za-z_]\w*$/.test(v) &&
    !["__proto__", "constructor", "prototype"].includes(v)
const record = (v, key, value) =>
    object(v) && Object.entries(v).every(([k, x]) => key(k) && value(x))
const hash = (v) => typeof v === "string" && /^[a-f0-9]{56}$/.test(v)
const hex = (v) => typeof v === "string" && /^(?:[a-f0-9]{2})+$/.test(v)
const keys = (v, allowed) => Object.keys(v).every((k) => allowed.includes(k))
const options = (v) =>
    object(v) &&
    keys(v, [
        "hashDependencies",
        "dependsOnOwnHash",
        "validatorIndices",
        "ownHash"
    ]) &&
    typeof v.dependsOnOwnHash === "boolean" &&
    record(
        v.hashDependencies,
        name,
        (x) =>
            x === "#" ||
            hash(x) ||
            (typeof x === "string" && /^#[a-f0-9]{56}$/.test(x))
    ) &&
    (v.ownHash === undefined || hash(v.ownHash)) &&
    (v.validatorIndices === undefined ||
        record(
            v.validatorIndices,
            name,
            (x) => Number.isSafeInteger(x) && x >= 0
        ))
/** @param {unknown} value @returns {value is CompilationContext} */
export function validCompilationContext(value) {
    const v = /** @type {any} */ (value)
    return (
        object(v) &&
        keys(v, [
            "version",
            "compilerVersion",
            "validator",
            "parameters",
            "isTestnet",
            "validatorTypes",
            "optimized",
            "unoptimized"
        ]) &&
        v.version === 1 &&
        typeof v.compilerVersion === "string" &&
        /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(v.compilerVersion) &&
        object(v.validator) &&
        keys(v.validator, ["name", "purpose"]) &&
        name(v.validator.name) &&
        [
            "spending",
            "minting",
            "staking",
            "mixed",
            "certifying",
            "rewarding"
        ].includes(v.validator.purpose) &&
        typeof v.isTestnet === "boolean" &&
        record(
            v.parameters,
            (k) => k.split("::").length >= 2 && k.split("::").every(name),
            hex
        ) &&
        record(v.validatorTypes, name, (x) =>
            [
                "ValidatorHash",
                "MintingPolicyHash",
                "StakingValidatorHash",
                "ScriptHash"
            ].includes(x)
        ) &&
        options(v.optimized) &&
        options(v.unoptimized)
    )
}
