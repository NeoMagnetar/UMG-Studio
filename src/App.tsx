import { useMemo, useState } from 'react';
import './style.css';
import rawBlocks from '../data/library/blocks.json';
import normalizedBlocks from '../data/library/normalized-blocks.json';
import migrationReport from '../data/library/migration-report.json';
import { getLibraryAssetStatus, normalizeImportedBlocks } from './lib/umg/migrateLibrary';
import { composeBlocks } from './lib/umg/composeBlocks';
import { applyCompileResultToGraph, buildGraphFromSleeve, focusGraph } from './lib/umg/graphBuilder';
import { compileWorkspaceToRuntime } from './lib/umg/compilerBridge';
import { downloadJson, exportHermesPacket } from './lib/umg/exporters';
import { generateWithHermes, redactKey, testHermesConnection } from './lib/hermes/hermesClient';
import { CompileResult, GraphFocusMode, GraphNode, HermesConfig, LibraryAssetStatus, UMGBlock, UMGWorkspace } from './lib/umg/types';

const demo = 'Build me a customer-intake chatbot for a mobile detailing business. It should answer basic questions, collect customer name, vehicle type, location, service need, and budget, then produce a clean lead summary.';
const roles = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];
const statuses: Array<'all' | LibraryAssetStatus> = ['all', 'runnable', 'warning-bearing', 'reference-only', 'unsupported'];

export default function App() {
  const [mode, setMode] = useState<'simple' | 'builder' | 'creator'>('simple');
  const [request, setRequest] = useState(demo);
  const [target, setTarget] = useState('chatbot');
  const [depth, setDepth] = useState<'lean' | 'balanced' | 'full'>('balanced');
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
  const focusStack = () => {
    const id = selectedLineage.stack?.id ?? workspace?.sleeves[0].stacks[0]?.id;
    setFocusMode('neostack');
    setFocusSourceId(id);
  };
  const focusBlock = () => {
    const id = selectedLineage.neoblock?.id ?? workspace?.sleeves[0].stacks[0]?.neoblocks[0]?.id;
    setFocusMode('neoblock');
    setFocusSourceId(id);
  };
  const resetView = () => { setSelected(undefined); setInspectedBlock(undefined); focusSleeve(); };
  const updateConfig = (patch: Partial<HermesConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setHermesStatus(next.endpoint ? 'configured' : 'not configured');
  };

  return <div className="app"><header><div><b>UMG Studio v0.1</b><span>local graph cognition studio</span></div><nav>{['simple', 'builder', 'creator'].map((m) => <button key={m} className={mode === m ? 'hot' : ''} onClick={() => setMode(m as any)}>{m}</button>)}</nav><button onClick={() => downloadJson('umg-workspace.json', workspace)}>Export Workspace</button></header>
    <main><section className="compose card"><h2>Compose</h2><textarea value={request} onChange={e => setRequest(e.target.value)} /><div className="row"><select value={target} onChange={e => setTarget(e.target.value)}><option value="chatbot">Chatbot</option><option value="business_template">Business Template</option><option value="website_prompt">Website Prompt</option><option value="umg_sleeve">UMG Sleeve</option></select><select value={depth} onChange={e => setDepth(e.target.value as any)}><option>lean</option><option>balanced</option><option>full</option></select><button className="primary" onClick={composed}>Compose Blocks</button><button onClick={compile}>Compile</button><button onClick={async () => { if (!compiled) return setStatus('compile first'); if (!config.endpoint) { setHermesStatus('not configured'); setOutput('Hermes endpoint not configured. Compile/export remains available without Hermes.'); setTab('Output'); return setStatus('Hermes generation blocked: not configured'); } const r = await generateWithHermes(request, compiled, config); setOutput(r.output); setTab('Output'); setHermesStatus(r.ok ? 'test passed' : 'test failed'); setStatus(r.ok ? 'Hermes generation complete' : 'Hermes generation blocked'); }}>Generate</button></div><p>{status}</p></section>
      <section className="library card"><h2>Library</h2><div className="report"><b>Migration Report</b><span>blocks {(migrationReport as any).importedBlocks}</span><span>sleeves {(migrationReport as any).importedSleeves}</span><span>HUMAN skipped {(migrationReport as any).skippedHumanReferences}</span><span>unsupported {((migrationReport as any).unsupportedRoles || []).join(', ') || 'none'}</span></div><input placeholder="search title/tags/content/source" value={search} onChange={e => setSearch(e.target.value)} /><select value={filter} onChange={e => setFilter(e.target.value)}><option>all</option>{roles.map((r) => <option key={r}>{r}</option>)}</select><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>{statuses.map((s) => <option key={s}>{s}{s !== 'all' ? ` (${statusCounts[s] ?? 0})` : ''}</option>)}</select><div className="cards">{visible.map((b, i) => <div className={`block ${b.presentationStatus}`} key={`${b.id}:${b.legacy?.sourcePath ?? 'local'}:${i}`}><div className="cardtop"><b>{b.title}</b><span className="badge">{b.presentationStatus}</span></div><small>type {b.type} • role {b.role} • {b.category}</small><p>{b.content || 'Reference asset: no runnable content extracted.'}</p><em>{b.tags.join(', ') || 'no tags'}</em><small>source {b.legacy?.sourcePath ?? 'local sample'}</small><div className="row"><button onClick={() => { setInspectedBlock(b); setSelected(undefined); }}>Inspect JSON</button><button onClick={() => addBlock(b)}>Add workspace copy</button></div></div>)}</div></section>
      <section className="graph card"><div className="bar"><h2>Graph Studio</h2><button onClick={() => workspace && downloadJson('sleeve.json', workspace.sleeves[0])}>Export Sleeve</button><button onClick={() => compiled && downloadJson('ir-matrix.json', compiled.irMatrix)}>Export IR</button><button onClick={() => compiled && downloadJson('hermes-packet.json', exportHermesPacket(request, compiled, config))}>Export Hermes Packet</button></div><div className="graphControls"><span className="badge">Focus: {focusMode}</span><span className="crumb">{breadcrumb(selectedLineage)}</span><button onClick={focusSleeve}>Fit Sleeve</button><button onClick={focusStack}>Focus Stack</button><button onClick={focusBlock}>Focus Block</button><button onClick={resetView}>Reset View</button></div>{workspace && focusedGraph ? <Graph nodes={focusedGraph.nodes} edges={focusedGraph.edges} selected={selected?.id} onPick={(n) => { setSelected(n); setInspectedBlock(undefined); setFocusSourceId(n.sourceId); if (n.nodeType !== 'output') setFocusMode(n.nodeType as GraphFocusMode); }} /> : <div className="empty">Describe what you want to build, then click Compose Blocks.</div>}</section>
      <aside className="inspect card"><h2>Inspector</h2>{inspectorObject ? <><b>{(inspectorObject as any).title ?? selected?.label}</b>{selected && <div className="report"><span>type {selected.nodeType}</span><span>status {nodeStatus(selected)}</span><span>runtime active {String(selected.state.active)}</span><span>runtime off {String(selected.state.off)}</span><span>triggered {String(selected.state.triggered)}</span></div>}{selected?.nodeType === 'molt_block' && <div className="report"><span>role {(inspectorObject as UMGBlock).role}</span><span>tags {((inspectorObject as UMGBlock).tags || []).join(', ') || 'none'}</span><span>content {((inspectorObject as UMGBlock).content || '').slice(0, 180)}</span><span>IR row {selectedIrRow ? selectedIrRow.rowId : 'none'}</span></div>}{inspectedBlock && <p><span className="badge">{getLibraryAssetStatus(inspectedBlock)}</span> normalized JSON + legacy source data</p>}{selected?.nodeType === 'molt_block' && <button onClick={() => toggleNode(selected)}>Toggle on/off</button>}<h3>Normalized JSON</h3><pre>{JSON.stringify(inspectorObject, null, 2)}</pre>{selectedIrRow && <><h3>IR Matrix Row</h3><pre>{JSON.stringify(selectedIrRow, null, 2)}</pre></>}</> : <p>Select a graph node or inspect a library card.</p>}<h2>Config</h2><div className="report"><b>Hermes status: {hermesStatus}</b><span>API key redacted: {redactKey(config.apiKey) || 'not set'}</span><span>Exports exclude API keys.</span></div><input placeholder="Hermes endpoint" value={config.endpoint} onChange={e => updateConfig({ endpoint: e.target.value })} /><input placeholder="API key" type="password" value={config.apiKey || ''} onChange={e => updateConfig({ apiKey: e.target.value })} /><input aria-label="Hermes model" value={config.model} onChange={e => updateConfig({ model: e.target.value })} /><button onClick={async () => { const r = await testHermesConnection(config); setHermesStatus(r.ok ? 'test passed' : 'test failed'); setStatus(`Hermes ${r.message}`); }}>Test Connection</button></aside>
      <section className="drawer card"><h2>Compiler / Runtime</h2><div className="tabs">{['Input JSON', 'RuntimeSpec', 'Trace', 'Prompt', 'Diagnostics', 'IR Matrix', 'Output', 'Migration Report'].map(t => <button key={t} className={tab === t ? 'hot' : ''} onClick={() => setTab(t)}>{t}</button>)}</div><pre>{renderTab(tab, workspace, compiled, output)}</pre></section></main></div>;
}

function Graph({ nodes, edges, selected, onPick }: { nodes: GraphNode[]; edges: any[]; selected?: string; onPick: (n: GraphNode) => void }) { return <div className="canvas"><svg>{edges.map(e => { const a = nodes.find(n => n.id === e.source), b = nodes.find(n => n.id === e.target); if (!a || !b) return null; const dimmed = a.visual?.dimmed || b.visual?.dimmed; return <line key={e.id} className={dimmed ? 'dimmed' : ''} x1={a.position.x + 90} y1={a.position.y + 24} x2={b.position.x} y2={b.position.y + 24} />; })}</svg>{nodes.map(n => <button key={n.id} onClick={() => onPick(n)} className={`node ${n.nodeType} ${n.state.off ? 'off' : 'active'} ${n.state.triggered ? 'triggered' : ''} ${n.state.warning ? 'warning' : ''} ${n.state.invalid ? 'invalid' : ''} ${n.visual?.dimmed ? 'dimmed' : ''} ${n.visual?.focused ? 'focused' : ''} ${selected === n.id ? 'picked' : ''}`} style={{ left: n.position.x, top: n.position.y }}><b>{n.label}</b><small>{n.nodeType}{n.state.triggered ? ' ⚡' : ''}{n.state.warning ? ' ⚠' : ''}</small></button>)}</div>; }
function findSource(ws: UMGWorkspace | undefined, id: string) { if (!ws) return undefined; const s = ws.sleeves[0]; if (s.id === id) return s; for (const st of s.stacks) { if (st.id === id) return st; for (const nb of st.neoblocks) { if (nb.id === id) return nb; for (const b of nb.blocks) if (b.id === id) return b; } } }
function lineageForNode(ws: UMGWorkspace | undefined, id?: string) { const empty = { sleeve: undefined as any, stack: undefined as any, neoblock: undefined as any, block: undefined as UMGBlock | undefined }; if (!ws) return empty; const sleeve = ws.sleeves[0]; if (!id || sleeve.id === id) return { ...empty, sleeve }; for (const stack of sleeve.stacks) { if (stack.id === id) return { ...empty, sleeve, stack }; for (const neoblock of stack.neoblocks) { if (neoblock.id === id) return { ...empty, sleeve, stack, neoblock }; for (const block of neoblock.blocks) if (block.id === id) return { ...empty, sleeve, stack, neoblock, block }; } } return { ...empty, sleeve }; }
function breadcrumb(lineage: ReturnType<typeof lineageForNode>) { return [lineage.sleeve?.title ?? 'Sleeve', lineage.stack?.title, lineage.neoblock?.title, lineage.block?.title].filter(Boolean).join(' > '); }
function nodeStatus(node: GraphNode) { if (node.state.invalid) return 'invalid'; if (node.state.warning) return 'warning'; if (node.state.off) return 'off'; if (node.state.triggered) return 'triggered'; return node.state.active ? 'active' : 'inactive'; }
function renderTab(tab: string, ws?: UMGWorkspace, c?: CompileResult, out?: string) { if (tab === 'Input JSON') return JSON.stringify(ws?.sleeves[0] ?? {}, null, 2); if (tab === 'RuntimeSpec') return JSON.stringify(c?.runtimeSpec ?? {}, null, 2); if (tab === 'Trace') return JSON.stringify(c?.trace ?? [], null, 2); if (tab === 'Prompt') return c?.promptPreview ?? ''; if (tab === 'Diagnostics') return JSON.stringify(c?.diagnostics ?? [], null, 2); if (tab === 'IR Matrix') return JSON.stringify(c?.irMatrix ?? [], null, 2); if (tab === 'Migration Report') return JSON.stringify(migrationReport, null, 2); return out || 'No output yet.'; }
