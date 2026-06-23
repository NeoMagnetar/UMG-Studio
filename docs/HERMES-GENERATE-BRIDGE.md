# Hermes Generate Local Bridge

## Purpose

UMG Studio's browser Generate button can call `VITE_HERMES_GENERATE_URL` for the local bridge or fall back to legacy `VITE_HERMES_ENDPOINT` when the bridge URL is absent. Real provider secrets must not live in browser-visible `VITE_*` variables. The local dev-only bridge gives the browser a local endpoint while keeping provider credentials server-side.

Target frontend URL:

```text
VITE_HERMES_GENERATE_URL=http://127.0.0.1:8787/api/hermes/generate
```

Target bridge route:

```text
POST http://127.0.0.1:8787/api/hermes/generate
```

## Setup

Create an untracked local env file for the Vite frontend and shell-export server-only bridge variables separately.

Frontend bridge value:

```text
VITE_HERMES_GENERATE_URL=http://127.0.0.1:8787/api/hermes/generate
```

Legacy direct endpoint compatibility value:

```text
VITE_HERMES_ENDPOINT=http://localhost:3000/api/hermes
```

Endpoint resolution order is `VITE_HERMES_GENERATE_URL`, then legacy `VITE_HERMES_ENDPOINT`, then empty/unconfigured.

Legacy browser-visible values are local/dev only:

```text
VITE_HERMES_MODEL=hermes-default
VITE_HERMES_API_KEY=replace_me_only_for_local_legacy_dev
```

Prefer bridge-side `HERMES_API_KEY` for real provider secrets.

Server-only bridge values:

```text
HERMES_PROVIDER_URL=https://provider.example/v1/chat/completions
HERMES_MODEL=example-model
HERMES_API_KEY=replace_me_in_untracked_local_env
```

`HERMES_API_KEY` is server-only. Do not put real secrets in `VITE_*` variables.

## How to run

From the repo root:

```text
node dev/hermes-generate-bridge.mjs
```

Defaults:

```text
HERMES_BRIDGE_HOST=127.0.0.1
HERMES_BRIDGE_PORT=8787
```

Optional overrides:

```text
HERMES_BRIDGE_HOST=127.0.0.1
HERMES_BRIDGE_PORT=8787
```

Restart Vite after changing `VITE_HERMES_GENERATE_URL`; Vite loads `VITE_*` variables at dev-server startup.

## Env variables

Browser/Vite:

- `VITE_HERMES_GENERATE_URL`: local bridge URL. Safe to expose.
- `VITE_HERMES_ENDPOINT`: legacy direct browser endpoint, used only if `VITE_HERMES_GENERATE_URL` is absent.
- `VITE_HERMES_MODEL`: legacy/direct endpoint model hint.
- `VITE_HERMES_API_KEY`: browser-visible legacy/direct endpoint key; local/dev only. Prefer server-side bridge `HERMES_API_KEY` for real secrets.

Server-only bridge:

- `HERMES_PROVIDER_URL`: upstream provider HTTP endpoint.
- `HERMES_API_KEY`: provider secret, never exposed to browser.
- `HERMES_MODEL`: provider model name.
- `HERMES_BRIDGE_HOST`: optional local bind host.
- `HERMES_BRIDGE_PORT`: optional local bind port.

## Secret safety

- Do not commit `.env`, `.env.local`, or `.env.*.local`.
- Do not store real secrets in `VITE_*` variables.
- `VITE_HERMES_API_KEY` is browser-visible and should be used only for local/dev legacy endpoint compatibility.
- For real provider secrets, prefer bridge-side `HERMES_API_KEY`.
- Bridge logs redact Authorization, api_key, key, token, and secret fields.
- Logs should show status/duration/provider origin only, not full prompt bodies or keys.

## Boundaries

The bridge is generation-only and dev-local:

- no route switching
- no RuntimeGate product evaluation
- no live tool execution
- no ActionGate execution
- no shell/tool/action proposal execution
- no compiler prompt-content mutation
- no HUMAN/GATES MOLT import
- no Trigger MOLT block creation
- no MOLT count changes

## Browser smoke steps

1. Start the bridge with server-only provider env.
2. Start or restart Vite with `VITE_HERMES_GENERATE_URL=http://127.0.0.1:8787/api/hermes/generate`.
3. Load `http://127.0.0.1:5177/`.
4. Click Compose Blocks.
5. Click Compile.
6. Confirm RuntimeSpec source remains `real`.
7. Click Generate.
8. Confirm Output tab becomes active.
9. Confirm Output contains provider-generated text, not the endpoint-missing message.
10. Confirm browser console JS errors = 0.
11. Confirm bridge logs show one POST status/duration and no secrets.
12. Confirm TriggerGate Sources remain 200, Attach Gate remains inert, and Glyph Matrix still renders.
