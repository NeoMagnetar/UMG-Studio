import { useMemo, useState } from 'react';
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
import { applyCompileResultToGraph, buildGraphFromSleeve } from './lib/umg/graphBuilder';
import { compileWorkspaceToRuntime } from './lib/umg/compilerBridge';
import { downloadJson, exportHermesPacket } from './lib/umg/exporters';
import { generateWithHermes, redactKey, testHermesConnection } from './lib/hermes/hermesClient';
import { buildAssetShelves, searchShelfAssets, ShelfAsset, AssetShelfId, SourceAuditItem } from './lib/umg/libraryAssets';
import { buildBlockInspectorViews } from './lib/umg/blockViews';
import { CompileResult, GraphNode, HermesConfig, NeoBlock, NeoStack, Sleeve, UMGBlock, UMGWorkspace } from './lib/umg/types';

const demo = 'Build me a customer-intake chatbot for a mobile detailing business. It should answer basic questions, collect customer name, vehicle type, location, service need, and budget, then produce a clean lead summary.';
const roles = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];
const statuses = ['all', 'runnable', 'warning-bearing', 'meta', 'reference-only', 'unsupported'];
const defaultStatusFilter = 'runnable';
const inspectorTabs = ['Card', 'Runtime', 'NL', 'JSON', 'Legacy Source', 'Trace', 'IR Row'] as const;

type InspectorTab = typeof inspectorTabs[number];

type ShelfMode = AssetShelfId;

export default function App() {
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
  const [activeShelf, setActiveShelf] = useState<ShelfMode>('molt_blocks');
  const [search, setSearch] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter);
  const [config, setConfig] = useState<HermesConfig>({ endpoint: '', model: 'hermes-default', temperature: 0.3, maxTokens: 1200 });
  const [hermesStatus, setHermesStatus] = useState('not configured');

  const libraryWithStatus = useMemo(() => library.map((block) => {
    const classification = classifyLibraryDisplay(block);
    return { ...block, displayType: classification.displayType, presentationStatus: classification.status };
  }), [library]);
  const sections = useMemo(() => sectionLibraryByDisplayType(libraryWithStatus), [libraryWithStatus]);
  const statusCounts = useMemo(() => libraryWithStatus.reduce((acc, block) => ({ ...acc, [block.presentationStatus!]: (acc[block.presentationStatus!] ?? 0) + 1 }), {} as Record<string, number>), [libraryWithStatus]);
  const shelves = useMemo(() => buildAssetShelves({ blocks: libraryWithStatus, neoblocks: savedNeoBlocks as NeoBlock[], neostacks: savedNeoStacks as NeoStack[], sleeves: savedSleeves as Sleeve[], sourceAuditItems: sourceAuditData as SourceAuditItem[] }), [libraryWithStatus]);
  const currentShelf = shelves.find((shelf) => shelf.id === activeShelf) ?? shelves[0];
  const visibleItems = useMemo(() => {
    let items = searchShelfAssets(currentShelf.items, { query: search, tags: tagFilters });
    if (activeShelf === 'molt_blocks') {
      items = items.filter((item) => {
        const block = item.asset as UMGBlock;
        return (roleFilter === 'all' || block.displayType === roleFilter) && (statusFilter === 'all' || block.presentationStatus === statusFilter);
      });
    }
    return items;
  }, [currentShelf, search, tagFilters, activeShelf, roleFilter, statusFilter]);
  const visibleTags = useMemo(() => [...new Set(currentShelf.items.flatMap((item) => item.tags))].filter(Boolean).slice(0, 24), [currentShelf]);
  const graph = workspace?.graph;
  const selectedBlock = useMemo(() => selected ? findWorkspaceBlock(workspace, selected.sourceId) : undefined, [workspace, selected]);
  const inspectedBlock = isUMGBlock(inspected) ? inspected : undefined;
  const inspectorBlock = inspectedBlock ?? selectedBlock;
  const inspectorViews = useMemo(() => inspectorBlock ? buildBlockInspectorViews(inspectorBlock, {
    graphNode: selected?.sourceId === inspectorBlock.id ? selected : undefined,
    irRow: compiled?.irMatrix.find((row) => row.nodeId === inspectorBlock.id),
    trace: compiled?.trace
  }) : undefined, [inspectorBlock, selected, compiled]);

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
    if (!compiled) return setStatus('compile first');
    if (!config.endpoint) { setOutput('Hermes endpoint not configured. Compile/export remains available without Hermes.'); return setStatus('Hermes generation blocked: not configured'); }
    const result = await generateWithHermes(request, compiled, config);
    setOutput(result.output);
    setStatus(result.ok ? 'Hermes generation complete' : 'Hermes generation blocked');
  };

  return <div className="app">
    <header><div><b>UMG Studio v0.1</b><span>local graph cognition studio</span></div><button onClick={() => downloadJson('umg-workspace.json', workspace)}>Export Workspace</button></header>
    <main>
      <section className="compose card"><h2>Compose</h2><textarea value={request} onChange={(event) => setRequest(event.target.value)} /><div className="row"><select value={target} onChange={(event) => setTarget(event.target.value)}><option value="chatbot">Chatbot</option><option value="business_template">Business Template</option><option value="website_prompt">Website Prompt</option><option value="umg_sleeve">UMG Sleeve</option></select><select value={depth} onChange={(event) => setDepth(event.target.value as any)}><option>lean</option><option>balanced</option><option>full</option></select><button className="primary" onClick={compose}>Compose Blocks</button><button onClick={compile}>Compile</button><button onClick={generate}>Generate</button></div><p>{status}</p></section>
      <section className="library card">
        <ShelfControls shelves={shelves} activeShelf={activeShelf} setActiveShelf={(shelf: ShelfMode) => { setActiveShelf(shelf); setTagFilters([]); }} search={search} setSearch={setSearch} tagFilters={tagFilters} setTagFilters={setTagFilters} visibleTags={visibleTags} filtered={Boolean(search || tagFilters.length || roleFilter !== 'all' || statusFilter !== defaultStatusFilter)} shown={visibleItems.length} total={currentShelf.items.length} clear={() => { setSearch(''); setTagFilters([]); setRoleFilter('all'); setStatusFilter(defaultStatusFilter); }} />
        {activeShelf === 'molt_blocks' && <BuilderShelfHeader roleFilter={roleFilter} statusFilter={statusFilter} shown={visibleItems.length} total={currentShelf.items.length} aiInstructionCount={libraryWithStatus.filter((block) => block.sourceLayer === 'AI' && block.role === 'instruction').length} aiSubjectCount={libraryWithStatus.filter((block) => block.sourceLayer === 'AI' && block.role === 'subject').length} aiPrimaryCount={libraryWithStatus.filter((block) => block.sourceLayer === 'AI' && block.role === 'primary').length} aiDirectiveCount={libraryWithStatus.filter((block) => block.sourceLayer === 'AI' && block.role === 'directive').length} />}
        {activeShelf === 'source_audit' && <AuditShelfBanner total={currentShelf.items.length} />}
        {activeShelf === 'molt_blocks' && <div className="filterGroup"><b>Role filter</b><div className="filterBar roleSubsections"><button className={roleFilter === 'all' ? 'hot roleHot' : ''} onClick={() => setRoleFilter('all')}>All MOLT + Meta ({libraryWithStatus.length})</button>{roles.map((role) => <button key={role} className={roleFilter === role ? 'hot roleHot' : ''} onClick={() => setRoleFilter(role)}>{labelDisplayType(role)} ({libraryWithStatus.filter((block) => block.displayType === role).length})</button>)}<button className={roleFilter === 'meta' ? 'hot metaHot roleHot' : ''} onClick={() => setRoleFilter('meta')}>Meta ({libraryWithStatus.filter((block) => block.displayType === 'meta').length})</button></div></div>}
        {activeShelf === 'molt_blocks' && <div className="filterGroup"><b>Status filter</b><div className="filterBar small statusFilters">{statuses.map((s) => <button key={s} className={statusFilter === s ? 'hot' : ''} onClick={() => setStatusFilter(s)}>{s} {String(s === 'all' ? libraryWithStatus.length : statusCounts[s] ?? 0)}</button>)}</div></div>}
        {activeShelf === 'source_audit' ? <SourceAuditTable items={visibleItems} onInspect={inspectAsset} /> : <AssetCards items={visibleItems} onAdd={addAsset} onInspect={inspectAsset} />}
        {activeShelf === 'molt_blocks' && <details className="secondaryAudit"><summary>Source Assets / Audit — secondary import accountability</summary><LibraryAudit report={migrationReport as any} />{sections.map((section) => <div key={section.type}>{section.label} ({section.blocks.length})</div>)}</details>}
      </section>
      <section className="graph card"><div className="bar"><h2>Graph Studio</h2><button onClick={() => workspace && downloadJson('sleeve.json', workspace.sleeves[0])}>Export Sleeve</button><button onClick={() => compiled && downloadJson('ir-matrix.json', compiled.irMatrix)}>Export IR</button><button onClick={() => compiled && downloadJson('hermes-packet.json', exportHermesPacket(request, compiled, config))}>Export Hermes Packet</button></div>{graph ? <Graph nodes={graph.nodes} edges={graph.edges} selected={selected?.id} onPick={(node) => { setSelected(node); setInspected(undefined); }} /> : <div className="empty">Describe what you want to build, then click Compose Blocks.</div>}</section>
      <aside className="inspect card"><h2>Inspector / Config</h2>{selected && <div className="report"><span>node {selected.label}</span><span>type {selected.nodeType}</span><span>active {String(selected.state.active)}</span><span>off {String(selected.state.off)}</span><span>triggered {String(selected.state.triggered)}</span><button onClick={toggleSelected}>Toggle on/off</button></div>}<BlockInspector views={inspectorViews} fallback={inspected} activeTab={inspectorTab} setActiveTab={setInspectorTab} /><h3>Hermes</h3><div className="report"><span>status {hermesStatus}</span><span>API key redacted: {redactKey(config.apiKey) || 'not set'}</span><span>Exports exclude API keys.</span></div><input placeholder="Hermes endpoint" value={config.endpoint} onChange={(event) => setConfig({ ...config, endpoint: event.target.value })} /><input placeholder="API key" type="password" value={config.apiKey ?? ''} onChange={(event) => setConfig({ ...config, apiKey: event.target.value })} /><input aria-label="Hermes model" value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} /><button onClick={async () => { const result = await testHermesConnection(config); setHermesStatus(result.ok ? 'test passed' : 'test failed'); setStatus(`Hermes ${result.message}`); }}>Test Connection</button></aside>
      <section className="drawer card"><h2>Compiler / Runtime</h2><div className="tabs"><button>RuntimeSpec</button><button>Trace</button><button>IR Matrix</button><button>Output</button></div><pre>{renderRuntime(workspace, compiled, output)}</pre></section>
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

function ShelfControls({ shelves, activeShelf, setActiveShelf, search, setSearch, tagFilters, setTagFilters, visibleTags, filtered, shown, total, clear }: any) {
  const toggleTag = (tag: string) => setTagFilters(tagFilters.includes(tag) ? tagFilters.filter((t: string) => t !== tag) : [...tagFilters, tag]);
  const searchLabel = activeShelf === 'source_audit' ? 'Search audit accountability rows' : 'Search active builder shelf first';
  return <><div className="shelfTabs">{shelves.map((shelf: any) => <button key={shelf.id} className={activeShelf === shelf.id ? 'hot activeShelfTab' : ''} onClick={() => setActiveShelf(shelf.id)}>{shelf.label} ({shelf.items.length})</button>)}</div><label className="searchLabel">{searchLabel}<input placeholder="title, INST id, tags, sourcePath, role/status" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{filtered && <div className="filterNotice"><b>Filtered view active</b><span>{shown} of {total} shown</span><button onClick={clear}>Clear filters</button></div>}{tagFilters.length > 0 && <div className="activeTags"><b>Active filters</b>{tagFilters.map((tag: string) => <button key={tag} className="tag active" onClick={() => toggleTag(tag)}>{tag} ×</button>)}</div>}<div className="tagCloud">{visibleTags.map((tag: string) => <button key={tag} className={`tag ${tagFilters.includes(tag) ? 'active' : ''}`} onClick={() => toggleTag(tag)}>{tag}</button>)}</div></>;
}

function BuilderShelfHeader({ roleFilter, statusFilter, shown, total, aiInstructionCount, aiSubjectCount, aiPrimaryCount, aiDirectiveCount }: { roleFilter: string; statusFilter: string; shown: number; total: number; aiInstructionCount: number; aiSubjectCount: number; aiPrimaryCount: number; aiDirectiveCount: number }) {
  const roleLabel = labelDisplayType(roleFilter);
  const statusLabel = labelDisplayType(statusFilter);
  const visibleLabel = roleFilter === 'all' ? 'MOLT + Meta cards' : `${roleLabel} cards`;
  return <div className="shelfHero builderHero"><b>Active shelf: MOLT Blocks</b><span>Active role: {roleLabel}</span><span>Active status: {statusLabel}</span><span>{shown} {visibleLabel} visible</span><span>{shown} of {total} individual MOLT cards visible</span><span>AI directive cards available: {aiDirectiveCount}</span><span>AI instruction cards available: {aiInstructionCount}</span><span>AI subject cards available: {aiSubjectCount}</span><span>AI primary cards available: {aiPrimaryCount}</span></div>;
}

function AuditShelfBanner({ total }: { total: number }) {
  return <div className="shelfHero auditHero"><b>Source Assets / Audit</b><span>Audit only — not builder shelf</span><span>Import accountability rows: {total}</span><span>Use MOLT Blocks → Instruction for editable builder cards.</span></div>;
}

function SourceAuditTable({ items, onInspect }: { items: ShelfAsset[]; onInspect: (item: ShelfAsset) => void }) {
  return <div className="auditTable"><div className="auditHeader"><span>title</span><span>detected type</span><span>role</span><span>outcome</span><span>source / reason</span></div>{items.map((item, index) => { const audit = item.asset as SourceAuditItem; return <div key={`${item.id}:${index}`} className={`auditRow outcome-${audit.outcome}`}><span><b>{audit.title}</b><small>{audit.tags.join(', ') || 'no tags'}</small></span><span>{audit.detectedType}</span><span>{audit.normalizedRole ?? 'n/a'}</span><span className="badge">{audit.outcome}</span><span><code>{audit.sourcePath}</code><small>{audit.reason ?? 'accounted'}</small><button onClick={() => onInspect(item)}>Inspect JSON / Legacy Source</button></span></div>; })}</div>;
}

function AssetCards({ items, onAdd, onInspect }: { items: ShelfAsset[]; onAdd: (item: ShelfAsset) => void; onInspect: (item: ShelfAsset) => void }) {
  return <div className="cards builderCards">{items.map((item, index) => {
    const block = item.asset as UMGBlock;
    const instId = item.kind === 'molt_block' ? block.legacy?.libraryEntryId : undefined;
    const category = item.kind === 'molt_block' ? block.category : undefined;
    return <div key={`${item.id}:${item.sourcePath ?? 'local'}:${index}`} className={`block builderBlock asset-${item.kind} ${item.displayType === 'meta' ? 'metaCard' : ''}`}><div className="cardtop"><b>{item.title}</b><span className="badge">{item.displayType === 'meta' ? 'Meta / non-compiler' : item.kind === 'molt_block' ? 'MOLT Block Card' : item.kind}</span></div>{instId && <p className="instId">ID: {instId}</p>}<p>role: {item.containedRoles.map(labelDisplayType).join(', ') || item.kind}</p>{category && <p>category: {category}</p>}<p>status: {item.status || 'runnable'}</p><small>tags: {item.tags.slice(0, 12).join(', ') || 'no tags'}</small><small>sourcePath: {item.sourcePath ?? 'local asset'}</small><div className="row"><button onClick={() => onAdd(item)}>{item.kind === 'sleeve' ? 'Open Sleeve' : 'Add to Workspace'}</button><button onClick={() => onInspect(item)}>Inspect JSON / Legacy Source</button></div></div>;
  })}</div>;
}

function Graph({ nodes, edges, selected, onPick }: { nodes: GraphNode[]; edges: any[]; selected?: string; onPick: (node: GraphNode) => void }) {
  return <div className="canvas">{edges.map((edge) => <svg key={edge.id} className="edge" style={{ left: 0, top: 0 }}><line x1={edge.sourcePosition?.x ?? 40} y1={edge.sourcePosition?.y ?? 40} x2={edge.targetPosition?.x ?? 180} y2={edge.targetPosition?.y ?? 120} stroke="#4b5563" /></svg>)}{nodes.map((node) => <button key={node.id} className={`node ${selected === node.id ? 'picked' : ''} ${node.state.active ? 'active' : ''} ${node.state.off ? 'off' : ''} ${node.state.triggered ? 'triggered' : ''} ${node.state.invalid ? 'invalid' : ''}`} style={{ left: node.position.x, top: node.position.y }} onClick={() => onPick(node)}><b>{node.label}</b><small>{node.nodeType}</small>{node.state.warning && <em>{node.state.warning}</em>}</button>)}</div>;
}

function BlockInspector({ views, fallback, activeTab, setActiveTab }: { views?: ReturnType<typeof buildBlockInspectorViews>; fallback?: unknown; activeTab: InspectorTab; setActiveTab: (tab: InspectorTab) => void }) {
  if (!views && !fallback) return <div className="empty">Select or inspect a block to view Card / Runtime / NL / JSON / Legacy Source.</div>;
  if (!views) return <><h3>Inspect JSON / Legacy Source</h3><pre>{JSON.stringify(fallback, null, 2)}</pre></>;
  const body = activeTab === 'Card' ? views.card
    : activeTab === 'Runtime' ? views.runtime.runtimeState
    : activeTab === 'NL' ? views.nl
    : activeTab === 'JSON' ? views.compilerJson
    : activeTab === 'Legacy Source' ? views.legacySource
    : activeTab === 'Trace' ? views.trace ?? []
    : views.irRow ?? { message: 'Compile to populate IR Row from IR Matrix source of truth.' };
  return <div className="blockInspector"><div className="tabs inspectorTabs">{inspectorTabs.map((tab) => <button key={tab} className={activeTab === tab ? 'hot' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div><div className="report"><span>model SearchCard / RuntimeBlock / FullSourceRecord</span><span>NL/JSON sync rule: derived from the same normalized block</span><span>IR Matrix source of truth; Glyph Matrix graph projection layer</span><span>Off is runtime state; Merge is action/synthesis, not MOLT type</span></div>{activeTab === 'NL' ? <pre>{String(body)}</pre> : <pre>{JSON.stringify(body, null, 2)}</pre>}</div>;
}

function isUMGBlock(value: unknown): value is UMGBlock {
  return Boolean(value && typeof value === 'object' && (value as UMGBlock).type === 'molt_block' && (value as UMGBlock).role && (value as UMGBlock).content !== undefined);
}

function findWorkspaceBlock(workspace: UMGWorkspace | undefined, sourceId: string) {
  for (const sleeve of workspace?.sleeves ?? []) for (const stack of sleeve.stacks) {
    for (const neoblock of stack.neoblocks) for (const block of neoblock.blocks) if (block.id === sourceId) return block;
    for (const block of stack.directBlocks ?? []) if (block.id === sourceId) return block;
  }
  return undefined;
}

function renderRuntime(workspace?: UMGWorkspace, compiled?: CompileResult, output?: string) {
  return JSON.stringify({ workspace: workspace?.sleeves[0], runtimeSpec: compiled?.runtimeSpec, trace: compiled?.trace, diagnostics: compiled?.diagnostics, irMatrix: compiled?.irMatrix, output }, null, 2);
}

function labelDisplayType(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
