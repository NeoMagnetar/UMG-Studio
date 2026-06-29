# Hackathon Public Demo Phase 7.5 — Landing UX Brand Polish and Multi-File Intake

## Recovery note

Before this landing polish, the uncommitted Phase 8 hierarchical runtime visualizer draft was preserved in git stash. A recovery patch backup was also stashed so Phase 8 draft work is not lost and was not committed during this pass.

## Purpose

Phase 7.5 is a focused public landing UX and brand polish pass. It does not change compiler, Hermes runtime, analyzer, template, block matching, Business Automation Core, assembly, or CompileCandidate behavior.

## Phase 7.5B canonical visual target

Phase 7.5B treats `http://localhost:5173/` as the canonical browser target when checking the public landing view. The alternate `127.0.0.1:5177` view may be backed by a different/stale Vite process and is not used as acceptance evidence for this polish pass.

Phase 7.5B also narrows the landing frame to a centered ~1020px target, keeps the header reduced to UMG logo plus `Open Studio Editor`, makes the hero title gold-dominant and sharp, preserves the tri-color intake outline, and removes glow/text-shadow from chips and compact buttons so first-screen labels remain crisp.

## Logo asset behavior

The header uses `/assets/umg-logo.svg` when present. The asset was copied into `public/assets/umg-logo.svg`; `public/assets/umg-lockup.svg` was also copied for future use.

## Brand tokens

The landing CSS uses local UMG token values:

- void: `#050508`
- surface: `#0A0A14`
- elevated: `#111128`
- border: `#1E1E3A`
- pink: `#FF2D9C`
- green: `#00FFB2`
- blue: `#2D8FFF`
- gold: `#F5C842`

No remote fonts were added. The CSS uses fallback stacks for Orbitron, Rajdhani, and Share Tech Mono.

## Header

The first-screen header now has the logo on the left and one action on the right: `Open Studio Editor`. Debug Mode remains available inside Studio.

## Hero

The hero title remains `UNIVERSAL MODULAR GENERATION`, styled with a readable gold metallic gradient and subtle pink/green/blue accents. The duplicate eyebrow was removed; the subtitle below the title remains `Agentic Modular Cognition`.

Hero copy:

> Upload a workflow, business process, or agent plan. UMG maps it into modular cognitive architecture for Hermes-ready execution and runtime traceability.

## Background and intake

The binary/matrix visual language is not used. The landing uses black/near-black surfaces with subtle neon borders. The intake panel uses a tri-color neon outline and no blue background wash.

## Input labels

- Main Prompt
- Paste Context
- Attach Files

## Multi-file attachment behavior

The file picker accepts multiple local files. Selected files are stored in local React state as metadata only, deduplicated by name, size, and lastModified, and displayed as chips with filename, size, and `selected locally · not parsed yet`. Each chip has an X remove button, and multiple selected files show `Clear All`.

No upload, parsing, compiler call, Hermes call, or runtime trace is performed by file selection.

## Quick chips

The first-screen chips are simplified to:

- Business Automation
- Chatbot / Support Agent
- Website / Landing Page
- Custom Workflow

Display labels are mapped back to existing analyzer labels at submit time where needed; analyzer internals were not changed.
