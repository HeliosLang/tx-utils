# tx-utils
Coin selection, query layers, wallets

### Captured compilation parameters

Programs produced by the updated contract-utils carry credential-free `$compilation` metadata. `makeDebuggerService({apiKey})` includes it in each evaluation, also when metadata can be matched by script hash to a builder's known programs. Automatic project capture uses the same format. No manual parameter map is needed. Raw CBOR without metadata remains capturable, with a diagnostic explaining that compilation context is unavailable.

Capture v1 adds optional `evaluations[].compilation` (metadata version 1): the compiler version, validator identity, network, fully qualified parameter overrides as UPLC Data CBOR hex, validator hash types, and distinct optimized/unoptimized compilation options. Empty `parameters` means no overrides; missing metadata means unknown build context. Credentials are never part of this object. See `src/debugger/capture-v1.schema.json`.

Default failure capture includes only script evaluations whose evaluator returned an error. Successful evaluations and full transaction CBOR are omitted; build errors without a failed script evaluation produce no upload. Each failed evaluation retains its own program, arguments (including ScriptContext), budget, source map and compilation metadata. Explicit `capture: "all"` remains available for broader diagnostics.
