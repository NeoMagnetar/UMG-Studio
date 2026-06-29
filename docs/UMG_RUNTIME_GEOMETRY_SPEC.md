# UMG Runtime Geometry Spec

## Status

Phase 12A defines the target geometry contract for a future live runtime cognition map. It is specification-only. It does not change compiler behavior, Hermes runtime behavior, trace mapping, or visual activation rules.

## Goal

UMG Studio should evolve from debug-heavy trace/list surfaces into a true live runtime cognition map:

- Hermes does the work.
- UMG Studio maps and shows the modular cognition while Hermes works.
- The same assembled Sleeve geometry should support static structure review and real runtime overlay.
- Runtime activation must come only from real Hermes runtime trace events.

## 1. Sleeve Geometry

A Sleeve is a complete operating package. It contains multiple NeoStacks and represents a unique arrangement of connected cognitive systems.

A Sleeve may sit on a shared foundation layer. The foundation layer can represent memory, CRM, asset library, tools, analytics, files, business systems, knowledge base, or other context infrastructure used by the Sleeve.

Sleeve-level geometry should show NeoStacks as domain systems, not random equal cards. For example, a Business Automation Sleeve can show assessment, architecture, social, operations, scheduling, finance, implementation, and optimization as distinct domain systems in one operating package.

Allowed high-level arrangements include:

- skyline-like domain systems on a shared foundation
- pyramid or tiered domain systems
- hub-and-spoke systems around a core strategy stack
- asymmetric grouped systems when the assembled Sleeve requires it

The Sleeve view should preserve top-down hierarchy while allowing local asymmetry. NeoStacks do not need to appear as identical rows or identical cards.

## 2. NeoStack Geometry

A NeoStack is a domain-level stack of connected NeoBlocks. It should support hierarchical, pyramid-like, clustered, or staged arrangement.

NeoBlocks inside a NeoStack may be grouped by semantic position:

- core/foundation
- dependency/data
- execution
- synthesis/strategy
- feedback/optimization

NeoBlocks should not always be displayed as equal same-row cards. Some may be horizontal process nodes, some may be vertical dependency nodes, and some may connect to multiple siblings.

Local layout may be asymmetric when the domain requires it. The geometry contract should support explicit or inferred relationships such as prerequisite, feeds, controls, synthesizes, follows, validates, and optimizes.

## 3. NeoBlock Geometry

A NeoBlock is a coherent task/cognition node. It should be visually understandable as a unit of work that Hermes can execute or reason through.

A NeoBlock should show:

- title
- current runtime state
- MOLT role health
- attached Gates
- tool/capability needs
- key dependency or output relationship when available

MOLT internals should be expandable and inspectable, but they should not always dominate the NeoBlock shape. The default runtime geometry should foreground the NeoBlock as the active cognition node, with MOLT roles acting as its internal contract.

Gates should appear as controls on edges, block headers, or decision bands. Gates must not be rendered as ordinary MOLT prompt content.

## 4. MOLT Binding Display

MOLT blocks may be reused across NeoBlocks and NeoStacks. Reuse is valid and expected when it is context-bound.

A reused MOLT block should not confuse Hermes or the viewer about the current NeoBlock's job. Geometry should expose local binding context when reuse affects interpretation.

Future MOLT binding records should include:

- `reusedBlockId`
- `localSlotRole`
- `parentNeoBlockId`
- `bindingReason`
- `inheritedFrom`
- `localOverride`

Display expectations:

- inherited governance or philosophy can appear as a subtle inherited band rather than repeated local content
- reused subject/context blocks should show the local NeoBlock binding reason
- local overrides should be visually distinct from inherited bindings
- reused blocks should never imply a new source-library mutation

## 5. Runtime States

Runtime geometry state names:

- `idle` — structure exists, no mapped runtime activity
- `queued` — Hermes has queued or prepared this node
- `active` — Hermes has entered or activated this node
- `processing` — Hermes is currently reasoning through or using this node
- `attention` — node needs viewer attention but is not blocked
- `waiting_approval` — Hermes is waiting for approval before continuing
- `tool_calling` — Hermes is preparing or executing a tool-capability boundary
- `blocked` — execution is blocked by a gate, policy, missing input, or unavailable capability
- `complete` — node completed from real runtime trace
- `error` — node or run errored from real runtime trace
- `unmapped` — event exists but cannot be mapped to a known UMG node

These states are visual overlay states, not source-template defaults.

## 6. Connection Types

Runtime geometry edge types:

- `hierarchy` — Sleeve → NeoStack → NeoBlock → MOLT containment
- `dependency` — one node depends on another node or output
- `execution_next` — likely or actual next execution step
- `gate_control` — Gate controls node or edge activation
- `tool_capability` — node requires or references a tool/capability endpoint
- `data_source` — node uses files, CRM, analytics, business systems, or other data source
- `memory_context` — node uses memory, knowledge base, or retained context
- `feedback_loop` — output cycles back into monitoring, optimization, or refinement
- `inheritance` — node inherits governance, philosophy, policy, or primary role context
- `reuse_binding` — local NeoBlock binds a reused MOLT block with context

Edges may be visible in Structure View before runtime. Edge glow or runtime activation may occur only from real runtime trace state.

## 7. Runtime Truth Boundary

A visual node may glow, pulse, activate, or show live state only from a real Hermes runtime trace event.

Rules:

- If no trace event maps to a node, it remains `idle`.
- If a trace event maps to a known UMG ID or alias, the runtime overlay may update that node.
- If a trace event cannot be mapped, it goes to `unmappedEvents` and the timeline.
- Compiler trace is not Hermes runtime trace.
- Structure may render before runtime.
- Geometry activation must not be fabricated.
- Demo or replay helpers must not synthesize `UMGTraceEvent[]` for activation.

The boundary is intentionally strict so the visual map remains proof of Hermes activity, not a mock animation.

## 8. View Modes

### Builder View

Builder View is for intake and sleeve construction. It may show upload/prompt state, selected template, matching/gap detection, compile readiness, and warnings.

### Structure View

Structure View shows the static geometry of the assembled Sleeve. It can render the full hierarchy, connections, gates, MOLT bindings, and layout semantics before Hermes runs.

Nodes in Structure View remain non-live unless runtime state exists. Structure View is valid for explaining how the Sleeve is organized.

### Runtime View

Runtime View uses the same geometry with a live Hermes trace overlay. Runtime View should highlight real mapped activity through Sleeve, NeoStack, NeoBlock, MOLT, Gate, tool, and approval nodes.

Runtime View must keep unmapped events separate from mapped node activation.

## Session Reset and Demo Control Foundation

Future reset actions should make the public demo repeatable without requiring a browser refresh or manual state cleanup.

Required reset actions:

- `Reset Intake` — clear prompt, pasted context, local file selection, selected workflow chip, and intake-only status.
- `Reset Sleeve Builder` — clear selected template, instantiated Sleeve, matching/gap result, draft generated block proposals, and assembly plan.
- `Clear Compile Result` — clear compile request/response, compiled manifest, compiler warnings/errors, and compile status while preserving the assembled Sleeve.
- `Clear Hermes Runtime Result` — clear Hermes request/response envelope, tool-call summary, approvals, artifacts, and runtime notices.
- `Clear Runtime Trace` — clear real runtime trace events, visual runtime state, unmapped events, and timeline overlay while preserving structure.
- `Start New Sleeve` — reset intake, builder, compile, Hermes, and trace state for a new Sleeve construction flow.
- `Return to Public Intake` — return to the public landing/intake shell without mutating saved blocks or source library data.
- `Keep Saved Blocks` — preserve session-local saved blocks and local library shelves.
- `Discard Draft Blocks` — remove draft-only generated block proposals from the current session without touching source library JSON.

Reset actions should be explicit, scoped, and non-destructive. They should never mutate `/home/neomagnetar/umg-block-library`, never drop source library JSON, and never fake runtime history.

## Phase 12B Projection Builder

Phase 12B introduces a non-visual projection layer that converts existing UMG structure into a `UMGGeometryManifest` for future Structure View and Runtime View surfaces.

The geometry manifest is a projection, not a source of truth. Source-of-truth records remain the template Sleeve, assembly plan, compile candidate, compiled runtime manifest, and real Hermes trace/state objects.

Projection rules:

- Structure View and Runtime View should share the same geometry manifest shape.
- Structure View renders the assembled Sleeve geometry with nodes idle by default.
- Runtime View applies a real Hermes trace/state overlay to the same geometry.
- The projection may derive hierarchy, gate-control, execution-order, inheritance, and reuse-binding edges from existing UMG records.
- Projection must not mutate source templates, assembly plans, compile candidates, compiled manifests, or source library JSON.
- Runtime activation still comes only from real Hermes trace IDs or real `UMGRuntimeVisualState` IDs.
- Unknown runtime IDs remain unmapped and must not create fallback glow on parent nodes.
- Compiler trace remains separate from Hermes runtime trace.

## Non-Goals for Phase 12A/12B

- no runtime graph UI implementation
- no animation engine
- no compiler bridge behavior change
- no Hermes runtime bridge behavior change
- no runtime trace mapper behavior change
- no fabricated runtime state
- no source library mutation
