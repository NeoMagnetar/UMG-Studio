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
import { applyCompileResultToGraph, applyManualLayout, buildGraphFromSleeve, gateVisualMetadataForEdge, gateVisualMetadataForNode } from './lib/umg/graphBuilder';
import { compileWorkspaceToRuntime } from './lib/umg/compilerBridge';
import { downloadJson, exportHermesPacket } from './lib/umg/exporters';
import { redactKey, testHermesConnection } from './lib/hermes/hermesClient';
import { generateWithHermesEndpoint, HERMES_GENERATE_MISSING_ENDPOINT, HermesGenerateEndpointMode, inferHermesGenerateEndpointMode, resolveHermesGenerateConfig } from './lib/umg/hermesGenerate';
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
type RuntimeDrawerTab = 'RuntimeSpec' | 'Trace' | 'IR Matrix' | 'Glyph Matrix' | 'Output';
const runtimeDrawerTabs: RuntimeDrawerTab[] = ['RuntimeSpec', 'Trace', 'IR Matrix', 'Glyph Matrix', 'Output'];

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
  const selectedBlock = useMemo(() => selected ? findWorkspaceBlock(workspace, selected.sourceId) : undefined, [workspace, selected]);
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
  const runtimeGateDebugView = useMemo(() => selectedGateId ? buildRuntimeGateDebugView({ gateId: selectedGateId, workspace, compiled, glyphMatrix: selectedGateGlyphMatrix }) : undefined, [selectedGateId, workspace, compiled, selectedGateGlyphMatrix]);
  const resizeState = useRef<{ target: ResizeTarget; startX: number; startY: number; startWidth: number; } | null>(null);

  const startResize = (target: ResizeTarget, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeState.current = {
      target,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: layout.leftWidth
    };
    if (target === 'left' && layout.leftCollapsed) setLayout((current) => ({ ...current, leftCollapsed: false, leftWidth: Math.max(layout.leftWidth, 240) }));
    if (target === 'right' && layout.rightCollapsed) setLayout((current) => ({ ...current, rightCollapsed: false, rightWidth: Math.max(layout.rightWidth, 400) }));
    if (target === 'bottom' && layout.bottomCollapsed) setLayout((current) => ({ ...current, bottomCollapsed: false, bottomHeight: Math.max(layout.bottomHeight, 180) }));

    const onPointerMove = (move: PointerEvent) => {
      const state = resizeState.current;
      if (!state) return;
      setLayout((current) => {
        if (state.target === 'left') return { ...current, leftWidth: Math.min(560, Math.max(220, state.startWidth + (move.clientX - state.startX)) )};
        if (state.target === 'right') return { ...current, rightWidth: Math.min(620, Math.max(260, current.rightWidth - (move.clientX - state.startX))) };
        return { ...current, bottomHeight: Math.min(520, Math.max(150, current.bottomHeight + (state.startY - move.clientY))) };
      });
    };

    const stopResize = () => {
      resizeState.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopResize);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopResize);
  };

  const classes = [
    layout.leftCollapsed ? 'leftCollapsed' : '',
    layout.rightCollapsed ? 'rightCollapsed' : '',
    layout.bottomCollapsed ? 'bottomCollapsed' : ''
  ].filter(Boolean).join(' ');

  const layoutStyle = {
    '--leftWidth': `${layout.leftWidth}px`,
    '--rightWidth': `${layout.rightWidth}px`,
    '--bottomHeight': `${layout.bottomHeight}px`
  } as React.CSSProperties;

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
      const message = 'Compose and Compile first before Hermes generation.';
      setOutput(message);
      return setStatus(message);
    }
    if (!config.endpoint) {
      setOutput(HERMES_GENERATE_MISSING_ENDPOINT);
      return setStatus('Hermes generation endpoint missing');
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

  const updateNodePosition = (nodeId: string, x: number, y: number) => {
    if (!workspace) return;
    setWorkspace((previous) => {
      if (!previous) return previous;
      const nextGraph = applyManualLayout(previous.graph, nodeId, { x, y, relation: 'contains' });
      return { ...previous, graph: nextGraph };
    });
    setCompiled(undefined);
  };

  return <div className="app">
    <header><div><b>UMG Studio v0.1</b><span>local graph cognition studio</span></div><button onClick={() => downloadJson('umg-workspace.json', workspace)}>Export Workspace</button></header>
    <main className={classes} style={layoutStyle}>
      <section className="compose card"><h2>Compose</h2><textarea value={request} onChange={(event) => setRequest(event.target.value)} /><div className="row"><select value={target} onChange={(event) => setTarget(event.target.value)}><option value="chatbot">Chatbot</option><option value="business_template">Business Template</option><option value="website_prompt">Website Prompt</option><option value="umg_sleeve">UMG Sleeve</option></select><select value={depth} onChange={(event) => setDepth(event.target.value as any)}><option>lean</option><option>balanced</option><option>full</option></select><button className="primary" onClick={compose}>Compose Blocks</button><button onClick={compile}>Compile</button><button onClick={generate}>Generate</button></div><p>{status}</p></section>
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
            <button onClick={() => workspace && downloadJson('sleeve.json', workspace.sleeves[0])}>Export Sleeve</button>
            <button onClick={() => compiled && downloadJson('ir-matrix.json', compiled.irMatrix)}>Export IR</button>
            <button onClick={() => compiled && downloadJson('glyph-matrix.json', projectGlyphMatrix({ runtimeSpec: compiled.runtimeSpec, irMatrix: compiled.irMatrix, trace: compiled.trace, graph: workspace?.graph, activeSleeveId: workspace?.activeSleeveId, viewMode: 'compact' }))}>Export Glyph Matrix</button>
            <button onClick={() => compiled && downloadJson('hermes-packet.json', exportHermesPacket(request, compiled, config))}>Export Hermes Packet</button>
          </div>
        </div>
        {graph ? <Graph nodes={graph.nodes} edges={graph.edges} selected={selected?.id} onMove={updateNodePosition} onPick={(node) => { setSelected(node); setInspected(undefined); }} /> : <div className="empty">Describe what you want to build, then click Compose Blocks.</div>}
      </section>
      <div className="split vertical rightSplit" onPointerDown={(event) => startResize('right', event)} role="separator" aria-label="Resize inspector panel" />
      <aside className="inspect card">
        <div className="panelTitle">
          <h2>Inspector / Config</h2>
          <button onClick={() => setLayout((current) => ({ ...current, rightCollapsed: !current.rightCollapsed }))}>{layout.rightCollapsed ? 'Expand' : 'Collapse'}</button>
        </div>
        {selected && <div className="report"><span>node {selected.label}</span><span>type {selected.nodeType}</span><span>active {String(selected.state.active)}</span><span>off {String(selected.state.off)}</span><span>triggered {String(selected.state.triggered)}</span><button onClick={toggleSelected}>Toggle on/off</button></div>}
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

function Graph({ nodes, edges, selected, onPick, onMove }: { nodes: GraphNode[]; edges: any[]; selected?: string; onPick: (node: GraphNode) => void; onMove?: (nodeId: string, x: number, y: number) => void }) {
  const dragging = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = null;
    if (event.target === event.currentTarget && onMove) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = dragging.current;
    if (!active || !onMove) return;
    onMove(active.id, event.clientX - active.offsetX, event.clientY - active.offsetY);
  };

  const onCanvasPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onNodePointerDown = (event: React.PointerEvent<HTMLButtonElement>, node: GraphNode) => {
    if (!onMove) return;
    event.stopPropagation();
    event.preventDefault();
    dragging.current = {
      id: node.id,
      offsetX: event.clientX - node.position.x,
      offsetY: event.clientY - node.position.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onNodePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="canvas" onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp}>
      {edges.map((edge) => {
        const gateStrip = gateVisualMetadataForEdge(edge);
        return <div key={edge.id} className="edgeLayer"><svg className={`edge ${edgePathClass(edge)}`} style={{ left: 0, top: 0 }}><line x1={edge.sourcePosition?.x ?? 40} y1={edge.sourcePosition?.y ?? 40} x2={edge.targetPosition?.x ?? 180} y2={edge.targetPosition?.y ?? 120} /></svg>{gateStrip.renderGateStrip && <span className={gateStrip.className} style={gateStripStyle(edge)}>{gateStrip.label}</span>}</div>;
      })}{nodes.map((node) => {
        const gateBadge = gateVisualMetadataForNode(node);
        return <button
          key={node.id}
          className={`node ${selected === node.id ? 'picked' : ''} ${node.state.active ? 'active' : ''} ${node.state.off ? 'off' : ''} ${node.state.triggered ? 'triggered' : ''} ${node.state.invalid ? 'invalid' : ''} ${nodePathClass(node.pathState)}`}
          style={{ left: node.position.x, top: node.position.y }}
          onPointerDown={(event) => onNodePointerDown(event, node)}
          onPointerUp={onNodePointerUp}
          onClick={() => onPick(node)}
        >
          <b>{node.label}</b>
          <small>{node.nodeType}</small>
          {gateBadge.renderGateBadge && <span className={gateBadge.className}>{gateBadge.label}</span>}
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
