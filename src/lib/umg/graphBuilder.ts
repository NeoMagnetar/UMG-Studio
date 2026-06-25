import { CompileResult, GateIRRow, GateKind, GateVisualPathState, GraphEdge, GraphFocus, GraphLayoutItem, GraphNode, IRMatrixRow, MOLTRole, MOLTDisplayType, Sleeve } from './types';

const knownMoltRoles: Array<MOLTRole | 'meta' | MOLTDisplayType> = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint', 'meta'];

const normalizeMoltRole = (value?: string): MOLTDisplayType | 'unknown' => {
  if (!value) return 'unknown';
  const role = value.toLowerCase();
  return knownMoltRoles.includes(role as MOLTRole | 'meta') ? (role as MOLTDisplayType) : 'unknown';
};

const active = (off: boolean) => ({ selected: false, active: !off, off, triggered: false, invalid: false });

const containmentRelationFor = (sourceType: GraphNode['nodeType'], targetType: GraphNode['nodeType']) => {
  if (sourceType === 'molt_block' && targetType === 'neoblock') return 'sequence';
  if (sourceType === 'neoblock' && targetType === 'neostack') return 'supports';
  if (sourceType === 'neostack' && targetType === 'sleeve') return 'governs';
  return 'contains';
};

const nodeSnapBaseOffset = (sourceType: GraphNode['nodeType'], targetType: GraphNode['nodeType']) => {
  if (sourceType === 'molt_block' && targetType === 'neoblock') return { x: 290, y: 100, strideY: 82 };
  if (sourceType === 'neoblock' && targetType === 'neostack') return { x: 290, y: 140, strideY: 170 };
  if (sourceType === 'neostack' && targetType === 'sleeve') return { x: 260, y: 260, strideY: 220 };
  return { x: 240, y: 120, strideY: 90 };
};

export function buildGraphFromSleeve(sleeve: Sleeve) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  nodes.push({ id: `node_${sleeve.id}`, sourceId: sleeve.id, nodeType: 'sleeve', label: sleeve.title, position: { x: 40, y: 160 }, layout: { row: 0, column: 0, width: 2, height: 1, priorityRank: 0, relation: 'governs' }, state: active(false) });
  sleeve.stacks.forEach((s, si) => {
    const sid = `node_${s.id}`;
    nodes.push({ id: sid, sourceId: s.id, nodeType: 'neostack', label: s.title, position: { x: 320, y: 80 + si * 240 }, layout: { row: si + 1, column: si % 2, width: 2, height: 1, priorityRank: si, relation: si === 0 ? 'sequence' : 'parallel' }, state: active(s.defaultState === 'off') });
    edges.push({ id: `e_${sleeve.id}_${s.id}`, source: `node_${sleeve.id}`, target: sid, type: 'contains' });
    s.neoblocks.forEach((nb, ni) => {
      const nid = `node_${nb.id}`;
      nodes.push({ id: nid, sourceId: nb.id, nodeType: 'neoblock', label: nb.title, position: { x: 620, y: 60 + si * 260 + ni * 170 }, layout: { row: Math.floor(ni / 2), column: ni % 2, width: 1, height: 1, priorityRank: nb.priorityOrder ?? ni, relation: ni === 0 ? 'governs' : 'parallel' }, state: active(nb.defaultState === 'off') });
      edges.push({ id: `e_${s.id}_${nb.id}`, source: sid, target: nid, type: 'contains' });
      nb.blocks.forEach((b, bi) => {
        const bid = `node_${b.id}`;
        nodes.push({
          id: bid,
          sourceId: b.id,
          nodeType: 'molt_block',
          label: b.title,
          position: { x: 940, y: 20 + si * 280 + ni * 170 + bi * 72 },
          layout: { row: bi, column: 0, width: 1, height: 1, priorityRank: b.priorityOrder ?? bi, relation: bi === 0 ? 'governs' : b.role === 'blueprint' ? 'supports' : 'sequence' },
          state: { ...active(b.defaultState === 'off'), invalid: !b.content, warning: !b.content ? 'Empty block content' : undefined },
          moltRole: normalizeMoltRole(b.role)
        });
        edges.push({ id: `e_${nb.id}_${b.id}`, source: nid, target: bid, type: 'contains', label: b.role });
      });
    });
  });
  nodes.push({ id: `node_output_${sleeve.id}`, sourceId: `output_${sleeve.id}`, nodeType: 'output', label: 'Compiler / Hermes Output', position: { x: 1260, y: 160 }, layout: { row: 99, column: 0, relation: 'supports' }, state: active(false) });
  const leaves = nodes.filter((n) => n.nodeType === 'molt_block' && !n.state.off);
  leaves.slice(-2).forEach((n) => edges.push({ id: `e_${n.id}_out`, source: n.id, target: `node_output_${sleeve.id}`, type: 'compiles_to' }));
  return { nodes, edges };
}

const gatePrefix: Record<GateKind, string> = {
  trigger_gate: 'Gt',
  routing_gate: 'Gr',
  governance_gate: 'Gv',
  action_gate: 'Ga'
};

const pathPriority: Record<GateVisualPathState, number> = {
  active: 1,
  candidate: 2,
  dormant: 3,
  evaluating: 4,
  suppressed: 5,
  requires_approval: 6,
  blocked: 7
};

const gateClassSuffix: Record<GateKind, string> = {
  trigger_gate: 'trigger',
  routing_gate: 'routing',
  governance_gate: 'governance',
  action_gate: 'action'
};

export function gateVisualMetadataForEdge(edge: Partial<GraphEdge>) {
  if (!edge.gateKind && !edge.gateLabel && !edge.governingGateId) return { renderGateStrip: false as const, label: '', className: '' };
  const gateKind = edge.gateKind ?? 'trigger_gate';
  return {
    renderGateStrip: true as const,
    label: edge.gateLabel ?? `${gatePrefix[gateKind]}: ${edge.governingGateId ?? 'gate'}`,
    className: `gate-strip gate-strip-${gateClassSuffix[gateKind]}`
  };
}

export function gateVisualMetadataForNode(node: Partial<GraphNode>) {
  if (!node.gateKind && !node.gateLabel && !(node.governingGateIds?.length)) return { renderGateBadge: false as const, label: '', className: '' };
  const gateKind = node.gateKind ?? 'trigger_gate';
  return {
    renderGateBadge: true as const,
    label: node.gateLabel ?? `${gatePrefix[gateKind]}: ${node.governingGateIds?.[0] ?? 'gate'}`,
    className: `gate-badge gate-badge-${gateClassSuffix[gateKind]}`
  };
}

type GateProjection = {
  pathState: GateVisualPathState;
  governingGateId: string;
  gateKind: GateKind;
  gateLabel: string;
  glyphId: string;
  governanceOverride: boolean;
};

function chooseProjection(current: GateProjection | undefined, candidate: GateProjection) {
  if (!current) return candidate;
  return pathPriority[candidate.pathState] >= pathPriority[current.pathState] ? candidate : current;
}

function addProjection(map: Map<string, GateProjection>, targetId: string, projection: GateProjection) {
  map.set(targetId, chooseProjection(map.get(targetId), projection));
}

function labelForGate(row: GateIRRow) {
  return `${gatePrefix[row.gateKind]}: ${row.title}`;
}

function glyphForGate(row: GateIRRow, index: number) {
  return `${gatePrefix[row.gateKind]}.${String(index + 1).padStart(3, '0')}`;
}

function collectGateProjections(gateRows: GateIRRow[]) {
  const projections = new Map<string, GateProjection>();
  gateRows.forEach((row, index) => {
    const base = { governingGateId: row.nodeId, gateKind: row.gateKind, gateLabel: labelForGate(row), glyphId: glyphForGate(row, index) };
    row.activeTargetIds.forEach((targetId) => addProjection(projections, targetId, { ...base, pathState: 'active', governanceOverride: false }));
    row.dormantTargetIds.forEach((targetId) => addProjection(projections, targetId, { ...base, pathState: 'dormant', governanceOverride: false }));
    row.suppressedTargetIds.forEach((targetId) => addProjection(projections, targetId, { ...base, pathState: 'suppressed', governanceOverride: row.gateKind === 'governance_gate' }));
    row.blockedTargetIds.forEach((targetId) => addProjection(projections, targetId, { ...base, pathState: row.requiredApproval || row.state === 'requires_approval' ? 'requires_approval' : 'blocked', governanceOverride: row.gateKind === 'governance_gate' || row.gateKind === 'action_gate' || row.requiredApproval }));
  });
  return projections;
}

function nodeLookup(nodes: GraphNode[]) {
  const ids = new Map<string, GraphNode>();
  nodes.forEach((node) => {
    ids.set(node.id, node);
    ids.set(node.sourceId, node);
  });
  return ids;
}

function edgeProjection(edge: GraphEdge, nodesById: Map<string, GraphNode>, projections: Map<string, GateProjection>) {
  const target = nodesById.get(edge.target);
  const source = nodesById.get(edge.source);
  return projections.get(edge.routeId ?? '') ?? projections.get(target?.sourceId ?? '') ?? projections.get(target?.id ?? '') ?? projections.get(source?.sourceId ?? '') ?? projections.get(source?.id ?? '');
}

export function projectGateRowsToGraph(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, gateRows: GateIRRow[]) {
  if (gateRows.length === 0) return { ...graph, nodes: graph.nodes.map((node) => ({ ...node })), edges: graph.edges.map((edge) => ({ ...edge })) };
  const projections = collectGateProjections(gateRows);
  const nodes = graph.nodes.map((node) => {
    const projection = projections.get(node.sourceId) ?? projections.get(node.id);
    if (!projection) return { ...node };
    const governingGateIds = [...new Set([...(node.governingGateIds ?? []), projection.governingGateId])];
    return {
      ...node,
      pathState: projection.pathState,
      governingGateIds,
      gateKind: projection.gateKind,
      gateLabel: projection.gateLabel,
      glyphId: projection.glyphId,
      debugExpandable: true,
      state: { ...node.state, invalid: node.state.invalid }
    };
  });
  const nodesById = nodeLookup(nodes);
  const edges = graph.edges.map((edge) => {
    const projection = edgeProjection(edge, nodesById, projections);
    if (!projection) return { ...edge };
    return {
      ...edge,
      pathState: projection.pathState,
      governingGateId: projection.governingGateId,
      gateKind: projection.gateKind,
      gateLabel: projection.gateLabel,
      governanceOverride: projection.governanceOverride
    };
  });
  return { ...graph, nodes, edges };
}

function eventNodeIds(event: Record<string, unknown>) {
  const ids = new Set<string>();
  const direct = event.nodeId ?? event.sourceId ?? event.blockId ?? event.stackId;
  if (direct) ids.add(String(direct));
  for (const key of ['relatedBlockIds', 'relatedStackIds', 'relatedNodeIds']) {
    const value = event[key];
    if (Array.isArray(value)) value.forEach((id) => ids.add(String(id)));
  }
  return ids;
}

function eventLooksTriggered(event: Record<string, unknown>) {
  const text = `${event.code ?? ''} ${event.kind ?? ''} ${event.message ?? ''}`.toLowerCase();
  return event.triggered === true || event.gatePassed === true || text.includes('trigger') || text.includes('activate');
}

function rowForNode(node: GraphNode, rowsById: Map<string, IRMatrixRow>) {
  return rowsById.get(node.sourceId) ?? rowsById.get(node.id);
}

export function applyCompileResultToGraph(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, compiled: CompileResult) {
  const rowsById = new Map(compiled.irMatrix.map((row) => [row.nodeId, row]));
  const diagnosticsById = new Map<string, { message: string; severity: 'info' | 'warning' | 'error' }>();
  for (const diagnostic of compiled.diagnostics) {
    if (!diagnostic.nodeId || diagnostic.severity === 'info') continue;
    diagnosticsById.set(diagnostic.nodeId, { message: diagnostic.message, severity: diagnostic.severity });
  }

  const triggeredIds = new Set<string>();
  for (const event of compiled.trace) {
    if (!eventLooksTriggered(event)) continue;
    eventNodeIds(event).forEach((id) => triggeredIds.add(id));
  }
  for (const row of compiled.irMatrix) {
    if (row.triggered) triggeredIds.add(row.nodeId);
  }

  const nodes = graph.nodes.map((node) => {
    const row = rowForNode(node, rowsById);
    const diagnostic = diagnosticsById.get(node.sourceId) ?? diagnosticsById.get(node.id);
    const manuallyOff = node.state.off;
    const activeFromCompile = row ? row.active && !row.off : node.state.active;
    const off = manuallyOff || Boolean(row?.off);
    const active = off ? false : activeFromCompile;
    const triggered = !off && (node.state.triggered || triggeredIds.has(node.sourceId) || triggeredIds.has(node.id));
    return {
      ...node,
      state: {
        ...node.state,
        active,
        off,
        triggered,
        invalid: diagnostic?.severity === 'error' || node.state.invalid,
        warning: diagnostic?.message ?? row?.warning ?? node.state.warning
      }
    };
  });

  return { ...graph, nodes };
}

export function canContainGraphNodes(sourceType: GraphNode['nodeType'], targetType: GraphNode['nodeType']) {
  if (sourceType === 'molt_block') {
    return targetType === 'neoblock';
  }
  if (sourceType === 'neoblock') return targetType === 'neostack';
  if (sourceType === 'neostack') return targetType === 'sleeve';
  return false;
}

export function collectContainmentChildren(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, sourceId: string, acc = new Set<string>()) {
  graph.edges.forEach((edge) => {
    if (edge.type !== 'contains' || edge.source !== sourceId || acc.has(edge.target)) return;
    acc.add(edge.target);
    collectContainmentChildren(graph, edge.target, acc);
  });
  return acc;
}

export function applyContainmentSnap(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, sourceSourceId: string, targetSourceId: string) {
  const source = graph.nodes.find((node) => node.sourceId === sourceSourceId || node.id === sourceSourceId);
  const target = graph.nodes.find((node) => node.sourceId === targetSourceId || node.id === targetSourceId);
  if (!source || !target) return graph;
  if (!canContainGraphNodes(source.nodeType, target.nodeType)) return graph;

  const siblings = graph.edges
    .filter((edge) => edge.type === 'contains' && edge.source === target.id)
    .map((edge) => edge.target);

  const base = nodeSnapBaseOffset(source.nodeType, target.nodeType);
  const position = {
    x: target.position.x + base.x,
    y: target.position.y + base.y + Math.min(base.strideY, 0) * 0 + siblings.length * base.strideY
  };

  const relation = containmentRelationFor(source.nodeType, target.nodeType);

  const edgeId = `e_${target.id}_contains_${source.id}`;
  const filtered = graph.edges.filter((edge) => !(edge.type === 'contains' && edge.target === source.id));
  if (!filtered.some((edge) => edge.type === 'contains' && edge.source === target.id && edge.target === source.id)) {
    filtered.push({ id: edgeId, source: target.id, target: source.id, type: 'contains' });
  }

  const nextNodes = graph.nodes.map((node) => {
    if (node.id !== source.id) return node;
    return {
      ...node,
      position,
      layout: {
        ...(node.layout ?? {}),
        manual: true,
        manualOverride: true,
        relation,
        snapTargetId: target.sourceId,
        snapGroupId: `snap_${target.sourceId}`
      }
    };
  });

  return {
    ...graph,
    nodes: nextNodes,
    edges: filtered
  };
}

export function applyManualLayout(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, sourceId: string, layout: GraphLayoutItem) {
  const nodes = graph.nodes.map((node) => {
    if (node.sourceId !== sourceId && node.id !== sourceId) return node;
    return {
      ...node,
      position: { x: layout.x ?? node.position.x, y: layout.y ?? node.position.y },
      layout: { ...(node.layout ?? {}), ...layout, manual: layout.manual ?? true, manualOverride: layout.manualOverride ?? true }
    };
  });
  return { ...graph, nodes };
}

export function selectGraphNode(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, sourceId: string, focus: GraphFocus) {
  const selected = graph.nodes.find((node) => node.sourceId === sourceId || node.id === sourceId);
  return { graph, selected, focus };
}

export function openSelectedAsFocus(selected: GraphNode, current: GraphFocus): GraphFocus {
  if (selected.nodeType === 'sleeve') return { mode: 'sleeve', sourceId: selected.sourceId };
  if (selected.nodeType === 'neostack') return { mode: 'neostack', sourceId: selected.sourceId };
  if (selected.nodeType === 'neoblock') return { mode: 'neoblock', sourceId: selected.sourceId };
  if (selected.nodeType === 'molt_block') return { mode: 'molt_block', sourceId: selected.sourceId };
  return current;
}

export function applySnapLayout(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, sourceId: string, targetSourceId: string, options: { threshold?: number; relation?: GraphLayoutItem['relation'] } = {}) {
  const threshold = options.threshold ?? 16;
  const target = graph.nodes.find((node) => node.sourceId === targetSourceId || node.id === targetSourceId);
  const source = graph.nodes.find((node) => node.sourceId === sourceId || node.id === sourceId);
  if (!target || !source) return graph;
  const dx = Math.abs(source.position.x - target.position.x);
  const dy = Math.abs(source.position.y - target.position.y);
  const touchingHorizontal = Math.abs(source.position.x - (target.position.x + 260)) <= threshold || Math.abs(target.position.x - (source.position.x + 260)) <= threshold;
  const sameRowAttach = dy <= threshold + 8 && dx <= 260;
  const near = dx <= threshold || dy <= threshold || touchingHorizontal || sameRowAttach;
  if (!near) return graph;
  const relation = options.relation ?? (source.position.y < target.position.y ? 'governs' : Math.abs(source.position.y - target.position.y) <= threshold ? 'parallel' : 'supports');
  const snapX = relation === 'parallel' ? target.position.x + 260 : target.position.x;
  const snapY = relation === 'parallel' ? target.position.y : source.position.y < target.position.y ? target.position.y - 150 : target.position.y + 150;
  return applyManualLayout(graph, sourceId, { x: snapX, y: snapY, relation, manual: true, manualOverride: true, locked: true, snapTargetId: target.sourceId, snapGroupId: `snap_${target.sourceId}` });
}

export function resetManualLayout(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, sourceId?: string) {
  const nodes = graph.nodes.map((node) => {
    if (sourceId && node.sourceId !== sourceId && node.id !== sourceId) return node;
    const { x, y, manual, ...rest } = node.layout ?? {};
    return { ...node, layout: rest };
  });
  return { ...graph, nodes };
}

export function focusGraph(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, focus: GraphFocus) {
  const focusNode = focus.sourceId ? graph.nodes.find((node) => node.sourceId === focus.sourceId || node.id === focus.sourceId) : graph.nodes.find((node) => node.nodeType === 'sleeve');

  const collectContainmentAncestors = (nodeId: string, acc: Set<string>) => {
    const frontier = [nodeId];
    while (frontier.length > 0) {
      const current = frontier.shift();
      if (!current) continue;
      for (const edge of graph.edges) {
        if (edge.type !== 'contains' || edge.target !== current || acc.has(edge.source)) continue;
        acc.add(edge.source);
        frontier.push(edge.source);
      }
    }
  };

  const keep = new Set<string>();
  if (focus.mode === 'sleeve') {
    for (const node of graph.nodes) if (node.nodeType === 'sleeve' || node.nodeType === 'neostack') keep.add(node.id);
  } else if (focus.mode === 'molt_block') {
    if (focusNode) keep.add(focusNode.id);
  } else if (focusNode) {
    keep.add(focusNode.id);
    for (const edge of graph.edges) if (edge.type === 'contains' && edge.source === focusNode.id) keep.add(edge.target);
    if (focus.mode === 'neostack' || focus.mode === 'neoblock') {
      collectContainmentAncestors(focusNode.id, keep);
    }
  } else {
    for (const node of graph.nodes) if (node.nodeType === 'sleeve') keep.add(node.id);
  }

  const nodes = graph.nodes.filter((node) => keep.has(node.id)).map((node, index) => {
    const autoPosition = hierarchyPosition(node, focus.mode, index);
    const focused = focusNode ? node.id === focusNode.id : node.nodeType === 'sleeve';
    const position = node.layout?.manual ? node.position : autoPosition;
    return { ...node, position, visual: { focused, dimmed: false } };
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = focus.mode === 'sleeve' ? graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)).map((edge) => ({ ...edge })) : [];
  return { ...graph, nodes, edges, viewport: { ...(graph as any).viewport, zoom: focus.mode === 'sleeve' ? 0.75 : focus.mode === 'neostack' ? 0.9 : 1.05, x: focusNode?.position.x ?? 0, y: focusNode?.position.y ?? 0, focusNodeId: focusNode?.id } };
}

function hierarchyPosition(node: GraphNode, mode: GraphFocus['mode'], index: number) {
  if (mode === 'sleeve') {
    if (node.nodeType === 'sleeve') return { x: 420, y: 40 };
    return { x: 180 + Math.max(0, index - 1) * 280, y: 220 };
  }
  if (mode === 'neostack') {
    if (node.nodeType === 'neostack') return { x: 420, y: 40 };
    const child = Math.max(0, index - 1);
    return { x: 180 + (child % 3) * 260, y: 220 + Math.floor(child / 3) * 150 };
  }
  if (mode === 'neoblock') {
    if (node.nodeType === 'neoblock') return { x: 420, y: 40 };
    const child = Math.max(0, index - 1);
    return { x: 120 + (child % 3) * 250, y: 210 + Math.floor(child / 3) * 130 };
  }
  return { x: 360, y: 160 };
}
