# UMG Studio v0.1 Demo Script

This script demonstrates the local UMG Studio v0.1 flow: compose a mobile-detailing customer-intake chatbot, inspect the UMG hierarchy, compile with the real compiler bridge, inspect runtime artifacts, and export a Hermes packet without exporting secrets.

## 1. Launch the app

From the Studio repo:

```bash
cd /home/neomagnetar/umg-studio
npm run dev -- --port 5177 --strictPort
```

Open:

```text
http://127.0.0.1:5177
```

Expected proof:

- App header shows `UMG Studio v0.1`.
- Compose panel is visible.
- Library panel is visible.
- Migration report shows imported upstream block assets.

## 2. Compose the mobile-detailing chatbot

Paste this request into the Compose panel:

```text
Build me a customer-intake chatbot for a mobile detailing business. It should answer basic questions, collect customer name, vehicle type, location, service need, and budget, then produce a clean lead summary.
```

Use:

- Target type: `Chatbot`
- Depth: `balanced`

Click:

```text
Compose Blocks
```

Expected proof:

- Status changes to a composed workspace message.
- Graph Studio shows a `Customer Intake Chatbot` Sleeve.
- Full Sleeve View shows the Sleeve and at least one NeoStack.
- The composed path includes a chatbot conversation stack and an intake-oriented NeoBlock.

## 3. Inspect imported library assets

In the Library panel:

1. Confirm the migration report shows imported blocks.
2. Search for or visually confirm demo assets such as:
   - `Chatbot Trigger`
   - `Support Directive`
   - `Collect Lead Fields`
   - `Mobile Detailing Subject`
   - `Lead Summary Blueprint`
3. Click `Inspect JSON` on a library card.

Expected proof:

- The Inspector shows normalized JSON.
- Imported/source/legacy metadata is preserved when available.
- Unsupported future roles are not activated as v0.1 roles.

## 4. Switch hierarchy graph views

Use the Graph Studio hierarchy controls.

### Full Sleeve View

Click:

```text
Full Sleeve View
```

Expected proof:

- Shows the top-level Sleeve.
- Shows NeoStacks as large top-level architecture cards.
- Connector lines may be visible between Sleeve/NeoStack architecture nodes.

### NeoStack View

Click a NeoStack card, or click:

```text
NeoStack View
```

Expected proof:

- Shows only the selected NeoStack and its NeoBlocks.
- NeoBlocks appear as attached/tiled cards.
- Internal random connector lines are not shown.

### NeoBlock View

Click a NeoBlock card, or click:

```text
NeoBlock View
```

Expected proof:

- Shows only the selected NeoBlock and its MOLT blocks.
- MOLT blocks appear as attached/tiled cards.
- Internal random connector lines are not shown.
- Runtime styling is still visible on cards.

### MOLT Block View

Click a MOLT block card.

Expected proof:

- Shows one selected MOLT block.
- Inspector shows:
  - title
  - role
  - type
  - status
  - tags
  - content
  - normalized JSON
  - legacy/source data if imported
  - runtime state
  - IR Matrix row slot when available

## 5. Resize and collapse panels

Drag the workbench split handles:

- Between Library and Graph Studio.
- Between Graph Studio and Inspector.
- Above the Compiler / Runtime drawer.

Expected proof:

- Graph Studio can be made larger.
- Left/right/bottom panel sizes change.
- Layout remains usable at desktop resolution.
- Layout persists after reload through browser localStorage.

Use each panel's `Collapse` / `Expand` button.

Expected proof:

- Left Library panel can collapse/expand.
- Right Inspector/Config panel can collapse/expand.
- Bottom Compiler/Runtime drawer can collapse/expand.

## 6. Move a card manually

In NeoBlock View:

1. Drag one MOLT block card within the canvas.
2. Confirm the card moves.
3. Confirm it shows manual layout status.
4. Click `Reset Layout` if you want to return to auto-layout.

Expected proof:

- Manual movement changes the card position.
- Runtime styling is preserved after movement.
- Reset Layout returns the view to auto-layout.

## 7. Toggle one block off

In NeoBlock View:

1. Click a MOLT block, for example `Collect Lead Fields`.
2. In Inspector, click `Toggle on/off`.

Expected proof:

- The selected block becomes grey/low opacity.
- Other active nodes remain glowing.
- Runtime state remains visible when changing views.

## 8. Compile with the real compiler

Click:

```text
Compile
```

Open the `RuntimeSpec` tab.

Expected proof:

```json
{
  "compiler": "umg-compiler",
  "source": "real"
}
```

Also verify:

- Compile completes without requiring Hermes generation.
- Off blocks are excluded or marked off in runtime artifacts.
- Active blocks remain active/glowing in the graph.

## 9. Inspect RuntimeSpec, Trace, and IR Matrix

Open drawer tabs:

- `RuntimeSpec`
- `Trace`
- `Prompt`
- `Diagnostics`
- `IR Matrix`

Expected proof:

- RuntimeSpec identifies the real compiler source.
- Trace contains compiler events.
- IR Matrix lists MOLT rows with active/off state.
- Graph active/off state agrees with IR Matrix active/off state.
- Diagnostics are visible for warnings or compiler messages.

## 10. Export Hermes packet

After compile, click:

```text
Export Hermes Packet
```

Expected proof:

The exported JSON includes:

- compiled prompt
- RuntimeSpec
- Trace
- IR Matrix
- active blocks
- model/settings metadata

The exported JSON must not include:

- API key values
- an `apiKey` field
- other local secrets

## 11. Confirm no API key is exported

Inspect the downloaded packet as plain JSON.

Pass criteria:

- Search for `apiKey` returns no field.
- Search for known local key material returns no value.
- Any UI key display is redacted.

## 12. Optional Hermes generation

If a Hermes endpoint/API key is already safely configured locally:

1. Compile first.
2. Click `Generate`.
3. Confirm output appears in the `Output` tab.

If Hermes is not configured:

- Generation should be blocked or clearly warned.
- Compile and export should still work.
- Do not invent credentials.

## Demo pass checklist

- App loads.
- Imported assets visible.
- Compose Blocks works for mobile-detailing chatbot.
- Full Sleeve View shows Sleeve/NeoStack architecture.
- NeoStack View shows selected stack contents.
- NeoBlock View shows selected block contents.
- MOLT Block View shows one selected MOLT block and inspector details.
- Resize/collapse panels work.
- Manual card movement works.
- Toggle off state is visible.
- Compile uses real `umg-compiler`.
- RuntimeSpec shows `source: real`.
- RuntimeSpec shows `compiler: umg-compiler`.
- RuntimeSpec / Trace / IR Matrix are inspectable.
- Graph and IR Matrix agree.
- Hermes packet exports.
- Exported Hermes packet contains no API key and no `apiKey` field.
