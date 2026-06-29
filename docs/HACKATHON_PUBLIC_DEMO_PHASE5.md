# UMG Studio Hackathon Phase 5 — Block Matching, Missing Drafts, and Assembly Plan

## Purpose

Phase 5 connects the Phase 3 BusinessMap and Phase 4 Business Automation Core Sleeve to a real deterministic preparation pipeline:

BusinessMap + Business Automation Core Sleeve
→ BlockMatchPlan
→ MissingCapability[]
→ GeneratedBlockDraft[]
→ SleeveAssemblyPlan
→ CompileCandidate

This is still not Hermes runtime execution, not a fake compile, and not a fake trace/replay.

## Reuse before generate

The matcher reuses existing template Sleeve structure first:

- matched Sleeve
- matched NeoStacks
- matched NeoBlocks
- matched MOLT content blocks
- matched gates/control records

Generated drafts only appear when the local detector finds a specific need that is not directly covered by the matched Business Automation Core blocks.

## Generated drafts are draft-only

GeneratedBlockDraft records are deterministic local proposals. They start as:

- saveState: draft
- needsUserReview: true
- accepted: false
- defaultState: off

User review controls may accept a draft into the local assembly plan or discard it. Drafts are not saved to the source library and are not claimed to be reusable library blocks.

## Missing capability detection

Phase 5 detects honest gaps for:

- concrete tool/integration requests such as Gmail, Calendar, Sheets, Notion, Airtable, CRM, Shopify, Etsy, Stripe, QuickBooks, Square/POS, WhatsApp, SMS/Twilio, Telegram, Slack, Discord, Buffer/Hootsuite/Later
- planned template gaps such as website, chatbot, research, or DevOps/project launcher work
- regulated/sensitive domain policy gaps such as healthcare, therapy, legal, or financial advice

If Business Automation Core covers the workflow category but not the concrete tool integration, the detector records a missing capability rather than assuming execution is available.

## SleeveAssemblyPlan

SleeveAssemblyPlan selects matched stacks, blocks, MOLT content, gates, and accepted drafts. It keeps:

- activeStates false
- disabledStates false unless a draft is discarded
- gates closed/inactive
- blocks off/dim
- compileStatus compile_ready only when the candidate has selected stack/block/MOLT content

The execution order is proposed for the future compiler/runtime and is not runtime execution.

## CompileCandidate

CompileCandidate is a compiler input candidate, not a compiled runtime manifest.

It does not include a compiledPrompt, does not claim compiler success, and carries the warning:

- CompileCandidate has not been processed by the real compiler yet.

## No fake runtime rule

Phase 5 does not call Hermes, does not fake Hermes runtime, does not fake trace playback, and does not fake compile output. Studio continues to prepare structured data; Hermes remains the user-authorized execution layer for later phases.

## Trigger/Gate semantics

TRG.BIZ.* records remain gates/control records, not ordinary MOLT prompt content. Gates are matched separately from MOLT blocks and remain closed until a real runtime opens them.

## Next phase direction

Next phases should connect this compile candidate to the real compiler, produce a real compiled runtime manifest, create a Hermes request, and visualize actual Hermes trace/result data.
