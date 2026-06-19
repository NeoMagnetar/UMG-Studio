import { describe, expect, it } from 'vitest';
import { composeBlocks } from '../lib/umg/composeBlocks';
import { applyCompileResultToGraph, applyManualLayout, applySnapLayout, buildGraphFromSleeve, focusGraph, openSelectedAsFocus, selectGraphNode } from '../lib/umg/graphBuilder';
import { DISPLAY_TYPE_ORDER, MOLT_ROLE_ORDER, addWorkbenchBlockByRole, saveWorkbenchBlockToLibrary, toggleWorkbenchBlock, updateWorkbenchBlockContent, validateHermesWorkbenchGeneration } from '../lib/umg/moltWorkbench';
import { defaultWorkbenchLayout, loadWorkbenchLayout, saveWorkbenchLayout } from '../lib/umg/workbenchLayout';
import { compileWorkspaceToRuntime } from '../lib/umg/compilerBridge';
import { classifyLibraryDisplay, getLibraryAssetStatus, isCompilerMoltBlock, normalizeImportedBlocks, normalizeSourceCatalog, sectionLibraryByDisplayType } from '../lib/umg/migrateLibrary';
import { exportHermesPacket } from '../lib/umg/exporters';
import { buildAssetShelves, buildSourceAssetAudit, duplicateSleeveIntoWorkspace, insertMoltBlockIntoWorkspace, insertNeoBlockIntoWorkspace, insertNeoStackIntoWorkspace, openSleeveAsWorkspace, searchShelfAssets } from '../lib/umg/libraryAssets';
import { normalizeAIInstructionEntry, stableAIInstructionId } from '../lib/umg/aiInstructionImport';
import { normalizeAISubjectEntry, stableAISubjectId } from '../lib/umg/aiSubjectImport';
import { normalizeAIPrimaryEntry, stableAIPrimaryId } from '../lib/umg/aiPrimaryImport';
import { NeoBlock, NeoStack, Sleeve, UMGWorkspace } from '../lib/umg/types';

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

const instructionEntry001 = {
  id: 'INST.001',
  type: 'INSTRUCTION',
  name: 'Break into components',
  category: 'general',
  subcategory: 'analytical_actions',
  status: 'active',
  version: '1.0.0',
  tags: ['instruction', 'analytical-actions'],
  source: { library_name: 'MOLT INSTRUCTION Library', library_version: '1.0.0' },
  content: { summary: 'Break into components', details: null, structure: null },
  action: 'Decompose complex system or concept into constituent parts',
  expected_output: 'List of distinct components with relationships identified',
  notes: null
};

const instructionEntry003 = {
  id: 'INST.003',
  type: 'INSTRUCTION',
  name: 'Trace causality',
  category: 'general',
  subcategory: 'analytical_actions',
  status: 'active',
  version: '1.0.0',
  tags: ['instruction', 'analytical-actions'],
  source: { library_name: 'MOLT INSTRUCTION Library', library_version: '1.0.0' },
  content: { summary: 'Trace causality', details: null, structure: null },
  action: 'Follow chain of causes backward from observed effect',
  expected_output: 'Causal chain from root cause to current state',
  notes: null
};

const subjectEntry001 = {
  id: 'SUBJ.001',
  type: 'SUBJECT',
  name: 'Raw data',
  category: 'data_information',
  subcategory: 'raw_data',
  domain: 'DATA_INFORMATION',
  status: 'active',
  version: '1.0.0',
  tags: ['subject', 'data-information', 'raw-data'],
  source: { library_name: 'MOLT SUBJECT Library', library_version: '1.0.0' },
  definition: 'Unprocessed information in various formats',
  examples: ['sensor readings', 'log entries', 'database records'],
  notes: null
};

const subjectEntry010 = {
  id: 'SUBJ.010',
  type: 'SUBJECT',
  name: 'Customer request',
  category: 'customer_support',
  subcategory: 'customer_request',
  domain: 'CUSTOMER_SUPPORT',
  status: 'active',
  version: '1.0.0',
  tags: ['subject', 'customer-support', 'request', 'mobile-detailing'],
  source: { library_name: 'MOLT SUBJECT Library', library_version: '1.0.0' },
  content: { summary: 'Customer request', details: 'Details supplied by a customer about a service need.', structure: null },
  action: 'Represent the customer service request as the subject of the cognition pass',
  expected_output: 'Clear subject anchor for the customer request',
  notes: null
};

const primaryEntry001 = {
  id: 'PRIM.001',
  type: 'PRIMARY',
  name: 'Factual accuracy',
  category: 'accuracy_precision',
  subcategory: 'factual_accuracy',
  domain: 'ACCURACY_PRECISION',
  status: 'active',
  version: '1.0.0',
  tags: ['primary', 'accuracy-precision', 'factual-accuracy'],
  source: { library_name: 'MOLT PRIMARY Library', library_version: '1.0.0' },
  essence: 'Getting the facts right',
  core_concern: 'Truth over approximation',
  notes: null
};

const primaryEntry010 = {
  id: 'PRIM.010',
  type: 'PRIMARY',
  name: 'Customer satisfaction',
  category: 'business_value',
  subcategory: 'customer_satisfaction',
  domain: 'BUSINESS_VALUE',
  status: 'active',
  version: '1.0.0',
  tags: ['primary', 'business-value', 'customer-satisfaction', 'mobile-detailing'],
  source: { library_name: 'MOLT PRIMARY Library', library_version: '1.0.0' },
  content: { summary: 'Customer satisfaction', details: 'Prioritize useful outcomes for service customers.', structure: null },
  action: 'Optimize for a satisfied customer outcome',
  expected_output: 'A customer-centered success criterion',
  notes: null
};

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

  it('supports context-aware insertion of MOLT blocks, NeoBlocks, NeoStacks, and Sleeves while keeping compile clean', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const baseSleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing', depth: 'balanced' }, blocks).draft_sleeve;
    const baseWorkspace: UMGWorkspace = { id: 'ws_insert', title: 'Insert Workspace', activeSleeveId: baseSleeve.id, sleeves: [baseSleeve], libraryRefs: [], graph: buildGraphFromSleeve(baseSleeve) };
    const meta = normalizeImportedBlocks([{ id: 'aim_meta', role: 'Aim', title: 'Future Aim', content: 'Preserve only.', tags: ['future'] }], 'AI/MOLT/Aim/future.json')[0];
    const extraBlock = normalizeImportedBlocks([{ id: 'extra_subject', role: 'Subject', title: 'Extra Subject', content: 'Extra context.', tags: ['tagged'] }])[0];
    const savedNeoBlock: NeoBlock = { id: 'saved_nb', title: 'Saved Intake NeoBlock', type: 'neoblock', tags: ['tagged', 'bundle'], blocks: [extraBlock], defaultState: 'on' };
    const savedNeoStack: NeoStack = { id: 'saved_stack', title: 'Saved Stack', type: 'neostack', tags: ['stacktag'], neoblocks: [savedNeoBlock], defaultState: 'on' };
    const savedSleeve: Sleeve = { id: 'saved_sleeve', title: 'Saved Sleeve', type: 'sleeve', version: '0.1', tags: ['sleevetag'], stacks: [savedNeoStack], runtimeConfig: { active: true, depth: 'balanced', hermesEnabled: false, runtimeAdaptation: false, showRuntimeTrace: true } };

    const moltInMoltView = insertMoltBlockIntoWorkspace(baseWorkspace, extraBlock, { mode: 'molt_block', selectedNeoBlockId: baseSleeve.stacks[0].neoblocks[0].id });
    expect(moltInMoltView.sleeves[0].stacks[0].neoblocks[0].blocks.some((block) => block.title === 'Extra Subject')).toBe(true);

    const emptySleeve: Sleeve = { ...baseSleeve, id: 'empty_sleeve', stacks: [] };
    const emptyWorkspace: UMGWorkspace = { id: 'empty_ws', title: 'Empty Workspace', activeSleeveId: emptySleeve.id, sleeves: [emptySleeve], libraryRefs: [], graph: buildGraphFromSleeve(emptySleeve) };
    const safeWrapped = insertMoltBlockIntoWorkspace(emptyWorkspace, extraBlock, { mode: 'sleeve' });
    expect(safeWrapped.sleeves[0].stacks[0].title).toBe('Draft NeoStack');
    expect(safeWrapped.sleeves[0].stacks[0].neoblocks[0].title).toBe('Draft NeoBlock');
    expect(safeWrapped.sleeves[0].stacks[0].neoblocks[0].blocks[0].title).toBe('Extra Subject');
    expect((safeWrapped.sleeves[0] as any).blocks).toBeUndefined();

    const neoInBlockView = insertNeoBlockIntoWorkspace(baseWorkspace, savedNeoBlock, { mode: 'neoblock', selectedStackId: baseSleeve.stacks[0].id });
    expect(neoInBlockView.sleeves[0].stacks[0].neoblocks.some((nb) => nb.title === 'Saved Intake NeoBlock')).toBe(true);

    const neoInSleeveView = insertNeoBlockIntoWorkspace(emptyWorkspace, savedNeoBlock, { mode: 'sleeve' });
    expect(neoInSleeveView.sleeves[0].stacks[0].title).toBe('Draft NeoStack');
    expect(neoInSleeveView.sleeves[0].stacks[0].neoblocks.some((nb) => nb.title === 'Saved Intake NeoBlock')).toBe(true);

    const stackInSleeve = insertNeoStackIntoWorkspace(baseWorkspace, savedNeoStack, { mode: 'sleeve' });
    expect(stackInSleeve.sleeves[0].stacks.some((stack) => stack.title === 'Saved Stack')).toBe(true);

    const opened = openSleeveAsWorkspace(savedSleeve);
    expect(opened.sleeves[0].id).not.toBe(baseWorkspace.sleeves[0].id);
    expect(opened.sleeves[0].title).toContain('Saved Sleeve');
    const duplicated = duplicateSleeveIntoWorkspace(baseWorkspace, savedSleeve);
    expect(duplicated.sleeves).toHaveLength(2);

    const withMeta = insertMoltBlockIntoWorkspace(baseWorkspace, meta, { mode: 'sleeve' });
    const compiled = compileWorkspaceToRuntime(withMeta, { tags: ['future'] }, { disableInstalledCompiler: true });
    expect(compiled.irMatrix.some((row) => row.nodeId.includes('aim_meta') && row.active)).toBe(false);
  });

  it('builds four asset shelves and searches by tag/title/source/contained child roles', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const savedNeoBlock: NeoBlock = { id: 'tagged_nb', title: 'Tagged NeoBlock', type: 'neoblock', tags: ['bundle-tag'], blocks: [blocks[0], blocks[1]], defaultState: 'on' };
    const savedNeoStack: NeoStack = { id: 'tagged_stack', title: 'Tagged NeoStack', type: 'neostack', tags: ['stack-tag'], neoblocks: [savedNeoBlock], defaultState: 'on' };
    const savedSleeve: Sleeve = { id: 'tagged_sleeve', title: 'Tagged Sleeve', type: 'sleeve', version: '0.1', tags: ['sleeve-tag'], stacks: [savedNeoStack], runtimeConfig: { active: true, depth: 'balanced', hermesEnabled: false, runtimeAdaptation: false, showRuntimeTrace: true } };
    const shelves = buildAssetShelves({ blocks, neoblocks: [savedNeoBlock], neostacks: [savedNeoStack], sleeves: [savedSleeve] });

    expect(shelves.map((shelf) => shelf.id)).toEqual(['molt_blocks', 'neoblocks', 'neostacks', 'sleeves', 'source_audit']);
    expect(shelves[0].items.every((item) => item.kind === 'molt_block')).toBe(true);
    expect(shelves[1].items.every((item) => item.kind === 'neoblock')).toBe(true);
    expect(shelves[2].items.every((item) => item.kind === 'neostack')).toBe(true);
    expect(shelves[3].items.every((item) => item.kind === 'sleeve')).toBe(true);
    expect(searchShelfAssets(shelves[0].items, { query: 'chatbot', tags: ['intake'] }).length).toBeGreaterThan(0);
    expect(searchShelfAssets(shelves[1].items, { query: 'directive' }).map((item) => item.id)).toContain('tagged_nb');
    expect(searchShelfAssets(shelves[2].items, { tags: ['bundle-tag'] }).map((item) => item.id)).toContain('tagged_stack');
    expect(searchShelfAssets(shelves[3].items, { tags: ['stack-tag'] }).map((item) => item.id)).toContain('tagged_sleeve');
  });

  it('accounts every scanned source asset with an audit outcome and preserves reasons', () => {
    const blocks = normalizeImportedBlocks([
      { id: 'run', role: 'Directive', title: 'Runnable', content: 'Run.', tags: ['chatbot'] },
      { id: 'meta', title: 'Meta Note', content: 'Reference.', tags: ['meta'] },
      { id: 'unsupported', role: 'Aim', title: 'Future Aim', content: 'Future.', tags: ['future'] },
      { id: 'reference', role: 'Instruction', title: 'Schema Ref', content: '', tags: [] },
      { id: 'warning', role: 'Instruction', title: 'Warning Block', content: 'Warn.', tags: [] }
    ], 'AI/run.json');
    blocks[1].legacy!.sourcePath = 'AI/meta.json';
    blocks[2].legacy!.sourcePath = 'AI/aim.json';
    blocks[3].legacy!.sourcePath = 'AI/SCHEMAS/ref.schema.json';
    blocks[4].legacy!.sourcePath = 'AI/warning.json';
    blocks[4].legacy!.migrationWarnings = ['tags defaulted'];
    blocks[4].presentationStatus = 'warning-bearing';
    const neoblock: NeoBlock = { id: 'nb', title: 'NB Asset', type: 'neoblock', tags: ['nb'], blocks: [], defaultState: 'on' } as NeoBlock;
    (neoblock as any).legacy = { sourcePath: 'AI/neoblock.json', original: {} };
    const neostack: NeoStack = { id: 'ns', title: 'NS Asset', type: 'neostack', tags: ['ns'], neoblocks: [], defaultState: 'on' } as NeoStack;
    (neostack as any).legacy = { sourcePath: 'AI/neostack.json', original: {} };
    const sleeve: Sleeve = { id: 'slv', title: 'Sleeve Asset', type: 'sleeve', version: '0.1', tags: ['slv'], stacks: [], runtimeConfig: { active: true, depth: 'balanced', hermesEnabled: false, runtimeAdaptation: false, showRuntimeTrace: true } };
    (sleeve as any).legacy = { sourcePath: 'sleeves/demo.json', original: {} };
    const sourceAssets = ['AI/run.json', 'AI/meta.json', 'AI/aim.json', 'AI/SCHEMAS/ref.schema.json', 'AI/warning.json', 'AI/neoblock.json', 'AI/neostack.json', 'sleeves/demo.json', 'AI/skipped.json', 'AI/duplicate.json']
      .map((sourcePath) => ({ lane: sourcePath.startsWith('sleeves') ? 'sleeves' : 'AI', sourcePath, data: { title: sourcePath } }));

    const audit = buildSourceAssetAudit({
      sourceAssets: sourceAssets as any,
      blocks,
      neoblocks: [neoblock],
      neostacks: [neostack],
      sleeves: [sleeve],
      report: {
        skippedAssets: [{ sourcePath: 'AI/skipped.json', reason: 'parse failed' }],
        duplicateAssets: [{ sourcePath: 'AI/duplicate.json', reason: 'duplicate source path' }]
      }
    });

    expect(audit.summary.totalScanned).toBe(10);
    expect(audit.summary.accountedTotal).toBe(10);
    expect(audit.summary.unaccountedCount).toBe(0);
    expect(audit.summary.outcomeCounts).toMatchObject({ runnable_molt: 1, meta: 1, unsupported: 1, reference_only: 1, warning: 1, neoblock: 1, neostack: 1, sleeve: 1, skipped: 1, duplicate: 1 });
    expect(audit.items.find((item) => item.outcome === 'skipped')).toMatchObject({ sourcePath: 'AI/skipped.json', reason: 'parse failed' });
    expect(audit.items.find((item) => item.outcome === 'duplicate')).toMatchObject({ sourcePath: 'AI/duplicate.json', reason: 'duplicate source path' });
    expect(audit.items.find((item) => item.outcome === 'unsupported')).toMatchObject({ sourcePath: 'AI/aim.json', reason: expect.stringContaining('unsupported') });
  });

  it('adds a Source Assets / Audit shelf and clear filters can restore its full count', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    blocks[0].legacy!.sourcePath = 'AI/run.json';
    const sourceAssets = [
      { lane: 'AI', sourcePath: 'AI/run.json', data: blocks[0].legacy?.original },
      { lane: 'AI', sourcePath: 'AI/skipped.json', data: {} }
    ];
    const audit = buildSourceAssetAudit({ sourceAssets: sourceAssets as any, blocks: [blocks[0]], neoblocks: [], neostacks: [], sleeves: [], report: { skippedAssets: [{ sourcePath: 'AI/skipped.json', reason: 'no runnable block fields detected' }] } });
    const shelves = buildAssetShelves({ blocks: [blocks[0]], neoblocks: [], neostacks: [], sleeves: [], sourceAuditItems: audit.items });
    const auditShelf = shelves.find((shelf) => shelf.id === 'source_audit');

    expect(shelves.map((shelf) => shelf.id)).toEqual(['molt_blocks', 'neoblocks', 'neostacks', 'sleeves', 'source_audit']);
    expect(auditShelf?.items).toHaveLength(2);
    expect(searchShelfAssets(auditShelf!.items, { query: 'skipped' })).toHaveLength(1);
    expect(searchShelfAssets(auditShelf!.items, { query: '', tags: [] })).toHaveLength(2);
  });

  it('imports AI instruction JSON library entries into runnable MOLT instruction blocks with stable source metadata', () => {
    const parsed = normalizeAIInstructionEntry(instructionEntry001);

    expect(stableAIInstructionId(instructionEntry001)).toBe('inst_001');
    expect(parsed).toMatchObject({ id: 'inst_001', type: 'molt_block', role: 'instruction', status: 'runnable', presentationStatus: 'runnable', sourcePath: 'AI/MOLT-BLOCKS/instructions/library.v1.0.0.json#INST.001', sourceLayer: 'AI' });
    expect(parsed.title).toBe('Break into components');
    expect(parsed.description).toBe('Break into components');
    expect(parsed.action).toBe('Decompose complex system or concept into constituent parts');
    expect(parsed.expectedOutput).toBe('List of distinct components with relationships identified');
    expect(parsed.content).toContain('Action: Decompose complex system or concept into constituent parts');
    expect(parsed.content).toContain('Expected Output: List of distinct components with relationships identified');
    expect(parsed.tags).toEqual(expect.arrayContaining(['instruction', 'molt', 'ai', 'source-ai', 'analytical-actions']));
    expect(parsed.legacy?.parentSourcePath).toBe('AI/MOLT-BLOCKS/instructions/library.v1.0.0.json');
    expect(parsed.legacy?.libraryEntryId).toBe('INST.001');
    expect(parsed.legacy?.original).toBe(instructionEntry001);
  });

  it('surfaces imported AI JSON instructions in Instruction shelves, tag search, and source audit without blind composer activation', () => {
    const inst001 = normalizeAIInstructionEntry(instructionEntry001);
    const inst003 = normalizeAIInstructionEntry(instructionEntry003);
    const manyAIInstructions = Array.from({ length: 20 }, (_, index) => ({ ...structuredClone(inst001), id: `inst_${String(index + 1).padStart(3, '0')}_sample`, title: `Sample AI Instruction ${index + 1}`, tags: ['instruction', 'molt', 'ai', 'source-ai', `sample-${index + 1}`] }));
    const blocks = [...normalizeImportedBlocks(rawBlocks), inst001, inst003, ...manyAIInstructions];
    const sections = sectionLibraryByDisplayType(blocks);
    const shelves = buildAssetShelves({ blocks, neoblocks: [], neostacks: [], sleeves: [], sourceAuditItems: [
      { id: 'src_inst001', title: inst001.title, detectedType: 'molt_block', normalizedRole: 'instruction', outcome: 'runnable_molt', tags: inst001.tags, sourcePath: inst001.sourcePath!, legacySource: inst001.legacy?.original },
      { id: 'src_inst003', title: inst003.title, detectedType: 'molt_block', normalizedRole: 'instruction', outcome: 'runnable_molt', tags: inst003.tags, sourcePath: inst003.sourcePath!, legacySource: inst003.legacy?.original }
    ] });

    expect(sections.find((section) => section.type === 'instruction')?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['inst_001', 'inst_003']));
    expect(searchShelfAssets(shelves[0].items, { query: 'break components' }).map((item) => item.id)).toContain('inst_001');
    expect(searchShelfAssets(shelves[0].items, { query: 'trace causality' }).map((item) => item.id)).toContain('inst_003');
    expect(searchShelfAssets(shelves[0].items, { tags: ['instruction'] }).length).toBeGreaterThanOrEqual(2);
    expect(searchShelfAssets(shelves[4].items, { query: 'INST.001' })).toHaveLength(1);

    const composed = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'balanced' }, blocks);
    const selectedAIInstructions = composed.selected_nodes.filter((node) => node.sourceLayer === 'AI' && node.id.startsWith('inst_'));
    expect(selectedAIInstructions.length).toBeLessThan(manyAIInstructions.length + 2);
    expect(composed.selected_nodes.length).toBeLessThan(blocks.length);
  });

  it('keeps imported AI JSON instructions compatible with real compile and graph/IR agreement while Meta stays non-compiler', () => {
    const inst001 = normalizeAIInstructionEntry(instructionEntry001);
    const meta = normalizeImportedBlocks([{ id: 'future_need', role: 'Need', title: 'Future Need', content: 'Do not compile.', tags: ['future'] }], 'HUMAN/MOLT-BLOCKS/need/future.md')[0];
    const blocks = [...normalizeImportedBlocks(rawBlocks), inst001, meta];
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing break components', depth: 'balanced' }, blocks).draft_sleeve;
    sleeve.stacks[0].neoblocks[0].blocks.push(meta);
    const workspace = { id: 'ws_ai_instruction', title: 'AI Instruction Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'break', 'components'] });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);
    const activeRows = compiled.irMatrix.filter((row) => row.active && !row.off);

    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(compiled.irMatrix.some((row) => row.nodeId.includes('future_need') && row.active)).toBe(false);
    for (const row of activeRows) expect(graph.nodes.find((node) => node.sourceId === row.nodeId)?.state.active).toBe(true);
  });

  it('imports AI subject JSON library entries into runnable MOLT subject blocks with stable source metadata', () => {
    const parsed = normalizeAISubjectEntry(subjectEntry001);

    expect(stableAISubjectId(subjectEntry001)).toBe('subj_001');
    expect(parsed).toMatchObject({ id: 'subj_001', type: 'molt_block', role: 'subject', status: 'runnable', presentationStatus: 'runnable', sourcePath: 'AI/MOLT-BLOCKS/subjects/library.v1.0.0.json#SUBJ.001', sourceLayer: 'AI' });
    expect(parsed.title).toBe('Raw data');
    expect(parsed.description).toBe('Unprocessed information in various formats');
    expect(parsed.content).toContain('Subject: Unprocessed information in various formats');
    expect(parsed.content).toContain('Examples: sensor readings, log entries, database records');
    expect(parsed.tags).toEqual(expect.arrayContaining(['subject', 'molt', 'ai', 'source-ai', 'data-information']));
    expect(parsed.legacy?.parentSourcePath).toBe('AI/MOLT-BLOCKS/subjects/library.v1.0.0.json');
    expect(parsed.legacy?.libraryEntryId).toBe('SUBJ.001');
    expect(parsed.legacy?.original).toBe(subjectEntry001);
  });

  it('surfaces imported AI JSON subjects in Subject shelves, tag search, and source audit without blind composer activation', () => {
    const subj001 = normalizeAISubjectEntry(subjectEntry001);
    const subj010 = normalizeAISubjectEntry(subjectEntry010);
    const manyAISubjects = Array.from({ length: 20 }, (_, index) => ({ ...structuredClone(subj001), id: `subj_${String(index + 1).padStart(3, '0')}_sample`, title: `Sample AI Subject ${index + 1}`, tags: ['subject', 'molt', 'ai', 'source-ai', `subject-sample-${index + 1}`] }));
    const blocks = [...normalizeImportedBlocks(rawBlocks), subj001, subj010, ...manyAISubjects];
    const sections = sectionLibraryByDisplayType(blocks);
    const shelves = buildAssetShelves({ blocks, neoblocks: [], neostacks: [], sleeves: [], sourceAuditItems: [
      { id: 'src_subj001', title: subj001.title, detectedType: 'molt_block', normalizedRole: 'subject', outcome: 'runnable_molt', tags: subj001.tags, sourcePath: subj001.sourcePath!, legacySource: subj001.legacy?.original },
      { id: 'src_subj010', title: subj010.title, detectedType: 'molt_block', normalizedRole: 'subject', outcome: 'runnable_molt', tags: subj010.tags, sourcePath: subj010.sourcePath!, legacySource: subj010.legacy?.original }
    ] });

    expect(sections.find((section) => section.type === 'subject')?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['subj_001', 'subj_010']));
    expect(searchShelfAssets(shelves[0].items, { query: 'raw data' }).map((item) => item.id)).toContain('subj_001');
    expect(searchShelfAssets(shelves[0].items, { query: 'customer request' }).map((item) => item.id)).toContain('subj_010');
    expect(searchShelfAssets(shelves[0].items, { tags: ['subject'] }).length).toBeGreaterThanOrEqual(2);
    expect(searchShelfAssets(shelves[4].items, { query: 'SUBJ.001' })).toHaveLength(1);

    const composed = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'balanced' }, blocks);
    const selectedAISubjects = composed.selected_nodes.filter((node) => node.sourceLayer === 'AI' && node.id.startsWith('subj_'));
    expect(selectedAISubjects.length).toBeLessThan(manyAISubjects.length + 2);
    expect(composed.selected_nodes.length).toBeLessThan(blocks.length);
  });

  it('keeps imported AI JSON subjects compatible with real compile and graph/IR agreement while Meta stays non-compiler', () => {
    const subj010 = normalizeAISubjectEntry(subjectEntry010);
    const meta = normalizeImportedBlocks([{ id: 'future_need', role: 'Need', title: 'Future Need', content: 'Do not compile.', tags: ['future'] }], 'HUMAN/MOLT-BLOCKS/need/future.md')[0];
    const blocks = [...normalizeImportedBlocks(rawBlocks), subj010, meta];
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing customer request', depth: 'balanced' }, blocks).draft_sleeve;
    sleeve.stacks[0].neoblocks[0].blocks.push(meta);
    const workspace = { id: 'ws_ai_subject', title: 'AI Subject Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'customer', 'request'] });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);
    const activeRows = compiled.irMatrix.filter((row) => row.active && !row.off);

    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(compiled.irMatrix.some((row) => row.nodeId.includes('future_need') && row.active)).toBe(false);
    for (const row of activeRows) expect(graph.nodes.find((node) => node.sourceId === row.nodeId)?.state.active).toBe(true);
  });

  it('imports AI primary JSON library entries into runnable MOLT primary blocks with stable source metadata', () => {
    const parsed = normalizeAIPrimaryEntry(primaryEntry001);

    expect(stableAIPrimaryId(primaryEntry001)).toBe('prim_001');
    expect(parsed).toMatchObject({ id: 'prim_001', type: 'molt_block', role: 'primary', status: 'runnable', presentationStatus: 'runnable', sourcePath: 'AI/MOLT-BLOCKS/primary/library.v1.0.0.json#PRIM.001', sourceLayer: 'AI' });
    expect(parsed.title).toBe('Factual accuracy');
    expect(parsed.description).toBe('Getting the facts right');
    expect(parsed.content).toContain('Primary: Getting the facts right');
    expect(parsed.content).toContain('Core Concern: Truth over approximation');
    expect(parsed.tags).toEqual(expect.arrayContaining(['primary', 'molt', 'ai', 'source-ai', 'accuracy-precision', 'factual-accuracy']));
    expect(parsed.legacy?.parentSourcePath).toBe('AI/MOLT-BLOCKS/primary/library.v1.0.0.json');
    expect(parsed.legacy?.libraryEntryId).toBe('PRIM.001');
    expect(parsed.legacy?.original).toBe(primaryEntry001);
  });

  it('surfaces imported AI JSON primary blocks in Primary shelves, tag search, and source audit without blind composer activation', () => {
    const prim001 = normalizeAIPrimaryEntry(primaryEntry001);
    const prim010 = normalizeAIPrimaryEntry(primaryEntry010);
    const manyAIPrimaries = Array.from({ length: 20 }, (_, index) => ({ ...structuredClone(prim001), id: `prim_${String(index + 1).padStart(3, '0')}_sample`, title: `Sample AI Primary ${index + 1}`, tags: ['primary', 'molt', 'ai', 'source-ai', `primary-sample-${index + 1}`] }));
    const blocks = [...normalizeImportedBlocks(rawBlocks), prim001, prim010, ...manyAIPrimaries];
    const sections = sectionLibraryByDisplayType(blocks);
    const shelves = buildAssetShelves({ blocks, neoblocks: [], neostacks: [], sleeves: [], sourceAuditItems: [
      { id: 'src_prim001', title: prim001.title, detectedType: 'molt_block', normalizedRole: 'primary', outcome: 'runnable_molt', tags: prim001.tags, sourcePath: prim001.sourcePath!, legacySource: prim001.legacy?.original },
      { id: 'src_prim010', title: prim010.title, detectedType: 'molt_block', normalizedRole: 'primary', outcome: 'runnable_molt', tags: prim010.tags, sourcePath: prim010.sourcePath!, legacySource: prim010.legacy?.original }
    ] });

    expect(sections.find((section) => section.type === 'primary')?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['prim_001', 'prim_010']));
    expect(searchShelfAssets(shelves[0].items, { query: 'factual accuracy' }).map((item) => item.id)).toContain('prim_001');
    expect(searchShelfAssets(shelves[0].items, { tags: ['customer-satisfaction'] }).map((item) => item.id)).toContain('prim_010');
    expect(searchShelfAssets(shelves[4].items, { query: 'PRIM.001' })).toHaveLength(1);

    const composed = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'balanced' }, blocks);
    const selectedAIPrimaries = composed.selected_nodes.filter((node) => node.sourceLayer === 'AI' && node.id.startsWith('prim_'));
    expect(selectedAIPrimaries.length).toBeLessThan(manyAIPrimaries.length + 2);
    expect(composed.selected_nodes.length).toBeLessThan(blocks.length);
  });

  it('keeps imported AI JSON primary blocks compatible with real compile and graph/IR agreement while Meta stays non-compiler', () => {
    const prim010 = normalizeAIPrimaryEntry(primaryEntry010);
    const meta = normalizeImportedBlocks([{ id: 'future_need', role: 'Need', title: 'Future Need', content: 'Do not compile.', tags: ['future'] }], 'HUMAN/MOLT-BLOCKS/need/future.md')[0];
    const blocks = [...normalizeImportedBlocks(rawBlocks), prim010, meta];
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing customer satisfaction', depth: 'balanced' }, blocks).draft_sleeve;
    sleeve.stacks[0].neoblocks[0].blocks.push(meta);
    const workspace = { id: 'ws_ai_primary', title: 'AI Primary Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'customer', 'satisfaction'] });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);
    const activeRows = compiled.irMatrix.filter((row) => row.active && !row.off);

    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(compiled.irMatrix.some((row) => row.nodeId.includes('future_need') && row.active)).toBe(false);
    for (const row of activeRows) expect(graph.nodes.find((node) => node.sourceId === row.nodeId)?.state.active).toBe(true);
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
