# Hackathon Cognitive Runtime Phase 1

## Purpose

Phase 1 establishes the contract boundary for a real UMG cognitive runtime. UMG Studio structures cognition as Sleeve / NeoStack / NeoBlock / MOLT hierarchy, while Hermes remains responsible for executing user-authorized workflows through connected tools.

This phase adds runtime types, trace normalization, visual state projection helpers, a Hermes runtime adapter boundary, and trigger-as-gate semantics. It does not create a public demo shell, import a business template, or simulate live runtime execution.

## Real Hermes trace requirement

Studio must light runtime visuals from real Hermes trace/result data. If Hermes returns no usable trace, Studio reports no trace. No helper in this phase fabricates block activations, completion events, or tool execution.

Accepted trace payload shapes include:

- `raw.trace` arrays
- `raw.events` arrays
- `raw.runtimeTrace` arrays
- direct event arrays
- `raw.trace.events` objects from common compiler/runtime wrappers

Each normalized event preserves the original raw event when possible.

## Trigger/gate semantics

`TRG.*` records are gates/control records, not ordinary MOLT prompt blocks. Legacy trigger-like source records are mapped into `UMGGateRecord` with `promptContent: false` metadata, closed default state, and inactive runtime state.

`CON.*` and `VER.*` style sources are future gate-policy or MetaMOLT candidates; this phase documents that boundary but does not implement their full handling.

## Runtime event model

The event model supports route, gate, block, tool, approval, completion, and error events. Events identify actual hierarchy or control IDs:

- Sleeve IDs
- NeoStack IDs
- NeoBlock IDs
- MOLT block IDs
- gate IDs
- tool IDs
- approval IDs

These IDs are the bridge between Hermes runtime facts and Studio visualization.

## Visual state model

The visual state engine keeps blocks dim/idle by default and projects runtime activity into non-mutating state lists:

- queued
- active
- processing
- attention
- complete
- skipped
- blocked
- error

A target ID is kept out of conflicting state lists. `route_started` initializes active run state, `route_completed` completes the current path where possible, and `error` marks the target as error.

## Hermes adapter boundary

Studio does not directly execute arbitrary tools. Studio sends a structured `HermesCognitiveRuntimeRequest` to a configured Hermes runtime endpoint. Hermes applies user authorization, connected tool policy, approvals, and execution.

If no endpoint is configured or the adapter is disabled, the adapter returns an explicit `HERMES_ENDPOINT_NOT_CONFIGURED` error with an empty trace rather than a fake result.

## Next phases

1. Public hero/intake shell
2. Business analyzer
3. Template sleeve import
4. Compile-to-Hermes manifest
5. Live runtime visualizer
