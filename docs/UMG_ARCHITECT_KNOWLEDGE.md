# UMG Architect Knowledge

Phase 13A defines the Studio-side knowledge contract for building real UMG Sleeves. It is not a Hermes global skill install and does not write to Hermes config.

## 1. UMG hierarchy

- Sleeve: complete operating package for a goal/domain. It contains governance, NeoStacks, runtime settings, outputs, and compile/runtime metadata.
- NeoStack: domain or workflow layer inside a Sleeve. It groups related NeoBlocks and constrains their purpose.
- NeoBlock: self-contained cognitive unit inside a NeoStack. It binds MOLT content roles and may be governed by Gates.
- MOLT block: modular prompt/cognition content bound to a role such as Directive, Instruction, Subject, Primary, Philosophy, or Blueprint.
- Gate/control record: Trigger/Gate metadata that controls activation, review, approval, routing, or safety. Gates are not MOLT prompt blocks.
- Tool/capability declaration: a named capability the architecture may need later. It is not execution. Architect Mode only declares capabilities.
- Runtime trace event: real Hermes runtime event used after compile/runtime to overlay state. Compiler trace is not Hermes runtime trace.

## 2. Current supported core MOLT roles

- Trigger / Gate control records: control activation or review; render as Gates, not prompt content.
- Directive: what the module must do.
- Instruction: how the module operates.
- Subject: domain data, topic, record, or constraint focus.
- Primary: governance value or high-level priority.
- Philosophy: strategic framing and decision posture.
- Blueprint: output structure, workflow pattern, or implementation shape.

## 3. Legacy / extended role normalization

Legacy uploaded Sleeves can use broader role abbreviations. Normalize them conservatively:

- TRG -> Gate / Trigger control record.
- STRAT -> Strategy guidance; map to Philosophy, Blueprint, or Directive metadata depending context.
- AIM -> Objective; map to Directive or Primary objective metadata.
- NEED -> Prerequisite; map to Gate, ApprovalPoint, or Subject constraint.
- USE -> Scenario/context pattern; map to Blueprint or use-case metadata.
- DIR -> Directive.
- INST -> Instruction.
- SUBJ -> Subject.
- PHIL -> Philosophy.
- BP -> Blueprint.
- PRIM -> Primary / Governance layer.

## 4. Sleeve design rules

- A Sleeve is a complete operating package, not a label or template selection.
- Every generated Sleeve must be unique to the user goal.
- Templates are seeds, not final architecture unless explicitly chosen.
- A good Sleeve has governance values, domain NeoStacks, coherent NeoBlocks, MOLT role coverage, Gates, tool/capability declarations, and output Blueprints.
- NeoBlocks should be self-contained but constrained by parent NeoStack and Sleeve directives.
- Reused MOLT blocks are valid when locally bound and explained.
- Generated NeoStacks, NeoBlocks, MOLT blocks, Gates, and Sleeves are draft-only until reviewed and accepted.

## 5. Real generation sequence

1. Understand user goal.
2. Extract domain, workflow, actors, tools, data, decisions, risks, approvals, and outputs.
3. Search existing local/library blocks semantically.
4. Reuse strong matches and explain why they matched.
5. Identify missing capabilities.
6. Generate draft-only missing blocks.
7. Assemble a unique Sleeve candidate.
8. Validate composition health and role coverage.
9. Compile only after a clear candidate exists.
10. Send to Hermes for runtime only after compile.

## 6. Phase 13A Architect Mode boundary

Architect Mode is a planning layer before CompileCandidate. It can produce a SleeveArchitectPlan, semantic block matches, draft-only generated blocks, and import audits. It must not mutate the source library, call Hermes, call the compiler, execute tools, fabricate trace events, or create active runtime visual state.
