# Builder capture v1

```js
import {makeDebuggerService, makeTxBuilder} from '@helios-lang/tx-utils'
const debuggerService = makeDebuggerService({apiKey, sources: bundle.$debugSources})
const builder = makeTxBuilder({isMainnet, debugger: debuggerService})
// Use the builder normally, including buildUnsafe().
await debuggerService.flush()
console.log(debuggerService.deliveryStatus)
```

Requires the ledger release exporting `TX_EVALUATION_OBSERVER_VERSION = 1`. The release check refuses to pack against an older ledger. Until that coordinated release, link the ledger source checkout for local testing.

The upload transport is a single native `fetch` call per capture, with no HTTP client dependency, Cloudflare SDK, wallet authentication, polling or automatic retries:

```js
await fetch(new URL('/v1/captures', endpoint), {
    method: 'POST',
    headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    },
    credentials: 'omit',
    redirect: 'error',
    signal,
    body: JSON.stringify(payload)
})
```

The version 1 JSON payload contains the capture ID, timestamp, result/error, exact program and argument CBOR, evaluation budgets/configuration, source maps and sources, plus transaction CBOR when available. See `capture-v1.schema.json` for the wire format. The API key is sent only in the authorization header, never added to the URL or payload. The client uses standard browser/Node APIs; the server implementation lives in the website repository under `services/debugger` and is not included in the tx-utils package. The optional `fetch` setting allows callers to supply their own implementation.

`capture: 'all'` opts into successful builds; the default is failures only. `timeoutMs` defaults to 2000 and bounds delivery even if a custom fetch ignores abort. `endpoint` defaults to `https://debugger.helios-lang.io`; HTTPS is required except for loopback development. Captures contain sensitive transaction inputs and source text. API keys supplied at runtime can both upload and read their feed.

Each build has its own recording session, including concurrent builds sharing a client. With no debugger configured, no capture serialization or upload occurs. Enabled delivery is best effort; upload failures do not replace build results or errors. `flush()` waits for current deliveries; `deliveryStatus` describes the most recently completed delivery and its capture ID. Serialization diagnostics are included in the payload when possible.

Production and companion CBOR/source maps are stored separately. Replay uses exact production bytes and explicit default cost-model parameters used by the builder, with a pinned UPLC 0.7.20 evaluator. Unoptimized companion diagnostics are compared separately and never silently substituted for production execution. Source-level replay initially supports compiler 0.17.x and Plutus V2. Missing source metadata and differing local source files are reported by the extension. The capture schema uses decimal strings for CPU/memory budgets and hex strings for CBOR.

## Automatic capture from contract bundles

Compile with `helios compile --project "My project"` (or `hl2ts --project ...`) after `helios login`. Contract-utils exports `$debugger` metadata and binds it to each compiled UPLC program. High-level builder calls such as `spendWithRedeemer()` attach those programs automatically; direct `attachUplcProgram()` and reference scripts also support the metadata. Failed `build()` and `buildUnsafe()` calls are delivered without explicit debugger configuration. Successful builds are not uploaded automatically.

An explicit `debugger` service overrides automatic project selection. Set `debugger:false` to disable both automatic capture and capture networking. Multiple project keys create separate capture sessions: each receives only matching script evaluations and sources, plus the failed transaction when available. Delivery remains a bounded, best-effort fetch and cannot replace the original transaction error. API keys stay in the authorization header, outside script CBOR, hashes, and capture payloads.

Automatic capture requires the ledger evaluation-observer release, as does explicit capture. Publish the ledger observer changes before publishing this tx-utils release. Test cross-repository bundle integration with `node test/debugger/project-bundle.mjs /path/to/contract-utils`; the contract-utils checkout must contain the new CLI and have dependencies installed.
