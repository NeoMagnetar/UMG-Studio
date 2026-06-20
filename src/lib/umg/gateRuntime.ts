import { GateIRRow, GateKind, GateRouteControl, GateScopeTarget, RuntimeGate } from './types';

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
    sourcePath: input.sourcePath
  };
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
