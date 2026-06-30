import { useMemo, useState } from 'react';
import type { NormalizedTemplateSleeve } from '../lib/umg/templateSleeveStructures';
import type { HermesCognitiveRuntimeResult, UMGCompiledRuntimeManifest, UMGRuntimeArtifact, UMGRuntimeVisualState, UMGTraceEvent } from '../lib/umg/cognitiveRuntimeTypes';
import type { PendingRuntimeApproval, ToolCapabilityResolution } from '../lib/umg/toolCapabilityResolver';
import type { UMGGeometryManifest, RuntimeGeometryNode as ProjectRuntimeGeometryNode } from '../lib/umg/runtimeGeometryTypes';
import { buildRuntimeGeometryManifest, summarizeGeometryManifest } from '../lib/umg/runtimeGeometryProjection';
import { getRuntimeTargetId } from '../lib/umg/cognitiveRuntimeState';

export type RuntimeGeometryObserverMode = 'structure' | 'runtime';

type RuntimeGeometryNodeKind = 'sleeve' | 'neostack' | 'neoblock' | 'molt' | 'gate' | 'capability';
type RuntimeGeometryNodeStatus = 'idle' | 'active' | 'processing' | 'approval' | 'complete' | 'blocked' | 'error';

type RuntimeGeometryNode = {
  id: string;
  kind: RuntimeGeometryNodeKind;
  label: string;
  subtitle?: string;
  parentId?: string;
  sourceId?: string;
  status: RuntimeGeometryNodeStatus;
  traceEvents: UMGTraceEvent[];
  artifacts: UMGRuntimeArtifact[];
  metadata?: Record<string, unknown>;
  aliases: string[];
};

type RuntimeGeometryEdge = {
  id: string;
  from: string;
  to: string;
  kind: 'contains' | 'routes' | 'uses' | 'guards';
};

type UnmappedTrace = {
  event: UMGTraceEvent;
  targetId?: string;
  reason: 'target_not_found' | 'missing_target_id' | 'unsupported_event_shape';
};

type RuntimeGeometryGraph = {
  nodes: RuntimeGeometryNode[];
  edges: RuntimeGeometryEdge[];
  unmappedEvents: UnmappedTrace[];
};

export type RuntimeGeometryObserverProps = {
  activeSessionSleeve: NormalizedTemplateSleeve;
  compiledRuntimeManifest?: UMGCompiledRuntimeManifest;
  geometryManifest?: UMGGeometryManifest;
  hermesRuntimeVisualState?: UMGRuntimeVisualState;
  hermesRuntimeResult?: HermesCognitiveRuntimeResult;
  runtimePrompt: string;
  onRuntimePromptChange: (value: string) => void;
  onRunHermesRuntime: () => void;
  onContinueRuntimeApproval: (decision: 'approve' | 'deny' | 'skip') => void;
  onBackToBuilder: () => void;
  compileStatus: string;
  runtimeStatus: string;
  isHermesRunning: boolean;
  pendingRuntimeApproval?: PendingRuntimeApproval;
  toolCapabilityResolutions?: ToolCapabilityResolution[];
};

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function capabilityRecords(sleeve: NormalizedTemplateSleeve) {
  const raw = sleeve.metadata?.capabilities;
  return Array.isArray(raw) ? raw.filter(isRecord) : [];
}

function eventId(event: UMGTraceEvent, index = 0) {
  return `${event.traceId}:${event.timestamp}:${event.eventType}:${index}`;
}

function eventTargetId(event: UMGTraceEvent) {
  return getRuntimeTargetId(event) ?? event.sleeveId ?? event.neoStackId ?? event.neoBlockId ?? event.moltBlockId ?? event.gateId ?? event.toolId ?? event.approvalId ?? event.sourceId;
}

function eventAliases(event: UMGTraceEvent) {
  const target = eventTargetId(event);
  return unique([
    target,
    target ? `sleeve:${target}` : undefined,
    target ? `neostack:${target}` : undefined,
    target ? `neoblock:${target}` : undefined,
    target ? `molt:${target}` : undefined,
    target ? `molt_binding:${target}` : undefined,
    target ? `gate:${target}` : undefined,
    target ? `tool:${target}` : undefined,
    target ? `capability:${target}` : undefined,
    event.sleeveId,
    event.sleeveId ? `sleeve:${event.sleeveId}` : undefined,
    event.neoStackId,
    event.neoStackId ? `neostack:${event.neoStackId}` : undefined,
    event.neoBlockId,
    event.neoBlockId ? `neoblock:${event.neoBlockId}` : undefined,
    event.moltBlockId,
    event.moltBlockId ? `molt:${event.moltBlockId}` : undefined,
    event.gateId,
    event.gateId ? `gate:${event.gateId}` : undefined,
    event.toolId,
    event.toolId ? `capability:${event.toolId}` : undefined,
    event.approvalId,
    event.sourceId,
    ...(event.metadataAliases ?? []),
    ...(event.metadataAliases ?? []).map((alias) => `capability:${alias}`)
  ]);
}

function statusFromEvent(event: UMGTraceEvent): RuntimeGeometryNodeStatus {
  switch (event.eventType) {
    case 'run_error':
    case 'error':
      return 'error';
    case 'gate_blocked':
    case 'tool_call_blocked':
    case 'tool_blocked':
    case 'approval_denied':
      return 'blocked';
    case 'tool_call_requires_approval':
    case 'approval_required':
      return 'approval';
    case 'tool_call_prepared':
    case 'tool_requested':
    case 'tool_call_executed':
    case 'tool_executed':
    case 'tool_result_received':
    case 'molt_role_used':
    case 'block_processing':
      return event.eventType === 'tool_result_received' ? 'complete' : 'processing';
    case 'neoblock_started':
    case 'neostack_started':
    case 'run_started':
    case 'route_started':
    case 'block_activated':
      return 'active';
    case 'approval_granted':
    case 'gate_opened':
    case 'gate_closed':
    case 'neoblock_completed':
    case 'neostack_completed':
    case 'block_completed':
    case 'route_completed':
    case 'run_completed':
      return 'complete';
    default:
      if (event.state === 'error') return 'error';
      if (event.state === 'blocked') return 'blocked';
      if (event.state === 'processing' || event.state === 'attention') return 'processing';
      if (event.state === 'active' || event.state === 'queued') return 'active';
      if (event.state === 'complete') return 'complete';
      return 'idle';
  }
}

const statusPriority: RuntimeGeometryNodeStatus[] = ['error', 'blocked', 'approval', 'processing', 'active', 'complete', 'idle'];

function mergeStatus(current: RuntimeGeometryNodeStatus, incoming: RuntimeGeometryNodeStatus) {
  return statusPriority.indexOf(incoming) < statusPriority.indexOf(current) ? incoming : current;
}

function projectNodeKind(kind: ProjectRuntimeGeometryNode['kind']): RuntimeGeometryNodeKind {
  if (kind === 'molt_binding') return 'molt';
  if (kind === 'tool_endpoint') return 'capability';
  return kind;
}

function projectNodeStatus(state: ProjectRuntimeGeometryNode['state']): RuntimeGeometryNodeStatus {
  if (state === 'error') return 'error';
  if (state === 'blocked') return 'blocked';
  if (state === 'waiting_approval') return 'approval';
  if (state === 'tool_calling' || state === 'processing' || state === 'attention') return 'processing';
  if (state === 'active' || state === 'queued') return 'active';
  if (state === 'complete') return 'complete';
  return 'idle';
}

function projectManifestNode(node: ProjectRuntimeGeometryNode): RuntimeGeometryNode {
  const parentId = node.kind === 'neostack'
    ? `sleeve:${node.sleeveId}`
    : node.kind === 'neoblock'
      ? `neostack:${node.neoStackId}`
      : node.kind === 'molt_binding'
        ? `neoblock:${node.parentNeoBlockId}`
        : undefined;
  const source = node.kind === 'molt_binding' ? node.moltBlockId : node.kind === 'gate' ? node.gateId : node.kind === 'tool_endpoint' ? node.toolId : node.sourceId;
  return {
    id: node.kind === 'tool_endpoint' ? `capability:${node.toolId}` : node.id,
    kind: projectNodeKind(node.kind),
    label: node.label,
    subtitle: node.kind === 'molt_binding' ? node.localSlotRole : node.kind === 'tool_endpoint' ? 'capability / tool' : node.description,
    parentId,
    sourceId: source,
    status: projectNodeStatus(node.state),
    traceEvents: [],
    artifacts: [],
    metadata: node.metadata,
    aliases: unique([node.id, node.sourceId, source, ...(node.aliases ?? []), node.kind === 'tool_endpoint' ? `tool:${node.toolId}` : undefined, node.kind === 'tool_endpoint' ? `capability:${node.toolId}` : undefined])
  };
}

function artifactAliases(artifact: UMGRuntimeArtifact) {
  const metadata = artifact.metadata ?? {};
  return unique([
    toText(metadata.sourceCapability),
    toText(metadata.capabilityId),
    toText(metadata.toolId),
    toText(metadata.relatedNeoBlockId),
    toText(metadata.neoBlockId),
    toText(metadata.relatedMoltId),
    toText(metadata.moltBlockId),
    toText(metadata.gateId),
    toText(metadata.targetId)
  ]).flatMap((id) => [id, `capability:${id}`, `tool:${id}`, `neoblock:${id}`, `molt:${id}`, `gate:${id}`]);
}

export function buildRuntimeGeometryObserverGraph(args: {
  activeSessionSleeve: NormalizedTemplateSleeve;
  geometryManifest?: UMGGeometryManifest;
  compiledRuntimeManifest?: UMGCompiledRuntimeManifest;
  hermesRuntimeVisualState?: UMGRuntimeVisualState;
  hermesRuntimeResult?: HermesCognitiveRuntimeResult;
  mode?: RuntimeGeometryObserverMode;
}): RuntimeGeometryGraph {
  const traceEvents = args.mode === 'runtime' ? (args.hermesRuntimeVisualState?.timeline ?? args.hermesRuntimeResult?.trace ?? []) : [];
  const baseManifest = args.mode === 'runtime' && args.geometryManifest ? args.geometryManifest : buildRuntimeGeometryManifest({
    templateSleeve: args.activeSessionSleeve,
    compiledRuntimeManifest: args.compiledRuntimeManifest,
    runtimeVisualState: args.mode === 'runtime' ? args.hermesRuntimeVisualState : undefined,
    viewMode: args.mode === 'runtime' ? 'runtime' : 'structure'
  });
  const nodes = baseManifest.nodes.map(projectManifestNode);
  const nodeByAlias = new Map<string, RuntimeGeometryNode[]>();
  const register = (alias: string | undefined, node: RuntimeGeometryNode) => {
    if (!alias) return;
    nodeByAlias.set(alias, [...(nodeByAlias.get(alias) ?? []), node]);
  };
  nodes.forEach((node) => node.aliases.forEach((alias) => register(alias, node)));

  capabilityRecords(args.activeSessionSleeve).forEach((capability) => {
    const capabilityId = toText(capability.capabilityId) ?? toText(capability.id);
    if (!capabilityId || nodeByAlias.has(capabilityId) || nodeByAlias.has(`capability:${capabilityId}`)) return;
    const sourceNeoBlock = toText(capability.sourceNeoBlock) ?? toText(capability.neoBlockId) ?? args.activeSessionSleeve.neoBlocks.find((block) => block.title.toLowerCase().includes('note') || block.id.toLowerCase().includes('note'))?.id;
    const node: RuntimeGeometryNode = {
      id: `capability:${capabilityId}`,
      kind: 'capability',
      label: capabilityId,
      subtitle: toText(capability.label) ?? 'declared active-session capability',
      parentId: sourceNeoBlock ? `neoblock:${sourceNeoBlock}` : `sleeve:${args.activeSessionSleeve.id}`,
      sourceId: capabilityId,
      status: 'idle',
      traceEvents: [],
      artifacts: [],
      metadata: capability,
      aliases: unique([capabilityId, `capability:${capabilityId}`, `tool:${capabilityId}`])
    };
    nodes.push(node);
    node.aliases.forEach((alias) => register(alias, node));
  });

  const unmappedEvents: UnmappedTrace[] = [];
  traceEvents.forEach((event, index) => {
    const aliases = eventAliases(event);
    if (!aliases.length) {
      unmappedEvents.push({ event, reason: 'missing_target_id' });
      return;
    }
    const matches = unique(aliases.flatMap((alias) => nodeByAlias.get(alias)?.map((node) => node.id) ?? []));
    if (!matches.length) {
      unmappedEvents.push({ event, targetId: eventTargetId(event), reason: eventTargetId(event) ? 'target_not_found' : 'missing_target_id' });
      return;
    }
    const status = statusFromEvent(event);
    matches.forEach((nodeId) => {
      const node = nodes.find((entry) => entry.id === nodeId);
      if (!node) return;
      node.status = mergeStatus(node.status, status);
      node.traceEvents = [...node.traceEvents, { ...event, traceId: event.traceId || eventId(event, index) }];
    });
  });

  (args.hermesRuntimeResult?.artifacts ?? []).forEach((artifact) => {
    const matches = unique(artifactAliases(artifact).flatMap((alias) => nodeByAlias.get(alias)?.map((node) => node.id) ?? []));
    matches.forEach((nodeId) => {
      const node = nodes.find((entry) => entry.id === nodeId);
      if (node) node.artifacts = [...node.artifacts, artifact];
    });
  });

  const edges: RuntimeGeometryEdge[] = baseManifest.connections.map((connection) => ({
    id: connection.id,
    from: connection.sourceNodeId.startsWith('tool:') ? connection.sourceNodeId.replace(/^tool:/, 'capability:') : connection.sourceNodeId,
    to: connection.targetNodeId.startsWith('tool:') ? connection.targetNodeId.replace(/^tool:/, 'capability:') : connection.targetNodeId,
    kind: connection.type === 'gate_control' ? 'guards' : connection.type === 'tool_capability' ? 'uses' : connection.type === 'execution_next' ? 'routes' : 'contains'
  }));
  nodes.filter((node) => node.kind === 'capability' && node.parentId).forEach((node) => {
    edges.push({ id: `uses:${node.parentId}:${node.id}`, from: node.parentId!, to: node.id, kind: 'uses' });
  });

  return { nodes, edges: Array.from(new Map(edges.map((edge) => [edge.id, edge])).values()), unmappedEvents };
}

function groupByParent(nodes: RuntimeGeometryNode[]) {
  const grouped = new Map<string, RuntimeGeometryNode[]>();
  nodes.forEach((node) => {
    if (!node.parentId) return;
    grouped.set(node.parentId, [...(grouped.get(node.parentId) ?? []), node]);
  });
  return grouped;
}

function NodeButton({ node, selected, onSelect }: { node: RuntimeGeometryNode; selected: boolean; onSelect: (node: RuntimeGeometryNode) => void }) {
  return <button type="button" className={`runtime-geometry-node runtime-geometry-node--${node.status} ${selected ? 'runtime-geometry-node--selected' : ''}`} onClick={() => onSelect(node)}>
    <span>{node.kind}</span>
    <b>{node.label}</b>
    {node.subtitle && <small>{node.subtitle}</small>}
    {node.traceEvents.length > 0 && <em>{node.traceEvents.length} trace</em>}
    {node.artifacts.length > 0 && <em>{node.artifacts.length} artifact</em>}
  </button>;
}

function statusRows(node?: RuntimeGeometryNode) {
  if (!node) return [] as [string, string][];
  return [
    ['node type', node.kind],
    ['title', node.label],
    ['ID', node.id],
    ['status', node.status],
    ['parent node', node.parentId ?? 'none'],
    ['child count', String(node.metadata?.childCount ?? 0)],
    ['related trace events', String(node.traceEvents.length)],
    ['related artifacts', String(node.artifacts.length)]
  ];
}

export function RuntimeGeometryObserver({
  activeSessionSleeve,
  compiledRuntimeManifest,
  geometryManifest,
  hermesRuntimeVisualState,
  hermesRuntimeResult,
  runtimePrompt,
  onRuntimePromptChange,
  onRunHermesRuntime,
  onContinueRuntimeApproval,
  onBackToBuilder,
  compileStatus,
  runtimeStatus,
  isHermesRunning,
  pendingRuntimeApproval
}: RuntimeGeometryObserverProps) {
  const [mode, setMode] = useState<RuntimeGeometryObserverMode>('structure');
  const graph = useMemo(() => buildRuntimeGeometryObserverGraph({ activeSessionSleeve, compiledRuntimeManifest, geometryManifest, hermesRuntimeVisualState, hermesRuntimeResult, mode }), [activeSessionSleeve, compiledRuntimeManifest, geometryManifest, hermesRuntimeVisualState, hermesRuntimeResult, mode]);
  const grouped = useMemo(() => groupByParent(graph.nodes), [graph.nodes]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes.find((node) => node.kind === 'sleeve');
  const summary = useMemo(() => {
    try { return summarizeGeometryManifest(geometryManifest ?? buildRuntimeGeometryManifest({ templateSleeve: activeSessionSleeve, compiledRuntimeManifest })); } catch { return undefined; }
  }, [activeSessionSleeve, compiledRuntimeManifest, geometryManifest]);
  const sleeveNode = graph.nodes.find((node) => node.kind === 'sleeve');
  const stackNodes = graph.nodes.filter((node) => node.kind === 'neostack');
  const traceEvents = hermesRuntimeVisualState?.timeline ?? hermesRuntimeResult?.trace ?? [];
  const artifactCount = hermesRuntimeResult?.artifacts?.length ?? 0;

  return <section className="runtime-geometry-observer" aria-label="Runtime Geometry Observer">
    <header className="runtime-geometry-header">
      <div>
        <p className="runtime-geometry-eyebrow">Generated Sleeve as connected geometry + live trace overlay</p>
        <h1>{activeSessionSleeve.title}</h1>
        <small>Runtime-session only. This observer does not save or promote source-library content.</small>
      </div>
      <div className="runtime-geometry-status-grid">
        <span><b>compile</b>{compileStatus}</span>
        <span><b>Hermes</b>{runtimeStatus}</span>
        <span><b>trace events</b>{traceEvents.length}</span>
        <span><b>artifacts</b>{artifactCount}</span>
        <span><b>unmapped</b>{graph.unmappedEvents.length}</span>
      </div>
    </header>

    <div className="runtime-geometry-controls">
      <button type="button" onClick={onBackToBuilder}>Back to Sleeve Builder</button>
      <button type="button" className={mode === 'structure' ? 'hot' : ''} onClick={() => setMode('structure')}>Structure View</button>
      <button type="button" className={mode === 'runtime' ? 'hot' : ''} onClick={() => setMode('runtime')}>Runtime View</button>
      <label className="runtime-geometry-prompt"><span>Runtime prompt</span><textarea value={runtimePrompt} onChange={(event) => onRuntimePromptChange(event.target.value)} placeholder="write a note on my desktop about apples" /></label>
      <button type="button" className="publicPrimaryCta" disabled={!compiledRuntimeManifest || isHermesRunning} onClick={onRunHermesRuntime}>{isHermesRunning ? 'Hermes Running…' : 'Run Hermes in Active Sleeve'}</button>
      {pendingRuntimeApproval && <div className="runtime-geometry-approval"><b>Approval boundary active</b><button type="button" onClick={() => onContinueRuntimeApproval('approve')} disabled={isHermesRunning}>Approve & Continue</button><button type="button" onClick={() => onContinueRuntimeApproval('skip')} disabled={isHermesRunning}>Skip</button></div>}
    </div>

    {mode === 'runtime' && traceEvents.length === 0 && <div className="runtime-geometry-empty-trace">No runtime trace has been captured yet. All geometry remains idle; this screen does not fabricate activation.</div>}

    <div className="runtime-geometry-layout">
      <div className="runtime-geometry-canvas" aria-label="Connected Runtime Geometry">
        <div className="runtime-geometry-row runtime-geometry-row--sleeve">
          {sleeveNode && <NodeButton node={sleeveNode} selected={selectedNode?.id === sleeveNode.id} onSelect={(node) => setSelectedNodeId(node.id)} />}
        </div>
        <div className="runtime-geometry-row runtime-geometry-row--stacks">
          {stackNodes.map((stack) => <div key={stack.id} className="runtime-geometry-stack-column">
            <NodeButton node={stack} selected={selectedNode?.id === stack.id} onSelect={(node) => setSelectedNodeId(node.id)} />
            <div className="runtime-geometry-edge runtime-geometry-edge--vertical" />
            {(grouped.get(stack.id) ?? []).filter((node) => node.kind === 'neoblock').map((block) => <div key={block.id} className="runtime-geometry-block-group">
              <NodeButton node={block} selected={selectedNode?.id === block.id} onSelect={(node) => setSelectedNodeId(node.id)} />
              <div className="runtime-geometry-children">
                {(grouped.get(block.id) ?? []).map((child) => <NodeButton key={child.id} node={child} selected={selectedNode?.id === child.id} onSelect={(node) => setSelectedNodeId(node.id)} />)}
                {graph.nodes.filter((gate) => gate.kind === 'gate' && graph.edges.some((edge) => edge.kind === 'guards' && edge.from === gate.id && edge.to === block.id)).map((gate) => <NodeButton key={gate.id} node={gate} selected={selectedNode?.id === gate.id} onSelect={(node) => setSelectedNodeId(node.id)} />)}
              </div>
            </div>)}
          </div>)}
        </div>
        <div className="runtime-geometry-row runtime-geometry-row--loose">
          {graph.nodes.filter((node) => !node.parentId && node.kind !== 'sleeve' && !stackNodes.some((stack) => stack.id === node.id)).map((node) => <NodeButton key={node.id} node={node} selected={selectedNode?.id === node.id} onSelect={(entry) => setSelectedNodeId(entry.id)} />)}
        </div>
        <small className="runtime-geometry-connection-note">{graph.edges.length} trustworthy connections · {summary ? `${summary.totalNeoStacks} NeoStacks / ${summary.totalNeoBlocks} NeoBlocks / ${summary.totalMoltBindings} MOLT / ${summary.totalGates} Gates / ${summary.totalToolEndpoints + graph.nodes.filter((node) => node.kind === 'capability').length} Capabilities` : 'manifest summary unavailable'}</small>
      </div>

      <aside className="runtime-geometry-inspector">
        <h2>Selected Node</h2>
        {selectedNode ? <>
          <div className="analysisRows">{statusRows({ ...selectedNode, metadata: { ...selectedNode.metadata, childCount: grouped.get(selectedNode.id)?.length ?? graph.edges.filter((edge) => edge.from === selectedNode.id).length } }).map(([key, value]) => <div key={key}><b>{key}</b><span>{value}</span></div>)}</div>
          {selectedNode.traceEvents.length > 0 && <ol className="runtime-geometry-mini-list">{selectedNode.traceEvents.map((event, index) => <li key={eventId(event, index)}><b>{event.eventType}</b><span>{event.label}</span></li>)}</ol>}
          {selectedNode.artifacts.length > 0 && <div className="runtime-geometry-artifact-list">{selectedNode.artifacts.map((artifact) => <article key={artifact.id}><b>{artifact.label}</b><small>{artifact.kind}</small></article>)}</div>}
          <pre>{JSON.stringify(selectedNode.metadata ?? {}, null, 2).slice(0, 1000)}</pre>
        </> : <small>Select a geometry node to inspect details.</small>}
      </aside>

      <aside className="runtime-geometry-rail">
        <h2>Trace / Artifacts</h2>
        <h3>Timeline</h3>
        {traceEvents.length ? <ol className="runtime-geometry-trace-list">{traceEvents.map((event, index) => <li className="runtime-geometry-trace-event" key={eventId(event, index)}><b>{event.eventType}</b><span>{event.label}</span><small>{eventTargetId(event) ?? 'missing target'}</small></li>)}</ol> : <small>No real Hermes trace yet.</small>}
        <h3>Artifacts</h3>
        {hermesRuntimeResult?.artifacts?.length ? <div className="runtime-geometry-artifact-list">{hermesRuntimeResult.artifacts.map((artifact) => <article key={artifact.id}><b>{artifact.label}</b><small>{artifact.kind}</small><p>{typeof artifact.content === 'string' ? artifact.content : JSON.stringify(artifact.content)}</p><span>{JSON.stringify(artifact.metadata ?? {})}</span></article>)}</div> : <small>No artifacts yet.</small>}
        <h3>Unmapped Events</h3>
        {graph.unmappedEvents.length ? <ol className="runtime-geometry-unmapped-events">{graph.unmappedEvents.map(({ event, targetId, reason }, index) => <li key={eventId(event, index)}><b>{event.eventType}</b><span>{targetId ?? 'missing target'} · {reason}</span></li>)}</ol> : <small>No unmapped runtime events.</small>}
      </aside>
    </div>
  </section>;
}
