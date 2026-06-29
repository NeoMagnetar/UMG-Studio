# Hackathon Demo Stabilization

## Public demo path

Business Automation prompt:

```text
Art of War philosophy based generic business template creator
```

Recording path:

1. Open the Vite app.
2. Enter the prompt above.
3. Select `Business Automation`.
4. Click `Start Cognition Upload`.
5. Click `Create Sleeve From Template`.
6. Click `Match Blocks & Detect Gaps`.
7. Click `Compile with UMG Compiler`.
8. Click `Run Hermes Runtime`.
9. Verify trace ingestion and mapped real runtime events for Sleeve, NeoStack, NeoBlock, MOLT, and Gate.

## Startup commands

Run from `/home/neomagnetar/umg-studio` in WSL Ubuntu.

Terminal 1 — compiler bridge:

```bash
npm run umg:compiler-bridge
```

Terminal 2 — Hermes runtime bridge:

```bash
HERMES_RUNTIME_BRIDGE_PORT=8788 npm run umg:hermes-runtime-bridge
```

Terminal 3 — Vite app:

```bash
VITE_UMG_COMPILER_ENDPOINT=http://127.0.0.1:8787/compile \
VITE_HERMES_RUNTIME_ENDPOINT=http://127.0.0.1:8788/api/hermes/runtime \
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

## Expected ports

- Vite app: `http://localhost:5173/`
- compiler bridge: `http://127.0.0.1:8787/compile`
- Hermes runtime bridge: `http://127.0.0.1:8788/api/hermes/runtime`

## Runtime truth boundary

The demo must not use fake runtime activation. Compiler trace is not Hermes runtime trace. Visual activation is valid only when it comes from real Hermes runtime events mapped by supplied UMG IDs. Unmapped events may appear in the timeline but must not light up hierarchy nodes.

## Composition Health note

Phase 11A composition warnings are audit-only and non-blocking. The validator does not mutate source blocks, does not save to the source library, does not change runtime activation, and does not block compile.
