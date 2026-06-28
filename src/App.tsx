import { useEffect, useMemo, useRef, useState } from 'react';
import './style.css';
import rawBlocks from '../data/library/blocks.json';
import normalizedBlocks from '../data/library/normalized-blocks.json';
import savedNeoBlocks from '../data/library/neoblocks.json';
import savedNeoStacks from '../data/library/neostacks.json';
import savedSleeves from '../data/library/sleeves.json';
import migrationReport from '../data/library/migration-report.json';
import sourceAuditData from '../data/library/source-assets.json';
import { normalizeImportedBlocks, classifyLibraryDisplay, sectionLibraryByDisplayType } from './lib/umg/migrateLibrary';
import { composeBlocks } from './lib/umg/composeBlocks';
import { applyCompileResultToGraph, applyManualLayout, applyContainmentSnap, buildGraphFromSleeve, focusGraph, gateVisualMetadataForEdge, gateVisualMetadataForNode } from './lib/umg/graphBuilder';
import { compileWorkspaceToRuntime } from './lib/umg/compilerBridge';
import { downloadJson, exportHermesPacket } from './lib/umg/exporters';
import { redactKey, testHermesConnection } from './lib/hermes/hermesClient';
import { generateWithHermesEndpoint, HermesGenerateEndpointMode, inferHermesGenerateEndpointMode, resolveHermesGenerateConfig } from './lib/umg/hermesGenerate';
import { buildLocalGenerateFallback } from './lib/umg/localGenerate';
import { buildAssetShelves, searchShelfAssets, ShelfAsset, AssetShelfId, SourceAuditItem, triggerGateCategoryDisplayCopy } from './lib/umg/libraryAssets';
import { buildBlockInspectorViews } from './lib/umg/blockViews';
import { buildTriggerGateSourceInspectorViews, normalizeTriggerGateSourceCards } from './lib/umg/gateSourceImport';
import { buildRuntimeGateFromSourceCard, attachRuntimeGateToGraph } from './lib/umg/gateRuntime';
import { projectGlyphMatrix, renderGlyphMatrixText, GlyphMatrixViewMode } from './lib/umg/glyphMatrix';
import { buildRuntimeGateDebugView } from './lib/umg/gateDebug';
import { loadWorkbenchLayout, saveWorkbenchLayout, WorkbenchLayoutState } from './lib/umg/workbenchLayout';
import { normalizeNeoStack, normalizeSleeve } from './lib/umg/scopeModel';
import { buildDefaultSegmentForScope, cloneSegmentLayout, findSlotByOccupantId, getEditableRows, getSlotsByRow, moveChildToRow, normalizeAuthorityRelationsToController, normalizePeerRelations } from './lib/umg/segmentLayout';
import { CompileResult, GraphNode, HermesConfig, NeoBlock, NeoStack, RuntimeGate, Sleeve, TriggerGateSourceCard, UMGBlock, UMGControllerBlock, UMGSegmentLayout, UMGWorkspace } from './lib/umg/types';

const demo = 'Build me a customer-intake chatbot for a mobile detailing business. It should answer basic questions, collect customer name, vehicle type, location, service need, and budget, then produce a clean lead summary.';
const roles = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];
const statuses = ['all', 'runnable', 'warning-bearing', 'meta', 'reference-only', 'unsupported'];
const defaultStatusFilter = 'runnable';
const inspectorTabs = ['Card', 'Runtime', 'Runtime Preview', 'NL', 'JSON', 'Legacy Source', 'Attach / Placement Preview', 'Trace / IR Preview', 'Trace', 'IR Row'] as const;
const triggerGateSourceModules = import.meta.glob('../../umg-block-library/HUMAN/GATES/TRG.*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const universalLayerLabel = (rowLabel: string) => ({
  Strategy: 'Frame',
  Domains: 'Sectors',
  Specialization: 'Modules',
  Details: 'Units'
}[rowLabel] ?? rowLabel);

const segmentLayerDisplayLabel = (row: { index: number; label: string }) => `Layer ${row.index} · ${universalLayerLabel(row.label)}`;

const defaultEditableLayerId = (segment?: UMGSegmentLayout) => {
  if (!segment) return undefined;
  const editableRows = getEditableRows(segment);
  if (!editableRows.length) return undefined;
  const firstOccupiedRow = editableRows.find((row) => getSlotsByRow(segment, row.id).some((slot) => slot.occupantKind === 'scope_child' && slot.occupantId));
  return firstOccupiedRow?.id ?? editableRows[0]?.id;
};

const ensureSegmentChildPlacement = (segment: UMGSegmentLayout, seededScopeSegment: UMGSegmentLayout, childId: string, targetRowId: string) => {
  let nextSegment = cloneSegmentLayout(segment);
  if (!findSlotByOccupantId(nextSegment, childId)) {
    const seededSlot = findSlotByOccupantId(seededScopeSegment, childId);
    if (!seededSlot) return nextSegment;
    nextSegment = {
      ...nextSegment,
      slots: [...nextSegment.slots, { ...seededSlot }]
    };
    nextSegment = normalizeAuthorityRelationsToController(nextSegment);
    nextSegment = normalizePeerRelations(nextSegment);
  }
  return moveChildToRow(nextSegment, childId, targetRowId);
};

type InspectorTab = typeof inspectorTabs[number];

type ResizeTarget = 'left' | 'right' | 'bottom';
type ShelfMode = AssetShelfId;
type WorkspaceMode = 'compose' | 'canvas' | 'runtime';
type GraphViewMode = 'full_sleeve' | 'neostack' | 'neoblock' | 'molt_builder';
type RuntimeDrawerTab = 'RuntimeSpec' | 'Trace' | 'IR Matrix' | 'Glyph Matrix' | 'Output';
type PlacementTargetIds = { neostackId?: string; neoblockId?: string };
type PlacementTargetChoice = { id: string; label: string; detail?: string; neostackId?: string; neoblockId?: string };
const runtimeDrawerTabs: RuntimeDrawerTab[] = ['RuntimeSpec', 'Trace', 'IR Matrix', 'Glyph Matrix', 'Output'];

const moltBuilderSections = [
  { key: 'directive', label: 'Directive', className: 'moltRoleDirective' },
  { key: 'instruction', label: 'Instruction', className: 'moltRoleInstruction' },
  { key: 'subject', label: 'Subject', className: 'moltRoleSubject' },
  { key: 'primary', label: 'Primary', className: 'moltRolePrimary' },
  { key: 'philosophy', label: 'Philosophy', className: 'moltRolePhilosophy' },
  { key: 'blueprint', label: 'Blueprint', className: 'moltRoleBlueprint' },
  { key: 'meta_other', label: 'Meta / Other', className: 'moltRoleMeta' }
] as const;

export default function App() {
  const initialHermesGenerate = resolveHermesGenerateConfig(import.meta.env as Record<string, string | undefined>);
  const [library] = useState<UMGBlock[]>(() => normalizedBlocks.length ? (normalizedBlocks as UMGBlock[]) : normalizeImportedBlocks(rawBlocks as unknown[]));
  const [sessionMoltBlocks, setSessionMoltBlocks] = useState<UMGBlock[]>([]);
  const [sessionNeoBlocks, setSessionNeoBlocks] = useState<NeoBlock[]>([]);
  const [sessionNeoStacks, setSessionNeoStacks] = useState<NeoStack[]>([]);
  const [request, setRequest] = useState(demo);
  const [depth, setDepth] = useState<'lean' | 'balanced' | 'full'>('balanced');
  const [target, setTarget] = useState('chatbot');
  const [workspace, setWorkspace] = useState<UMGWorkspace | undefined>();
  const [compiled, setCompiled] = useState<CompileResult | undefined>();
  const [selected, setSelected] = useState<GraphNode | undefined>();
  const [inspected, setInspected] = useState<unknown | undefined>();
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('Card');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('ready');
  const [runtimeTab, setRuntimeTab] = useState<RuntimeDrawerTab>('RuntimeSpec');
  const [graphViewMode, setGraphViewMode] = useState<GraphViewMode>('full_sleeve');
  const [showGates, setShowGates] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('canvas');
  const [focusGraphMode, setFocusGraphMode] = useState(false);
  const [focusGraphBackup, setFocusGraphBackup] = useState<{ layout: WorkbenchLayoutState; workspaceMode: WorkspaceMode } | undefined>();
  const [activeShelf, setActiveShelf] = useState<ShelfMode>('molt_blocks');
  const [pendingTargetItem, setPendingTargetItem] = useState<ShelfAsset | undefined>();
  const [chosenTargets, setChosenTargets] = useState<PlacementTargetIds>({});
  const [search, setSearch] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter);
  const [config, setConfig] = useState<HermesConfig>(() => initialHermesGenerate.config);
  const [endpointMode, setEndpointMode] = useState<HermesGenerateEndpointMode>(initialHermesGenerate.endpointMode);
  const [hermesStatus, setHermesStatus] = useState('not configured');
  const [layout, setLayout] = useState<WorkbenchLayoutState>(() =>
    typeof window === 'undefined' ? loadWorkbenchLayout(undefined) : loadWorkbenchLayout(window.localStorage)
  );
  const [editingMoltId, setEditingMoltId] = useState<string | undefined>();
  const [editingMoltDraft, setEditingMoltDraft] = useState<{ title: string; category: string; tagsText: string; content: string } | undefined>();
  const [moltBuilderNotice, setMoltBuilderNotice] = useState('Choose a MOLT block to edit or reorganize.');
  const [lastAffectedMoltId, setLastAffectedMoltId] = useState<string | undefined>();
  const [lastAffectedMoltLabel, setLastAffectedMoltLabel] = useState<string | undefined>();
  const [isEditingNeoStackLayout, setIsEditingNeoStackLayout] = useState(false);
  const [editingNeoStackLayoutId, setEditingNeoStackLayoutId] = useState<string | undefined>();
  const [draftNeoStackSegment, setDraftNeoStackSegment] = useState<UMGSegmentLayout | undefined>();
  const [selectedNeoStackRowId, setSelectedNeoStackRowId] = useState<string | undefined>();
  const selectedNeoStackOwnerRef = useRef<string | undefined>(undefined);
  const [neoStackLayoutNotice, setNeoStackLayoutNotice] = useState('Select a layer, then add a NeoBlock directly into that layer. Layout updates locally.');

  useEffect(() => {
    if (typeof window !== 'undefined') saveWorkbenchLayout(window.localStorage, layout);
  }, [layout]);

  const libraryWithStatus = useMemo(() => [...library, ...sessionMoltBlocks].map((block) => {
    const classification = classifyLibraryDisplay(block);
    return { ...block, displayType: classification.displayType, presentationStatus: classification.status };
  }), [library, sessionMoltBlocks]);
  const triggerGateSourceCards = useMemo(() => normalizeTriggerGateSourceCards(Object.entries(triggerGateSourceModules).map(([sourcePath, markdown]) => ({ sourcePath, markdown }))), []);
  const sections = useMemo(() => sectionLibraryByDisplayType(libraryWithStatus), [libraryWithStatus]);
  const statusCounts = useMemo(() => libraryWithStatus.reduce((acc, block) => ({ ...acc, [block.presentationStatus!]: (acc[block.presentationStatus!] ?? 0) + 1 }), {} as Record<string, number>), [libraryWithStatus]);
  const localLibraryNeoBlocks = useMemo(() => [...(savedNeoBlocks as NeoBlock[]), ...sessionNeoBlocks], [sessionNeoBlocks]);
  const localLibraryNeoStacks = useMemo(() => [...(savedNeoStacks as NeoStack[]), ...sessionNeoStacks], [sessionNeoStacks]);
  const shelves = useMemo(() => buildAssetShelves({ blocks: libraryWithStatus, neoblocks: localLibraryNeoBlocks, neostacks: localLibraryNeoStacks, sleeves: savedSleeves as Sleeve[], sourceAuditItems: sourceAuditData as SourceAuditItem[], gateSourceCards: triggerGateSourceCards }), [libraryWithStatus, localLibraryNeoBlocks, localLibraryNeoStacks, triggerGateSourceCards]);
  const controlSourceShelf = useMemo(() => shelves.find((shelf) => shelf.id === 'control_sources'), [shelves]);
  const currentShelf = shelves.find((shelf) => shelf.id === activeShelf) ?? shelves[0];
  const isTriggerCategoryActive = activeShelf === 'molt_blocks' && roleFilter === 'trigger';
  const resolvedShelf = isTriggerCategoryActive ? (controlSourceShelf ?? currentShelf) : currentShelf;
  const promptTriggerCount = useMemo(() => libraryWithStatus.filter((block) => block.displayType === 'trigger').length, [libraryWithStatus]);
  const triggerCategoryCount = triggerGateSourceCards.length;
  const roleFilterCount = useMemo<Record<string, number>>(() => ({
    trigger: triggerCategoryCount,
    all: libraryWithStatus.length,
    directive: libraryWithStatus.filter((block) => block.displayType === 'directive').length,
    instruction: libraryWithStatus.filter((block) => block.displayType === 'instruction').length,
    subject: libraryWithStatus.filter((block) => block.displayType === 'subject').length,
    primary: libraryWithStatus.filter((block) => block.displayType === 'primary').length,
    philosophy: libraryWithStatus.filter((block) => block.displayType === 'philosophy').length,
    blueprint: libraryWithStatus.filter((block) => block.displayType === 'blueprint').length,
    meta: libraryWithStatus.filter((block) => block.displayType === 'meta').length
  }), [libraryWithStatus, triggerCategoryCount]);
  const countForRoleFilter = (role: string) => roleFilterCount[role] ?? 0;
  const visibleItems = useMemo(() => {
    let items = searchShelfAssets(resolvedShelf.items, { query: search, tags: tagFilters });
    if (activeShelf === 'molt_blocks' && !isTriggerCategoryActive) {
      items = items.filter((item) => {
        const block = item.asset as UMGBlock;
        return (roleFilter === 'all' || block.displayType === roleFilter) && (statusFilter === 'all' || block.presentationStatus === statusFilter);
      });
    }
    return items;
  }, [resolvedShelf, search, tagFilters, activeShelf, roleFilter, statusFilter, isTriggerCategoryActive]);
  const visibleTags = useMemo(() => [...new Set(resolvedShelf.items.flatMap((item) => item.tags))].filter(Boolean).slice(0, 24), [resolvedShelf]);
  const graph = workspace?.graph;
  const activeSleeve = useMemo(() => {
    if (!workspace?.sleeves?.length) return undefined;
    return workspace.sleeves.find((sleeve) => sleeve.id === workspace.activeSleeveId) ?? workspace.sleeves[0];
  }, [workspace]);
  const displaySleeve = useMemo(() => activeSleeve ? normalizeSleeve(activeSleeve) : undefined, [activeSleeve]);
  useEffect(() => {
    if (!activeSleeve) {
      setChosenTargets({});
      setPendingTargetItem(undefined);
      return;
    }
    setChosenTargets((current) => {
      const next: PlacementTargetIds = {
        neostackId: current.neostackId && activeSleeve.stacks.some((stack) => stack.id === current.neostackId) ? current.neostackId : undefined,
        neoblockId: current.neoblockId && activeSleeve.stacks.some((stack) => stack.neoblocks.some((neoblock) => neoblock.id === current.neoblockId)) ? current.neoblockId : undefined
      };
      return next.neostackId === current.neostackId && next.neoblockId === current.neoblockId ? current : next;
    });
  }, [activeSleeve]);
  const selectedBlock = useMemo(() => selected ? findWorkspaceBlock(workspace, selected.sourceId) : undefined, [workspace, selected]);
  const selectedNeoBlock = useMemo(() => {
    if (!activeSleeve || !selected) return undefined;
    if (selected.nodeType === 'neoblock') return findNeoBlockInSleeve(activeSleeve, selected.sourceId);
    if (selectedBlock) return findParentNeoBlockForBlock(activeSleeve, selectedBlock.id);
    return undefined;
  }, [activeSleeve, selected, selectedBlock]);
  const selectedNeoStack = useMemo(() => {
    if (!activeSleeve || !selected) return undefined;
    if (selected.nodeType === 'neostack') return activeSleeve.stacks.find((stack) => stack.id === selected.sourceId);
    if (selected.nodeType === 'neoblock') return findParentStackForNeoBlock(activeSleeve, selected.sourceId);
    if (selectedBlock) return findParentStackForBlock(activeSleeve, selectedBlock.id);
    return undefined;
  }, [activeSleeve, selected, selectedBlock]);
  const chosenNeoBlock = useMemo(() => activeSleeve && chosenTargets.neoblockId ? findNeoBlockInSleeve(activeSleeve, chosenTargets.neoblockId) : undefined, [activeSleeve, chosenTargets.neoblockId]);
  const currentNeoBlock = useMemo(() => {
    if (!activeSleeve) return undefined;
    if (selectedNeoBlock) return selectedNeoBlock;
    if (chosenNeoBlock) return chosenNeoBlock;
    return activeSleeve.stacks.flatMap((stack) => stack.neoblocks)[0];
  }, [activeSleeve, chosenNeoBlock, selectedNeoBlock]);
  const chosenNeoStack = useMemo(() => activeSleeve && chosenTargets.neostackId ? activeSleeve.stacks.find((stack) => stack.id === chosenTargets.neostackId) : undefined, [activeSleeve, chosenTargets.neostackId]);
  const buildNeoStackLayoutDraft = (neoStack: NeoStack) => neoStack.segmentLayout ? cloneSegmentLayout(neoStack.segmentLayout) : buildDefaultSegmentForScope(normalizeNeoStack(neoStack));
  const currentNeoStack = useMemo(() => {
    if (!activeSleeve) return undefined;
    if (selectedNeoStack) return selectedNeoStack;
    if (selectedNeoBlock) return findParentStackForNeoBlock(activeSleeve, selectedNeoBlock.id);
    if (chosenNeoBlock) return findParentStackForNeoBlock(activeSleeve, chosenNeoBlock.id);
    if (chosenNeoStack) return chosenNeoStack;
    if (currentNeoBlock) return findParentStackForNeoBlock(activeSleeve, currentNeoBlock.id);
    return activeSleeve.stacks[0];
  }, [activeSleeve, chosenNeoBlock, chosenNeoStack, currentNeoBlock, selectedNeoBlock, selectedNeoStack]);
  const displayNeoStack = useMemo(() => currentNeoStack ? normalizeNeoStack(currentNeoStack) : undefined, [currentNeoStack]);
  const persistedNeoStackSegment = useMemo(() => currentNeoStack?.segmentLayout ? structuredClone(currentNeoStack.segmentLayout) : undefined, [currentNeoStack]);
  const displayNeoStackSegment = useMemo(() => persistedNeoStackSegment ?? (displayNeoStack ? buildDefaultSegmentForScope(displayNeoStack) : undefined), [displayNeoStack, persistedNeoStackSegment]);
  const activeNeoStackSegment = useMemo(() => displayNeoStackSegment, [displayNeoStackSegment]);
  const selectedNeoStackRow = useMemo(() => activeNeoStackSegment ? getEditableRows(activeNeoStackSegment).find((row) => row.id === selectedNeoStackRowId) : undefined, [activeNeoStackSegment, selectedNeoStackRowId]);
  const setBuilderFeedback = (message: string, blockId?: string, badgeLabel?: string) => {
    setMoltBuilderNotice(message);
    setLastAffectedMoltId(blockId);
    setLastAffectedMoltLabel(badgeLabel);
  };
  useEffect(() => {
    if (!currentNeoBlock) {
      setEditingMoltId(undefined);
      setEditingMoltDraft(undefined);
      setLastAffectedMoltId(undefined);
      setLastAffectedMoltLabel(undefined);
      return;
    }
    if (editingMoltId && !currentNeoBlock.blocks.some((block) => block.id === editingMoltId)) {
      setEditingMoltId(undefined);
      setEditingMoltDraft(undefined);
    }
    if (lastAffectedMoltId && !currentNeoBlock.blocks.some((block) => block.id === lastAffectedMoltId)) {
      setLastAffectedMoltId(undefined);
      setLastAffectedMoltLabel(undefined);
    }
  }, [currentNeoBlock, editingMoltId, lastAffectedMoltId]);
  useEffect(() => {
    const editableRows = activeNeoStackSegment ? getEditableRows(activeNeoStackSegment) : [];
    if (selectedNeoStackOwnerRef.current !== currentNeoStack?.id) {
      selectedNeoStackOwnerRef.current = currentNeoStack?.id;
      setSelectedNeoStackRowId(defaultEditableLayerId(activeNeoStackSegment));
      return;
    }
    if (!editableRows.length) {
      if (selectedNeoStackRowId) setSelectedNeoStackRowId(undefined);
      return;
    }
    if (selectedNeoStackRowId && editableRows.some((row) => row.id === selectedNeoStackRowId)) return;
    setSelectedNeoStackRowId(defaultEditableLayerId(activeNeoStackSegment));
  }, [activeNeoStackSegment, currentNeoStack?.id, selectedNeoStackRowId]);
  useEffect(() => {
    if (!isEditingNeoStackLayout) return;
    if (!currentNeoStack || editingNeoStackLayoutId !== currentNeoStack.id) {
      setIsEditingNeoStackLayout(false);
      setEditingNeoStackLayoutId(undefined);
      setDraftNeoStackSegment(undefined);
      setNeoStackLayoutNotice('Layout draft canceled because the active NeoStack changed.');
    }
  }, [currentNeoStack, editingNeoStackLayoutId, isEditingNeoStackLayout]);
  const activeTargetNeoStack = selected ? selectedNeoStack : chosenNeoStack;
  const activeTargetNeoBlock = selected ? selectedNeoBlock : chosenNeoBlock;
  const neostackTargetChoices = useMemo<PlacementTargetChoice[]>(() => activeSleeve?.stacks.map((stack) => ({
    id: stack.id,
    label: stack.title,
    detail: `${stack.neoblocks.length} NeoBlock${stack.neoblocks.length === 1 ? '' : 's'}`,
    neostackId: stack.id
  })) ?? [], [activeSleeve]);
  const neoblockTargetChoices = useMemo<PlacementTargetChoice[]>(() => activeSleeve?.stacks.flatMap((stack) => stack.neoblocks.map((neoblock) => ({
    id: neoblock.id,
    label: neoblock.title,
    detail: `NeoStack ${stack.title}`,
    neostackId: stack.id,
    neoblockId: neoblock.id
  }))) ?? [], [activeSleeve]);
  const pendingTargetChoices = useMemo<PlacementTargetChoice[]>(() => {
    if (!pendingTargetItem) return [];
    if (pendingTargetItem.kind === 'neoblock') return neostackTargetChoices;
    if (pendingTargetItem.kind === 'molt_block') return neoblockTargetChoices;
    return [];
  }, [neoblockTargetChoices, neostackTargetChoices, pendingTargetItem]);
  const viewedGraph = useMemo(() => {
    if (!graph) return graph;
    const fallbackSleeve = graph.nodes.find((node) => node.nodeType === 'sleeve');
    const fallbackNeostack = graph.nodes.find((node) => node.nodeType === 'neostack');
    const fallbackNeoblock = graph.nodes.find((node) => node.nodeType === 'neoblock');

    if (graphViewMode === 'full_sleeve') {
      const focusSourceId = activeSleeve?.id ?? fallbackSleeve?.sourceId ?? fallbackSleeve?.id;
      if (!focusSourceId) return graph;
      return focusGraph(graph, { mode: 'sleeve', sourceId: focusSourceId });
    }

    if (graphViewMode === 'neostack') {
      const focusSourceId = currentNeoStack?.id ?? fallbackNeostack?.sourceId ?? fallbackNeostack?.id;
      if (!focusSourceId) return graph;
      return focusGraph(graph, { mode: 'neostack', sourceId: focusSourceId });
    }

    if (graphViewMode === 'neoblock') {
      const focusSourceId = currentNeoBlock?.id ?? selectedNeoBlock?.id ?? selected?.sourceId ?? fallbackNeoblock?.sourceId ?? fallbackNeoblock?.id;
      if (!focusSourceId) return graph;
      return focusGraph(graph, { mode: 'neoblock', sourceId: focusSourceId });
    }

    if (graphViewMode === 'molt_builder') {
      const focusSourceId = currentNeoBlock?.id ?? selectedNeoBlock?.id ?? fallbackNeoblock?.sourceId ?? fallbackNeoblock?.id;
      if (!focusSourceId) return graph;
      return focusGraph(graph, { mode: 'neoblock', sourceId: focusSourceId });
    }
  }, [activeSleeve, currentNeoBlock, currentNeoStack, graph, graphViewMode, selected, selectedNeoBlock]);
  const displayGraph = useMemo(() => {
    if (!viewedGraph) return viewedGraph;

    let nextNodes = viewedGraph.nodes.filter((node) => node.nodeType !== 'output');
    let nextEdges = viewedGraph.edges;

    if (graphViewMode === 'full_sleeve') {
      const visibleNodeIds = new Set(nextNodes.filter((node) => node.nodeType === 'neostack').map((node) => node.id));
      nextNodes = nextNodes.filter((node) => visibleNodeIds.has(node.id));
      nextEdges = nextEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    }

    if (graphViewMode === 'neostack' || graphViewMode === 'neoblock') {
      const visibleNodeIds = new Set(nextNodes.filter((node) => node.nodeType === 'neoblock').map((node) => node.id));
      nextNodes = nextNodes.filter((node) => visibleNodeIds.has(node.id));
      nextEdges = nextEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    }

    if (!showGates) {
      const gateNodeIds = new Set(nextNodes.filter((node) => node.nodeType === 'gate').map((node) => node.id));
      nextNodes = nextNodes.filter((node) => node.nodeType !== 'gate');
      nextEdges = nextEdges.filter((edge) => !gateNodeIds.has(edge.source) && !gateNodeIds.has(edge.target));
    }

    const visibleNodeIds = new Set(nextNodes.map((node) => node.id));
    nextEdges = nextEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));

    return { ...viewedGraph, nodes: nextNodes, edges: nextEdges };
  }, [graphViewMode, showGates, viewedGraph]);

  const graphSelectedId = useMemo(() => {
    if (!displayGraph) return undefined;
    if (selected?.id && displayGraph.nodes.some((node) => node.id === selected.id)) return selected.id;
    if (graphViewMode === 'neoblock' && currentNeoBlock) {
      return displayGraph.nodes.find((node) => node.nodeType === 'neoblock' && node.sourceId === currentNeoBlock.id)?.id;
    }
    if (graphViewMode === 'neostack' && currentNeoBlock) {
      return displayGraph.nodes.find((node) => node.nodeType === 'neoblock' && node.sourceId === currentNeoBlock.id)?.id;
    }
    return undefined;
  }, [currentNeoBlock, displayGraph, graphViewMode, selected]);
  const inspectedBlock = isUMGBlock(inspected) ? inspected : undefined;
  const inspectedGateSource = isTriggerGateSourceCard(inspected) ? inspected : undefined;
  const inspectorBlock = inspectedBlock ?? selectedBlock;
  const inspectorViews = useMemo(() => inspectedGateSource ? buildTriggerGateSourceInspectorViews(inspectedGateSource) : inspectorBlock ? buildBlockInspectorViews(inspectorBlock, {
    graphNode: selected?.sourceId === inspectorBlock.id ? selected : undefined,
    irRow: compiled?.irMatrix.find((row) => row.nodeId === inspectorBlock.id),
    trace: compiled?.trace
  }) : undefined, [inspectedGateSource, inspectorBlock, selected, compiled]);
  const selectedGateId = selected?.governingGateIds?.[0];
  const selectedGateGlyphMatrix = useMemo(() => compiled ? projectGlyphMatrix({ runtimeSpec: compiled.runtimeSpec, irMatrix: compiled.irMatrix, trace: compiled.trace, graph: workspace?.graph, activeSleeveId: workspace?.activeSleeveId, viewMode: 'compact' }) : undefined, [compiled, workspace]);
  const fullGlyphMatrix = useMemo(() => compiled ? projectGlyphMatrix({ runtimeSpec: compiled.runtimeSpec, irMatrix: compiled.irMatrix, trace: compiled.trace, graph: workspace?.graph, activeSleeveId: workspace?.activeSleeveId, viewMode: 'full_sleeve' }) : undefined, [compiled, workspace]);
  const runtimeGateDebugView = useMemo(() => selectedGateId ? buildRuntimeGateDebugView({ gateId: selectedGateId, workspace, compiled, glyphMatrix: selectedGateGlyphMatrix }) : undefined, [selectedGateId, workspace, compiled, selectedGateGlyphMatrix]);
  const resizeState = useRef<{
    target: ResizeTarget;
    startX: number;
    startY: number;
    startLeftWidth: number;
    startRightWidth: number;
    startBottomHeight: number;
  } | null>(null);

  const startResize = (target: ResizeTarget, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const currentTarget = event.currentTarget;
    const pointerId = event.pointerId;
    resizeState.current = {
      target,
      startX: event.clientX,
      startY: event.clientY,
      startLeftWidth: layout.leftWidth,
      startRightWidth: layout.rightWidth,
      startBottomHeight: layout.bottomHeight
    };
    if (target === 'left' && layout.leftCollapsed) setLayout((current) => ({ ...current, leftCollapsed: false, leftWidth: Math.max(layout.leftWidth, 240) }));
    if (target === 'right' && layout.rightCollapsed) setLayout((current) => ({ ...current, rightCollapsed: false, rightWidth: Math.max(layout.rightWidth, 400) }));
    if (target === 'bottom' && layout.bottomCollapsed) setLayout((current) => ({ ...current, bottomCollapsed: false, bottomHeight: Math.max(layout.bottomHeight, 180) }));

    const onPointerMove = (move: PointerEvent) => {
      const state = resizeState.current;
      if (!state) return;
      setLayout((current) => {
        if (state.target === 'left') return {
          ...current,
          leftWidth: Math.min(560, Math.max(220, state.startLeftWidth + (move.clientX - state.startX)))
        };
        if (state.target === 'right') return {
          ...current,
          rightWidth: Math.min(620, Math.max(260, state.startRightWidth - (move.clientX - state.startX)))
        };
        return {
          ...current,
          bottomHeight: Math.min(520, Math.max(150, state.startBottomHeight + (state.startY - move.clientY)))
        };
      });
    };

    const stopResize = () => {
      resizeState.current = null;
      if (pointerId >= 0) {
        try {
          if (currentTarget.hasPointerCapture(pointerId)) {
            currentTarget.releasePointerCapture(pointerId);
          }
        } catch {
          // ignore pointer-capture incompatibilities in non-native pointer streams
        }
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopResize);
    };

    if (pointerId >= 0) {
      try {
        currentTarget.setPointerCapture(pointerId);
      } catch {
        // keep resize robust when pointer capture is unavailable in the current event stream
      }
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopResize);
  };

  const classes = [
    layout.leftCollapsed ? 'leftCollapsed' : '',
    layout.rightCollapsed ? 'rightCollapsed' : '',
    layout.bottomCollapsed ? 'bottomCollapsed' : '',
    focusGraphMode ? 'focusGraph' : '',
    `mode-${workspaceMode}`
  ].filter(Boolean).join(' ');

  const layoutStyle = {
    '--leftWidth': `${layout.leftWidth}px`,
    '--rightWidth': `${layout.rightWidth}px`,
    '--bottomHeight': `${layout.bottomHeight}px`
  } as React.CSSProperties;

  const enterFocusGraph = () => {
    if (focusGraphMode) return;
    setFocusGraphBackup({ layout, workspaceMode });
    setLayout((current) => ({ ...current, leftCollapsed: true, rightCollapsed: true, bottomCollapsed: true }));
    setWorkspaceMode('canvas');
    setFocusGraphMode(true);
    setStatus('focus graph enabled');
  };

  const exitFocusGraph = () => {
    const backup = focusGraphBackup;
    if (!focusGraphMode) return;
    if (backup) {
      setLayout(backup.layout);
      setWorkspaceMode(backup.workspaceMode);
    }
    setFocusGraphMode(false);
    setFocusGraphBackup(undefined);
    setStatus('focus graph disabled');
  };

  const rebuildGraphWithRuntimeGates = (nextSleeve: Sleeve, runtimeGates: RuntimeGate[] = workspace?.runtimeGates ?? []) => {
    const baseGraph = buildGraphFromSleeve(nextSleeve);
    const validNodeIds = new Set(baseGraph.nodes.map((node) => node.id));
    const validEdgeIds = new Set(baseGraph.edges.map((edge) => edge.id));
    const filteredRuntimeGates = runtimeGates.filter((gate) => gate.placement && (gate.placement.kind === 'node_boundary' ? validNodeIds.has(gate.placement.targetId) : validEdgeIds.has(gate.placement.targetId)));
    return filteredRuntimeGates.reduce<{ graph: UMGWorkspace['graph']; runtimeGates: RuntimeGate[] }>((current, gate) => {
      const placement = gate.placement?.kind === 'edge'
        ? { kind: 'edge' as const, edgeId: gate.placement.targetId }
        : { kind: 'node_boundary' as const, nodeId: gate.placement!.targetId };
      return attachRuntimeGateToGraph(current.graph, gate, placement, current.runtimeGates);
    }, { graph: baseGraph, runtimeGates: [] });
  };

  const replaceActiveSleeve = (nextSleeve: Sleeve, nextSelectedSourceId?: string, runtimeGates: RuntimeGate[] = workspace?.runtimeGates ?? []) => {
    if (!workspace) return;
    const activeSleeveId = activeSleeve?.id ?? workspace.activeSleeveId ?? workspace.sleeves[0]?.id;
    const nextSleeves = workspace.sleeves.map((sleeve) => sleeve.id === activeSleeveId ? nextSleeve : sleeve);
    const rebuilt = rebuildGraphWithRuntimeGates(nextSleeve, runtimeGates);
    const selectedSourceId = nextSelectedSourceId ?? selected?.sourceId;
    setWorkspace({ ...workspace, activeSleeveId: nextSleeve.id, sleeves: nextSleeves, graph: rebuilt.graph, runtimeGates: rebuilt.runtimeGates });
    setCompiled(undefined);
    if (selectedSourceId) {
      setSelected(rebuilt.graph.nodes.find((node) => node.sourceId === selectedSourceId || node.id === selectedSourceId));
      return;
    }
    setSelected(undefined);
  };

  const updateCurrentNeoStack = (mutator: (neostack: NeoStack) => NeoStack, nextSelectedSourceId?: string) => {
    if (!activeSleeve || !currentNeoStack) return;
    const nextSleeve = structuredClone(activeSleeve);
    nextSleeve.stacks = nextSleeve.stacks.map((stack) => stack.id === currentNeoStack.id ? mutator(stack) : stack);
    replaceActiveSleeve(nextSleeve, nextSelectedSourceId ?? currentNeoStack.id);
  };

  const updateCurrentNeoBlock = (mutator: (neoblock: NeoBlock) => NeoBlock, nextSelectedSourceId?: string) => {
    if (!activeSleeve || !currentNeoBlock) return;
    const nextSleeve = structuredClone(activeSleeve);
    nextSleeve.stacks = nextSleeve.stacks.map((stack) => ({
      ...stack,
      neoblocks: stack.neoblocks.map((neoblock) => neoblock.id === currentNeoBlock.id ? mutator(neoblock) : neoblock)
    }));
    replaceActiveSleeve(nextSleeve, nextSelectedSourceId ?? currentNeoBlock.id);
  };

  const moveBlockWithinRole = (blockId: string, direction: 'up' | 'down') => {
    if (!currentNeoBlock) return;
    const index = currentNeoBlock.blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;
    const currentBlock = currentNeoBlock.blocks[index];
    const roleIndices = currentNeoBlock.blocks
      .map((block: UMGBlock, blockIndex: number) => block.role === currentBlock.role ? blockIndex : -1)
      .filter((blockIndex: number) => blockIndex >= 0);
    const roleIndex = roleIndices.indexOf(index);
    const targetIndex = direction === 'up' ? roleIndices[roleIndex - 1] : roleIndices[roleIndex + 1];
    if (targetIndex === undefined) {
      setStatus(`cannot move ${currentBlock.title} ${direction} outside the ${labelDisplayType(currentBlock.role)} section`);
      return;
    }
    updateCurrentNeoBlock((neoblock) => {
      const nextBlocks = [...neoblock.blocks];
      [nextBlocks[index], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[index]];
      return { ...neoblock, blocks: nextBlocks };
    }, currentBlock.id);
    setStatus(`moved ${currentBlock.title} ${direction} within ${labelDisplayType(currentBlock.role)}`);
    setBuilderFeedback(`Moved ${currentBlock.title} ${direction} in ${labelDisplayType(currentBlock.role)}.`, currentBlock.id, direction === 'up' ? 'Moved up' : 'Moved down');
  };

  const openBuilderEdit = (blockId: string) => {
    if (!currentNeoBlock) return;
    const block = currentNeoBlock.blocks.find((entry: UMGBlock) => entry.id === blockId);
    if (!block) return;
    setEditingMoltId(block.id);
    setEditingMoltDraft({
      title: block.title,
      category: block.category ?? '',
      tagsText: block.tags.join(', '),
      content: block.content
    });
    focusBuilderBlock(block.id);
    setStatus(`editing ${block.title}`);
    setBuilderFeedback(`Editing ${block.title}.`, block.id, 'Editing');
  };

  const saveBuilderEdit = () => {
    if (!currentNeoBlock || !editingMoltId || !editingMoltDraft) return;
    const sourceBlock = currentNeoBlock.blocks.find((entry: UMGBlock) => entry.id === editingMoltId);
    if (!sourceBlock) return;
    const nextTitle = editingMoltDraft.title.trim() || sourceBlock.title;
    const nextCategory = editingMoltDraft.category.trim();
    const nextTags = editingMoltDraft.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean);
    const nextContent = editingMoltDraft.content;
    const nextBlock = {
      ...sourceBlock,
      title: nextTitle,
      category: nextCategory || undefined,
      tags: nextTags,
      content: nextContent
    };
    updateCurrentNeoBlock((neoblock) => ({
      ...neoblock,
      blocks: neoblock.blocks.map((entry: UMGBlock) => entry.id === editingMoltId ? nextBlock : entry)
    }), editingMoltId);
    setInspected(nextBlock);
    setEditingMoltId(undefined);
    setEditingMoltDraft(undefined);
    setStatus(`saved edits to ${nextTitle}`);
    setBuilderFeedback(`Saved edits to ${nextTitle}.`, editingMoltId, 'Saved');
  };

  const cancelBuilderEdit = () => {
    setEditingMoltId(undefined);
    setEditingMoltDraft(undefined);
    setStatus('edit canceled');
    setBuilderFeedback('Edit canceled.', undefined, undefined);
  };

  const duplicateBuilderBlock = (blockId: string) => {
    if (!currentNeoBlock) return;
    const sourceBlock = currentNeoBlock.blocks.find((block: UMGBlock) => block.id === blockId);
    if (!sourceBlock) return;
    const duplicate = structuredClone(sourceBlock);
    duplicate.id = createLocalId('molt_block');
    duplicate.sourceLayer = 'workspace';
    duplicate.source = { origin: 'workspace', sourceId: sourceBlock.id, version: '0.1' };
    updateCurrentNeoBlock((neoblock) => {
      const nextBlocks = [...neoblock.blocks];
      const roleIndices = nextBlocks
        .map((block: UMGBlock, index: number) => block.role === sourceBlock.role ? index : -1)
        .filter((index: number) => index >= 0);
      const insertAt = (roleIndices[roleIndices.length - 1] ?? nextBlocks.length - 1) + 1;
      nextBlocks.splice(insertAt, 0, duplicate);
      return { ...neoblock, blocks: nextBlocks };
    }, duplicate.id);
    setStatus(`duplicated ${sourceBlock.title} to bottom of ${labelDisplayType(sourceBlock.role)}`);
    setBuilderFeedback(`Duplicated ${sourceBlock.title} inside current NeoBlock.`, duplicate.id, 'Duplicated');
  };

  const saveBuilderBlockToLocalLibrary = (blockId: string) => {
    if (!currentNeoBlock) return setStatus('select a NeoBlock first');
    const sourceBlock = currentNeoBlock.blocks.find((entry: UMGBlock) => entry.id === blockId);
    if (!sourceBlock) return setStatus('select a MOLT block first');
    const savedBlock = structuredClone(sourceBlock);
    savedBlock.id = createLocalId('local_molt');
    savedBlock.sourceLayer = 'local';
    savedBlock.source = { origin: 'workspace', sourceId: sourceBlock.id, version: '0.1' };
    setSessionMoltBlocks((current) => [...current, savedBlock]);
    setActiveShelf('molt_blocks');
    setRoleFilter(sourceBlock.role);
    setStatus(`saved ${sourceBlock.title} to local MOLT library`);
    setBuilderFeedback(`Saved ${sourceBlock.title} to session shelf. Source library unchanged.`, blockId, 'Saved to shelf');
  };

  const removeBuilderBlock = (blockId: string) => {
    if (!currentNeoBlock) return;
    const block = currentNeoBlock.blocks.find((entry: UMGBlock) => entry.id === blockId);
    if (!block) return;
    updateCurrentNeoBlock((neoblock) => ({ ...neoblock, blocks: neoblock.blocks.filter((entry: UMGBlock) => entry.id !== blockId) }), currentNeoBlock.id);
    if (editingMoltId === blockId) {
      setEditingMoltId(undefined);
      setEditingMoltDraft(undefined);
    }
    setStatus(`removed ${block.title} from ${currentNeoBlock.title}`);
    setBuilderFeedback(`Removed ${block.title} from current NeoBlock.`);
  };

  const focusBuilderBlock = (blockId: string) => {
    const block = currentNeoBlock?.blocks.find((entry: UMGBlock) => entry.id === blockId);
    const node = graph?.nodes.find((candidate) => candidate.sourceId === blockId || candidate.id === blockId);
    if (node) {
      setSelected(node);
    }
    if (block) {
      setInspected(block);
    } else if (!node) {
      setInspected(undefined);
    }
    setInspectorTab('Card');
  };

  const focusNeoBlockCard = (neoblockId: string) => {
    const node = graph?.nodes.find((candidate) => candidate.nodeType === 'neoblock' && (candidate.sourceId === neoblockId || candidate.id === neoblockId));
    if (node) {
      setSelected(node);
      setInspected(undefined);
      return;
    }
    const neoblock = activeSleeve ? findNeoBlockInSleeve(activeSleeve, neoblockId) : undefined;
    if (neoblock) {
      setChosenTargets((current) => ({ ...current, neoblockId: neoblock.id }));
      setInspected(undefined);
    }
  };

  const beginNeoStackLayoutEdit = () => {
    if (!currentNeoStack) return;
    setDraftNeoStackSegment(buildNeoStackLayoutDraft(currentNeoStack));
    setEditingNeoStackLayoutId(currentNeoStack.id);
    setIsEditingNeoStackLayout(true);
    setNeoStackLayoutNotice(`Editing layout draft for ${currentNeoStack.title}. Add NeoBlock to Layer targets the selected layer now; future library insert actions will use it too.`);
  };

  const saveNeoStackLayout = () => {
    if (!currentNeoStack || !draftNeoStackSegment || editingNeoStackLayoutId !== currentNeoStack.id) {
      setNeoStackLayoutNotice('Layout save blocked because no active draft is available.');
      return;
    }
    if (draftNeoStackSegment.ownerScopeId !== currentNeoStack.id || draftNeoStackSegment.ownerScopeKind !== 'neostack') {
      setNeoStackLayoutNotice('Layout save blocked because the draft does not match the active NeoStack.');
      return;
    }
    setIsEditingNeoStackLayout(false);
    setEditingNeoStackLayoutId(undefined);
    setDraftNeoStackSegment(undefined);
    updateCurrentNeoStack((neostack) => ({
      ...neostack,
      segmentLayout: structuredClone(draftNeoStackSegment)
    }), currentNeoStack.id);
    setNeoStackLayoutNotice(`Layout saved for ${currentNeoStack.title}.`);
  };

  const cancelNeoStackLayoutEdit = () => {
    setIsEditingNeoStackLayout(false);
    setEditingNeoStackLayoutId(undefined);
    setDraftNeoStackSegment(undefined);
    setNeoStackLayoutNotice('Layout changes canceled.');
  };

  const resetNeoStackLayoutDraft = () => {
    if (!currentNeoStack || !isEditingNeoStackLayout) return;
    setDraftNeoStackSegment(buildDefaultSegmentForScope(normalizeNeoStack(currentNeoStack)));
    setNeoStackLayoutNotice('Layout reset to default projection.');
  };

  const compose = () => {
    const composition = composeBlocks({ freeform_request: request, target_type: target as any, depth }, libraryWithStatus);

    const nextWorkspace: UMGWorkspace = { id: 'ws_local', title: 'Local UMG Workspace', activeSleeveId: composition.draft_sleeve.id, sleeves: [composition.draft_sleeve], libraryRefs: libraryWithStatus.map((block) => block.id), graph: buildGraphFromSleeve(composition.draft_sleeve) };
    setWorkspace(nextWorkspace);
    setCompiled(undefined);
    setSelected(undefined);
    setPendingTargetItem(undefined);
    setChosenTargets({});
    setStatus(`composed ${nextWorkspace.graph.nodes.length} nodes with ${composition.warnings.length} warnings`);
  };

  const compile = () => {
    if (!workspace) return setStatus('compose a workspace first');
    const result = compileWorkspaceToRuntime(workspace, { tags: request.toLowerCase().split(/\W+/).filter(Boolean) });
    const nextWorkspace = { ...workspace, graph: applyCompileResultToGraph(workspace.graph, result), runtime: { id: `run_${Date.now()}`, request, activeSleeveId: workspace.sleeves[0].id, runtimeSpec: result.runtimeSpec, trace: result.trace, irMatrix: result.irMatrix, compiledPrompt: result.promptPreview, diagnostics: result.diagnostics } };
    setWorkspace(nextWorkspace);
    setCompiled(result);
    setStatus(`compiled with ${result.diagnostics.length} diagnostics; RuntimeSpec source ${(result.runtimeSpec as any).source ?? 'unknown'}`);
  };

  const inspectAsset = (item: ShelfAsset) => {
    setInspected(item.asset);
    setInspectorTab('Card');
  };

  const setActivePlacementChoice = (choice: PlacementTargetChoice) => {
    setChosenTargets((current) => ({
      neostackId: choice.neostackId ?? current.neostackId,
      neoblockId: choice.neoblockId ?? current.neoblockId
    }));
  };

  const cloneWorkspaceBlock = (block: UMGBlock) => {
    const nextBlock = structuredClone(block);
    nextBlock.id = `${block.id}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    nextBlock.source = { origin: 'workspace', sourceId: block.id, version: '0.1' };
    return nextBlock;
  };

  const cloneWorkspaceNeoBlock = (neoblock: NeoBlock) => {
    const nextNeoBlock = structuredClone(neoblock);
    nextNeoBlock.id = `${neoblock.id}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    nextNeoBlock.blocks = nextNeoBlock.blocks.map((block) => cloneWorkspaceBlock(block));
    return nextNeoBlock;
  };

  const cloneWorkspaceNeoStack = (neostack: NeoStack) => {
    const nextNeoStack = structuredClone(neostack);
    nextNeoStack.id = `${neostack.id}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    nextNeoStack.neoblocks = nextNeoStack.neoblocks.map((neoblock) => cloneWorkspaceNeoBlock(neoblock));
    nextNeoStack.directBlocks = nextNeoStack.directBlocks?.map((block) => cloneWorkspaceBlock(block));
    return nextNeoStack;
  };

  const createLocalId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const nextUniqueHierarchyTitle = (prefix: 'NeoStack' | 'NeoBlock', existingTitles: string[]) => {
    const usedTitles = new Set(existingTitles.map((title) => title.trim().toLowerCase()));
    let index = 1;
    while (usedTitles.has(`${prefix} ${index}`.toLowerCase())) index += 1;
    return `${prefix} ${index}`;
  };

  const createBlankSleeve = () => {
    const nextSleeve: Sleeve = {
      id: createLocalId('sleeve'),
      title: 'Untitled Sleeve',
      type: 'sleeve',
      version: '0.1',
      description: 'Universal blank workspace Sleeve',
      tags: ['local', 'session', 'blank', 'universal'],
      stacks: [],
      runtimeConfig: {
        active: true,
        depth,
        hermesEnabled: true,
        runtimeAdaptation: true,
        showRuntimeTrace: true
      },
      metadata: {
        author: 'local-session',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    const nextWorkspace: UMGWorkspace = {
      id: createLocalId('ws'),
      title: 'Untitled UMG Workspace',
      activeSleeveId: nextSleeve.id,
      sleeves: [nextSleeve],
      libraryRefs: [],
      graph: buildGraphFromSleeve(nextSleeve)
    };
    setWorkspace(nextWorkspace);
    setCompiled(undefined);
    setSelected(undefined);
    setPendingTargetItem(undefined);
    setChosenTargets({});
    setInspected(undefined);
    setGraphViewMode('full_sleeve');
    setStatus(`created blank Sleeve ${nextSleeve.title}`);
  };

  const createNewNeoStack = () => {
    if (!activeSleeve) return setStatus('create a blank Sleeve first');
    const nextSleeve = structuredClone(activeSleeve);
    const title = nextUniqueHierarchyTitle('NeoStack', nextSleeve.stacks.map((stack) => stack.title));
    const nextNeoStack: NeoStack = {
      id: createLocalId('neostack'),
      title,
      type: 'neostack',
      description: 'Local workspace NeoStack',
      tags: ['local', 'session'],
      neoblocks: [],
      directBlocks: [],
      defaultState: 'on',
      compileStrategy: 'role_then_priority'
    };
    nextSleeve.stacks.push(nextNeoStack);
    setChosenTargets({ neostackId: nextNeoStack.id, neoblockId: undefined });
    replaceActiveSleeve(nextSleeve, nextNeoStack.id);
    setGraphViewMode('full_sleeve');
    setStatus(`created ${title} in Sleeve ${nextSleeve.title}`);
  };

  const createNewNeoBlock = () => {
    if (!activeSleeve || !currentNeoStack) return setStatus('select or create a NeoStack first');
    if (!selectedNeoStackRowId || !selectedNeoStackRow) {
      setStatus('select a layer before adding a NeoBlock');
      setNeoStackLayoutNotice('Select a layer before adding a NeoBlock.');
      return;
    }
    const nextSleeve = structuredClone(activeSleeve);
    const targetNeoStack = nextSleeve.stacks.find((stack) => stack.id === currentNeoStack.id);
    if (!targetNeoStack) return setStatus('active NeoStack is unavailable');
    const title = nextUniqueHierarchyTitle('NeoBlock', targetNeoStack.neoblocks.map((neoblock) => neoblock.title));
    const nextNeoBlock: NeoBlock = {
      id: createLocalId('neoblock'),
      title,
      type: 'neoblock',
      description: 'Local workspace NeoBlock',
      tags: ['local', 'session'],
      blocks: [],
      defaultState: 'on'
    };
    targetNeoStack.neoblocks.push(nextNeoBlock);

    const seededScopeSegment = buildDefaultSegmentForScope(normalizeNeoStack(targetNeoStack));
    const baseSegment = cloneSegmentLayout(targetNeoStack.segmentLayout ?? seededScopeSegment);
    targetNeoStack.segmentLayout = ensureSegmentChildPlacement(baseSegment, seededScopeSegment, nextNeoBlock.id, selectedNeoStackRowId);
    const targetLayerLabel = segmentLayerDisplayLabel(selectedNeoStackRow);

    setChosenTargets({ neostackId: targetNeoStack.id, neoblockId: nextNeoBlock.id });
    replaceActiveSleeve(nextSleeve, nextNeoBlock.id);
    setGraphViewMode('neostack');
    setStatus(`created ${title} in ${targetLayerLabel}`);
    setNeoStackLayoutNotice(`Added ${title} to ${targetLayerLabel}. Layout updated locally.`);
  };

  const saveCurrentNeoBlockToLocalLibrary = () => {
    if (!currentNeoBlock) return setStatus('select a NeoBlock first');
    const savedNeoBlock = structuredClone(currentNeoBlock) as NeoBlock & { sourceLayer?: string };
    savedNeoBlock.id = createLocalId('local_neoblock');
    savedNeoBlock.sourceLayer = 'local';
    setSessionNeoBlocks((current) => [...current, savedNeoBlock]);
    setActiveShelf('neoblocks');
    setStatus(`saved NeoBlock ${currentNeoBlock.title} to local library`);
  };

  const saveCurrentNeoStackToLocalLibrary = () => {
    if (!currentNeoStack) return setStatus('select a NeoStack first');
    const savedNeoStack = structuredClone(currentNeoStack) as NeoStack & { sourceLayer?: string };
    savedNeoStack.id = createLocalId('local_neostack');
    savedNeoStack.sourceLayer = 'local';
    setSessionNeoStacks((current) => [...current, savedNeoStack]);
    setActiveShelf('neostacks');
    setStatus(`saved NeoStack ${currentNeoStack.title} to local library`);
  };

  const addActionLabel = (item: ShelfAsset) => {
    if (item.kind === 'trigger_gate_source') return 'Attach Gate';
    if (item.kind === 'sleeve') return 'Open Sleeve';
    if (item.kind === 'neostack') return workspace ? 'Add to Sleeve' : 'Add to Workspace';
    if (item.kind === 'neoblock') return activeTargetNeoStack ? 'Add to NeoStack' : 'Choose Target...';
    if (item.kind === 'molt_block') return activeTargetNeoBlock ? 'Add to NeoBlock' : 'Choose Target...';
    return 'Add to Workspace';
  };

  const addAsset = (item: ShelfAsset, targetIds: PlacementTargetIds = {}) => {
    if (item.kind === 'source_asset') {
      setInspected(item.asset);
      setInspectorTab('Legacy Source');
      return;
    }
    if (item.kind === 'trigger_gate_source') {
      const card = item.asset as TriggerGateSourceCard;
      setInspected(card);
      setInspectorTab('Attach / Placement Preview');
      if (!workspace) return setStatus('compose a workspace before attaching TriggerGate source cards');
      if (!selected) return setStatus('select a graph node before attaching a TriggerGate source card');
      const gate = buildRuntimeGateFromSourceCard(card, { id: `gate_${card.id.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}` });
      const attached = attachRuntimeGateToGraph(workspace.graph, gate, { kind: 'node_boundary', nodeId: selected.id }, workspace.runtimeGates ?? []);
      setWorkspace({ ...workspace, graph: attached.graph, runtimeGates: attached.runtimeGates });
      setCompiled(undefined);
      setSelected(attached.graph.nodes.find((node) => node.id === selected.id));
      setStatus(`gate attached as candidate control geometry on ${selected.label}: ${card.id}; not evaluated, not prompt content, no live execution`);
      return;
    }
    if (item.kind === 'sleeve') {
      const sleeve = structuredClone(item.asset as Sleeve);
      const nextWorkspace: UMGWorkspace = { id: `ws_${sleeve.id}`, title: sleeve.title, activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
      setWorkspace(nextWorkspace);
      setCompiled(undefined);
      setPendingTargetItem(undefined);
      setChosenTargets({});
      setSelected(undefined);
      setStatus(`opened Sleeve ${item.title}`);
      return;
    }
    if (!workspace || !activeSleeve) return setStatus('compose a workspace first');
    const sleeve = structuredClone(activeSleeve);

    if (item.kind === 'molt_block') {
      const targetNeoBlockId = targetIds.neoblockId ?? activeTargetNeoBlock?.id;
      const targetNeoBlock = targetNeoBlockId ? findNeoBlockInSleeve(sleeve, targetNeoBlockId) : undefined;
      if (!targetNeoBlock) {
        setPendingTargetItem(item);
        return setStatus('Select a NeoBlock first or choose a target.');
      }
      const block = cloneWorkspaceBlock(item.asset as UMGBlock);
      sleeve.stacks = sleeve.stacks.map((stack) => ({
        ...stack,
        neoblocks: stack.neoblocks.map((neoblock) => neoblock.id === targetNeoBlock.id ? { ...neoblock, blocks: [...neoblock.blocks, block] } : neoblock)
      }));
      setActivePlacementChoice({ id: targetNeoBlock.id, label: targetNeoBlock.title, neoblockId: targetNeoBlock.id, neostackId: findParentStackForNeoBlock(sleeve, targetNeoBlock.id)?.id });
      setPendingTargetItem(undefined);
      replaceActiveSleeve(sleeve, block.id);
      setStatus(`added MOLT block ${item.title} to NeoBlock ${targetNeoBlock.title}`);
      return;
    }

    if (item.kind === 'neoblock') {
      const targetNeoStackId = targetIds.neostackId ?? activeTargetNeoStack?.id;
      const targetNeoStack = targetNeoStackId ? sleeve.stacks.find((stack) => stack.id === targetNeoStackId) : undefined;
      if (!targetNeoStack) {
        setPendingTargetItem(item);
        return setStatus('Select a NeoStack first or choose a target.');
      }
      const nextNeoBlock = cloneWorkspaceNeoBlock(item.asset as NeoBlock);
      sleeve.stacks = sleeve.stacks.map((stack) => stack.id === targetNeoStack.id ? { ...stack, neoblocks: [...stack.neoblocks, nextNeoBlock] } : stack);
      setActivePlacementChoice({ id: nextNeoBlock.id, label: nextNeoBlock.title, neoblockId: nextNeoBlock.id, neostackId: targetNeoStack.id });
      setPendingTargetItem(undefined);
      replaceActiveSleeve(sleeve, nextNeoBlock.id);
      setStatus(`added NeoBlock ${item.title} to NeoStack ${targetNeoStack.title}`);
      return;
    }

    if (item.kind === 'neostack') {
      const nextNeoStack = cloneWorkspaceNeoStack(item.asset as NeoStack);
      sleeve.stacks.push(nextNeoStack);
      setChosenTargets((current) => ({ ...current, neostackId: nextNeoStack.id }));
      setPendingTargetItem(undefined);
      replaceActiveSleeve(sleeve, nextNeoStack.id);
      setStatus(`added NeoStack ${item.title} to Sleeve ${sleeve.title}`);
    }
  };

  const requestAddAsset = (item: ShelfAsset) => {
    if (item.kind === 'molt_block' && !activeTargetNeoBlock) {
      setPendingTargetItem(item);
      setStatus('Select a NeoBlock first or choose a target.');
      return;
    }
    if (item.kind === 'neoblock' && !activeTargetNeoStack) {
      setPendingTargetItem(item);
      setStatus('Select a NeoStack first or choose a target.');
      return;
    }
    addAsset(item);
  };

  const detachGateGeometry = (gateId: string) => {
    if (!activeSleeve || !workspace) return;
    const remainingRuntimeGates = (workspace.runtimeGates ?? []).filter((gate) => gate.id !== gateId);
    replaceActiveSleeve(structuredClone(activeSleeve), selected?.sourceId, remainingRuntimeGates);
    setStatus(`detached gate geometry ${gateId}`);
  };

  const removeSelectedFromWorkspace = () => {
    if (!selected || !activeSleeve) return;
    if (selected.nodeType === 'sleeve') {
      setStatus('cannot remove the Sleeve root from this workspace');
      return;
    }
    if (selected.nodeType === 'molt_block') {
      const parentNeoBlock = findParentNeoBlockForBlock(activeSleeve, selected.sourceId);
      if (!parentNeoBlock) return setStatus('selected MOLT is not inside a NeoBlock');
      const nextSleeve = structuredClone(activeSleeve);
      nextSleeve.stacks = nextSleeve.stacks.map((stack) => ({
        ...stack,
        neoblocks: stack.neoblocks.map((neoblock) => neoblock.id === parentNeoBlock.id ? { ...neoblock, blocks: neoblock.blocks.filter((block) => block.id !== selected.sourceId) } : neoblock)
      }));
      setChosenTargets((current) => ({ ...current, neoblockId: parentNeoBlock.id, neostackId: findParentStackForNeoBlock(nextSleeve, parentNeoBlock.id)?.id ?? current.neostackId }));
      replaceActiveSleeve(nextSleeve, parentNeoBlock.id);
      setStatus(`removed ${selected.label} from NeoBlock ${parentNeoBlock.title}`);
      return;
    }
    if (selected.nodeType === 'neoblock') {
      const parentNeoStack = findParentStackForNeoBlock(activeSleeve, selected.sourceId);
      if (!parentNeoStack) return setStatus('selected NeoBlock is not inside a NeoStack');
      const nextSleeve = structuredClone(activeSleeve);
      nextSleeve.stacks = nextSleeve.stacks.map((stack) => stack.id === parentNeoStack.id ? { ...stack, neoblocks: stack.neoblocks.filter((neoblock) => neoblock.id !== selected.sourceId) } : stack);
      setChosenTargets((current) => ({ ...current, neoblockId: current.neoblockId === selected.sourceId ? undefined : current.neoblockId }));
      replaceActiveSleeve(nextSleeve, parentNeoStack.id);
      setStatus(`removed ${selected.label} from NeoStack ${parentNeoStack.title}`);
      return;
    }
    if (selected.nodeType === 'neostack') {
      const nextSleeve = structuredClone(activeSleeve);
      nextSleeve.stacks = nextSleeve.stacks.filter((stack) => stack.id !== selected.sourceId);
      setChosenTargets((current) => ({
        neostackId: current.neostackId === selected.sourceId ? undefined : current.neostackId,
        neoblockId: current.neoblockId && activeSleeve.stacks.some((stack) => stack.id === selected.sourceId && stack.neoblocks.some((neoblock) => neoblock.id === current.neoblockId)) ? undefined : current.neoblockId
      }));
      replaceActiveSleeve(nextSleeve, nextSleeve.id);
      setStatus(`removed ${selected.label} from Sleeve ${activeSleeve.title}`);
      return;
    }
    setStatus(`remove is not available for ${labelDisplayType(selected.nodeType)}`);
  };

  const toggleSelected = () => {
    if (!workspace || !selected || !activeSleeve) return;
    const sleeve = structuredClone(activeSleeve);
    sleeve.stacks.forEach((stack) => stack.neoblocks.forEach((nb) => nb.blocks.forEach((block) => {
      if (block.id === selected.sourceId) block.defaultState = block.defaultState === 'off' ? 'on' : 'off';
    })));
    replaceActiveSleeve(sleeve, selected.sourceId);
    setStatus(`toggled ${selected.label}`);
  };

  const generate = async () => {
    setRuntimeTab('Output');
    if (!compiled) {
      const result = buildLocalGenerateFallback({ userRequest: request, workspace, compiled });
      setOutput(result.output);
      return setStatus(result.status);
    }
    if (!config.endpoint) {
      const result = buildLocalGenerateFallback({ userRequest: request, workspace, compiled });
      setOutput(result.output);
      return setStatus(result.status);
    }
    setStatus(endpointMode === 'legacy' ? 'Generating with legacy Hermes endpoint…' : 'Generating with Hermes bridge…');
    try {
      const result = await generateWithHermesEndpoint({ userRequest: request, workspace, compiled, config, endpointMode });
      setOutput(result.output);
      setStatus(result.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOutput(`Hermes generation failed: ${message}`);
      setStatus('Hermes generation failed');
    }
  };

  const resolveGraphNodeById = (graph: UMGWorkspace['graph'], nodeId: string) => graph.nodes.find((candidate) => candidate.id === nodeId || candidate.sourceId === nodeId);

  const getContainmentDescendants = (graph: UMGWorkspace['graph'], parentId: string, visited = new Set<string>()) => {
    graph.edges.forEach((edge) => {
      if (edge.type === 'contains' && edge.source === parentId && !visited.has(edge.target)) {
        visited.add(edge.target);
        getContainmentDescendants(graph, edge.target, visited);
      }
    });
    return visited;
  };

  const moveContainedSubtree = (graph: UMGWorkspace['graph'], sourceNodeId: string, x: number, y: number) => {
    const source = graph.nodes.find((node) => node.id === sourceNodeId);
    if (!source) return graph;
    const descendants = getContainmentDescendants(graph, source.id);
    const dx = x - source.position.x;
    const dy = y - source.position.y;

    const withManualLayout = (node: GraphNode, nextX: number, nextY: number): GraphNode => ({
      ...node,
      position: { x: nextX, y: nextY },
      layout: {
        ...node.layout,
        manual: true,
        manualOverride: true,
        relation: 'contains',
        x: nextX,
        y: nextY
      }
    });

    const newNodes = graph.nodes.map((node) => {
      if (node.id === source.id) {
        return withManualLayout(node, x, y);
      }
      if (!descendants.has(node.id)) return node;
      return withManualLayout(node, node.position.x + dx, node.position.y + dy);
    });
    return { ...graph, nodes: newNodes };
  };

  const canSnapAsChild = (child: GraphNode, target: GraphNode) => {
    if (child.id === target.id) return false;

    if (child.nodeType === 'molt_block') {
      if (target.nodeType === 'neoblock') return true;
      return false;
    }

    if (child.nodeType === 'neoblock') {
      return target.nodeType === 'neostack';
    }

    if (child.nodeType === 'neostack') {
      return target.nodeType === 'sleeve';
    }

    // Trigger gates are prompt boundaries only and are not valid prompt children in drag/drop.
    if (child.nodeType === 'gate') {
      return false;
    }

    return false;
  };

  const updateNodePosition = (nodeId: string, x: number, y: number) => {
    if (!workspace) return;
    setWorkspace((previous) => {
      if (!previous) return previous;
      const nextGraph = moveContainedSubtree(previous.graph, nodeId, x, y);
      return { ...previous, graph: nextGraph };
    });
    setCompiled(undefined);
  };

  const applyDropContainment = (nodeSourceId: string, x: number, y: number, targetSourceId?: string) => {
    if (!workspace) return;
    setWorkspace((previous) => {
      if (!previous) return previous;
      if (!targetSourceId) {
        const updatedGraph = applyManualLayout(previous.graph, nodeSourceId, {
          x,
          y,
          relation: 'contains',
          snapTargetId: undefined,
          snapGroupId: undefined
        }) as UMGWorkspace['graph'];
        return { ...previous, graph: updatedGraph };
      }

      const source = resolveGraphNodeById(previous.graph, nodeSourceId);
      const target = resolveGraphNodeById(previous.graph, targetSourceId);
      if (!source || !target || !canSnapAsChild(source, target)) {
        return previous;
      }

      const updatedGraph = applyContainmentSnap(previous.graph, source.sourceId, target.sourceId) as UMGWorkspace['graph'];
      return {
        ...previous,
        graph: updatedGraph
      };
    });
    setCompiled(undefined);
  };

  const exportWorkspaceJson = () => workspace && downloadJson('umg-workspace.json', workspace);
  const exportSleeveJson = () => workspace && workspace.sleeves[0] && downloadJson('sleeve.json', workspace.sleeves[0]);
  const exportIrJson = () => compiled && downloadJson('ir-matrix.json', compiled.irMatrix);
  const exportGlyphMatrixJson = () => compiled && fullGlyphMatrix && downloadJson('glyph-matrix.json', fullGlyphMatrix);
  const exportHermesPacketJson = () => compiled && downloadJson('hermes-packet.json', exportHermesPacket(request, compiled, config));

  return <div className="app">
    <header>
      <div><b>UMG Studio v0.1</b><span>local graph cognition studio</span></div>
      <nav className="modeTabs" aria-label="Workbench mode">
        <button className={workspaceMode === 'compose' ? 'hot' : ''} onClick={() => setWorkspaceMode('compose')}>Compose</button>
        <button className={workspaceMode === 'canvas' ? 'hot' : ''} onClick={() => setWorkspaceMode('canvas')}>Canvas</button>
        <button className={workspaceMode === 'runtime' ? 'hot' : ''} onClick={() => setWorkspaceMode('runtime')}>Runtime</button>
      </nav>
    </header>
    <main className={classes} style={layoutStyle}>
      <section className={`compose card ${workspaceMode === 'compose' ? '' : 'modeHidden'}`}>
        <h2>Compose</h2>
        <textarea value={request} onChange={(event) => setRequest(event.target.value)} />
        <div className="row">
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="chatbot">Chatbot</option>
            <option value="business_template">Business Template</option>
            <option value="website_prompt">Website Prompt</option>
            <option value="umg_sleeve">UMG Sleeve</option>
          </select>
          <select value={depth} onChange={(event) => setDepth(event.target.value as any)}>
            <option>lean</option>
            <option>balanced</option>
            <option>full</option>
          </select>
          <button className="primary" onClick={compose}>Compose Blocks</button>
          <button onClick={compile}>Compile</button>
          <button onClick={generate}>Generate</button>
        </div>
        <p>{status}</p>
      </section>
      <section className="library card">
        <div className="panelTitle">
          <h2>Library & Control Sources</h2>
          <button onClick={() => setLayout((current) => ({ ...current, leftCollapsed: !current.leftCollapsed }))}>{layout.leftCollapsed ? 'Expand' : 'Collapse'}</button>
        </div>
        <ShelfControls
          shelves={shelves}
          activeShelf={activeShelf}
          setActiveShelf={(shelf: ShelfMode) => {
            setActiveShelf(shelf);
            setTagFilters([]);
          }}
          search={search}
          setSearch={setSearch}
          tagFilters={tagFilters}
          setTagFilters={setTagFilters}
          visibleTags={visibleTags}
          filtered={Boolean(search || tagFilters.length || roleFilter !== 'all' || statusFilter !== defaultStatusFilter)}
          shown={visibleItems.length}
          total={resolvedShelf.items.length}
          roleFilter={roleFilter}
          clear={() => {
            setSearch('');
            setTagFilters([]);
            setRoleFilter('all');
            setStatusFilter(defaultStatusFilter);
          }}
        />
        {activeShelf === 'molt_blocks' && <BuilderShelfHeader roleFilter={roleFilter} statusFilter={statusFilter} shown={visibleItems.length} total={resolvedShelf.items.length} triggerGateSourceCount={triggerCategoryCount} promptTriggerCount={promptTriggerCount} aiInstructionCount={libraryWithStatus.filter((block) => block.sourceLayer === 'AI' && block.role === 'instruction').length} aiSubjectCount={libraryWithStatus.filter((block) => block.sourceLayer === 'AI' && block.role === 'subject').length} aiPrimaryCount={libraryWithStatus.filter((block) => block.sourceLayer === 'AI' && block.role === 'primary').length} aiDirectiveCount={libraryWithStatus.filter((block) => block.sourceLayer === 'AI' && block.role === 'directive').length} aiPhilosophyCount={libraryWithStatus.filter((block) => block.sourceLayer === 'AI' && block.role === 'philosophy').length} aiBlueprintCount={libraryWithStatus.filter((block) => block.sourceLayer === 'AI' && block.role === 'blueprint').length} />}
        {activeShelf === 'source_audit' && <AuditShelfBanner total={currentShelf.items.length} />}
        {activeShelf === 'control_sources' && <ControlSourcesBanner total={currentShelf.items.length} />}
        {activeShelf === 'molt_blocks' && <div className="filterGroup"><b>Role filter</b><div className="filterBar roleSubsections"><button className={roleFilter === 'all' ? 'hot roleHot' : ''} onClick={() => setRoleFilter('all')}>All MOLT + Meta ({countForRoleFilter('all')})</button>{roles.map((role) => <button key={role} className={roleFilter === role ? 'hot roleHot' : ''} onClick={() => setRoleFilter(role)}>{labelDisplayType(role)} ({countForRoleFilter(role)})</button>)}<button className={roleFilter === 'meta' ? 'hot metaHot roleHot' : ''} onClick={() => setRoleFilter('meta')}>Meta ({countForRoleFilter('meta')})</button></div></div>}
        {activeShelf === 'molt_blocks' && roleFilter !== 'trigger' && <div className="filterGroup"><b>Status filter</b><div className="filterBar small statusFilters">{statuses.map((s) => <button key={s} className={statusFilter === s ? 'hot' : ''} onClick={() => setStatusFilter(s)}>{s} {String(s === 'all' ? roleFilter === 'all' ? libraryWithStatus.length : countForRoleFilter(roleFilter) : statusCounts[s] ?? 0)}</button>)}</div></div>}
        {activeShelf === 'source_audit' ? <SourceAuditTable items={visibleItems} onInspect={inspectAsset} /> : <><ActiveTargetBanner sleeve={activeSleeve} neostack={activeTargetNeoStack} neoblock={activeTargetNeoBlock} pendingItem={pendingTargetItem} onClearPending={() => setPendingTargetItem(undefined)} onTryRemoveSleeveRoot={() => setStatus('cannot remove the Sleeve root from this workspace')} />{pendingTargetItem && <TargetPickerPanel item={pendingTargetItem} choices={pendingTargetChoices} onChoose={(choice) => { setActivePlacementChoice(choice); addAsset(pendingTargetItem, { neostackId: choice.neostackId, neoblockId: choice.neoblockId }); }} onCancel={() => { setPendingTargetItem(undefined); setStatus('target selection cancelled'); }} />}<AssetCards items={visibleItems} onAdd={requestAddAsset} onInspect={inspectAsset} getAddLabel={addActionLabel} /></>}
        {activeShelf === 'molt_blocks' && <details className="secondaryAudit"><summary>Source Assets / Audit — secondary import accountability</summary><LibraryAudit report={migrationReport as any} />{sections.map((section) => <div key={section.type}>{section.label} ({section.blocks.length})</div>)}</details>}
      </section>
      <div className="split vertical leftSplit" onPointerDown={(event) => startResize('left', event)} role="separator" aria-label="Resize library panel" />
      <section className="graph card">
        <div className="panelTitle">
          <div className="graphControls">
            <h2>Graph Studio</h2>
            <details className="exportMenu">
              <summary>Export ▾</summary>
              <div className="exportMenuPanel">
                <button className="exportMenuAction" disabled={!workspace} onClick={exportSleeveJson}>Sleeve JSON</button>
                <button className="exportMenuAction" disabled={!compiled} onClick={exportIrJson}>IR Matrix</button>
                <button className="exportMenuAction" disabled={!fullGlyphMatrix} onClick={exportGlyphMatrixJson}>Glyph Matrix</button>
                <button className="exportMenuAction" disabled={!compiled} onClick={exportHermesPacketJson}>Hermes Packet</button>
                <button className="exportMenuAction" disabled={!workspace} onClick={exportWorkspaceJson}>Workspace</button>
              </div>
            </details>
            <button className={graphViewMode === 'full_sleeve' ? 'hot' : ''} onClick={() => setGraphViewMode('full_sleeve')}>Full Sleeve</button>
            <button className={graphViewMode === 'neostack' ? 'hot' : ''} onClick={() => setGraphViewMode('neostack')}>NeoStack</button>
            <button className={graphViewMode === 'neoblock' ? 'hot' : ''} onClick={() => setGraphViewMode('neoblock')}>NeoBlock</button>
            <button className={graphViewMode === 'molt_builder' ? 'hot' : ''} onClick={() => setGraphViewMode('molt_builder')}>MOLT Builder</button>
            <button className={showGates ? 'hot' : ''} onClick={() => setShowGates((current) => !current)}>Show Gates</button>
            <button className={focusGraphMode ? 'hot' : ''} onClick={() => focusGraphMode ? exitFocusGraph() : enterFocusGraph()}>{focusGraphMode ? 'Exit Focus' : 'Focus Graph'}</button>
            <button onClick={() => setGraphViewMode('full_sleeve')} className={graphViewMode === 'full_sleeve' ? 'hot' : ''}>Reset View</button>
          </div>
        </div>
        {graphViewMode === 'molt_builder'
          ? <MoltBuilderPanel
            neoblock={currentNeoBlock}
            editingMoltId={editingMoltId}
            editingDraft={editingMoltDraft}
            builderNotice={moltBuilderNotice}
            lastAffectedMoltId={lastAffectedMoltId}
            lastAffectedMoltLabel={lastAffectedMoltLabel}
            onEditingDraftChange={setEditingMoltDraft}
            onAddBlock={() => { setActiveShelf('molt_blocks'); setWorkspaceMode('canvas'); setStatus(currentNeoBlock ? `choose a library card and add it to ${currentNeoBlock.title}` : 'select a NeoBlock or compose a workspace first'); }}
            onEdit={openBuilderEdit}
            onSaveEdit={saveBuilderEdit}
            onCancelEdit={cancelBuilderEdit}
            onDuplicate={duplicateBuilderBlock}
            onSaveAsNew={saveBuilderBlockToLocalLibrary}
            onRemove={removeBuilderBlock}
            onMoveUp={(blockId) => moveBlockWithinRole(blockId, 'up')}
            onMoveDown={(blockId) => moveBlockWithinRole(blockId, 'down')}
          />
          : displayGraph
            ? <>
              {graphViewMode === 'full_sleeve'
                ? <FullSleeveViewSummary sleeve={activeSleeve} displaySleeve={displaySleeve} activeNeoStack={currentNeoStack} onNewNeoStack={createNewNeoStack} />
                : graphViewMode === 'neoblock'
                  ? <NeoBlockViewSummary
                    neoblock={currentNeoBlock}
                    parentStack={currentNeoBlock && activeSleeve ? findParentStackForNeoBlock(activeSleeve, currentNeoBlock.id) : undefined}
                    siblingCount={Math.max(0, (currentNeoStack?.neoblocks.length ?? 0) - 1)}
                    usingFallback={!selectedNeoBlock && Boolean(currentNeoBlock)}
                    onOpenMoltBuilder={() => setGraphViewMode('molt_builder')}
                    onSaveToLibrary={saveCurrentNeoBlockToLocalLibrary}
                  />
                  : <NeoStackViewSummary neostack={currentNeoStack} displayNeoStack={displayNeoStack} displaySegment={activeNeoStackSegment} usingFallback={!selectedNeoStack && Boolean(currentNeoStack)} onNewNeoBlock={createNewNeoBlock} onSaveToLibrary={saveCurrentNeoStackToLocalLibrary} onFocusNeoBlock={focusNeoBlockCard} layoutNotice={neoStackLayoutNotice} selectedLayer={selectedNeoStackRow} onSelectLayer={setSelectedNeoStackRowId} />}
              <Graph nodes={displayGraph.nodes} edges={displayGraph.edges} selected={graphSelectedId} showGates={showGates} viewMode={graphViewMode} onMove={updateNodePosition} onPick={(node) => { setSelected(node); setInspected(undefined); }} onDrop={applyDropContainment} canSnap={(source, target) => canSnapAsChild(source, target)} />
            </>
            : <div className="empty canvasStartEmptyState"><b>Start a UMG Sleeve</b><span>Create a blank Sleeve, start from a template, compose from prompt, or open from library.</span><div className="row"><button className="primary" onClick={createBlankSleeve}>Create Blank Sleeve</button><button disabled title="Planned next pass">Start from Template</button><button disabled title="Use the top composer for now">Compose from Prompt</button><button disabled title="Library picker planned next">Open from Library</button></div></div>}
      </section>
      <div className="split vertical rightSplit" onPointerDown={(event) => startResize('right', event)} role="separator" aria-label="Resize inspector panel" />
      <aside className="inspect card">
        <div className="panelTitle">
          <h2>Inspector / Config</h2>
          <button onClick={() => setLayout((current) => ({ ...current, rightCollapsed: !current.rightCollapsed }))}>{layout.rightCollapsed ? 'Expand' : 'Collapse'}</button>
        </div>
        {selected && <div className="report selectionReport"><span>node {selected.label}</span><span>type {selected.nodeType === 'molt_block' ? (selected.moltRole || 'MOLT') : labelDisplayType(selected.nodeType)}</span><span>active {String(selected.state.active)}</span><span>off {String(selected.state.off)}</span><span>triggered {String(selected.state.triggered)}</span><div className="row"><button onClick={toggleSelected} disabled={selected.nodeType !== 'molt_block'}>Toggle on/off</button><SelectionActions selected={selected} onRemove={removeSelectedFromWorkspace} onDetachGate={detachGateGeometry} /></div></div>}
        <RuntimeGateDebugPanel view={runtimeGateDebugView} />
        <BlockInspector views={inspectorViews} fallback={inspected} activeTab={inspectorTab} setActiveTab={setInspectorTab} />
        <h3>Hermes</h3>
        <div className="report"><span>status {hermesStatus}</span><span>API key redacted: {redactKey(config.apiKey) || 'not set'}</span><span>Exports exclude API keys.</span></div>
        <input placeholder="Hermes endpoint" value={config.endpoint} onChange={(event) => { const endpoint = event.target.value; setConfig({ ...config, endpoint }); setEndpointMode(inferHermesGenerateEndpointMode(endpoint)); }} />
        <input placeholder="API key" type="password" value={config.apiKey ?? ''} onChange={(event) => setConfig({ ...config, apiKey: event.target.value })} />
        <input aria-label="Hermes model" value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} />
        <button onClick={async () => { const result = await testHermesConnection(config); setHermesStatus(result.ok ? 'test passed' : 'test failed'); setStatus(`Hermes ${result.message}`); }}>Test Connection</button>
      </aside>
      <div className="split horizontal bottomSplit" onPointerDown={(event) => startResize('bottom', event)} role="separator" aria-label="Resize runtime drawer" />
      <section className="drawer card">
        <div className="panelTitle">
          <h2>Compiler / Runtime</h2>
          <button onClick={() => setLayout((current) => ({ ...current, bottomCollapsed: !current.bottomCollapsed }))}>{layout.bottomCollapsed ? 'Expand' : 'Collapse'}</button>
        </div>
        <div className="tabs">{runtimeDrawerTabs.map((tab) => <button key={tab} className={runtimeTab === tab ? 'hot' : ''} onClick={() => setRuntimeTab(tab)}>{tab}</button>)}</div>
        <pre className={runtimeTab === 'Glyph Matrix' ? 'glyphMatrixOutput' : undefined}>{renderRuntime(workspace, compiled, output, runtimeTab)}</pre>
      </section>
    </main>
  </div>;
}

function LibraryAudit({ report }: { report: any }) {
  const summary = report.sourceAssetSummary ?? { outcomeCounts: report.outcomeCounts ?? {}, totalScanned: report.totalSourceAssetsScanned, accountedTotal: report.visibleOrAccountedAssets, unaccountedCount: report.unaccountedCount };
  const counts = summary.outcomeCounts ?? {};
  const rows = [
    ['Total source assets scanned', summary.totalScanned], ['Runnable MOLT blocks', counts.runnable_molt ?? 0], ['Meta / non-compiler assets', counts.meta ?? 0], ['NeoBlocks', report.totalNeoBlocksImported ?? 0], ['NeoStacks', report.totalNeoStacksImported ?? 0], ['Sleeves', report.totalSleevesImported ?? 0], ['Skipped assets', counts.skipped ?? 0], ['Duplicate assets', counts.duplicate ?? 0], ['Unsupported assets', counts.unsupported ?? 0], ['Reference-only assets', counts.reference_only ?? 0], ['Missing-field/warning assets', counts.warning ?? 0], ['Unaccounted count', summary.unaccountedCount ?? 0]
  ];
  return <div className="report auditSummary"><b>Library Audit / Source Assets</b>{rows.map(([label, value]) => <span key={String(label)}>{String(label)}: {String(value)}</span>)}<span>reconciled: {String(summary.accountedTotal)}/{String(summary.totalScanned)}</span></div>;
}

function ShelfControls({ shelves, activeShelf, setActiveShelf, search, setSearch, tagFilters, setTagFilters, visibleTags, filtered, shown, total, roleFilter = 'all', clear }: any) {
  const toggleTag = (tag: string) => setTagFilters(tagFilters.includes(tag) ? tagFilters.filter((t: string) => t !== tag) : [...tagFilters, tag]);
  const searchLabel = activeShelf === 'source_audit' ? 'Search audit accountability rows' : activeShelf === 'control_sources' || roleFilter === 'trigger' ? 'Search TriggerGate source cards' : 'Search active builder shelf first';
  return <><div className="shelfTabs">{shelves.map((shelf: any) => <button key={shelf.id} className={activeShelf === shelf.id ? 'hot activeShelfTab' : ''} onClick={() => setActiveShelf(shelf.id)}>{shelf.label} ({shelf.items.length})</button>)}</div><label className="searchLabel">{searchLabel}<input placeholder="title, INST id, tags, sourcePath, role/status" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{filtered && <div className="filterNotice"><b>Filtered view active</b><span>{shown} of {total} shown</span><button onClick={clear}>Clear filters</button></div>}{tagFilters.length > 0 && <div className="activeTags"><b>Active filters</b>{tagFilters.map((tag: string) => <button key={tag} className="tag active" onClick={() => toggleTag(tag)}>{tag} ×</button>)}</div>}<div className="tagCloud">{visibleTags.map((tag: string) => <button key={tag} className={`tag ${tagFilters.includes(tag) ? 'active' : ''}`} onClick={() => toggleTag(tag)}>{tag}</button>)}</div></>;
}

function BuilderShelfHeader({ roleFilter, statusFilter, shown, total, triggerGateSourceCount, promptTriggerCount, aiInstructionCount, aiSubjectCount, aiPrimaryCount, aiDirectiveCount, aiPhilosophyCount, aiBlueprintCount }: { roleFilter: string; statusFilter: string; shown: number; total: number; triggerGateSourceCount: number; promptTriggerCount: number; aiInstructionCount: number; aiSubjectCount: number; aiPrimaryCount: number; aiDirectiveCount: number; aiPhilosophyCount: number; aiBlueprintCount: number }) {
  const roleLabel = labelDisplayType(roleFilter);
  const statusLabel = labelDisplayType(statusFilter);
  const visibleLabel = roleFilter === 'trigger' ? triggerGateCategoryDisplayCopy.visiblePrompt : roleFilter === 'all' ? 'MOLT + Meta cards' : `${roleLabel} cards`;
  return <div className="shelfHero builderHero"><b>Active shelf: MOLT Blocks</b><span>Active role: {roleLabel}</span><span>Active status: {statusLabel}</span><span>{shown} {visibleLabel} visible</span><span>{shown} of {total} visible</span><span>{triggerGateCategoryDisplayCopy.promptTriggerCountLabel}: {promptTriggerCount}</span><span>{triggerGateCategoryDisplayCopy.triggerSourceCardsCountLabel}: {triggerGateSourceCount}</span><span>{triggerGateCategoryDisplayCopy.triggerCardsRoleHint}</span><span>{triggerGateCategoryDisplayCopy.sourceRecordNote}</span><span>AI directive cards available: {aiDirectiveCount}</span><span>AI instruction cards available: {aiInstructionCount}</span><span>AI subject cards available: {aiSubjectCount}</span><span>AI primary cards available: {aiPrimaryCount}</span><span>AI philosophy cards available: {aiPhilosophyCount}</span><span>AI blueprint cards available: {aiBlueprintCount}</span></div>;
}

function AuditShelfBanner({ total }: { total: number }) {
  return <div className="shelfHero auditHero"><b>Source Assets / Audit</b><span>Audit only — not builder shelf</span><span>Import accountability rows: {total}</span><span>Use MOLT Blocks → Instruction for editable builder cards.</span></div>;
}

function ControlSourcesBanner({ total }: { total: number }) {
  return <div className="shelfHero controlHero"><b>Trigger / Gates</b><span>Control Sources: TriggerGate Sources</span><span>TriggerGate Sources: {total}</span><span>{triggerGateCategoryDisplayCopy.sourceRecordNote}</span><span>{triggerGateCategoryDisplayCopy.actualTriggers}</span><span>Attach Gate creates inert control geometry, not MOLT prompt blocks.</span><span>Trigger MOLT remains 0; no live execution.</span></div>;
}

function SourceAuditTable({ items, onInspect }: { items: ShelfAsset[]; onInspect: (item: ShelfAsset) => void }) {
  return <div className="auditTable"><div className="auditHeader"><span>title</span><span>detected type</span><span>role</span><span>outcome</span><span>source / reason</span></div>{items.map((item, index) => { const audit = item.asset as SourceAuditItem; return <div key={`${item.id}:${index}`} className={`auditRow outcome-${audit.outcome}`}><span><b>{audit.title}</b><small>{audit.tags.join(', ') || 'no tags'}</small></span><span>{audit.detectedType}</span><span>{audit.normalizedRole ?? 'n/a'}</span><span className="badge">{audit.outcome}</span><span><code>{audit.sourcePath}</code><small>{audit.reason ?? 'accounted'}</small><button onClick={() => onInspect(item)}>Inspect JSON / Legacy Source</button></span></div>; })}</div>;
}

function ActiveTargetBanner({ sleeve, neostack, neoblock, pendingItem, onClearPending, onTryRemoveSleeveRoot }: { sleeve?: Sleeve; neostack?: NeoStack; neoblock?: NeoBlock; pendingItem?: ShelfAsset; onClearPending: () => void; onTryRemoveSleeveRoot: () => void }) {
  return <div className="report targetContextBanner"><b>Active targets</b><span>Sleeve: {sleeve?.title ?? 'none'}</span><span>NeoStack: {neostack?.title ?? 'none selected'}</span><span>NeoBlock: {neoblock?.title ?? 'none selected'}</span>{sleeve && <span><button onClick={onTryRemoveSleeveRoot}>Try Remove Sleeve Root</button></span>}{pendingItem && <span>Pending: {pendingItem.title} <button onClick={onClearPending}>Clear target request</button></span>}</div>;
}

function TargetPickerPanel({ item, choices, onChoose, onCancel }: { item: ShelfAsset; choices: PlacementTargetChoice[]; onChoose: (choice: PlacementTargetChoice) => void; onCancel: () => void }) {
  return <div className="report targetPicker"><b>Choose target for {item.title}</b>{choices.length === 0 ? <span>No valid targets available yet.</span> : choices.map((choice) => <div key={choice.id} className="targetChoice"><span>{choice.label}</span><small>{choice.detail ?? ''}</small><button onClick={() => onChoose(choice)}>Use target</button></div>)}<div className="row"><button onClick={onCancel}>Cancel</button></div></div>;
}

function FullSleeveViewSummary({ sleeve, displaySleeve, activeNeoStack, onNewNeoStack }: { sleeve?: Sleeve; displaySleeve?: Sleeve; activeNeoStack?: NeoStack; onNewNeoStack: () => void }) {
  if (!sleeve) return <div className="empty">Start a UMG Sleeve by creating a blank Sleeve, then assemble NeoStacks on the canvas.</div>;

  const controller = displaySleeve?.rootController;
  const directiveLabel = controller ? controllerDirectiveLabel(controller) : undefined;
  const directiveCount = controller?.directiveBundle?.directives.length ?? countControllerRole(controller, 'directive');
  const subjectSummary = controller ? summarizeControllerRole(controller, 'subject') : undefined;
  const primarySummary = controller ? summarizeControllerRole(controller, 'primary') : undefined;
  const blueprintSummary = controller ? summarizeControllerRole(controller, 'blueprint') : undefined;
  const controllerRoleCount = controller ? new Set(controller.molts.map((block) => block.role)).size : 0;
  const isVirtualController = controller?.metadata?.createdBy === 'virtual';

  return <div className="report hierarchySummary sleeveRootSummary">
    <div className="sleeveRootSummaryCard">
      <div className="sleeveRootSummaryBadgeRow">
        <span className="badge sleeveRootBadge">Sleeve Root Controller</span>
        {isVirtualController && <span className="badge sleeveRootVirtualBadge">Virtual fallback</span>}
      </div>
      <b>{controller?.title ?? `${sleeve.title} Controller`}</b>
      <span>Root authority for Sleeve scope. Not counted as a NeoStack child.</span>
      <span>Role blocks available: {controller?.molts.length ?? 0} across {controllerRoleCount} role{controllerRoleCount === 1 ? '' : 's'}.</span>
      {subjectSummary && <span>Subject: {subjectSummary}</span>}
      {primarySummary && <span>Primary: {primarySummary}</span>}
      <span>Directive bundle: {directiveLabel ?? 'No directive label available'} · {directiveCount} directive{directiveCount === 1 ? '' : 's'}</span>
      <span>Blueprint: {blueprintSummary ?? `${countControllerRole(controller, 'blueprint')} blueprint block${countControllerRole(controller, 'blueprint') === 1 ? '' : 's'}`}</span>
      {isVirtualController && <small>Display-only compatibility controller derived via normalizeSleeve(). It is not persisted back into workspace state.</small>}
      {!isVirtualController && <small>Controller editing planned. Read-only projection only in this phase.</small>}
    </div>
    <div className="sleeveRootSummaryConnector" aria-hidden="true" />
    <div className="sleeveRootChildArea">
      <b>Full Sleeve view</b>
      <span>Assemble NeoStacks on the canvas here.</span>
      <span>Active Sleeve: {sleeve.title}</span>
      <span>NeoStacks shown: {sleeve.stacks.length}</span>
      <span>Active NeoStack target: {activeNeoStack?.title ?? 'none selected'}</span>
      <div className="row"><button onClick={onNewNeoStack}>Add NeoStack</button><button disabled title="Library picker planned next">Choose NeoStack from Library</button></div>
    </div>
  </div>;
}

function controllerBlocksForRole(controller: UMGControllerBlock | undefined, role: UMGBlock['role']) {
  return controller?.molts.filter((block) => block.role === role) ?? [];
}

function countControllerRole(controller: UMGControllerBlock | undefined, role: UMGBlock['role']) {
  return controllerBlocksForRole(controller, role).length;
}

function summarizeControllerRole(controller: UMGControllerBlock, role: UMGBlock['role']) {
  const block = controllerBlocksForRole(controller, role)[0];
  if (!block) return undefined;
  return summarizeControllerText(block.description || block.content || block.title);
}

function controllerDirectiveLabel(controller: UMGControllerBlock) {
  const activeDirectiveId = controller.directiveBundle?.activeDirectiveId ?? controller.directiveBundle?.defaultDirectiveId;
  if (!activeDirectiveId) return controllerBlocksForRole(controller, 'directive')[0]?.title;
  return controller.molts.find((block) => block.id === activeDirectiveId)?.title
    ?? controller.directiveBundle?.directives.find((directive) => directive.moltId === activeDirectiveId)?.label
    ?? controllerBlocksForRole(controller, 'directive')[0]?.title;
}

function summarizeControllerText(value: string, maxLength = 96) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function NeoStackViewSummary({ neostack, displayNeoStack, displaySegment, usingFallback, onNewNeoBlock, onSaveToLibrary, onFocusNeoBlock, layoutNotice, selectedLayer, onSelectLayer }: { neostack?: NeoStack; displayNeoStack?: NeoStack; displaySegment?: UMGSegmentLayout; usingFallback: boolean; onNewNeoBlock: () => void; onSaveToLibrary: () => void; onFocusNeoBlock: (neoblockId: string) => void; layoutNotice: string; selectedLayer?: { id: string; index: number; label: string }; onSelectLayer: (rowId: string | undefined) => void }) {
  if (!neostack) return <div className="empty">No NeoStack available yet. Create or select a NeoStack first, then assemble NeoBlocks here.</div>;

  const controller = displayNeoStack?.rootController;
  const directiveLabel = controller ? controllerDirectiveLabel(controller) : undefined;
  const directiveCount = controller?.directiveBundle?.directives.length ?? countControllerRole(controller, 'directive');
  const subjectSummary = controller ? summarizeControllerRole(controller, 'subject') : undefined;
  const primarySummary = controller ? summarizeControllerRole(controller, 'primary') : undefined;
  const blueprintSummary = controller ? summarizeControllerRole(controller, 'blueprint') : undefined;
  const controllerRoleCount = controller ? new Set(controller.molts.map((block) => block.role)).size : 0;
  const isVirtualController = controller?.metadata?.createdBy === 'virtual';
  const segmentRows = displaySegment?.rows.filter((row) => row.index > 0) ?? [];
  const neoblockMap = new Map(neostack.neoblocks.map((block) => [block.id, block]));
  const emptyRowLabel = (rowLabel: string) => `No NeoBlocks assigned to ${universalLayerLabel(rowLabel)} yet.`;

  return <div className="report hierarchySummary sleeveRootSummary">
    <div className="sleeveRootSummaryCard">
      <div className="sleeveRootSummaryBadgeRow">
        <span className="badge sleeveRootBadge">NeoStack Root Controller</span>
        <span className="badge segmentRowBadge">Row 0 · Controller</span>
        {isVirtualController && <span className="badge sleeveRootVirtualBadge">Virtual fallback</span>}
      </div>
      <b>{controller?.title ?? `${neostack.title} Controller`}</b>
      <span>Root authority for NeoStack scope. Not counted as a NeoBlock child.</span>
      <span>Role blocks available: {controller?.molts.length ?? 0} across {controllerRoleCount} role{controllerRoleCount === 1 ? '' : 's'}.</span>
      {subjectSummary && <span>Subject: {subjectSummary}</span>}
      {primarySummary && <span>Primary: {primarySummary}</span>}
      <span>Directive bundle: {directiveLabel ?? 'No directive label available'} · {directiveCount} directive{directiveCount === 1 ? '' : 's'}</span>
      <span>Blueprint: {blueprintSummary ?? `${countControllerRole(controller, 'blueprint')} blueprint block${countControllerRole(controller, 'blueprint') === 1 ? '' : 's'}`}</span>
      {isVirtualController && <small>Display-only compatibility controller derived via normalizeNeoStack(). It is not persisted back into workspace state.</small>}
      {!isVirtualController && <small>Controller editing planned. Read-only projection only in this phase.</small>}
    </div>
    <div className="sleeveRootSummaryConnector" aria-hidden="true" />
    <div className="sleeveRootChildArea">
      <b>NeoStack view</b>
      <span>Assemble NeoBlocks on the canvas here.</span>
      <span>Active NeoStack: {neostack.title}{usingFallback ? ' (default first NeoStack)' : ''}</span>
      <span>NeoBlocks shown: {neostack.neoblocks.length}</span>
      <span>MOLT blocks stay in MOLT Builder only.</span>
      <div className="row"><button onClick={onSaveToLibrary}>Save NeoStack to Library</button></div>
      <div className="segmentSlotPreview">
        <div className="segmentLayoutToolbar">
          <small className="segmentLayoutNotice">{layoutNotice}</small>
          <div className="segmentTargetNotice">
            <span className="badge segmentTargetBadge">Target Layer: {selectedLayer ? segmentLayerDisplayLabel(selectedLayer) : 'No editable layer selected'}</span>
            <div className="row">
              <button type="button" onClick={onNewNeoBlock} disabled={!selectedLayer} title="Adds a blank NeoBlock to the selected layer.">Add NeoBlock to Layer</button>
            </div>
            <small>Adds a blank NeoBlock to the selected layer. Layout updates locally. Library insert comes later.</small>
          </div>
        </div>
        <div className="segmentAuthorityHint">Row 0 is the Controller. Layers below are universal UMG depth bands. Click a layer to target direct NeoBlock placement.</div>
        {segmentRows.map((row) => {
          const rowSlots = displaySegment ? getSlotsByRow(displaySegment, row.id) : [];
          const occupiedSlots = rowSlots.filter((slot) => slot.occupantKind === 'scope_child' && slot.occupantId);
          const isSelectedLayer = selectedLayer?.id === row.id;
          return <section
            key={row.id}
            className={`segmentRowBand ${isSelectedLayer ? 'segmentRowBandSelected' : ''}`}
            onClick={() => onSelectLayer(row.id)}
          >
            <div className="segmentRowHeader">
              <span>{segmentLayerDisplayLabel(row)}</span>
              <div className="segmentRowMeta">
                {isSelectedLayer && <span className="badge segmentSelectedBadge">Selected Layer</span>}
                <small>{occupiedSlots.length ? `${occupiedSlots.length} NeoBlock${occupiedSlots.length === 1 ? ' in this row' : 's in this row'}` : emptyRowLabel(row.label)}</small>
              </div>
            </div>
            <div className="segmentSlotGrid">
              {occupiedSlots.length
                ? occupiedSlots.map((slot) => {
                    const neoblock = slot.occupantId ? neoblockMap.get(slot.occupantId) : undefined;
                    if (!neoblock) return <div key={slot.id} className="segmentEmptySlot">Unresolved NeoBlock slot</div>;
                    return <div key={slot.id} className="segmentSlotCard">
                      <button type="button" className="segmentSlotCardButton" onClick={(event) => {
                        event.stopPropagation();
                        onFocusNeoBlock(neoblock.id);
                      }}>
                        <span className="segmentSlotEyebrow">Under Controller</span>
                        <b>{neoblock.title}</b>
                        <small>{neoblock.blocks.length} MOLT block{neoblock.blocks.length === 1 ? '' : 's'}</small>
                      </button>
                    </div>;
                  })
                : <div className="segmentEmptySlot">{emptyRowLabel(row.label)}</div>}
            </div>
          </section>;
        })}
      </div>
    </div>
  </div>;
}

function NeoBlockViewSummary({ neoblock, parentStack, siblingCount, usingFallback, onOpenMoltBuilder, onSaveToLibrary }: { neoblock?: NeoBlock; parentStack?: NeoStack; siblingCount: number; usingFallback: boolean; onOpenMoltBuilder: () => void; onSaveToLibrary: () => void }) {
  if (!neoblock) return <div className="empty">No NeoBlock available yet. Select a NeoBlock or create one from NeoStack view.</div>;
  return <div className="report hierarchySummary"><b>NeoBlock view</b><span>Purpose: Focus the current NeoBlock on the canvas while keeping sibling NeoBlocks visible.</span><span>Active NeoBlock: {neoblock.title}{usingFallback ? ' (default current NeoBlock)' : ''}</span><span>Parent NeoStack: {parentStack?.title ?? 'none'}</span><span>Sibling NeoBlocks visible: {siblingCount}</span><span>Total MOLT blocks: {neoblock.blocks.length} — role details stay in MOLT Builder.</span><div className="row"><button onClick={onOpenMoltBuilder}>Open MOLT Builder</button><button onClick={onSaveToLibrary}>Save NeoBlock to Library</button></div></div>;
}

function SelectionActions({ selected, onRemove, onDetachGate }: { selected: GraphNode; onRemove: () => void; onDetachGate: (gateId: string) => void }) {
  const hasGateGeometry = (selected.governingGateIds ?? []).length > 0;
  return <>{selected.nodeType === 'molt_block' && <button onClick={onRemove}>Remove from NeoBlock</button>}{selected.nodeType === 'neoblock' && <button onClick={onRemove}>Remove from NeoStack</button>}{selected.nodeType === 'neostack' && <button onClick={onRemove}>Remove from Sleeve</button>}{selected.nodeType === 'sleeve' && <button onClick={onRemove}>Removal blocked</button>}{hasGateGeometry && (selected.governingGateIds ?? []).map((gateId) => <button key={gateId} onClick={() => onDetachGate(gateId)}>Detach Gate Geometry</button>)}</>;
}

function AssetCards({ items, onAdd, onInspect, getAddLabel }: { items: ShelfAsset[]; onAdd: (item: ShelfAsset) => void; onInspect: (item: ShelfAsset) => void; getAddLabel: (item: ShelfAsset) => string }) {
  return <div className="cards builderCards">{items.map((item, index) => {
    const block = item.asset as UMGBlock;
    const gateCard = item.asset as TriggerGateSourceCard;
    const isGateSource = item.kind === 'trigger_gate_source';
    const instId = item.kind === 'molt_block' ? block.legacy?.libraryEntryId : isGateSource ? gateCard.id : undefined;
    const category = item.kind === 'molt_block' ? block.category : isGateSource ? `${gateCard.category} / ${gateCard.subcategory}` : undefined;
    return <div key={`${item.id}:${item.sourcePath ?? 'local'}:${index}`} className={`block builderBlock asset-${item.kind} ${item.displayType === 'meta' ? 'metaCard' : ''} ${isGateSource ? 'gateSourceCard' : ''}`}><div className="cardtop"><b>{item.title}</b><span className="badge">{isGateSource ? 'Gt TriggerGate Source' : item.displayType === 'meta' ? 'Meta / non-compiler' : item.kind === 'molt_block' ? 'MOLT Block Card' : item.kind}</span></div>{instId && <p className="instId">ID: {instId}</p>}<p>role: {item.containedRoles.map(labelDisplayType).join(', ') || item.kind}</p>{category && <p>category: {category}</p>}{isGateSource && <p>activation: {gateCard.activation.conditionSummary}</p>}<p>status: {item.status || 'runnable'}</p><small>tags: {item.tags.slice(0, 12).join(', ') || 'no tags'}</small><small>sourcePath: {item.sourcePath ?? 'local asset'}</small><div className="row"><button onClick={() => onAdd(item)}>{getAddLabel(item)}</button><button onClick={() => onInspect(item)}>{isGateSource ? 'Inspect TriggerGate Source' : 'Inspect JSON / Legacy Source'}</button></div></div>;
  })}</div>;
}

function findNeoBlockInSleeve(sleeve: Sleeve, neoblockId: string) {
  for (const stack of sleeve.stacks) {
    const match = stack.neoblocks.find((neoblock) => neoblock.id === neoblockId);
    if (match) return match;
  }
  return undefined;
}

function findParentNeoBlockForBlock(sleeve: Sleeve, blockId: string) {
  for (const stack of sleeve.stacks) {
    for (const neoblock of stack.neoblocks) {
      if (neoblock.blocks.some((block) => block.id === blockId)) return neoblock;
    }
  }
  return undefined;
}

function findParentStackForNeoBlock(sleeve: Sleeve, neoblockId: string) {
  return sleeve.stacks.find((stack) => stack.neoblocks.some((neoblock) => neoblock.id === neoblockId));
}

function findParentStackForBlock(sleeve: Sleeve, blockId: string) {
  return sleeve.stacks.find((stack) => stack.neoblocks.some((neoblock) => neoblock.blocks.some((block) => block.id === blockId)));
}

function builderSectionForBlock(block: UMGBlock) {
  const roleKey = block.displayType === 'meta' ? 'meta_other' : block.role;
  return moltBuilderSections.find((section) => section.key === roleKey) ?? moltBuilderSections[moltBuilderSections.length - 1];
}

function MoltBuilderPanel({
  neoblock,
  editingMoltId,
  editingDraft,
  builderNotice,
  lastAffectedMoltId,
  lastAffectedMoltLabel,
  onEditingDraftChange,
  onAddBlock,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDuplicate,
  onSaveAsNew,
  onRemove,
  onMoveUp,
  onMoveDown
}: {
  neoblock?: NeoBlock;
  editingMoltId?: string;
  editingDraft?: { title: string; category: string; tagsText: string; content: string };
  builderNotice: string;
  lastAffectedMoltId?: string;
  lastAffectedMoltLabel?: string;
  onEditingDraftChange: (updater: { title: string; category: string; tagsText: string; content: string } | ((current: { title: string; category: string; tagsText: string; content: string } | undefined) => { title: string; category: string; tagsText: string; content: string } | undefined) | undefined) => void;
  onAddBlock: () => void;
  onEdit: (blockId: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDuplicate: (blockId: string) => void;
  onSaveAsNew: (blockId: string) => void;
  onRemove: (blockId: string) => void;
  onMoveUp: (blockId: string) => void;
  onMoveDown: (blockId: string) => void;
}) {
  if (!neoblock) return <div className="empty">Select a NeoBlock to open MOLT Builder.</div>;

  const sectionEntries = moltBuilderSections.map((section) => ({
    ...section,
    blocks: neoblock.blocks.filter((block) => builderSectionForBlock(block).key === section.key)
  }));

  return <div className="moltBuilderPanel">
    <div className="moltBuilderHeader">
      <div>
        <h3>MOLT Builder</h3>
        <p>NeoBlock: {neoblock.title}</p>
        <small className="moltBuilderNotice">{builderNotice}</small>
        <small className="moltBuilderHelper">Session shelf saves reusable local MOLT copies; it does not change the source library.</small>
      </div>
      <div className="row">
        <button onClick={onAddBlock}>Add Block</button>
      </div>
    </div>
    <div className="moltBuilderSections">
      {sectionEntries.map((section) => <section key={section.key} className="moltBuilderSection">
        <div className="moltSectionHeader">
          <b>{section.label}</b>
          <span>{section.blocks.length} block{section.blocks.length === 1 ? '' : 's'}</span>
        </div>
        {section.blocks.length === 0
          ? <div className="moltSectionEmpty">No {section.label} blocks in this NeoBlock.</div>
          : <div className="moltBuilderCards">{section.blocks.map((block: UMGBlock, index: number) => {
            const roleStyle = builderSectionForBlock(block).className;
            const isEditing = editingMoltId === block.id;
            const isAffected = lastAffectedMoltId === block.id;
            return <article key={block.id} className={`moltBuilderCard ${roleStyle}${isEditing ? ' isEditing' : ''}${isAffected ? ' isAffected' : ''}`}>
              <div className="cardtop">
                <b>{block.title}</b>
                <span className="badge">{builderSectionForBlock(block).label}</span>
              </div>
              {isAffected && <span className="moltBuilderStateBadge">{lastAffectedMoltLabel ?? 'Updated'}</span>}
              {isEditing
                ? <div className="moltInlineEditor">
                    <label>
                      Title
                      <input
                        value={editingDraft?.title ?? ''}
                        onChange={(event) => onEditingDraftChange((current) => ({
                          title: event.target.value,
                          category: current?.category ?? block.category ?? '',
                          tagsText: current?.tagsText ?? block.tags.join(', '),
                          content: current?.content ?? block.content
                        }))}
                      />
                    </label>
                    <label>
                      Role / MOLT Type
                      <input value={builderSectionForBlock(block).label} readOnly />
                    </label>
                    <label>
                      Category
                      <input
                        value={editingDraft?.category ?? ''}
                        onChange={(event) => onEditingDraftChange((current) => ({
                          title: current?.title ?? block.title,
                          category: event.target.value,
                          tagsText: current?.tagsText ?? block.tags.join(', '),
                          content: current?.content ?? block.content
                        }))}
                      />
                    </label>
                    <label>
                      Tags
                      <input
                        value={editingDraft?.tagsText ?? ''}
                        onChange={(event) => onEditingDraftChange((current) => ({
                          title: current?.title ?? block.title,
                          category: current?.category ?? block.category ?? '',
                          tagsText: event.target.value,
                          content: current?.content ?? block.content
                        }))}
                      />
                    </label>
                    <label>
                      Content
                      <textarea
                        value={editingDraft?.content ?? ''}
                        onChange={(event) => onEditingDraftChange((current) => ({
                          title: current?.title ?? block.title,
                          category: current?.category ?? block.category ?? '',
                          tagsText: current?.tagsText ?? block.tags.join(', '),
                          content: event.target.value
                        }))}
                      />
                    </label>
                    <small>Tags use comma-separated values. Description remains untouched in this pass.</small>
                    <div className="row moltBuilderActions">
                      <button type="button" className="primary" onClick={onSaveEdit}>Save</button>
                      <button type="button" onClick={onCancelEdit}>Cancel</button>
                    </div>
                  </div>
                : <>
                    <p>{block.description || block.content.slice(0, 180)}</p>
                    <small>Role: {builderSectionForBlock(block).label}</small>
                    <small>Category: {block.category || '—'}</small>
                    <small>Tags: {block.tags.length ? block.tags.join(', ') : '—'}</small>
                    <small>Position in section: {index + 1}</small>
                    <div className="row moltBuilderActions">
                      <button type="button" onClick={() => onEdit(block.id)}>Edit</button>
                      <button type="button" onClick={() => onDuplicate(block.id)}>Duplicate</button>
                      <button type="button" onClick={() => onSaveAsNew(block.id)}>Save to Shelf</button>
                      <button type="button" onClick={() => onRemove(block.id)}>Remove from NeoBlock</button>
                      <button type="button" onClick={() => onMoveUp(block.id)}>Move Up</button>
                      <button type="button" onClick={() => onMoveDown(block.id)}>Move Down</button>
                    </div>
                  </>}
            </article>;
          })}</div>}
      </section>)}
    </div>
  </div>;
}

function nodePathClass(pathState?: GraphNode['pathState']) {
  return pathState ? `path-${pathState.replace('_', '-')}` : '';
}

function edgePathClass(edge: any) {
  const routeClass = edge.pathState ? `edge-${String(edge.pathState).replace('_', '-')}${edge.pathState === 'active' || edge.pathState === 'dormant' || edge.pathState === 'suppressed' || edge.pathState === 'blocked' || edge.pathState === 'candidate' ? '-route' : ''}` : '';
  return `${routeClass} ${edge.governanceOverride ? 'edge-governance-override' : ''}`.trim();
}

function graphNodeDimensions(node: GraphNode) {
  if (node.nodeType === 'sleeve') return { width: 280, height: 150 };
  if (node.nodeType === 'neostack') return { width: 260, height: 132 };
  if (node.nodeType === 'neoblock') return { width: 250, height: 108 };
  return { width: 220, height: 92 };
}

function edgeEndpoints(edge: any, nodesById: Map<string, GraphNode>) {
  const sourceNode = nodesById.get(edge.source);
  const targetNode = nodesById.get(edge.target);
  if (!sourceNode || !targetNode) return undefined;
  const sourceSize = graphNodeDimensions(sourceNode);
  const targetSize = graphNodeDimensions(targetNode);
  const x1 = sourceNode.position.x + sourceSize.width;
  const y1 = sourceNode.position.y + sourceSize.height / 2;
  const x2 = targetNode.position.x;
  const y2 = targetNode.position.y + targetSize.height / 2;
  if (![x1, y1, x2, y2].every((value) => Number.isFinite(value))) return undefined;
  if (x1 === x2 && y1 === y2) return undefined;
  return { x1, y1, x2, y2 };
}

function gateStripStyle(edge: any, nodesById: Map<string, GraphNode>) {
  const points = edgeEndpoints(edge, nodesById);
  if (!points) return { display: 'none' };
  return { left: (points.x1 + points.x2) / 2, top: (points.y1 + points.y2) / 2 };
}

function Graph({ nodes, edges, selected, onPick, onMove, onDrop, canSnap, viewMode, showGates = true }: { nodes: GraphNode[]; edges: any[]; selected?: string; onPick: (node: GraphNode) => void; onMove?: (nodeId: string, x: number, y: number) => void; onDrop?: (nodeId: string, x: number, y: number, targetNodeId?: string) => void; canSnap?: (sourceNode: GraphNode, targetNodeId: GraphNode) => boolean; viewMode?: string; showGates?: boolean }) {
  const dragging = useRef<{ id: string; sourceId: string; offsetX: number; offsetY: number; lastX: number; lastY: number } | null>(null);
  const [snapTargetId, setSnapTargetId] = useState<string | undefined>(undefined);
  const sleeveRootNode = viewMode === 'full_sleeve' ? nodes.find((node) => node.nodeType === 'sleeve') : undefined;
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const pickTypeLabel = (node: GraphNode) => {
    if (node.nodeType === 'molt_block') {
      if (node.moltRole) return node.moltRole.replace(/_/g, ' ').replace(/^\w/, (char: string) => char.toUpperCase());
      return 'MOLT';
    }
    if (node.nodeType === 'neoblock') return 'NeoBlock';
    if (node.nodeType === 'neostack') return 'NeoStack';
    if (node.nodeType === 'sleeve') return 'Sleeve';
    return node.nodeType;
  };

  const getDropCandidate = (source: GraphNode, x: number, y: number): string | undefined => {
    if (!canSnap) return undefined;
    let candidate: GraphNode | undefined;
    let nearest = Number.POSITIVE_INFINITY;
    for (const node of nodes) {
      if (node.id === source.id) continue;
      if (!canSnap(source, node)) continue;
      const distance = Math.hypot((x + 150) - (node.position.x + 100), (y + 30) - (node.position.y + 24));
      if (distance < 120 && distance < nearest) {
        nearest = distance;
        candidate = node;
      }
    }
    return candidate?.sourceId;
  };

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = null;
    if (event.target === event.currentTarget && onMove) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = dragging.current;
    if (!active || !onMove) return;
    const nextX = event.clientX - active.offsetX;
    const nextY = event.clientY - active.offsetY;
    onMove(active.id, nextX, nextY);
    const source = nodes.find((node) => node.id === active.id);
    if (!source) return;
    setSnapTargetId(getDropCandidate(source, nextX, nextY));
  };

  const onCanvasPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = dragging.current;
    const source = active ? nodes.find((node) => node.id === active.id) : undefined;
    dragging.current = null;
    if (!active || !source || !onDrop) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setSnapTargetId(undefined);
      return;
    }

    onDrop(active.sourceId, active.lastX, active.lastY, snapTargetId);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setSnapTargetId(undefined);
  };

  const onNodePointerDown = (event: React.PointerEvent<HTMLButtonElement>, node: GraphNode) => {
    if (!onMove) return;
    if (node.nodeType === 'sleeve' && viewMode === 'full_sleeve') return;
    event.stopPropagation();
    event.preventDefault();
    dragging.current = {
      id: node.id,
      sourceId: node.sourceId || node.id,
      offsetX: event.clientX - node.position.x,
      offsetY: event.clientY - node.position.y,
      lastX: node.position.x,
      lastY: node.position.y
    };
  };

  const onNodePointerMove = (event: React.PointerEvent<HTMLButtonElement>, node: GraphNode) => {
    if (!onMove || dragging.current?.id !== node.id) return;
    const nextX = event.clientX - dragging.current.offsetX;
    const nextY = event.clientY - dragging.current.offsetY;
    dragging.current.lastX = nextX;
    dragging.current.lastY = nextY;
    onMove(dragging.current.id, nextX, nextY);
    setSnapTargetId(getDropCandidate(node, nextX, nextY));
  };

  const onNodePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const active = dragging.current;
    event.preventDefault();
    event.stopPropagation();
    if (active && onDrop) {
      onDrop(active.sourceId, active.lastX, active.lastY, snapTargetId);
    }
    dragging.current = null;
    setSnapTargetId(undefined);
  };

  return (
    <div className={`canvas graph-view-${viewMode ?? 'full_sleeve'}`} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp}>
      {sleeveRootNode && <div className="sleeveRootFrame"><div className="sleeveRootBackdrop" /><div className="sleeveRootHeader"><span className="sleeveRootEyebrow">Sleeve Root</span><b>{`Sleeve: ${sleeveRootNode.label}`}</b><small>Architecture root for NeoStacks and NeoBlocks</small></div></div>}
      {edges.map((edge) => {
        const gateStrip = gateVisualMetadataForEdge(edge);
        const points = edgeEndpoints(edge, nodesById);
        if (!points) return null;
        return <div key={edge.id} className="edgeLayer"><svg className={`edge ${edgePathClass(edge)}`} style={{ left: 0, top: 0 }}><line x1={points.x1} y1={points.y1} x2={points.x2} y2={points.y2} /></svg>{showGates && gateStrip.renderGateStrip && <span className={gateStrip.className} style={gateStripStyle(edge, nodesById)}>{gateStrip.label}</span>}</div>;
      })}
      {nodes.map((node) => {
        if (sleeveRootNode && node.id === sleeveRootNode.id) return null;
        const gateBadge = gateVisualMetadataForNode(node);
        const isDropTarget = snapTargetId === (node.sourceId || node.id);
        const roleClass = node.nodeType === 'molt_block' && node.moltRole
          ? `moltRole${node.moltRole.replace(/(^|_)([a-z])/g, (_, _prefix: string, char: string) => char.toUpperCase())}`
          : '';
        return <button
          key={node.id}
          className={`node ${selected === node.id ? 'picked' : ''} ${node.state.active ? 'active' : ''} ${node.state.off ? 'off' : ''} ${node.state.triggered ? 'triggered' : ''} ${node.state.invalid ? 'invalid' : ''} ${nodePathClass(node.pathState)} node-${node.nodeType} ${node.moltRole ? 'molt' : ''} ${roleClass} ${isDropTarget ? 'dropTarget' : ''}`}
          style={{ left: node.position.x, top: node.position.y }}
          onPointerDown={(event) => onNodePointerDown(event, node)}
          onPointerMove={(event) => onNodePointerMove(event, node)}
          onPointerUp={onNodePointerUp}
          onClick={() => onPick(node)}
        >
          <b>{node.label}</b>
          <small>{pickTypeLabel(node)}</small>
          {showGates && gateBadge.renderGateBadge && <span className={gateBadge.className}>{gateBadge.label}</span>}
          {node.state.warning && <em>{node.state.warning}</em>}
        </button>;
      })}
    </div>
  );
}

function RuntimeGateDebugPanel({ view }: { view?: ReturnType<typeof buildRuntimeGateDebugView> }) {
  if (!view) return null;
  return <div className="runtimeGateDebug"><div className="gateDebugDiamond"><b>{view.gateKind === 'trigger_gate' ? 'Gt' : view.gateKind === 'routing_gate' ? 'Gr' : view.gateKind === 'governance_gate' ? 'Gv' : 'Ga'}</b></div><div className="report"><b>RuntimeGate Debug</b><span>control geometry</span><span>projection-only</span><span>not evaluated</span><span>gateId: {view.gateId}</span><span>sourceCardId: {view.sourceCardId ?? 'n/a'}</span><span>title: {view.title}</span><span>gateKind: {view.gateKind}</span><span>sourcePath: {view.sourcePath ?? 'n/a'}</span><span>placement kind: {view.placement?.kind ?? 'n/a'}</span><span>placement target: {view.placement?.targetLabel ?? view.placement?.targetId ?? 'n/a'}</span><span>condition: {view.condition}</span><span>runtimeState.state: {view.runtimeState.state}</span><span>runtimeState.passed: {String(view.runtimeState.passed)}</span><span>reason: {view.runtimeState.reason}</span><span>routingDecision: {view.gateIRRow?.routingDecision ?? 'not_evaluated'}</span><span>gatePassed: {String(view.gateIRRow?.gatePassed === true)}</span><span>activeTargetIds: {JSON.stringify(view.gateIRRow?.activeTargetIds ?? [])}</span><span>dormantTargetIds: {JSON.stringify(view.gateIRRow?.dormantTargetIds ?? [])}</span><span>suppressedTargetIds: {JSON.stringify(view.gateIRRow?.suppressedTargetIds ?? [])}</span><span>blockedTargetIds: {JSON.stringify(view.gateIRRow?.blockedTargetIds ?? [])}</span><span>governedNodeIds: {JSON.stringify(view.gateIRRow?.governedNodeIds ?? [])}</span><span>trace kind: {String(view.traceEvent?.kind ?? 'n/a')}</span><span>trace evaluated: {String(view.traceEvent?.evaluated ?? false)}</span><span>trace executed: {String(view.traceEvent?.executed ?? false)}</span><span>Glyph Matrix line: {view.glyphLine?.text.split('\n')[0] ?? 'n/a'}</span><span>route switching: not implemented</span><span>live execution: not implemented</span></div></div>;
}

function BlockInspector({ views, fallback, activeTab, setActiveTab }: { views?: any; fallback?: unknown; activeTab: InspectorTab; setActiveTab: (tab: InspectorTab) => void }) {
  if (!views && !fallback) return <div className="empty">Select or inspect a block/source card to view Card / Runtime / NL / JSON / Legacy Source.</div>;
  if (!views) return <><h3>Inspect JSON / Legacy Source</h3><pre>{JSON.stringify(fallback, null, 2)}</pre></>;
  const body = activeTab === 'Card' ? views.card
    : activeTab === 'Runtime' ? views.runtime?.runtimeState ?? views.runtimePreview
    : activeTab === 'Runtime Preview' ? views.runtimePreview ?? views.runtime?.runtimeState
    : activeTab === 'NL' ? views.nl
    : activeTab === 'JSON' ? views.compilerJson ?? views.json
    : activeTab === 'Legacy Source' ? views.legacySource
    : activeTab === 'Attach / Placement Preview' ? views.attachPlacementPreview
    : activeTab === 'Trace / IR Preview' ? views.traceIrPreview
    : activeTab === 'Trace' ? views.trace ?? []
    : views.irRow ?? { message: 'Compile to populate IR Row from IR Matrix source of truth.' };
  return <div className="blockInspector"><div className="tabs inspectorTabs">{inspectorTabs.map((tab) => <button key={tab} className={activeTab === tab ? 'hot' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div><div className="report"><span>model SearchCard / RuntimeBlock / FullSourceRecord / TriggerGateSourceCard</span><span>NL/JSON sync rule: derived from the same normalized source</span><span>IR Matrix source of truth; Glyph Matrix graph projection layer</span><span>TriggerGate source cards attach as inert control geometry; not prompt content; no live execution.</span></div>{activeTab === 'NL' ? <pre>{String(body)}</pre> : <pre>{JSON.stringify(body, null, 2)}</pre>}</div>;
}

function isUMGBlock(value: unknown): value is UMGBlock {
  return Boolean(value && typeof value === 'object' && (value as UMGBlock).type === 'molt_block' && (value as UMGBlock).role && (value as UMGBlock).content !== undefined);
}

function isTriggerGateSourceCard(value: unknown): value is TriggerGateSourceCard {
  return Boolean(value && typeof value === 'object' && (value as TriggerGateSourceCard).type === 'TriggerGateSourceCard');
}

function findWorkspaceBlock(workspace: UMGWorkspace | undefined, sourceId: string) {
  for (const sleeve of workspace?.sleeves ?? []) for (const stack of sleeve.stacks) {
    for (const neoblock of stack.neoblocks) for (const block of neoblock.blocks) if (block.id === sourceId) return block;
    for (const block of stack.directBlocks ?? []) if (block.id === sourceId) return block;
  }
  return undefined;
}

function renderRuntime(workspace?: UMGWorkspace, compiled?: CompileResult, output?: string, runtimeTab: RuntimeDrawerTab = 'RuntimeSpec') {
  if (runtimeTab === 'RuntimeSpec') return JSON.stringify(compiled?.runtimeSpec ?? workspace?.runtime, null, 2);
  if (runtimeTab === 'Trace') return JSON.stringify(compiled?.trace ?? workspace?.runtime?.trace ?? [], null, 2);
  if (runtimeTab === 'IR Matrix') return JSON.stringify(compiled?.irMatrix ?? workspace?.runtime?.irMatrix ?? [], null, 2);
  if (runtimeTab === 'Glyph Matrix') {
    if (!compiled) return 'Compile to project Glyph Matrix from RuntimeSpec, IR Matrix, GateIRRows, Trace, and inert gate_context.';
    const glyphMatrix = projectGlyphMatrix({ runtimeSpec: compiled.runtimeSpec, irMatrix: compiled.irMatrix, trace: compiled.trace, graph: workspace?.graph, activeSleeveId: workspace?.activeSleeveId, viewMode: 'compact' as GlyphMatrixViewMode });
    return renderGlyphMatrixText(glyphMatrix);
  }
  return output || 'No output generated. Compile/export remains available without live tool execution.';
}

function labelDisplayType(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
