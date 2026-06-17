# UMG Studio v0.1

Local-first React + TypeScript prototype for composing, inspecting, compiling, generating, tracing, and exporting UMG sleeves.

## Run locally

```bash
cd /home/neomagnetar/umg-studio
npm install
npm run dev
```

Open the printed local URL.

## Verify

```bash
npm test
npm run build
```

## Hermes config

Copy `.env.local.example` to `.env.local` or use Config in the UI. API keys are stored in browser localStorage for local use, redacted in UI, and excluded from exported packets.

## Current compiler bridge

`src/lib/umg/compilerBridge.ts` attempts a deterministic local compile-compatible wrapper. If an external `umg-compiler` package/path is later installed, this file is the adapter boundary to call it without changing UI code.
