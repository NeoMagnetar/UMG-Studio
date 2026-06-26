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
import { CompileResult, GraphNode, HermesConfig, NeoBlock, NeoStack, Sleeve, TriggerGateSourceCard, UMGBlock, UMGWorkspace } from './lib/umg/types';

const demo = 'Build me a customer-intake chatbot for a mobile detailing business. It should answer basic questions, collect customer name, vehicle type, location, service need, and budget, then produce a clean lead summary.';
const roles = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];
const statuses = ['all', 'runnable', 'warning-bearing', 'meta', 'reference-only', 'unsupported'];
const defaultStatusFilter = 'runnable';
const inspectorTabs = ['Card', 'Runtime', 'Runtime Preview', 'NL', 'JSON', 'Legacy Source', 'Attach / Placement Preview', 'Trace / IR Preview', 'Trace', 'IR Row'] as const;
const triggerGateSourceModules = import.meta.glob('../../umg-block-library/HUMAN/GATES/TRG.*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

type InspectorTab = typeof inspectorTabs[number];

type ResizeTarget = 'left' | 'right' | 'bottom';
type ShelfMode = AssetShelfId;
type WorkspaceMode = 'compose' | 'canvas' | 'runtime';
type GraphViewMode = 'full_sleeve' | 'neostack' | 'neoblock' | 'molt_builder';
type RuntimeDrawerTab = 'RuntimeSpec' | 'Trace' | 'IR Matrix' | 'Glyph Matrix' | 'Output';
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

  useEffect(() => {
    if (typeof window !== 'undefined') saveWorkbenchLayout(window.localStorage, layout);
  }, [layout]);

  const libraryWithStatus = useMemo(() => library.map((block) => {
    const classification = classifyLibraryDisplay(block);
    return { ...block, displayType: classification.displayType, presentationStatus: classification.status };
  }), [library]);
  const triggerGateSourceCards = useMemo(() => normalizeTriggerGateSourceCards(Object.entries(triggerGateSourceModules).map(([sourcePath, markdown]) => ({ sourcePath, markdown }))), []);
  const sections = useMemo(() => sectionLibraryByDisplayType(libraryWithStatus), [libraryWithStatus]);
  const statusCounts = useMemo(() => libraryWithStatus.reduce((acc, block) => ({ ...acc, [block.presentationStatus!]: (acc[block.presentationStatus!] ?? 0) + 1 }), {} as Record<string, number>), [libraryWithStatus]);
  const shelves = useMemo(() => buildAssetShelves({ blocks: libraryWithStatus, neoblocks: savedNeoBlocks as NeoBlock[], neostacks: savedNeoStacks as NeoStack[], sleeves: savedSleeves as Sleeve[], sourceAuditItems: sourceAuditData as SourceAuditItem[], gateSourceCards: triggerGateSourceCards }), [libraryWithStatus, triggerGateSourceCards]);
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
  const selectedBlock = useMemo(() => selected ? findWorkspaceBlock(workspace, selected.sourceId) : undefined, [workspace, selected]);
  const currentNeoBlock = useMemo(() => {
    if (!activeSleeve) return undefined;
    if (selected?.nodeType === 'neoblock') return findNeoBlockInSleeve(activeSleeve, selected.sourceId);
    if (selectedBlock) return findParentNeoBlockForBlock(activeSleeve, selectedBlock.id);
    return activeSleeve.stacks.flatMap((stack) => stack.neoblocks)[0];
  }, [activeSleeve, selected, selectedBlock]);
  const viewedGraph = useMemo(() => {
    if (!graph) return graph;
    if (graphViewMode === 'full_sleeve') return graph;

    const fallbackSleeve = graph.nodes.find((node) => node.nodeType === 'sleeve');
    const fallbackNeostack = graph.nodes.find((node) => node.nodeType === 'neostack');
    const fallbackNeoblock = graph.nodes.find((node) => node.nodeType === 'neoblock');

    if (graphViewMode === 'neostack') {
      const focusNode = selected?.nodeType === 'neostack' ? selected : fallbackNeostack;
      if (!focusNode) return graph;
      return focusGraph(graph, { mode: 'neostack', sourceId: focusNode.sourceId ?? focusNode.id });
    }

    if (graphViewMode === 'neoblock') {
      const focusNode = selected?.nodeType === 'neoblock' ? selected : fallbackNeoblock ?? fallbackNeostack;
      if (!focusNode) return graph;
      return focusGraph(graph, { mode: 'neoblock', sourceId: focusNode.sourceId ?? focusNode.id });
    }

    if (graphViewMode === 'molt_builder') {
      const focusNode = selected?.nodeType === 'neoblock' ? selected : fallbackNeoblock ?? fallbackNeostack;
      if (!focusNode) return graph;
      return focusGraph(graph, { mode: 'neoblock', sourceId: focusNode.sourceId ?? focusNode.id });
    }
  }, [graph, graphViewMode, selected]);
  const displayGraph = useMemo(() => {
    if (!viewedGraph) return viewedGraph;
    if (showGates) return viewedGraph;
    const gateNodeIds = new Set(viewedGraph.nodes.filter((node) => node.nodeType === 'gate').map((node) => node.id));
    return {
      nodes: viewedGraph.nodes.filter((node) => node.nodeType !== 'gate'),
      edges: viewedGraph.edges.filter((edge) => !gateNodeIds.has(edge.source) && !gateNodeIds.has(edge.target))
    };
  }, [showGates, viewedGraph]);
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

  const replaceActiveSleeve = (nextSleeve: Sleeve, nextSelectedSourceId?: string) => {
    if (!workspace) return;
    const activeSleeveId = activeSleeve?.id ?? workspace.activeSleeveId ?? workspace.sleeves[0]?.id;
    const nextSleeves = workspace.sleeves.map((sleeve) => sleeve.id === activeSleeveId ? nextSleeve : sleeve);
    const nextGraph = buildGraphFromSleeve(nextSleeve);
    const selectedSourceId = nextSelectedSourceId ?? selected?.sourceId;
    setWorkspace({ ...workspace, activeSleeveId: nextSleeve.id, sleeves: nextSleeves, graph: nextGraph });
    setCompiled(undefined);
    if (selectedSourceId) {
      setSelected(nextGraph.nodes.find((node) => node.sourceId === selectedSourceId || node.id === selectedSourceId));
      return;
    }
    setSelected(undefined);
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
  };

  const duplicateBuilderBlock = (blockId: string) => {
    if (!currentNeoBlock) return;
    const sourceBlock = currentNeoBlock.blocks.find((block: UMGBlock) => block.id === blockId);
    if (!sourceBlock) return;
    const duplicate = structuredClone(sourceBlock);
    duplicate.id = `${sourceBlock.id}_copy_${Date.now()}`;
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
  };

  const removeBuilderBlock = (blockId: string) => {
    if (!currentNeoBlock) return;
    const block = currentNeoBlock.blocks.find((entry: UMGBlock) => entry.id === blockId);
    if (!block) return;
    updateCurrentNeoBlock((neoblock) => ({ ...neoblock, blocks: neoblock.blocks.filter((entry: UMGBlock) => entry.id !== blockId) }), currentNeoBlock.id);
    setStatus(`removed ${block.title} from ${currentNeoBlock.title}`);
  };

  const focusBuilderBlock = (blockId: string) => {
    const node = graph?.nodes.find((candidate) => candidate.sourceId === blockId || candidate.id === blockId);
    if (node) {
      setSelected(node);
      setInspectorTab('Card');
      setInspected(undefined);
    }
  };

  const compose = () => {
    const composition = composeBlocks({ freeform_request: request, target_type: target as any, depth }, libraryWithStatus);

    const nextWorkspace: UMGWorkspace = { id: 'ws_local', title: 'Local UMG Workspace', activeSleeveId: composition.draft_sleeve.id, sleeves: [composition.draft_sleeve], libraryRefs: libraryWithStatus.map((block) => block.id), graph: buildGraphFromSleeve(composition.draft_sleeve) };
    setWorkspace(nextWorkspace);
    setCompiled(undefined);
    setSelected(undefined);
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

  const addAsset = (item: ShelfAsset) => {
    if (item.kind === 'source_asset') { setInspected(item.asset); setInspectorTab('Legacy Source'); return; }
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
      setStatus(`gate attached as candidate control geometry: ${card.id}; not evaluated, not prompt content, no live execution`);
      return;
    }
    if (item.kind === 'sleeve') {
      const sleeve = structuredClone(item.asset as Sleeve);
      const nextWorkspace: UMGWorkspace = { id: `ws_${sleeve.id}`, title: sleeve.title, activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
      setWorkspace(nextWorkspace);
      setCompiled(undefined);
      setStatus(`opened Sleeve ${item.title}`);
      return;
    }
    if (!workspace) return setStatus('compose a workspace first');
    const sleeve = structuredClone(workspace.sleeves[0]);
    if (item.kind === 'molt_block') {
      const block = structuredClone(item.asset as UMGBlock);
      block.id = `${block.id}_copy_${Date.now()}`;
      block.source = { origin: 'workspace', sourceId: (item.asset as UMGBlock).id, version: '0.1' };
      sleeve.stacks[0].neoblocks[0].blocks.push(block);
      setStatus(`added MOLT block ${item.title}`);
    }
    if (item.kind === 'neoblock') {
      sleeve.stacks[0].neoblocks.push(structuredClone(item.asset as NeoBlock));
      setStatus(`added NeoBlock ${item.title}`);
    }
    if (item.kind === 'neostack') {
      sleeve.stacks.push(structuredClone(item.asset as NeoStack));
      setStatus(`added NeoStack ${item.title}`);
    }
    setWorkspace({ ...workspace, sleeves: [sleeve], graph: buildGraphFromSleeve(sleeve) });
    setCompiled(undefined);
  };

  const toggleSelected = () => {
    if (!workspace || !selected) return;
    const sleeve = structuredClone(workspace.sleeves[0]);
    sleeve.stacks.forEach((stack) => stack.neoblocks.forEach((nb) => nb.blocks.forEach((block) => {
      if (block.id === selected.sourceId) block.defaultState = block.defaultState === 'off' ? 'on' : 'off';
    })));
    setWorkspace({ ...workspace, sleeves: [sleeve], graph: buildGraphFromSleeve(sleeve) });
    setCompiled(undefined);
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
        {activeShelf === 'source_audit' ? <SourceAuditTable items={visibleItems} onInspect={inspectAsset} /> : <AssetCards items={visibleItems} onAdd={addAsset} onInspect={inspectAsset} />}
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
            onAddBlock={() => { setActiveShelf('molt_blocks'); setWorkspaceMode('canvas'); setStatus(currentNeoBlock ? `choose a library card and add it to ${currentNeoBlock.title}` : 'select a NeoBlock or compose a workspace first'); }}
            onEdit={(blockId) => { focusBuilderBlock(blockId); setStatus('opened block in inspector'); }}
            onDuplicate={duplicateBuilderBlock}
            onSaveAsNew={(blockId) => {
              const block = currentNeoBlock?.blocks.find((entry: UMGBlock) => entry.id === blockId);
              setStatus(block ? `save as new is UI-only for now: ${block.title}` : 'save as new is UI-only for now');
            }}
            onRemove={removeBuilderBlock}
            onMoveUp={(blockId) => moveBlockWithinRole(blockId, 'up')}
            onMoveDown={(blockId) => moveBlockWithinRole(blockId, 'down')}
          />
          : displayGraph
            ? <Graph nodes={displayGraph.nodes} edges={displayGraph.edges} selected={selected?.id} showGates={showGates} viewMode={graphViewMode} onMove={updateNodePosition} onPick={(node) => { setSelected(node); setInspected(undefined); }} onDrop={applyDropContainment} canSnap={(source, target) => canSnapAsChild(source, target)} />
            : <div className="empty">Describe what you want to build, then click Compose Blocks.</div>}
      </section>
      <div className="split vertical rightSplit" onPointerDown={(event) => startResize('right', event)} role="separator" aria-label="Resize inspector panel" />
      <aside className="inspect card">
        <div className="panelTitle">
          <h2>Inspector / Config</h2>
          <button onClick={() => setLayout((current) => ({ ...current, rightCollapsed: !current.rightCollapsed }))}>{layout.rightCollapsed ? 'Expand' : 'Collapse'}</button>
        </div>
        {selected && <div className="report"><span>node {selected.label}</span><span>type {selected.nodeType === 'molt_block' ? (selected.moltRole || 'MOLT') : labelDisplayType(selected.nodeType)}</span><span>active {String(selected.state.active)}</span><span>off {String(selected.state.off)}</span><span>triggered {String(selected.state.triggered)}</span><button onClick={toggleSelected}>Toggle on/off</button></div>}
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

function AssetCards({ items, onAdd, onInspect }: { items: ShelfAsset[]; onAdd: (item: ShelfAsset) => void; onInspect: (item: ShelfAsset) => void }) {
  return <div className="cards builderCards">{items.map((item, index) => {
    const block = item.asset as UMGBlock;
    const gateCard = item.asset as TriggerGateSourceCard;
    const isGateSource = item.kind === 'trigger_gate_source';
    const instId = item.kind === 'molt_block' ? block.legacy?.libraryEntryId : isGateSource ? gateCard.id : undefined;
    const category = item.kind === 'molt_block' ? block.category : isGateSource ? `${gateCard.category} / ${gateCard.subcategory}` : undefined;
    return <div key={`${item.id}:${item.sourcePath ?? 'local'}:${index}`} className={`block builderBlock asset-${item.kind} ${item.displayType === 'meta' ? 'metaCard' : ''} ${isGateSource ? 'gateSourceCard' : ''}`}><div className="cardtop"><b>{item.title}</b><span className="badge">{isGateSource ? 'Gt TriggerGate Source' : item.displayType === 'meta' ? 'Meta / non-compiler' : item.kind === 'molt_block' ? 'MOLT Block Card' : item.kind}</span></div>{instId && <p className="instId">ID: {instId}</p>}<p>role: {item.containedRoles.map(labelDisplayType).join(', ') || item.kind}</p>{category && <p>category: {category}</p>}{isGateSource && <p>activation: {gateCard.activation.conditionSummary}</p>}<p>status: {item.status || 'runnable'}</p><small>tags: {item.tags.slice(0, 12).join(', ') || 'no tags'}</small><small>sourcePath: {item.sourcePath ?? 'local asset'}</small><div className="row"><button onClick={() => onAdd(item)}>{isGateSource ? 'Attach Gate' : item.kind === 'sleeve' ? 'Open Sleeve' : 'Add to Workspace'}</button><button onClick={() => onInspect(item)}>{isGateSource ? 'Inspect TriggerGate Source' : 'Inspect JSON / Legacy Source'}</button></div></div>;
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

function builderSectionForBlock(block: UMGBlock) {
  const roleKey = block.displayType === 'meta' ? 'meta_other' : block.role;
  return moltBuilderSections.find((section) => section.key === roleKey) ?? moltBuilderSections[moltBuilderSections.length - 1];
}

function MoltBuilderPanel({
  neoblock,
  onAddBlock,
  onEdit,
  onDuplicate,
  onSaveAsNew,
  onRemove,
  onMoveUp,
  onMoveDown
}: {
  neoblock?: NeoBlock;
  onAddBlock: () => void;
  onEdit: (blockId: string) => void;
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
            return <article key={block.id} className={`moltBuilderCard ${roleStyle}`}>
              <div className="cardtop">
                <b>{block.title}</b>
                <span className="badge">{builderSectionForBlock(block).label}</span>
              </div>
              <p>{block.description || block.content.slice(0, 180)}</p>
              <small>Role: {builderSectionForBlock(block).label}</small>
              <small>Position in section: {index + 1}</small>
              <div className="row moltBuilderActions">
                <button onClick={() => onEdit(block.id)}>Edit</button>
                <button onClick={() => onDuplicate(block.id)}>Duplicate</button>
                <button onClick={() => onSaveAsNew(block.id)}>Save as New</button>
                <button onClick={() => onRemove(block.id)}>Remove from NeoBlock</button>
                <button onClick={() => onMoveUp(block.id)}>Move Up</button>
                <button onClick={() => onMoveDown(block.id)}>Move Down</button>
              </div>
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

function gateStripStyle(edge: any) {
  const x1 = edge.sourcePosition?.x ?? 40;
  const y1 = edge.sourcePosition?.y ?? 40;
  const x2 = edge.targetPosition?.x ?? 180;
  const y2 = edge.targetPosition?.y ?? 120;
  return { left: (x1 + x2) / 2, top: (y1 + y2) / 2 };
}

function Graph({ nodes, edges, selected, onPick, onMove, onDrop, canSnap, viewMode, showGates = true }: { nodes: GraphNode[]; edges: any[]; selected?: string; onPick: (node: GraphNode) => void; onMove?: (nodeId: string, x: number, y: number) => void; onDrop?: (nodeId: string, x: number, y: number, targetNodeId?: string) => void; canSnap?: (sourceNode: GraphNode, targetNodeId: GraphNode) => boolean; viewMode?: string; showGates?: boolean }) {
  const dragging = useRef<{ id: string; sourceId: string; offsetX: number; offsetY: number; lastX: number; lastY: number } | null>(null);
  const [snapTargetId, setSnapTargetId] = useState<string | undefined>(undefined);

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
      {edges.map((edge) => {
        const gateStrip = gateVisualMetadataForEdge(edge);
        return <div key={edge.id} className="edgeLayer"><svg className={`edge ${edgePathClass(edge)}`} style={{ left: 0, top: 0 }}><line x1={edge.sourcePosition?.x ?? 40} y1={edge.sourcePosition?.y ?? 40} x2={edge.targetPosition?.x ?? 180} y2={edge.targetPosition?.y ?? 120} /></svg>{showGates && gateStrip.renderGateStrip && <span className={gateStrip.className} style={gateStripStyle(edge)}>{gateStrip.label}</span>}</div>;
      })}
      {nodes.map((node) => {
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
