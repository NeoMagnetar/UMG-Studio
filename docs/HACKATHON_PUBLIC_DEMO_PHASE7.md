# Hackathon Public Demo Phase 7 — Hermes Runtime Execution and Real Trace Ingestion

## Purpose

Phase 7 connects a real `UMGCompiledRuntimeManifest` to a configured Hermes runtime endpoint. Studio remains a structured request and visualization surface. Hermes remains the user-authorized execution layer.

## Data flow

`UMGCompiledRuntimeManifest → HermesCognitiveRuntimeRequest → HermesCognitiveRuntimeResult → UMGTraceEvent[] → UMGRuntimeVisualState`

Studio sends the compiled manifest and user goal to Hermes. Studio then ingests only the real trace events returned by Hermes and applies them through the Phase 1 runtime visual-state helpers.

## Env variables

- `VITE_HERMES_RUNTIME_ENDPOINT`
- `VITE_HERMES_RUNTIME_URL`
- `VITE_HERMES_RUNTIME_ENABLED`

If no endpoint or URL is set, Hermes runtime is reported as not configured and no network call is made.

## No fake runtime rule

No fake Hermes runtime result is generated. Studio does not mark Run Hermes complete until a real Hermes endpoint response is received.

## No fake trace/replay rule

No fake trace events or replay timeline are generated. If Hermes returns no trace, Studio displays: “Hermes returned no runtime trace events.”

## Compiler trace boundary

Compiler trace is compiler metadata only. It is not treated as Hermes runtime trace and is not applied to `UMGRuntimeVisualState`.

## Completion rules

- Compile completes only after a real compiler success creates `UMGCompiledRuntimeManifest`.
- Run Hermes completes only after a real Hermes response.
- Trace Runtime completes only after real `UMGTraceEvent[]` records are returned and applied.

## Endpoint missing behavior

Missing endpoint returns an explicit not-configured state and `HERMES_ENDPOINT_NOT_CONFIGURED`. Setup guidance asks the user to set `VITE_HERMES_RUNTIME_ENDPOINT` to a real Hermes runtime endpoint without inventing a port.

## Next phase

Hierarchical runtime visualizer using real trace states to light up Sleeve / NeoStack / NeoBlock / MOLT / gate scopes.
