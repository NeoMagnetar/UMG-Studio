import { useEffect, useMemo, useRef, useState } from 'react';
import './style.css';
import rawBlocks from '../data/library/blocks.json';
import normalizedBlocks from '../data/library/normalized-blocks.json';
import migrationReport from '../data/library/migration-report.json';
import { getLibraryAssetStatus, normalizeImportedBlocks } from './lib/umg/migrateLibrary';
import { composeBlocks } from './lib/umg/composeBlocks';
import { applyCompileResultToGraph, applyManualLayout, applySnapLayout, buildGraphFromSleeve, focusGraph, openSelectedAsFocus, resetManualLayout } from './lib/umg/graphBuilder';
import { compileWorkspaceToRuntime } from './lib/umg/compilerBridge';
import { downloadJson, exportHermesPacket } from './lib/umg/exporters';
import { generateWithHermes, redactKey, testHermesConnection } from './lib/hermes/hermesClient';
import { CompileResult, GraphFocusMode, GraphNode, HermesConfig, LibraryAssetStatus, UMGBlock, UMGWorkspace } from './lib/umg/types';
import { loadWorkbenchLayout, saveWorkbenchLayout, WorkbenchLayoutState } from './lib/umg/workbenchLayout';
import { addWorkbenchBlockByRole, MOLT_ROLE_COLORS, MOLT_ROLE_ORDER, saveWorkbenchBlockToLibrary, toggleWorkbenchBlock, updateWorkbenchBlockContent, validateHermesWorkbenchGeneration } from './lib/umg/moltWorkbench';

const demo = 'Build me a customer-intake chatbot for a mobile detailing business. It should answer basic questions, collect customer name, vehicle type, location, service need, and budget, then produce a clean lead summary.';
const roles = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];
const statuses: Array<'all' | LibraryAssetStatus> = ['all', 'runnable', 'warning-bearing', 'reference-only', 'unsupported'];

type ResizeTarget = 'left' | 'right' | 'bottom';

export default function App() {
  const [mode, setMode] = useState<'simple' | 'builder' | 'creator'>('simple');
  const [request, setRequest] = useState(demo);
  const [target, setTarget] = useState('chatbot');
  const [depth, setDepth] = useState<'lean' | 'balanced' | 'full'>('balanced');
  const [layout, setLayout] = useState<WorkbenchLayoutState>(() => loadWorkbenchLayout(typeof window !== 'undefined' ? window.localStorage : undefined));
  const [library, setLibrary] = useState<UMGBlock[]>(() => [
    ...normalizeImportedBlocks(rawBlocks as unknown[], 'data/library/blocks.json', 'UMG Studio Sample Library'),
    ...(normalizedBlocks as UMGBlock[])
  ]);
  const [workspace, setWorkspace] = useState<UMGWorkspace | undefined>();
  const [selected, setSelected] = useState<GraphNode | undefined>();
  const [inspectedBlock, setInspectedBlock] = useState<UMGBlock | undefined>();
  const [compiled, setCompiled] = useState<CompileResult | undefined>();
  const [tab, setTab] = useState('Prompt');
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | LibraryAssetStatus>('all');
  const [search, setSearch] = useState('');
  const [config, setConfig] = useState<HermesConfig>({ endpoint: import.meta.env.VITE_HERMES_ENDPOINT || '', apiKey: import.meta.env.VITE_HERMES_API_KEY || '', model: import.meta.env.VITE_HERMES_MODEL || 'hermes-default', temperature: .3, maxTokens: 1200 });
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState(`ready; imported ${(migrationReport as any).importedBlocks} upstream blocks`);
  const [focusMode, setFocusMode] = useState<GraphFocusMode>('sleeve');
  const [focusSourceId, setFocusSourceId] = useState<string | undefined>();
  const [hermesStatus, setHermesStatus] = useState<'not configured' | 'configured' | 'test passed' | 'test failed'>(config.endpoint ? 'configured' : 'not configured');
  const [editingBlockId, setEditingBlockId] = useState<string | undefined>();
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [moltRoleTab, setMoltRoleTab] = useState<'all' | typeof roles[number]>('all');
  const [moltSearch, setMoltSearch] = useState('');

  useEffect(() => { saveWorkbenchLayout(window.localStorage, layout); }, [layout]);

  const libraryWithStatus = useMemo(() => library.map((b) => ({ ...b, presentationStatus: getLibraryAssetStatus(b) })), [library]);
  const statusCounts = useMemo(() => libraryWithStatus.reduce((acc, b) => ({ ...acc, [b.presentationStatus!]: (acc[b.presentationStatus!] ?? 0) + 1 }), {} as Record<LibraryAssetStatus, number>), [libraryWithStatus]);
  const visible = libraryWithStatus.filter((b) => (filter === 'all' || b.role === filter) && (statusFilter === 'all' || b.presentationStatus === statusFilter) && (`${b.title} ${b.tags.join(' ')} ${b.content} ${b.legacy?.sourcePath ?? ''}`.toLowerCase().includes(search.toLowerCase())));
  const inspectorObject = inspectedBlock ?? (selected ? findSource(workspace, selected.sourceId) : undefined);
  const selectedLineage = useMemo(() => lineageForNode(workspace, selected?.sourceId ?? focusSourceId), [workspace, selected?.sourceId, focusSourceId]);
  const selectedIrRow = useMemo(() => selected ? compiled?.irMatrix.find((row) => row.nodeId === selected.sourceId) : undefined, [compiled, selected]);
  const focusedGraph = useMemo(() => workspace ? focusGraph(workspace.graph, { mode: focusMode, sourceId: focusSourceId }) : undefined, [workspace, focusMode, focusSourceId]);

  const composed = () => {
    const c = composeBlocks({ freeform_request: request, target_type: target as any, depth }, libraryWithStatus);
    const graph = buildGraphFromSleeve(c.draft_sleeve);
    setWorkspace({ id: 'ws_local', title: 'Local UMG Workspace', activeSleeveId: c.draft_sleeve.id, sleeves: [c.draft_sleeve], libraryRefs: library.map((b) => b.id), graph });
    setCompiled(undefined);
    setSelected(undefined);
    setFocusMode('sleeve');
    setFocusSourceId(c.draft_sleeve.id);
    setStatus(`composed ${c.selected_nodes.length} nodes; ${c.warnings.length} warnings`);
  };
  const compile = () => {
    if (!workspace) return setStatus('no workspace');
    const c = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'mobile-detailing'] });
    const graph = applyCompileResultToGraph(workspace.graph, c);
    setWorkspace({ ...workspace, graph, runtime: { id: `run_${Date.now()}`, request, activeSleeveId: workspace.activeSleeveId || workspace.sleeves[0].id, compiledAt: new Date().toISOString(), runtimeSpec: c.runtimeSpec, trace: c.trace, irMatrix: c.irMatrix, compiledPrompt: c.promptPreview, diagnostics: c.diagnostics } });
    setCompiled(c);
    setTab('Prompt');
    setStatus(`compiled with ${c.diagnostics.length} diagnostics`);
  };
  const toggleNode = (n: GraphNode) => {
    if (!workspace) return;
    const ws = structuredClone(workspace);
    for (const s of ws.sleeves[0].stacks) for (const nb of s.neoblocks) for (const b of nb.blocks) if (b.id === n.sourceId) b.defaultState = b.defaultState === 'off' ? 'on' : 'off';
    ws.graph = buildGraphFromSleeve(ws.sleeves[0]);
    setWorkspace(ws);
    setSelected(undefined);
    setCompiled(undefined);
  };
  const addBlock = (b: UMGBlock) => {
    if (!workspace) { setStatus('compose a workspace first'); return; }
    if (getLibraryAssetStatus(b) !== 'runnable' && getLibraryAssetStatus(b) !== 'warning-bearing') { setStatus(`${b.title} is ${getLibraryAssetStatus(b)} and was not added`); return; }
    const ws = structuredClone(workspace);
    ws.sleeves[0].stacks[0].neoblocks[0].blocks.push({ ...b, id: `${b.id}_copy_${Date.now()}`, source: { origin: 'workspace', sourceId: b.id, version: '0.1' } });
    ws.graph = buildGraphFromSleeve(ws.sleeves[0]);
    setWorkspace(ws);
    setStatus(`added workspace copy of ${b.title}`);
  };
  const focusSleeve = () => { const id = workspace?.sleeves[0].id; setFocusMode('sleeve'); setFocusSourceId(id); };
  const focusStack = () => { const id = selectedLineage.stack?.id ?? workspace?.sleeves[0].stacks[0]?.id; setFocusMode('neostack'); setFocusSourceId(id); };
  const focusBlock = () => { const id = selectedLineage.neoblock?.id ?? workspace?.sleeves[0].stacks[0]?.neoblocks[0]?.id; setFocusMode('neoblock'); setFocusSourceId(id); };
  const focusMolt = () => { const id = selectedLineage.block?.id ?? selectedLineage.neoblock?.blocks[0]?.id ?? workspace?.sleeves[0].stacks[0]?.neoblocks[0]?.blocks[0]?.id; if (id) { setFocusMode('molt_block'); setFocusSourceId(id); } };
  const openSelected = () => { if (!selected) return; const next = openSelectedAsFocus(selected, { mode: focusMode, sourceId: focusSourceId }); setFocusMode(next.mode); setFocusSourceId(next.sourceId); };
  const goBack = () => { if (focusMode === 'molt_block') return focusBlock(); if (focusMode === 'neoblock') return focusStack(); if (focusMode === 'neostack') return focusSleeve(); resetView(); };
  const resetView = () => { setSelected(undefined); setInspectedBlock(undefined); focusSleeve(); };
  const updateConfig = (patch: Partial<HermesConfig>) => { const next = { ...config, ...patch }; setConfig(next); setHermesStatus(next.endpoint ? 'configured' : 'not configured'); };
  const resize = (target: ResizeTarget, event: React.PointerEvent) => startResize(target, event, layout, setLayout);
  const moveNode = (node: GraphNode, x: number, y: number) => {
    if (!workspace) return;
    let graph = applyManualLayout(workspace.graph, node.sourceId, { x, y, relation: node.layout?.relation ?? 'contains', priorityRank: node.layout?.priorityRank, manual: true, manualOverride: true });
    if (node.nodeType === 'neoblock') {
      const target = graph.nodes.find((candidate) => candidate.nodeType === 'neoblock' && candidate.sourceId !== node.sourceId && Math.abs(candidate.position.y - y) <= 28 && Math.abs(candidate.position.x - x) <= 280);
      if (target) graph = applySnapLayout(graph, node.sourceId, target.sourceId, { threshold: 20, relation: y < target.position.y ? 'governs' : Math.abs(y - target.position.y) <= 28 ? 'parallel' : 'supports' });
    }
    setWorkspace({ ...workspace, graph });
  };
  const resetLayout = () => {
    if (!workspace) return;
    setWorkspace({ ...workspace, graph: resetManualLayout(workspace.graph, selected?.sourceId) });
    setStatus(selected ? `reset layout for ${selected.label}` : 'reset layout');
  };
  const updateActiveNeoBlock = (next: ReturnType<typeof addWorkbenchBlockByRole>) => {
    if (!workspace || !selectedLineage.neoblock) return;
    const ws = structuredClone(workspace);
    for (const stack of ws.sleeves[0].stacks) stack.neoblocks = stack.neoblocks.map((nb) => nb.id === selectedLineage.neoblock?.id ? next : nb);
    const oldGraph = ws.graph;
    ws.graph = buildGraphFromSleeve(ws.sleeves[0]);
    ws.graph.nodes = ws.graph.nodes.map((node) => oldGraph.nodes.find((old) => old.sourceId === node.sourceId)?.layout?.manual ? { ...node, ...oldGraph.nodes.find((old) => old.sourceId === node.sourceId)! } : node);
    setWorkspace(ws);
    setCompiled(undefined);
  };
  const addMoltRole = (role: any) => {
    const nb = selectedLineage.neoblock ?? workspace?.sleeves[0].stacks[0]?.neoblocks[0];
    if (!nb) return setStatus('select a NeoBlock first');
    updateActiveNeoBlock(addWorkbenchBlockByRole(nb, role));
    setStatus(`added ${role} block to MOLT workbench`);
  };
  const saveMoltEdit = (blockId: string) => {
    const nb = selectedLineage.neoblock;
    if (!nb) return;
    updateActiveNeoBlock(updateWorkbenchBlockContent(nb, blockId, draftContent, draftTitle));
    setEditingBlockId(undefined);
    setStatus('saved inline MOLT block edit');
  };
  const toggleMolt = (blockId: string) => { if (selectedLineage.neoblock) updateActiveNeoBlock(toggleWorkbenchBlock(selectedLineage.neoblock, blockId)); };
  const saveMoltToLibrary = (block: UMGBlock) => { const saved = saveWorkbenchBlockToLibrary(block, `Saved ${block.title}`); setLibrary([...library, saved]); setStatus(`saved ${saved.title} to local library`); };
  const addNeoBlock = () => {
    if (!workspace) return;
    const ws = structuredClone(workspace);
    const stack = selectedLineage.stack ?? ws.sleeves[0].stacks[0];
    const targetStack = ws.sleeves[0].stacks.find((s) => s.id === stack.id) ?? ws.sleeves[0].stacks[0];
    targetStack.neoblocks.push({ id: `nb_manual_${Date.now()}`, title: 'Manual NeoBlock', type: 'neoblock', description: 'User-created NeoBlock card', category: 'workspace', tags: ['manual'], blocks: [], defaultState: 'on', priorityOrder: targetStack.neoblocks.length });
    ws.graph = buildGraphFromSleeve(ws.sleeves[0]);
    setWorkspace(ws);
    setStatus('added NeoBlock card');
  };
  const unlockSelected = () => {
    if (!workspace || !selected) return;
    setWorkspace({ ...workspace, graph: applyManualLayout(workspace.graph, selected.sourceId, { locked: false, snapTargetId: undefined, snapGroupId: undefined, manual: true }) });
    setStatus(`unlocked ${selected.label}`);
  };
  const snapSelected = () => {
    if (!workspace || !selected || selected.nodeType !== 'neoblock') return;
    const target = workspace.graph.nodes.find((node) => node.nodeType === 'neoblock' && node.sourceId !== selected.sourceId);
    if (!target) return setStatus('no NeoBlock target to snap');
    setWorkspace({ ...workspace, graph: applySnapLayout(workspace.graph, selected.sourceId, target.sourceId, { threshold: 280, relation: 'parallel' }) });
    setStatus(`snapped ${selected.label} to ${target.label}`);
  };
  const generateMoltOutput = async () => {
    const validation = validateHermesWorkbenchGeneration(config);
    if (!validation.ok) { setOutput(validation.message); setTab('Output'); setStatus('Hermes generation blocked: not configured'); return; }
    if (!compiled) return setStatus('compile first');
    const r = await generateWithHermes(request, compiled, config);
    setOutput(r.output);
    setTab('Output');
    setStatus(r.ok ? 'MOLT workbench generation complete' : 'MOLT workbench generation blocked');
  };

  const visibleGraph = focusMode === 'neoblock' && workspace ? neoBlockBoardGraph(workspace, selectedLineage.stack?.id ?? focusSourceId) : focusedGraph;

  return <div className="app"><header><div><b>UMG Studio v0.1</b><span>local graph cognition studio</span></div><nav>{['simple', 'builder', 'creator'].map((m) => <button key={m} className={mode === m ? 'hot' : ''} onClick={() => setMode(m as any)}>{m}</button>)}</nav><button onClick={() => downloadJson('umg-workspace.json', workspace)}>Export Workspace</button></header>
    <main className={`${layout.leftCollapsed ? 'leftCollapsed' : ''} ${layout.rightCollapsed ? 'rightCollapsed' : ''} ${layout.bottomCollapsed ? 'bottomCollapsed' : ''}`} style={{ ['--leftWidth' as any]: `${layout.leftWidth}px`, ['--rightWidth' as any]: `${layout.rightWidth}px`, ['--bottomHeight' as any]: `${layout.bottomHeight}px` }}>
      <section className="compose card"><h2>Compose</h2><textarea value={request} onChange={e => setRequest(e.target.value)} /><div className="row"><select value={target} onChange={e => setTarget(e.target.value)}><option value="chatbot">Chatbot</option><option value="business_template">Business Template</option><option value="website_prompt">Website Prompt</option><option value="umg_sleeve">UMG Sleeve</option></select><select value={depth} onChange={e => setDepth(e.target.value as any)}><option>lean</option><option>balanced</option><option>full</option></select><button className="primary" onClick={composed}>Compose Blocks</button><button onClick={compile}>Compile</button><button onClick={async () => { if (!compiled) return setStatus('compile first'); if (!config.endpoint) { setHermesStatus('not configured'); setOutput('Hermes endpoint not configured. Compile/export remains available without Hermes.'); setTab('Output'); return setStatus('Hermes generation blocked: not configured'); } const r = await generateWithHermes(request, compiled, config); setOutput(r.output); setTab('Output'); setHermesStatus(r.ok ? 'test passed' : 'test failed'); setStatus(r.ok ? 'Hermes generation complete' : 'Hermes generation blocked'); }}>Generate</button></div><p>{status}</p></section>
      <section className="library card"><div className="panelTitle"><h2>Library</h2><button onClick={() => setLayout({ ...layout, leftCollapsed: !layout.leftCollapsed })}>{layout.leftCollapsed ? 'Expand' : 'Collapse'}</button></div><div className="report"><b>Migration Report</b><span>blocks {(migrationReport as any).importedBlocks}</span><span>sleeves {(migrationReport as any).importedSleeves}</span><span>HUMAN skipped {(migrationReport as any).skippedHumanReferences}</span><span>unsupported {((migrationReport as any).unsupportedRoles || []).join(', ') || 'none'}</span></div><input placeholder="search title/tags/content/source" value={search} onChange={e => setSearch(e.target.value)} /><select value={filter} onChange={e => setFilter(e.target.value)}><option>all</option>{roles.map((r) => <option key={r}>{r}</option>)}</select><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>{statuses.map((s) => <option key={s}>{s}{s !== 'all' ? ` (${statusCounts[s] ?? 0})` : ''}</option>)}</select><div className="cards">{visible.map((b, i) => <div className={`block ${b.presentationStatus}`} key={`${b.id}:${b.legacy?.sourcePath ?? 'local'}:${i}`}><div className="cardtop"><b>{b.title}</b><span className="badge">{b.presentationStatus}</span></div><small>type {b.type} • role {b.role} • {b.category}</small><p>{b.content || 'Reference asset: no runnable content extracted.'}</p><em>{b.tags.join(', ') || 'no tags'}</em><small>source {b.legacy?.sourcePath ?? 'local sample'}</small><div className="row"><button onClick={() => { setInspectedBlock(b); setSelected(undefined); }}>Inspect JSON</button><button onClick={() => addBlock(b)}>Add workspace copy</button></div></div>)}</div></section>
      <div className="split vertical leftSplit" onPointerDown={(event) => resize('left', event)} role="separator" aria-label="Resize library panel" />
      <section className="graph card"><div className="bar"><h2>Graph Studio</h2><button onClick={() => workspace && downloadJson('sleeve.json', workspace.sleeves[0])}>Export Sleeve</button><button onClick={() => compiled && downloadJson('ir-matrix.json', compiled.irMatrix)}>Export IR</button><button onClick={() => compiled && downloadJson('hermes-packet.json', exportHermesPacket(request, compiled, config))}>Export Hermes Packet</button></div><div className="graphControls"><span className="badge">View: {viewLabel(focusMode)}</span><span className="crumb">{breadcrumb(selectedLineage)}</span><button onClick={focusSleeve}>Full Sleeve View</button><button onClick={focusStack}>NeoStack View</button><button onClick={focusBlock}>NeoBlock View</button><button onClick={focusMolt}>MOLT Block View</button><button onClick={openSelected}>Open Selected as View</button><button onClick={goBack}>Back</button><button onClick={resetLayout}>Reset Layout</button><button onClick={resetView}>Reset View</button>{focusMode === 'neoblock' && <button onClick={addNeoBlock}>Add NeoBlock</button>}{focusMode === 'neoblock' && selected?.nodeType === 'neoblock' && <button onClick={snapSelected}>Snap/Lock Selected</button>}{selected?.layout?.locked && <button onClick={unlockSelected}>Unlock/Detach</button>}</div>{workspace && visibleGraph ? focusMode === 'molt_block' ? <MoltWorkbench neoblock={selectedLineage.neoblock ?? workspace.sleeves[0].stacks[0]?.neoblocks[0]} selectedBlockId={selectedLineage.block?.id} library={libraryWithStatus} roleTab={moltRoleTab} search={moltSearch} editingId={editingBlockId} draftTitle={draftTitle} draftContent={draftContent} output={output} onRoleTab={setMoltRoleTab as any} onSearch={setMoltSearch} onAddRole={addMoltRole} onToggle={toggleMolt} onSaveLibrary={saveMoltToLibrary} onAddLibrary={addBlock} onEdit={(b: UMGBlock) => { setEditingBlockId(b.id); setDraftTitle(b.title); setDraftContent(b.content); }} onDraftTitle={setDraftTitle} onDraftContent={setDraftContent} onSaveEdit={saveMoltEdit} onCancelEdit={() => setEditingBlockId(undefined)} onGenerate={generateMoltOutput} /> : <Graph mode={focusMode} nodes={visibleGraph.nodes} edges={visibleGraph.edges} selected={selected?.id} onMove={moveNode} onPick={(n) => { setSelected(n); setInspectedBlock(undefined); }} /> : <div className="empty">Describe what you want to build, then click Compose Blocks.</div>}</section>
      <div className="split vertical rightSplit" onPointerDown={(event) => resize('right', event)} role="separator" aria-label="Resize inspector panel" />
      <aside className="inspect card"><div className="panelTitle"><h2>Inspector / Config</h2><button onClick={() => setLayout({ ...layout, rightCollapsed: !layout.rightCollapsed })}>{layout.rightCollapsed ? 'Expand' : 'Collapse'}</button></div>{inspectorObject ? <><b>{(inspectorObject as any).title ?? selected?.label}</b>{selected && <div className="report"><span>type {selected.nodeType}</span><span>status {nodeStatus(selected)}</span><span>runtime active {String(selected.state.active)}</span><span>runtime off {String(selected.state.off)}</span><span>triggered {String(selected.state.triggered)}</span><span>layout {selected.layout?.relation ?? 'contains'} {selected.layout?.manual ? 'manual' : 'auto'}</span></div>}{selected?.nodeType === 'molt_block' && <div className="report"><span>role {(inspectorObject as UMGBlock).role}</span><span>tags {((inspectorObject as UMGBlock).tags || []).join(', ') || 'none'}</span><span>content {((inspectorObject as UMGBlock).content || '').slice(0, 180)}</span><span>source {((inspectorObject as UMGBlock).legacy?.sourcePath || (inspectorObject as UMGBlock).source?.origin || 'workspace')}</span><span>IR row {selectedIrRow ? selectedIrRow.rowId : 'none'}</span></div>}{inspectedBlock && <p><span className="badge">{getLibraryAssetStatus(inspectedBlock)}</span> normalized JSON + legacy source data</p>}{selected?.nodeType === 'molt_block' && <button onClick={() => toggleNode(selected)}>Toggle on/off</button>}<h3>Normalized JSON</h3><pre>{JSON.stringify(inspectorObject, null, 2)}</pre>{selectedIrRow && <><h3>IR Matrix Row</h3><pre>{JSON.stringify(selectedIrRow, null, 2)}</pre></>}</> : <p>Select a graph node or inspect a library card.</p>}<h2>Config</h2><div className="report"><b>Hermes status: {hermesStatus}</b><span>API key redacted: {redactKey(config.apiKey) || 'not set'}</span><span>Exports exclude API keys.</span></div><input placeholder="Hermes endpoint" value={config.endpoint} onChange={e => updateConfig({ endpoint: e.target.value })} /><input placeholder="API key" type="password" value={config.apiKey || ''} onChange={e => updateConfig({ apiKey: e.target.value })} /><input aria-label="Hermes model" value={config.model} onChange={e => updateConfig({ model: e.target.value })} /><button onClick={async () => { const r = await testHermesConnection(config); setHermesStatus(r.ok ? 'test passed' : 'test failed'); setStatus(`Hermes ${r.message}`); }}>Test Connection</button></aside>
      <div className="split horizontal bottomSplit" onPointerDown={(event) => resize('bottom', event)} role="separator" aria-label="Resize compiler drawer" />
      <section className="drawer card"><div className="panelTitle"><h2>Compiler / Runtime</h2><button onClick={() => setLayout({ ...layout, bottomCollapsed: !layout.bottomCollapsed })}>{layout.bottomCollapsed ? 'Expand' : 'Collapse'}</button></div><div className="tabs">{['Input JSON', 'RuntimeSpec', 'Trace', 'Prompt', 'Diagnostics', 'IR Matrix', 'Output', 'Migration Report'].map(t => <button key={t} className={tab === t ? 'hot' : ''} onClick={() => setTab(t)}>{t}</button>)}</div><pre>{renderTab(tab, workspace, compiled, output)}</pre></section></main></div>;
}

function startResize(target: ResizeTarget, event: React.PointerEvent, startLayout: WorkbenchLayoutState, setLayout: React.Dispatch<React.SetStateAction<WorkbenchLayoutState>>) {
  event.preventDefault();
  const startX = event.clientX;
  const startY = event.clientY;
  const move = (event: PointerEvent) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    setLayout((current) => {
      if (target === 'left') return { ...current, leftCollapsed: false, leftWidth: Math.min(560, Math.max(220, startLayout.leftWidth + dx)) };
      if (target === 'right') return { ...current, rightCollapsed: false, rightWidth: Math.min(620, Math.max(260, startLayout.rightWidth - dx)) };
      return { ...current, bottomCollapsed: false, bottomHeight: Math.min(520, Math.max(150, startLayout.bottomHeight - dy)) };
    });
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function Graph({ mode, nodes, edges, selected, onPick, onMove }: { mode: GraphFocusMode; nodes: GraphNode[]; edges: any[]; selected?: string; onPick: (n: GraphNode) => void; onMove: (n: GraphNode, x: number, y: number) => void }) {
  const drag = useRef<{ node: GraphNode; x: number; y: number; left: number; top: number } | null>(null);
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    event.preventDefault();
    const nextX = Math.max(20, drag.current.left + event.clientX - drag.current.x);
    const nextY = Math.max(20, drag.current.top + event.clientY - drag.current.y);
    onMove(drag.current.node, nextX, nextY);
  };
  return <div className={`canvas ${mode}`} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}><svg>{edges.map(e => { const a = nodes.find(n => n.id === e.source), b = nodes.find(n => n.id === e.target); if (!a || !b) return null; return <line key={e.id} x1={a.position.x + 110} y1={a.position.y + 36} x2={b.position.x} y2={b.position.y + 36} />; })}</svg>{nodes.map(n => <button key={n.id} onClick={() => onPick(n)} onPointerDown={(event) => { drag.current = { node: n, x: event.clientX, y: event.clientY, left: n.position.x, top: n.position.y }; }} className={`node ${n.nodeType} ${n.state.off ? 'off' : 'active'} ${n.state.triggered ? 'triggered' : ''} ${n.state.warning ? 'warning' : ''} ${n.state.invalid ? 'invalid' : ''} ${n.visual?.focused ? 'focused' : ''} ${selected === n.id ? 'picked' : ''} ${n.layout?.locked ? 'locked' : ''}`} style={{ left: n.position.x, top: n.position.y }}><b>{n.label}</b><small>{n.nodeType}{n.layout?.relation ? ` • ${n.layout.relation}` : ''}{n.layout?.manual ? ' • manual' : ''}{n.layout?.locked ? ' • locked' : ''}{n.state.triggered ? ' ⚡' : ''}{n.state.warning ? ' ⚠' : ''}</small></button>)}</div>;
}

function MoltWorkbench({ neoblock, selectedBlockId, library, roleTab, search, editingId, draftTitle, draftContent, output, onRoleTab, onSearch, onAddRole, onToggle, onSaveLibrary, onAddLibrary, onEdit, onDraftTitle, onDraftContent, onSaveEdit, onCancelEdit, onGenerate }: any) {
  const filtered = library.filter((b: UMGBlock) => (roleTab === 'all' || b.role === roleTab) && `${b.title} ${b.content} ${b.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())).slice(0, 16);
  return <div className="moltWorkbench"><div className="workbenchHeader"><div><h3>MOLT Block Workbench</h3><p>Active stack summary: {neoblock?.title ?? 'No NeoBlock selected'} • {neoblock?.blocks?.filter((b: UMGBlock) => b.defaultState !== 'off').length ?? 0} active / {neoblock?.blocks?.length ?? 0} total</p></div><div className="row"><button onClick={onGenerate}>Generate / Regenerate</button><button onClick={() => navigator.clipboard?.writeText(output || neoblock?.blocks?.map((b: UMGBlock) => b.content).join('\n\n') || '')}>Copy Output</button></div></div><div className="roleMenu">{MOLT_ROLE_ORDER.map((role) => <button key={role} style={{ borderColor: MOLT_ROLE_COLORS[role] }} onClick={() => onAddRole(role)}>+ {role}</button>)}</div><div className="moltGrid">{MOLT_ROLE_ORDER.map((role) => <section key={role} className="roleColumn" style={{ borderColor: MOLT_ROLE_COLORS[role] }}><h4 style={{ color: MOLT_ROLE_COLORS[role] }}>{role}</h4>{(neoblock?.blocks ?? []).filter((b: UMGBlock) => b.role === role).map((b: UMGBlock) => <div key={b.id} className={`moltCard ${b.defaultState === 'off' ? 'off' : 'active'} ${b.id === selectedBlockId ? 'picked' : ''}`} style={{ ['--roleColor' as any]: MOLT_ROLE_COLORS[role] }}><div className="cardtop"><b>{b.title}</b><span className="badge">{b.defaultState}</span></div>{editingId === b.id ? <><input value={draftTitle} onChange={(e) => onDraftTitle(e.target.value)} /><textarea value={draftContent} onChange={(e) => onDraftContent(e.target.value)} /><div className="row"><button onClick={() => onSaveEdit(b.id)}>Save</button><button onClick={onCancelEdit}>Cancel</button></div></> : <><p>{b.content || 'Empty block content.'}</p><small>{b.tags.join(', ') || 'no tags'}</small><div className="row"><button onClick={() => onToggle(b.id)}>Toggle on/off</button><button onClick={() => onEdit(b)}>Edit</button><button onClick={() => onSaveLibrary(b)}>Save to Library</button></div></>}</div>)}</section>)}</div><aside className="moltLibrary"><div className="row"><b>Workbench Library</b><select value={roleTab} onChange={(e) => onRoleTab(e.target.value)}><option>all</option>{MOLT_ROLE_ORDER.map((role) => <option key={role}>{role}</option>)}</select><input placeholder="search saved/library blocks" value={search} onChange={(e) => onSearch(e.target.value)} /></div><div className="cards compact">{filtered.map((b: UMGBlock) => <div className="block runnable" key={`moltlib_${b.id}`}><b>{b.title}</b><small>{b.role} • {b.tags.join(', ')}</small><button onClick={() => onAddLibrary(b)}>Add saved block</button></div>)}</div></aside><div className="outputPanel"><b>Output Panel</b><pre>{output || 'No generated result yet. Compile/export works without Hermes; generation requires configured Hermes endpoint.'}</pre></div></div>;
}

function neoBlockBoardGraph(ws: UMGWorkspace, stackId?: string) {
  const graph = ws.graph;
  const stack = ws.sleeves[0].stacks.find((s) => s.id === stackId) ?? ws.sleeves[0].stacks[0];
  const ids = new Set(stack?.neoblocks.map((nb) => nb.id) ?? []);
  const nodes = graph.nodes.filter((node) => node.nodeType === 'neoblock' && ids.has(node.sourceId)).map((node, index) => ({ ...node, position: node.layout?.manual ? node.position : { x: 140 + (index % 3) * 280, y: 120 + Math.floor(index / 3) * 170 }, visual: { focused: index === 0, dimmed: false } }));
  return { ...graph, nodes, edges: [] };
}
function findSource(ws: UMGWorkspace | undefined, id: string) { if (!ws) return undefined; const s = ws.sleeves[0]; if (s.id === id) return s; for (const st of s.stacks) { if (st.id === id) return st; for (const nb of st.neoblocks) { if (nb.id === id) return nb; for (const b of nb.blocks) if (b.id === id) return b; } } }
function lineageForNode(ws: UMGWorkspace | undefined, id?: string) { const empty = { sleeve: undefined as any, stack: undefined as any, neoblock: undefined as any, block: undefined as UMGBlock | undefined }; if (!ws) return empty; const sleeve = ws.sleeves[0]; if (!id || sleeve.id === id) return { ...empty, sleeve }; for (const stack of sleeve.stacks) { if (stack.id === id) return { ...empty, sleeve, stack }; for (const neoblock of stack.neoblocks) { if (neoblock.id === id) return { ...empty, sleeve, stack, neoblock }; for (const block of neoblock.blocks) if (block.id === id) return { ...empty, sleeve, stack, neoblock, block }; } } return { ...empty, sleeve }; }
function breadcrumb(lineage: ReturnType<typeof lineageForNode>) { return [lineage.sleeve?.title ?? 'Sleeve', lineage.stack?.title, lineage.neoblock?.title, lineage.block?.title].filter(Boolean).join(' > '); }
function viewLabel(mode: GraphFocusMode) { if (mode === 'sleeve') return 'Full Sleeve View'; if (mode === 'neostack') return 'NeoStack View'; if (mode === 'neoblock') return 'NeoBlock View'; return 'MOLT Block View'; }
function nodeStatus(node: GraphNode) { if (node.state.invalid) return 'invalid'; if (node.state.warning) return 'warning'; if (node.state.off) return 'off'; if (node.state.triggered) return 'triggered'; return node.state.active ? 'active' : 'inactive'; }
function renderTab(tab: string, ws?: UMGWorkspace, c?: CompileResult, out?: string) { if (tab === 'Input JSON') return JSON.stringify(ws?.sleeves[0] ?? {}, null, 2); if (tab === 'RuntimeSpec') return JSON.stringify(c?.runtimeSpec ?? {}, null, 2); if (tab === 'Trace') return JSON.stringify(c?.trace ?? [], null, 2); if (tab === 'Prompt') return c?.promptPreview ?? ''; if (tab === 'Diagnostics') return JSON.stringify(c?.diagnostics ?? [], null, 2); if (tab === 'IR Matrix') return JSON.stringify(c?.irMatrix ?? [], null, 2); if (tab === 'Migration Report') return JSON.stringify(migrationReport, null, 2); return out || 'No output yet.'; }
