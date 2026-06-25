# UMG Studio Layout vNext Product/Design Spec

Version target: vNext design pass following checkpoint `7e02ff1a11d65d0f2a5f62991f8a1f45b95c50f3`

## 1) Current Layout Problems
- Graph appears too small and loses spatial context at common viewport sizes.
- Too many panels are visible by default, causing visual noise and constant competition for attention.
- Export actions in the graph header are visually noisy and distract from graph interaction.
- Bottom runtime drawer frequently competes with graph space and reduces usable canvas.
- Graph hierarchy is hard to read; parent/child relationships are ambiguous.
- Nodes do not feel like first-class UMG containers (insufficient container affordance, weak boundaries).
- Snapping/containment behavior is inconsistent and does not communicate valid drop targets.
- Inspector is often low-value or effectively empty for many selection states.

## 2) Design Principles
UMG Studio vNext should feel:
1. **Canvas-first**: graph and structure are primary; supporting panes are secondary.
2. **Hierarchy-aware**: topology and container boundaries are always visually explicit.
3. **Simple by default**: minimal controls until intent requires depth.
4. **Sophisticated on demand**: detailed controls appear in contextual modes/states.
5. **Not an AI-slop website**: deterministic structure-first interactions; AI actions are clear and optional.

## 3) Proposed Top-Level Modes
### Recommended mode model
Use **3-mode** setup (simpler and lower cognitive load):
- **Compose**: block authoring, palette, selection/edit flow.
- **Canvas**: graph-first workspace for hierarchy editing and navigation.
- **Runtime**: inspect spec/state and output, debug traces, and diagnostics.

Notes:
- `Library` and `Debug` are valuable labels but should become **sub-tabs/sections**, not top-level modes.
- This preserves a short information architecture and avoids mode fragmentation.

## 4) Canvas Views (Semantic Graph Modes)
Each view is persistent in **Canvas** mode with quick-toggle tabs.

### Full Sleeve
- **Visible:** active sleeve context, sleeve boundary, nested stacks, blocks, gates, global graph chrome.
- **Hidden:** deep runtime metadata columns, raw traces, raw matrix exports, verbose compile diagnostics.
- **Supports:** broad structure operations: add/move/remove/resize containers, mode switching across hierarchy levels.

### NeoStack View
- **Visible:** only selected sleeve stack(s) with children; expanded stack internals and sibling alignment.
- **Hidden:** unrelated sleeves and non-adjacent branches.
- **Supports:** stack-level composition and sequencing, relative ordering, reordering.

### NeoBlock View
- **Visible:** selected NeoBlock container and its direct children; clear child boundaries and containment.
- **Hidden:** full sleeve cross-links, unrelated stacks, runtime side panels.
- **Supports:** local block shaping, child insertion, block-specific actions.

### MOLT View
- **Visible:** selected MOLT chains and direct transitions.
- **Hidden:** cross-workspace/runtime metadata.
- **Supports:** flow ordering, MOLT-level edits, quick move/insert along chain.

### Gate View
- **Visible:** gate surfaces, trigger/evaluation points, incoming/outgoing edge intent indicators.
- **Hidden:** non-gate node internals and unrelated branch details.
- **Supports:** gate wiring, trigger condition checks, branch visibility.

### Runtime Trace View
- **Visible:** active trace timeline, currently selected IR rows, emitted packets/events.
- **Hidden:** full editor editing controls and export clutter.
- **Supports:** inspection and replay of execution path (read-only).

For each view: all non-relevant controls collapse to compact state; focus stays on the active hierarchy.

## 5) Hierarchical Snapping Model
Define canonical containment rules:
- **MOLT** → snaps into **NeoBlock**
- **NeoBlock** → snaps into **NeoStack**
- **NeoStack** → snaps into **Sleeve**
- **TriggerGate** → snaps to node boundary or incoming/outgoing edge lane (never into wrong container)

Behavior:
- Drag interactions show **ghost drop zones** (animated valid container/edge targets).
- During drag, blocked invalid targets are visually disabled.
- Dropping into valid target triggers explicit placement preview + confirm-state.
- **Never silently mutate prompt/content on drag/drop**; only structural graph metadata updates.

## 6) Graph Header Cleanup
- Replace multiple export controls with single menu:
  - `Export ▾`
    - Sleeve JSON
    - IR Matrix
    - Glyph Matrix
    - Hermes Packet
    - Workspace
- Remove high-frequency decorative/header actions not tied to graph interaction.
- Export command set should remain keyboard/assistive accessible and state-aware.

## 7) Inspector Behavior (Contextual States)
Single inspector panel with state-specific content:
- **No selection**: show composition guidance + current mode + quick actions.
- **MOLT selected**: show content/edit fields, next/prev linkers, movement constraints.
- **NeoBlock selected**: show contained children summary, apply/revoke block-level constraints.
- **NeoStack selected**: show order operations, sequencing tools, bulk visibility toggles.
- **Sleeve selected**: show sleeve-level metadata, active graph filters, export shorthand.
- **Gate selected**: show trigger condition + branch mapping + edge annotations.
- **Runtime item selected**: show selected row details, timestamp, packet summary, source trace path.

Default inspector should avoid empty placeholders; when no meaningful fields exist show context actions instead.

## 8) Runtime Drawer Behavior
- Drawer is **collapsed by default**.
- Expand on explicit intent (runtime tab use / trace inspect / output review).
- Tabs:
  - RuntimeSpec
  - Trace
  - IR Matrix
  - Glyph Matrix
  - Output
- Include pin/unpin control:
  - **Pinned**: persistent docked for continuous inspection.
  - **Unpinned**: auto-hide/collapse on idle.
- Drawer should **not steal graph space unless expanded**; expansion can be overlaid or reserved with smooth, minimal width shift only while in Runtime view.

## 9) Implementation Phases
### Phase 1 — Layout shell + export menu cleanup
- Introduce 3-mode shell.
- Collapse non-essential panes.
- Replace export clutter with `Export ▾` menu and stable command order.

### Phase 2 — Full canvas/focus mode + semantic view tabs
- Add Canvas-first focus model.
- Implement Full Sleeve / NeoStack / NeoBlock / MOLT / Gate / Runtime Trace tabs.
- Preserve existing generate/compile compatibility in non-graph interactions.

### Phase 3 — Contextual inspector polish
- Implement state mapping above with empty-state fallback guidance.
- Prioritize high-signal content per selection type.

### Phase 4 — Snapping/containment
- Implement visual ghost drop zones and explicit hierarchy rules.
- Add valid/invalid target feedback and prevent invalid parenting.

### Phase 5 — Gate overlay + runtime trace polish
- Improve gate affordance and edge snapping.
- Stabilize runtime tabs and output activation behavior.
- Tune drawer pinning + non-intrusive expansion.

## 10) Non-Goals
- No route switching.
- No live execution.
- No ActionGate execution.
- No compiler prompt-content mutation.
- No provider/Hermes changes.
- No Trigger MOLT blocks.
