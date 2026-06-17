import { CompileResult, GraphEdge, GraphFocus, GraphNode, IRMatrixRow, Sleeve } from './types';

const active = (off: boolean) => ({ selected: false, active: !off, off, triggered: false, invalid: false });

export function buildGraphFromSleeve(sleeve: Sleeve) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  nodes.push({ id: `node_${sleeve.id}`, sourceId: sleeve.id, nodeType: 'sleeve', label: sleeve.title, position: { x: 40, y: 160 }, state: active(false) });
  sleeve.stacks.forEach((s, si) => {
    const sid = `node_${s.id}`;
    nodes.push({ id: sid, sourceId: s.id, nodeType: 'neostack', label: s.title, position: { x: 320, y: 80 + si * 240 }, state: active(s.defaultState === 'off') });
    edges.push({ id: `e_${sleeve.id}_${s.id}`, source: `node_${sleeve.id}`, target: sid, type: 'contains' });
    s.neoblocks.forEach((nb, ni) => {
      const nid = `node_${nb.id}`;
      nodes.push({ id: nid, sourceId: nb.id, nodeType: 'neoblock', label: nb.title, position: { x: 620, y: 60 + si * 260 + ni * 170 }, state: active(nb.defaultState === 'off') });
      edges.push({ id: `e_${s.id}_${nb.id}`, source: sid, target: nid, type: 'contains' });
      nb.blocks.forEach((b, bi) => {
        const bid = `node_${b.id}`;
        nodes.push({
          id: bid,
          sourceId: b.id,
          nodeType: 'molt_block',
          label: b.title,
          position: { x: 940, y: 20 + si * 280 + ni * 170 + bi * 72 },
          state: { ...active(b.defaultState === 'off'), invalid: !b.content, warning: !b.content ? 'Empty block content' : undefined }
        });
        edges.push({ id: `e_${nb.id}_${b.id}`, source: nid, target: bid, type: 'contains', label: b.role });
      });
    });
  });
  nodes.push({ id: `node_output_${sleeve.id}`, sourceId: `output_${sleeve.id}`, nodeType: 'output', label: 'Compiler / Hermes Output', position: { x: 1260, y: 160 }, state: active(false) });
  const leaves = nodes.filter((n) => n.nodeType === 'molt_block' && !n.state.off);
  leaves.slice(-2).forEach((n) => edges.push({ id: `e_${n.id}_out`, source: n.id, target: `node_output_${sleeve.id}`, type: 'compiles_to' }));
  return { nodes, edges };
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

function collectDescendants(edges: GraphEdge[], nodeIds: Set<string>) {
  const keep = new Set(nodeIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (edge.type !== 'contains') continue;
      if (keep.has(edge.source) && !keep.has(edge.target)) {
        keep.add(edge.target);
        changed = true;
      }
    }
  }
  return keep;
}

function collectAncestors(edges: GraphEdge[], nodeIds: Set<string>) {
  const keep = new Set(nodeIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (edge.type !== 'contains') continue;
      if (keep.has(edge.target) && !keep.has(edge.source)) {
        keep.add(edge.source);
        changed = true;
      }
    }
  }
  return keep;
}

export function focusGraph(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, focus: GraphFocus) {
  const focusNode = focus.sourceId ? graph.nodes.find((node) => node.sourceId === focus.sourceId || node.id === focus.sourceId) : graph.nodes.find((node) => node.nodeType === 'sleeve');
  const baseIds = new Set(focusNode ? [focusNode.id] : graph.nodes.filter((node) => node.nodeType === 'sleeve').map((node) => node.id));
  const descendants = collectDescendants(graph.edges, baseIds);
  const ancestors = collectAncestors(graph.edges, baseIds);
  const keep = focus.mode === 'sleeve' ? new Set(graph.nodes.map((node) => node.id)) : new Set([...descendants, ...ancestors]);
  const nodes = graph.nodes.map((node) => {
    const dimmed = !keep.has(node.id);
    const focused = focusNode ? node.id === focusNode.id : node.nodeType === 'sleeve';
    return { ...node, visual: { focused, dimmed } };
  });
  const edges = graph.edges.map((edge) => ({ ...edge }));
  return { ...graph, nodes, edges, viewport: { ...(graph as any).viewport, zoom: focus.mode === 'sleeve' ? 0.75 : focus.mode === 'neostack' ? 0.9 : 1.05, x: focusNode?.position.x ?? 0, y: focusNode?.position.y ?? 0, focusNodeId: focusNode?.id } };
}
