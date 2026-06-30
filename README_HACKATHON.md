# UMG Studio Hackathon Submission

## Project name

UMG Studio — Universal Modular Graph Studio for Hermes.

## One-sentence pitch

UMG Studio turns Hermes from a powerful agent into an inspectable modular cognitive runtime where users can design, compile, execute, and trace structured AI workflows.

## Problem

Most agent systems are difficult to inspect once they leave the prompt box. Users can ask for work, but they cannot easily see the cognitive architecture behind that work: what roles were assigned, which blocks were responsible, where approvals happen, what tool capability is being invoked, and which execution trace came from real runtime events instead of UI decoration.

Hackathon demos also often blur three separate layers:

- planning: what the system intends to do
- execution: what the agent actually did
- proof: what can be verified after the fact

UMG Studio addresses that gap by making the architecture explicit before, during, and after execution.

## Solution

UMG Studio provides a visual and inspectable architecture layer around Hermes. A user can describe a workflow, upload domain context such as a customer support SOP, generate or retrieve UMG building blocks, inspect the resulting hierarchy, compile it into a runtime manifest, and run it through Hermes. When a native Hermes action is allowed, UMG routes it through a gated bridge and records trace events that can be displayed by the Runtime Graph.

## What UMG is

UMG is the structure layer. It describes cognition as composable runtime objects:

- Sleeves: complete workflow/runtime containers
- NeoStacks: major functional lanes inside a Sleeve
- NeoBlocks: executable or inspectable work units
- MOLT layers: role-specific cognitive layers such as directive, instruction, subject, philosophy, blueprint, and meta
- Gates: approval, routing, governance, and runtime boundaries
- Capabilities: declared actions or skills a block may need
- MetaMOLT Tool Blocks: tool-like MOLT records that represent native Hermes capabilities inside the UMG hierarchy

UMG is not a replacement for Hermes. UMG gives Hermes an inspectable architecture and policy shell.

## What Hermes does

Hermes is the execution agent. It interprets requests, calls tools, creates files, reads local state, runs configured actions, and returns text or structured outputs. In this project Hermes is the native action executor behind UMG's gated runtime model.

## How UMG wraps Hermes

UMG Studio wraps Hermes with explicit contracts:

1. UMG builds or retrieves a hierarchy.
2. UMG compiles the hierarchy into a runtime manifest.
3. UMG sends the manifest or a native action request to a local Hermes bridge.
4. Hermes performs the requested work only when the selected action mode and policy allow it.
5. UMG verifies returned outputs where possible.
6. UMG records trace events for the Runtime Graph.

The key difference is that UMG separates declarations, approvals, native execution, and trace proof.

## Core hierarchy

Sleeve → NeoStack → NeoBlock → MOLT → Gate → Capability → MetaMOLT Tool Block

Example interpretation:

- Sleeve: Customer Support SOP Runtime Sleeve
- NeoStack: Intake, policy lookup, response drafting, escalation
- NeoBlock: Analyze customer request
- MOLT: directive/instruction/subject/philosophy/blueprint/meta layers
- Gate: require approval before external or risky action
- Capability: create note, read file, run shell command, draft response
- MetaMOLT Tool Block: TOOL.HERMES.NOTE_CREATE.v0.1

## Current working features

- Library-first candidate retrieval for UMG source blocks
- MOLT detail recovery and non-blank detail views
- Library Browser search, tag, and filter repair
- Upload intake intelligence for local text context
- Runtime-session Sleeve generation and inspection
- NeoStack / NeoBlock / MOLT hierarchy display
- Runtime Graph visual observer
- Real compiler bridge integration path
- Hermes runtime bridge path
- MetaMOLT Tool Block registry for native Hermes capabilities
- Native Hermes action bridge at `/api/hermes/native-action`
- Action modes: Observe, Approval, Direct, Blocked
- Native Hermes capabilities:
  - `umg.native.hermes.note_create`
  - `umg.native.hermes.file_write`
  - `umg.native.hermes.file_read`
  - `umg.native.hermes.shell_command`
  - `umg.native.hermes.project_edit`
  - `umg.native.hermes.runtime_task`
- Real native file creation through Hermes
- Trace events for native action execution:
  - `tool_block_resolved`
  - `action_request_created`
  - `action_approval_required`
  - `action_executed`
  - `file_created`
  - `file_modified`
  - `artifact_created`
  - `action_failed`
  - `action_blocked`

## Key proof

The Native Hermes action bridge created a real desktop file:

`C:\Users\Magne\OneDrive\Desktop\umg-hermes-native-test.txt`

WSL path:

`/mnt/c/Users/Magne/OneDrive/Desktop/umg-hermes-native-test.txt`

Verified content:

`hi im hermes from UMG`

This proof is important because it demonstrates that UMG is not only drawing a graph. It can route a gated native action into Hermes and verify a real filesystem artifact.

## Demo flow

### Demo 1 — Customer Support SOP Runtime Sleeve

1. Open UMG Studio.
2. Upload or paste a customer support SOP.
3. Generate a Customer Support SOP Runtime Sleeve.
4. Inspect generated NeoStacks, NeoBlocks, and MOLT layers.
5. Open Library Browser and show matched/reused MOLT candidates.
6. Compile the active Sleeve.
7. Open Runtime Graph / Runtime Observer.
8. Show hierarchy and trace-aware runtime visualization.

### Demo 2 — Native Hermes Tool Bridge

1. Open Runtime Observer.
2. Select Native Hermes action mode.
3. Use Direct mode for the verified low-risk note creation proof.
4. Request: create a desktop note named `umg-hermes-native-test` containing `hi im hermes from UMG`.
5. Show returned action result with `status: executed` and `externalActionTaken: true`.
6. Show trace events for action request, execution, file creation, and artifact creation.
7. Show the file on the Windows desktop.

## Setup / run commands

From the UMG Studio repo:

```bash
cd ~/umg-studio
```

Install dependencies if needed:

```bash
npm install
```

Start the compiler bridge:

```bash
node scripts/umgCompilerBridge.mjs
```

Start the Hermes runtime/native action bridge:

```bash
HERMES_RUNTIME_BRIDGE_PORT=8788 \
HERMES_RUNTIME_ALLOW_LIVE=true \
HERMES_NATIVE_ACTION_ALLOW_DIRECT=true \
HERMES_CLI_PATH=/home/neomagnetar/.local/bin/hermes \
HERMES_INFERENCE_PROVIDER=openai-codex \
HERMES_INFERENCE_MODEL=gpt-5.3-codex-spark \
node dev/hermes-runtime-bridge.mjs
```

Start Vite with explicit endpoints:

```bash
VITE_HERMES_GENERATE_URL=http://127.0.0.1:8788/api/hermes/custom-sleeve-generation \
VITE_HERMES_RUNTIME_ENDPOINT=http://127.0.0.1:8788/api/hermes/runtime \
VITE_UMG_COMPILER_ENDPOINT=http://127.0.0.1:8787/compile \
npm run dev -- --host 0.0.0.0 --port 5173
```

Validation commands:

```bash
npm run build
node --check scripts/umgCompilerBridge.mjs
node --check dev/hermes-runtime-bridge.mjs
```

Optional direct native-action proof:

```bash
curl -sS -X POST http://127.0.0.1:8788/api/hermes/native-action \
  -H 'Content-Type: application/json' \
  --data '{
    "actionId":"native.note.demo",
    "capabilityId":"umg.native.hermes.note_create",
    "mode":"direct",
    "risk":"low",
    "prompt":"Create a new note that says hi im hermes from UMG and save it on my desktop as umg-hermes-native-test.",
    "expectedOutputs":["/mnt/c/Users/Magne/OneDrive/Desktop/umg-hermes-native-test.txt"],
    "userApproved":true
  }'
```

## Known limitations

- Native approval continuation UI is not fully polished.
- Stale Vite ports may exist; acceptance should use the current canonical dev server and current-code bridges.
- Website Builder is deferred.
- PDF/DOCX/OCR extractors are deferred.
- Source-library promotion is deferred; current generated/native tool blocks are app-local/runtime-session unless explicitly promoted later.
- Observe and Blocked endpoint proof has not been expanded as much as Direct and Approval.
- Runtime Graph native activation browser proof needs polish.
- This is a hackathon package, not a hardened production release.
