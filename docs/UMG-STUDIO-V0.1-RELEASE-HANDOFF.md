# UMG Studio v0.1 Release Handoff

## Current project status

UMG Studio v0.1 is a local-first React + TypeScript modular cognition workbench for UMG. The current build supports composing a UMG Sleeve from a plain-language request, inspecting the Sleeve / NeoStack / NeoBlock / MOLT Block hierarchy, compiling through the local real `umg-compiler` bridge, viewing runtime artifacts, and exporting a Hermes-safe packet.

Status at this handoff:

- App is locally runnable.
- Core v0.1 demo flow is validated.
- Real compiler bridge is preserved.
- Deterministic fallback is preserved.
- Graph and IR Matrix runtime state agreement is preserved.
- Resizable VS Code-style workbench is implemented.
- Hierarchy-specific graph views are implemented.
- Demo/readme/architecture docs are present.
- No v0.1 activation of Aim, Use, or Need roles.

## Current commit hash

```text
58e4e4e41ca33df8c57f9be9bdafdd1d6995b63e
```

Commit message:

```text
docs: add UMG Studio v0.1 demo and architecture packet
```

## Major completed checkpoints

- Runtime graph mapping checkpoint.
- Upstream UMG block library normalization.
- Library presentation hardening and real block composition.
- Semantic graph zoom and Hermes config hardening.
- Resizable workbench and hierarchical graph views.
- Demo README and architecture packet.
- Current release/handoff bundle.

See also:

```text
docs/UMG-STUDIO-V0.1-CHECKPOINT-LEDGER.md
```

## Local paths

Primary app repo:

```text
/home/neomagnetar/umg-studio
```

Constrained upstream/source repos:

```text
/home/neomagnetar/umg-block-library
/home/neomagnetar/umg-compiler
```

Current real compiler bridge target:

```text
/home/neomagnetar/umg-compiler/compiler-v0/dist/compile.js
```

## Run commands

From the Studio repo:

```bash
cd /home/neomagnetar/umg-studio
npm install
npm run dev -- --port 5177 --strictPort
```

Open:

```text
http://127.0.0.1:5177
```

## Test/build commands

Use:

```bash
npm test
npm run build
```

The package script inspection command is not required for normal handoff validation.

## Demo scenario

Use this demo request:

```text
Build me a customer-intake chatbot for a mobile detailing business. It should answer basic questions, collect customer name, vehicle type, location, service need, and budget, then produce a clean lead summary.
```

Expected demo actions:

1. Launch app.
2. Confirm imported assets are visible.
3. Compose the mobile-detailing chatbot.
4. Inspect the Library panel.
5. Switch between Full Sleeve View, NeoStack View, NeoBlock View, and MOLT Block View.
6. Resize/collapse panels.
7. Move one graph card manually.
8. Toggle one MOLT block off.
9. Compile.
10. Inspect RuntimeSpec, Trace, Diagnostics, Prompt, and IR Matrix.
11. Export Hermes packet.
12. Confirm exported packet contains no API key and no `apiKey` field.

## Core capabilities

### Library and migration

- Imports/uses upstream UMG block-like assets.
- Normalizes blocks into Studio schema.
- Preserves source/legacy metadata when available.
- Displays library cards with role/category/tags/content/JSON inspection.

### Composition

- Accepts a plain-language request.
- Uses deterministic role/tag/category matching.
- Produces a draft Sleeve with NeoStack, NeoBlock, and MOLT blocks.
- Supports the v0.1 MOLT roles only:
  - Trigger
  - Directive
  - Instruction
  - Subject
  - Primary
  - Philosophy
  - Blueprint

### Graph Studio

- Full Sleeve View: top-level Sleeve and NeoStack architecture.
- NeoStack View: selected NeoStack and attached/tiled NeoBlocks.
- NeoBlock View: selected NeoBlock and attached/tiled MOLT blocks.
- MOLT Block View: one selected MOLT block with Inspector details.
- Runtime visuals for active, off, warning, invalid, triggered, and selected states.
- Basic manual card movement.
- Reset layout support.

### Resizable workbench

- Left Library panel.
- Center Graph/Canvas panel.
- Right Inspector/Config panel.
- Bottom Compiler/Runtime drawer.
- Draggable split handles.
- Collapse/expand controls.
- Panel sizing persisted in browser localStorage.

### Compiler/runtime

- Converts active workspace/Sleeve into compiler input.
- Calls real local `umg-compiler` bridge when available.
- Produces RuntimeSpec, Trace, prompt preview, Diagnostics, and IR Matrix.
- Preserves deterministic fallback if real compiler execution fails.
- Maintains graph/IR Matrix runtime agreement.

### Hermes/export

- Exports Hermes-ready packet after compile.
- Exports safe runtime architecture artifacts.
- Excludes API keys and `apiKey` fields from exports.
- Blocks or warns safely if generation is requested without Hermes configuration.

## Known limitations

- v0.1 is a local prototype/workbench, not a hosted platform.
- No cloud sync.
- No account system.
- No marketplace.
- No multi-user collaboration.
- No payment system.
- No public deployment pipeline.
- Composer is deterministic/tag-based, not vector-search or full autonomous planning.
- Graph layout is hierarchy/tile-oriented, not a full diagramming product.
- Manual layout is simple card movement, not full design tooling.
- Hermes generation requires a locally configured endpoint/key.
- The local path assumptions are currently hardcoded or documented for this workstation-oriented build.

## Deferred work

Potential v0.2+ work:

- Optional future MOLT roles: Aim, Use, Need.
- More robust importers for arbitrary upstream folder trees.
- Richer graph layout algorithms.
- Manual relationship editing.
- Vector search or embeddings for block retrieval.
- Expanded templates and premade Sleeves.
- Stronger schema validation and migrations.
- More formal workspace persistence/import/export UI.
- Optional cloud/sync layer.
- Multi-agent runtime orchestration.
- Public deployment/package workflow.

## Hermes command-runner protocol

For long engineering tasks in this environment:

1. Treat large user instructions as the mission, not as a terminal command.
2. Create a phased plan.
3. Execute one small command at a time.
4. Never chain commands with `&&`.
5. Never run cross-repo inspection bundles.
6. Never inspect multiple repos in one command.
7. Never retry a denied command.
8. Patch only after baseline is clear.
9. Test after patch.
10. Build after tests.
11. Commit only when explicitly instructed.
12. Do not run package script inspection unless explicitly requested.
13. Do not use `node -e` unless explicitly requested.
14. Do not use `rm`, `rm -rf`, `git reset --hard`, `git clean`, or `npm audit fix` unless the exact command is explicitly approved.

## API key and secret safety notes

- Do not expose API keys in chat, logs, reports, workspace JSON, or Hermes packets.
- Treat any encountered key/token/password/credential as `[REDACTED]`.
- Hermes API key display should be redacted in UI.
- Exported Hermes packets must not contain an `apiKey` field.
- `.env.local` or browser-local configuration is for local use only and should not be committed.
- If Hermes is unconfigured, generation should be blocked or warned; do not invent credentials.

## Constrained repos

These repos should not be modified casually by Studio tasks:

```text
/home/neomagnetar/umg-block-library
/home/neomagnetar/umg-compiler
```

Expected ordinary Studio development should happen in:

```text
/home/neomagnetar/umg-studio
```

Only inspect or modify constrained repos when the user explicitly scopes and approves that work.

## Handoff checklist

Before claiming v0.1 release handoff is valid:

- `npm test` passes.
- `npm run build` passes.
- Git status is reported.
- Changed files are listed.
- No constrained repo was modified.
- No secrets were exposed or exported.
- No forbidden commands were used.
