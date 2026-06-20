import { GateIRRow, GateKind, GraphEdge, GraphNode, IRMatrixRow } from './types';

export type GlyphMatrixViewMode = 'compact' | 'active_route' | 'full_sleeve' | 'blocked_paths' | 'gate_view' | 'debug' | 'tool_view';
export type GlyphStateGlyph = '[ ]' | '( )' | '[#]' | '[!]' | '[@]' | '[~]' | '[x]';
export type GlyphNodeClass = 'SLV' | 'S' | 'N' | 'M' | 'D' | 'Gt' | 'Gr' | 'Gv' | 'Ga' | 'R' | 'T' | 'TR';
export type GlyphRelation = '-->' | '==>' | '-x->' | '~~>' | '=>' | '::>' | '<->' | '^^';
export type GlyphState = 'inactive' | 'candidate' | 'active' | 'focus' | 'overlay_active' | 'compressed' | 'suppressed' | 'blocked' | 'requires_approval';

export type GlyphMatrixLine = {
  lineId: string;
  orderIndex: number;
  text: string;
  sourceIrRowId?: string;
  sourceGateIrRowId?: string;
  sourceTraceEventId?: string;
  nodeClass: GlyphNodeClass;
  state: GlyphState;
  stateGlyph: GlyphStateGlyph;
  objectId: string;
  objectTitle: string;
  relationOut?: GlyphRelation;
  traceRef?: string;
};

export type GlyphMatrix = {
  glyphMatrixId: string;
  sourceRuntimeSpecId?: string;
  sourceIrMatrixId?: string;
  sourceTraceId?: string;
  activeSleeveId?: string;
  activeRouteId?: string;
  viewMode: GlyphMatrixViewMode;
  legend: {
    stateGlyphs: Record<GlyphStateGlyph, string>;
    nodeClassGlyphs: Record<GlyphNodeClass, string>;
    relationGlyphs: Record<GlyphRelation, string>;
  };
  lines: GlyphMatrixLine[];
  warnings: string[];
};

type RuntimeGateSummary = {
  id?: string;
  title?: string;
  sourceCardId?: string;
  sourcePath?: string;
  gateKind?: GateKind;
  placement?: { kind?: string; targetId?: string };
  runtimeState?: { state?: string; passed?: boolean; reason?: string };
};

type RuntimeSpecWithGateContext = {
  id?: string;
  sleeveId?: string;
  activeRouteId?: string;
  gate_context?: {
    gates?: RuntimeGateSummary[];
    gate_decisions?: unknown[];
    route_state?: {
      active_paths?: string[];
      dormant_paths?: string[];
      suppressed_paths?: string[];
      blocked_paths?: string[];
    };
  };
};

type GraphLike = { nodes?: GraphNode[]; edges?: GraphEdge[] };

export type ProjectGlyphMatrixInput = {
  runtimeSpec?: unknown;
  irMatrix: Array<IRMatrixRow | GateIRRow>;
  trace?: Array<Record<string, unknown>>;
  graph?: GraphLike;
  activeSleeveId?: string;
  viewMode?: GlyphMatrixViewMode;
};

export const glyphMatrixLegend: GlyphMatrix['legend'] = {
  stateGlyphs: {
    '[ ]': 'dormant / off / inactive / not selected',
    '( )': 'candidate / available / attached but unevaluated',
    '[#]': 'active / selected runtime block or active route from source truth',
    '[!]': 'current focus / requires approval / diagnostic attention',
    '[@]': 'overlay-active / UI overlay focus only',
    '[~]': 'compressed into higher unit',
    '[x]': 'suppressed / blocked / rejected'
  },
  nodeClassGlyphs: {
    SLV: 'Sleeve',
    S: 'NeoStack',
    N: 'NeoBlock',
    M: 'MOLT block',
    D: 'Directive shortcut',
    Gt: 'TriggerGate',
    Gr: 'RoutingGate',
    Gv: 'GovernanceGate',
    Ga: 'ActionGate',
    R: 'Render/output node',
    T: 'ToolProposal future only',
    TR: 'ToolResult future only'
  },
  relationGlyphs: {
    '-->': 'possible / candidate / unevaluated route',
    '==>': 'active route from runtime source truth',
    '-x->': 'blocked or suppressed path',
    '~~>': 'influence / bias',
    '=>': 'compression upward / containment',
    '::>': 'overlay influence',
    '<->': 'lateral / peer relation',
    '^^': 'top-down supervisory relation'
  }
};

const gateClassByKind: Record<GateKind, GlyphNodeClass> = {
  trigger_gate: 'Gt',
  routing_gate: 'Gr',
  governance_gate: 'Gv',
  action_gate: 'Ga'
};

function gateNumber(index: number) {
  return String(index + 1).padStart(3, '0');
}

function isGateRow(row: IRMatrixRow | GateIRRow): row is GateIRRow {
  return row.nodeType === 'gate';
}

function isMoltRow(row: IRMatrixRow | GateIRRow): row is IRMatrixRow {
  return row.nodeType === 'molt_block';
}

function sourceRuntimeSpec(runtimeSpec: unknown): RuntimeSpecWithGateContext {
  return runtimeSpec && typeof runtimeSpec === 'object' ? runtimeSpec as RuntimeSpecWithGateContext : {};
}

function traceEventId(event: Record<string, unknown>, index: number) {
  return String(event.id ?? event.traceId ?? event.eventId ?? `trace_${index + 1}`);
}

function targetLabel(targetIds: string[], graph?: GraphLike) {
  const targetId = targetIds[0];
  if (!targetId) return 'governed target';
  const node = graph?.nodes?.find((candidate) => candidate.id === targetId || candidate.sourceId === targetId);
  return node?.label ?? targetId;
}

function lineTextPrefix(stateGlyph: GlyphStateGlyph, nodeClass: GlyphNodeClass, objectTitle: string, relationOut?: GlyphRelation, traceRef?: string) {
  const tracePrefix = traceRef ? `${traceRef} ` : '';
  return `${tracePrefix}${stateGlyph} ${nodeClass} ${objectTitle}${relationOut ? ` ${relationOut}` : ''}`;
}

function moltLine(row: IRMatrixRow, orderIndex: number): GlyphMatrixLine {
  const state: GlyphState = row.off || !row.active ? 'inactive' : 'active';
  const stateGlyph: GlyphStateGlyph = state === 'active' ? '[#]' : '[ ]';
  const relationOut: GlyphRelation | undefined = state === 'active' ? '==>' : undefined;
  const nodeClass: GlyphNodeClass = 'M';
  return {
    lineId: `glyph_${row.rowId}`,
    orderIndex,
    sourceIrRowId: row.rowId,
    nodeClass,
    state,
    stateGlyph,
    objectId: row.nodeId,
    objectTitle: row.title,
    relationOut,
    text: lineTextPrefix(stateGlyph, nodeClass, row.title, relationOut)
  };
}

function gateLine(row: GateIRRow, orderIndex: number, gateIndex: number, graph?: GraphLike, runtimeGate?: RuntimeGateSummary): GlyphMatrixLine {
  const nodeClass = gateClassByKind[row.gateKind];
  const hasActivePath = row.gatePassed === true && row.activeTargetIds.length > 0;
  const hasBlockedPath = row.blockedTargetIds.length > 0 || row.suppressedTargetIds.length > 0 || row.state === 'blocked' || row.state === 'suppressed';
  const state: GlyphState = row.requiredApproval || row.state === 'requires_approval'
    ? 'requires_approval'
    : hasBlockedPath
      ? 'blocked'
      : hasActivePath
        ? 'active'
        : 'candidate';
  const stateGlyph: GlyphStateGlyph = state === 'active' ? '[#]' : state === 'blocked' ? '[x]' : state === 'requires_approval' ? '[!]' : '( )';
  const relationOut: GlyphRelation = state === 'active' ? '==>' : state === 'blocked' || state === 'requires_approval' ? '-x->' : '-->';
  const target = targetLabel([...row.activeTargetIds, ...row.dormantTargetIds, ...row.suppressedTargetIds, ...row.blockedTargetIds, ...row.governedNodeIds], graph);
  const objectTitle = row.title;
  const gateId = `${nodeClass}.${gateNumber(gateIndex)}`;
  const details = ` ${target}; state: ${row.state} / ${row.routingDecision ?? 'not_evaluated'}${runtimeGate?.sourceCardId ? `; sourceCardId: ${runtimeGate.sourceCardId}` : ''}${runtimeGate?.sourcePath ? `; sourcePath: ${runtimeGate.sourcePath}` : ''}; gatePassed: ${String(row.gatePassed)}${row.reason ? `; reason: ${row.reason}` : ''}`;
  return {
    lineId: `glyph_${row.rowId}`,
    orderIndex,
    sourceGateIrRowId: row.rowId,
    nodeClass,
    state,
    stateGlyph,
    objectId: row.nodeId,
    objectTitle,
    relationOut,
    traceRef: row.traceEventIds[0],
    text: `${stateGlyph} ${gateId} ${objectTitle} ${relationOut} ${details}`
  };
}

function gateContextLines(runtimeSpec: RuntimeSpecWithGateContext, gateRows: GateIRRow[], startingIndex: number, graph?: GraphLike) {
  const rowsByNodeId = new Map(gateRows.map((row) => [row.nodeId, row]));
  return (runtimeSpec.gate_context?.gates ?? [])
    .filter((gate) => gate.id && !rowsByNodeId.has(String(gate.id)))
    .map((gate, index): GlyphMatrixLine => {
      const gateKind = gate.gateKind ?? 'trigger_gate';
      const nodeClass = gateClassByKind[gateKind];
      const active = gate.runtimeState?.passed === true;
      const state: GlyphState = active ? 'active' : 'candidate';
      const stateGlyph: GlyphStateGlyph = active ? '[#]' : '( )';
      const relationOut: GlyphRelation = active ? '==>' : '-->';
      const title = gate.title ?? gate.id ?? 'RuntimeGate';
      const target = targetLabel([String(gate.placement?.targetId ?? '')], graph);
      const gateId = `${nodeClass}.${gateNumber(index)}`;
      return {
        lineId: `glyph_gate_context_${gate.id ?? index}`,
        orderIndex: startingIndex + index,
        nodeClass,
        state,
        stateGlyph,
        objectId: String(gate.id ?? `gate_${index + 1}`),
        objectTitle: title,
        relationOut,
        text: `${stateGlyph} ${gateId} ${title} ${relationOut} ${target}; state: ${gate.runtimeState?.state ?? 'inactive'} / not_evaluated; sourceCardId: ${gate.sourceCardId ?? 'n/a'}; gatePassed: ${String(gate.runtimeState?.passed === true)}`
      };
    });
}

function traceLines(trace: Array<Record<string, unknown>>, startingIndex: number): GlyphMatrixLine[] {
  return trace.map((event, index) => {
    const id = traceEventId(event, index);
    const title = String(event.title ?? event.kind ?? event.code ?? id);
    return {
      lineId: `glyph_trace_${id}`,
      orderIndex: startingIndex + index,
      sourceTraceEventId: id,
      nodeClass: 'R',
      state: 'compressed',
      stateGlyph: '[~]',
      objectId: id,
      objectTitle: title,
      traceRef: `(${index + 1})`,
      text: `(${index + 1}) [~] R ${title}`
    } satisfies GlyphMatrixLine;
  });
}

export function projectGlyphMatrix(input: ProjectGlyphMatrixInput): GlyphMatrix {
  const runtimeSpec = sourceRuntimeSpec(input.runtimeSpec);
  const viewMode = input.viewMode ?? 'compact';
  const lines: GlyphMatrixLine[] = [];
  const warnings: string[] = [];
  const activeSleeveId = input.activeSleeveId ?? runtimeSpec.sleeveId;
  const activeRouteId = runtimeSpec.activeRouteId ?? runtimeSpec.gate_context?.route_state?.active_paths?.[0];

  lines.push({
    lineId: 'glyph_sleeve_active',
    orderIndex: 0,
    nodeClass: 'SLV',
    state: activeSleeveId ? 'active' : 'inactive',
    stateGlyph: activeSleeveId ? '[#]' : '[ ]',
    objectId: activeSleeveId ?? 'unknown_sleeve',
    objectTitle: activeSleeveId ?? 'No active sleeve',
    relationOut: '=>',
    text: `${activeSleeveId ? '[#]' : '[ ]'} SLV ${activeSleeveId ?? 'No active sleeve'} =>`
  });

  const moltRows = input.irMatrix.filter(isMoltRow);
  const gateRows = input.irMatrix.filter(isGateRow);

  const compactMoltRows = viewMode === 'compact' ? moltRows.slice(0, 12) : moltRows;
  compactMoltRows.forEach((row) => lines.push(moltLine(row, lines.length)));
  if (viewMode === 'compact' && moltRows.length > compactMoltRows.length) {
    lines.push({
      lineId: 'glyph_molt_compressed',
      orderIndex: lines.length,
      nodeClass: 'N',
      state: 'compressed',
      stateGlyph: '[~]',
      objectId: 'compressed_molt_rows',
      objectTitle: `${moltRows.length - compactMoltRows.length} additional MOLT rows`,
      relationOut: '=>',
      text: `[~] N ${moltRows.length - compactMoltRows.length} additional MOLT rows =>`
    });
  }

  const runtimeGatesById = new Map((runtimeSpec.gate_context?.gates ?? []).filter((gate) => gate.id).map((gate) => [String(gate.id), gate]));
  gateRows.forEach((row, index) => lines.push(gateLine(row, lines.length, index, input.graph, runtimeGatesById.get(row.nodeId))));
  lines.push(...gateContextLines(runtimeSpec, gateRows, lines.length, input.graph));

  if (viewMode === 'debug' || viewMode === 'gate_view' || viewMode === 'compact') {
    lines.push(...traceLines(input.trace ?? [], lines.length));
  }

  if ((runtimeSpec.gate_context?.gate_decisions ?? []).length === 0 && gateRows.length > 0) {
    warnings.push('Gate decisions are empty; Glyph Matrix renders attached gates as projection-only unless GateIRRows declare source-truth path state.');
  }

  return {
    glyphMatrixId: `glyph_${activeSleeveId ?? 'runtime'}_${viewMode}`,
    sourceRuntimeSpecId: runtimeSpec.id ?? runtimeSpec.sleeveId,
    sourceIrMatrixId: input.irMatrix.length ? 'compiled.irMatrix' : undefined,
    sourceTraceId: input.trace?.length ? 'compiled.trace' : undefined,
    activeSleeveId,
    activeRouteId,
    viewMode,
    legend: glyphMatrixLegend,
    lines,
    warnings
  };
}

export function renderGlyphMatrixText(matrix: GlyphMatrix) {
  return matrix.lines.map((line) => line.text).join('\n');
}
