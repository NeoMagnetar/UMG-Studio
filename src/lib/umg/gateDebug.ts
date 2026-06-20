import { GlyphMatrix, GlyphMatrixLine } from './glyphMatrix';
import { CompileResult, GateIRRow, GraphEdge, GraphNode, RuntimeGate, UMGWorkspace } from './types';

export type RuntimeGateDebugView = {
  gateId: string;
  sourceCardId?: string;
  title: string;
  gateKind: RuntimeGate['gateKind'];
  sourcePath?: string;
  condition: string;
  placement?: {
    kind?: string;
    targetId?: string;
    targetLabel?: string;
  };
  routeControl: RuntimeGate['routeControl'];
  runtimeState: RuntimeGate['runtimeState'];
  gateIRRow?: GateIRRow;
  traceEvent?: Record<string, unknown>;
  glyphLine?: GlyphMatrixLine;
  graphPlacement?: {
    nodes: Array<Pick<GraphNode, 'id' | 'sourceId' | 'label' | 'nodeType' | 'governingGateIds' | 'gateKind' | 'gateLabel' | 'pathState' | 'debugExpandable'>>;
    edges: Array<Pick<GraphEdge, 'id' | 'source' | 'target' | 'governingGateId' | 'gateKind' | 'gateLabel' | 'pathState'>>;
  };
  safety: {
    evaluated: false;
    routeSwitching: false;
    liveExecution: false;
    promptContentMutation: false;
  };
};

export type BuildRuntimeGateDebugViewInput = {
  gateId: string;
  workspace?: UMGWorkspace;
  compiled?: CompileResult;
  glyphMatrix?: GlyphMatrix;
};

function isGateIRRow(row: unknown): row is GateIRRow {
  return Boolean(row && typeof row === 'object' && (row as GateIRRow).nodeType === 'gate');
}

function findGate(input: BuildRuntimeGateDebugViewInput) {
  return input.workspace?.runtimeGates?.find((gate) => gate.id === input.gateId);
}

function findGateIRRow(input: BuildRuntimeGateDebugViewInput) {
  return input.compiled?.irMatrix.find((row) => isGateIRRow(row) && row.nodeId === input.gateId) as GateIRRow | undefined;
}

function findTraceEvent(input: BuildRuntimeGateDebugViewInput) {
  return input.compiled?.trace.find((event) => event.gateId === input.gateId || event.id === input.gateId || event.traceId === input.gateId);
}

function findGlyphLine(input: BuildRuntimeGateDebugViewInput) {
  return input.glyphMatrix?.lines.find((line) => line.objectId === input.gateId || line.sourceGateIrRowId === `gate_ir_${input.gateId}`);
}

function graphPlacementForGate(input: BuildRuntimeGateDebugViewInput) {
  const nodes = (input.workspace?.graph.nodes ?? []).filter((node) => node.governingGateIds?.includes(input.gateId));
  const edges = (input.workspace?.graph.edges ?? []).filter((edge) => edge.governingGateId === input.gateId);
  return { nodes, edges };
}

function targetLabel(workspace: UMGWorkspace | undefined, targetId: string | undefined) {
  if (!targetId) return undefined;
  const node = workspace?.graph.nodes.find((candidate) => candidate.id === targetId || candidate.sourceId === targetId);
  if (node) return node.label;
  const edge = workspace?.graph.edges.find((candidate) => candidate.id === targetId);
  if (edge) return edge.label ?? `${edge.source} -> ${edge.target}`;
  return targetId;
}

export function buildRuntimeGateDebugView(input: BuildRuntimeGateDebugViewInput): RuntimeGateDebugView | undefined {
  const gate = findGate(input);
  if (!gate) return undefined;
  const gateIRRow = findGateIRRow(input);
  const traceEvent = findTraceEvent(input);
  const glyphLine = findGlyphLine(input);
  const graphPlacement = graphPlacementForGate(input);

  return {
    gateId: gate.id,
    sourceCardId: gate.sourceCardId,
    title: gate.title,
    gateKind: gate.gateKind,
    sourcePath: gate.sourcePath,
    condition: gate.condition,
    placement: gate.placement ? {
      kind: gate.placement.kind,
      targetId: gate.placement.targetId,
      targetLabel: targetLabel(input.workspace, gate.placement.targetId)
    } : undefined,
    routeControl: gate.routeControl,
    runtimeState: gate.runtimeState,
    gateIRRow,
    traceEvent,
    glyphLine,
    graphPlacement,
    safety: {
      evaluated: false,
      routeSwitching: false,
      liveExecution: false,
      promptContentMutation: false
    }
  };
}
