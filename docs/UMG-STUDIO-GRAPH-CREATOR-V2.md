# UMG Studio Graph Creator v2 Research / Design Spec

Stable checkpoint reference: `898999d99c22298cc141aac6121cdabc5246f7b9`

Status: research/spec only

## 0. Purpose

This document defines how UMG Studio should evolve from a cramped demo-style graph surface into a clean, professional, hierarchy-aware Graph Creator for UMG and Hermes.

This is a product/design spec, not an implementation patch. It establishes the target interaction model before more graph code is added.

Core intent:
- make UMG hierarchy legible at a glance
- make graph actions structural and predictable
- separate design-time structure from runtime truth
- preserve UMG/Hermes semantics instead of drifting into generic node-editor behavior
- avoid "AI website slop" aesthetics and interaction patterns

## 1. Research References and Design Takeaways

### 1.1 React Flow
Relevant ideas:
- subflows and parent/child nodes
- viewport controls and fit/focus affordances
- selection model and minimap/controls
- optional handles without forcing them everywhere

Takeaways for UMG Studio:
- parent/child containment should be first-class, not cosmetic
- full-canvas navigation must feel deliberate and spatially stable
- handles should remain optional and deferred until hierarchy semantics are stable
- overlays/toggles should be layered on top of a clean containment model

### 1.2 Node-RED
Relevant ideas:
- palette + workspace separation
- simple port/wire mental model
- groups/subflows as composition aids
- readable, utilitarian, anti-slop visual density

Takeaways for UMG Studio:
- block library should feel like a real working palette, not marketing UI
- structural grouping matters more than flashy cards
- canvas actions should be direct and utilitarian
- subflow-like views map well to Stack View / Block View

### 1.3 n8n
Relevant ideas:
- workflow canvas with clear triggers/actions
- separation between authoring and execution state
- strong node library + templates + search
- execution/runtime detail is inspectable but not confused with design structure

Takeaways for UMG Studio:
- design-time graph and runtime inspection must remain separate layers
- templates/composers should create domain-meaningful structures, not empty wrappers
- Canvas and Runtime should be adjacent but distinct modes

### 1.4 LangSmith / LangGraph Studio
Relevant ideas:
- agent IDE orientation
- prompt/runtime inspection
- traces, evaluation, and debugging as dedicated truth surfaces
- visibility into what actually ran vs what was designed

Takeaways for UMG Studio:
- Runtime Overlay should show what Hermes actually used
- Trace, IR, and Glyph layers should behave like truth/debug layers, not design nodes
- inspection quality is a differentiator; runtime must be readable and explainable

### 1.5 Optional reference influences
- ComfyUI: useful reminder that wide canvases need disciplined grouping or they become spaghetti
- Blender node editor: useful for spatial clarity and overlay controls, but too freeform for early UMG hierarchy editing
- Unreal Blueprint: useful for readable graph tooling and contextual actions, but too execution-centric for current non-goals

Conclusion:
UMG Studio should borrow the professionalism of these tools without inheriting their generic freeform-node-editor defaults. UMG is a hierarchy-first design system, not just a wire-everything canvas.

## 2. Current UMG Studio Problems

### 2.1 Spatial and layout problems
- graph is still too cramped
- "full canvas" is not truly full-screen/focus-first
- too many competing panels reduce working room
- runtime drawer competes with the graph too early
- the graph does not yet feel like a professional studio workspace

### 2.2 Hierarchy/modeling problems
- Sleeve, NeoStack, NeoBlock, and MOLT are still too often perceived as peer cards
- containment is present, but the rendered hierarchy is not obvious enough
- Gate mode is over-promoted for a concept that should mostly be an overlay/debug concern
- MOLT View / NeoBlock View / NeoStack View need clearer semantics and clearer visible scope

### 2.3 Interaction problems
- snapping works, but ownership/merge/detach actions are not yet clean enough
- valid vs invalid structural moves need stronger visual guidance
- graph actions are still too close to generic drag/drop experimentation instead of domain-safe editing

### 2.4 Product/aesthetic problems
- the canvas risks feeling like generic AI website slop instead of a real graph-creation tool
- cards and controls are not yet opinionated enough about UMG structure
- runtime and design-time signals are too easy to mentally blur

## 3. Design Principles

1. Hierarchy before wiring.
2. Design-time structure before runtime overlays.
3. Focused workspace before multi-panel clutter.
4. Contextual actions before freeform handles.
5. Domain-aware composition before generic graph gimmicks.
6. Runtime truth visible, but never confused with authoring structure.
7. Every visual object should teach the UMG model.

## 4. Correct UMG Hierarchy Model

UMG Studio Graph Creator v2 must present the hierarchy explicitly:

```text
Sleeve
  contains NeoStacks
    contains NeoBlocks
      contains typed MOLT blocks
```

### 4.1 Canonical containment rules
- Sleeve contains NeoStacks
- NeoStack contains NeoBlocks
- NeoBlock contains typed MOLT blocks
- Gates attach to routes, boundaries, or edges
- Gates are not prompt-content children
- Runtime view shows what Hermes actually used
- Glyph Matrix / IR Matrix / Trace are runtime truth layers, not normal design hierarchy

### 4.2 Structural vs runtime concepts
Design-time structure:
- Sleeve
- NeoStack
- NeoBlock
- typed MOLT blocks
- containment metadata
- manual layout metadata

Runtime truth layers:
- RuntimeSpec
- Trace
- IR Matrix
- Glyph Matrix
- gate decisions
- route decisions
- actual used runtime path

Rule:
Runtime layers may annotate design nodes, but they must not replace the hierarchy or masquerade as ordinary design-time peers.

## 5. Top-Level Modes and Canvas Views

## 5.1 Top-level product modes
UMG Studio should use exactly three primary modes:
- Compose
- Canvas
- Runtime

### Compose
Purpose:
- browse blocks, templates, sleeves, stacks, and control sources
- prompt into a high-level sleeve draft
- assemble or insert assets into the active workspace

### Canvas
Purpose:
- visually edit hierarchy
- navigate containers
- perform structural actions
- inspect design objects in context

### Runtime
Purpose:
- inspect compile outputs and actual usage
- compare designed structure to runtime path
- inspect Trace / IR / Glyph / output without pretending they are design nodes

## 5.2 Canvas semantic views
Within Canvas, the user should switch semantic views, not generic graph modes:
- Sleeve Map
- Stack View
- Block View
- MOLT View
- Runtime Overlay

### Sleeve Map
Shows:
- active Sleeve root container
- contained NeoStacks
- high-level stack relationships
- optional overlays for gates/runtime state

Use when:
- shaping overall sleeve architecture
- understanding domain structure
- moving/reordering stacks

### Stack View
Shows:
- one selected NeoStack prominently
- its NeoBlocks
- optional sibling context in muted state

Use when:
- organizing one stack
- moving NeoBlocks inside a stack
- adding/removing/reordering block containers

### Block View
Shows:
- one selected NeoBlock container
- contained MOLT cards
- local sequence/priority/relationship cues

Use when:
- editing prompt-content structure
- moving MOLT cards
- inspecting role composition

### MOLT View
Shows:
- one focused MOLT-centered local composition context
- adjacent cards or ordering context as needed
- strong inspector support for content/runtime metadata

Use when:
- editing specific block content or placement
- understanding role contribution

### Runtime Overlay
Purpose:
- show runtime truth on top of design structure
- never replace the design hierarchy with runtime-only nodes

Can show:
- active runtime path
- gate states
- IR/Glyph references
- used vs unused nodes
- diagnostics badges

## 5.3 Gate treatment
Do not keep Gate as a primary graph view.

Instead, gate information should be exposed as overlay toggles inside Canvas:
- Show Gates
- Show Runtime State
- Show IR/Glyph Links

Why:
- gates are control metadata, not the main authored hierarchy
- over-elevating gates distorts the UMG mental model
- overlays preserve access without making the graph feel like a generic execution editor

## 6. Full-Screen Canvas Design

## 6.1 True Focus Canvas mode
Graph Creator v2 requires a true Focus Canvas mode.

Requirements:
- canvas occupies the primary workspace, edge to edge inside app chrome
- library drawer can collapse to icon rail or hidden state
- inspector drawer can collapse independently
- runtime drawer is hidden/collapsed by default
- toolbar floats over the canvas instead of consuming fixed header rows when focused
- mode-specific controls become compact and spatially anchored

"Focus Canvas" should feel like entering a real editing surface, not just shrinking sidebars slightly.

## 6.2 Canvas chrome
### Floating toolbar
Contains:
- current mode/view label
- view switcher
- overlay toggles
- zoom/fit/reset actions
- focus/exit focus action
- create/add action entry point

Behavior:
- compact by default
- readable on dark canvas
- pinned top-left or top-center depending on layout pass

### Library drawer
States:
- open
- collapsed rail
- hidden in Focus Canvas

Contents:
- role-filtered MOLT library
- NeoBlocks / NeoStacks / Sleeves
- gate/control sources
- templates
- search/filter/tagging

### Inspector drawer
States:
- open
- collapsed summary
- hidden in Focus Canvas

Behavior:
- contextual to selection
- must never feel empty or useless

### Runtime drawer
Default:
- collapsed/hidden

Expands only on explicit runtime intent.

## 6.3 Mode-specific mini toolbar
Each Canvas semantic view should expose only the controls needed for that view.

Examples:
- Sleeve Map: add stack, reorder, fit hierarchy, toggle overlays
- Stack View: add block, reorder blocks, detach block, promote/demote visibility
- Block View: add/move MOLT, duplicate, detach, set template
- MOLT View: content actions, metadata, runtime contribution

## 6.4 Keyboard and mouse UX expectations
Mouse:
- drag to move selected item
- clear ghost drop targets on hover/drag
- click select, double-click drill in, background click clears selection
- wheel/pinch zoom on canvas
- pan by space+drag or middle-mouse drag

Keyboard:
- Esc clears transient state or exits Focus Canvas stepwise
- Enter confirms selected contextual action when safe
- Delete/Backspace only for reversible structural removal with confirmation where needed
- Cmd/Ctrl+D duplicate selected structural unit where valid
- Arrow keys nudge layout only when layout mode is active
- number keys or quick shortcuts may switch semantic views later, but not required in first pass

## 7. Visual Hierarchy Rules

The graph must visually teach the hierarchy.

### 7.1 Sleeve rendering
Render Sleeve as:
- large root container/frame
- labeled architectural root
- not a normal block card
- visually stable parent boundary

Should communicate:
- top-level scope
- workspace ownership
- domain identity of the composed sleeve

### 7.2 NeoStack rendering
Render NeoStack as:
- stack container inside Sleeve
- larger than NeoBlock
- clearly grouped as a functional lane/column/segment

Should communicate:
- a major workflow/function domain
- ordering and sibling relationship to other stacks

### 7.3 NeoBlock rendering
Render NeoBlock as:
- block container inside NeoStack
- visually bounded local composition zone
- parent for typed MOLT cards

Should communicate:
- a coherent functional bundle
- local structure and content grouping

### 7.4 MOLT rendering
Render MOLT as:
- role-colored card inside NeoBlock
- compact but readable
- title-forward with role badge
- never shown to the user as plain `molt_block`

Should communicate:
- prompt-content role
- status/runtime relevance when overlays are enabled

### 7.5 TriggerGate rendering
Render TriggerGate as:
- small badge/control marker on boundary or edge
- not as a full prompt-content child card by default
- visible when overlays/toggles request it

Should communicate:
- control logic attachment point
- control metadata, not authored content body

### 7.6 Runtime rendering
Render runtime truth as:
- overlays, highlights, path states, badges, side panels, inspectors
- not permanent design nodes unless a dedicated debug projection is explicitly opened

Rule:
Runtime should explain execution without deforming design-time structure.

## 8. MOLT Role Display

UMG Studio must use user-facing role labels and color identity consistently.

Required labels:
- Directive
- Instruction
- Subject
- Primary
- Philosophy
- Blueprint
- Meta
- Unknown/Other

Rule:
The UI must never show plain `molt_block` as the primary user-facing label.

## 8.1 Suggested role color system
Colors should be refined in design pass, but semantic grouping should be stable.

- Directive: decisive warm accent
- Instruction: procedural blue
- Subject: descriptive teal
- Primary: strong core violet or indigo
- Philosophy: reflective amber/gold
- Blueprint: systems green
- Meta: neutral gray/slate
- Unknown/Other: subdued fallback color with warning-neutral treatment

Requirements:
- sufficient contrast on dark theme
- consistent between library, canvas card, and inspector badges
- status overlays should not destroy role identity

## 9. Containment and Snapping Model

## 9.1 Valid containment relations
- MOLT → NeoBlock
- NeoBlock → NeoStack
- NeoStack → Sleeve

## 9.2 Invalid relations
Examples:
- MOLT → Sleeve directly
- MOLT → NeoStack directly
- NeoBlock → NeoBlock as child
- NeoStack → NeoBlock as parent target
- Sleeve → any higher parent
- Gate as prompt-content child
- cyclic parentage of any kind

## 9.3 Cycle prevention
Containment must be acyclic.

Rules:
- no node may become parent of itself
- no node may be dropped into any descendant chain
- cycle prevention must occur before mutation
- invalid targets should be visually rejected before drop confirmation

## 9.4 Ghost drop zones
During drag:
- valid containers highlight with clear ghost drop zones
- invalid containers dim or show blocked state
- nearest valid target should be obvious
- preview should indicate resulting ownership, not just location

## 9.5 Merge behavior
For first professional version, "merge" should mean structural insertion into a valid parent container, not fuzzy graph fusion.

Examples:
- dropping a MOLT onto a NeoBlock merges it into that NeoBlock's child list
- dropping a NeoBlock onto a NeoStack merges it into that NeoStack's block list
- dropping a NeoStack onto a Sleeve merges it into that Sleeve's stack list

No freeform semantic merge should occur in early phases.

## 9.6 Detach behavior
Detach should be explicit and predictable.

Examples:
- MOLT detaches from NeoBlock into a temporary unplaced/holding state or selected placement target flow
- NeoBlock detaches from NeoStack
- NeoStack detaches from Sleeve

Recommendation:
Use inspector/contextual commands for detach first; drag-to-nowhere detach can come later only if it remains safe and understandable.

## 9.7 Move/copy behavior
Move:
- changes structural parentage inside the workspace
- preserves object identity unless explicit duplicate is chosen

Copy:
- creates a workspace copy
- preserves source linkage metadata when applicable
- must never mutate source library assets

## 9.8 Parent moves children
When a parent container moves spatially:
- all visual children move with it
- manual child layout remains relative to parent
- containment is structural, not just decorative proximity

## 9.9 Containment metadata vs source-library mutation
Rule:
Containment edits update workspace graph/workspace structure metadata only.

They must not:
- mutate source library assets
- rewrite upstream catalogs
- alter compiler source material outside the active workspace copy

## 10. Connect / Disconnect Model

Do not recommend freeform handles everywhere yet.

### 10.1 First-version interaction model
Use selection-based structural actions first:
- Add to NeoBlock
- Move to NeoStack
- Move to Sleeve
- Detach
- Duplicate
- Convert to template

Why:
- easier to validate semantically
- easier to explain in inspector and context menus
- prevents premature spaghetti-handle UX
- respects UMG's hierarchy-first model

### 10.2 Later optional port/handle system
After relation semantics are stable, an optional port/handle system may be introduced for:
- route overlays
- gate attachments
- runtime path visualization
- advanced relation editing

But not as the first solution for basic containment editing.

## 11. Inspector Model

The inspector should be contextual and high-value in every state.

## 11.1 No selection
Show:
- current mode/view explanation
- active sleeve summary
- quick actions: add stack, add block, add MOLT, open templates, enter focus canvas
- current overlay/filter state

## 11.2 Sleeve selected
Show:
- sleeve title/id/type
- summary of contained stacks
- domain/template origin
- ordering summary
- actions: add stack, duplicate sleeve, convert to template, export workspace sleeve, focus sleeve map

## 11.3 NeoStack selected
Show:
- stack title/id
- purpose/role in sleeve
- contained NeoBlocks summary
- ordering within Sleeve
- actions: add NeoBlock, reorder, detach, duplicate, convert to template, focus stack view

## 11.4 NeoBlock selected
Show:
- block title/id
- contained MOLT summary by role
- status/warnings
- ordering within stack
- actions: add MOLT, reorder, duplicate, detach, convert to template, focus block view

## 11.5 MOLT selected
Show:
- title
- user-facing role label
- source metadata
- content preview/full content
- tags/category
- runtime usage signals when available
- actions: move, duplicate, detach, inspect JSON/source, convert to template

## 11.6 Gate selected
Show:
- gate type/kind
- attachment target (boundary/edge/route)
- condition summary
- source control record metadata
- runtime decision state if available
- actions: inspect source, move attachment, detach, hide overlay focus

## 11.7 Runtime trace item selected
Show:
- trace event identity/time/order
- linked design nodes
- linked IR row/Glyph line
- route/gate decision summary
- used vs skipped explanation
- actions: reveal source node, pin comparison, inspect adjacent trace events

## 11.8 Relation selected
If a relation/attachment is selectable:
- relation type
- source and target
- containment or gate attachment meaning
- runtime annotations if any
- actions: detach, inspect origin, reveal endpoints

## 12. Block Library Model

The library must behave like a professional creation palette.

## 12.1 Browsing structure
Users should be able to browse:
- all MOLT blocks by role
- NeoBlocks
- NeoStacks
- Sleeves
- gate/control sources
- templates

## 12.2 Search / filter / tagging
Support:
- search by title/text/tag/id
- role filters
- status filters where useful
- source/type filters
- template filters
- recents/favorites later if needed

## 12.3 Add / drag / drop behavior
Support two safe entry paths:
- click-to-add via contextual target selection
- drag/drop into visible valid container targets

Rules:
- drag/drop must respect containment validity
- add actions should prefer the currently selected valid parent
- when no valid parent is selected, prompt for placement instead of guessing badly

## 13. High-Level Sleeve Composer

The composer should create high-function sleeves, not generic shells.

A prompt like "generate a website" should not yield a bland single-stack placeholder. It should generate a domain-aware sleeve architecture with clear functional stacks and useful NeoBlocks.

## 13.1 Website sleeve example
Expected stacks:
- Strategy Stack
- Information Architecture Stack
- Copywriting Stack
- Visual System Stack
- Implementation Stack
- Review/QA Stack

Example NeoBlocks:
- Strategy Stack: goals, audience, offer, differentiators
- Information Architecture Stack: sitemap, page goals, navigation, content inventory
- Copywriting Stack: headlines, body copy, CTA system, tone constraints
- Visual System Stack: brand language, layout system, components, imagery direction
- Implementation Stack: technical spec, frontend tasks, CMS/data model, handoff constraints
- Review/QA Stack: acceptance criteria, consistency review, launch checklist

## 13.2 Chatbot sleeve example
Expected stacks:
- Persona & Objectives Stack
- Conversation Design Stack
- Knowledge & Retrieval Stack
- Safety & Policy Stack
- Runtime Orchestration Stack
- QA / Evaluation Stack

## 13.3 Grant application sleeve example
Expected stacks:
- Opportunity Analysis Stack
- Narrative Strategy Stack
- Evidence & Research Stack
- Budget & Resources Stack
- Submission Assembly Stack
- Review / Compliance Stack

## 13.4 Research report sleeve example
Expected stacks:
- Question Framing Stack
- Source Gathering Stack
- Evidence Synthesis Stack
- Argument / Insight Stack
- Drafting Stack
- Review / Citation Stack

## 13.5 Social media campaign sleeve example
Expected stacks:
- Strategy Stack
- Audience & Positioning Stack
- Content Pillars Stack
- Campaign Asset Production Stack
- Distribution & Scheduling Stack
- Review / Analytics Stack

Composer rule:
Generated sleeves must be domain-aware, cognitively useful, and visibly structured around real work functions.

## 14. Hermes Runtime Integration

UMG Studio Graph Creator v2 must clearly separate:
- design-time graph
- compile-time IR/RuntimeSpec
- generation-time Hermes/Spark call
- runtime trace
- Glyph Matrix
- route/gate decisions

## 14.1 Design-time graph
Represents:
- intended hierarchy
- authored structure
- workspace-local layout and containment
- template/domain composition choices

## 14.2 Compile-time layer
Produces:
- IR / RuntimeSpec projection from design-time structure
- compiler-oriented runtime representation
- diagnostics and compile visibility

## 14.3 Generation-time layer
Represents:
- actual Hermes/Spark invocation path
- actual used runtime content
- fallback/bridge/backend result details where applicable

## 14.4 Runtime trace layer
Shows:
- what actually executed/was used
- route and gate decisions
- sequence of runtime events
- used vs dormant vs suppressed structures

## 14.5 Glyph Matrix layer
Shows:
- projected runtime graph truth
- readable runtime-state projection linked to design structure
- not normal authoring hierarchy

## 14.6 Critical distinction
Design structure answers:
- what did the user build?
- how is the sleeve organized?

Runtime truth answers:
- what did Hermes actually use?
- what route/gate path was taken?
- what nodes were active, dormant, suppressed, or skipped?

These must be shown together when useful, but never conflated.

## 15. Implementation Roadmap

## Phase 3A: True Focus Canvas only
Scope:
- real focus-canvas behavior
- collapsible/hidden supporting panes
- floating toolbar
- runtime drawer collapsed by default
- no new relation UX beyond stabilization

## Phase 3B: Hierarchy-aware inspector actions
Scope:
- contextual inspector states
- selection-based structural actions
- better no-selection guidance
- remove low-value empty inspector states

## Phase 3C: Clean containment editor
Scope:
- ghost drop zones
- explicit valid/invalid targets
- move/copy/detach semantics
- parent-child movement consistency
- containment metadata safety

## Phase 3D: High-level Sleeve Composer templates
Scope:
- domain-aware sleeve generation
- high-function default stacks
- template-backed composition model
- better prompt-to-structure mapping

## Phase 3E: Runtime overlay / Hermes trace viewer
Scope:
- runtime overlay toggles
- route/gate state display
- IR/Glyph/Trace linking
- design vs runtime path explanation

## Phase 3F: Optional port/handle connection UX
Scope:
- only after hierarchy and containment are stable
- limited, purposeful handle usage
- likely for advanced overlays/relations, not basic containment

## 16. Non-Goals

The following are explicitly out of scope for Graph Creator v2 at this stage:
- no route switching yet
- no live execution
- no ActionGate execution
- no compiler prompt-content mutation
- no new Trigger MOLT blocks
- no provider/Hermes backend changes
- no source library mutation

Additional practical non-goal:
- no premature freeform wire-everything node editor behavior

## 17. Acceptance Standard: What "Not Slop" Means

Graph Creator v2 is successful when:
- the graph explains UMG hierarchy at a glance
- actions are predictable and structurally safe
- the graph has room to work
- hierarchy is structural, not decorative
- runtime truth is visible but not confused with design-time structure
- generated sleeves are domain-aware and cognitively useful

More concretely:
- a new user can immediately see that Sleeve > NeoStack > NeoBlock > typed MOLT is the core model
- Focus Canvas feels like a serious editor, not a mildly enlarged dashboard pane
- Gate information is available without hijacking the primary graph mental model
- MOLT cards are role-legible and never mislabeled as generic `molt_block`
- containment edits are safe, explicit, and visually understandable
- runtime overlays explain actual Hermes behavior without turning the authoring surface into a debugging mess

## 18. Recommended Product Positioning

UMG Studio Graph Creator v2 should present itself as:
- a hierarchy-aware sleeve composer
- a cognitively structured graph editor for UMG/Hermes
- a design-to-runtime inspection surface

It should not present itself as:
- a generic AI flowchart site
- a freeform spaghetti node editor
- a visual skin over provider/backend experimentation

## 19. Final Recommendation

Before any more major graph implementation, UMG Studio should align on this model:
- hierarchy-first canvas
- contextual structural actions
- gate/runtime as overlays, not primary graph identity
- domain-aware sleeve composition
- strict separation between design structure and runtime truth

That model is the shortest path to a graph creator that feels professional, explainable, and distinctly UMG/Hermes rather than interchangeable with generic AI node tools.
