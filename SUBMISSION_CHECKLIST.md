# Hackathon Submission Checklist

## Repo state

Expected latest commit:

```text
c902446 feat: add native Hermes action bridge for UMG runtime
```

Check repo status:

```bash
cd ~/umg-studio
git status --short
git log -1 --oneline
```

Protected repo checks:

```bash
git -C ~/umg-block-library status --short
git -C ~/umg-compiler status --short
```

Expected before recording/submission:

- UMG Studio repo either clean or only documentation package files dirty if not yet committed
- `/home/neomagnetar/umg-block-library` clean
- `/home/neomagnetar/umg-compiler` clean

## Validation commands

Run:

```bash
npm run build
node --check scripts/umgCompilerBridge.mjs
node --check dev/hermes-runtime-bridge.mjs
```

Optional targeted tests if code changes after this package:

```bash
npm test -- --run src/test/hermes-runtime-bridge.test.js
```

Do not run long browser proof loops unless needed for final recording.

## Required ports

Recommended canonical ports:

- Vite app: `5173`
- UMG compiler bridge: `8787`
- Hermes runtime/native action bridge: `8788`

Check active ports:

```bash
ss -ltnp | grep -E '5173|5174|5175|5177|5185|8787|8788|8797|8798' || true
```

Acceptance note:

Use the current-code canonical app server. Do not rely on stale Vite ports.

## Setup commands

From the repo:

```bash
cd ~/umg-studio
```

Start compiler bridge:

```bash
node scripts/umgCompilerBridge.mjs
```

Start Hermes runtime/native action bridge:

```bash
HERMES_RUNTIME_BRIDGE_PORT=8788 \
HERMES_RUNTIME_ALLOW_LIVE=true \
HERMES_NATIVE_ACTION_ALLOW_DIRECT=true \
HERMES_CLI_PATH=/home/neomagnetar/.local/bin/hermes \
HERMES_INFERENCE_PROVIDER=openai-codex \
HERMES_INFERENCE_MODEL=gpt-5.3-codex-spark \
node dev/hermes-runtime-bridge.mjs
```

Start Vite:

```bash
VITE_HERMES_GENERATE_URL=http://127.0.0.1:8788/api/hermes/custom-sleeve-generation \
VITE_HERMES_RUNTIME_ENDPOINT=http://127.0.0.1:8788/api/hermes/runtime \
VITE_UMG_COMPILER_ENDPOINT=http://127.0.0.1:8787/compile \
npm run dev -- --host 0.0.0.0 --port 5173
```

Open:

`http://127.0.0.1:5173/`

## Demo steps

### Demo 1 — SOP Runtime Sleeve

- Show Basic intake page.
- Paste/upload customer support SOP context.
- Generate Customer Support SOP Runtime Sleeve.
- Show active generated Sleeve title.
- Show NeoStacks.
- Show NeoBlocks.
- Show MOLT layers.
- Show Library Browser with MOLT blocks and search/tag/filter.
- Compile.
- Show Runtime Graph / Runtime Observer.

### Demo 2 — Native Hermes Tool Bridge

- Show Runtime Execution Mode selector.
- Explain Observe / Approval / Direct / Blocked.
- Use Direct for low-risk note creation.
- Request desktop note creation.
- Show native action result:
  - `status: executed`
  - `externalActionTaken: true`
  - created file path
  - trace events
- Show desktop file:
  - `C:\Users\Magne\OneDrive\Desktop\umg-hermes-native-test.txt`
- Show content:
  - `hi im hermes from UMG`

## Screenshots needed

See `SCREENSHOT_LIST.md`.

Minimum screenshot set:

- Basic intake page
- generated Sleeve hierarchy
- Library Browser MOLT blocks
- Runtime Graph / System Sleeve view
- Runtime Path view
- Native Hermes action result
- desktop file proof

## Video recording steps

1. Start with repo checkpoint proof in terminal.
2. Open app at canonical URL.
3. Record Demo 1 in the browser.
4. Record Demo 2 in the browser and desktop.
5. Show terminal file proof if useful.
6. End with the one-sentence pitch.

Suggested closing line:

“UMG Studio makes Hermes workflows inspectable, governable, and executable: users can design the cognitive hierarchy, run real Hermes actions through gates, and verify execution through trace and artifacts.”

## Final submission notes

Include these files in the submission package:

- `README_HACKATHON.md`
- `ARCHITECTURE.md`
- `DEMO_SCRIPT.md`
- `KNOWN_LIMITATIONS.md`
- `SUBMISSION_CHECKLIST.md`
- `SCREENSHOT_LIST.md`

Submission claims to keep precise:

- Real native desktop note proof exists.
- UMG wraps Hermes; it does not replace Hermes.
- Runtime Graph activation should be based on real trace.
- Source-library promotion and Website Builder are deferred.
- Native approval UI is a known limitation.

Do not claim:

- full production-ready approval workflow
- Website Builder completion
- PDF/DOCX/OCR extraction completion
- source-library promotion
- fake runtime traces as proof
