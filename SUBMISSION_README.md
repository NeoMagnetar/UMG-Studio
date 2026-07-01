# UMG Studio

UMG Studio is a cognitive architecture studio for Hermes. It helps users build modular AI workflows, inspect runtime behavior, connect tools, and make agent actions visible.

## What it does

UMG Studio structures workflows as modular cognitive systems. Users can generate or select a Sleeve, inspect its modules and runtime path, compile the workflow, and connect Hermes through the included local bridge for tool use and native actions.

## Hackathon demo path

- Start the compiler bridge.
- Start the Hermes runtime bridge.
- Open the Vite app.
- Use the calibrated Haiku Note Sleeve if live generation is slow.
- Inspect the workflow hierarchy and runtime graph.
- Compile the Sleeve.
- Connect Hermes for runtime/tool execution.

## Run locally

Terminal 1:

```bash
cd ~/umg-studio
npm run umg:compiler-bridge
```

Terminal 2:

```bash
cd ~/umg-studio
HERMES_RUNTIME_BRIDGE_PORT=8788 \
HERMES_RUNTIME_TOOLSETS=terminal \
HERMES_CUSTOM_SLEEVE_TIMEOUT_MS=180000 \
HERMES_RUNTIME_TIMEOUT_MS=90000 \
npm run umg:hermes-runtime-bridge
```

Terminal 3:

```bash
cd ~/umg-studio
VITE_HERMES_GENERATE_URL=http://127.0.0.1:8788/api/hermes/custom-sleeve-generation \
VITE_HERMES_RUNTIME_ENDPOINT=http://127.0.0.1:8788/api/hermes/runtime \
VITE_UMG_COMPILER_ENDPOINT=http://127.0.0.1:8787/compile \
VITE_HERMES_RUNTIME_ENABLED=true \
VITE_UMG_COMPILER_ENABLED=true \
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open:

http://127.0.0.1:5173/

## Notes

Native Hermes execution requires the local Hermes runtime bridge. The app includes a calibrated library-backed demo Sleeve so the workflow can be inspected and compiled even if live generation is slow.

## License

Apache-2.0
