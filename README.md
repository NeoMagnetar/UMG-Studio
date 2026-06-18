# UMG Studio v0.1

UMG Studio is a local-first modular cognition studio for composing, inspecting, compiling, tracing, and exporting UMG block architectures through a visual graph interface.

The v0.1 build is a React + TypeScript workbench around existing UMG assets. It imports and normalizes UMG block data, lets you compose a Sleeve from a plain-language request, inspect the Sleeve / NeoStack / NeoBlock / MOLT hierarchy, compile through the local UMG compiler bridge, review RuntimeSpec / Trace / IR Matrix output, and export a Hermes-ready packet without exporting secrets.

## Current v0.1 capabilities

- Import and present the upstream UMG block catalog as normalized Studio library assets.
- Preserve the v0.1 MOLT role set only:
  - Trigger
  - Directive
  - Instruction
  - Subject
  - Primary
  - Philosophy
  - Blueprint
- Skip unsupported future roles such as Aim, Use, and Need.
- Compose a demo Sleeve from a user request using role/tag/category matching.
- Display the active architecture as a hierarchy-aware graph.
- Switch graph focus between:
  - Full Sleeve View
  - NeoStack View
  - NeoBlock View
  - MOLT Block View
- Resize and collapse workbench panels in a VS Code-style layout.
- Store workbench panel layout in browser localStorage.
- Move graph cards manually inside the current hierarchy view.
- Reset manual layout back to auto-layout.
- Toggle MOLT blocks on/off in the workspace.
- Compile the active Sleeve through the real local `umg-compiler` bridge when available.
- Preserve deterministic fallback compile behavior for local resilience.
- Show RuntimeSpec, Trace, prompt preview, Diagnostics, IR Matrix, and generated/output tab content.
- Export Sleeve JSON, IR Matrix JSON, and Hermes packet JSON.
- Keep Hermes API keys redacted in the UI and excluded from exported packets.

## Required local paths

This local build expects the Studio repo and related UMG repos at these paths:

```text
/home/neomagnetar/umg-studio
/home/neomagnetar/umg-block-library
/home/neomagnetar/umg-compiler
```

The Studio app should be run from:

```text
/home/neomagnetar/umg-studio
```

The current compiler bridge imports the local compiler package from:

```text
/home/neomagnetar/umg-compiler/compiler-v0/dist/compile.js
```

The block library and compiler repos are upstream/constrained sources for this local integration. They should not be modified by ordinary Studio demo work.

## Run locally

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

## Validate locally

```bash
npm test
npm run build
```

## Demo request

Use this request for the standard v0.1 demo:

```text
Build me a customer-intake chatbot for a mobile detailing business. It should answer basic questions, collect customer name, vehicle type, location, service need, and budget, then produce a clean lead summary.
```

## How to use Compose Blocks

1. Open the app.
2. In the Compose panel, enter the demo request or another plain-language request.
3. Choose a target type, usually `Chatbot` for the demo.
4. Choose a depth, usually `balanced`.
5. Click `Compose Blocks`.
6. The app creates a draft Sleeve with a NeoStack, NeoBlock, and relevant MOLT blocks.
7. The Library panel remains available so blocks can be inspected or copied into the workspace.

The v0.1 composer is intentionally rule/tag based. It is not a full vector-search or autonomous planning system.

## How to use graph views

The Graph Studio panel has hierarchy view controls:

### Full Sleeve View

Shows the top-level Sleeve and NeoStack-level architecture. This is the only view where connector lines are expected by default.

Use it to understand the overall Sleeve shape.

### NeoStack View

Shows the selected NeoStack and its NeoBlocks as attached/tiled cards. It avoids random internal connector lines.

Click a NeoStack from Sleeve View, or use the `NeoStack View` button.

### NeoBlock View

Shows the selected NeoBlock and its MOLT blocks as attached/tiled cards. MOLT blocks keep their runtime styling: active glow, off grey state, warnings, and selected/focused state.

Click a NeoBlock from NeoStack View, or use the `NeoBlock View` button.

### MOLT Block View

Shows one selected MOLT block cleanly. The Inspector shows title, role, type, runtime status, tags, content, normalized JSON, source/legacy metadata when present, and the related IR Matrix row when available.

Click a MOLT block from NeoBlock View to enter this view.

## How to resize and collapse panels

The workbench has four main areas:

- Left: Library
- Center: Graph Studio / Canvas
- Right: Inspector / Config
- Bottom: Compiler / Runtime drawer

Use the split handles between panels to resize:

- Drag the vertical handle between Library and Graph to resize the left panel.
- Drag the vertical handle between Graph and Inspector to resize the right panel.
- Drag the horizontal handle above the Compiler / Runtime drawer to resize the bottom drawer.

Use each panel's `Collapse` / `Expand` button to hide or restore it.

Panel sizes persist in browser localStorage, so the layout should stay stable across reloads on the same browser profile.

## Manual graph arrangement

Cards in the active hierarchy view can be dragged within the canvas. Moving a card stores simple manual layout metadata on the workspace graph node.

Use `Reset Layout` to return to auto-layout.

Manual movement does not clear runtime state. Active blocks should still glow, off blocks should stay grey, and warning/invalid state should remain visible.

## How to compile

1. Compose or load a workspace.
2. Optionally toggle a MOLT block on/off from the Inspector.
3. Click `Compile`.
4. Open the Compiler / Runtime drawer tabs:
   - `RuntimeSpec`
   - `Trace`
   - `Prompt`
   - `Diagnostics`
   - `IR Matrix`

Expected real compiler RuntimeSpec fields include:

```json
{
  "compiler": "umg-compiler",
  "source": "real"
}
```

If the real compiler bridge is unavailable or fails, the deterministic fallback path remains present so compile-only behavior can still be inspected.

## How to export a Hermes packet

1. Compose a workspace.
2. Click `Compile`.
3. Click `Export Hermes Packet` in Graph Studio.
4. Save or inspect the downloaded JSON packet.

The exported Hermes packet should include the compiled prompt, RuntimeSpec, Trace, IR Matrix, active blocks, and generation settings.

It must not include API keys or an `apiKey` field.

## Hermes config safety note

Hermes generation is optional for v0.1 demo validation.

Local Hermes settings can be entered in the Inspector / Config panel. The API key field is treated as a local secret:

- it is shown redacted in UI status
- it is not included in workspace exports
- it is not included in Hermes packet exports
- it should not be committed

If Hermes is not configured, generation should be blocked or clearly warned while compile/export remains available.

## Known limitations

- v0.1 is local-first and single-user only.
- No cloud sync, account system, marketplace, or deployment pipeline.
- Composer is deterministic/tag-based and intentionally simple.
- Vector search is not required for v0.1.
- Graph layout is basic hierarchy/tile layout with simple manual movement, not a full design tool.
- Manual layout is stored in workspace graph state, not in a full external layout database.
- NeoStack and NeoBlock views intentionally avoid internal connector-line noise.
- Aim, Use, and Need are reserved for later MOLT extensions and are not active v0.1 roles.
- The app assumes the local path layout listed above unless the integration code is adapted.
- Hermes live generation requires user-provided local credentials or endpoint configuration.

## Reference docs

- `docs/UMG-STUDIO-V0.1-DEMO-SCRIPT.md`
- `docs/UMG-STUDIO-V0.1-ARCHITECTURE.md`
