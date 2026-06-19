import { describe, expect, it } from 'vitest';
import { composeBlocks } from '../lib/umg/composeBlocks';
import { applyCompileResultToGraph, applyManualLayout, applySnapLayout, buildGraphFromSleeve, focusGraph, openSelectedAsFocus, selectGraphNode } from '../lib/umg/graphBuilder';
import { DISPLAY_TYPE_ORDER, MOLT_ROLE_ORDER, addWorkbenchBlockByRole, saveWorkbenchBlockToLibrary, toggleWorkbenchBlock, updateWorkbenchBlockContent, validateHermesWorkbenchGeneration } from '../lib/umg/moltWorkbench';
import { defaultWorkbenchLayout, loadWorkbenchLayout, saveWorkbenchLayout } from '../lib/umg/workbenchLayout';
import { compileWorkspaceToRuntime } from '../lib/umg/compilerBridge';
import { classifyLibraryDisplay, getLibraryAssetStatus, isCompilerMoltBlock, normalizeImportedBlocks, normalizeSourceCatalog, sectionLibraryByDisplayType } from '../lib/umg/migrateLibrary';
import { exportHermesPacket } from '../lib/umg/exporters';

const rawBlocks = [
  { name: 'Chatbot Trigger', moltType: 'Trigger', tags: ['chatbot', 'intake'], content: 'Start when a visitor asks for service help.' },
  { title: 'Support Directive', role: 'directive', tags: ['chatbot', 'customer-support'], content: 'Be helpful, concise, and local-service aware.' },
  { title: 'Collect Lead Fields', role: 'instruction', tags: ['intake', 'lead', 'mobile-detailing'], content: 'Collect name, vehicle type, location, service need, and budget.' },
  { title: 'FAQ Instruction', role: 'instruction', tags: ['faq', 'chatbot'], content: 'Answer basic questions before collecting lead details.' },
  { title: 'Mobile Detailing Subject', role: 'subject', tags: ['mobile-detailing', 'local-service-business'], content: 'Mobile detailing customer intake.' },
  { title: 'Lead Quality Primary', role: 'primary', tags: ['lead', 'summary'], content: 'Produce a clean qualified lead summary.' },
  { title: 'Service Philosophy', role: 'philosophy', tags: ['trust', 'service'], content: 'Respect customer time and ask only useful questions.' },
  { title: 'Summary Blueprint', role: 'blueprint', tags: ['summary', 'intake'], content: 'Output FAQ answer, missing info questions, and final lead summary.' }
];

describe('UMG Studio core engine', () => {
  it('normalizes inconsistent imported block JSON into v0.1 MOLT blocks', () => {
    const migrated = normalizeImportedBlocks(rawBlocks);
    expect(migrated).toHaveLength(8);
    expect(migrated[0].type).toBe('molt_block');
    expect(migrated[0].role).toBe('trigger');
    expect(migrated[0].defaultState).toBe('on');
    expect(migrated[0].legacy?.original).toBeTruthy();
  });

  it('imports upstream AI and sleeves assets while skipping HUMAN markdown and preserving unsupported roles', () => {
    const catalog = normalizeSourceCatalog([
      { lane: 'AI', sourcePath: 'AI/blocks/directive.customer.json', data: { id: 'src_directive', title: 'Customer Directive', role: 'Directive', tags: ['chatbot'], content: 'Help customers.' } },
      { lane: 'AI', sourcePath: 'AI/blocks/aim.future.json', data: { id: 'src_aim', title: 'Future Aim', role: 'Aim', content: 'Future extension.' } },
      { lane: 'AI', sourcePath: 'AI/MOLT/Aim/catalog.json', data: { description: 'MOLT Aim blocks without explicit role field.' } },
      { lane: 'HUMAN', sourcePath: 'HUMAN/guide.md', data: '# readable reference' },
      { lane: 'sleeves', sourcePath: 'sleeves/sample.json', data: { sleeve_id: 'sleeve_demo', title: 'Demo Sleeve', block_refs: [{ block_id: 'src_directive', enabled: true }] } }
    ]);

    expect(catalog.blocks).toHaveLength(3);
    const runnableBlock = catalog.blocks.find((block) => block.id === 'src_directive');
    expect(runnableBlock?.legacy?.sourceRepo).toBe('UMG-Block-Library');
    expect(runnableBlock?.legacy?.sourcePath).toBe('AI/blocks/directive.customer.json');
    expect(catalog.sleeves).toHaveLength(1);
    expect(catalog.report.skippedHumanReferences).toBe(1);
    expect(catalog.report.unsupportedRoles).toEqual(expect.arrayContaining(['aim']));
  });

  it('classifies library presentation status for runnable, warning-bearing, reference-only, and unsupported assets', () => {
    const runnable = normalizeImportedBlocks([{ role: 'Directive', title: 'Runnable', content: 'Use this.', tags: ['chatbot'] }], 'AI/runnable.json')[0];
    const warning = normalizeImportedBlocks([{ title: 'Inferred Role', content: 'No explicit role.' }], 'AI/warning.json')[0];
    const referenceOnly = normalizeImportedBlocks([{ role: 'Instruction', title: 'Schema Reference', content: '' }], 'AI/SCHEMAS/runtime.schema.json')[0];
    const unsupported = normalizeImportedBlocks([{ role: 'Aim', title: 'Future Aim', content: 'Future.' }], 'AI/MOLT/Aim/future.json')[0];

    expect(getLibraryAssetStatus(runnable)).toBe('runnable');
    expect(getLibraryAssetStatus(warning)).toBe('meta');
    expect(getLibraryAssetStatus(referenceOnly)).toBe('reference-only');
    expect(getLibraryAssetStatus(unsupported)).toBe('meta');
  });

  it('classifies supported roles into stable display sections and preserves Aim/Use/Need/unknown as non-compiler Meta', () => {
    const blocks = normalizeImportedBlocks([
      { id: 'directive', role: 'Directive', title: 'Directive', content: 'Run.', tags: ['chatbot'] },
      { id: 'aim', role: 'Aim', title: 'Future Aim', content: 'Future.', tags: ['future'] },
      { id: 'need', role: 'Need', title: 'Future Need', content: 'Future.', tags: ['future'] },
      { id: 'unknown', role: 'Mystery', title: 'Unknown Role', content: 'Unknown.', tags: ['meta'] }
    ], 'AI/MOLT/mixed.json');
    const sections = sectionLibraryByDisplayType(blocks);

    expect(DISPLAY_TYPE_ORDER).toEqual(['all', 'trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint', 'meta']);
    expect(classifyLibraryDisplay(blocks[0])).toMatchObject({ displayType: 'directive', compilerActive: true });
    expect(blocks.slice(1).map((block) => classifyLibraryDisplay(block).displayType)).toEqual(['meta', 'meta', 'meta']);
    expect(blocks.slice(1).every((block) => !isCompilerMoltBlock(block))).toBe(true);
    expect(sections.map((section) => section.type)).toEqual(DISPLAY_TYPE_ORDER);
    expect(sections.find((section) => section.type === 'meta')?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['aim', 'need', 'unknown']));
  });

  it('preserves Meta assets in source catalog instead of dropping them while keeping them inactive for compose and compile', () => {
    const catalog = normalizeSourceCatalog([
      { lane: 'AI', sourcePath: 'AI/blocks/directive.customer.json', data: { id: 'src_directive', title: 'Customer Directive', role: 'Directive', tags: ['chatbot'], content: 'Help customers.' } },
      { lane: 'AI', sourcePath: 'AI/MOLT/Aim/future.json', data: { id: 'src_aim', title: 'Future Aim', role: 'Aim', tags: ['chatbot'], content: 'Future extension.' } },
      { lane: 'AI', sourcePath: 'AI/MOLT/Unknown/helper.json', data: { id: 'src_unknown', title: 'Helper Note', role: 'SystemNote', content: 'Reference-only helper.' } }
    ]);
    const metaBlocks = catalog.blocks.filter((block) => classifyLibraryDisplay(block).displayType === 'meta');

    expect(metaBlocks.map((block) => block.id)).toEqual(expect.arrayContaining(['src_aim', 'src_unknown']));
    expect(metaBlocks.every((block) => block.defaultState === 'off')).toBe(true);
    expect(metaBlocks.every((block) => block.visibility === 'audit_only')).toBe(true);
    expect(metaBlocks.every((block) => block.legacy?.original)).toBe(true);
    expect(catalog.report.unsupportedRoles).toEqual(expect.arrayContaining(['aim']));
  });

  it('composer excludes Meta by default and compile does not activate Meta blocks inserted into a workspace', () => {
    const blocks = normalizeImportedBlocks([
      { id: 'meta_instruction', role: 'Instruction', title: 'Meta Instruction', tags: ['chatbot', 'intake'], content: 'Reference only.', priorityOrder: 1 },
      { id: 'runnable_instruction', role: 'Instruction', title: 'Runnable Instruction', tags: ['chatbot', 'intake'], content: 'Collect usable details.', priorityOrder: 20 },
      { id: 'directive', role: 'Directive', title: 'Directive', tags: ['chatbot'], content: 'Help.' },
      { id: 'subject', role: 'Subject', title: 'Subject', tags: ['chatbot'], content: 'Chatbot.' },
      { id: 'primary', role: 'Primary', title: 'Primary', tags: ['chatbot'], content: 'Success.' },
      { id: 'blueprint', role: 'Blueprint', title: 'Blueprint', tags: ['chatbot'], content: 'Output.' }
    ]);
    blocks[0].presentationStatus = 'meta';
    blocks[0].defaultState = 'off';
    blocks[0].visibility = 'audit_only';
    blocks[0].legacy = { ...(blocks[0].legacy ?? { original: {} }), migrationWarnings: ['meta / non-compiler asset'] };

    const result = composeBlocks({ freeform_request: 'chatbot intake', target_type: 'chatbot', depth: 'lean' }, blocks);
    expect(result.selected_nodes.map((node) => node.id)).toContain('runnable_instruction');
    expect(result.selected_nodes.map((node) => node.id)).not.toContain('meta_instruction');
    result.draft_sleeve.stacks[0].neoblocks[0].blocks.push(blocks[0]);
    const workspace = { id: 'ws_meta', title: 'Meta Workspace', activeSleeveId: result.draft_sleeve.id, sleeves: [result.draft_sleeve], libraryRefs: [], graph: buildGraphFromSleeve(result.draft_sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot'] }, { disableInstalledCompiler: true });

    expect(compiled.irMatrix.some((row) => row.nodeId === 'meta_instruction' && row.active)).toBe(false);
    expect(compiled.promptPreview).not.toContain('Reference only.');
  });

  it('keeps the Add Block compiler role menu separate from the Meta display bucket', () => {
    expect(MOLT_ROLE_ORDER).toEqual(['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint']);
    expect(MOLT_ROLE_ORDER).not.toContain('meta' as any);
    expect(DISPLAY_TYPE_ORDER[DISPLAY_TYPE_ORDER.length - 1]).toBe('meta');
  });

  it('composer prioritizes runnable v0.1 blocks and does not activate unsupported Aim/Use/Need assets', () => {
    const blocks = normalizeImportedBlocks([
      { id: 'unsupported_instruction', role: 'Instruction', title: 'Aim-like Instruction', tags: ['chatbot', 'intake'], content: 'Do not select as v0.1.', priorityOrder: 1 },
      { id: 'runnable_instruction', role: 'Instruction', title: 'Runnable Instruction', tags: ['chatbot', 'intake'], content: 'Collect usable details.', priorityOrder: 20 },
      { id: 'directive', role: 'Directive', title: 'Directive', tags: ['chatbot'], content: 'Help.' },
      { id: 'subject', role: 'Subject', title: 'Subject', tags: ['chatbot'], content: 'Chatbot.' },
      { id: 'primary', role: 'Primary', title: 'Primary', tags: ['chatbot'], content: 'Success.' },
      { id: 'blueprint', role: 'Blueprint', title: 'Blueprint', tags: ['chatbot'], content: 'Output.' }
    ]);
    blocks[0].legacy = { ...(blocks[0].legacy ?? { original: {} }), sourcePath: 'AI/MOLT/Aim/unsupported.json', migrationWarnings: ['unsupported role preserved: aim'] };

    const result = composeBlocks({ freeform_request: 'chatbot intake', target_type: 'chatbot', depth: 'lean' }, blocks);

    expect(result.selected_nodes.map((n) => n.id)).toContain('runnable_instruction');
    expect(result.selected_nodes.map((n) => n.id)).not.toContain('unsupported_instruction');
  });

  it('composes a balanced mobile detailing chatbot sleeve with required role coverage and reasons', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const result = composeBlocks({
      freeform_request: 'Build me a customer-intake chatbot for a mobile detailing business that collects lead details and produces a summary.',
      target_type: 'chatbot',
      depth: 'balanced'
    }, blocks);

    const roles = result.selected_nodes.map((n) => n.role);
    expect(result.classification.target_type).toBe('chatbot');
    expect(roles).toEqual(expect.arrayContaining(['directive', 'instruction', 'subject', 'primary', 'blueprint']));
    expect(result.selected_nodes[0].reason).toContain('score');
    expect(result.draft_sleeve.stacks[0].neoblocks[0].blocks.length).toBeGreaterThanOrEqual(5);
  });

  it('builds a connected Sleeve to MOLT workflow graph and marks off blocks', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    blocks[1].defaultState = 'off';
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const graph = buildGraphFromSleeve(sleeve);

    expect(graph.nodes.some((n) => n.nodeType === 'sleeve')).toBe(true);
    expect(graph.nodes.some((n) => n.nodeType === 'molt_block' && n.state.off)).toBe(true);
    expect(graph.edges.some((e) => e.type === 'contains')).toBe(true);
  });

  it('compiles without Hermes into RuntimeSpec, Trace, prompt preview, diagnostics, and IR Matrix', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake'] });

    expect(compiled.runtimeSpec).toMatchObject({ sleeveId: sleeve.id, compiler: 'umg-compiler', source: 'real' });
    expect(compiled.trace.length).toBeGreaterThan(0);
    expect(compiled.promptPreview).toContain('Be helpful, concise, and local-service aware.');
    expect(compiled.irMatrix.some((row) => row.role === 'blueprint')).toBe(true);
    expect(compiled.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('uses the installed real compiler by default when available', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake'] });

    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(JSON.stringify(compiled.trace)).toContain('compileSleeve(v0)');
    expect(compiled.promptPreview).toContain('Be helpful, concise, and local-service aware.');
  });

  it('maps real compiler output into active graph node states that agree with the IR Matrix', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake'] });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);
    const activeRows = compiled.irMatrix.filter((row) => row.active && !row.off);

    expect(activeRows.length).toBeGreaterThan(0);
    for (const row of activeRows) {
      const node = graph.nodes.find((n) => n.sourceId === row.nodeId);
      expect(node?.state.active).toBe(true);
      expect(node?.state.off).toBe(false);
    }
  });

  it('keeps manually off nodes grey/off when applying compile output', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const offBlock = sleeve.stacks[0].neoblocks[0].blocks.find((b) => b.role === 'instruction');
    if (!offBlock) throw new Error('expected instruction block');
    offBlock.defaultState = 'off';
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake'] });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);
    const node = graph.nodes.find((n) => n.sourceId === offBlock.id);

    expect(node?.state.off).toBe(true);
    expect(node?.state.active).toBe(false);
    expect(compiled.irMatrix.some((row) => row.nodeId === offBlock.id && row.off && !row.active)).toBe(true);
  });

  it('maps trace events to triggered graph nodes', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const blockId = sleeve.stacks[0].neoblocks[0].blocks[0].id;
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot'] }, {
      externalCompiler: () => ({
        runtimeSpec: { compiler: 'real', source: 'test' },
        trace: [{ code: 'TRACE_TRIGGERED', nodeId: blockId, triggered: true, message: 'trigger fired' }],
        diagnostics: [],
        irMatrix: [{ rowId: 'ir_trigger', nodeId: blockId, nodeType: 'molt_block', title: 'Triggered Block', selected: true, active: true, off: false, triggered: true, required: false, tagsMatched: [] }],
        promptPreview: 'triggered prompt'
      })
    });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);

    expect(graph.nodes.find((n) => n.sourceId === blockId)?.state.triggered).toBe(true);
  });

  it('maps diagnostics to graph warning and invalid states', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const warningId = sleeve.stacks[0].neoblocks[0].blocks[0].id;
    const errorId = sleeve.stacks[0].neoblocks[0].blocks[1].id;
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot'] }, {
      externalCompiler: () => ({
        runtimeSpec: { compiler: 'real', source: 'test' },
        trace: [],
        diagnostics: [
          { id: 'diag_warn', type: 'Dependency missing', severity: 'warning', message: 'warning node', nodeId: warningId },
          { id: 'diag_error', type: 'Invalid JSON', severity: 'error', message: 'invalid node', nodeId: errorId }
        ],
        irMatrix: [
          { rowId: 'ir_warn', nodeId: warningId, nodeType: 'molt_block', title: 'Warning Block', selected: true, active: true, off: false, triggered: false, required: false, tagsMatched: [], warning: 'warning node' },
          { rowId: 'ir_error', nodeId: errorId, nodeType: 'molt_block', title: 'Invalid Block', selected: true, active: false, off: false, triggered: false, required: false, tagsMatched: [], warning: 'invalid node' }
        ],
        promptPreview: 'diagnostic prompt'
      })
    });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);

    expect(graph.nodes.find((n) => n.sourceId === warningId)?.state.warning).toBe('warning node');
    expect(graph.nodes.find((n) => n.sourceId === warningId)?.state.invalid).toBe(false);
    expect(graph.nodes.find((n) => n.sourceId === errorId)?.state.warning).toBe('invalid node');
    expect(graph.nodes.find((n) => n.sourceId === errorId)?.state.invalid).toBe(true);
  });

  it('uses an injected real compiler adapter before deterministic fallback', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot'] }, {
      compilerName: 'mock-real-umg-compiler',
      externalCompiler: (activeSleeve) => ({
        runtimeSpec: { compiler: 'real', sleeveId: activeSleeve.id },
        trace: [{ nodeId: 'real_trace_row', active: true, triggered: true }],
        diagnostics: [{ id: 'real_diag', type: 'compiler', severity: 'info', message: 'real compiler used' }],
        promptPreview: 'REAL COMPILER PROMPT',
        irMatrix: [{ rowId: 'real_ir', nodeId: 'real_trace_row', nodeType: 'molt_block', title: 'Real Trace Row', selected: true, active: true, off: false, triggered: true, required: false, tagsMatched: [] }]
      })
    });

    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'real', sleeveId: sleeve.id });
    expect(compiled.promptPreview).toBe('REAL COMPILER PROMPT');
    expect(compiled.diagnostics[0].message).toBe('real compiler used');
  });

  it('falls back deterministically when the real compiler adapter throws', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot'] }, {
      compilerName: 'mock-real-umg-compiler',
      externalCompiler: () => { throw new Error('compiler unavailable'); }
    });

    expect(compiled.runtimeSpec).toMatchObject({ sleeveId: sleeve.id, mode: 'compile-only', compiler: 'deterministic-fallback' });
    expect(compiled.diagnostics.some((d) => d.type === 'Compiler fallback' && d.message.includes('compiler unavailable'))).toBe(true);
    expect(compiled.promptPreview).toContain('Support Directive');
  });

  it('keeps graph runtime state when switching semantic focus modes', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const offBlock = sleeve.stacks[0].neoblocks[0].blocks.find((b) => b.role === 'instruction');
    if (!offBlock) throw new Error('expected instruction block');
    offBlock.defaultState = 'off';
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake'] });
    const runtimeGraph = applyCompileResultToGraph(workspace.graph, compiled);
    const stackId = sleeve.stacks[0].id;
    const blockId = sleeve.stacks[0].neoblocks[0].id;

    const stackFocus = focusGraph(runtimeGraph, { mode: 'neostack', sourceId: stackId });
    const blockFocus = focusGraph(runtimeGraph, { mode: 'neoblock', sourceId: blockId });

    expect(stackFocus.nodes.some((n) => n.nodeType === 'neostack' && n.sourceId === stackId)).toBe(true);
    expect(stackFocus.nodes.every((n) => n.nodeType === 'neostack' || n.nodeType === 'neoblock')).toBe(true);
    expect(blockFocus.nodes.find((n) => n.sourceId === offBlock.id)?.state.off).toBe(true);
    for (const row of compiled.irMatrix.filter((r) => r.active && !r.off && r.nodeType === 'molt_block')) {
      expect(blockFocus.nodes.find((n) => n.sourceId === row.nodeId)?.state.active).toBe(true);
    }
    expect(blockFocus.nodes.some((n) => n.nodeType === 'molt_block')).toBe(true);
  });

  it('builds inspector context for a selected focused MOLT block with matching IR Matrix row', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake'] });
    const block = sleeve.stacks[0].neoblocks[0].blocks[0];
    const focused = focusGraph(applyCompileResultToGraph(workspace.graph, compiled), { mode: 'molt_block', sourceId: block.id });
    const selectedNode = focused.nodes.find((n) => n.sourceId === block.id);
    const irRow = compiled.irMatrix.find((row) => row.nodeId === block.id);

    expect(selectedNode?.nodeType).toBe('molt_block');
    expect(block.title).toBeTruthy();
    expect(block.role).toBeTruthy();
    expect(block.tags.length).toBeGreaterThan(0);
    expect(block.content).toBeTruthy();
    expect(irRow?.nodeId).toBe(block.id);
  });

  it('persists VS Code-style workbench panel layout state', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value)
    };

    const layout = { ...defaultWorkbenchLayout, leftWidth: 260, rightWidth: 320, bottomHeight: 180, leftCollapsed: true, rightCollapsed: false, bottomCollapsed: false };
    saveWorkbenchLayout(storage, layout);

    expect(loadWorkbenchLayout(storage)).toMatchObject(layout);
  });

  it('renders hierarchy-specific graph views with connector rules', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const graph = buildGraphFromSleeve(sleeve);
    const stackId = sleeve.stacks[0].id;
    const neoBlockId = sleeve.stacks[0].neoblocks[0].id;
    const moltId = sleeve.stacks[0].neoblocks[0].blocks[0].id;

    const sleeveView = focusGraph(graph, { mode: 'sleeve', sourceId: sleeve.id });
    const stackView = focusGraph(graph, { mode: 'neostack', sourceId: stackId });
    const blockView = focusGraph(graph, { mode: 'neoblock', sourceId: neoBlockId });
    const moltView = focusGraph(graph, { mode: 'molt_block', sourceId: moltId });

    expect(sleeveView.nodes.map((n) => n.nodeType)).toEqual(expect.arrayContaining(['sleeve', 'neostack']));
    expect(sleeveView.nodes.some((n) => n.nodeType === 'neoblock')).toBe(false);
    expect(sleeveView.edges.length).toBeGreaterThan(0);
    expect(stackView.nodes.every((n) => n.nodeType === 'neostack' || n.nodeType === 'neoblock')).toBe(true);
    expect(stackView.nodes.some((n) => n.sourceId === stackId)).toBe(true);
    expect(stackView.edges).toHaveLength(0);
    expect(blockView.nodes.every((n) => n.nodeType === 'neoblock' || n.nodeType === 'molt_block')).toBe(true);
    expect(blockView.nodes.some((n) => n.sourceId === moltId)).toBe(true);
    expect(blockView.edges).toHaveLength(0);
    expect(moltView.nodes).toHaveLength(1);
    expect(moltView.nodes[0].sourceId).toBe(moltId);
    expect(moltView.edges).toHaveLength(0);
  });

  it('preserves runtime active/off state across hierarchy views and manual layout movement', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const offBlock = sleeve.stacks[0].neoblocks[0].blocks.find((b) => b.role === 'instruction');
    if (!offBlock) throw new Error('expected instruction block');
    offBlock.defaultState = 'off';
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake'] });
    const runtimeGraph = applyCompileResultToGraph(workspace.graph, compiled);
    const movedGraph = applyManualLayout(runtimeGraph, offBlock.id, { x: 220, y: 160, width: 2, height: 1, priorityRank: 99, relation: 'supports', manual: true });
    const blockView = focusGraph(movedGraph, { mode: 'neoblock', sourceId: sleeve.stacks[0].neoblocks[0].id });
    const movedNode = blockView.nodes.find((n) => n.sourceId === offBlock.id);

    expect(movedNode?.position).toEqual({ x: 220, y: 160 });
    expect(movedNode?.layout).toMatchObject({ relation: 'supports', manual: true, priorityRank: 99 });
    expect(movedNode?.state.off).toBe(true);
    expect(movedNode?.state.active).toBe(false);
    for (const row of compiled.irMatrix.filter((r) => r.active && !r.off)) {
      expect(focusGraph(movedGraph, { mode: 'neoblock', sourceId: sleeve.stacks[0].neoblocks[0].id }).nodes.find((n) => n.sourceId === row.nodeId)?.state.active).toBe(true);
    }
  });

  it('selects graph nodes without changing view until explicit view controls open the selection', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const graph = buildGraphFromSleeve(sleeve);
    const initialFocus = { mode: 'sleeve' as const, sourceId: sleeve.id };
    const stackNode = graph.nodes.find((n) => n.nodeType === 'neostack');
    if (!stackNode) throw new Error('expected neostack node');

    const selectedState = selectGraphNode(graph, stackNode.sourceId, initialFocus);
    const opened = openSelectedAsFocus(selectedState.selected!, selectedState.focus);

    expect(selectedState.selected?.sourceId).toBe(stackNode.sourceId);
    expect(selectedState.focus).toEqual(initialFocus);
    expect(opened).toEqual({ mode: 'neostack', sourceId: stackNode.sourceId });
  });

  it('supports V21-style MOLT workbench role cards without dropping Trigger', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const neoblock = sleeve.stacks[0].neoblocks[0];

    const added = addWorkbenchBlockByRole(neoblock, 'trigger');
    const target = added.blocks[added.blocks.length - 1];
    const edited = updateWorkbenchBlockContent(added, target.id, 'Edited trigger content');
    const toggled = toggleWorkbenchBlock(edited, target.id);
    const saved = saveWorkbenchBlockToLibrary(toggled.blocks.find((b) => b.id === target.id)!);

    expect(MOLT_ROLE_ORDER[0]).toBe('trigger');
    expect(added.blocks.some((b) => b.role === 'trigger')).toBe(true);
    expect(edited.blocks.find((b) => b.id === target.id)?.content).toBe('Edited trigger content');
    expect(toggled.blocks.find((b) => b.id === target.id)?.defaultState).toBe('off');
    expect(saved.source?.origin).toBe('library');
    expect(saved.id).not.toBe(target.id);
  });

  it('blocks MOLT workbench generation through Hermes-safe validation when endpoint is unconfigured', () => {
    const result = validateHermesWorkbenchGeneration({ endpoint: '', apiKey: 'SECRET_KEY', model: 'hermes-default', temperature: 0.3, maxTokens: 1200 });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Hermes endpoint not configured');
    expect(JSON.stringify(result)).not.toContain('SECRET_KEY');
    expect(JSON.stringify(result)).not.toContain('apiKey');
  });

  it('stores NeoBlock snap/lock relationships while preserving manual layout and runtime state', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const first = sleeve.stacks[0].neoblocks[0];
    const second = { ...structuredClone(first), id: 'nb_parallel_test', title: 'Parallel Intake Support', blocks: first.blocks.slice(0, 2) };
    sleeve.stacks[0].neoblocks.push(second);
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake'] });
    const runtimeGraph = applyCompileResultToGraph(workspace.graph, compiled);
    const moved = applyManualLayout(runtimeGraph, second.id, { x: 436, y: 40, relation: 'parallel', manual: true });
    const snapped = applySnapLayout(moved, second.id, first.id, { threshold: 18, relation: 'parallel' });
    const snappedNode = snapped.nodes.find((n) => n.sourceId === second.id);

    expect(snappedNode?.layout).toMatchObject({ manual: true, locked: true, snapTargetId: first.id, relation: 'parallel' });
    expect(snappedNode?.position.y).toBe(snapped.nodes.find((n) => n.sourceId === first.id)?.position.y);
    expect(focusGraph(snapped, { mode: 'neostack', sourceId: sleeve.stacks[0].id }).edges).toHaveLength(0);
    for (const row of compiled.irMatrix.filter((r) => r.active && !r.off)) {
      expect(focusGraph(snapped, { mode: 'neoblock', sourceId: first.id }).nodes.find((n) => n.sourceId === row.nodeId)?.state.active).toBe(true);
    }
  });

  it('exports a Hermes packet without leaking API secrets', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'lean' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot'] });
    const packet = exportHermesPacket('Build it', compiled, { endpoint: 'http://localhost', apiKey: 'SECRET_KEY', model: 'hermes-default', temperature: 0.3, maxTokens: 1000 });

    expect(JSON.stringify(packet)).not.toContain('SECRET_KEY');
    expect('apiKey' in packet.settings).toBe(false);
    expect(packet.mode).toBe('generate');
  });
});
