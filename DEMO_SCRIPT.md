# UMG Studio Demo Script

This script is for the hackathon submission recording. Keep the demo focused on visible product proof. Do not start Website Builder or introduce new runtime features during recording.

## Pre-demo checks

From `~/umg-studio`:

```bash
git log -1 --oneline
git status --short
```

Expected latest checkpoint:

```text
c902446 feat: add native Hermes action bridge for UMG runtime
```

Start local services if they are not already running:

```bash
node scripts/umgCompilerBridge.mjs
```

```bash
HERMES_RUNTIME_BRIDGE_PORT=8788 \
HERMES_RUNTIME_ALLOW_LIVE=true \
HERMES_NATIVE_ACTION_ALLOW_DIRECT=true \
HERMES_CLI_PATH=/home/neomagnetar/.local/bin/hermes \
HERMES_INFERENCE_PROVIDER=openai-codex \
HERMES_INFERENCE_MODEL=gpt-5.3-codex-spark \
node dev/hermes-runtime-bridge.mjs
```

```bash
VITE_HERMES_GENERATE_URL=http://127.0.0.1:8788/api/hermes/custom-sleeve-generation \
VITE_HERMES_RUNTIME_ENDPOINT=http://127.0.0.1:8788/api/hermes/runtime \
VITE_UMG_COMPILER_ENDPOINT=http://127.0.0.1:8787/compile \
npm run dev -- --host 0.0.0.0 --port 5173
```

Use the current canonical app URL, normally:

`http://127.0.0.1:5173/`

Avoid stale Vite ports during acceptance recording.

---

## Demo 1 — Customer Support SOP Runtime Sleeve

Goal: show that UMG Studio can turn domain context into an inspectable cognitive runtime hierarchy.

### Setup

Prepare a short customer support SOP text, for example:

```text
Customer Support SOP
1. Intake the customer request and identify order number, customer intent, urgency, and product category.
2. Check policy eligibility before promising refunds, replacements, credits, or escalations.
3. Draft a response that references policy constraints and next steps.
4. Escalate high-risk, legal, safety, payment, or angry-customer issues to a human manager.
5. Keep an audit note of the decision path.
```

### Recording steps

1. Open UMG Studio.
2. Show the Basic intake page.
3. Paste or upload the customer support SOP.
4. Enter a prompt such as:

```text
Build a Customer Support SOP Runtime Sleeve that can intake a customer request, check policy, draft a response, escalate if needed, and produce an audit note.
```

5. Generate the Sleeve.
6. Show the generated active session Sleeve title.
7. Show NeoStacks.
   - Call out functional lanes such as intake, policy, response drafting, escalation, and audit/reporting.
8. Show NeoBlocks.
   - Call out that these are the work units inside the lanes.
9. Show MOLT layers.
   - Call out directive/instruction/subject/philosophy/blueprint/meta roles where visible.
10. Open Library Browser.
11. Show MOLT blocks, search/tag/filter behavior, and source/reuse badges where visible.
12. Compile the active Sleeve.
13. Open Runtime Graph / Runtime Observer.
14. Show that the structure is inspectable as a runtime hierarchy.
15. If a real Hermes trace is available, show trace events; if not, state that structural graph is visible and runtime activation depends on real trace.

### Narration points

- “UMG is the cognitive architecture layer.”
- “Hermes is still the executor.”
- “The hierarchy is Sleeve → NeoStack → NeoBlock → MOLT → Gate → Capability.”
- “Uploaded context influences retrieval and generation.”
- “The source library remains protected; this is runtime-session generation.”
- “The graph does not need to fake activation. It can show structure first and trace-derived execution state when real events arrive.”

### Success proof to show

- Domain-specific generated Sleeve, not a generic workflow title.
- Visible NeoStacks / NeoBlocks / MOLT layers.
- Library Browser with MOLT candidates.
- Runtime Graph / Runtime Observer visible.

---

## Demo 2 — Native Hermes Tool Bridge

Goal: show that UMG can route a gated native action into Hermes and verify real output.

### What this proves

This demo proves the system is not just a diagram. UMG can model a Hermes-native capability as a MetaMOLT Tool Block, send a gated native action request, let Hermes create a real file, verify the file, and return trace events.

### Recording steps

1. Open the UMG Runtime Observer / native action area.
2. Show the Runtime Execution Mode selector.
   - Observe
   - Approval
   - Direct
3. Explain the action mode model:
   - Observe previews only.
   - Approval stops before execution.
   - Direct executes when policy allows.
   - Blocked is the policy refusal state.
4. Select Direct mode for the low-risk desktop note proof.
5. Use the request:

```text
Create a new note that says hi im hermes from UMG and save it on my desktop as umg-hermes-native-test.
```

6. Run the native Hermes action.
7. Show the result panel:
   - status: executed
   - externalActionTaken: true
   - createdFiles includes the desktop file path
   - stdout/stderr captured if visible
   - trace events count/list
8. Show trace events:
   - tool_block_resolved
   - action_request_created
   - action_executed
   - file_created
   - artifact_created
9. Show the Windows desktop file:

```text
C:\Users\Magne\OneDrive\Desktop\umg-hermes-native-test.txt
```

10. Open or preview the file content:

```text
hi im hermes from UMG
```

### Optional terminal proof

If useful, show:

```bash
test -f /mnt/c/Users/Magne/OneDrive/Desktop/umg-hermes-native-test.txt && tr -d '\r' < /mnt/c/Users/Magne/OneDrive/Desktop/umg-hermes-native-test.txt
```

Expected output:

```text
hi im hermes from UMG
```

### Narration points

- “This is a MetaMOLT Tool Block represented inside the UMG hierarchy.”
- “The action did not silently run through a fake local artifact path.”
- “The bridge returned `externalActionTaken: true` only after verifying the expected file output.”
- “Approval mode exists for the same request but stops before native execution.”
- “The trace events give the Runtime Graph real execution material.”

### Success proof to show

- Native action endpoint result with `status: executed`.
- `externalActionTaken: true`.
- Created file path.
- File exists on desktop.
- File content matches `hi im hermes from UMG`.
- Trace events visible.

---

## Closing line

UMG Studio makes Hermes workflows inspectable, governable, and executable: users can see the cognitive architecture, run real Hermes actions through gates, and verify the resulting trace and artifacts.
