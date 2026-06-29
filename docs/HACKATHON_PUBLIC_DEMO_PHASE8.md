# Hackathon Public Demo Phase 8 — Hierarchical Runtime Visualizer

## Purpose

Phase 8 adds the public hierarchical UMG runtime visualizer from the Phase 7.5B polished landing checkpoint. It displays the actual UMG hierarchy and overlays runtime state only from real Hermes trace ingestion.

The earlier Phase 8 draft stash was inspected read-only and useful helper/component code was reconstructed manually. The stash was not applied, popped, or dropped, and the Phase 7.5B logo/header/hero/intake/multi-file polish remains preserved.

## Hierarchy

The visualizer shows:

`Sleeve → NeoStacks → NeoBlocks → MOLT`

Structure is read from the instantiated Business Automation Core Sleeve / normalized template structure, with assembly plan and compiled manifest metadata used only as supplemental context.

## Real trace-only activation rule

Structure can display before runtime. Activation/glow can only come from `UMGRuntimeVisualState`, which is populated from real Hermes trace events. No active, queued, complete, blocked, or error state is fabricated by the visualizer.

## No trace behavior

If Hermes has not run, or Hermes returns no trace, every node remains idle/off/dim. The UI explicitly says that Hermes has not run or that no runtime trace events were returned.

## Compiler trace boundary

Compiler trace is not Hermes runtime trace. Compiler trace is not applied to `UMGRuntimeVisualState` and is not used for visual activation.

## Gates

Gates are displayed as attached control-record badges. `TRG.*` / `TRG.BIZ.*` records remain gates/control records, not MOLT prompt blocks.

## ID alias matching strategy

Runtime highlighting checks local IDs, source IDs, parent/source aliases, and metadata aliases. This supports Hermes returning either UMG-local IDs or source IDs. If no IDs match, the Hermes trace timeline can still show real events while the hierarchy remains idle. The visualizer does not fabricate matches.

## Next phase

- Improve visual polish/assets.
- Add live route animation only from a real trace stream.
- Add Project Launcher template import later, outside this phase.
