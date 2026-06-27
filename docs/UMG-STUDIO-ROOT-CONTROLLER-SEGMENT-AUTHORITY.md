# UMG Studio Root Controller + Segment-Slot Authority Layout

Project label: `UMG_STUDIO_GRAPH_CREATOR_V2_PHASE3C_OPTION_B_ROOT_CONTROLLER_SEGMENT_AUTHORITY`

Status: spec only

Checkpoint context:
- Prior hierarchy/library checkpoint: `190dbd649680631788f6fd5dfe0fd90fa09825a5`
- Phase3B4 NeoBlock View graph correction checkpoint: `bd6a8235393c5b4bfb2ae981fa617a8d425cfc6b`

## 0. Purpose

This document defines the chosen Option B authority model for the next major UMG Studio graph/orchestration evolution.

This is a docs-only architecture pass.

It does not implement:
- TypeScript model changes
- UI changes
- route preview behavior
- compile changes
- live execution
- ActionGate behavior
- tool execution
- source library mutation
- direct Sleeve-level free-floating MOLT blocks
- arbitrary freeform graph engine

The goal is to lock the conceptual model before code changes begin.

## 1. Chosen architecture

Option B is selected.

Core choice:
- a controller is not a special child
- a controller is the root authority block of its scope
- a Sleeve has a `rootController`
- a NeoStack has a `rootController`
- later, complex NeoBlock subgraphs may also have `rootController`s

Implication:
- the root authority object sits above the ordinary child set for that scope
- it is not counted as one of the ordinary children
- it governs identity, rules, route grammar, and activation policy for the scope

## 2. Controller block semantics

A controller is a full cognitive block, not just a Directive bundle.

A controller may contain:
- Subject
- Primary
- Instruction
- Directive / Directive Bundle
- Blueprint
- Philosophy
- Meta

A controller defines:
- scope identity
- scope purpose
- scope constraints
- operating modes
- route grammar
- child activation rules
- escalation policy boundaries
- warnings and coordination hints

Important clarification:
- the Directive Bundle is one section inside the controller
- the Directive Bundle is not the whole controller

Therefore the controller should be treated as a dense multi-role authority object, not as a single-role prompt fragment.

## 3. Scope model

Conceptual shape:

```text
Scope
rootController
children
segmentLayout
gates
routeState
```

Initial scopes:
- Sleeve scope
- NeoStack scope

Future possible scope:
- NeoBlock subgraph scope

Conceptual meaning:
- `rootController` establishes authority for the scope
- `children` are the governed nodes within the scope
- `segmentLayout` places authority and children into a structured row/slot arrangement
- `gates` are control/evaluation records associated with the scope graph
- `routeState` is the static or future-resolved route posture for the scope

## 4. Sleeve structure

Conceptual shape:

```text
Sleeve
rootController
NeoStacks[]
segmentLayout
```

Rules:
- the Sleeve root controller governs NeoStacks
- the Sleeve root controller is not counted as a NeoStack
- NeoStacks are ordinary governed children of Sleeve scope
- Sleeve segment layout organizes the root controller plus NeoStack children into authority rows and slots

## 5. NeoStack structure

Conceptual shape:

```text
NeoStack
rootController
NeoBlocks[]
segmentLayout
```

Rules:
- the NeoStack root controller governs NeoBlocks
- the NeoStack root controller is not counted as an ordinary NeoBlock
- NeoBlocks are ordinary governed children of NeoStack scope
- NeoStack segment layout organizes the root controller plus NeoBlock children into authority rows and slots

## 6. Segment-slot authority layout

Definitions:

- Segment: the scoped authority layout container for a Sleeve or NeoStack
- Row: a vertical authority band in the Segment
- Slot: a placement cell inside a Row
- Relation: a directional semantic relationship between slots or nodes
- Gate: a control/evaluation object attached to scope structure or route rails
- Route preview: a read-only visualization of possible or selected authority flow

Canonical rows:
- Row 0: Root Controller
- Row 1: Strategy / top child lanes
- Row 2: Domains
- Row 3: Specializations
- Row 4: Details

Rules:
- higher rows constrain lower rows
- lower rows specialize higher rows
- same-row nodes are complementary peers by default
- gaps are allowed
- uneven branch depth is allowed
- root controller is locked to Row 0
- scope children cannot occupy Row 0

Interpretation:
- Row 0 is authority origin
- lower rows are not “less important”; they are more specialized and more local
- missing slots are valid when a branch does not require symmetry
- the system should support deliberate asymmetry rather than forcing balanced trees

## 7. Graph diagrams

### 7.1 Sleeve View

```text
          [Sleeve Root Controller]
                   |
              <Gate Rail>
                   |
 [NeoStack A] [NeoStack B] [NeoStack C]
```

### 7.2 NeoStack View

```text
          [NeoStack Root Controller]
                   |
              <Gate Rail>
                   |
   [NeoBlock A] [NeoBlock B] [NeoBlock C]
         |
    [NeoBlock A1] [NeoBlock A2]
```

### 7.3 Recursive scope pattern

```text
Scope
Root Controller
Children
Child scope or content block
```

Recursive interpretation:
- a child may be a simple content block
- a child may also become a nested scope in future phases
- nested scope authority always starts again from a root controller

## 8. Gate and trigger semantics

Definitions:
- Trigger = signal
- Gate = evaluator/control object

Rules:
- Gate is not a MOLT block
- Gate is not prompt content
- Gate is rendered as red rails/connectors
- Gate may activate, suppress, select, or log escalation
- no live execution in this phase
- no ActionGate execution in this phase

Implication:
- triggers and gates remain control records layered around the structure
- they do not become children inside the controller cognitive payload
- they do not replace authority semantics with execution semantics

## 9. Lower-to-higher authority rule

Rules:
- lower blocks may emit escalation signals
- lower blocks may not directly command higher controllers
- higher-scope gates decide whether escalation affects higher directive state
- static preview logs escalation for next-cycle recommendation
- future agentic mode may re-evaluate between steps, but not now

Interpretation:
- authority flows downward by default
- escalation flows upward only as a signal
- upward signals require higher-scope mediation before affecting higher-level directive state
- this preserves hierarchy while still allowing lower-level observations to matter

## 10. Data model pseudocode

This is conceptual spec pseudocode, not implementation.

```ts
// Conceptual only

type UMGScope = {
  id: string
  scopeType: 'sleeve' | 'neostack' | 'neoblock_subgraph'
  title: string
  rootController: ControllerBlock
  children: Array<NeoStack | NeoBlock | UMGBlock>
  segmentLayout: SegmentLayout
  gates: SegmentGate[]
  routeState: {
    activeRouteIds: string[]
    dormantRouteIds: string[]
    suppressedRouteIds: string[]
    escalationSignals: string[]
  }
}

type Sleeve = {
  id: string
  type: 'sleeve'
  title: string
  version: string
  description?: string
  tags: string[]
  rootController: ControllerBlock
  stacks: NeoStack[]
  segmentLayout: SegmentLayout
  runtimeConfig: {
    active: boolean
    depth: 'lean' | 'balanced' | 'full'
    hermesEnabled: boolean
    runtimeAdaptation: boolean
    showRuntimeTrace: boolean
  }
  metadata?: {
    author?: string
    createdAt?: string
    updatedAt?: string
  }
}

type NeoStack = {
  id: string
  type: 'neostack'
  title: string
  description?: string
  tags: string[]
  rootController: ControllerBlock
  neoblocks: NeoBlock[]
  segmentLayout: SegmentLayout
  defaultState: 'on' | 'off'
  compileStrategy?: 'ordered' | 'priority' | 'role_then_priority'
}

type ControllerBlock = {
  id: string
  type: 'controller_block'
  title: string
  scopeType: 'sleeve' | 'neostack' | 'neoblock_subgraph'
  subject?: UMGBlock
  primary?: UMGBlock[]
  instruction?: UMGBlock[]
  directiveBundle: DirectiveBundle
  blueprint?: UMGBlock[]
  philosophy?: UMGBlock[]
  meta?: UMGBlock[]
  warnings?: string[]
  operatingModes?: string[]
  routeGrammar?: string[]
  childActivationRules?: string[]
}

type SegmentLayout = {
  id: string
  scopeId: string
  rows: SegmentRow[]
  relations: SegmentRelation[]
  routePreview?: {
    selectedRouteIds: string[]
    candidateRouteIds: string[]
    dormantRouteIds: string[]
    suppressedRouteIds: string[]
  }
}

type SegmentRow = {
  rowIndex: 0 | 1 | 2 | 3 | 4
  rowLabel: 'root_controller' | 'strategy' | 'domains' | 'specializations' | 'details'
  slots: SegmentSlot[]
}

type SegmentSlot = {
  id: string
  rowIndex: number
  slotIndex: number
  occupantType: 'root_controller' | 'neostack' | 'neoblock' | 'molt_block' | 'empty'
  occupantId?: string
  locked?: boolean
  notes?: string
}

type SegmentRelation = {
  id: string
  relationType: 'authority_child' | 'peer_parallel' | 'specializes' | 'supports' | 'escalation_signal'
  fromSlotId: string
  toSlotId: string
  gateIds?: string[]
}

type SegmentGate = {
  id: string
  gateKind: 'trigger_gate' | 'routing_gate' | 'governance_gate' | 'action_gate'
  title: string
  attachedTo: {
    targetType: 'scope' | 'relation' | 'slot'
    targetId: string
  }
  effect: {
    activates?: string[]
    suppresses?: string[]
    selects?: string[]
    logsEscalation?: boolean
  }
  runtimeState: 'inactive' | 'evaluating' | 'passed' | 'dormant' | 'suppressed' | 'blocked' | 'requires_approval'
}

type DirectiveBundle = {
  id: string
  title: string
  mode: 'single' | 'priority_ordered' | 'conditional_set'
  items: DirectiveBundleItem[]
}

type DirectiveBundleItem = {
  id: string
  title: string
  instructionRef?: string
  directiveRef?: string
  priority?: number
  activationCondition?: string
  notes?: string
}
```

## 11. Operational pseudocode

This is conceptual spec pseudocode, not implementation.

```ts
function normalizeSleeve(inputSleeve): Sleeve {
  const rootController = inputSleeve.rootController ?? createRootController('sleeve', inputSleeve)
  const stacks = inputSleeve.stacks ?? []
  const segmentLayout = inputSleeve.segmentLayout ?? buildDefaultSegmentForScope('sleeve', rootController, stacks)
  return {
    ...inputSleeve,
    rootController,
    stacks,
    segmentLayout
  }
}

function normalizeNeoStack(inputStack): NeoStack {
  const rootController = inputStack.rootController ?? createRootController('neostack', inputStack)
  const neoblocks = inputStack.neoblocks ?? []
  const segmentLayout = inputStack.segmentLayout ?? buildDefaultSegmentForScope('neostack', rootController, neoblocks)
  return {
    ...inputStack,
    rootController,
    neoblocks,
    segmentLayout
  }
}

function createRootController(scopeType, source): ControllerBlock {
  return {
    id: `${scopeType}_root_controller_${source.id}`,
    type: 'controller_block',
    title: `${source.title} Root Controller`,
    scopeType,
    subject: undefined,
    primary: [],
    instruction: [],
    directiveBundle: {
      id: `${source.id}_directive_bundle`,
      title: `${source.title} Directive Bundle`,
      mode: 'priority_ordered',
      items: []
    },
    blueprint: [],
    philosophy: [],
    meta: [],
    warnings: [],
    operatingModes: [],
    routeGrammar: [],
    childActivationRules: []
  }
}

function buildDefaultSegmentForScope(scopeType, rootController, children): SegmentLayout {
  const rows = [0, 1, 2, 3, 4].map((rowIndex) => ({
    rowIndex,
    rowLabel:
      rowIndex === 0 ? 'root_controller' :
      rowIndex === 1 ? 'strategy' :
      rowIndex === 2 ? 'domains' :
      rowIndex === 3 ? 'specializations' : 'details',
    slots: []
  }))

  rows[0].slots.push({
    id: `${rootController.id}_slot_0`,
    rowIndex: 0,
    slotIndex: 0,
    occupantType: 'root_controller',
    occupantId: rootController.id,
    locked: true
  })

  children.forEach((child, index) => {
    placeChildInSlot(rows, child, { preferredRow: 1, slotIndex: index })
  })

  return {
    id: `${scopeType}_${rootController.id}_segment`,
    scopeId: rootController.id,
    rows,
    relations: [],
    routePreview: {
      selectedRouteIds: [],
      candidateRouteIds: [],
      dormantRouteIds: [],
      suppressedRouteIds: []
    }
  }
}

function getScopeChildren(scope): unknown[] {
  if (scope.type === 'sleeve') return scope.stacks
  if (scope.type === 'neostack') return scope.neoblocks
  return scope.children ?? []
}

function placeChildInSlot(rows, child, placement): void {
  const row = rows[placement.preferredRow]
  row.slots.push({
    id: `${child.id}_slot_${placement.preferredRow}_${placement.slotIndex}`,
    rowIndex: placement.preferredRow,
    slotIndex: placement.slotIndex,
    occupantType: child.type,
    occupantId: child.id
  })
}

function attachAuthorityChild(segmentLayout, fromSlotId, toSlotId): void {
  segmentLayout.relations.push({
    id: `rel_${fromSlotId}_${toSlotId}`,
    relationType: 'authority_child',
    fromSlotId,
    toSlotId
  })
}

function addGate(scopeOrSegment, gate): void {
  scopeOrSegment.gates.push(gate)
}

function resolveScopeRoute(scope): { active: string[]; dormant: string[]; suppressed: string[] } {
  return {
    active: scope.routeState?.activeRouteIds ?? [],
    dormant: scope.routeState?.dormantRouteIds ?? [],
    suppressed: scope.routeState?.suppressedRouteIds ?? []
  }
}

function resolveDirectiveBundle(controller: ControllerBlock): DirectiveBundleItem[] {
  return [...controller.directiveBundle.items].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
}

function evaluateRelation(relation, gates): 'active' | 'dormant' | 'suppressed' | 'blocked' {
  // Conceptual only. Real evaluation remains future work.
  return 'active'
}

function emitEscalationSignal(sourceId, targetScopeId, reason): SegmentRelation {
  return {
    id: `escalation_${sourceId}_${targetScopeId}`,
    relationType: 'escalation_signal',
    fromSlotId: sourceId,
    toSlotId: targetScopeId
  }
}

function compileSleeve(sleeve): unknown {
  // Future path only. No compile behavior changes in Phase3C1.
  return {
    scope: sleeve.id,
    controller: sleeve.rootController.id,
    activeStacks: []
  }
}

function compileNeoStack(stack): unknown {
  // Future path only. No compile behavior changes in Phase3C1.
  return {
    scope: stack.id,
    controller: stack.rootController.id,
    activeNeoBlocks: []
  }
}
```

## 12. Compile implications

Future compile order:
1. Enter Sleeve.
2. Read Sleeve rootController.
3. Resolve Sleeve active directive.
4. Resolve active NeoStacks.
5. Enter each active NeoStack.
6. Read NeoStack rootController.
7. Resolve NeoStack active directive.
8. Resolve active NeoBlocks.
9. Compile active NeoBlocks top-down.
10. Report dormant/suppressed branches.

Important Phase3C1 rule:
- do not change compile behavior in Phase3C1
- this spec only prepares the model

## 13. UX implications

Future Studio behavior should include:
- Full Sleeve View shows root controller above NeoStacks
- NeoStack View shows root controller above NeoBlocks
- MOLT Builder can open root controllers
- controller cards show Subject summary, active directive, directive count, blueprint summary, and warnings
- root controllers are visually distinct from children
- gates are red control rails
- route preview is read-only/static at first

Additional interpretation:
- root controllers should look authoritative rather than sibling-like
- controller visuals should make scope identity obvious
- route preview should teach hierarchy and control state without implying live execution

## 14. Validation rules

Rules:
- every structured Sleeve should have `rootController`
- every structured NeoStack should have `rootController`
- root controller cannot appear in `children` array
- root controller should include at least Subject, Primary, Instruction, Directive, Blueprint
- root controller must be Row 0 in the Segment
- children cannot occupy Row 0
- `authority_child` relation must point from higher row to lower row
- lower-to-higher direct control is invalid unless it is `escalation_signal`

Validation interpretation:
- a valid scope always has a single authority origin
- hierarchy errors should be structural validation failures, not visual-only warnings
- upward control attempts must be blocked unless represented as escalation signals

## 15. Implementation phase map

Future concentrated passes:
- `PHASE3C1_OPTION_B_ROOT_CONTROLLER_SPEC`
- `PHASE3C2_ROOT_CONTROLLER_TYPES`
- `PHASE3C3_SCOPE_NORMALIZATION_HELPERS`
- `PHASE3C4_SEGMENT_LAYOUT_HELPERS`
- `PHASE3C5_SLEEVE_ROOT_CONTROLLER_READONLY_VIEW`
- `PHASE3C6_NEOSTACK_ROOT_CONTROLLER_READONLY_VIEW`
- `PHASE3C7_SLOT_BASED_CHILD_PLACEMENT`
- `PHASE3C8_AUTHORITY_CONNECTORS`
- `PHASE3C9_CONTROLLER_MOLT_BUILDER_INTEGRATION`
- `PHASE3C10_GATE_RAIL_VISUALS`
- `PHASE3C11_STATIC_ROUTE_PREVIEW`
- `PHASE3C12_COMPILE_ROUTE_REPORT`
- `PHASE3C13_OPTIONAL_COMPILE_ORDERING`

## 16. Non-goals

This phase does not implement:
- TypeScript model changes
- UI changes
- route preview
- compile changes
- live execution
- ActionGate behavior
- tool execution
- source library mutation
- direct Sleeve-level free-floating MOLT blocks
- arbitrary freeform graph engine

This phase also does not change:
- app behavior
- current Generate behavior
- current compiler behavior
- current hierarchy rendering behavior

## 17. Acceptance criteria

This doc/spec pass is accepted if:
- Phase3B4 was checkpointed if needed
- new spec doc exists
- the spec clearly chooses Option B
- the spec treats controllers as root authority blocks
- the spec treats controllers as full MOLT-profile blocks
- the spec keeps gates/triggers as control records, not MOLT content
- the spec maps future implementation phases
- no app behavior was changed for Phase3C
- no tests/build/Vite were run
- protected repos were not modified

## 18. Summary decision

Chosen model summary:
- Sleeve and NeoStack become explicit scopes with root authority controllers
- controllers are full cognitive authority blocks, not child prompt fragments
- segment-slot layout becomes the future structured placement model
- gates remain control rails and evaluators, not prompt content
- compile integration is future work and remains unchanged in Phase3C1

This Option B model provides a cleaner authority system than treating controllers as special children, while preserving current UMG hierarchy language and keeping future implementation passes tightly scoped.
