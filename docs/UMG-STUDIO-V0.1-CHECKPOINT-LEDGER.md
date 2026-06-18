# UMG Studio v0.1 Checkpoint Ledger

This ledger records the known UMG Studio v0.1 checkpoints that led to the current local handoff state.

## Current branch posture

The current v0.1 handoff line is built from a sequence of validated checkpoints in `/home/neomagnetar/umg-studio`.

Each checkpoint should be treated as a stable step in the local-first UMG Studio implementation path unless a later validation explicitly supersedes it.

## Known checkpoints

| Commit | Checkpoint | Summary |
| --- | --- | --- |
| `cdb5a989ee63d548c96c0969ee927b616879800e` | runtime graph mapping checkpoint | Established runtime graph mapping behavior and graph/runtime state relationship foundations. |
| `477bb5685ea2c2dc23b72d925bc47721f6540bfb` | normalize upstream UMG block library | Normalized upstream UMG block library assets into Studio-compatible catalog structures. |
| `6283e2899829f761c208e79905cf7d14ba0cd739` | harden library presentation and real block composition | Improved library display/presentation and strengthened real block composition flow. |
| `f18affbca932ef65a00c139649b1b79054d7bcae` | semantic graph zoom and Hermes config | Added semantic graph zoom/focus behavior and hardened Hermes configuration handling. |
| `f4da677969272237acf474d72c72cf8484e9ca73` | resizable workbench and hierarchical graph views | Added VS Code-style resizable workbench, hierarchy-specific graph views, layout metadata, manual card movement, and graph/IR Matrix preservation tests. |
| `58e4e4e41ca33df8c57f9be9bdafdd1d6995b63e` | demo and architecture packet | Added README, demo script, and architecture summary documentation for the v0.1 demo packet. |

## Checkpoint detail

### cdb5a989ee63d548c96c0969ee927b616879800e

Checkpoint:

```text
runtime graph mapping checkpoint
```

Role in v0.1:

- Established the link between runtime output and graph state.
- Set expectations for active/off/warning/invalid visual states.
- Supported later graph/IR Matrix agreement validation.

### 477bb5685ea2c2dc23b72d925bc47721f6540bfb

Checkpoint:

```text
normalize upstream UMG block library
```

Role in v0.1:

- Moved upstream block assets toward normalized Studio shape.
- Helped preserve source/legacy metadata.
- Supported searchable/presentable library cards.

### 6283e2899829f761c208e79905cf7d14ba0cd739

Checkpoint:

```text
harden library presentation and real block composition
```

Role in v0.1:

- Improved Library panel behavior.
- Strengthened demo composition from real normalized blocks.
- Helped preserve the mobile-detailing chatbot demo flow.

### f18affbca932ef65a00c139649b1b79054d7bcae

Checkpoint:

```text
semantic graph zoom and Hermes config
```

Role in v0.1:

- Added semantic graph focus behavior.
- Hardened Hermes config handling.
- Preserved no-secret export behavior.
- Validated real compiler execution and graph/IR Matrix agreement at that phase.

### f4da677969272237acf474d72c72cf8484e9ca73

Checkpoint:

```text
resizable workbench and hierarchical graph views
```

Role in v0.1:

- Added resizable workbench panels.
- Added left/right/bottom collapse/expand behavior.
- Persisted layout state in localStorage.
- Added Full Sleeve, NeoStack, NeoBlock, and MOLT Block views.
- Added layout metadata for hierarchy meaning.
- Added basic manual graph card arrangement.
- Preserved active/off runtime styling through focus changes and manual movement.

### 58e4e4e41ca33df8c57f9be9bdafdd1d6995b63e

Checkpoint:

```text
demo and architecture packet
```

Role in v0.1:

- Expanded README for local run/demo usage.
- Added v0.1 demo script.
- Added v0.1 architecture summary.
- Documented real compiler bridge, deterministic fallback, graph hierarchy views, IR Matrix, and Hermes-safe export layer.

## Validation expectations

Before creating a new checkpoint after this ledger, expected validation remains:

```bash
npm test
npm run build
```

For UI-affecting changes, also run local browser smoke validation against:

```text
http://127.0.0.1:5177
```

## Protected assumptions

The following v0.1 assumptions should remain protected unless explicitly changed by a future task:

- Do not activate Aim, Use, or Need as v0.1 compiler roles.
- Do not remove deterministic fallback.
- Do not break real compiler execution.
- Do not break graph/IR Matrix agreement.
- Do not export API keys or an `apiKey` field in Hermes packets.
- Do not casually modify `/home/neomagnetar/umg-block-library`.
- Do not casually modify `/home/neomagnetar/umg-compiler`.
