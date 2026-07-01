import type { CompileCandidate, SleeveAssemblyPlan } from './blockMatchingTypes';
import { getRuntimeTargetId, getVisualStateForId } from './cognitiveRuntimeState';
import type { UMGCompiledRuntimeManifest, UMGTraceEvent, UMGRuntimeState, UMGRuntimeVisualState } from './cognitiveRuntimeTypes';
import { validateNeoBlockComposition } from './neoBlockCompositionValidator';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve } from './templateSleeveStructures';
import type {
  GateGeometryNode,
  GeometryLayoutHint,
  MoltGeometryBindingNode,
  NeoBlockGeometryNode,
  NeoStackGeometryNode,
  RuntimeConnection,
  RuntimeGeometryNode,
  RuntimeGeometryState,
  RuntimeGeometryViewMode,
  SleeveGeometryNode,
  ToolEndpointNode,
  UMGGeometryManifest
} from './runtimeGeometryTypes';

export type BuildRuntimeGeometryManifestArgs = {
  templateSleeve?: NormalizedTemplateSleeve;
  assemblyPlan?: SleeveAssemblyPlan;
  compileCandidate?: CompileCandidate;
  compiledRuntimeManifest?: UMGCompiledRuntimeManifest;
  viewMode?: RuntimeGeometryViewMode;
  runtimeVisualState?: UMGRuntimeVisualState;
  runtimeTraceEvents?: UMGTraceEvent[];
  generatedAt?: string;
};

export type GeometryManifestSummary = {
  totalSleeves: number;
  totalNeoStacks: number;
  totalNeoBlocks: number;
  totalMoltBindings: number;
  totalGates: number;
  totalConnections: number;
  totalToolEndpoints: number;
  unmappedRuntimeTargets: number;
};

type GeometrySource = {
  sleeve: NormalizedTemplateSleeve;
  assemblyPlan?: SleeveAssemblyPlan;
  compileCandidate?: CompileCandidate;
  compiledRuntimeManifest?: UMGCompiledRuntimeManifest;
};

const RUNTIME_STATE_PRIORITY: RuntimeGeometryState[] = [
  'error',
  'blocked',
  'tool_calling',
  'waiting_approval',
  'active',
  'processing',
  'attention',
  'queued',
  'complete',
  'idle'
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function hasNormalizedSleeveShape(value: unknown): value is NormalizedTemplateSleeve {
  if (!isRecord(value)) return false;
  return Array.isArray(value.neoStacks) && Array.isArray(value.neoBlocks) && Array.isArray(value.moltBlocks) && Array.isArray(value.gates);
}

function sourceFromArgs(args: BuildRuntimeGeometryManifestArgs): GeometrySource {
  if (args.templateSleeve) {
    return { sleeve: args.templateSleeve, assemblyPlan: args.assemblyPlan, compileCandidate: args.compileCandidate, compiledRuntimeManifest: args.compiledRuntimeManifest };
  }
  if (hasNormalizedSleeveShape(args.compileCandidate?.normalizedStructure)) {
    return { sleeve: args.compileCandidate.normalizedStructure, assemblyPlan: args.assemblyPlan, compileCandidate: args.compileCandidate, compiledRuntimeManifest: args.compiledRuntimeManifest };
  }
  if (hasNormalizedSleeveShape(args.compiledRuntimeManifest?.compiledStructure)) {
    return { sleeve: args.compiledRuntimeManifest.compiledStructure, assemblyPlan: args.assemblyPlan, compileCandidate: args.compileCandidate, compiledRuntimeManifest: args.compiledRuntimeManifest };
  }
  throw new Error('buildRuntimeGeometryManifest requires a NormalizedTemplateSleeve or a compile/manifest structure with normalized Sleeve arrays.');
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function connectionId(type: string, sourceId: string, targetId: string) {
  return `${type}:${sourceId}->${targetId}`;
}

function createAliases(values: Array<string | undefined>, metadata?: Record<string, unknown>) {
  return unique([
    ...values,
    asString(metadata?.id),
    asString(metadata?.sourceId),
    asString(metadata?.sourceID),
    asString(metadata?.sourcePath),
    asString(metadata?.originalId),
    asString(metadata?.parentSourceId)
  ]);
}

function stackLayoutHint(stack: NormalizedTemplateNeoStack): GeometryLayoutHint {
  const tagText = stack.tags.join(' ').toLowerCase();
  let semanticGroup: GeometryLayoutHint['semanticGroup'] = 'execution';
  if (stack.stackOrder <= 1 || tagText.includes('assessment') || tagText.includes('discovery')) semanticGroup = 'foundation';
  else if (tagText.includes('architecture') || tagText.includes('integrations') || tagText.includes('financial') || tagText.includes('scheduling')) semanticGroup = 'dependency_data';
  else if (tagText.includes('monitor') || tagText.includes('optimization')) semanticGroup = 'feedback_optimization';
  else if (tagText.includes('implementation') || tagText.includes('strategy')) semanticGroup = 'synthesis_strategy';
  return { arrangement: 'skyline', semanticGroup, orderIndex: stack.stackOrder, tier: stack.stackOrder <= 2 ? 0 : stack.stackOrder >= 8 ? 2 : 1, column: stack.stackOrder };
}

function blockLayoutHint(block: NormalizedTemplateNeoBlock): GeometryLayoutHint {
  let semanticGroup: GeometryLayoutHint['semanticGroup'] = 'execution';
  if (block.blockOrder === 1) semanticGroup = 'foundation';
  else if (block.blockOrder === 2) semanticGroup = 'dependency_data';
  else if (block.blockOrder >= 5) semanticGroup = 'feedback_optimization';
  else if (block.tags.some((tag) => ['strategy', 'architecture', 'planning'].includes(tag))) semanticGroup = 'synthesis_strategy';
  return { arrangement: 'pyramid', semanticGroup, orderIndex: block.blockOrder, tier: block.blockOrder <= 2 ? 0 : block.blockOrder <= 4 ? 1 : 2, column: block.blockOrder };
}

function toSourceBlocks(sleeve: NormalizedTemplateSleeve) {
  return [
    { id: sleeve.id, title: sleeve.title, scopeKind: 'sleeve' as const, metadata: { source: sleeve.source, templateKind: sleeve.templateKind } },
    ...sleeve.neoStacks.map((stack) => ({ id: stack.id, title: stack.title, scopeKind: 'neostack' as const, metadata: { stackOrder: stack.stackOrder } })),
    ...sleeve.neoBlocks.map((block) => ({ id: block.id, title: block.title, scopeKind: 'neoblock' as const, metadata: { neoStackId: block.neoStackId, blockOrder: block.blockOrder } })),
    ...sleeve.moltBlocks.map((block) => ({ id: block.id, title: block.title, sourceId: block.sourceId, scopeKind: 'molt' as const, role: block.role, metadata: { parentNeoBlockId: block.parentNeoBlockId, parentNeoStackId: block.parentNeoStackId } })),
    ...sleeve.gates.map((gate) => ({ id: gate.id, title: gate.title, sourceId: gate.sourceId, scopeKind: 'gate' as const, metadata: { attachesTo: gate.attachesTo, targetIds: gate.targetIds, promptContent: false } }))
  ];
}

function stateFromRuntimeState(state: UMGRuntimeState): RuntimeGeometryState {
  if (state === 'skipped') return 'complete';
  return state;
}

function stateFromEvent(event: UMGTraceEvent): RuntimeGeometryState {
  if (event.eventType === 'tool_call_prepared' || event.eventType === 'tool_call_executed' || event.eventType === 'tool_result_received' || event.eventType === 'tool_requested' || event.eventType === 'tool_executed') return 'tool_calling';
  if (event.eventType === 'tool_call_requires_approval' || event.eventType === 'approval_required') return 'waiting_approval';
  return stateFromRuntimeState(event.eventType === 'error' ? 'error' : event.state);
}

function roleFromMolt(block: NormalizedTemplateMoltBlock): MoltGeometryBindingNode['localSlotRole'] {
  if (['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint', 'meta'].includes(block.role)) {
    return block.role as MoltGeometryBindingNode['localSlotRole'];
  }
  return 'other';
}

function bindingNodeId(parentNeoBlockId: string, moltBlockId: string, index: number) {
  return `molt_binding:${parentNeoBlockId}:${moltBlockId}:${index}`;
}

export function buildSleeveGeometryNode(sleeve: NormalizedTemplateSleeve): SleeveGeometryNode {
  return {
    id: `sleeve:${sleeve.id}`,
    kind: 'sleeve',
    sleeveId: sleeve.id,
    label: sleeve.title,
    description: sleeve.description,
    state: 'idle',
    neoStackIds: sleeve.neoStacks.map((stack) => stack.id),
    foundationIds: sleeve.governanceBlockIds,
    aliases: createAliases([sleeve.id], sleeve.metadata),
    layoutHint: { arrangement: 'skyline', semanticGroup: 'foundation', tier: 0, expandedByDefault: true },
    templateSleeve: { id: sleeve.id, title: sleeve.title, version: sleeve.version, templateKind: sleeve.templateKind },
    metadata: { source: sleeve.source, tags: sleeve.tags, defaultExecutionMode: sleeve.defaultExecutionMode }
  };
}

export function buildNeoStackGeometryNodes(sleeve: NormalizedTemplateSleeve): NeoStackGeometryNode[] {
  return sleeve.neoStacks.map((stack) => ({
    id: `neostack:${stack.id}`,
    kind: 'neostack',
    sleeveId: sleeve.id,
    neoStackId: stack.id,
    label: stack.title,
    description: stack.description,
    state: 'idle',
    neoBlockIds: stack.neoBlockIds,
    domainPurpose: stack.description,
    aliases: createAliases([stack.id]),
    layoutHint: stackLayoutHint(stack),
    metadata: { stackOrder: stack.stackOrder, tags: stack.tags }
  }));
}

export function buildNeoBlockGeometryNodes(sleeve: NormalizedTemplateSleeve): NeoBlockGeometryNode[] {
  const composition = validateNeoBlockComposition(sleeve);
  const rows = new Map(composition.rows.map((row) => [row.neoBlockId, row]));
  return sleeve.neoBlocks.map((block) => {
    const row = rows.get(block.id);
    const warningCodes = composition.warnings.filter((warning) => warning.neoBlockId === block.id).map((warning) => warning.code);
    return {
      id: `neoblock:${block.id}`,
      kind: 'neoblock',
      sleeveId: sleeve.id,
      neoStackId: block.neoStackId,
      neoBlockId: block.id,
      label: block.title,
      description: block.description,
      state: 'idle',
      moltBindingIds: [],
      gateIds: block.gateIds,
      toolEndpointIds: [],
      aliases: createAliases([block.id]),
      layoutHint: blockLayoutHint(block),
      roleHealth: {
        hasDirective: Boolean(row && row.roleCounts.directive > 0),
        hasInstruction: Boolean(row && row.roleCounts.instruction > 0),
        hasSubject: Boolean(row && row.roleCounts.subject > 0),
        hasPrimary: Boolean(row && row.inheritedPrimaryBlockIds.length > 0 || row && row.roleCounts.primary > 0),
        hasBlueprint: Boolean(row && row.roleCounts.blueprint > 0),
        warnings: warningCodes
      },
      metadata: { neoStackId: block.neoStackId, blockOrder: block.blockOrder, tags: block.tags, defaultState: block.defaultState, sourceKind: block.sourceKind, generationReason: block.generationReason, compositionEvidence: isRecord(block.nlCard) ? block.nlCard.evidence : undefined }
    };
  });
}

export function buildMoltGeometryBindingNodes(sleeve: NormalizedTemplateSleeve): MoltGeometryBindingNode[] {
  const moltById = new Map(sleeve.moltBlocks.map((block) => [block.id, block]));
  const usageCounts = new Map<string, number>();
  sleeve.neoBlocks.forEach((block) => block.moltBlockIds.forEach((moltId) => usageCounts.set(moltId, (usageCounts.get(moltId) ?? 0) + 1)));

  const nodes: MoltGeometryBindingNode[] = [];
  sleeve.neoBlocks.forEach((neoBlock) => {
    neoBlock.moltBlockIds.forEach((moltId, index) => {
      const block = moltById.get(moltId);
      if (!block) return;
      const reused = (usageCounts.get(moltId) ?? 0) > 1;
      nodes.push({
        id: bindingNodeId(neoBlock.id, block.id, index),
        kind: 'molt_binding',
        moltBlockId: block.id,
        sourceId: block.sourceId,
        reusedBlockId: reused ? block.id : undefined,
        localSlotRole: roleFromMolt(block),
        parentNeoBlockId: neoBlock.id,
        parentNeoStackId: neoBlock.neoStackId,
        bindingReason: block.parentNeoBlockId === neoBlock.id ? 'local NeoBlock role block' : reused ? 'reused context block bound into this NeoBlock slot' : 'inherited or stack-level context block',
        inheritedFrom: block.parentNeoBlockId ? undefined : block.parentNeoStackId ?? (block.role === 'primary' ? sleeve.id : undefined),
        localOverride: block.parentNeoBlockId === neoBlock.id,
        label: block.title,
        description: block.content,
        state: 'idle',
        aliases: createAliases([block.id, block.sourceId]),
        layoutHint: { arrangement: 'cluster', semanticGroup: block.role === 'blueprint' ? 'synthesis_strategy' : block.role === 'subject' ? 'dependency_data' : 'execution', orderIndex: index },
        metadata: { role: block.role, tags: block.tags, parentNeoBlockId: neoBlock.id, sourceParentNeoBlockId: block.parentNeoBlockId, sourceParentNeoStackId: block.parentNeoStackId, defaultState: block.defaultState }
      });
    });
  });
  return nodes;
}

export function buildGateGeometryNodes(sleeve: NormalizedTemplateSleeve): GateGeometryNode[] {
  return sleeve.gates.map((gate) => ({
    id: `gate:${gate.id}`,
    kind: 'gate',
    gateId: gate.id,
    sourceId: gate.sourceId,
    gate: {
      id: gate.id,
      title: gate.title,
      attachesTo: gate.attachesTo,
      triggerType: gate.triggerType,
      action: gate.action,
      targetIds: gate.targetIds,
      defaultState: gate.defaultState
    },
    controlsConnectionIds: [],
    controlsNodeIds: gate.targetIds,
    label: gate.title,
    description: gate.conditionText,
    state: 'idle',
    aliases: createAliases([gate.id, gate.sourceId], gate.metadata),
    layoutHint: { arrangement: 'cluster', semanticGroup: 'dependency_data' },
    metadata: { triggerType: gate.triggerType, action: gate.action, defaultState: gate.defaultState, runtimeState: gate.runtimeState, promptContent: false }
  }));
}

function buildToolEndpointNodes(source: GeometrySource): ToolEndpointNode[] {
  const requiredTools = unique([...(source.assemblyPlan?.requiredTools ?? []), ...(source.compiledRuntimeManifest?.toolPolicy.allowedTools ?? [])]);
  const owningBlockByToolId = new Map<string, NormalizedTemplateNeoBlock>();
  const owningMoltByToolId = new Map<string, NormalizedTemplateMoltBlock>();
  const moltById = new Map(source.sleeve.moltBlocks.map((molt) => [molt.id, molt]));
  source.sleeve.neoBlocks.forEach((block) => {
    block.moltBlockIds.forEach((moltId) => {
      const molt = moltById.get(moltId);
      const moltMetadata = isRecord(molt) && isRecord((molt as unknown as Record<string, unknown>).metadata) ? (molt as unknown as { metadata: Record<string, unknown> }).metadata : undefined;
      const capabilityIds = unique([
        moltId,
        molt?.sourceId,
        typeof moltMetadata?.capabilityId === 'string' ? moltMetadata.capabilityId : undefined,
        typeof moltMetadata?.toolId === 'string' ? moltMetadata.toolId : undefined
      ]);
      capabilityIds.forEach((capabilityId) => {
        owningBlockByToolId.set(capabilityId, block);
        if (molt) owningMoltByToolId.set(capabilityId, molt);
      });
    });
  });
  const metadataCapabilities = Array.isArray(source.sleeve.metadata?.capabilities) ? source.sleeve.metadata.capabilities : [];
  metadataCapabilities.forEach((capability) => {
    if (!isRecord(capability) || typeof capability.capabilityId !== 'string') return;
    const parentId = typeof capability.sourceNeoBlock === 'string'
      ? capability.sourceNeoBlock
      : typeof capability.parentNeoBlockId === 'string'
        ? capability.parentNeoBlockId
        : undefined;
    const parent = parentId ? source.sleeve.neoBlocks.find((block) => block.id === parentId) : undefined;
    if (parent) owningBlockByToolId.set(capability.capabilityId, parent);
  });
  return requiredTools.map((toolId) => ({
    id: `tool:${toolId}`,
    kind: 'tool_endpoint',
    toolId,
    label: toolId,
    state: 'idle',
    aliases: unique([toolId, owningMoltByToolId.get(toolId)?.id, owningMoltByToolId.get(toolId)?.sourceId]),
    requiredByNodeIds: owningBlockByToolId.get(toolId) ? [`neoblock:${owningBlockByToolId.get(toolId)!.id}`] : [],
    parentNeoBlockId: owningBlockByToolId.get(toolId)?.id,
    parentNeoStackId: owningBlockByToolId.get(toolId)?.neoStackId,
    layoutHint: { arrangement: 'cluster', semanticGroup: 'dependency_data' },
    metadata: { parentNeoBlockId: owningBlockByToolId.get(toolId)?.id, parentNeoStackId: owningBlockByToolId.get(toolId)?.neoStackId, sourceToolBlockId: owningMoltByToolId.get(toolId)?.id, capabilityId: toolId }
  }));
}

export function buildRuntimeConnections(args: { sleeve: NormalizedTemplateSleeve; nodes: RuntimeGeometryNode[]; assemblyPlan?: SleeveAssemblyPlan }): RuntimeConnection[] {
  const { sleeve, assemblyPlan } = args;
  const connections: RuntimeConnection[] = [];
  const bindingNodes = args.nodes.filter((node): node is MoltGeometryBindingNode => node.kind === 'molt_binding');
  const firstBindingByMoltId = new Map<string, string>();

  sleeve.neoStacks.forEach((stack) => {
    connections.push({ id: connectionId('hierarchy', `sleeve:${sleeve.id}`, `neostack:${stack.id}`), type: 'hierarchy', sourceNodeId: `sleeve:${sleeve.id}`, targetNodeId: `neostack:${stack.id}`, state: 'idle', label: 'contains', layoutHint: stackLayoutHint(stack) });
  });

  sleeve.neoBlocks.forEach((block) => {
    connections.push({ id: connectionId('hierarchy', `neostack:${block.neoStackId}`, `neoblock:${block.id}`), type: 'hierarchy', sourceNodeId: `neostack:${block.neoStackId}`, targetNodeId: `neoblock:${block.id}`, state: 'idle', label: 'contains', layoutHint: blockLayoutHint(block) });
  });

  bindingNodes.forEach((node) => {
    connections.push({ id: connectionId('hierarchy', `neoblock:${node.parentNeoBlockId}`, node.id), type: 'hierarchy', sourceNodeId: `neoblock:${node.parentNeoBlockId}`, targetNodeId: node.id, state: 'idle', label: node.localSlotRole });
    const previous = firstBindingByMoltId.get(node.moltBlockId);
    if (previous && previous !== node.id) {
      connections.push({ id: connectionId('reuse_binding', previous, node.id), type: 'reuse_binding', sourceNodeId: previous, targetNodeId: node.id, state: 'idle', label: 'reused MOLT binding', metadata: { reusedBlockId: node.moltBlockId } });
    } else {
      firstBindingByMoltId.set(node.moltBlockId, node.id);
    }
  });

  sleeve.gates.forEach((gate) => {
    const targets = gate.targetIds.length ? gate.targetIds : gate.attachesTo.kind === 'neoblock' ? [gate.attachesTo.id] : [];
    targets.forEach((targetId) => {
      connections.push({ id: connectionId('gate_control', `gate:${gate.id}`, `neoblock:${targetId}`), type: 'gate_control', sourceNodeId: `gate:${gate.id}`, targetNodeId: `neoblock:${targetId}`, state: 'idle', gateId: gate.id, label: gate.action, metadata: { triggerType: gate.triggerType, promptContent: false } });
    });
  });

  const orderByStack = new Map<string, NormalizedTemplateNeoBlock[]>();
  sleeve.neoBlocks.forEach((block) => orderByStack.set(block.neoStackId, [...(orderByStack.get(block.neoStackId) ?? []), block]));
  orderByStack.forEach((blocks) => {
    blocks.sort((a, b) => a.blockOrder - b.blockOrder);
    for (let index = 0; index < blocks.length - 1; index += 1) {
      connections.push({ id: connectionId('execution_next', `neoblock:${blocks[index].id}`, `neoblock:${blocks[index + 1].id}`), type: 'execution_next', sourceNodeId: `neoblock:${blocks[index].id}`, targetNodeId: `neoblock:${blocks[index + 1].id}`, state: 'idle', label: 'next block' });
    }
  });

  sleeve.neoBlocks.forEach((block) => {
    if (sleeve.governanceBlockIds.length) {
      connections.push({ id: connectionId('inheritance', `sleeve:${sleeve.id}`, `neoblock:${block.id}`), type: 'inheritance', sourceNodeId: `sleeve:${sleeve.id}`, targetNodeId: `neoblock:${block.id}`, state: 'idle', label: 'inherited governance primary', metadata: { inheritedMoltBlockIds: sleeve.governanceBlockIds } });
    }
  });

  if (assemblyPlan?.executionOrder.length) {
    assemblyPlan.executionOrder.forEach((targetId, index) => {
      const nextTargetId = assemblyPlan.executionOrder[index + 1];
      if (nextTargetId) {
        connections.push({ id: connectionId('execution_next', `neoblock:${targetId}`, `neoblock:${nextTargetId}`), type: 'execution_next', sourceNodeId: `neoblock:${targetId}`, targetNodeId: `neoblock:${nextTargetId}`, state: 'idle', label: 'assembly execution order', metadata: { assemblyPlanId: assemblyPlan.id } });
      }
    });
  }

  return Array.from(new Map(connections.map((connection) => [connection.id, connection])).values());
}

function attachDerivedIds(nodes: RuntimeGeometryNode[], connections: RuntimeConnection[]): RuntimeGeometryNode[] {
  const moltBindingIdsByBlock = new Map<string, string[]>();
  const controlsByGate = new Map<string, string[]>();
  const connectionIdsByGate = new Map<string, string[]>();
  nodes.forEach((node) => {
    if (node.kind === 'molt_binding') {
      moltBindingIdsByBlock.set(node.parentNeoBlockId, [...(moltBindingIdsByBlock.get(node.parentNeoBlockId) ?? []), node.id]);
    }
  });
  connections.forEach((connection) => {
    if (connection.type === 'gate_control' && connection.gateId) {
      controlsByGate.set(connection.gateId, [...(controlsByGate.get(connection.gateId) ?? []), connection.targetNodeId]);
      connectionIdsByGate.set(connection.gateId, [...(connectionIdsByGate.get(connection.gateId) ?? []), connection.id]);
    }
  });
  return nodes.map((node) => {
    if (node.kind === 'neoblock') {
      return { ...node, moltBindingIds: moltBindingIdsByBlock.get(node.neoBlockId) ?? [] };
    }
    if (node.kind === 'gate') {
      return { ...node, controlsNodeIds: controlsByGate.get(node.gateId) ?? node.controlsNodeIds, controlsConnectionIds: connectionIdsByGate.get(node.gateId) ?? [] };
    }
    return node;
  });
}

export function buildRuntimeGeometryManifest(args: BuildRuntimeGeometryManifestArgs): UMGGeometryManifest {
  const source = sourceFromArgs(args);
  const sleeveNode = buildSleeveGeometryNode(source.sleeve);
  const stackNodes = buildNeoStackGeometryNodes(source.sleeve);
  const blockNodes = buildNeoBlockGeometryNodes(source.sleeve);
  const moltNodes = buildMoltGeometryBindingNodes(source.sleeve);
  const gateNodes = buildGateGeometryNodes(source.sleeve);
  const toolNodes = buildToolEndpointNodes(source);
  const initialNodes: RuntimeGeometryNode[] = [sleeveNode, ...stackNodes, ...blockNodes, ...moltNodes, ...gateNodes, ...toolNodes];
  const connections = buildRuntimeConnections({ sleeve: source.sleeve, nodes: initialNodes, assemblyPlan: source.assemblyPlan });
  const manifest: UMGGeometryManifest = {
    id: `geometry:${source.sleeve.id}:${args.viewMode ?? 'structure'}`,
    sleeveId: source.sleeve.id,
    viewMode: args.viewMode ?? 'structure',
    generatedAt: args.generatedAt,
    nodes: attachDerivedIds(initialNodes, connections),
    connections,
    sourceBlocks: toSourceBlocks(source.sleeve),
    layoutHint: { arrangement: 'skyline', semanticGroup: 'foundation', expandedByDefault: true },
    metadata: {
      templateKind: source.sleeve.templateKind,
      source: source.sleeve.source,
      compileCandidateId: source.compileCandidate?.id,
      compiledRuntimeManifest: Boolean(source.compiledRuntimeManifest)
    }
  };

  if (args.runtimeVisualState) return applyRuntimeStateToGeometryManifest(manifest, args.runtimeVisualState);
  if (args.runtimeTraceEvents) return applyRuntimeStateToGeometryManifest(manifest, args.runtimeTraceEvents);
  return manifest;
}

function mergeState(current: RuntimeGeometryState, incoming: RuntimeGeometryState): RuntimeGeometryState {
  return RUNTIME_STATE_PRIORITY.indexOf(incoming) < RUNTIME_STATE_PRIORITY.indexOf(current) ? incoming : current;
}

function eventAliases(event: UMGTraceEvent) {
  return unique([
    getRuntimeTargetId(event),
    event.sleeveId,
    event.neoStackId,
    event.neoBlockId,
    event.moltBlockId,
    event.gateId,
    event.sourceId,
    event.toolId,
    event.approvalId,
    ...(event.metadataAliases ?? [])
  ]);
}

function applyEvents(manifest: UMGGeometryManifest, events: UMGTraceEvent[]): UMGGeometryManifest {
  const nodeByAlias = new Map<string, RuntimeGeometryNode[]>();
  manifest.nodes.forEach((node) => {
    createAliases([node.id, node.sourceId, ...(node.aliases ?? [])], node.metadata).forEach((alias) => {
      nodeByAlias.set(alias, [...(nodeByAlias.get(alias) ?? []), node]);
    });
  });

  const nodeState = new Map<string, { state: RuntimeGeometryState; eventIds: string[] }>();
  const unmappedEvents: UMGTraceEvent[] = [];
  events.forEach((event, eventIndex) => {
    const matches = unique(eventAliases(event).flatMap((alias) => nodeByAlias.get(alias)?.map((node) => node.id) ?? []));
    if (!matches.length) {
      unmappedEvents.push(event);
      return;
    }
    const state = stateFromEvent(event);
    const eventId = `${event.traceId}:${event.timestamp}:${event.eventType}:${eventIndex}`;
    matches.forEach((nodeId) => {
      const current = nodeState.get(nodeId) ?? { state: 'idle' as RuntimeGeometryState, eventIds: [] };
      nodeState.set(nodeId, { state: mergeState(current.state, state), eventIds: [...current.eventIds, eventId] });
    });
  });

  return {
    ...manifest,
    viewMode: manifest.viewMode === 'builder' ? 'builder' : 'runtime',
    runtimeTraceEvents: events,
    unmappedEvents,
    nodes: manifest.nodes.map((node) => {
      const applied = nodeState.get(node.id);
      return applied ? { ...node, state: applied.state, mappedTraceEventIds: unique([...(node.mappedTraceEventIds ?? []), ...applied.eventIds]) } : node;
    })
  };
}

export function applyRuntimeStateToGeometryManifest(manifest: UMGGeometryManifest, runtime: UMGRuntimeVisualState | UMGTraceEvent[]): UMGGeometryManifest {
  if (Array.isArray(runtime)) return applyEvents(manifest, runtime);
  const visualEvents = runtime.timeline ?? [];
  const eventApplied = applyEvents(manifest, visualEvents);
  return {
    ...eventApplied,
    nodes: eventApplied.nodes.map((node) => {
      const visualState = getVisualStateForId(runtime, node.aliases?.[0] ?? node.id);
      if (visualState === 'idle') return node;
      return { ...node, state: mergeState(node.state, stateFromRuntimeState(visualState)) };
    })
  };
}

export function summarizeGeometryManifest(manifest: UMGGeometryManifest): GeometryManifestSummary {
  return {
    totalSleeves: manifest.nodes.filter((node) => node.kind === 'sleeve').length,
    totalNeoStacks: manifest.nodes.filter((node) => node.kind === 'neostack').length,
    totalNeoBlocks: manifest.nodes.filter((node) => node.kind === 'neoblock').length,
    totalMoltBindings: manifest.nodes.filter((node) => node.kind === 'molt_binding').length,
    totalGates: manifest.nodes.filter((node) => node.kind === 'gate').length,
    totalConnections: manifest.connections.length,
    totalToolEndpoints: manifest.nodes.filter((node) => node.kind === 'tool_endpoint').length,
    unmappedRuntimeTargets: manifest.unmappedEvents?.length ?? 0
  };
}
