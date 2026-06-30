# Known Limitations

This document is intentionally explicit for hackathon review. It separates working proof from deferred production work.

## Native approval continuation UI

Native approval mode currently returns the correct bridge-level state:

- `status: approval_required`
- `externalActionTaken: false`
- trace includes `action_approval_required`

However, the polished UI path for approve-and-continue is not complete. A request can be rerun as Direct after approval, but the approval continuation experience should be improved before production use.

## Stale Vite ports

Multiple local Vite/dev ports may exist during development. Acceptance should use the current-code canonical app server and current bridge processes, not an arbitrary old port.

Recommended canonical browser URL for demo:

`http://127.0.0.1:5173/`

Recommended bridge endpoints:

- Compiler: `http://127.0.0.1:8787/compile`
- Hermes runtime: `http://127.0.0.1:8788/api/hermes/runtime`
- Hermes custom generation: `http://127.0.0.1:8788/api/hermes/custom-sleeve-generation`
- Native action: `http://127.0.0.1:8788/api/hermes/native-action`

## Website Builder deferred

Website Builder / Web Creation domain-pack work is intentionally deferred. The current package focuses on UMG cognitive architecture, runtime hierarchy, upload intake intelligence, Runtime Graph observer, MetaMOLT Tool Blocks, and native Hermes action proof.

## PDF/DOCX/OCR extractors deferred

Upload intake intelligence currently focuses on safe browser-local text/pasted context paths. Rich document extraction remains future work:

- PDF extraction
- DOCX extraction
- OCR/scanned document extraction

## Source-library promotion deferred

Runtime-session generated Sleeves and app-local MetaMOLT Tool Blocks are not promoted into the protected source library during this package.

Protected boundary:

- no `/home/neomagnetar/umg-block-library` mutation
- no `/home/neomagnetar/umg-compiler` mutation
- no source-library JSON mutation

A future promotion workflow should include explicit user approval, review, schema validation, and source-library write controls.

## Observe / Blocked endpoint proof not fully expanded

Direct mode and Approval mode were explicitly proofed for the Native Hermes action bridge. Observe and Blocked modes are implemented, but their endpoint proof was not expanded to the same level in the final hackathon validation pass.

Expected behavior:

- Observe: preview only, no native execution, `externalActionTaken: false`
- Blocked: refusal/policy boundary, no native execution, `externalActionTaken: false`

## Runtime Graph native activation browser proof needs polish

Native action trace events are emitted and mapped, including:

- `tool_block_resolved`
- `action_request_created`
- `action_approval_required`
- `action_executed`
- `file_created`
- `file_modified`
- `artifact_created`
- `action_failed`
- `action_blocked`

The browser Runtime Graph proof for polished native-action activation still needs more presentation work. The important safety boundary remains: graph activation should come from real trace data, not fabricated UI state.

## Hackathon hardening gaps

Before production use, UMG Studio would need:

- stronger auth and policy controls around native action execution
- a complete approval workflow UI
- clearer process management for local bridges
- richer error surfaces for Hermes CLI/provider failures
- more robust cross-platform desktop path handling
- expanded tests for Observe and Blocked modes
- hardened packaging and startup scripts
- formal source-library promotion workflow

## What is verified now

The following are verified for the current hackathon package:

- latest checkpoint: `c902446 feat: add native Hermes action bridge for UMG runtime`
- build passes
- compiler bridge syntax passes
- Hermes runtime bridge syntax passes
- native Direct proof created a real desktop note
- native Approval proof stops before execution
- protected repos stayed clean
- no fake native execution was used for the desktop-note proof
