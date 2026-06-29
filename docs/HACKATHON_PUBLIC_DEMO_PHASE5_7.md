# UMG Studio Hackathon Phase 5.7 — Public UI Nuclear Reset Minimal Demo Page

## Why the previous visual pass was rejected

The Phase 5.5/5.6 public landing repair attempts were rejected because rendered screenshots still showed clipped or hidden hero text, overlapping cards, and a public shell that was not demo-safe at 1366x768. Those reports were based on code structure instead of rendered output.

## Nuclear reset approach

Phase 5.7 preserves the failed public UI patch under `docs/recovery/`, restores tracked files back to the known Phase 5 baseline, removes the failed public landing docs/components, and introduces one isolated minimal landing page:

- `src/components/HackathonLandingPage.tsx`
- `src/components/HackathonLandingPage.css`

The public mode now delegates to this component for the landing surface. The page is intentionally simple: header, hero block, intake card, pipeline strip, status row, and a results section below all of it.

## Layout rules

- no old public shell class names in the new component
- no `publicHero`, `publicDeck`, or `publicShell` markup rendered in public mode
- no right-column hero cards
- no hero art card
- no ghost/backdrop title
- no vertical title
- no absolute layout
- no overlay cards
- no transform positioning
- no missing asset URLs

## Minimal demo-safe target

The acceptance target is a clean one-column public page at 1366x768:

- title visible
- intake visible
- pipeline visible or naturally below the fold
- no horizontal scroll
- no clipped hero
- no panels covering hero text

## Phase 5.7A viewport-fit start screen

Phase 5.7A changes the initial public landing requirement from a clean scrollable page to a one-screen viewport-fit start page. At the 1366x768 target, the first impression should show the compact header, hero, prompt/context intake, file line, quick chips, start button, pipeline, and status summary without requiring body/page scroll.

After the user starts cognition upload, the review/result panels may appear below the first screen and the page may scroll for review/workspace content. The no-scroll requirement applies to the initial pre-submit landing screen.

## No logic/compiler/Hermes changes

This phase does not change analyzer logic, template selection, Business Automation Core creation, block matching, missing drafts, assembly planning, CompileCandidate behavior, Studio/editor behavior, Debug Mode, Clear Graph, tile canvas, MOLT Blocks, compiler connection, Hermes calls, fake runtime, or fake trace/replay.
