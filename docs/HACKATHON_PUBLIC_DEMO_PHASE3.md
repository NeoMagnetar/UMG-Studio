# Hackathon Public Demo Phase 3

## Purpose

Phase 3 connects the public UMG intake shell to real typed analysis and template Sleeve selection. It converts local public intake values into:

1. `BusinessInput`
2. `BusinessMap`
3. `TemplateSelectionResult`

This is the bridge from public intake toward later block matching, missing block generation, Sleeve assembly, compile-to-Hermes manifest, Hermes runtime execution, and live cognitive trace visualization.

## Data flow

Public Intake → BusinessInput → BusinessMap → TemplateSelectionResult

The analyzer is deterministic and local. It uses submitted prompt text, pasted document/context text, selected quick chip, selected filename, and transparent keyword heuristics. Hermes is not called.

## No fake generation rule

This phase does not generate a fake Sleeve, fake NeoStack, fake NeoBlock, fake MOLT block, fake Hermes runtime result, or fake trace/replay. Template selection is metadata-only and the UI explicitly reports that block matching and Sleeve assembly are next-phase work.

## Templates are Sleeves

Templates are represented as Sleeve-compatible metadata summaries with `isTemplate: true`, `templateKind`, capabilities, use cases, and reusable NeoStack summary metadata where available. There is no separate alien template object model beyond metadata around template Sleeves.

## Triggers are gates

`TRG.*` records remain gate/control semantics. Future full template imports should attach triggers to Sleeve, NeoStack, NeoBlock, MOLT role groups, or tools. Triggers are not ordinary MOLT prompt blocks. `CON.*` and `VER.*` style records remain future gate-policy or MetaMOLT candidates, not new first-class block types in this phase.

## Built-in seed metadata only

The catalog includes built-in seed metadata for:

- Business Automation Consultant — partial template Sleeve metadata for the later 8 NeoStack / 48 NeoBlock / 192 MOLT full source import.
- Project Launcher — partial template Sleeve metadata for the later 7 NeoStack / 26 NeoBlock / 70 MOLT full source import.

The full template Sleeves are not imported, no permanent library records are created, and source library JSON is not mutated.

## Planned templates

Website Builder, Chatbot, Research Agent, and Custom Workflow are planned/relevant metadata entries. They can be surfaced as relevant but are not represented as complete available Sleeves.

## Next phase

1. Business Automation Lite template normalization into actual Sleeve structure
2. Block matching and missing block generation
3. Sleeve assembly
4. Compile-to-Hermes runtime manifest
5. Live Hermes trace visualizer
