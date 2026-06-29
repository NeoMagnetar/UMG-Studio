# UMG Studio Hackathon Phase 4 — Business Automation Core Sleeve Normalization

## Purpose

Phase 4 creates the first usable built-in template Sleeve structure inside UMG Studio: Business Automation Consultant Core v1.

This phase moves beyond template metadata selection, but it is still not Hermes runtime execution, block matching, missing block generation, compile-to-Hermes, or trace visualization.

## Normalized template identity

Templates are Sleeves. Business Automation Consultant Core is represented as a Sleeve with metadata:

- `isTemplate: true`
- `templateKind: business`
- `source: built_in_seed`
- `defaultExecutionMode: liveAllowed`

The in-app normalized Sleeve id is:

- `sleeve.business_automation_consultant.core.v1`

## Source target scale

The uploaded/source target for the full Business Automation Consultant template contains:

- 8 NeoStacks
- 48 NeoBlocks
- 192 source records

## Normalized interpretation

Phase 4 normalizes the source intent into:

- 8 NeoStacks
- 48 NeoBlocks
- 144 normalized MOLT content blocks
- 48 Trigger/Gate control records

TRG.BIZ.* records become gates/control records. They are not MOLT prompt blocks and are not included in MOLT role lists.

CON.* and VER.* remain future gate-policy or MetaMOLT candidates.

## Governance Primary blocks

Eight PRIM.BIZ.* governance values are normalized as sleeve-level Primary MOLT blocks:

1. Client Success Over Feature Complexity
2. Cost Consciousness and ROI Focus
3. Privacy and Data Security First
4. Progressive Rollout and Training
5. Business Domain Understanding Required
6. Sustainable and Maintainable Systems
7. Measurable Impact and Reporting
8. Ethical Automation Boundaries

## Gate defaults and block defaults

- Blocks default off/dim.
- Gates default closed.
- Gate runtime state defaults inactive.
- No block is marked runtime-active by template instantiation.

## No fake runtime rule

Phase 4 does not add fake Hermes runtime, fake trace playback, or static trace events. Studio does not directly execute arbitrary tools. Hermes remains the user-authorized execution layer for later phases.

## Protected library rule

The normalized core template lives under UMG Studio source files only. It does not mutate source library JSON and does not modify protected repositories.

## Next phases

1. Block matching and missing block generation.
2. Compile-to-Hermes manifest from the normalized Sleeve.
3. Real Hermes runtime visualizer using actual Hermes trace/result payloads.
