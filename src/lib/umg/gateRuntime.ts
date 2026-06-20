import { GateIRRow, GateKind, GateRouteControl, GateScopeTarget, GraphEdge, GraphNode, RuntimeGate, TriggerGateSourceCard } from './types';

export const GATE_KINDS: GateKind[] = ['trigger_gate', 'routing_gate', 'governance_gate', 'action_gate'];

const emptyRouteControl = (): GateRouteControl => ({ activates: [], dormants: [], suppresses: [], blocks: [] });
const targetIds = (targets: GateScopeTarget[]) => targets.map((target) => target.targetId);

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
    sourceCardId: input.sourceCardId
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

export function attachRuntimeGateToGraph(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, gate: RuntimeGate, placement: GateAttachmentPlacement, existingRuntimeGates: RuntimeGate[] = []) {
  const gateLabel = compactGateLabel(gate);
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
  return { graph: { ...graph, nodes, edges }, runtimeGates: [...existingRuntimeGates, gate] };
}

export function buildGateIRRow(gate: RuntimeGate, options: { rowId?: string; selectedRouteIds?: string[]; routingDecision?: string; requiredApproval?: boolean } = {}): GateIRRow {
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
    state: gate.runtimeState.state,
    gatePassed: gate.runtimeState.passed,
    selectedRouteIds: options.selectedRouteIds ?? [],
    activeTargetIds,
    dormantTargetIds,
    suppressedTargetIds,
    blockedTargetIds,
    governedNodeIds: [...new Set([...activeTargetIds, ...dormantTargetIds, ...suppressedTargetIds, ...blockedTargetIds])],
    requiredApproval: options.requiredApproval ?? gate.runtimeState.state === 'requires_approval',
    routingDecision: options.routingDecision,
    reason: gate.runtimeState.reason,
    traceEventIds: gate.traceRefs
  };
}
