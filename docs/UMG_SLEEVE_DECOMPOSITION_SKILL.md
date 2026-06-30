# UMG Sleeve Decomposition Skill (App-Local)

Status: Phase 13I-B app-local decomposition skill. This is not a global Hermes skill install. It prepares future Hermes custom Sleeve generation while preserving current app/compiler/runtime contracts.

## Purpose

Use this skill when converting a Custom Workflow prompt into a UMG Sleeve plan. The goal is to reason from user intent into app-aligned Sleeve structure:

- Sleeve
- NeoStacks
- NeoBlocks
- MOLT blocks
- Gates/control records
- capabilities
- reuse/generate decisions
- validation notes

Generated output is runtime-session only unless the user explicitly saves or promotes it.

## Decomposition procedure

### 1. What is this Sleeve for?

Identify the core job of the Sleeve in one sentence:

- user goal
- operating domain
- expected outputs
- constraints
- live/external actions that must remain blocked or approval-gated

Do not default to Business Automation, Chatbot, or Website Builder unless the user selected or requested that domain pack/template.

### 2. Does it need a Controller / governance / routing layer?

Decide whether the Sleeve needs:

- a controller/root coordinator
- governance/authority policy
- routing between lanes
- approval checkpoints
- blocked unsafe actions
- audit/status output

Controller/gate/governance concepts are control structures. They are not automatically prompt MOLT blocks.

### 3. What are the independent functional lanes?

Find the independent work lanes needed to satisfy the goal. Lanes should be stable domains of work, not individual form fields.

Examples:

- intake/context
- validation/eligibility
- policy/risk
- planning/decision
- communication/output
- execution preparation
- audit/reporting

### 4. Map lanes to NeoStacks

Each independent lane becomes a NeoStack when it has enough internal work to deserve a separate runtime path.

A NeoStack should have:

- one clear purpose
- ordered or related NeoBlocks
- activation/routing conditions when needed
- safe handoff boundaries

### 5. Within each lane, what are discrete operational units?

Break each NeoStack into operational units that perform one clear cognitive job.

Operational units may include:

- capture request/context
- validate record/evidence
- apply policy
- draft response
- prepare action for approval
- generate report
- route exception

### 6. Map units to NeoBlocks

Each discrete operational unit becomes a NeoBlock when it needs its own focused MOLT guidance, state, trace identity, or capability boundary.

A NeoBlock should be reusable enough to inspect and reason about, but not so broad that it hides multiple jobs.

### 7. Is this a new NeoBlock or a variable inside an existing block?

Before generating a new NeoBlock, ask:

- Is this a distinct operation or just a parameter/value?
- Could an existing block handle it with different input?
- Is this only an industry label, customer type, output format, tone, or policy variable?
- Does it need a separate trace/routing/capability boundary?

Create a new NeoBlock only when the answer shows a real operational gap.

### 8. Which MOLT roles are load-bearing?

Use only load-bearing MOLT roles. Current compiler-supported prompt MOLT roles are:

- directive
- instruction
- subject
- primary
- philosophy
- blueprint

Typical role use:

- directive: operating rule or behavior constraint
- instruction: concrete step/process guidance
- subject: domain/content focus
- primary: main output/decision objective
- philosophy: value lens, principles, reasoning stance
- blueprint: structure, schema, or implementation pattern

### 9. Avoid filling every MOLT role by default

Do not generate directive, instruction, subject, primary, philosophy, and blueprint for every NeoBlock unless each role is actually needed.

Prefer fewer, clearer load-bearing MOLT bindings over noisy complete sets.

### 10. Library-first, generate-second

Before generating new cards:

1. Search loaded/local/library blocks available to the app.
2. Reuse matching blocks when they fit the role and purpose.
3. Modify or wrap existing blocks when the gap is small.
4. Generate new MOLT/NeoBlocks/NeoStacks only for real gaps.

### 11. Generate only for real gaps

Generated content must declare:

- why no existing block was enough
- whether it is draft/runtime-session only
- sourceLibraryWrite: false
- needsUserReview: true when appropriate
- confidence/warnings

### 12. Check authority/governance consistency

Before compiler handoff, check:

- Who has authority to decide?
- Which actions require approval?
- Which actions are blocked?
- Which outputs are drafts vs final artifacts?
- Which tools are app-local safe vs external connectors?
- Does any generated block imply external execution that the app cannot perform?

### 13. Gates are control/routing/approval records

Gates represent control, routing, approval, safety, or boundary logic.

They are not prompt MOLT blocks. They should map to app gate/control records and runtime trace events where supported.

### 14. Trigger/gate/governance roles require careful mapping

Legacy or uploaded bundle roles like trigger, gate, governance, contract, standard, or other optional meta roles must be mapped to current app reality:

- trigger-like behavior -> gate/control record when supported
- governance -> primary/governance summary or gate/control metadata, depending on use
- approval -> capability/gate/approval point
- routing -> gate/control metadata or execution route
- unsupported prompt role -> warning or validation failure, not silent compiler input

### 15. Output must be app-aligned

Future Hermes custom Sleeve generation should return app-aligned structured data that can map to current types.

Runtime-session Sleeve shape:

- id
- title
- version
- description
- isTemplate: true
- templateKind: custom unless a template/domain pack is explicitly selected
- source: session or planned
- tags
- neoStacks
- neoBlocks
- moltBlocks
- gates
- governanceBlockIds
- defaultExecutionMode
- metadata

NeoStack shape:

- id
- title
- description
- stackOrder
- tags
- neoBlockIds

NeoBlock shape:

- id
- title
- description
- neoStackId
- blockOrder
- tags
- moltBlockIds
- gateIds
- defaultState
- runtimeState optional

MOLT shape:

- id
- sourceId optional
- title
- role: directive | instruction | subject | primary | philosophy | blueprint
- content
- tags
- parentNeoBlockId optional
- parentNeoStackId optional
- sourceNotes optional
- defaultState

Current compiler contract wins. Uploaded bundle card schemas are authoring/import schemas and must not be fed directly to the compiler.

### 16. Generated output is runtime-session only

Generated Sleeves, NeoStacks, NeoBlocks, MOLT blocks, gates, and capabilities are runtime-session draft state unless the user explicitly saves/promotes them.

Rules:

- no source-library mutation by default
- no global Hermes skill install
- no Website Builder import unless explicitly requested
- no external tool/API action execution
- no claim of verified source-library status for generated draft records

## Required decomposition output notes

A future Hermes custom Sleeve response should include:

- reuseDecisions: what existing blocks/stacks were reused and why
- generatedDecisions: what was generated and why
- warnings: unsupported roles, connector gaps, governance ambiguity, compiler risks
- validationNotes: app/compiler alignment notes
- capabilities: declarations only; execution resolved later by app registry

## Failure conditions

Reject or warn when:

- a generated MOLT uses unsupported compiler roles
- gates are represented as prompt MOLT blocks
- Website Builder/Web Creation is activated without explicit import/selection
- bundle JSON card schema is treated as direct compiler input
- generated content implies source-library save without user approval
- external Gmail/browser/refund/inventory/API actions are implied or executed
