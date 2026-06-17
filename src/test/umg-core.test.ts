import { describe, expect, it } from 'vitest';
import { composeBlocks } from '../lib/umg/composeBlocks';
import { applyCompileResultToGraph, buildGraphFromSleeve } from '../lib/umg/graphBuilder';
import { compileWorkspaceToRuntime } from '../lib/umg/compilerBridge';
import { normalizeImportedBlocks, normalizeSourceCatalog } from '../lib/umg/migrateLibrary';
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

    expect(catalog.blocks).toHaveLength(1);
    expect(catalog.blocks[0].legacy?.sourceRepo).toBe('UMG-Block-Library');
    expect(catalog.blocks[0].legacy?.sourcePath).toBe('AI/blocks/directive.customer.json');
    expect(catalog.sleeves).toHaveLength(1);
    expect(catalog.report.skippedHumanReferences).toBe(1);
    expect(catalog.report.unsupportedRoles).toEqual(expect.arrayContaining(['aim']));
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

  it('exports a Hermes packet without leaking API secrets', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'lean' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_test', title: 'Test Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot'] });
    const packet = exportHermesPacket('Build it', compiled, { endpoint: 'http://localhost', apiKey: 'SECRET_KEY', model: 'hermes-default', temperature: 0.3, maxTokens: 1000 });

    expect(JSON.stringify(packet)).not.toContain('SECRET_KEY');
    expect(packet.settings.apiKey).toBeUndefined();
    expect(packet.mode).toBe('generate');
  });
});
