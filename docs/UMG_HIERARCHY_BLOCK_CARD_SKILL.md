# UMG Hierarchy + Block Card Skill (App-Local)

Status: Phase 13I-B app-local knowledge. This document is not a global Hermes skill install. It is authoring and decomposition guidance for UMG Studio and Hermes requests that operate inside the app.

## Purpose

This skill teaches Hermes and UMG Studio how to talk about UMG hierarchy, block cards, scoped Domain Packs, and source-evidence boundaries before custom Sleeve generation. It does not replace the current app, compiler, or runtime schemas.

## Canonical hierarchy

1. MOLT block
   - Smallest prompt/cognition card.
   - Carries focused role-bound guidance.
   - Current compiler-supported prompt roles are directive, instruction, subject, primary, philosophy, and blueprint.
   - Trigger, gate, governance, approval, and routing concepts must be mapped carefully to app control records, not blindly treated as prompt MOLT blocks.

2. NeoBlock
   - A discrete operational cognition unit.
   - It binds a small set of load-bearing MOLT roles around one job.
   - It should not be created for a mere variable, field, or parameter that belongs inside an existing block.

3. NeoStack
   - A functional lane inside a Sleeve.
   - It groups related NeoBlocks and constrains their purpose, order, route, and handoff.

4. Sleeve
   - The runtime-session operating package for a user goal.
   - It contains NeoStacks, NeoBlocks, MOLT bindings, gates/control records, capabilities, compile metadata, runtime metadata, and outputs.

5. Template
   - A reusable Sleeve pattern.
   - Templates may instantiate runtime-session Sleeves without saving generated content to the source library.

6. Domain Pack
   - A walled package of templates, NeoStacks, NeoBlocks, internal MOLT cards, and import rules for a domain.
   - Domain Packs should not flood global MOLT libraries with scoped/internal implementation cards.

## Block card NL format summary

Natural-language UMG cards should preserve the hierarchy level explicitly.

Recommended top fields:

- Card version
- ID
- Kind: MOLT, NeoBlock, NeoStack, SleeveTemplate, or DomainPack
- Name/title
- Status
- Scope: global, template, domain_pack, internal, or runtime_session
- Category/tags
- Description/purpose
- Inputs/outputs or children
- Routing/activation notes
- Visibility
- Validation/evidence notes
- Source

NL cards are editable human-facing projections. They are not automatically compiler input.

## JSON card concept summary

JSON cards are structured authoring/import records for UMG card libraries and inspectors. They may include fields such as:

- schemaVersion
- id
- kind
- name
- status
- scope
- category
- tags
- description
- visibility
- validation
- source
- MOLT-specific content/role fields
- NeoBlock internalMolts / externalRefs / mixingPolicy fields
- NeoStack neoBlocks / executionOrder / activationRules fields
- SleeveTemplate stacks / defaultComposition / compileBehavior fields
- DomainPack namespace / isolationPolicy / importPolicy fields

Important alignment rule: uploaded bundle JSON schemas are authoring schemas, not direct UMG compiler input schemas. Current app/compiler/runtime schemas remain authoritative.

## Visible card vs scoped/internal child distinction

Visible cards:

- MOLT cards that belong in the global/library view.
- NeoBlocks visible in the NeoBlock library/inspector.
- NeoStacks visible in the NeoStack/template flow.
- Templates visible in start/template flows.
- Domain Packs visible in domain-pack lanes or tag filters.

Scoped/internal children:

- Internal MOLT children of a Domain Pack or NeoBlock may stay hidden/lazy.
- They should expand only for inspector, compile, export, or explicit review behavior.
- They should not be globally imported just because their parent Domain Pack exists.

## Source evidence labels

Use these labels consistently:

- verified: inspected directly from current app state, compiler result, runtime trace, or trusted source file.
- generated: created by the current runtime/session as draft or ephemeral content.
- claimed: stated by a user, prompt, external document, or model without verification.
- runtime-session: active only inside the current UMG Studio session unless explicitly saved/promoted.

Generated and claimed records must not be presented as verified source-library records.

## Domain Pack walling rules

Domain Pack import and composition must preserve walls:

- Import templates, NeoStacks, and NeoBlocks as visible parent structures when explicitly requested.
- Keep internal MOLT children scoped/lazy by default.
- Do not globally flood MOLT libraries with internal Domain Pack cards.
- Expand internal MOLT children only for inspector, compile, export, or explicit review.
- Allow cross-library mixing only when explicit and app-validated.
- Preserve source path, namespace, and import policy metadata.
- Generated runtime-session content does not mutate the source library.

## Website Builder / Web Creation boundary

Website Builder / Web Creation is a future scoped Domain Pack, not the default Custom Workflow mode.

Boundary rules:

- Website Builder should remain greyed/scoped until explicitly imported.
- Web Creation templates, NeoStacks, and NeoBlocks may become visible after import.
- Web Creation internal MOLT children remain scoped/lazy.
- No global MOLT flooding from Web Creation.
- Explicit cross-library mixing only.
- Do not start Website Builder import from generic Custom Workflow work.

## App alignment note

This document is app-local authoring/decomposition knowledge.

Current app/compiler/runtime contracts win:

- NormalizedTemplateSleeve and related app types define runtime-session Sleeve shape.
- UMGCompilerRequest defines current compiler input shape.
- UMGCompiledRuntimeManifest defines current compiled runtime manifest shape.
- UMGTraceEvent and runtimeGeometryProjection define current trace/geometry behavior.
- HermesToolCapabilityRegistry and toolCapabilityResolver define current capability boundaries.

Do not feed uploaded bundle schemas directly into the compiler. Convert through app-aligned adapters and validators only.
