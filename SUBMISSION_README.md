# UMG Studio

## Project

UMG Studio

## Pitch

UMG Studio is a local-first modular cognitive runtime surface for Hermes. It structures agent workflows as Sleeves made of NeoStacks, NeoBlocks, MOLT layers, Merge operations, Gates, and MetaMOLT Tool Blocks, then connects to a user-local Hermes runtime bridge.

## Local-first note

Native Hermes actions require the user to run their own local Hermes bridge. The public repo/demo shows the app architecture and the included bridge scripts.

## How to run

Terminal 1:

```bash
cd ~/umg-studio
npm run umg:compiler-bridge
```

Terminal 2:

```bash
cd ~/umg-studio
HERMES_RUNTIME_BRIDGE_PORT=8788 HERMES_RUNTIME_TOOLSETS=terminal HERMES_CUSTOM_SLEEVE_TIMEOUT_MS=180000 HERMES_RUNTIME_TIMEOUT_MS=90000 npm run umg:hermes-runtime-bridge
```

Terminal 3:

```bash
cd ~/umg-studio
VITE_HERMES_GENERATE_URL=http://127.0.0.1:8788/api/hermes/custom-sleeve-generation VITE_HERMES_RUNTIME_ENDPOINT=http://127.0.0.1:8788/api/hermes/runtime VITE_UMG_COMPILER_ENDPOINT=http://127.0.0.1:8787/compile VITE_HERMES_RUNTIME_ENABLED=true VITE_UMG_COMPILER_ENABLED=true npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open:

http://127.0.0.1:5173/

## Demo path

- Use Calibrated Haiku Note Sleeve
- Inspect Sleeve hierarchy
- Compile if available
- Open Runtime Graph
- Connect Hermes for native execution

## Known limitations

- Local-first Hermes bridge required for native action execution
- Live generation may take time depending on Hermes/runtime setup
- Calibrated library-backed Sleeve is included for reliable demo
