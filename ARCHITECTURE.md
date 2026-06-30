# UMG Studio Architecture

## System architecture

UMG Studio is a local web application plus local bridge services. The browser app owns the workspace, intake, library browser, generated Sleeve inspection, runtime observer, and runtime graph surfaces. Local Node bridges connect the browser to the compiler and Hermes runtime boundaries.

High-level components:

- UMG Studio browser app: intake, library browser, hierarchy inspection, compile/run controls, runtime graph
- UMG library metadata index: read-only app-local metadata derived from protected library sources
- UMG compiler bridge: converts a compile candidate into a compiled runtime manifest
- Hermes runtime bridge: sends compiled runtime requests to Hermes
- Native Hermes action bridge: routes gated native action requests to Hermes and verifies outputs
- Runtime Graph observer: projects hierarchy and real trace events into visual runtime state

Protected boundaries:

- `/home/neomagnetar/umg-block-library` remains read-only for this package.
- `/home/neomagnetar/umg-compiler` remains read-only for this package.
- Source-library JSON is not mutated by runtime-session generation or MetaMOLT Tool Block registration.

## UMG hierarchy

The product hierarchy is:

Sleeve → NeoStack → NeoBlock → MOLT → Gate → Capability → MetaMOLT Tool Block

### Sleeve

A Sleeve is the complete workflow architecture for a domain or task. It groups all runtime lanes, blocks, gates, and capabilities required for a coherent Hermes run.

### NeoStack

A NeoStack is a major lane inside a Sleeve. For a customer support SOP this might include intake, policy interpretation, response drafting, escalation, and audit/reporting.

### NeoBlock

A NeoBlock is a functional unit inside a NeoStack. It can represent a decision step, analysis step, transformation step, or tool boundary.

### MOLT

MOLT layers provide the cognitive content and role-specific logic around a NeoBlock. Common roles include directive, instruction, subject, philosophy, blueprint, and meta.

### Gate

A Gate is a runtime boundary. It may represent approval, routing, governance, policy, or action-control semantics. Gates are not fake execution; they decide whether an action should be observed, approved, run directly, or blocked.

### Capability

A Capability is a declared action surface such as text composition, report generation, file creation, file read, shell command, project edit, or generic runtime task.

### MetaMOLT Tool Block

A MetaMOLT Tool Block is a runtime-session MOLT-like tool declaration. It models a native Hermes capability as a visible and traceable UMG object.

Current native tool blocks:

- `TOOL.HERMES.NOTE_CREATE.v0.1`
- `TOOL.HERMES.FILE_WRITE.v0.1`
- `TOOL.HERMES.FILE_READ.v0.1`
- `TOOL.HERMES.SHELL_COMMAND.v0.1`
- `TOOL.HERMES.PROJECT_EDIT.v0.1`
- `TOOL.HERMES.RUNTIME_TASK.v0.1`

## Runtime flow

1. User enters a workflow prompt and optional uploaded context.
2. UMG extracts deterministic intake signals and retrieval hints.
3. UMG retrieves relevant library candidates from the app-local metadata index.
4. Hermes custom Sleeve generation can produce a runtime-session Sleeve plan.
5. UMG adapts the generated plan into active session state.
6. UMG builds a compile candidate from the active Sleeve.
7. The compiler bridge returns a compiled runtime manifest.
8. The runtime bridge sends the manifest to Hermes or prepares native action requests.
9. Hermes returns execution result and trace data.
10. UMG projects trace events into the Runtime Graph observer.

## Upload intake flow

Upload intake is browser-local and safe by default.

Flow:

1. User selects local text content or pastes context.
2. UMG stores local metadata and extracts text signals.
3. UMG derives keywords, domain hints, syntax hints, semantic hints, and possible MOLT role hints.
4. These signals expand the retrieval query.
5. Uploaded context is included in the Hermes custom generation request.
6. The generated Sleeve must be domain-specific; generic fallback titles are not accepted as proof.

Deferred extractors:

- PDF extraction
- DOCX extraction
- OCR/scanned document extraction

## Library retrieval flow

Library retrieval is library-first and read-only.

1. UMG builds a retrieval query from the user prompt plus upload signals.
2. It scores library metadata candidates.
3. It surfaces top candidate IDs and reused/source metadata.
4. It passes compact candidate summaries into Hermes custom generation.
5. Generated runtime-session blocks preserve provenance where possible.
6. Protected source-library files remain unchanged.

This is how the app avoids generating everything from scratch while still keeping the source library immutable during the hackathon demo.

## Native Hermes action bridge flow

Endpoint:

`POST /api/hermes/native-action`

Request shape includes:

- `actionId`
- `capabilityId`
- `mode`
- `risk`
- `prompt`
- optional expected output paths
- optional Sleeve / NeoStack / NeoBlock / MOLT / Gate IDs
- optional `userApproved`

Flow:

1. UMG resolves a MetaMOLT Tool Block and capability policy.
2. The bridge validates request shape and action mode.
3. Observe mode returns a preview result without execution.
4. Approval mode returns `approval_required` without execution.
5. Blocked mode returns a blocked result without execution.
6. Direct mode can execute only when risk and policy allow it.
7. Hermes CLI performs the native action.
8. The bridge verifies expected output paths before claiming success.
9. The result includes stdout, stderr, created files, modified files, artifacts, and trace events.

Verified direct proof:

- capability: `umg.native.hermes.note_create`
- mode: direct
- result: `status: executed`
- `externalActionTaken: true`
- file created: `C:\Users\Magne\OneDrive\Desktop\umg-hermes-native-test.txt`
- content: `hi im hermes from UMG`

## MetaMOLT Tool Block model

MetaMOLT Tool Blocks are app-local/runtime-session records with:

- stable `TOOL.HERMES.*.v0.1` ID
- `moltType: Meta / Other`
- `category: metamolt_tool`
- provider: `hermes-native`
- `capabilityId`
- `risk`
- `supportedActionModes`
- `defaultActionMode`
- `nlCard`
- `jsonSchema`
- `actionPolicy`
- source path under `runtime-session://metamolt-tools/`

They are designed to be visible in UMG hierarchy and runtime surfaces without being promoted into the protected source library.

## Runtime Graph observer model

The Runtime Graph observer has two responsibilities:

1. Show the structural hierarchy before runtime: Sleeve, NeoStacks, NeoBlocks, MOLT layers, Gates, and capabilities.
2. Overlay runtime state only from real trace events and compiled/runtime data.

It should not fabricate activation just because a node exists. Trace-derived activation is separate from static structure.

## Action mode model

### Observe

- No native execution.
- Used for previewing or inspecting the requested action.
- `externalActionTaken: false`.

### Approval

- No native execution.
- Returns `approval_required`.
- Preserves enough action request data to rerun later as Direct after approval.
- `externalActionTaken: false`.

### Direct

- Executes only if policy allows it.
- Low-risk or explicitly approved actions may run.
- Output paths are verified before success is claimed.
- Can return `externalActionTaken: true`.

### Blocked

- No native execution.
- Used for unsupported, unsafe, or out-of-policy actions.
- `externalActionTaken: false`.

## Trace event model

Native action trace events include:

- `tool_block_resolved`: MetaMOLT Tool Block/capability resolved
- `action_request_created`: structured native action request prepared
- `action_approval_required`: action stopped at approval boundary
- `action_executed`: Hermes native execution completed
- `file_created`: verified file creation
- `file_modified`: verified file modification
- `artifact_created`: artifact recorded for Runtime Graph/status display
- `action_failed`: native action failed or output verification failed
- `action_blocked`: action blocked by policy

Trace events include relevant IDs when available:

- trace ID
- Sleeve ID
- NeoStack ID
- NeoBlock ID
- MOLT/Tool Block ID
- Gate ID
- capability/tool ID
- status/state
- raw payload summary

The Runtime Graph maps these events to processing, attention, complete, blocked, or error states.
