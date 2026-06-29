# Hackathon Public Demo Phase 6 — Actual UMG Compiler Bridge

## Purpose

Phase 6 connects UMG Studio compile candidates to the actual local UMG compiler at `/home/neomagnetar/umg-compiler/compiler-v0`. The compiler is treated as the source of truth for runnable output.

A `CompileCandidate` is only a candidate. It is not compiled output. A `UMGCompiledRuntimeManifest` is created only after an actual compiler success.

## Actual compiler inspection findings

- Root repo: `/home/neomagnetar/umg-compiler`
- Package path: `/home/neomagnetar/umg-compiler/compiler-v0`
- Package name: `umg-compiler`
- Source entrypoint: `compiler-v0/src/index.ts`
- Built entrypoint: `compiler-v0/dist/index.js`
- Programmatic export: `compileSleeve(sleeve, triggerState)` from `dist/compile.d.ts`
- CLI: `compiler-v0/src/cli.ts`, bin `umg`, commands `compile` and `compile-ir`
- Samples: `compiler-v0/samples/*.json`
- Expected compile input shape: `{ sleeve, triggerState }` where `sleeve` has `id`, `blocks[]`, `stacks[]`, optional `triggers[]`, optional `governance[]`; each block uses compiler MOLT types, and each stack references `blockIds[]`.
- Compiler output shape: `CompileResult` with optional `runtime`, required `trace`, and `hasErrors`.

## Bridge behavior

Browser code does not import the local compiler repo directly. Use the local Node bridge:

```bash
npm run umg:compiler-bridge
```

Then configure Studio:

```bash
VITE_UMG_COMPILER_ENDPOINT=http://127.0.0.1:8787/compile
```

The bridge:

- listens on `POST /compile`
- loads `/home/neomagnetar/umg-compiler/compiler-v0/dist/index.js` by default
- can be overridden with `UMG_COMPILER_MODULE_PATH`
- uses `UMG_COMPILER_BRIDGE_PORT` or port `8787`
- calls the actual exported `compileSleeve`
- returns raw compiler results plus wrapper warnings
- does not call Hermes
- does not execute arbitrary user tools
- does not mutate the compiler repo
- returns explicit errors if the compiler cannot load or compile

## Env variables

- `VITE_UMG_COMPILER_ENDPOINT`
- `VITE_UMG_COMPILER_URL`
- `VITE_UMG_COMPILER_ENABLED`
- `UMG_COMPILER_MODULE_PATH`
- `UMG_COMPILER_BRIDGE_PORT`

## No fake compile rule

No fake compile result is generated. If the endpoint is missing, Studio reports `UMG_COMPILER_ENDPOINT_NOT_CONFIGURED` and creates no manifest.

No `RuntimeSpec`, `Trace`, or `compiledPrompt` is fabricated. Compiler trace is preserved as compiler metadata only; it is not treated as a Hermes runtime execution trace.

## Trigger/gate semantics

TRG records remain gates/control records, not ordinary MOLT prompt blocks. If compiler-v0 cannot represent UMG gates directly, gates are preserved as metadata/control records and warnings are surfaced. Gates default closed unless compiler output explicitly says otherwise. Blocks default off/dim unless compiler output explicitly says otherwise.

## Hermes preview

After real compiler success, Studio prepares a `HermesCognitiveRuntimeRequest` preview only. It is not sent in Phase 6.

## Next phase

Hermes runtime execution and real trace ingestion.
