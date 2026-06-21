import {
  GateEvaluationInput,
  GateEvaluationMode,
  GateEvaluationResult,
  GateEvaluationRouteSelections,
  GateEvaluationTargetDecision,
  GateIRRow,
  GateKind,
  GatePathState,
  GateRouteControl,
  GateScopeTarget,
  GraphEdge,
  GraphNode,
  RuntimeGate,
  RuntimeGateContext,
  TriggerGateSourceCard,
  UMGWorkspace
} from './types';

export const GATE_KINDS: GateKind[] = ['trigger_gate', 'routing_gate', 'governance_gate', 'action_gate'];

const emptyRouteControl = (): GateRouteControl => ({ activates: [], dormants: [], suppresses: [], blocks: [] });
const targetIds = (targets: GateScopeTarget[]) => targets.map((target) => target.targetId);

const GATE_EVAL_DEFAULT_TIME = '1970-01-01T00:00:00.000Z';
const pathStatePrecedence: Record<GatePathState, number> = {
  active: 1,
  dormant: 2,
  suppressed: 3,
  blocked: 4
};

export type GateEvaluationRouteState = {
  active_paths: string[];
  dormant_paths: string[];
  suppressed_paths: string[];
  blocked_paths: string[];
};

export type GateEvaluationRouteStateWithWarnings = GateEvaluationRouteState & {
  warnings: string[];
};

const defaultSafetyFlags = {
  promptContentMutation: false,
  routeSwitching: false,
  liveExecution: false,
  toolExecution: false
};

const DEFAULT_INERT_GATE_EVALUATION_REASON = 'Gate evaluation is inert; runtime evaluation mode is not implemented.';

const defaultRouteSelections = (): GateEvaluationRouteSelections => ({
  selectedRouteIds: [],
  activeTargets: [],
  dormantTargets: [],
  suppressedTargets: [],
  blockedTargets: [],
  requiresApprovalTargets: []
});

function routeSelectionsFromRuntimeGate(gate: RuntimeGate): GateEvaluationRouteSelections {
  return {
    selectedRouteIds: [],
    activeTargets: targetIds(gate.routeControl.activates),
    dormantTargets: targetIds(gate.routeControl.dormants),
    suppressedTargets: targetIds(gate.routeControl.suppresses),
    blockedTargets: targetIds(gate.routeControl.blocks),
    requiresApprovalTargets: []
  };
}

function buildTargetDecisionsFromRuntimeGate(gate: RuntimeGate): GateEvaluationTargetDecision[] {
  const buildDecision = (
    target: GateScopeTarget,
    requestedPathState: GateEvaluationTargetDecision['requestedPathState'],
    sourceKey: 'routeControl.activates' | 'routeControl.dormants' | 'routeControl.suppresses' | 'routeControl.blocks'
  ): GateEvaluationTargetDecision => ({
    targetId: target.targetId,
    targetType: target.targetType,
    requestedPathState,
    winnerPolicy: 'default',
    evidence: [{ source: gate.id, value: sourceKey }]
  });
  return [
    ...gate.routeControl.activates.map((target) => buildDecision(target, 'active', 'routeControl.activates')),
    ...gate.routeControl.dormants.map((target) => buildDecision(target, 'dormant', 'routeControl.dormants')),
    ...gate.routeControl.suppresses.map((target) => buildDecision(target, 'suppressed', 'routeControl.suppresses')),
    ...gate.routeControl.blocks.map((target) => buildDecision(target, 'blocked', 'routeControl.blocks'))
  ];
}

function routeSelectionsFromResultInputs(input: Pick<GateEvaluationInput, 'selectedRouteId'>, routeSelections: GateEvaluationRouteSelections): GateEvaluationRouteSelections {
  return {
    ...routeSelections,
    selectedRouteIds: routeSelections.selectedRouteIds.length ? [...routeSelections.selectedRouteIds] : (input.selectedRouteId ? [input.selectedRouteId] : [])
  };
}

function sanitizeSafetyFlags(safety: GateEvaluationResult['safety']): GateEvaluationResult['safety'] {
  return {
    promptContentMutation: !!safety.promptContentMutation,
    routeSwitching: !!safety.routeSwitching,
    liveExecution: !!safety.liveExecution,
    toolExecution: !!safety.toolExecution
  };
}

export const gateProjectionPrinciples = {
  irMatrixSourceOfTruth: true,
  glyphMatrixProjectionOnly: true,
  gateNodesProjectAs: 'G',
  triggerGateControlsRuntimeActivation: true,
  noLiveToolExecution: true,
  noAutomaticApproval: true
} as const;

export function buildRuntimeGate(input: Omit<RuntimeGate, 'type' | 'routeControl' | 'runtimeState' | 'priorityOrder' | 'traceRefs'> & Partial<Pick<RuntimeGate, 'routeControl' | 'runtimeState' | 'priorityOrder' | 'traceRefs'>>): RuntimeGate {
  return {
    type: 'RuntimeGate',
    id: input.id,
    title: input.title,
    gateKind: input.gateKind,
    condition: input.condition,
    routeControl: input.routeControl ?? emptyRouteControl(),
    runtimeState: input.runtimeState ?? { state: 'inactive', passed: false, reason: 'Gate scaffold is inert until runtime evaluation is implemented' },
    priorityOrder: input.priorityOrder ?? { priorityMeaning: 'hierarchy_order_only' },
    traceRefs: input.traceRefs ?? [],
    sourcePath: input.sourcePath,
    sourceCardId: input.sourceCardId,
    placement: input.placement
  };
}

export type GateAttachmentPlacement =
  | { kind: 'edge'; edgeId: string }
  | { kind: 'node_boundary'; nodeId: string };

export const ATTACHED_GATE_INERT_REASON = 'Gate attached as control geometry; not evaluated yet.';

function compactGateLabel(gate: Pick<RuntimeGate, 'gateKind' | 'title'>) {
  const prefix: Record<GateKind, string> = { trigger_gate: 'Gt', routing_gate: 'Gr', governance_gate: 'Gv', action_gate: 'Ga' };
  return `${prefix[gate.gateKind]}: ${gate.title}`;
}

export function buildRuntimeGateFromSourceCard(card: TriggerGateSourceCard, options: { id?: string } = {}): RuntimeGate {
  const safeSourceId = card.id.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return buildRuntimeGate({
    id: options.id ?? `gate_${safeSourceId}_instance`,
    sourceCardId: card.id,
    title: card.title,
    gateKind: 'trigger_gate',
    condition: card.activation.conditionSummary || card.summary || card.title,
    sourcePath: card.sourcePath,
    routeControl: emptyRouteControl(),
    runtimeState: { state: 'inactive', passed: false, reason: ATTACHED_GATE_INERT_REASON },
    priorityOrder: { priorityMeaning: 'hierarchy_order_only' },
    traceRefs: []
  });
}

export function createInertGateEvaluationResult(
  gate: RuntimeGate,
  input: Pick<GateEvaluationInput, 'evaluationReason' | 'evaluatedAt' | 'selectedRouteId' | 'traceEventIds' | 'confidence'> = {}
): GateEvaluationResult {
  const evaluatedAt = input.evaluatedAt ?? GATE_EVAL_DEFAULT_TIME;
  const routeSelections: GateEvaluationRouteSelections = routeSelectionsFromResultInputs(
    { selectedRouteId: input.selectedRouteId ?? '' },
    defaultRouteSelections()
  );
  const selectedRouteIds = routeSelections.selectedRouteIds;
  return {
    gateId: gate.id,
    gateKind: gate.gateKind,
    evaluatedAt,
    evaluationMode: 'disabled',
    outcome: 'not_applicable',
    decision: 'inactive',
    passed: false,
    confidence: input.confidence,
    reason: input.evaluationReason ?? DEFAULT_INERT_GATE_EVALUATION_REASON,
    routeSelections: {
      ...routeSelections,
      selectedRouteIds
    },
    targetDecisions: [],
    selectedRouteId: input.selectedRouteId,
    requiresApproval: false,
    safety: sanitizeSafetyFlags(defaultSafetyFlags),
    traceEventIds: [...(input.traceEventIds ?? [])]
  };
}

export function createManualGateEvaluationResult(
  gate: RuntimeGate,
  input: Pick<GateEvaluationInput, 'evaluationReason' | 'evaluationMode' | 'evaluatedAt' | 'selectedRouteId' | 'confidence' | 'traceEventIds'> = {}
): GateEvaluationResult {
  const evaluatedAt = input.evaluatedAt ?? GATE_EVAL_DEFAULT_TIME;
  const evaluationMode = input.evaluationMode ?? 'manual';
  const routeSelections = routeSelectionsFromResultInputs(
    { selectedRouteId: input.selectedRouteId ?? '' },
    routeSelectionsFromRuntimeGate(gate)
  );
  return {
    gateId: gate.id,
    gateKind: gate.gateKind,
    evaluatedAt,
    evaluationMode,
    outcome: 'passed',
    decision: 'passed',
    passed: true,
    confidence: input.confidence,
    reason: input.evaluationReason ?? `Manual ${gate.gateKind} evaluation from routeControl`,
    routeSelections,
    targetDecisions: buildTargetDecisionsFromRuntimeGate(gate),
    selectedRouteId: input.selectedRouteId,
    requiresApproval: false,
    safety: sanitizeSafetyFlags(defaultSafetyFlags),
    traceEventIds: [...(input.traceEventIds ?? [])]
  };
}

export function routeStateFromGateEvaluationResults(
  results: GateEvaluationResult[]
): GateEvaluationRouteStateWithWarnings {
  const pathChoiceByTarget = new Map<string, { state: GatePathState; order: number }>();
  const warnings: string[] = [];

  let order = 0;

  for (const result of results) {
    const targetsForResult: Array<[GatePathState, string, string]> = [
      ...result.routeSelections.activeTargets.map((targetId) => ['active', targetId, result.gateId] as [GatePathState, string, string]),
      ...result.routeSelections.dormantTargets.map((targetId) => ['dormant', targetId, result.gateId] as [GatePathState, string, string]),
      ...result.routeSelections.suppressedTargets.map((targetId) => ['suppressed', targetId, result.gateId] as [GatePathState, string, string]),
      ...result.routeSelections.blockedTargets.map((targetId) => ['blocked', targetId, result.gateId] as [GatePathState, string, string])
    ];

    for (const [state, targetId, gateId] of targetsForResult) {
      order += 1;
      const existing = pathChoiceByTarget.get(targetId);
      if (!existing) {
        pathChoiceByTarget.set(targetId, { state, order });
        continue;
      }

      if (pathStatePrecedence[state] > pathStatePrecedence[existing.state]) {
        warnings.push(
          `Route target '${targetId}' conflicted across gate results; ${existing.state} overridden by ${state} from gate ${gateId}.`
        );
        pathChoiceByTarget.set(targetId, { state, order });
      }
    }
  }

  const activeOrdered: string[] = [];
  const dormantOrdered: string[] = [];
  const suppressedOrdered: string[] = [];
  const blockedOrdered: string[] = [];

  const orderedTargetChoices = [...pathChoiceByTarget.entries()].sort((a, b) => a[1].order - b[1].order);

  for (const [targetId, stateChoice] of orderedTargetChoices) {
    if (stateChoice.state === 'active') activeOrdered.push(targetId);
    if (stateChoice.state === 'dormant') dormantOrdered.push(targetId);
    if (stateChoice.state === 'suppressed') suppressedOrdered.push(targetId);
    if (stateChoice.state === 'blocked') blockedOrdered.push(targetId);
  }

  return {
    active_paths: activeOrdered,
    dormant_paths: dormantOrdered,
    suppressed_paths: suppressedOrdered,
    blocked_paths: blockedOrdered,
    warnings
  };
}

export function gateEvaluationResultToGateIRRowPatch(result: GateEvaluationResult): Pick<
  GateIRRow,
  'state' | 'gatePassed' | 'selectedRouteIds' | 'activeTargetIds' | 'dormantTargetIds' | 'suppressedTargetIds' | 'blockedTargetIds' | 'requiredApproval' | 'routingDecision' | 'reason' | 'traceEventIds'
> {
  return {
    state: result.decision,
    gatePassed: result.passed,
    selectedRouteIds: [...result.routeSelections.selectedRouteIds],
    activeTargetIds: [...result.routeSelections.activeTargets],
    dormantTargetIds: [...result.routeSelections.dormantTargets],
    suppressedTargetIds: [...result.routeSelections.suppressedTargets],
    blockedTargetIds: [...result.routeSelections.blockedTargets],
    requiredApproval: result.requiresApproval,
    routingDecision: result.selectedRouteId,
    reason: result.reason,
    traceEventIds: [...result.traceEventIds]
  };
}

export function attachRuntimeGateToGraph(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, gate: RuntimeGate, placement: GateAttachmentPlacement, existingRuntimeGates: RuntimeGate[] = []) {
  const gateLabel = compactGateLabel(gate);
  const placedGate: RuntimeGate = { ...gate, placement: placement.kind === 'edge' ? { kind: 'edge', targetId: placement.edgeId } : { kind: 'node_boundary', targetId: placement.nodeId } };
  const nodes = graph.nodes.map((node) => {
    if (placement.kind !== 'node_boundary' || node.id !== placement.nodeId) return { ...node };
    return {
      ...node,
      governingGateIds: [...new Set([...(node.governingGateIds ?? []), gate.id])],
      gateKind: gate.gateKind,
      gateLabel,
      pathState: node.pathState ?? 'candidate' as const,
      debugExpandable: true
    };
  });
  const edges = graph.edges.map((edge) => {
    if (placement.kind !== 'edge' || edge.id !== placement.edgeId) return { ...edge };
    return { ...edge, governingGateId: gate.id, gateKind: gate.gateKind, gateLabel, pathState: edge.pathState ?? 'candidate' as const };
  });
  return { graph: { ...graph, nodes, edges }, runtimeGates: [...existingRuntimeGates, placedGate] };
}

export function buildGateIRRow(gate: RuntimeGate, options: { rowId?: string; selectedRouteIds?: string[]; routingDecision?: string; requiredApproval?: boolean; governedNodeIds?: string[] } = {}): GateIRRow {
  const activeTargetIds = targetIds(gate.routeControl.activates);
  const dormantTargetIds = targetIds(gate.routeControl.dormants);
  const suppressedTargetIds = targetIds(gate.routeControl.suppresses);
  const blockedTargetIds = targetIds(gate.routeControl.blocks);
  return {
    rowId: options.rowId ?? `gate_ir_${gate.id}`,
    nodeId: gate.id,
    nodeType: 'gate',
    gateKind: gate.gateKind,
    title: gate.title,
    selected: false,
    active: false,
    off: false,
    triggered: false,
    required: false,
    tagsMatched: [],
    state: gate.runtimeState.state,
    gatePassed: gate.runtimeState.passed,
    selectedRouteIds: options.selectedRouteIds ?? [],
    activeTargetIds,
    dormantTargetIds,
    suppressedTargetIds,
    blockedTargetIds,
    governedNodeIds: options.governedNodeIds ?? [...new Set([...activeTargetIds, ...dormantTargetIds, ...suppressedTargetIds, ...blockedTargetIds])],
    requiredApproval: options.requiredApproval ?? gate.runtimeState.state === 'requires_approval',
    routingDecision: options.routingDecision,
    reason: gate.runtimeState.reason,
    traceEventIds: gate.traceRefs
  };
}

function emptyRouteState() {
  return { active_paths: [], dormant_paths: [], suppressed_paths: [], blocked_paths: [] };
}

function governedNodeIdsForGate(workspace: UMGWorkspace, gate: RuntimeGate) {
  const nodeIds = workspace.graph.nodes.filter((node) => node.governingGateIds?.includes(gate.id)).map((node) => node.id);
  const edgeNodeIds = workspace.graph.edges
    .filter((edge) => edge.governingGateId === gate.id)
    .flatMap((edge) => [edge.source, edge.target]);
  return [...new Set([...nodeIds, ...edgeNodeIds])];
}

export function buildRuntimeGateContext(workspace: UMGWorkspace): RuntimeGateContext {
  return {
    gates: (workspace.runtimeGates ?? []).map((gate) => ({
      id: gate.id,
      sourceCardId: gate.sourceCardId,
      title: gate.title,
      gateKind: gate.gateKind,
      sourcePath: gate.sourcePath,
      placement: gate.placement,
      runtimeState: gate.runtimeState
    })),
    gate_decisions: [],
    route_state: emptyRouteState()
  };
}

export function buildGateIRRowsForWorkspace(workspace: UMGWorkspace): GateIRRow[] {
  return (workspace.runtimeGates ?? []).map((gate) => buildGateIRRow(gate, {
    rowId: `gate_ir_${gate.id}`,
    governedNodeIds: governedNodeIdsForGate(workspace, gate),
    requiredApproval: gate.gateKind === 'action_gate' && gate.runtimeState.state === 'requires_approval',
    routingDecision: 'not_evaluated'
  }));
}

export function attachGateContextToCompileResult(workspace: UMGWorkspace, result: { runtimeSpec: unknown; trace: Array<Record<string, unknown>>; irMatrix: Array<unknown> }) {
  const gate_context = buildRuntimeGateContext(workspace);
  const gateRows = buildGateIRRowsForWorkspace(workspace);
  if (gate_context.gates.length === 0) return result;
  const runtimeSpec = typeof result.runtimeSpec === 'object' && result.runtimeSpec !== null
    ? { ...result.runtimeSpec as Record<string, unknown>, gate_context }
    : { value: result.runtimeSpec, gate_context };
  const trace = [
    ...result.trace,
    ...gate_context.gates.map((gate) => ({ kind: 'gate_attached', gateId: gate.id, gateKind: gate.gateKind, sourceCardId: gate.sourceCardId, placement: gate.placement, evaluated: false, executed: false, reason: gate.runtimeState.reason }))
  ];
  return { ...result, runtimeSpec, trace, irMatrix: [...result.irMatrix, ...gateRows] };
}
