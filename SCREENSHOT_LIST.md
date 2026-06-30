# Screenshot List

Use this list for the hackathon submission page, README visuals, and video editing inserts.

## 1. Basic intake page

Capture:

- UMG Studio title / landing shell
- Basic intake prompt area
- upload/paste context area if visible
- main call-to-action for generating/building a Sleeve

Purpose:

Show the entry point for users who do not know UMG internals yet.

## 2. Generated Sleeve

Capture:

- active generated Sleeve title
- generated/runtime-session status
- high-level summary of NeoStacks / NeoBlocks / capabilities

Purpose:

Show that the app produces an inspectable runtime architecture, not only a text answer.

## 3. Library Browser with MOLT blocks

Capture:

- Library Browser panel
- visible MOLT cards
- search/tag/filter controls
- source/reuse indicators if visible
- MOLT detail panel if available

Purpose:

Show library-first retrieval, MOLT detail recovery, and searchable cognitive building blocks.

## 4. System Sleeve view

Capture:

- Runtime Graph or hierarchy view showing the full Sleeve/System structure
- NeoStack clusters if visible
- overall graph/hierarchy layout

Purpose:

Show the complete cognitive container.

## 5. NeoStack view

Capture:

- selected NeoStack
- contained NeoBlocks
- labels or detail drawer if visible

Purpose:

Show that large workflows are divided into functional lanes.

## 6. NeoBlock view

Capture:

- selected NeoBlock
- its MOLT layers or capability declarations
- related Gates if visible

Purpose:

Show the work-unit level of the architecture.

## 7. Runtime Path view

Capture:

- Runtime Observer / Runtime Path / trace area
- compile/run status
- any trace event list or path display

Purpose:

Show the bridge from architecture to runtime execution.

## 8. Native Hermes action bridge result

Capture:

- Runtime Execution Mode selector
- selected Direct mode
- result panel with:
  - status executed
  - externalActionTaken true
  - createdFiles path
  - stdout/stderr summary if visible
  - trace event count/list

Purpose:

Show real native Hermes execution through UMG.

## 9. Desktop file proof

Capture:

- Windows desktop or file explorer with `umg-hermes-native-test.txt`
- file open showing content:

```text
hi im hermes from UMG
```

Purpose:

Show filesystem proof of native action execution.

## 10. Terminal proof if useful

Capture:

```bash
test -f /mnt/c/Users/Magne/OneDrive/Desktop/umg-hermes-native-test.txt && tr -d '\r' < /mnt/c/Users/Magne/OneDrive/Desktop/umg-hermes-native-test.txt
```

Expected output:

```text
hi im hermes from UMG
```

Purpose:

Give reviewers a concise verification shot if desktop capture is hard to read.

## 11. Optional architecture slide

Capture or render a simple hierarchy line:

```text
Sleeve → NeoStack → NeoBlock → MOLT → Gate → Capability → MetaMOLT Tool Block
```

Purpose:

Help the reviewer understand the terminology in one frame.

## 12. Optional limitations slide

Capture from `KNOWN_LIMITATIONS.md` or render a small slide with:

- approval continuation UI needs polish
- Website Builder deferred
- PDF/DOCX/OCR deferred
- source-library promotion deferred
- Runtime Graph native activation polish pending

Purpose:

Keep claims honest and credible.
