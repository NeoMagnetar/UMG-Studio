# Phase 11A — NeoBlock MOLT Slot Contract and Layout Semantics Audit

## Purpose

Phase 11A documents the preferred composition contract for executable NeoBlocks and the visual semantics needed to keep assembled Sleeves understandable to Hermes and to users.

This is an audit/design checkpoint. It does not mutate source library JSON, does not change runtime activation, does not fabricate trace events, and does not alter compiler or Hermes bridge behavior.

## NeoBlock Composition Contract

An executable NeoBlock should be mostly self-contained, role-clear, and constrained by higher-level context. The preferred slot contract is:

- one active Directive source
- one active Instruction source
- one active Subject source
- one active Primary source, either local to the NeoBlock or inherited from a NeoStack/Sleeve governance scope
- optional Philosophy, preferably inherited from NeoStack/Sleeve unless the NeoBlock needs a block-specific philosophy
- optional Blueprint, required when the output format, artifact shape, or handoff format matters
- Gates as control records, not MOLT prompt blocks

## Warning Classes

Composition validators should warn, not mutate or block compilation by default, for:

- missing Primary
- missing Directive
- missing Instruction
- missing Subject
- multiple active Directives
- multiple active Instructions
- reused MOLT without contextual binding
- NeoBlock has no unique output compared to siblings
- gate exists but no controlled NeoBlock
- MOLT role conflicts with parent NeoStack purpose

The Phase 11A validator is intentionally audit-only. It must not:

- alter source blocks
- save anything to the library
- change runtime activation
- block compile unless a later phase explicitly configures compile blocking

## MOLT Reuse Model

MOLT block reuse is allowed and expected. A strong MOLT can serve multiple NeoBlocks or NeoStacks when the reuse is intentional and context-bound.

Every reused MOLT slot should eventually carry local binding metadata:

- reusedBlockId
- localSlotRole
- parentNeoBlockId
- bindingReason
- inheritedFrom, when inherited from NeoStack/Sleeve governance
- localOverride, when the local NeoBlock adapts the reused MOLT

This lets Hermes know the current NeoBlock's job even when the same reusable MOLT appears in another block or stack.

## Layout Semantics Note

Current visual views often render cards as equal rows. That is acceptable for library/index mode, but orchestration mode needs richer semantics:

- Sleeve view should distinguish sequence, phase, or dependency when available.
- NeoStack cards can remain equal in library/index mode, but orchestration mode should show phase or dependency.
- NeoBlock view should support frame/sector/module/unit grouping.
- NeoBlocks inside a NeoStack should eventually show core/dependency/execution/follow-up relationships rather than always equal row layout.
- Gates should appear as controls on edges or block headers, not as ordinary MOLT content.

## Business Automation Core Phase 11A Findings

The current built-in Business Automation Core is structurally safe for runtime proof because gates remain controls and runtime activation still comes only from real Hermes trace events.

Audit highlights:

- each NeoBlock has one local Directive, one local Instruction, and one local Subject
- Primary values are inherited from Sleeve governance rather than attached locally
- most NeoBlocks do not have a local Blueprint; this is acceptable only while output-shape semantics are inherited or implicit
- Subject MOLT blocks are reused within each NeoStack and need explicit local binding metadata in a later phase
- governance Primary MOLT blocks are intentionally reusable and broad, but should be represented as inherited governance bindings when projected into compiled/runtime context

## Non-goals

Phase 11A does not:

- redesign the UI
- rewrite compiler bridge behavior
- rewrite Hermes bridge behavior
- change runtime visual activation rules
- import unfinished templates
- mutate source library JSON
- create fake runtime trace data
