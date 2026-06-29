import type { SleeveAssemblyPlan } from './blockMatchingTypes';
import type { UMGCompiledRuntimeManifest, UMGGateRecord, UMGRuntimeState, UMGRuntimeVisualState } from './cognitiveRuntimeTypes';
import { getRuntimeClassForId, getVisualStateForId } from './cognitiveRuntimeState';
import type { InstantiatedTemplateSleeve, NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve } from './templateSleeveStructures';

export type RuntimeHierarchyLevel = 'sleeve' | 'neostack' | 'neoblock';
export type RuntimeHierarchyNodeKind = 'sleeve' | 'neostack' | 'neoblock' | 'molt' | 'gate';

export type RuntimeHierarchyNode = {
  id: string;
  sourceId?: string;
  kind: RuntimeHierarchyNodeKind;
  title: string;
  subtitle?: string;
  description?: string;
  role?: string;
  parentId?: string;
  childIds: string[];
  gateIds: string[];
  tags: string[];
  runtimeState: UMGRuntimeState;
  runtimeClass: string;
  matchedRuntimeIds: string[];
  metadata?: Record<string, unknown>;
};

export type RuntimeHierarchyViewModel = {
  sleeveNode?: RuntimeHierarchyNode;
  neoStackNodes: RuntimeHierarchyNode[];
  neoBlockNodes: RuntimeHierarchyNode[];
  moltNodes: RuntimeHierarchyNode[];
  gateNodes: RuntimeHierarchyNode[];
  selectedLevel: RuntimeHierarchyLevel;
  selectedNeoStackId?: string;
  selectedNeoBlockId?: string;
  visibleNodes: RuntimeHierarchyNode[];
  breadcrumb: RuntimeHierarchyNode[];
  counts: {
    neoStacks: number;
    neoBlocks: number;
    moltBlocks: number;
    gates: number;
    active: number;
    processing: number;
    complete: number;
    blocked: number;
    error: number;
  };
  warnings: string[];
};

type BuildRuntimeHierarchyArgs = {
  templateSleeve?: NormalizedTemplateSleeve;
  instantiatedSleeve?: InstantiatedTemplateSleeve;
  assemblyPlan?: SleeveAssemblyPlan;
  compiledRuntimeManifest?: UMGCompiledRuntimeManifest;
  runtimeVisualState?: UMGRuntimeVisualState;
  selectedNeoStackId?: string;
  selectedNeoBlockId?: string;
};

const runtimePriority: UMGRuntimeState[] = ['error', 'blocked', 'active', 'processing', 'attention', 'queued', 'complete', 'skipped', 'idle'];

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function readMetadataIds(metadata?: Record<string, unknown>) {
  if (!metadata) return [] as string[];
  return unique([
    typeof metadata.id === 'string' ? metadata.id : undefined,
    typeof metadata.sourceId === 'string' ? metadata.sourceId : undefined,
    typeof metadata.sourceID === 'string' ? metadata.sourceID : undefined,
    typeof metadata.sourcePath === 'string' ? metadata.sourcePath : undefined,
    typeof metadata.originalId === 'string' ? metadata.originalId : undefined,
    typeof metadata.parentSourceId === 'string' ? metadata.parentSourceId : undefined
  ]);
}

export function createRuntimeIdAliases(entity: {
  id?: string;
  sourceId?: string;
  parentId?: string;
  parentSourceId?: string;
  metadata?: Record<string, unknown>;
  aliases?: string[];
}) {
  return unique([
    entity.id,
    entity.sourceId,
    entity.parentId,
    entity.parentSourceId,
    ...(entity.aliases ?? []),
    ...readMetadataIds(entity.metadata)
  ]);
}

export function getRuntimeStateForEntity(args: {
  runtimeVisualState?: UMGRuntimeVisualState;
  id: string;
  sourceId?: string;
  aliases?: string[];
}): { state: UMGRuntimeState; matchedRuntimeIds: string[] } {
  const ids = unique([args.id, args.sourceId, ...(args.aliases ?? [])]);
  if (!args.runtimeVisualState || !args.runtimeVisualState.timeline.length) {
    return { state: 'idle', matchedRuntimeIds: [] };
  }
  const states = ids.map((id) => ({ id, state: getVisualStateForId(args.runtimeVisualState!, id) }));
  const state = runtimePriority.find((candidate) => states.some((entry) => entry.state === candidate)) ?? 'idle';
  const matchedRuntimeIds = state === 'idle' ? [] : states.filter((entry) => entry.state === state).map((entry) => entry.id);
  return { state, matchedRuntimeIds };
}

function runtimeFields(args: { runtimeVisualState?: UMGRuntimeVisualState; id: string; sourceId?: string; aliases?: string[] }) {
  const { state, matchedRuntimeIds } = getRuntimeStateForEntity(args);
  const classId = matchedRuntimeIds[0] ?? args.id;
  return {
    runtimeState: state,
    runtimeClass: args.runtimeVisualState && matchedRuntimeIds.length ? getRuntimeClassForId(args.runtimeVisualState, classId) : `runtime-${state}`,
    matchedRuntimeIds
  };
}

function selectedTag(selected: boolean) {
  return selected ? 'selected-by-assembly' : 'available-structure';
}

function makeSleeveNode(sleeve: NormalizedTemplateSleeve, args: BuildRuntimeHierarchyArgs): RuntimeHierarchyNode {
  const aliases = createRuntimeIdAliases({ id: sleeve.id, metadata: sleeve.metadata });
  return {
    id: sleeve.id,
    kind: 'sleeve',
    title: sleeve.title,
    subtitle: `${sleeve.neoStacks.length} NeoStacks · ${sleeve.neoBlocks.length} NeoBlocks`,
    description: sleeve.description,
    childIds: sleeve.neoStacks.map((stack) => stack.id),
    gateIds: sleeve.gates.map((gate) => gate.id),
    tags: sleeve.tags,
    ...runtimeFields({ runtimeVisualState: args.runtimeVisualState, id: sleeve.id, aliases }),
    metadata: { version: sleeve.version, compiled: Boolean(args.compiledRuntimeManifest), source: sleeve.source }
  };
}

function makeNeoStackNode(stack: NormalizedTemplateNeoStack, args: BuildRuntimeHierarchyArgs): RuntimeHierarchyNode {
  const selected = args.assemblyPlan ? args.assemblyPlan.selectedNeoStackIds.includes(stack.id) : false;
  const aliases = createRuntimeIdAliases({ id: stack.id, metadata: { order: stack.stackOrder } });
  return {
    id: stack.id,
    kind: 'neostack',
    title: stack.title,
    subtitle: `${stack.neoBlockIds.length} NeoBlocks`,
    description: stack.description,
    parentId: args.templateSleeve?.id ?? args.instantiatedSleeve?.templateSleeve.id,
    childIds: stack.neoBlockIds,
    gateIds: [],
    tags: [...stack.tags, selectedTag(selected)],
    ...runtimeFields({ runtimeVisualState: args.runtimeVisualState, id: stack.id, aliases }),
    metadata: { stackOrder: stack.stackOrder, selectedByAssembly: selected }
  };
}

function makeNeoBlockNode(block: NormalizedTemplateNeoBlock, args: BuildRuntimeHierarchyArgs): RuntimeHierarchyNode {
  const selected = args.assemblyPlan ? args.assemblyPlan.selectedNeoBlockIds.includes(block.id) : false;
  const aliases = createRuntimeIdAliases({ id: block.id, parentId: block.neoStackId, metadata: { order: block.blockOrder } });
  return {
    id: block.id,
    kind: 'neoblock',
    title: block.title,
    subtitle: `${block.moltBlockIds.length} MOLT · ${block.gateIds.length} gates`,
    description: block.description,
    parentId: block.neoStackId,
    childIds: block.moltBlockIds,
    gateIds: block.gateIds,
    tags: [...block.tags, selectedTag(selected), `default-${block.defaultState}`],
    ...runtimeFields({ runtimeVisualState: args.runtimeVisualState, id: block.id, aliases }),
    metadata: { blockOrder: block.blockOrder, selectedByAssembly: selected, defaultState: block.defaultState }
  };
}

function makeMoltNode(block: NormalizedTemplateMoltBlock, args: BuildRuntimeHierarchyArgs): RuntimeHierarchyNode {
  const selected = args.assemblyPlan ? args.assemblyPlan.selectedMoltBlockIds.includes(block.id) : false;
  const aliases = createRuntimeIdAliases({ id: block.id, sourceId: block.sourceId, parentId: block.parentNeoBlockId, parentSourceId: block.parentNeoStackId });
  return {
    id: block.id,
    sourceId: block.sourceId,
    kind: 'molt',
    title: block.title,
    subtitle: block.role,
    description: block.content,
    role: block.role,
    parentId: block.parentNeoBlockId ?? block.parentNeoStackId,
    childIds: [],
    gateIds: [],
    tags: [...block.tags, selectedTag(selected), `role-${block.role}`, `default-${block.defaultState}`],
    ...runtimeFields({ runtimeVisualState: args.runtimeVisualState, id: block.id, sourceId: block.sourceId, aliases }),
    metadata: { selectedByAssembly: selected, parentNeoBlockId: block.parentNeoBlockId, parentNeoStackId: block.parentNeoStackId, defaultState: block.defaultState }
  };
}

function makeGateNode(gate: UMGGateRecord, args: BuildRuntimeHierarchyArgs): RuntimeHierarchyNode {
  const selected = args.assemblyPlan ? args.assemblyPlan.selectedGateIds.includes(gate.id) : false;
  const aliases = createRuntimeIdAliases({ id: gate.id, sourceId: gate.sourceId, parentId: gate.attachesTo.id, metadata: gate.metadata });
  return {
    id: gate.id,
    sourceId: gate.sourceId,
    kind: 'gate',
    title: gate.title,
    subtitle: `${gate.defaultState} · ${gate.action}`,
    description: gate.conditionText,
    parentId: gate.attachesTo.id,
    childIds: gate.targetIds,
    gateIds: [],
    tags: [...gate.tags, selectedTag(selected), 'control-record'],
    ...runtimeFields({ runtimeVisualState: args.runtimeVisualState, id: gate.id, sourceId: gate.sourceId, aliases }),
    metadata: { selectedByAssembly: selected, triggerType: gate.triggerType, action: gate.action, attachesTo: gate.attachesTo, promptContent: false }
  };
}

export function summarizeRuntimeCounts(nodes: RuntimeHierarchyNode[]) {
  return {
    active: nodes.filter((node) => node.runtimeState === 'active' || node.runtimeState === 'attention').length,
    processing: nodes.filter((node) => node.runtimeState === 'processing').length,
    complete: nodes.filter((node) => node.runtimeState === 'complete').length,
    blocked: nodes.filter((node) => node.runtimeState === 'blocked').length,
    error: nodes.filter((node) => node.runtimeState === 'error').length
  };
}

export function getVisibleRuntimeNodes(viewModel: Pick<RuntimeHierarchyViewModel, 'selectedLevel' | 'selectedNeoStackId' | 'selectedNeoBlockId' | 'neoStackNodes' | 'neoBlockNodes' | 'moltNodes'>) {
  if (viewModel.selectedLevel === 'neoblock' && viewModel.selectedNeoBlockId) {
    return viewModel.moltNodes.filter((node) => node.parentId === viewModel.selectedNeoBlockId);
  }
  if (viewModel.selectedLevel === 'neostack' && viewModel.selectedNeoStackId) {
    return viewModel.neoBlockNodes.filter((node) => node.parentId === viewModel.selectedNeoStackId);
  }
  return viewModel.neoStackNodes;
}

export function buildRuntimeHierarchyViewModel(args: BuildRuntimeHierarchyArgs): RuntimeHierarchyViewModel {
  const templateSleeve = args.templateSleeve ?? args.instantiatedSleeve?.templateSleeve;
  const warnings: string[] = [];
  if (!templateSleeve) {
    warnings.push('Create a Sleeve from template to view hierarchy.');
  }
  if (!args.runtimeVisualState) {
    warnings.push('Run Hermes with a compiled manifest to activate runtime states.');
  } else if (!args.runtimeVisualState.timeline.length) {
    warnings.push('No runtime trace returned; hierarchy remains idle/off.');
  }

  const sleeveNode = templateSleeve ? makeSleeveNode(templateSleeve, args) : undefined;
  const neoStackNodes = templateSleeve ? templateSleeve.neoStacks.map((stack) => makeNeoStackNode(stack, { ...args, templateSleeve })) : [];
  const neoBlockNodes = templateSleeve ? templateSleeve.neoBlocks.map((block) => makeNeoBlockNode(block, { ...args, templateSleeve })) : [];
  const moltNodes = templateSleeve ? templateSleeve.moltBlocks.map((block) => makeMoltNode(block, { ...args, templateSleeve })) : [];
  const gateNodes = templateSleeve ? templateSleeve.gates.map((gate) => makeGateNode(gate, { ...args, templateSleeve })) : [];

  const selectedNeoStackId = args.selectedNeoStackId && neoStackNodes.some((node) => node.id === args.selectedNeoStackId)
    ? args.selectedNeoStackId
    : undefined;
  const selectedNeoBlockId = args.selectedNeoBlockId && neoBlockNodes.some((node) => node.id === args.selectedNeoBlockId)
    ? args.selectedNeoBlockId
    : undefined;
  const selectedLevel: RuntimeHierarchyLevel = selectedNeoBlockId ? 'neoblock' : selectedNeoStackId ? 'neostack' : 'sleeve';
  const visibleNodes = getVisibleRuntimeNodes({ selectedLevel, selectedNeoStackId, selectedNeoBlockId, neoStackNodes, neoBlockNodes, moltNodes });
  const breadcrumb = unique([sleeveNode?.id, selectedNeoStackId, selectedNeoBlockId]).map((id) => [sleeveNode, ...neoStackNodes, ...neoBlockNodes].find((node) => node?.id === id)).filter((node): node is RuntimeHierarchyNode => Boolean(node));
  const runtimeCounts = summarizeRuntimeCounts([...(sleeveNode ? [sleeveNode] : []), ...neoStackNodes, ...neoBlockNodes, ...moltNodes, ...gateNodes]);

  return {
    sleeveNode,
    neoStackNodes,
    neoBlockNodes,
    moltNodes,
    gateNodes,
    selectedLevel,
    selectedNeoStackId,
    selectedNeoBlockId,
    visibleNodes,
    breadcrumb,
    counts: {
      neoStacks: neoStackNodes.length,
      neoBlocks: neoBlockNodes.length,
      moltBlocks: moltNodes.length,
      gates: gateNodes.length,
      ...runtimeCounts
    },
    warnings
  };
}
