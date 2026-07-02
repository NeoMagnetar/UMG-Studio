import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, WheelEvent } from 'react';
import type { NormalizedTemplateSleeve } from '../lib/umg/templateSleeveStructures';
import type { HermesCognitiveRuntimeResult, UMGCompiledRuntimeManifest, UMGRuntimeArtifact, UMGRuntimeVisualState, UMGTraceEvent } from '../lib/umg/cognitiveRuntimeTypes';
import type { PendingRuntimeApproval, ToolCapabilityResolution } from '../lib/umg/toolCapabilityResolver';
import type { UMGGeometryManifest, RuntimeGeometryNode as ProjectRuntimeGeometryNode } from '../lib/umg/runtimeGeometryTypes';
import { buildRuntimeGeometryManifest, summarizeGeometryManifest } from '../lib/umg/runtimeGeometryProjection';
import { getRuntimeTargetId } from '../lib/umg/cognitiveRuntimeState';

export type RuntimeGeometryObserverMode = 'structure' | 'runtime';
export type RuntimeExecutionState = 'idle' | 'ready' | 'compiling_required' | 'sending' | 'running' | 'action_prepared' | 'awaiting_approval' | 'completed' | 'failed';
export type RuntimeExecutionMode = 'batch' | 'stream';
export type RuntimeNativeActionMode = 'observe' | 'approval' | 'direct';
export type HermesRuntimeChatMessage = {
  id: string;
  role: 'user' | 'hermes' | 'system' | 'tool' | 'error';
  content: string;
  createdAt: string;
  relatedNodeId?: string;
  relatedTraceId?: string;
  mode?: RuntimeNativeActionMode;
  metadata?: Record<string, unknown>;
};


type RuntimeGeometryNodeKind = 'sleeve' | 'neostack' | 'neoblock' | 'molt' | 'merge' | 'gate' | 'tool' | 'capability' | 'artifact';
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
  kind: 'contains' | 'routes' | 'uses' | 'guards' | 'merge' | 'emits';
  status?: RuntimeGeometryNodeStatus;
  traceEvents?: UMGTraceEvent[];
  aliases?: string[];
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
  hermesRuntimeErrors?: string[];
  isHermesRunning: boolean;
  pendingRuntimeApproval?: PendingRuntimeApproval;
  toolCapabilityResolutions?: ToolCapabilityResolution[];
  nativeActionMode?: RuntimeNativeActionMode;
  onNativeActionModeChange?: (mode: RuntimeNativeActionMode) => void;
  onDraftMissingMoltBlock?: (prompt: string) => void;
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
  return event.targetId ?? getRuntimeTargetId(event) ?? event.sleeveId ?? event.neoStackId ?? event.neoBlockId ?? event.moltBlockId ?? event.gateId ?? event.toolId ?? event.approvalId ?? event.sourceId;
}

function approvalCapabilityAlias(approvalId: unknown) {
  const text = toText(approvalId);
  return text?.startsWith('approval.') ? text.slice('approval.'.length) : undefined;
}

function eventAliases(event: UMGTraceEvent) {
  const target = eventTargetId(event);
  const approvalCapability = approvalCapabilityAlias(event.approvalId);
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
    event.targetType && target ? `${event.targetType}:${target}` : undefined,
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
    approvalCapability,
    approvalCapability ? `capability:${approvalCapability}` : undefined,
    approvalCapability ? `tool:${approvalCapability}` : undefined,
    event.sourceId,
    ...(event.metadataAliases ?? []),
    ...(event.metadataAliases ?? []).map((alias) => `capability:${alias}`),
    toText(event.metadata?.capabilityId),
    toText(event.metadata?.toolId),
    toText(event.metadata?.filePath),
    toText(event.metadata?.artifactId)
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
    case 'route_edge_activated':
      return 'active';
    case 'merge_started':
      return 'processing';
    case 'merge_completed':
      return 'complete';
    case 'molt_layer_used':
      return 'processing';
    case 'tool_block_resolved':
      return 'processing';
    case 'action_request_created':
    case 'action_executed':
    case 'file_created':
    case 'artifact_created':
      return event.eventType === 'action_request_created' ? 'processing' : 'complete';
    case 'tool_call_prepared':
    case 'tool_requested':
    case 'tool_call_executed':
    case 'tool_executed':
    case 'tool_result_received':
    case 'molt_role_used':
    case 'block_processing':
      return event.eventType === 'tool_result_received' ? 'complete' : 'processing';
    case 'neoblock_started':
    case 'neostack_entered':
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

function prefixedNodeId(type: string, id: string) {
  return type === 'tool' ? `capability:${id}` : `${type}:${id}`;
}

function structuralArray(sleeve: NormalizedTemplateSleeve, field: string): Record<string, unknown>[] {
  const ir = sleeve.metadata?.structuralIR;
  if (!isRecord(ir) || !Array.isArray(ir[field])) return [];
  return ir[field].filter(isRecord);
}

function structuralId(record: Record<string, unknown>) {
  return toText(record.id) ?? toText(record.sourceId) ?? toText(record.toolId) ?? toText(record.capabilityId);
}

function addStructuralRuntimeNodes(sleeve: NormalizedTemplateSleeve, nodes: RuntimeGeometryNode[], register: (alias: string | undefined, node: RuntimeGeometryNode) => void) {
  const upsert = (node: RuntimeGeometryNode) => {
    const existing = nodes.find((entry) => entry.id === node.id);
    if (existing) {
      existing.aliases = unique([...(existing.aliases ?? []), ...(node.aliases ?? [])]);
      existing.metadata = { ...(existing.metadata ?? {}), ...(node.metadata ?? {}) };
      existing.aliases.forEach((alias) => register(alias, existing));
      return existing;
    }
    nodes.push(node);
    node.aliases.forEach((alias) => register(alias, node));
    return node;
  };
  structuralArray(sleeve, 'mergeOps').forEach((merge, index) => {
    const id = structuralId(merge);
    if (!id) return;
    upsert({ id: `merge:${id}`, kind: 'merge', label: toText(merge.title) ?? id, subtitle: toText(merge.mergeType) ?? 'Merge operation', parentId: `sleeve:${sleeve.id}`, sourceId: id, status: 'idle', traceEvents: [], artifacts: [], metadata: { ...merge, stackOrder: index + 1 }, aliases: unique([id, `merge:${id}`]) });
  });
  structuralArray(sleeve, 'toolBlocks').forEach((tool, index) => {
    const id = structuralId(tool);
    if (!id) return;
    const parent = toText(tool.parentNeoBlockId) ?? toText(tool.neoBlockId);
    upsert({ id: `capability:${id}`, kind: 'capability', label: toText(tool.title) ?? id, subtitle: 'MetaMOLT Tool Block', parentId: parent ? `neoblock:${parent}` : `sleeve:${sleeve.id}`, sourceId: id, status: 'idle', traceEvents: [], artifacts: [], metadata: { ...tool, stackOrder: index + 1, metaMoltToolBlock: true }, aliases: unique([id, `tool:${id}`, `capability:${id}`]) });
  });
}

function structuralRouteEdges(sleeve: NormalizedTemplateSleeve): RuntimeGeometryEdge[] {
  return structuralArray(sleeve, 'routes').map((route, index) => {
    const id = structuralId(route) ?? `route.edge.${index + 1}`;
    const fromId = toText(route.fromId) ?? toText(route.from) ?? toText(route.sourceId);
    const toId = toText(route.toId) ?? toText(route.to) ?? toText(route.targetId);
    const fromType = toText(route.fromType) ?? 'neoblock';
    const toType = toText(route.toType) ?? 'neoblock';
    if (!fromId || !toId) return undefined;
    return { id, from: prefixedNodeId(fromType, fromId), to: prefixedNodeId(toType, toId), kind: 'routes' as const, status: 'idle' as const, traceEvents: [], aliases: unique([id, `route:${id}`]) };
  }).filter(Boolean) as RuntimeGeometryEdge[];
}

function projectManifestNode(node: ProjectRuntimeGeometryNode): RuntimeGeometryNode {
  const parentId = node.kind === 'neostack'
    ? `sleeve:${node.sleeveId}`
    : node.kind === 'neoblock'
      ? `neostack:${node.neoStackId}`
      : node.kind === 'molt_binding'
        ? `neoblock:${node.parentNeoBlockId}`
        : node.kind === 'tool_endpoint' && node.parentNeoBlockId
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
    toText(metadata.targetId),
    artifact.uri,
    typeof artifact.content === 'string' ? artifact.content : undefined
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

  addStructuralRuntimeNodes(args.activeSessionSleeve, nodes, register);

  capabilityRecords(args.activeSessionSleeve).forEach((capability) => {
    const capabilityId = toText(capability.capabilityId) ?? toText(capability.id);
    if (!capabilityId || nodeByAlias.has(capabilityId) || nodeByAlias.has(`capability:${capabilityId}`)) return;
    const sourceNeoBlock = toText(capability.sourceNeoBlock) ?? toText(capability.parentNeoBlockId) ?? toText(capability.neoBlockId) ?? args.activeSessionSleeve.neoBlocks.find((block) => block.title.toLowerCase().includes('note') || block.id.toLowerCase().includes('note'))?.id;
    const sourceNeoStack = sourceNeoBlock ? args.activeSessionSleeve.neoBlocks.find((block) => block.id === sourceNeoBlock)?.neoStackId : undefined;
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
      metadata: { ...capability, parentNeoBlockId: sourceNeoBlock, parentNeoStackId: sourceNeoStack, rendersAs: sourceNeoBlock ? 'neoblock-child-port' : 'sleeve-capability' },
      aliases: unique([capabilityId, `capability:${capabilityId}`, `tool:${capabilityId}`])
    };
    nodes.push(node);
    node.aliases.forEach((alias) => register(alias, node));
  });

  const unmappedEvents: UnmappedTrace[] = [];
  (args.hermesRuntimeResult?.artifacts ?? []).forEach((artifact) => {
    const artifactNode: RuntimeGeometryNode = {
      id: `artifact:${artifact.id}`,
      kind: 'artifact',
      label: artifact.label,
      subtitle: artifact.kind,
      sourceId: artifact.id,
      status: 'idle',
      traceEvents: [],
      artifacts: [artifact],
      metadata: { artifact },
      aliases: unique([artifact.id, `artifact:${artifact.id}`, ...artifactAliases(artifact)])
    };
    nodes.push(artifactNode);
    artifactNode.aliases.forEach((alias) => register(alias, artifactNode));
  });
  const routeEdges = structuralRouteEdges(args.activeSessionSleeve);
  const edgeByAlias = new Map<string, RuntimeGeometryEdge[]>();
  const registerEdge = (alias: string | undefined, edge: RuntimeGeometryEdge) => {
    if (!alias) return;
    edgeByAlias.set(alias, [...(edgeByAlias.get(alias) ?? []), edge]);
  };
  routeEdges.forEach((edge) => (edge.aliases ?? [edge.id]).forEach((alias) => registerEdge(alias, edge)));

  traceEvents.forEach((event, index) => {
    const routeMatches = unique([event.routeEdgeId, event.routeEdgeId ? `route:${event.routeEdgeId}` : undefined].flatMap((alias) => edgeByAlias.get(alias ?? '')?.map((edge) => edge.id) ?? []));
    if (routeMatches.length) {
      routeMatches.forEach((edgeId) => {
        const edge = routeEdges.find((entry) => entry.id === edgeId);
        if (!edge) return;
        edge.status = statusFromEvent(event);
        edge.traceEvents = [...(edge.traceEvents ?? []), event];
      });
    }
    if (routeMatches.length && event.eventType === 'route_edge_activated') return;
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

  const edges: RuntimeGeometryEdge[] = [...routeEdges, ...baseManifest.connections.map((connection) => {
    const kind: RuntimeGeometryEdge['kind'] = connection.type === 'gate_control' ? 'guards' : connection.type === 'tool_capability' ? 'uses' : connection.type === 'execution_next' ? 'routes' : 'contains';
    return {
      id: connection.id,
      from: connection.sourceNodeId.startsWith('tool:') ? connection.sourceNodeId.replace(/^tool:/, 'capability:') : connection.sourceNodeId,
      to: connection.targetNodeId.startsWith('tool:') ? connection.targetNodeId.replace(/^tool:/, 'capability:') : connection.targetNodeId,
      kind,
      aliases: [connection.id]
    };
  })];
  nodes.filter((node) => node.kind === 'capability' && node.parentId).forEach((node) => {
    edges.push({ id: `uses:${node.parentId}:${node.id}`, from: node.parentId!, to: node.id, kind: 'uses', aliases: [`uses:${node.parentId}:${node.id}`] });
  });

  return { nodes, edges: Array.from(new Map(edges.map((edge) => [edge.id, edge])).values()), unmappedEvents };
}


export type RuntimeVisualViewMode = 'system_sleeve' | 'neostack' | 'neoblock' | 'runtime_path';
export type RuntimeVisualNodeKind = 'sleeve' | 'neostack' | 'neoblock' | 'merge' | 'gate' | 'tool' | 'capability' | 'resource' | 'artifact' | 'context' | 'molt_layer';
export type RuntimeVisualNodeStatus = 'idle' | 'available' | 'active' | 'processing' | 'approval' | 'complete' | 'blocked' | 'error' | 'off' | 'missing' | 'draftSuggested';
export type RuntimeVisualSourceStatus = 'source-library-reused' | 'reuse-decision' | 'runtime-draft' | 'generated-glue' | 'unresolved';

export type RuntimeVisualNode = {
  id: string;
  kind: RuntimeVisualNodeKind;
  label: string;
  shortLabel?: string;
  icon?: string;
  status: RuntimeVisualNodeStatus;
  sourceStatus?: RuntimeVisualSourceStatus;
  parentId?: string;
  stackOrder?: number;
  neoStackId?: string;
  neoBlockId?: string;
  traceEventIds?: string[];
  artifactIds?: string[];
  metadata?: Record<string, unknown>;
  layout?: RuntimeTopologyPosition;
  rawNode?: RuntimeGeometryNode;
};

export type RuntimeSemanticPhase = 'intake' | 'read_parse_inspect' | 'retrieve_search' | 'plan_compose' | 'capability_tool_check' | 'validate_review' | 'execute_export' | 'report_artifact' | 'unknown';

export type RuntimeTopologyPosition = {
  x: number;
  y: number;
  phase: RuntimeSemanticPhase;
  evidence: {
    dependency: 'explicit' | 'inferred' | 'fallback';
    reason: string;
    source: 'explicit dependency' | 'inferred semantic phase' | 'fallback order';
    row: number;
    column: number;
  };
};

export type RuntimeVisualEdge = {
  id: string;
  from: string;
  to: string;
  kind: 'contains' | 'routes' | 'uses' | 'guards' | 'emits' | 'fallback';
  status: RuntimeVisualNodeStatus;
  traceEventIds?: string[];
};

export type RuntimeVisualViewModel = {
  mode: RuntimeVisualViewMode;
  nodes: RuntimeVisualNode[];
  edges: RuntimeVisualEdge[];
  pathNodes: RuntimeVisualNode[];
  neoStacks: RuntimeVisualNode[];
  neoBlocks: RuntimeVisualNode[];
  gates: RuntimeVisualNode[];
  capabilities: RuntimeVisualNode[];
  resources: RuntimeVisualNode[];
  artifacts: RuntimeVisualNode[];
  contexts: RuntimeVisualNode[];
  neoBlockLayers: Map<string, RuntimeVisualNode[]>;
  unmappedEvents: UnmappedTrace[];
};

const visualStatusFromGeometry = (status: RuntimeGeometryNodeStatus): RuntimeVisualNodeStatus => status;

function visualStatusFromOverlay(metadata?: Record<string, unknown>, fallback: RuntimeVisualNodeStatus = 'idle'): RuntimeVisualNodeStatus {
  const overlay = isRecord(metadata?.overlay) ? metadata.overlay : undefined;
  const activationState = String(overlay?.activationState ?? '');
  if (activationState === 'active') return 'active';
  if (activationState === 'inactive') return 'off';
  if (activationState === 'available') return 'available';
  if (activationState === 'missing') return 'missing';
  if (activationState === 'blocked') return 'blocked';
  if (activationState === 'draftSuggested') return 'draftSuggested';
  return fallback;
}

function compactRuntimeLabel(label: string) {
  return label
    .replace(/Greek Philosophical Lens Selection/gi, 'Greek Lens')
    .replace(/Merge Philosophy into Note Semantics/gi, 'Merge Philosophy')
    .replace(/Prepare Desktop Note Action/gi, 'Prepare Note Action')
    .replace(/Semantic Merge and Note Composition/gi, 'Merge + Compose')
    .replace(/Prompt Intake and Note Triggering/gi, 'Prompt Intake')
    .replace(/Desktop Note Emission/gi, 'Note Emission')
    .replace(/NeoBlock$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortRuntimeLabel(label: string, max = 22) {
  const compact = compactRuntimeLabel(label);
  return compact.length > max ? `${compact.slice(0, Math.max(8, max - 1)).trim()}…` : compact;
}

function tierScore(text: string) {
  const normalized = text.toLowerCase();
  if (/trigger|intake|directive|request|govern/.test(normalized)) return 0;
  if (/gate|tool|output|emission|verify|approval|action/.test(normalized)) return 2;
  return 1;
}

const semanticPhaseOrder: RuntimeSemanticPhase[] = ['intake', 'read_parse_inspect', 'retrieve_search', 'plan_compose', 'capability_tool_check', 'validate_review', 'execute_export', 'report_artifact', 'unknown'];

export function inferRuntimeSemanticPhase(value: RuntimeVisualNode | { id?: string; label?: string; kind?: string; metadata?: Record<string, unknown> }): RuntimeSemanticPhase {
  const text = `${value.label ?? ''} ${value.id ?? ''} ${value.kind ?? ''} ${String(value.metadata?.description ?? '')}`.toLowerCase();
  if (/intake|prompt|trigger|request|directive|govern/.test(text)) return 'intake';
  if (/read|parse|inspect|context|source/.test(text)) return 'read_parse_inspect';
  if (/retrieve|search|library|candidate|lookup/.test(text)) return 'retrieve_search';
  if (/plan|compose|composition|draft|merge|model/.test(text)) return 'plan_compose';
  if (/capability|tool|approval|gate|policy|check/.test(text)) return 'capability_tool_check';
  if (/validate|review|verify|audit|guard/.test(text)) return 'validate_review';
  if (/execute|export|emit|emission|output|action|file/.test(text)) return 'execute_export';
  if (/report|artifact|summary|result/.test(text)) return 'report_artifact';
  return 'unknown';
}

export function buildRuntimeCognitiveTopology(nodes: RuntimeVisualNode[], edges: RuntimeVisualEdge[] = []): RuntimeVisualNode[] {
  const explicitTargets = new Set(edges.filter((edge) => edge.kind === 'routes' || edge.kind === 'uses' || edge.kind === 'guards').map((edge) => edge.to));
  const explicitFrom = new Set(edges.filter((edge) => edge.kind === 'routes' || edge.kind === 'uses' || edge.kind === 'guards').map((edge) => edge.from));
  const groups = new Map<number, RuntimeVisualNode[]>();
  orderedNodes(nodes).forEach((node, stableIndex) => {
    const phase = inferRuntimeSemanticPhase(node);
    const explicitIncoming = explicitTargets.has(node.id);
    const explicitOutgoing = explicitFrom.has(node.id);
    const phaseIndex = semanticPhaseOrder.indexOf(phase);
    const row = phase === 'unknown' ? Math.min(semanticPhaseOrder.length - 1, Math.max(0, Math.floor(stableIndex / 2) + 3)) : phaseIndex;
    const dependency = explicitIncoming || explicitOutgoing ? 'explicit' : phase === 'unknown' ? 'fallback' : 'inferred';
    const source = dependency === 'explicit' ? 'explicit dependency' : dependency === 'inferred' ? 'inferred semantic phase' : 'fallback order';
    const reason = dependency === 'explicit'
      ? `explicit graph edge ${explicitOutgoing ? 'from' : 'to'} this node plus semantic phase ${phase}`
      : dependency === 'inferred'
        ? `placed by semantic phase ${phase}; no hard dependency edge invented`
        : `stable fallback order ${stableIndex}; no hard dependency edge invented`;
    groups.set(row, [...(groups.get(row) ?? []), node]);
    node.layout = { x: 0, y: row, phase, evidence: { dependency, reason, source, row, column: 0 } };
  });
  const positioned: RuntimeVisualNode[] = [];
  Array.from(groups.entries()).sort(([a], [b]) => a - b).forEach(([row, group]) => {
    const sorted = orderedNodes(group);
    const center = (sorted.length - 1) / 2;
    sorted.forEach((node, column) => {
      const layout = node.layout ?? { x: 0, y: row, phase: inferRuntimeSemanticPhase(node), evidence: { dependency: 'fallback' as const, reason: 'stable fallback', source: 'fallback order' as const, row, column } };
      positioned.push({ ...node, layout: { ...layout, x: column - center, y: row, evidence: { ...layout.evidence, row, column } }, metadata: { ...(node.metadata ?? {}), layoutEvidence: { ...layout.evidence, row, column, phase: layout.phase, inferredOnly: layout.evidence.dependency !== 'explicit' } } });
    });
  });
  return positioned;
}

const sourceStatusFromNode = (node: RuntimeGeometryNode): RuntimeVisualSourceStatus => {
  const metadata = node.metadata ?? {};
  const rawStatus = String(metadata.sourceStatus ?? metadata.reuseStatus ?? metadata.status ?? '').toLowerCase();
  if (/source|reused/.test(rawStatus)) return 'source-library-reused';
  if (/reuse/.test(rawStatus)) return 'reuse-decision';
  if (/glue/.test(rawStatus)) return 'generated-glue';
  if (/unresolved/.test(rawStatus)) return 'unresolved';
  return node.kind === 'molt' ? 'reuse-decision' : 'runtime-draft';
};

function graphNodeToVisualNode(node: RuntimeGeometryNode): RuntimeVisualNode {
  const kind: RuntimeVisualNodeKind = node.kind === 'molt' ? 'molt_layer' : node.kind;
  return {
    id: node.kind === 'molt' ? `molt:${node.sourceId ?? node.id.replace(/^molt:/, '')}` : node.id,
    kind,
    label: node.label,
    shortLabel: shortRuntimeLabel(node.label, kind === 'capability' ? 26 : 20),
    icon: kind === 'neostack' ? '▦' : kind === 'neoblock' ? '◈' : kind === 'molt_layer' ? '▤' : kind === 'gate' ? '◇' : kind === 'capability' ? '⚙' : kind === 'sleeve' ? '⬢' : kind === 'artifact' ? '✦' : '◆',
    status: visualStatusFromOverlay(node.metadata, visualStatusFromGeometry(node.status)),
    sourceStatus: sourceStatusFromNode(node),
    parentId: node.parentId,
    neoStackId: node.kind === 'neoblock' ? node.parentId?.replace(/^neostack:/, '') : undefined,
    neoBlockId: node.kind === 'molt' ? node.parentId?.replace(/^neoblock:/, '') : node.kind === 'neoblock' ? node.sourceId ?? node.id.replace(/^neoblock:/, '') : undefined,
    traceEventIds: node.traceEvents.map((event, index) => eventId(event, index)),
    artifactIds: node.artifacts.map((artifact) => artifact.id),
    metadata: { ...(node.metadata ?? {}), sourceId: node.sourceId, aliases: node.aliases, traceEvents: node.traceEvents, artifacts: node.artifacts },
    rawNode: node
  };
}

function orderedNodes(nodes: RuntimeVisualNode[]) {
  return [...nodes].sort((a, b) => (a.stackOrder ?? Number(a.metadata?.stackOrder ?? a.metadata?.blockOrder ?? 999)) - (b.stackOrder ?? Number(b.metadata?.stackOrder ?? b.metadata?.blockOrder ?? 999)) || a.label.localeCompare(b.label));
}

export function buildRuntimeVisualViewModel(args: {
  activeSessionSleeve: NormalizedTemplateSleeve;
  geometryManifest?: UMGGeometryManifest;
  compiledRuntimeManifest?: UMGCompiledRuntimeManifest;
  hermesRuntimeVisualState?: UMGRuntimeVisualState;
  hermesRuntimeResult?: HermesCognitiveRuntimeResult;
  mode?: RuntimeVisualViewMode;
}): RuntimeVisualViewModel {
  const mode = args.mode ?? 'system_sleeve';
  const graph = buildRuntimeGeometryObserverGraph({
    activeSessionSleeve: args.activeSessionSleeve,
    geometryManifest: args.geometryManifest,
    compiledRuntimeManifest: args.compiledRuntimeManifest,
    hermesRuntimeVisualState: args.hermesRuntimeVisualState,
    hermesRuntimeResult: args.hermesRuntimeResult,
    mode: mode === 'runtime_path' ? 'runtime' : 'structure'
  });
  const baseNodes = graph.nodes.map(graphNodeToVisualNode);
  const artifactNodes: RuntimeVisualNode[] = (args.hermesRuntimeResult?.artifacts ?? []).map((artifact) => ({
    id: `artifact:${artifact.id}`,
    kind: 'artifact',
    label: artifact.label,
    shortLabel: artifact.label.length > 28 ? `${artifact.label.slice(0, 25)}…` : artifact.label,
    icon: '✦',
    status: 'complete',
    artifactIds: [artifact.id],
    metadata: { artifact }
  }));
  const resources: RuntimeVisualNode[] = [
    ['resource:source-library', 'source library'],
    ['resource:compiler-manifest', 'compiler manifest'],
    ['resource:hermes-runtime', 'Hermes runtime'],
    ['resource:capability-registry', 'capability registry'],
    ['context:upload-memory', 'upload/context memory'],
    ['resource:artifact-store', 'artifact store']
  ].map(([id, label]) => ({ id, label, kind: id.startsWith('context:') ? 'context' : 'resource', icon: id.startsWith('context:') ? '◌' : '▱', status: 'available', metadata: { foundation: true } as Record<string, unknown> }));
  const nodes = [...baseNodes, ...artifactNodes];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges: RuntimeVisualEdge[] = graph.edges.map((edge) => ({
    id: edge.id,
    from: edge.from,
    to: edge.to,
    kind: edge.kind === 'uses' ? 'uses' : edge.kind === 'guards' ? 'guards' : edge.kind === 'routes' ? 'routes' : 'contains',
    status: (edge.status ?? mergeStatus(byId.get(edge.from)?.status as RuntimeGeometryNodeStatus ?? 'idle', byId.get(edge.to)?.status as RuntimeGeometryNodeStatus ?? 'idle')) as RuntimeVisualNodeStatus,
    traceEventIds: [...(edge.traceEvents ?? []).map((event, index) => eventId(event, index)), ...(byId.get(edge.from)?.traceEventIds ?? []), ...(byId.get(edge.to)?.traceEventIds ?? [])]
  }));
  const neoStacks = buildRuntimeCognitiveTopology(nodes.filter((node) => node.kind === 'neostack'), edges);
  const neoBlocks = buildRuntimeCognitiveTopology(nodes.filter((node) => node.kind === 'neoblock'), edges);
  const gates = orderedNodes(nodes.filter((node) => node.kind === 'gate'));
  const capabilities = orderedNodes(nodes.filter((node) => node.kind === 'capability'));
  const neoBlockLayers = new Map<string, RuntimeVisualNode[]>();
  nodes.filter((node) => node.kind === 'molt_layer').forEach((layer) => {
    const key = layer.parentId?.replace(/^neoblock:/, '') ?? layer.neoBlockId ?? 'unknown';
    neoBlockLayers.set(key, orderedNodes([...(neoBlockLayers.get(key) ?? []), layer]));
  });
  const pathNodes = orderedNodes(neoBlocks.map((node) => args.mode === 'runtime_path' && !node.traceEventIds?.length ? { ...node, status: 'idle' as const } : node));
  return {
    mode,
    nodes,
    edges,
    pathNodes,
    neoStacks,
    neoBlocks,
    gates,
    capabilities,
    resources: resources.filter((node) => node.kind === 'resource'),
    contexts: resources.filter((node) => node.kind === 'context'),
    artifacts: artifactNodes,
    neoBlockLayers,
    unmappedEvents: graph.unmappedEvents
  };
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

export function deriveRuntimeExecutionState(args: { compiledRuntimeManifest?: UMGCompiledRuntimeManifest; isHermesRunning: boolean; pendingRuntimeApproval?: PendingRuntimeApproval; hermesRuntimeResult?: HermesCognitiveRuntimeResult; traceCount?: number }): RuntimeExecutionState {
  if (args.isHermesRunning) return args.traceCount ? 'running' : 'sending';
  if (args.pendingRuntimeApproval) return 'awaiting_approval';
  if (!args.compiledRuntimeManifest) return 'compiling_required';
  if (!args.hermesRuntimeResult) return 'ready';
  const traceTypes = new Set((args.hermesRuntimeResult.trace ?? []).map((event) => event.eventType));
  if (args.hermesRuntimeResult.status === 'needsApproval') return 'awaiting_approval';
  if (traceTypes.has('action_approval_required') || traceTypes.has('approval_required') || traceTypes.has('tool_call_requires_approval')) return 'awaiting_approval';
  if (args.hermesRuntimeResult.status === 'error' || args.hermesRuntimeResult.status === 'blocked' || traceTypes.has('action_failed') || traceTypes.has('run_error')) return 'failed';
  if (args.hermesRuntimeResult.nativeActionResult?.status === 'observed') return 'action_prepared';
  const hasActionRequest = traceTypes.has('action_request_created');
  const hasActionExecuted = traceTypes.has('action_executed');
  const hasFileOrArtifact = traceTypes.has('file_created') || traceTypes.has('file_modified') || traceTypes.has('artifact_created');
  if (traceTypes.has('run_completed') || (hasActionExecuted && hasFileOrArtifact)) return 'completed';
  if (hasActionRequest) return 'action_prepared';
  return args.hermesRuntimeResult.status === 'ok' && (args.traceCount ?? 0) > 0 ? 'action_prepared' : 'ready';
}


function runtimeResultTraceKey(result?: HermesCognitiveRuntimeResult) {
  if (!result) return '';
  return `${result.status}:${result.finalOutput}:${result.trace?.length ?? 0}:${result.artifacts?.length ?? 0}:${result.errors?.length ?? 0}`;
}

function resultHasActionPreparedWithoutTerminal(result?: HermesCognitiveRuntimeResult) {
  const types = new Set((result?.trace ?? []).map((event) => event.eventType));
  return types.has('action_request_created')
    && !types.has('action_executed')
    && !types.has('file_created')
    && !types.has('file_modified')
    && !types.has('artifact_created')
    && !types.has('run_completed')
    && !types.has('run_error');
}

function firstRuntimeText(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (isRecord(value)) {
    for (const key of ['naturalLanguage', 'natural_language', 'nl', 'message', 'output', 'finalOutput', 'summary']) {
      const text = firstRuntimeText(value[key]);
      if (text) return text;
    }
  }
  return undefined;
}

function buildRuntimeChatMessagesFromResult(result: HermesCognitiveRuntimeResult | undefined, mode: RuntimeNativeActionMode): HermesRuntimeChatMessage[] {
  if (!result) return [];
  const createdAt = new Date().toISOString();
  const relatedTraceId = result.trace?.[0]?.traceId;
  const messages: HermesRuntimeChatMessage[] = [];
  if (result.finalOutput?.trim()) {
    messages.push({ id: `hermes-${relatedTraceId ?? 'result'}-${result.trace?.length ?? 0}`, role: result.status === 'error' ? 'error' : 'hermes', content: result.finalOutput.trim(), createdAt, relatedTraceId, mode, metadata: { source: 'finalOutput' } });
  } else {
    const rawText = firstRuntimeText(result.raw);
    if (rawText) messages.push({ id: `hermes-raw-${relatedTraceId ?? 'result'}`, role: 'hermes', content: rawText, createdAt, relatedTraceId, mode, metadata: { source: 'raw' } });
  }
  if (!messages.length && resultHasActionPreparedWithoutTerminal(result)) {
    messages.push({ id: `system-no-nl-${relatedTraceId ?? 'result'}`, role: 'system', content: 'Hermes prepared an action but did not return a natural-language response.', createdAt, relatedTraceId, mode, metadata: { transparentFallback: true } });
  }
  if (mode === 'observe' && resultHasActionPreparedWithoutTerminal(result)) {
    messages.push({ id: `system-observe-${relatedTraceId ?? 'result'}`, role: 'system', content: 'Action prepared. Observe mode prepares the route only and does not execute external tools. Switch to Approval or Direct mode to execute, or continue in Observe to inspect the route only.', createdAt, relatedTraceId, mode, metadata: { modeExplanation: true } });
  }
  result.errors?.forEach((error, index) => messages.push({ id: `error-${relatedTraceId ?? 'result'}-${index}`, role: 'error', content: `${error.code}: ${error.message}`, createdAt, relatedTraceId: error.traceId ?? relatedTraceId, mode, metadata: { error } }));
  result.blockedCalls?.forEach((call, index) => messages.push({ id: `tool-blocked-${relatedTraceId ?? 'result'}-${index}`, role: 'tool', content: `Tool blocked or missing: ${call.toolName ?? call.toolId}. ${call.error ?? 'No execution occurred.'}`, createdAt, relatedTraceId: call.traceId ?? relatedTraceId, mode, metadata: { call } }));
  return messages;
}

function buildWorkLogRows(args: { endpoint?: string; mode: RuntimeNativeActionMode; runtimeState: RuntimeExecutionState; routeLabel: string; traceEvents: UMGTraceEvent[]; result?: HermesCognitiveRuntimeResult; status: string; errors: string[] }) {
  const rows: Array<{ id: string; label: string; value: string; raw?: unknown }> = [
    { id: 'endpoint', label: 'bridge endpoint', value: args.endpoint ?? 'VITE_HERMES_RUNTIME_ENDPOINT / local bridge', raw: { endpoint: args.endpoint } },
    { id: 'mode', label: 'action mode', value: args.mode, raw: { mode: args.mode } },
    { id: 'route', label: 'selected route', value: args.routeLabel },
    { id: 'state', label: 'runtime state', value: args.runtimeState },
    { id: 'status', label: 'status', value: args.status }
  ];
  args.traceEvents.forEach((event, index) => rows.push({ id: `trace-${index}`, label: event.eventType, value: event.label ?? event.message ?? event.state, raw: event }));
  (args.result?.toolCalls ?? []).forEach((call, index) => rows.push({ id: `tool-${index}`, label: 'tool requested', value: `${call.toolName ?? call.toolId}: ${call.status}`, raw: call }));
  (args.result?.approvalRequests ?? []).forEach((approval, index) => rows.push({ id: `approval-${index}`, label: 'approval boundary', value: `${approval.label}: ${approval.status}`, raw: approval }));
  const native = args.result?.nativeActionResult;
  if (native) rows.push({ id: 'native-result', label: 'native action result', value: `${native.status}; externalActionTaken=${native.externalActionTaken}`, raw: native });
  args.errors.forEach((error, index) => rows.push({ id: `error-row-${index}`, label: 'error', value: error }));
  return rows;
}

function inferMissingCapability(args: { result?: HermesCognitiveRuntimeResult; prompt: string; mode: RuntimeNativeActionMode; compiledRuntimeManifest?: UMGCompiledRuntimeManifest }) {
  if (!args.result) return undefined;
  const registry = args.compiledRuntimeManifest?.toolPolicy?.registry ?? [];
  const missingRegistry = registry.find((entry) => entry.status === 'missing' || entry.availableInHermes === false);
  const blocked = args.result?.blockedCalls?.[0];
  const missingError = args.result?.errors?.find((error) => /missing|unavailable|capability|tool/i.test(`${error.code} ${error.message}`));
  if (!blocked && !missingError) return undefined;
  const projectEditNeeded = /servuo|c#|script|file|edit|dagger|poison/i.test(args.prompt);
  const needed = blocked?.toolName ?? blocked?.toolId ?? missingRegistry?.toolName ?? missingRegistry?.toolId ?? (projectEditNeeded ? 'project file edit' : missingError?.code ?? 'runtime tool');
  return {
    needed,
    why: projectEditNeeded ? 'This task appears to require creating or editing a project/server script, which is outside Observe execution and needs an active file-edit tool boundary.' : 'The runtime route identified a tool/capability that is not available for execution.',
    suggestedMoltBlock: projectEditNeeded ? 'ServUO Item Script Creation Tool Requirement' : `Tool Requirement: ${needed}`,
    suggestedNeoBlock: projectEditNeeded ? 'ServUO Item Script Creation' : `Capability Setup: ${needed}`,
    prompt: projectEditNeeded ? 'Create MOLT Block: ServUO Item Script Creation Tool Requirement' : `Create MOLT Block: ${needed} Tool Requirement`,
    mode: args.mode
  };
}

function routeStatusLabel(state: RuntimeExecutionState, traceCount: number) {
  if (state === 'compiling_required') return 'Starting route: compile required';
  if (state === 'ready') return 'Starting route: ready · Waiting for trace';
  if (state === 'sending') return 'Starting route · Waiting for trace';
  if (state === 'running') return traceCount ? 'Running' : 'Starting route · Waiting for trace';
  if (state === 'action_prepared') return 'Action prepared · awaiting execution result';
  if (state === 'awaiting_approval') return 'Running · awaiting approval';
  if (state === 'completed') return 'Completed';
  if (state === 'failed') return 'Failed';
  return 'idle';
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
  hermesRuntimeErrors = [],
  isHermesRunning,
  pendingRuntimeApproval,
  nativeActionMode = 'observe',
  onNativeActionModeChange,
  onDraftMissingMoltBlock
}: RuntimeGeometryObserverProps) {
  const [viewMode, setViewMode] = useState<RuntimeVisualViewMode>('system_sleeve');
  const [leftRailOpen, setLeftRailOpen] = useState(false);
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'JSON' | 'Trace' | 'Manifest' | 'Artifacts' | 'Diagnostics' | 'Hermes Terminal'>('JSON');
  const [runtimeChatMessages, setRuntimeChatMessages] = useState<HermesRuntimeChatMessage[]>([]);
  const [expandedWorkLogRawIds, setExpandedWorkLogRawIds] = useState<Set<string>>(() => new Set());
  const [activeHermesThoughtSummary, setActiveHermesThoughtSummary] = useState('No visible response yet.');
  const [lastHermesNaturalLanguage, setLastHermesNaturalLanguage] = useState('');
  const [lastHermesError, setLastHermesError] = useState('');
  const [lastToolAccessStatus, setLastToolAccessStatus] = useState('not checked');
  const [localNativeActionMode, setLocalNativeActionMode] = useState<RuntimeNativeActionMode>(nativeActionMode);
  const lastResultKeyRef = useRef('');
  const [graphScale, setGraphScale] = useState(1);
  const [graphPan, setGraphPan] = useState({ x: 0, y: 0 });
  const [isGraphDragging, setIsGraphDragging] = useState(false);
  const graphDragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const model = useMemo(() => buildRuntimeVisualViewModel({ activeSessionSleeve, compiledRuntimeManifest, geometryManifest, hermesRuntimeVisualState, hermesRuntimeResult, mode: viewMode }), [activeSessionSleeve, compiledRuntimeManifest, geometryManifest, hermesRuntimeVisualState, hermesRuntimeResult, viewMode]);
  const graph = useMemo(() => buildRuntimeGeometryObserverGraph({ activeSessionSleeve, compiledRuntimeManifest, geometryManifest, hermesRuntimeVisualState, hermesRuntimeResult, mode: viewMode === 'runtime_path' ? 'runtime' : 'structure' }), [activeSessionSleeve, compiledRuntimeManifest, geometryManifest, hermesRuntimeVisualState, hermesRuntimeResult, viewMode]);
  const grouped = useMemo(() => groupByParent(graph.nodes), [graph.nodes]);
  const traceEvents = hermesRuntimeVisualState?.timeline ?? hermesRuntimeResult?.trace ?? [];
  const artifactCount = hermesRuntimeResult?.artifacts?.length ?? 0;
  const runtimeExecutionState = deriveRuntimeExecutionState({ compiledRuntimeManifest, isHermesRunning, pendingRuntimeApproval, hermesRuntimeResult, traceCount: traceEvents.length });
  const runtimeExecutionMode: RuntimeExecutionMode = 'batch';
  const selectedNativeActionMode = onNativeActionModeChange ? nativeActionMode : localNativeActionMode;
  const setSelectedNativeActionMode = (mode: RuntimeNativeActionMode) => {
    setLocalNativeActionMode(mode);
    onNativeActionModeChange?.(mode);
  };
  const nativeActionModeLabel = selectedNativeActionMode === 'observe' ? 'Observe' : selectedNativeActionMode === 'approval' ? 'Approval' : 'Direct';
  const nativeActionModeCopy = selectedNativeActionMode === 'observe'
    ? 'Observe: prepares route only; no external action'
    : selectedNativeActionMode === 'approval'
      ? 'Approval: prepares action and waits'
      : 'Direct: executes allowed native Hermes actions';
  const canSendRuntimePrompt = Boolean(compiledRuntimeManifest && runtimePrompt.trim() && !isHermesRunning);
  const runtimeExecutionCopy = !compiledRuntimeManifest
    ? 'Structure view is available. Runtime execution requires compile.'
    : isHermesRunning
      ? 'Hermes working…'
      : 'Runtime trace appears after Hermes runs.';
  const submitRuntimePrompt = () => {
    if (!canSendRuntimePrompt) return;
    const now = new Date().toISOString();
    setRuntimeChatMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: runtimePrompt.trim(), createdAt: now, mode: selectedNativeActionMode }]);
    setActiveHermesThoughtSummary('Prompt sent to Hermes runtime bridge. Waiting for visible response or transparent execution-boundary status.');
    onRunHermesRuntime();
  };
  const handleRuntimePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    submitRuntimePrompt();
  };
  useEffect(() => {
    const key = runtimeResultTraceKey(hermesRuntimeResult);
    if (!key || key === lastResultKeyRef.current) return;
    lastResultKeyRef.current = key;
    const messages = buildRuntimeChatMessagesFromResult(hermesRuntimeResult, selectedNativeActionMode);
    if (!messages.length) return;
    setRuntimeChatMessages((current) => [...current, ...messages]);
    const hermesMessage = messages.find((message) => message.role === 'hermes');
    const errorMessage = messages.find((message) => message.role === 'error');
    setActiveHermesThoughtSummary(resultHasActionPreparedWithoutTerminal(hermesRuntimeResult) ? 'Action route prepared; waiting at execution boundary.' : 'Hermes returned a visible runtime response.');
    if (hermesMessage) setLastHermesNaturalLanguage(hermesMessage.content);
    if (errorMessage) setLastHermesError(errorMessage.content);
    const nativeStatus = hermesRuntimeResult?.nativeActionResult?.status;
    setLastToolAccessStatus(nativeStatus ? `${nativeStatus}; externalActionTaken=${hermesRuntimeResult?.nativeActionResult?.externalActionTaken}` : `${hermesRuntimeResult?.toolCalls?.length ?? 0} tool calls; ${hermesRuntimeResult?.blockedCalls?.length ?? 0} blocked`);
  }, [hermesRuntimeResult, selectedNativeActionMode]);

  const summary = useMemo(() => {
    try { return summarizeGeometryManifest(geometryManifest ?? buildRuntimeGeometryManifest({ templateSleeve: activeSessionSleeve, compiledRuntimeManifest })); } catch { return undefined; }
  }, [activeSessionSleeve, compiledRuntimeManifest, geometryManifest]);
  const firstStack = model.neoStacks[0];
  const firstBlock = model.neoBlocks[0];
  const [selectedStackId, setSelectedStackId] = useState<string | undefined>();
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const selectedStack = model.neoStacks.find((node) => node.id === selectedStackId) ?? firstStack;
  const selectedBlock = model.neoBlocks.find((node) => node.id === selectedNodeId) ?? model.neoBlocks.find((node) => node.parentId === selectedStack?.id) ?? firstBlock;
  const sleeveNode = model.nodes.find((node) => node.kind === 'sleeve');
  const selectedVisualNode = model.nodes.find((node) => node.id === selectedNodeId) ?? (viewMode === 'neostack' ? selectedStack : selectedBlock) ?? selectedStack ?? sleeveNode;
  const selectedGeometryNode = selectedVisualNode?.rawNode;
  const selectVisualNode = (node: RuntimeVisualNode) => {
    setSelectedNodeId(node.id);
    if (node.kind === 'neostack') setSelectedStackId(node.id);
    if (node.kind === 'neoblock' && node.parentId) setSelectedStackId(node.parentId);
  };
  const selectStack = (node: RuntimeVisualNode) => {
    setSelectedStackId(node.id);
    setSelectedNodeId(node.id);
  };
  const selectBlock = (node: RuntimeVisualNode) => {
    setSelectedNodeId(node.id);
    if (node.parentId) setSelectedStackId(node.parentId);
  };
  const childBlocksForStack = (stackId?: string) => model.neoBlocks.filter((block) => block.parentId === stackId);
  const centeredStackOrder = useMemo(() => buildRuntimeCognitiveTopology(model.neoStacks, model.edges), [model.neoStacks, model.edges]);
  const tieredBlocksForStack = (stackId?: string) => childBlocksForStack(stackId).reduce((tiers, block) => {
    tiers[tierScore(`${block.label} ${block.id}`)].push(block);
    return tiers;
  }, [[], [], []] as RuntimeVisualNode[][]);
  const layersForBlock = (block?: RuntimeVisualNode) => model.neoBlockLayers.get(block?.id.replace(/^neoblock:/, '') ?? '') ?? [];
  const foundationItems = [...model.resources, ...model.contexts];
  const sourceBoundLayerCount = (block: RuntimeVisualNode) => layersForBlock(block).filter((layer) => layer.sourceStatus === 'source-library-reused' || Boolean(layer.metadata?.matchedCandidateId)).length;
  const sourceBoundLayerCountForStack = (stackId?: string) => childBlocksForStack(stackId).reduce((total, block) => total + sourceBoundLayerCount(block), 0);
  const graphViewportStyle = { transform: `translate(${graphPan.x}px, ${graphPan.y}px) scale(${graphScale})`, transformOrigin: 'center center' };
  const fitGraph = () => { setGraphScale(0.9); setGraphPan({ x: 0, y: 0 }); };
  const resetGraph = () => { setGraphScale(1); setGraphPan({ x: 0, y: 0 }); };
  const zoomGraph = (delta: number) => setGraphScale((current) => Math.min(1.4, Math.max(0.7, Number((current + delta).toFixed(2)))));
  const startGraphPan = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, textarea, input, select, summary, details, a')) return;
    setIsGraphDragging(true);
    graphDragStartRef.current = { x: event.clientX, y: event.clientY, panX: graphPan.x, panY: graphPan.y };
  };
  const moveGraphPan = (event: MouseEvent<HTMLElement>) => {
    if (!isGraphDragging) return;
    const start = graphDragStartRef.current;
    setGraphPan({ x: start.panX + event.clientX - start.x, y: start.panY + event.clientY - start.y });
  };
  const stopGraphPan = () => setIsGraphDragging(false);
  const handleGraphWheel = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault();
    zoomGraph(event.deltaY < 0 ? 0.08 : -0.08);
  };

  const topologyRows = (nodes: RuntimeVisualNode[]) => Array.from(nodes.reduce((rows, node) => {
    const row = node.layout?.y ?? 0;
    rows.set(row, [...(rows.get(row) ?? []), node]);
    return rows;
  }, new Map<number, RuntimeVisualNode[]>()).entries()).sort(([a], [b]) => a - b).map(([row, rowNodes]) => ({ row, nodes: rowNodes.sort((a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0) || a.label.localeCompare(b.label)) }));

  const renderVisualNode = (node: RuntimeVisualNode, extra = '') => {
    const overlay = isRecord(node.metadata?.overlay) ? node.metadata.overlay : undefined;
    return <button key={node.id} type="button" title={node.label} className={`runtime-node runtime-compact-node runtime-node--${node.status} runtime-node--${node.kind} ${overlay ? `runtime-map-card--${String(overlay.activationState)}` : ''} ${selectedVisualNode?.id === node.id ? 'runtime-node--selected' : ''} ${extra}`} onClick={() => selectVisualNode(node)}>
    <span className="runtime-node-icon">{node.icon}</span>
    <b>{node.shortLabel ?? shortRuntimeLabel(node.label)}</b>
    <small>{node.kind.replace('_', ' ')}</small>
    <span className="runtime-node-chip-row">{overlay && <i>{String(overlay.rowLabel ?? 'overlay row')}</i>}{(node.traceEventIds?.length ?? 0) > 0 && <i>{node.traceEventIds?.length} trace</i>}{(node.artifactIds?.length ?? 0) > 0 && <i>{node.artifactIds?.length} artifact</i>}</span>
  </button>;
  };

  const renderCompactEdge = (edge?: RuntimeVisualEdge, extra = '') => <div className={`runtime-map-edge runtime-map-edge--${edge?.status ?? 'idle'} ${edge?.traceEventIds?.length ? 'runtime-map-edge--glow' : ''} ${extra}`} aria-label="runtime connector" />;

  const renderSystemSleeveView = () => <div className="runtime-system-sleeve-view" style={graphViewportStyle}>
    <section className="runtime-sleeve-package">
      <div className="runtime-sleeve-banner">
        <span className="runtime-sleeve-icon">⬢</span>
        <div><h2>Sleeve Overview</h2><b>{activeSessionSleeve.title}</b><small>{model.neoStacks.length} NeoStacks · {model.neoBlocks.length} NeoBlocks · {summary ? `${summary.totalMoltBindings} MOLT Blocks · ${summary.totalGates} Gates · ${summary.totalToolEndpoints} Tool Blocks · ${model.capabilities.length} Capabilities` : 'manifest pending'}</small></div>
      </div>
      <div className="runtime-neostack-clusters runtime-map-centered">
        {model.neoStacks.map((stack, stackIndex) => <article key={stack.id} className="runtime-neostack-cluster runtime-map-card">
          {stackIndex > 0 && renderCompactEdge(model.edges.find((edge) => edge.kind === 'routes' && (edge.from === stack.id || edge.to === stack.id)), 'runtime-map-edge--down')}
          <button type="button" title={stack.label} className={`runtime-node runtime-compact-node runtime-stack-node runtime-node--${stack.status} runtime-stack-title ${selectedStack?.id === stack.id ? 'runtime-node--selected' : ''}`} onClick={() => selectStack(stack)}>
            <span className="runtime-node-icon">▦</span><b>{stack.shortLabel ?? shortRuntimeLabel(stack.label)}</b><small>{childBlocksForStack(stack.id).length} NeoBlocks · {sourceBoundLayerCountForStack(stack.id)} source-bound · {stack.status}</small>
          </button>
        </article>)}
      </div>
      <small>Sleeve Overview answers what major work stacks are inside the Sleeve. Diagnostics stay in the drawers/rails, not the graph canvas.</small>
    </section>
  </div>;

  const renderNeoStackView = () => <div className="runtime-neostack-view runtime-map-centered" style={graphViewportStyle}>
    <h2>NeoStack Map</h2>
    <small>NeoStack Map uses deterministic cognitive topology. Inferred placement is layout-only and does not create dependency edges.</small>
    <div className="runtime-stack-pyramid runtime-cognitive-topology" aria-label="NeoStack-only runtime graph">
      {topologyRows(centeredStackOrder).map(({ row, nodes }) => <div key={`stack-row-${row}`} className="runtime-cognitive-row" data-row={row}>
        {row > 0 && <div className="runtime-row-phase-label">{nodes[0]?.layout?.phase ?? 'unknown'}</div>}
        {nodes.map((stack) => <div key={stack.id} className="runtime-cognitive-node-wrap" data-layout-x={stack.layout?.x ?? 0} data-layout-phase={stack.layout?.phase}>
          {row > 0 && renderCompactEdge(model.edges.find((edge) => edge.to === stack.id || edge.from === stack.id), 'runtime-map-edge--down')}
          <button type="button" title={stack.label} className={`runtime-node runtime-compact-node runtime-stack-node runtime-node--${stack.status} ${selectedStack?.id === stack.id ? 'runtime-node--selected' : ''}`} onClick={() => selectStack(stack)}>
            <span className="runtime-node-icon">▦</span><b>{stack.shortLabel ?? shortRuntimeLabel(stack.label)}</b><small>{childBlocksForStack(stack.id).length} NeoBlocks · {sourceBoundLayerCountForStack(stack.id)} source-bound · {stack.status}</small><span className="runtime-node-chip-row"><i>{stack.layout?.evidence.dependency ?? 'inferred'} layout</i></span>
          </button>
        </div>)}
      </div>)}
    </div>
    {selectedStack && <div className="runtime-selected-stack-summary"><b>{selectedStack.label}</b><small>{childBlocksForStack(selectedStack.id).length} NeoBlocks · {sourceBoundLayerCountForStack(selectedStack.id)} source-bound MOLT Blocks · status {selectedStack.status}</small></div>}
  </div>;

  const renderNeoBlockView = () => <div className="runtime-neoblock-view runtime-map-centered" style={graphViewportStyle}>
    <h2>NeoBlock Map</h2>
    <small>Structural route of all NeoBlocks across all NeoStacks. Runtime trace is not required.</small>
    <small>NeoBlocks are arranged by semantic phase and parent NeoStack. Layout may be inferred; graph edges remain real only.</small>
    <div className="runtime-neoblock-module-map runtime-neoblock-all-lanes runtime-cognitive-topology" aria-label="All NeoBlocks by NeoStack">
      {topologyRows(model.neoBlocks).map(({ row, nodes }) => <section key={`block-row-${row}`} className="runtime-cognitive-row runtime-neoblock-phase-row" aria-label={`NeoBlock phase ${nodes[0]?.layout?.phase ?? 'unknown'}`}>
        <header className="runtime-row-phase-label"><b>{nodes[0]?.layout?.phase ?? 'unknown'}</b><small>{nodes.length} NeoBlocks</small></header>
        {nodes.map((block) => {
          const parentStack = model.neoStacks.find((stack) => stack.id === block.parentId);
          const edge = model.edges.find((entry) => entry.kind === 'routes' && (entry.from === block.id || entry.to === block.id));
          const overlay = isRecord(block.metadata?.overlay) ? block.metadata.overlay : undefined;
          return <div key={block.id} className="runtime-neoblock-lane-step runtime-cognitive-node-wrap" data-layout-x={block.layout?.x ?? 0} data-layout-phase={block.layout?.phase}>{row > 0 && renderCompactEdge(edge, 'runtime-map-edge--tier')}<button type="button" title={block.label} className={`runtime-node runtime-compact-node runtime-map-card runtime-node--${block.status} ${overlay ? `runtime-map-card--${String(overlay.activationState)}` : ''} runtime-neoblock-module ${selectedBlock?.id === block.id ? 'runtime-node--selected' : ''}`} onClick={() => selectBlock(block)}><span className="runtime-node-icon">◈</span><b>{block.shortLabel ?? shortRuntimeLabel(block.label)}</b><small>Parent NeoStack: {parentStack?.shortLabel ?? parentStack?.label ?? block.parentId ?? 'unknown'}</small><span className="runtime-node-chip-row"><i>{layersForBlock(block).length} MOLT Blocks</i><i>{sourceBoundLayerCount(block)} source-bound</i><i>{String(overlay?.rowLabel ?? block.layout?.evidence.dependency ?? 'inferred')}</i></span></button></div>;
        })}
      </section>)}
    </div>
    <small>MOLT details are intentionally compressed into the right inspector and bottom drawer; they are not graph cards in NeoBlock Map.</small>
  </div>;

  const renderRuntimePathView = () => <div className="runtime-path-view runtime-map-centered" style={graphViewportStyle}>
    <h2>Runtime Path View</h2>
    {traceEvents.length === 0 && <div className="runtime-geometry-empty-trace">No runtime trace yet. Send a task to Hermes to activate the route.</div>}
    {traceEvents.length === 0 && <small>Planned route skeleton is shown idle until a real Hermes trace arrives.</small>}
    <div className="runtime-path-map" aria-label="Compact active runtime route map">
      {model.pathNodes.map((node, index) => {
        const previous = model.pathNodes[index - 1];
        const edge = previous ? model.edges.find((entry) => (entry.from === previous.id && entry.to === node.id) || entry.to === node.id || entry.from === node.id) : undefined;
        return <div key={node.id} className="runtime-path-step runtime-path-step--compact">{index > 0 && renderCompactEdge(edge)}{renderVisualNode(node, 'runtime-path-node')}</div>;
      })}
    </div>
  </div>;

  const drawerPayload = selectedVisualNode ? { id: selectedVisualNode.id, kind: selectedVisualNode.kind, label: selectedVisualNode.label, status: selectedVisualNode.status, sourceStatus: selectedVisualNode.sourceStatus, metadata: selectedVisualNode.metadata } : { sleeve: activeSessionSleeve.title };
  const selectedTrace = selectedGeometryNode?.traceEvents ?? [];
  const selectedArtifacts = selectedGeometryNode?.artifacts ?? hermesRuntimeResult?.artifacts ?? [];
  const inspectorLayers = selectedVisualNode?.kind === 'neoblock'
    ? layersForBlock(selectedVisualNode)
    : selectedVisualNode?.kind === 'neostack'
      ? childBlocksForStack(selectedVisualNode.id).flatMap((block) => layersForBlock(block))
      : selectedBlock
        ? layersForBlock(selectedBlock)
        : [];
  const runtimeWorkLogRows = buildWorkLogRows({ endpoint: toText(hermesRuntimeResult?.raw && isRecord(hermesRuntimeResult.raw) ? hermesRuntimeResult.raw.endpoint : undefined), mode: selectedNativeActionMode, runtimeState: runtimeExecutionState, routeLabel: routeStatusLabel(runtimeExecutionState, traceEvents.length), traceEvents, result: hermesRuntimeResult, status: runtimeStatus, errors: hermesRuntimeErrors });
  const missingCapability = inferMissingCapability({ result: hermesRuntimeResult, prompt: runtimePrompt || [...runtimeChatMessages].reverse().find((message) => message.role === 'user')?.content || '', mode: selectedNativeActionMode, compiledRuntimeManifest });
  const toggleWorkLogRaw = (rowId: string, open: boolean) => setExpandedWorkLogRawIds((current) => {
    const next = new Set(current);
    if (open) next.add(rowId); else next.delete(rowId);
    return next;
  });
  const latestResponseMessage = [...runtimeChatMessages].reverse().find((message) => message.role === 'hermes' || message.role === 'system' || message.role === 'error');
  const renderHermesTerminalDrawer = () => <section className="runtime-hermes-terminal-drawer runtime-hermes-terminal-drawer--split" aria-label="Hermes Terminal drawer">
    <div className="runtime-hermes-terminal-panels">
      <section className="runtime-hermes-terminal-left" aria-label="Hermes transcript and prompt">
        <header><h2>Hermes Terminal</h2><small>Prompt, Send to Hermes, transcript, and system boundary notes.</small></header>
        <div className="runtime-hermes-terminal-prompt-row">
          <label className="runtime-geometry-prompt"><span>Runtime prompt</span><textarea value={runtimePrompt} onChange={(event) => onRuntimePromptChange(event.target.value)} onKeyDown={handleRuntimePromptKeyDown} placeholder="Ask Hermes to perform a task through this Sleeve…" disabled={isHermesRunning} aria-label="Runtime prompt" /></label>
          <button type="button" className="publicPrimaryCta" disabled={!canSendRuntimePrompt} onClick={submitRuntimePrompt}>{isHermesRunning ? 'Hermes working…' : 'Send to Hermes'}</button>
        </div>
        <small className="runtime-action-mode-copy">Selected action mode: {nativeActionModeLabel}. {nativeActionModeCopy}</small>
        <section className="runtime-hermes-chat-panel" aria-label="Hermes Chat">
          <header><h3>Conversation history</h3></header>
          {selectedNativeActionMode === 'observe' && runtimeChatMessages.length > 0 && <p className="runtime-observe-explainer">Observe mode prepares the route only. It does not execute external tools. Switch to Approval or Direct mode to cross execution boundaries.</p>}
          <ol className="runtime-chat-transcript">{runtimeChatMessages.length ? runtimeChatMessages.map((message) => <li key={message.id} className={`runtime-chat-message runtime-chat-message--${message.role}`}><b>{message.role === 'hermes' ? 'Hermes' : message.role}</b><span>{message.content}</span><small>{message.createdAt}{message.mode ? ` · ${message.mode}` : ''}</small></li>) : <li className="runtime-chat-message runtime-chat-message--system"><b>system</b><span>No runtime request yet. Send a prompt to Hermes.</span></li>}</ol>
        </section>
      </section>
      <section className="runtime-hermes-response-pane" aria-label="Hermes Response">
        <header><h2>Hermes Response</h2><small>Latest visible response, route/tool selection, suggestions, and approvals.</small></header>
        <article className={`runtime-hermes-response-card runtime-hermes-response-card--${latestResponseMessage?.role ?? 'empty'}`}>
          <b>{latestResponseMessage?.role === 'hermes' ? 'Hermes' : latestResponseMessage?.role ?? 'system boundary'}</b>
          <p>{latestResponseMessage?.content ?? 'No Hermes response yet.'}</p>
          <small>{latestResponseMessage ? `${latestResponseMessage.createdAt}${latestResponseMessage.mode ? ` · ${latestResponseMessage.mode}` : ''}` : 'Waiting for a real Hermes NL response or an honest system boundary message.'}</small>
        </article>
        <div className="runtime-chat-status-grid"><span><b>selected route</b>{routeStatusLabel(runtimeExecutionState, traceEvents.length)}</span><span><b>selected mode</b>{nativeActionModeLabel}</span><span><b>selected tool/route</b>{lastToolAccessStatus}</span><span><b>artifacts</b>{artifactCount}</span></div>
        {selectedNativeActionMode === 'observe' && <p className="runtime-observe-explainer">Action prepared explanation: Observe mode routes only; externalActionTaken remains false unless a later Approval/Direct run actually executes.</p>}
        {selectedNativeActionMode === 'direct' && <p className="runtime-direct-warning">Direct mode guard: only safe/allowed native Hermes capabilities may execute. Risky or missing capabilities are blocked or routed to approval.</p>}
        {pendingRuntimeApproval && <div className="runtime-geometry-approval"><b>Approval request</b><button type="button" onClick={() => onContinueRuntimeApproval('approve')} disabled={isHermesRunning}>Approve & Continue</button><button type="button" onClick={() => onContinueRuntimeApproval('skip')} disabled={isHermesRunning}>Skip</button><button type="button" onClick={() => onContinueRuntimeApproval('deny')} disabled={isHermesRunning}>Deny</button></div>}
        {missingCapability && <aside className="runtime-missing-capability-card" aria-label="Missing capability detected"><h3>Missing capability detected</h3><div><b>needed tool/block</b><span>{missingCapability.needed}</span></div><div><b>why it is needed</b><span>{missingCapability.why}</span></div><div><b>suggested MOLT block</b><span>{missingCapability.suggestedMoltBlock}</span></div><div><b>suggested NeoBlock</b><span>{missingCapability.suggestedNeoBlock}</span></div><button type="button" onClick={() => onDraftMissingMoltBlock?.(missingCapability.prompt)}>Draft MOLT Block</button><button type="button" onClick={() => onDraftMissingMoltBlock?.(`Create NeoBlock support block: ${missingCapability.suggestedNeoBlock}`)}>Draft NeoBlock</button><button type="button" onClick={() => onDraftMissingMoltBlock?.(`${missingCapability.prompt}. Save to Workspace when validated.`)}>Save to Workspace</button><button type="button" disabled>Cancel</button></aside>}
      </section>
    </div>
    <details className="runtime-work-log-panel" aria-label="Hermes Work Log / Terminal">
      <summary>Hermes Work Log / Terminal</summary>
      <ol className="runtime-work-log-rows">{runtimeWorkLogRows.map((row) => <li key={row.id}><b>{row.label}</b><span>{row.value}</span>{row.raw !== undefined && <details open={expandedWorkLogRawIds.has(row.id)} onToggle={(event) => toggleWorkLogRaw(row.id, event.currentTarget.open)}><summary>raw JSON</summary>{expandedWorkLogRawIds.has(row.id) && <pre>{JSON.stringify(row.raw, null, 2).slice(0, 3000)}</pre>}</details>}</li>)}</ol>
    </details>
    <details className="runtime-debug-disclosure" aria-label="Runtime Debug">
      <summary>Runtime Debug</summary>
      <div className="runtime-chat-status-grid"><span><b>mode</b>{nativeActionModeLabel}</span><span><b>thought summary</b>{activeHermesThoughtSummary}</span><span><b>last NL</b>{lastHermesNaturalLanguage || 'none yet'}</span><span><b>last error</b>{lastHermesError || 'none'}</span><span><b>tool access</b>{lastToolAccessStatus}</span><span><b>runtime state</b>{runtimeExecutionState}</span><span><b>bridge endpoint</b>{runtimeWorkLogRows.find((row) => row.id === 'endpoint')?.value ?? 'local bridge'}</span></div>
    </details>
  </section>;

  return <section className="runtime-geometry-observer runtime-graph-shell" aria-label="Runtime Graph">
    <header className="runtime-geometry-header runtime-top-status">
      <div>
        <p className="runtime-geometry-eyebrow">Runtime Graph</p>
        <h1>{activeSessionSleeve.title}</h1>
        <small>{runtimeExecutionCopy} Real trace is the only activation source; MOLT Blocks stay compressed inside NeoBlocks.</small>
      </div>
      <div className="runtime-geometry-status-grid">
        <span><b>compile</b>{compileStatus}</span>
        <span><b>runtime state</b>{runtimeExecutionState}</span>
        <span><b>route</b>{routeStatusLabel(runtimeExecutionState, traceEvents.length)}</span>
        <span><b>Graph Mode</b>{runtimeExecutionMode === 'batch' ? 'Runtime Path batch' : runtimeExecutionMode}</span>
        <span><b>Action Mode</b>{nativeActionModeLabel}</span>
        <span><b>Hermes</b>{runtimeStatus}</span>
        <span><b>trace</b>{traceEvents.length}</span>
        <span><b>artifacts</b>{artifactCount}</span>
        <span><b>unmapped</b>{model.unmappedEvents.length}</span>
      </div>
    </header>

    <div className="runtime-geometry-controls runtime-view-tabs">
      <button type="button" onClick={onBackToBuilder}>Back to Sleeve Builder</button>
      {(['system_sleeve', 'neostack', 'neoblock', 'runtime_path'] as RuntimeVisualViewMode[]).map((tab) => <button key={tab} type="button" className={viewMode === tab ? 'hot' : ''} onClick={() => setViewMode(tab)}>{tab === 'system_sleeve' ? 'Sleeve Overview' : tab === 'neostack' ? 'NeoStack Map' : tab === 'neoblock' ? 'NeoBlock Map' : 'Runtime Path'}</button>)}
      <div className="runtime-action-mode-control" aria-label="Action Mode"><span>Action Mode:</span>{(['observe', 'approval', 'direct'] as RuntimeNativeActionMode[]).map((mode) => <button key={mode} type="button" className={selectedNativeActionMode === mode ? 'hot' : ''} onClick={() => setSelectedNativeActionMode(mode)}>{mode === 'observe' ? 'Observe' : mode === 'approval' ? 'Approval' : 'Direct'}</button>)}</div>
      <div className="runtime-pan-zoom-controls" aria-label="Runtime graph fit and zoom controls"><button type="button" onClick={fitGraph}>Fit graph</button><button type="button" onClick={resetGraph}>Reset graph</button><span>{Math.round(graphScale * 100)}%</span></div>
    </div>

    <div className={`runtime-main-layout ${leftRailOpen ? 'runtime-main-layout--left-open' : ''} ${rightRailOpen ? 'runtime-main-layout--right-open' : ''}`}>
      <aside className="runtime-left-rail" aria-label="Runtime hierarchy rail"><button type="button" onClick={() => setLeftRailOpen(!leftRailOpen)}>{leftRailOpen ? 'Collapse hierarchy' : 'Open hierarchy'}</button>{leftRailOpen && <><h2>Sleeve hierarchy</h2>{model.neoStacks.map((stack) => <section key={stack.id}><button type="button" onClick={() => { selectStack(stack); setViewMode('neostack'); }}><b>{stack.label}</b></button>{childBlocksForStack(stack.id).map((block) => <button key={block.id} type="button" onClick={() => { selectBlock(block); setViewMode('neoblock'); }}>{block.label}</button>)}</section>)}</>}</aside>
      <main className={`runtime-graph-surface ${isGraphDragging ? 'runtime-graph-surface--dragging' : ''}`} aria-label="Runtime graph surface" onMouseDown={startGraphPan} onMouseMove={moveGraphPan} onMouseUp={stopGraphPan} onMouseLeave={stopGraphPan} onWheel={handleGraphWheel}>{viewMode === 'system_sleeve' && renderSystemSleeveView()}{viewMode === 'neostack' && renderNeoStackView()}{viewMode === 'neoblock' && renderNeoBlockView()}{viewMode === 'runtime_path' && renderRuntimePathView()}</main>
      <aside className="runtime-right-rail" aria-label="Runtime trace and artifact rail"><button type="button" onClick={() => setRightRailOpen(!rightRailOpen)}>{rightRailOpen ? 'Collapse runtime inspector' : 'Open runtime inspector'}</button>{rightRailOpen && <><h2>Runtime Inspector</h2><div className="runtime-rail-summary"><span><b>Active route</b>{routeStatusLabel(runtimeExecutionState, traceEvents.length)}</span><span><b>Current node</b>{selectedVisualNode?.shortLabel ?? selectedVisualNode?.label ?? 'none'}</span><span><b>Trace count</b>{traceEvents.length}</span><span><b>Artifact count</b>{artifactCount}</span><span><b>Unmapped count</b>{model.unmappedEvents.length}</span></div>{selectedVisualNode && <RuntimeNodeInspectorCard node={selectedVisualNode} layers={inspectorLayers} onOpenNeoBlock={() => { if (selectedVisualNode.neoBlockId) setSelectedNodeId(`neoblock:${selectedVisualNode.neoBlockId}`); setViewMode('neoblock'); }} onSelect={selectVisualNode} />}<h3>Activity Stream</h3>{traceEvents.length ? <ol className="runtime-geometry-trace-list">{traceEvents.map((event, index) => <li className="runtime-geometry-trace-event" key={eventId(event, index)}><b>{event.eventType}</b><span>{event.label}</span><small>{eventTargetId(event) ?? 'missing target'}</small></li>)}</ol> : <small>No real Hermes trace yet.</small>}</>}</aside>
    </div>

    <section className={`runtime-bottom-drawer ${drawerOpen ? 'runtime-bottom-drawer--open' : ''}`} aria-label="Runtime bottom drawer">
      <div className="runtime-bottom-drawer-tabs"><button type="button" onClick={() => setDrawerOpen(!drawerOpen)}>{drawerOpen ? 'Collapse drawer' : 'Open drawer'}</button>{(['JSON', 'Trace', 'Manifest', 'Artifacts', 'Diagnostics', 'Hermes Terminal'] as const).map((tab) => <button key={tab} type="button" className={drawerTab === tab ? 'hot' : ''} onClick={() => { setDrawerTab(tab); setDrawerOpen(true); }}>{tab}</button>)}</div>
      {drawerOpen && <div className="runtime-bottom-drawer-body">{drawerTab === 'JSON' && <pre>{JSON.stringify(drawerPayload, null, 2)}</pre>}{drawerTab === 'Trace' && <ol>{(selectedTrace.length ? selectedTrace : traceEvents).map((event, index) => <li key={eventId(event, index)}><b>{event.eventType}</b><span>{event.label}</span></li>)}</ol>}{drawerTab === 'Manifest' && <pre>{JSON.stringify({ compileStatus, summary, manifest: compiledRuntimeManifest, resources: foundationItems.map((item) => item.label) }, null, 2).slice(0, 3000)}</pre>}{drawerTab === 'Artifacts' && <div>{selectedArtifacts.length ? selectedArtifacts.map((artifact) => <article key={artifact.id}><b>{artifact.label}</b><pre>{JSON.stringify(artifact, null, 2)}</pre></article>) : <small>No artifacts selected.</small>}</div>}{drawerTab === 'Diagnostics' && <pre>{JSON.stringify({ runtimeStatus, resources: foundationItems.map((item) => item.label), capabilities: model.capabilities.map((capability) => capability.label), unmappedEvents: model.unmappedEvents, noFakeActivation: true, sourceLibraryWrite: false }, null, 2)}</pre>}{drawerTab === 'Hermes Terminal' && renderHermesTerminalDrawer()}</div>}
    </section>
  </section>;
}

function RuntimeNodeInspectorCard({ node, layers, onOpenNeoBlock, onSelect }: { node: RuntimeVisualNode; layers: RuntimeVisualNode[]; onOpenNeoBlock: () => void; onSelect: (node: RuntimeVisualNode) => void }) {
  const parentStack = String(node.metadata?.parentNeoStackId ?? node.parentId?.replace(/^neostack:/, '') ?? 'n/a');
  const sourceBoundLayers = layers.filter((layer) => layer.sourceStatus === 'source-library-reused' || Boolean(layer.metadata?.matchedCandidateId));
  const rows: [string, string][] = node.kind === 'neoblock'
    ? [
      ['title', node.label],
      ['parent NeoStack', parentStack],
      ['MOLT child count', String(layers.length)],
      ['source-bound count', String(sourceBoundLayers.length)],
      ['top MOLT titles', layers.slice(0, 3).map((layer) => layer.label).join(' · ') || 'none']
    ]
    : node.kind === 'neostack'
      ? [
        ['title', node.label],
        ['NeoBlock count', String(node.metadata?.childCount ?? node.metadata?.blockCount ?? 0)],
        ['role/kind of work', String(node.metadata?.description ?? node.rawNode?.subtitle ?? 'NeoStack')],
        ['source-bound count', String(sourceBoundLayers.length)],
        ['status', node.status]
      ]
      : [
        ['title', node.label],
        ['node type', node.kind.replace('_', ' ')],
        ['status', node.status],
        ['parent', node.parentId ?? 'n/a']
      ];
  const compositionEvidence = isRecord(node.metadata?.compositionEvidence) ? node.metadata.compositionEvidence : undefined;
  const enrichmentEvidence = isRecord(node.metadata?.enrichmentEvidence) ? node.metadata.enrichmentEvidence : undefined;
  const evidence = compositionEvidence ?? enrichmentEvidence;
  const selectedEvidence = Array.isArray(evidence?.selectedMoltBlocks) ? evidence.selectedMoltBlocks.filter(isRecord).slice(0, 6) : [];
  const sourceSelected = Array.isArray(enrichmentEvidence?.selectedSourceLibraryMoltBlocks) ? enrichmentEvidence.selectedSourceLibraryMoltBlocks.filter(isRecord).slice(0, 6) : [];
  const workspaceSelected = Array.isArray(enrichmentEvidence?.selectedWorkspaceDraftMoltBlocks) ? enrichmentEvidence.selectedWorkspaceDraftMoltBlocks.filter(isRecord).slice(0, 6) : [];
  const suggestedDrafts = Array.isArray(enrichmentEvidence?.suggestedNewMoltBlocks) ? enrichmentEvidence.suggestedNewMoltBlocks.filter(isRecord).slice(0, 6) : [];
  const unusedCandidates = Array.isArray(enrichmentEvidence?.unusedRelevantCandidates)
    ? enrichmentEvidence.unusedRelevantCandidates.filter(isRecord).slice(0, 6)
    : Array.isArray(evidence?.rejectedCandidates)
      ? evidence.rejectedCandidates.filter(isRecord).slice(0, 6)
      : [];
  const missingRoles = Array.isArray(enrichmentEvidence?.missingRoles)
    ? enrichmentEvidence.missingRoles.map(String)
    : Array.isArray(evidence?.missingRoleWarnings)
      ? evidence.missingRoleWarnings.map(String)
      : [];
  const overlay = isRecord(node.metadata?.overlay) ? node.metadata.overlay : undefined;
  const overlayEvidence = Array.isArray(overlay?.evidence) ? overlay.evidence.map(String) : [];

  return <aside className="runtime-node-inspector-card" aria-label="Runtime node inspector card">
    <h3>{node.kind === 'neoblock' ? 'NeoBlock inspector' : node.kind === 'neostack' ? 'NeoStack inspector' : 'Selected node summary'}</h3>
    <b>{node.label}</b>
    <p>{String(node.metadata?.description ?? node.rawNode?.subtitle ?? 'Compressed runtime node')}</p>
    <div className="runtime-inspector-rows">{rows.map(([key, value]) => <span key={key}><b>{key}</b>{value}</span>)}{node.layout && <><span><b>layout dependency</b>{node.layout.evidence.dependency}</span><span><b>layout evidence</b>{node.layout.evidence.source}: {node.layout.evidence.reason}</span><span><b>semantic phase</b>{node.layout.phase}</span></>}</div>
    {overlay && <details className="runtime-inspector-molt-list" open>
      <summary>Overlay Lattice Evidence</summary>
      <div className="runtime-inspector-rows">
        <span><b>selected overlay</b>{String(overlay.overlayId ?? 'n/a')}</span>
        <span><b>row label</b>{String(overlay.rowLabel ?? 'n/a')}</span>
        <span><b>route role</b>{String(overlay.routeRole ?? 'n/a')}</span>
        <span><b>activation state</b>{String(overlay.activationState ?? 'n/a')}</span>
        <span><b>activation reason</b>{String(overlay.activationReason ?? 'n/a')}</span>
        <span><b>dependency type</b>{String(overlay.dependencyType ?? 'layout-only')}</span>
      </div>
      <small>{String(overlay.dependencyType ?? 'layout-only') === 'explicit' ? 'Explicit dependency appears only because metadata supplied explicitDependsOn.' : 'Layout-only/inferred placement does not create a hard graph dependency.'}</small>
      {overlayEvidence.length > 0 && <ol>{overlayEvidence.map((entry, index) => <li key={`${node.id}-overlay-evidence-${index}`}>{entry}</li>)}</ol>}
    </details>}
    {evidence && <details className="runtime-inspector-molt-list" open>
      <summary>{enrichmentEvidence ? 'UO Composition/Enrichment Evidence' : 'Composition Evidence'}</summary>
      <div className="runtime-inspector-rows">
        <span><b>source-bound count</b>{String(enrichmentEvidence?.sourceBoundCount ?? evidence.sourceBoundCount ?? 0)}</span>
        <span><b>workspace-draft count</b>{String(enrichmentEvidence?.workspaceBoundCount ?? evidence.workspaceDraftCount ?? 0)}</span>
        <span><b>package-only count</b>{String(enrichmentEvidence?.packageOnlyCount ?? evidence.importedPackageCount ?? 0)}</span>
        <span><b>unused candidate count</b>{String(evidence.unusedCandidateCount ?? unusedCandidates.length)}</span>
        <span><b>missing roles</b>{missingRoles.join(' · ') || 'none'}</span>
      </div>
      <div>
        {sourceSelected.map((entry) => <button key={`source-${String(entry.id)}`} type="button">{String(entry.title ?? entry.id)}<small>{String(entry.role ?? 'role?')} · source-library · {Array.isArray(entry.whySelected) ? entry.whySelected.map(String).slice(0, 3).join(' · ') : 'why-selected unavailable'}</small></button>)}
        {workspaceSelected.map((entry) => <button key={`workspace-${String(entry.id)}`} type="button">{String(entry.title ?? entry.id)}<small>{String(entry.role ?? 'role?')} · workspace-draft · {Array.isArray(entry.whySelected) ? entry.whySelected.map(String).slice(0, 3).join(' · ') : 'why-selected unavailable'}</small></button>)}
        {!sourceSelected.length && !workspaceSelected.length && selectedEvidence.map((entry) => <button key={String(entry.id)} type="button">{String(entry.title ?? entry.id)}<small>{String(entry.role ?? 'role?')} · {String(entry.sourceKind ?? 'source?')} · {Array.isArray(entry.whySelected) ? entry.whySelected.map(String).slice(0, 3).join(' · ') : 'why-selected unavailable'}</small></button>)}
      </div>
      {suggestedDrafts.length > 0 && <details open><summary>Suggested workspace-draft MOLT Blocks</summary><div>{suggestedDrafts.map((entry) => <button key={`draft-${String(entry.id)}`} type="button">{String(entry.title ?? entry.id)}<small>{String(entry.role ?? 'role?')} · review required · {String(entry.reason ?? 'missing role suggestion')}</small></button>)}</div></details>}
      {unusedCandidates.length > 0 && <details><summary>Unused relevant candidates</summary><div>{unusedCandidates.map((entry) => <button key={`unused-${String(entry.id)}`} type="button">{String(entry.title ?? entry.id)}<small>{String(entry.role ?? 'role?')} · {String(entry.sourceKind ?? 'source?')} · {String(entry.reason ?? 'not selected')}</small></button>)}</div></details>}
    </details>}
    {node.kind !== 'neoblock' && node.neoBlockId && <button type="button" onClick={onOpenNeoBlock}>Open parent NeoBlock Map</button>}
    {node.kind === 'neoblock' && <button type="button" onClick={onOpenNeoBlock}>Open NeoBlock Map</button>}
    <details className="runtime-inspector-molt-list"><summary>{node.kind === 'neoblock' ? 'View all MOLT' : 'Related MOLT'} ({layers.length})</summary><div>{layers.slice(0, 3).map((layer) => <button key={layer.id} type="button" onClick={() => onSelect(layer)}>{layer.label}<small>{String(layer.metadata?.matchedCandidateId ?? 'not linked')} · {String(layer.metadata?.sourcePath ?? 'not linked')}</small></button>)}{layers.length > 3 && <small>+ {layers.length - 3} more MOLT children</small>}</div></details>
  </aside>;
}
