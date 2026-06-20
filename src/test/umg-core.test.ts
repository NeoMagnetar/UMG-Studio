import { describe, expect, it } from 'vitest';
import { composeBlocks } from '../lib/umg/composeBlocks';
import { applyCompileResultToGraph, applyManualLayout, applySnapLayout, buildGraphFromSleeve, focusGraph, gateVisualMetadataForEdge, gateVisualMetadataForNode, openSelectedAsFocus, projectGateRowsToGraph, selectGraphNode } from '../lib/umg/graphBuilder';
import { DISPLAY_TYPE_ORDER, MOLT_ROLE_ORDER, addWorkbenchBlockByRole, saveWorkbenchBlockToLibrary, toggleWorkbenchBlock, updateWorkbenchBlockContent, validateHermesWorkbenchGeneration } from '../lib/umg/moltWorkbench';
import { defaultWorkbenchLayout, loadWorkbenchLayout, saveWorkbenchLayout } from '../lib/umg/workbenchLayout';
import { compileWorkspaceToRuntime } from '../lib/umg/compilerBridge';
import { classifyLibraryDisplay, getLibraryAssetStatus, isCompilerMoltBlock, normalizeImportedBlocks, normalizeSourceCatalog, sectionLibraryByDisplayType } from '../lib/umg/migrateLibrary';
import { exportHermesPacket } from '../lib/umg/exporters';
import { projectGlyphMatrix, renderGlyphMatrixText } from '../lib/umg/glyphMatrix';
import { attachRuntimeGateToGraph, buildGateIRRow, buildGateIRRowsForWorkspace, buildRuntimeGate, buildRuntimeGateContext, buildRuntimeGateFromSourceCard, GATE_KINDS, gateProjectionPrinciples } from '../lib/umg/gateRuntime';
import { buildAssetShelves, buildSourceAssetAudit, duplicateSleeveIntoWorkspace, insertMoltBlockIntoWorkspace, insertNeoBlockIntoWorkspace, insertNeoStackIntoWorkspace, openSleeveAsWorkspace, searchShelfAssets } from '../lib/umg/libraryAssets';
import { buildBlockInspectorViews } from '../lib/umg/blockViews';
import { buildFullGateSourceRecord, buildTriggerGateSourceInspectorViews, normalizeTriggerGateSourceCards, parseTriggerGateSourceMarkdown } from '../lib/umg/gateSourceImport';
import normalizedLibraryBlocks from '../../data/library/normalized-blocks.json';
import { normalizeAIInstructionEntry, stableAIInstructionId } from '../lib/umg/aiInstructionImport';
import { normalizeAISubjectEntry, stableAISubjectId } from '../lib/umg/aiSubjectImport';
import { normalizeAIPrimaryEntry, stableAIPrimaryId } from '../lib/umg/aiPrimaryImport';
import { normalizeAIDirectiveEntry, stableAIDirectiveId } from '../lib/umg/aiDirectiveImport';
import { normalizeAIPhilosophyEntry, stableAIPhilosophyId } from '../lib/umg/aiPhilosophyImport';
import { normalizeAIBlueprintEntry, stableAIBlueprintId } from '../lib/umg/aiBlueprintImport';
import { NeoBlock, NeoStack, Sleeve, UMGWorkspace } from '../lib/umg/types';

const trg001Markdown = `# TRG.001 ? Technical Analysis Request

**Type:** TRIGGER
**Category:** general
**Subcategory:** analytical_requests
**Status:** active

## Summary
Technical Analysis Request

## Activation
User requests analysis of code, system, or technical architecture

## Tags
trigger, analytical-requests
`;

const trg020Markdown = `# TRG.020 - Option Generation

**Type:** TRIGGER
**Category:** general
**Subcategory:** decision_support
**Status:** active

## Summary
Option Generation

## Tags
trigger, decision-support
`;

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

const directiveEntry001 = {
  id: 'DIR.001',
  type: 'DIRECTIVE',
  name: 'Assess accurately',
  category: 'general',
  subcategory: 'analytical_directives',
  scope: 'Prioritize accurate assessment over speed or agreeability',
  status: 'active',
  version: '1.0.0',
  tags: ['directive', 'analytical-directives'],
  source: { library_name: 'MOLT DIRECTIVE Library', library_version: '1.0.0' },
  content: { summary: 'Assess accurately', details: null, structure: null },
  constraints: ['All analysis must favor truth over convenience'],
  notes: null
};

const directiveEntry010 = {
  id: 'DIR.010',
  type: 'DIRECTIVE',
  name: 'Maintain customer clarity',
  category: 'customer_support',
  subcategory: 'service_clarity',
  scope: 'Keep mobile detailing customer intake clear and actionable',
  status: 'active',
  version: '1.0.0',
  tags: ['directive', 'customer-support', 'mobile-detailing'],
  source: { library_name: 'MOLT DIRECTIVE Library', library_version: '1.0.0' },
  content: { summary: 'Maintain customer clarity', details: 'Ask concise service questions and avoid vague commitments.', structure: null },
  action: 'Keep the customer interaction clear and actionable',
  expected_output: 'Clear customer-facing directive for the intake flow',
  constraints: ['Avoid vague commitments'],
  notes: null
};

const philosophyEntry001 = {
  id: 'PHIL.001',
  type: 'PHILOSOPHY',
  name: 'Platonism',
  category: 'ancient_greek_roman',
  subcategory: 'platonism',
  domain: 'ANCIENT_GREEK_ROMAN',
  status: 'active',
  version: '1.0.0',
  tags: ['philosophy', 'ancient-greek-roman', 'platonism'],
  source: { library_name: 'MOLT PHILOSOPHY Library', library_version: '1.0.0' },
  core_principles: 'Reality of eternal Forms/Ideas beyond physical world; knowledge through reason and dialectic; material world as imperfect reflection of ideal Forms',
  application: 'Seek underlying ideal principles beneath surface appearances; prioritize abstract reasoning over empirical observation; look for perfect forms that material instances approximate',
  key_values: ['Eternal truths', 'Ideal forms', 'Rational insight', 'Transcendent reality'],
  notes: null
};

const philosophyEntry010 = {
  id: 'PHIL.010',
  type: 'PHILOSOPHY',
  name: 'Pragmatic service clarity',
  category: 'customer_support',
  subcategory: 'service_clarity',
  domain: 'CUSTOMER_SUPPORT',
  status: 'active',
  version: '1.0.0',
  tags: ['philosophy', 'customer-support', 'mobile-detailing'],
  source: { library_name: 'MOLT PHILOSOPHY Library', library_version: '1.0.0' },
  content: { summary: 'Pragmatic service clarity', details: 'Value customer understanding over abstract completeness.', structure: null },
  action: 'Use practical customer clarity as a philosophy layer',
  expected_output: 'A customer-centered philosophy anchor',
  notes: null
};

const blueprintEntry001 = {
  id: 'BP.001',
  type: 'BLUEPRINT',
  name: 'Python',
  category: 'programming_languages',
  subcategory: 'python',
  domain: 'PROGRAMMING_LANGUAGES',
  status: 'active',
  version: '1.0.0',
  tags: ['blueprint', 'programming-languages', 'python'],
  source: { library_name: 'MOLT BLUEPRINT Library', library_version: '1.0.0' },
  structure: 'Indentation-based blocks; dynamic typing; object-oriented and functional; extensive standard library; PEP 8 style guide',
  conventions: 'snake_case for variables/functions; CamelCase for classes; 4-space indentation; docstrings for documentation; list comprehensions',
  output_characteristics: 'Readable, explicit, minimal syntax; whitespace significant; batteries included philosophy',
  notes: null
};

const blueprintEntry010 = {
  id: 'BP.010',
  type: 'BLUEPRINT',
  name: 'Mobile Detailing Intake Summary',
  category: 'customer_support',
  subcategory: 'mobile_detailing_summary',
  domain: 'CUSTOMER_SUPPORT',
  status: 'active',
  version: '1.0.0',
  tags: ['blueprint', 'customer-support', 'mobile-detailing', 'summary'],
  source: { library_name: 'MOLT BLUEPRINT Library', library_version: '1.0.0' },
  content: { summary: 'Mobile Detailing Intake Summary', details: 'Structure the output as customer details, vehicle, service need, budget, and lead summary.', structure: null },
  action: 'Shape the customer intake result into a structured lead summary',
  expected_output: 'A clean mobile detailing lead summary blueprint',
  notes: null
};

describe('UMG Studio core engine', () => {
  it('exposes layered block inspector views with hierarchy-order priority semantics and legacy source preservation', () => {
    const block = normalizeAIInstructionEntry(instructionEntry001);
    const views = buildBlockInspectorViews(block, {
      graphNode: { id: 'node_inst_001', sourceId: block.id, nodeType: 'molt_block', label: block.title, position: { x: 0, y: 0 }, state: { selected: true, active: true, off: false, triggered: false, invalid: false } },
      irRow: { rowId: 'ir_1', nodeId: block.id, nodeType: 'molt_block', role: 'instruction', title: block.title, selected: true, active: true, off: false, triggered: false, required: true, tagsMatched: ['instruction'], priority: block.priorityOrder, contribution: block.content }
    });

    expect(views.card).toMatchObject({ type: 'SearchCard', id: 'inst_001', role: 'instruction', title: 'Break into components' });
    expect(views.card.hierarchy).toEqual({ orderIndex: 20, orderSource: 'priorityOrder', priorityMeaning: 'hierarchy_order' });
    expect(views.runtime).toMatchObject({ type: 'RuntimeBlock', role: 'instruction', compiler: { source: 'compiler_aligned_json', moltType: 'instruction' } });
    expect(views.runtime.runtimeState).toMatchObject({ selected: true, active: true, off: false, triggered: false });
    expect(views.nl).toContain('Break into components');
    expect(views.nl).toContain('role: Instruction');
    expect(views.compilerJson).toEqual(views.runtime);
    expect(views.legacySource).toMatchObject({ type: 'FullSourceRecord', sourcePath: 'AI/MOLT-BLOCKS/instructions/library.v1.0.0.json#INST.001', sourceLayer: 'AI' });
    expect(views.legacySource.legacyOriginal).toMatchObject({ id: 'INST.001', type: 'INSTRUCTION' });
    expect(views.irRow?.nodeId).toBe(block.id);
  });

  it('does not model Merge or Off as MOLT types while exposing Off as runtime state', () => {
    expect(MOLT_ROLE_ORDER).not.toContain('merge' as any);
    expect(MOLT_ROLE_ORDER).not.toContain('off' as any);
    const block = { ...normalizeAIPrimaryEntry(primaryEntry001), defaultState: 'off' as const };
    const views = buildBlockInspectorViews(block);

    expect(views.runtime.runtimeState.off).toBe(true);
    expect(views.runtime.role).toBe('primary');
  });

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

    expect(shelves.map((shelf) => shelf.id)).toEqual(['molt_blocks', 'neoblocks', 'neostacks', 'sleeves', 'control_sources', 'source_audit']);
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

    expect(shelves.map((shelf) => shelf.id)).toEqual(['molt_blocks', 'neoblocks', 'neostacks', 'sleeves', 'control_sources', 'source_audit']);
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
    expect(searchShelfAssets(shelves[5].items, { query: 'INST.001' })).toHaveLength(1);

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
    expect(searchShelfAssets(shelves[5].items, { query: 'SUBJ.001' })).toHaveLength(1);

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
    expect(searchShelfAssets(shelves[5].items, { query: 'PRIM.001' })).toHaveLength(1);

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

  it('imports AI directive JSON library entries into runnable MOLT directive blocks with stable source metadata', () => {
    const parsed = normalizeAIDirectiveEntry(directiveEntry001);

    expect(stableAIDirectiveId(directiveEntry001)).toBe('dir_001');
    expect(parsed).toMatchObject({ id: 'dir_001', type: 'molt_block', role: 'directive', displayType: 'directive', status: 'runnable', presentationStatus: 'runnable', sourcePath: 'AI/MOLT-BLOCKS/directives/library.v1.0.0.json#DIR.001', sourceLayer: 'AI' });
    expect(parsed.title).toBe('Assess accurately');
    expect(parsed.description).toBe('Assess accurately');
    expect(parsed.content).toContain('Directive: Assess accurately');
    expect(parsed.content).toContain('Scope: Prioritize accurate assessment over speed or agreeability');
    expect(parsed.content).toContain('Constraints: All analysis must favor truth over convenience');
    expect(parsed.tags).toEqual(expect.arrayContaining(['directive', 'molt', 'ai', 'source-ai', 'analytical-directives']));
    expect(parsed.hierarchy).toEqual({ orderIndex: 10, orderSource: 'priorityOrder', priorityMeaning: 'hierarchy_order' });
    expect(parsed.legacy?.parentSourcePath).toBe('AI/MOLT-BLOCKS/directives/library.v1.0.0.json');
    expect(parsed.legacy?.libraryEntryId).toBe('DIR.001');
    expect(parsed.legacy?.original).toBe(directiveEntry001);
  });

  it('surfaces imported AI JSON directive blocks in Directive shelves, tag search, source audit, and inspector views without blind composer activation', () => {
    const dir001 = normalizeAIDirectiveEntry(directiveEntry001);
    const dir010 = normalizeAIDirectiveEntry(directiveEntry010);
    const manyAIDirectives = Array.from({ length: 20 }, (_, index) => ({ ...structuredClone(dir001), id: `dir_${String(index + 1).padStart(3, '0')}_sample`, title: `Sample AI Directive ${index + 1}`, tags: ['directive', 'molt', 'ai', 'source-ai', `directive-sample-${index + 1}`] }));
    const blocks = [...normalizeImportedBlocks(rawBlocks), dir001, dir010, ...manyAIDirectives];
    const sections = sectionLibraryByDisplayType(blocks);
    const shelves = buildAssetShelves({ blocks, neoblocks: [], neostacks: [], sleeves: [], sourceAuditItems: [
      { id: 'src_dir001', title: dir001.title, detectedType: 'molt_block', normalizedRole: 'directive', outcome: 'runnable_molt', tags: dir001.tags, sourcePath: dir001.sourcePath!, legacySource: dir001.legacy?.original },
      { id: 'src_dir010', title: dir010.title, detectedType: 'molt_block', normalizedRole: 'directive', outcome: 'runnable_molt', tags: dir010.tags, sourcePath: dir010.sourcePath!, legacySource: dir010.legacy?.original }
    ] });
    const views = buildBlockInspectorViews(dir001);

    expect(sections.find((section) => section.type === 'directive')?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['dir_001', 'dir_010']));
    expect(searchShelfAssets(shelves[0].items, { query: 'assess accurately' }).map((item) => item.id)).toContain('dir_001');
    expect(searchShelfAssets(shelves[0].items, { tags: ['mobile-detailing'] }).map((item) => item.id)).toContain('dir_010');
    expect(searchShelfAssets(shelves[5].items, { query: 'DIR.001' })).toHaveLength(1);
    expect(views.card.type).toBe('SearchCard');
    expect(views.runtime).toMatchObject({ type: 'RuntimeBlock', role: 'directive', compiler: { source: 'compiler_aligned_json', moltType: 'directive' } });
    expect(views.nl).toContain('role: Directive');
    expect(views.compilerJson).toEqual(views.runtime);
    expect(views.legacySource.legacyOriginal).toMatchObject({ id: 'DIR.001', type: 'DIRECTIVE' });

    const composed = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'balanced' }, blocks);
    const selectedAIDirectives = composed.selected_nodes.filter((node) => node.sourceLayer === 'AI' && node.id.startsWith('dir_'));
    expect(selectedAIDirectives.length).toBeLessThan(manyAIDirectives.length + 2);
    expect(composed.selected_nodes.length).toBeLessThan(blocks.length);
  });

  it('keeps imported AI JSON directive blocks compatible with real compile and graph/IR agreement while Meta stays non-compiler', () => {
    const dir010 = normalizeAIDirectiveEntry(directiveEntry010);
    const meta = normalizeImportedBlocks([{ id: 'future_need', role: 'Need', title: 'Future Need', content: 'Do not compile.', tags: ['future'] }], 'HUMAN/MOLT-BLOCKS/need/future.md')[0];
    const blocks = [...normalizeImportedBlocks(rawBlocks), dir010, meta];
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing customer clarity', depth: 'balanced' }, blocks).draft_sleeve;
    sleeve.stacks[0].neoblocks[0].blocks.push(meta);
    const workspace = { id: 'ws_ai_directive', title: 'AI Directive Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'customer', 'clarity'] });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);
    const activeRows = compiled.irMatrix.filter((row) => row.active && !row.off);

    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(compiled.irMatrix.some((row) => row.nodeId.includes('future_need') && row.active)).toBe(false);
    for (const row of activeRows) expect(graph.nodes.find((node) => node.sourceId === row.nodeId)?.state.active).toBe(true);
  });

  it('imports AI philosophy JSON library entries into runnable MOLT philosophy blocks with stable source metadata', () => {
    const parsed = normalizeAIPhilosophyEntry(philosophyEntry001);

    expect(stableAIPhilosophyId(philosophyEntry001)).toBe('phil_001');
    expect(parsed).toMatchObject({ id: 'phil_001', type: 'molt_block', role: 'philosophy', displayType: 'philosophy', status: 'runnable', presentationStatus: 'runnable', sourcePath: 'AI/MOLT-BLOCKS/philosophy/library.v1.0.0.json#PHIL.001', sourceLayer: 'AI' });
    expect(parsed.title).toBe('Platonism');
    expect(parsed.description).toContain('Reality of eternal Forms');
    expect(parsed.content).toContain('Philosophy: Reality of eternal Forms');
    expect(parsed.content).toContain('Application: Seek underlying ideal principles');
    expect(parsed.content).toContain('Key Values: Eternal truths; Ideal forms; Rational insight; Transcendent reality');
    expect(parsed.tags).toEqual(expect.arrayContaining(['philosophy', 'molt', 'ai', 'source-ai', 'ancient-greek-roman', 'platonism']));
    expect(parsed.hierarchy).toEqual({ orderIndex: 50, orderSource: 'priorityOrder', priorityMeaning: 'hierarchy_order' });
    expect(parsed.legacy?.parentSourcePath).toBe('AI/MOLT-BLOCKS/philosophy/library.v1.0.0.json');
    expect(parsed.legacy?.libraryEntryId).toBe('PHIL.001');
    expect(parsed.legacy?.original).toBe(philosophyEntry001);
  });

  it('surfaces imported AI JSON philosophy blocks in Philosophy shelves, tag search, source audit, and inspector views without blind composer activation', () => {
    const phil001 = normalizeAIPhilosophyEntry(philosophyEntry001);
    const phil010 = normalizeAIPhilosophyEntry(philosophyEntry010);
    const manyAIPhilosophies = Array.from({ length: 20 }, (_, index) => ({ ...structuredClone(phil001), id: `phil_${String(index + 1).padStart(3, '0')}_sample`, title: `Sample AI Philosophy ${index + 1}`, tags: ['philosophy', 'molt', 'ai', 'source-ai', `philosophy-sample-${index + 1}`] }));
    const blocks = [...normalizeImportedBlocks(rawBlocks), phil001, phil010, ...manyAIPhilosophies];
    const sections = sectionLibraryByDisplayType(blocks);
    const shelves = buildAssetShelves({ blocks, neoblocks: [], neostacks: [], sleeves: [], sourceAuditItems: [
      { id: 'src_phil001', title: phil001.title, detectedType: 'molt_block', normalizedRole: 'philosophy', outcome: 'runnable_molt', tags: phil001.tags, sourcePath: phil001.sourcePath!, legacySource: phil001.legacy?.original },
      { id: 'src_phil010', title: phil010.title, detectedType: 'molt_block', normalizedRole: 'philosophy', outcome: 'runnable_molt', tags: phil010.tags, sourcePath: phil010.sourcePath!, legacySource: phil010.legacy?.original }
    ] });
    const views = buildBlockInspectorViews(phil001);

    expect(sections.find((section) => section.type === 'philosophy')?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['phil_001', 'phil_010']));
    expect(searchShelfAssets(shelves[0].items, { query: 'platonism' }).map((item) => item.id)).toContain('phil_001');
    expect(searchShelfAssets(shelves[0].items, { tags: ['mobile-detailing'] }).map((item) => item.id)).toContain('phil_010');
    expect(searchShelfAssets(shelves[5].items, { query: 'PHIL.001' })).toHaveLength(1);
    expect(views.card.type).toBe('SearchCard');
    expect(views.runtime).toMatchObject({ type: 'RuntimeBlock', role: 'philosophy', compiler: { source: 'compiler_aligned_json', moltType: 'philosophy' } });
    expect(views.nl).toContain('role: Philosophy');
    expect(views.compilerJson).toEqual(views.runtime);
    expect(views.legacySource.legacyOriginal).toMatchObject({ id: 'PHIL.001', type: 'PHILOSOPHY' });

    const composed = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'balanced' }, blocks);
    const selectedAIPhilosophies = composed.selected_nodes.filter((node) => node.sourceLayer === 'AI' && node.id.startsWith('phil_'));
    expect(selectedAIPhilosophies.length).toBeLessThan(manyAIPhilosophies.length + 2);
    expect(composed.selected_nodes.length).toBeLessThan(blocks.length);
  });

  it('keeps imported AI JSON philosophy blocks compatible with real compile and graph/IR agreement while Meta stays non-compiler', () => {
    const phil010 = normalizeAIPhilosophyEntry(philosophyEntry010);
    const meta = normalizeImportedBlocks([{ id: 'future_need', role: 'Need', title: 'Future Need', content: 'Do not compile.', tags: ['future'] }], 'HUMAN/MOLT-BLOCKS/need/future.md')[0];
    const blocks = [...normalizeImportedBlocks(rawBlocks), phil010, meta];
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing customer clarity', depth: 'balanced' }, blocks).draft_sleeve;
    sleeve.stacks[0].neoblocks[0].blocks.push(meta);
    const workspace = { id: 'ws_ai_philosophy', title: 'AI Philosophy Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'customer', 'clarity'] });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);
    const activeRows = compiled.irMatrix.filter((row) => row.active && !row.off);

    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(compiled.irMatrix.some((row) => row.nodeId.includes('future_need') && row.active)).toBe(false);
    for (const row of activeRows) expect(graph.nodes.find((node) => node.sourceId === row.nodeId)?.state.active).toBe(true);
  });

  it('imports AI blueprint JSON library entries into runnable MOLT blueprint blocks with stable source metadata', () => {
    const parsed = normalizeAIBlueprintEntry(blueprintEntry001);

    expect(stableAIBlueprintId(blueprintEntry001)).toBe('bp_001');
    expect(parsed).toMatchObject({ id: 'bp_001', type: 'molt_block', role: 'blueprint', displayType: 'blueprint', status: 'runnable', presentationStatus: 'runnable', sourcePath: 'AI/MOLT-BLOCKS/blueprints/library.v1.0.0.json#BP.001', sourceLayer: 'AI' });
    expect(parsed.title).toBe('Python');
    expect(parsed.description).toContain('Indentation-based blocks');
    expect(parsed.content).toContain('Blueprint: Indentation-based blocks');
    expect(parsed.content).toContain('Conventions: snake_case');
    expect(parsed.content).toContain('Output Characteristics: Readable, explicit');
    expect(parsed.tags).toEqual(expect.arrayContaining(['blueprint', 'molt', 'ai', 'source-ai', 'programming-languages', 'python']));
    expect(parsed.hierarchy).toEqual({ orderIndex: 60, orderSource: 'priorityOrder', priorityMeaning: 'hierarchy_order' });
    expect(parsed.legacy?.parentSourcePath).toBe('AI/MOLT-BLOCKS/blueprints/library.v1.0.0.json');
    expect(parsed.legacy?.libraryEntryId).toBe('BP.001');
    expect(parsed.legacy?.original).toBe(blueprintEntry001);
  });

  it('surfaces imported AI JSON blueprint blocks in Blueprint shelves, tag search, source audit, and inspector views without blind composer activation', () => {
    const bp001 = normalizeAIBlueprintEntry(blueprintEntry001);
    const bp010 = normalizeAIBlueprintEntry(blueprintEntry010);
    const manyAIBlueprints = Array.from({ length: 20 }, (_, index) => ({ ...structuredClone(bp001), id: `bp_${String(index + 1).padStart(3, '0')}_sample`, title: `Sample AI Blueprint ${index + 1}`, tags: ['blueprint', 'molt', 'ai', 'source-ai', `blueprint-sample-${index + 1}`] }));
    const blocks = [...normalizeImportedBlocks(rawBlocks), bp001, bp010, ...manyAIBlueprints];
    const sections = sectionLibraryByDisplayType(blocks);
    const shelves = buildAssetShelves({ blocks, neoblocks: [], neostacks: [], sleeves: [], sourceAuditItems: [
      { id: 'src_bp001', title: bp001.title, detectedType: 'molt_block', normalizedRole: 'blueprint', outcome: 'runnable_molt', tags: bp001.tags, sourcePath: bp001.sourcePath!, legacySource: bp001.legacy?.original },
      { id: 'src_bp010', title: bp010.title, detectedType: 'molt_block', normalizedRole: 'blueprint', outcome: 'runnable_molt', tags: bp010.tags, sourcePath: bp010.sourcePath!, legacySource: bp010.legacy?.original }
    ] });
    const views = buildBlockInspectorViews(bp001);

    expect(sections.find((section) => section.type === 'blueprint')?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['bp_001', 'bp_010']));
    expect(searchShelfAssets(shelves[0].items, { query: 'python' }).map((item) => item.id)).toContain('bp_001');
    expect(searchShelfAssets(shelves[0].items, { tags: ['mobile-detailing'] }).map((item) => item.id)).toContain('bp_010');
    expect(searchShelfAssets(shelves[5].items, { query: 'BP.001' })).toHaveLength(1);
    expect(views.card.type).toBe('SearchCard');
    expect(views.runtime).toMatchObject({ type: 'RuntimeBlock', role: 'blueprint', compiler: { source: 'compiler_aligned_json', moltType: 'blueprint' } });
    expect(views.nl).toContain('role: Blueprint');
    expect(views.compilerJson).toEqual(views.runtime);
    expect(views.legacySource.legacyOriginal).toMatchObject({ id: 'BP.001', type: 'BLUEPRINT' });

    const composed = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'balanced' }, blocks);
    const selectedAIBlueprints = composed.selected_nodes.filter((node) => node.sourceLayer === 'AI' && node.id.startsWith('bp_'));
    expect(selectedAIBlueprints.length).toBeLessThan(manyAIBlueprints.length + 2);
    expect(composed.selected_nodes.length).toBeLessThan(blocks.length);
  });

  it('keeps imported AI JSON blueprint blocks compatible with real compile and graph/IR agreement while Meta stays non-compiler', () => {
    const bp010 = normalizeAIBlueprintEntry(blueprintEntry010);
    const meta = normalizeImportedBlocks([{ id: 'future_use', role: 'Use', title: 'Future Use', content: 'Do not compile.', tags: ['future'] }], 'HUMAN/MOLT-BLOCKS/use/future.md')[0];
    const blocks = [...normalizeImportedBlocks(rawBlocks), bp010, meta];
    const sleeve = composeBlocks({ freeform_request: 'customer intake chatbot mobile detailing lead summary', depth: 'balanced' }, blocks).draft_sleeve;
    sleeve.stacks[0].neoblocks[0].blocks.push(meta);
    const workspace = { id: 'ws_ai_blueprint', title: 'AI Blueprint Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'customer', 'summary'] });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);
    const activeRows = compiled.irMatrix.filter((row) => row.active && !row.off);

    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(compiled.irMatrix.some((row) => row.nodeId.includes('future_use') && row.active)).toBe(false);
    for (const row of activeRows) expect(graph.nodes.find((node) => node.sourceId === row.nodeId)?.state.active).toBe(true);
  });

  it('parses HUMAN/GATES TRG markdown into stable read-only TriggerGate source cards without creating MOLT blocks', () => {
    const card = parseTriggerGateSourceMarkdown('/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md', trg001Markdown);
    const record = buildFullGateSourceRecord(card);

    expect(card).toMatchObject({
      type: 'TriggerGateSourceCard',
      id: 'TRG.001',
      title: 'Technical Analysis Request',
      gateKind: 'trigger_gate',
      sourceType: 'HUMAN_GATE_SOURCE',
      sourceLayer: 'HUMAN',
      sourcePath: '/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md',
      status: 'active',
      category: 'general',
      subcategory: 'analytical_requests',
      summary: 'Technical Analysis Request',
      activation: { mode: 'source_condition', hasExplicitActivation: true, conditionSummary: 'User requests analysis of code, system, or technical architecture' },
      card: { displayType: 'trigger_gate_source', badge: 'Gt', familyLabel: 'TriggerGate Source', runnableAsPromptContent: false, addActionLabel: 'Attach Gate' }
    });
    expect(card.tags).toEqual(['trigger', 'analytical-requests']);
    expect((card as any).role).toBeUndefined();
    expect((card as any).content).toBeUndefined();
    expect(record).toMatchObject({ type: 'FullGateSourceRecord', sourceLayer: 'HUMAN', sourceFamily: 'HUMAN/GATES', parserVersion: 'trigger-gate-source-card.v0.1', normalized: { id: 'TRG.001' } });
    expect(record.legacyOriginal.markdown).toBe(trg001Markdown);
  });

  it('uses manual/candidate activation fallback for TRG files without Activation sections', () => {
    const card = parseTriggerGateSourceMarkdown('/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.020-option-generation.md', trg020Markdown);

    expect(card).toMatchObject({ id: 'TRG.020', title: 'Option Generation', category: 'general', subcategory: 'decision_support', status: 'active' });
    expect(card.activation).toEqual({ mode: 'manual_candidate', conditionSummary: 'Activation not specified; treat as candidate/manual gate until configured.', rawActivation: undefined, hasExplicitActivation: false });
    expect(card.legacy.parseWarnings).toContain('Activation not specified; treat as candidate/manual gate until configured.');
  });

  it('exposes TriggerGate source cards in a separate Control Sources shelf while preserving MOLT counts and read-only inspector views', () => {
    const sourceCards = normalizeTriggerGateSourceCards([
      { sourcePath: '/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md', markdown: trg001Markdown },
      { sourcePath: '/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.020-option-generation.md', markdown: trg020Markdown }
    ]);
    const blocks = normalizedLibraryBlocks as Array<{ role?: string; displayType?: string; sourceLayer?: string; sourcePath?: string; legacy?: { sourcePath?: string; parentSourcePath?: string } }>;
    const shelves = buildAssetShelves({ blocks: blocks as any[], neoblocks: [], neostacks: [], sleeves: [], gateSourceCards: sourceCards });
    const controlShelf = shelves.find((shelf) => shelf.id === 'control_sources');
    const moltShelf = shelves.find((shelf) => shelf.id === 'molt_blocks');
    const trg001Asset = controlShelf?.items.find((item) => item.id === 'TRG.001');
    const views = buildTriggerGateSourceInspectorViews(sourceCards[0]);

    expect(controlShelf).toMatchObject({ id: 'control_sources', label: 'Control Sources' });
    expect(controlShelf?.items).toHaveLength(2);
    expect(trg001Asset).toMatchObject({ kind: 'trigger_gate_source', title: 'Technical Analysis Request', status: 'active', displayType: undefined, containedRoles: ['trigger_gate_source', 'trigger_gate', 'source_control'] });
    expect((trg001Asset?.asset as any).type).toBe('TriggerGateSourceCard');
    expect((trg001Asset?.asset as any).type).not.toBe('molt_block');
    expect(moltShelf?.items.filter((item) => (item.asset as any).role === 'trigger')).toHaveLength(0);
    expect(blocks.filter((block) => block.role === 'trigger' && block.sourceLayer === 'AI')).toHaveLength(0);
    expect(views.card).toMatchObject({ type: 'TriggerGateSourceCardView', id: 'TRG.001', gateKind: 'trigger_gate', runnableAsPromptContent: false });
    expect(views.nl).toContain('TriggerGate Source TRG.001');
    expect(views.json).toMatchObject({ type: 'TriggerGateSourceCard', id: 'TRG.001' });
    expect(views.legacySource.legacyOriginal.markdown).toBe(trg001Markdown);
    expect(views.runtimePreview).toMatchObject({ wouldBecome: 'RuntimeGate', defaultState: 'inactive/candidate', promptContent: false, liveExecution: false });
    expect(views.attachPlacementPreview).toMatchObject({ enabled: true, actionLabel: 'Attach Gate', liveExecution: false, promptContent: false });
    expect(views.traceIrPreview.createsGateIRRowNow).toBe(false);
  });

  it('attaches TRG.001 as an inert RuntimeGate to selected graph node control geometry without creating MOLT blocks', () => {
    const card = parseTriggerGateSourceMarkdown('/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md', trg001Markdown);
    const gate = buildRuntimeGateFromSourceCard(card, { id: 'gate_trg_001_instance_test' });
    const sleeve = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'lean' }, normalizedLibraryBlocks as any[]).draft_sleeve;
    const graph = buildGraphFromSleeve(sleeve);
    const targetNode = graph.nodes.find((node) => node.nodeType === 'neoblock')!;
    const attached = attachRuntimeGateToGraph(graph, gate, { kind: 'node_boundary', nodeId: targetNode.id });
    const governedNode = attached.graph.nodes.find((node) => node.id === targetNode.id)!;

    expect(gate).toMatchObject({
      type: 'RuntimeGate',
      id: 'gate_trg_001_instance_test',
      sourceCardId: 'TRG.001',
      sourcePath: '/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md',
      title: 'Technical Analysis Request',
      gateKind: 'trigger_gate',
      condition: 'User requests analysis of code, system, or technical architecture',
      routeControl: { activates: [], dormants: [], suppresses: [], blocks: [] },
      runtimeState: { state: 'inactive', passed: false, reason: 'Gate attached as control geometry; not evaluated yet.' },
      priorityOrder: { priorityMeaning: 'hierarchy_order_only' },
      traceRefs: []
    });
    expect(governedNode.governingGateIds).toContain('gate_trg_001_instance_test');
    expect(governedNode.gateKind).toBe('trigger_gate');
    expect(governedNode.gateLabel).toBe('Gt: Technical Analysis Request');
    expect(gateVisualMetadataForNode(governedNode)).toMatchObject({ renderGateBadge: true, label: 'Gt: Technical Analysis Request' });
    expect((gate as any).type).not.toBe('molt_block');
    expect((gate as any).role).toBeUndefined();
    expect((normalizedLibraryBlocks as any[]).filter((block) => block.role === 'trigger')).toHaveLength(0);
  });

  it('attaches a TriggerGate RuntimeGate to selected edge strip metadata without compiler prompt-content mutation or live execution', () => {
    const card = parseTriggerGateSourceMarkdown('/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md', trg001Markdown);
    const gate = buildRuntimeGateFromSourceCard(card, { id: 'gate_trg_001_edge_test' });
    const sleeve = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'lean' }, normalizedLibraryBlocks as any[]).draft_sleeve;
    const graph = buildGraphFromSleeve(sleeve);
    const targetEdge = graph.edges[0];
    const attached = attachRuntimeGateToGraph(graph, gate, { kind: 'edge', edgeId: targetEdge.id });
    const governedEdge = attached.graph.edges.find((edge) => edge.id === targetEdge.id)!;
    const workspace: UMGWorkspace = { id: 'ws_attached_gate', title: 'Attached Gate Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: attached.graph, runtimeGates: attached.runtimeGates };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'mobile-detailing'] });

    expect(governedEdge).toMatchObject({ governingGateId: 'gate_trg_001_edge_test', gateKind: 'trigger_gate', gateLabel: 'Gt: Technical Analysis Request' });
    expect(gateVisualMetadataForEdge(governedEdge)).toMatchObject({ renderGateStrip: true, label: 'Gt: Technical Analysis Request' });
    expect(workspace.runtimeGates).toHaveLength(1);
    expect(workspace.runtimeGates?.[0].sourceCardId).toBe('TRG.001');
    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(compiled.irMatrix.filter((row) => row.nodeType === 'molt_block').length).toBeGreaterThan(0);
    expect(compiled.irMatrix.filter((row) => row.nodeType === 'gate')).toHaveLength(1);
    expect(compiled.promptPreview).not.toContain('TRG.001');
    expect(JSON.stringify(compiled.runtimeSpec)).not.toContain('tool_results');
  });

  it('emits attached RuntimeGates as inert runtime gate_context and separate GateIRRows without changing MOLT prompt selection', () => {
    const card = parseTriggerGateSourceMarkdown('/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md', trg001Markdown);
    const gate = buildRuntimeGateFromSourceCard(card, { id: 'gate_trg_001_context_test' });
    const sleeve = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'lean' }, normalizedLibraryBlocks as any[]).draft_sleeve;
    const baseWorkspace: UMGWorkspace = { id: 'ws_gate_context_base', title: 'Gate Context Base', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const targetNode = baseWorkspace.graph.nodes.find((node) => node.nodeType === 'neoblock')!;
    const attached = attachRuntimeGateToGraph(baseWorkspace.graph, gate, { kind: 'node_boundary', nodeId: targetNode.id });
    const workspace: UMGWorkspace = { ...baseWorkspace, graph: attached.graph, runtimeGates: attached.runtimeGates };
    const context = buildRuntimeGateContext(workspace);
    const gateRows = buildGateIRRowsForWorkspace(workspace);
    const compiledWithoutGate = compileWorkspaceToRuntime(baseWorkspace, { tags: ['chatbot', 'intake', 'mobile-detailing'] });
    const compiledWithGate = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'mobile-detailing'] });
    const runtimeSpec = compiledWithGate.runtimeSpec as any;
    const emittedGateRows = compiledWithGate.irMatrix.filter((row: any) => row.nodeType === 'gate') as any[];
    const moltRows = compiledWithGate.irMatrix.filter((row: any) => row.nodeType === 'molt_block');

    expect(context.gates).toHaveLength(1);
    expect(context.gates[0]).toMatchObject({ id: 'gate_trg_001_context_test', sourceCardId: 'TRG.001', title: 'Technical Analysis Request', gateKind: 'trigger_gate', sourcePath: '/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md', placement: { kind: 'node_boundary', targetId: targetNode.id }, runtimeState: { state: 'inactive', passed: false, reason: 'Gate attached as control geometry; not evaluated yet.' } });
    expect(context.gate_decisions).toEqual([]);
    expect(context.route_state).toEqual({ active_paths: [], dormant_paths: [], suppressed_paths: [], blocked_paths: [] });
    expect(gateRows).toHaveLength(1);
    expect(gateRows[0]).toMatchObject({ nodeType: 'gate', gateKind: 'trigger_gate', state: 'inactive', gatePassed: false, selectedRouteIds: [], activeTargetIds: [], dormantTargetIds: [], suppressedTargetIds: [], blockedTargetIds: [], governedNodeIds: [targetNode.id], requiredApproval: false, routingDecision: 'not_evaluated', reason: 'Gate attached as control geometry; not evaluated yet.', traceEventIds: [] });
    expect(runtimeSpec.gate_context).toMatchObject(context);
    expect(emittedGateRows).toHaveLength(1);
    expect(emittedGateRows[0].nodeType).toBe('gate');
    expect(moltRows.length).toBe(compiledWithoutGate.irMatrix.filter((row: any) => row.nodeType === 'molt_block').length);
    expect(compiledWithGate.promptPreview).toBe(compiledWithoutGate.promptPreview);
    expect(JSON.stringify(compiledWithGate.runtimeSpec)).not.toContain('tool_results');
  });

  it('projects Glyph Matrix lines from IR Matrix, GateIRRows, Trace, and inert gate_context without creating runtime truth', () => {
    const card = parseTriggerGateSourceMarkdown('/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md', trg001Markdown);
    const gate = buildRuntimeGateFromSourceCard(card, { id: 'gate_trg_001_glyph_test' });
    const sleeve = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'lean' }, normalizedLibraryBlocks as any[]).draft_sleeve;
    const baseWorkspace: UMGWorkspace = { id: 'ws_glyph_base', title: 'Glyph Base', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const targetNode = baseWorkspace.graph.nodes.find((node) => node.nodeType === 'neoblock')!;
    const attached = attachRuntimeGateToGraph(baseWorkspace.graph, gate, { kind: 'node_boundary', nodeId: targetNode.id });
    const workspace: UMGWorkspace = { ...baseWorkspace, graph: attached.graph, runtimeGates: attached.runtimeGates };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'mobile-detailing'] });
    const sourceSnapshot = structuredClone({ runtimeSpec: compiled.runtimeSpec, irMatrix: compiled.irMatrix, trace: compiled.trace, graph: workspace.graph });

    const glyphMatrix = projectGlyphMatrix({ runtimeSpec: compiled.runtimeSpec, irMatrix: compiled.irMatrix, trace: compiled.trace, graph: workspace.graph, activeSleeveId: workspace.activeSleeveId, viewMode: 'compact' });
    const text = renderGlyphMatrixText(glyphMatrix);
    const gateLine = glyphMatrix.lines.find((line) => line.sourceGateIrRowId);
    const activeMoltLine = glyphMatrix.lines.find((line) => line.sourceIrRowId && line.nodeClass === 'M' && line.state === 'active');
    const traceLine = glyphMatrix.lines.find((line) => line.sourceTraceEventId);

    expect(glyphMatrix.viewMode).toBe('compact');
    expect(glyphMatrix.activeSleeveId).toBe(workspace.activeSleeveId);
    expect(activeMoltLine).toMatchObject({ nodeClass: 'M', stateGlyph: '[#]', relationOut: '==>' });
    expect(gateLine).toMatchObject({ nodeClass: 'Gt', state: 'candidate', stateGlyph: '( )', relationOut: '-->', objectTitle: 'Technical Analysis Request' });
    expect(gateLine?.text).toContain('Gt.001 Technical Analysis Request -->');
    expect(gateLine?.text).toContain('state: inactive / not_evaluated');
    expect(gateLine?.text).toContain('sourceCardId: TRG.001');
    expect(gateLine?.text).toContain('gatePassed: false');
    expect(gateLine?.text).not.toContain('[#]');
    expect(text).toContain('UMG_GLYPH_MATRIX.v0.1');
    expect(text).toContain('ViewMode: compact');
    expect(text).toContain('SourceTruth: RuntimeSpec + IR Matrix + GateIRRows + Trace');
    expect(text).toContain('route switching: not implemented');
    expect(text).toContain('gate evaluation: not implemented');
    expect(text).toContain('Legend: [ ] dormant/off/inactive | ( ) candidate/attached but unevaluated | [#] active | [!] focus/requires approval | [~] compressed | [x] suppressed/blocked');
    expect(text).toContain('Gates: Gt TriggerGate | Gr RoutingGate | Gv GovernanceGate | Ga ActionGate');
    expect(text).toContain('( ) Gt.001 Technical Analysis Request -->');
    expect(text).toContain('    state: inactive / not_evaluated');
    expect(text).toContain('    sourceCardId: TRG.001');
    expect(text).toContain('    gatePassed: false');
    expect(text).toContain('RouteState:');
    expect(text).toContain('    active_paths: []');
    expect(text).toContain('    dormant_paths: []');
    expect(text).toContain('    suppressed_paths: []');
    expect(text).toContain('    blocked_paths: []');
    expect(text).not.toContain('service_intent_detected');
    expect(text).not.toContain('tool_results');
    expect(traceLine?.text).toMatch(/^\(\d+\)/);
    expect(JSON.stringify({ runtimeSpec: compiled.runtimeSpec, irMatrix: compiled.irMatrix, trace: compiled.trace, graph: workspace.graph })).toBe(JSON.stringify(sourceSnapshot));
  });

  it('maps Glyph Matrix gate kinds, relation symbols, blocked paths, and MOLT counts without tool execution', () => {
    const rows = [
      { rowId: 'ir_molt_active', nodeId: 'block_service_prompt', nodeType: 'molt_block' as const, role: 'instruction' as const, title: 'Service Prompt', selected: true, active: true, off: false, triggered: false, required: true, tagsMatched: [], priority: 1, contribution: 'Ask for repair details' },
      { rowId: 'ir_molt_off', nodeId: 'block_sales_prompt', nodeType: 'molt_block' as const, role: 'subject' as const, title: 'Sales Prompt', selected: false, active: false, off: true, triggered: false, required: true, tagsMatched: [] },
      { rowId: 'gate_ir_trigger', nodeId: 'gate_trigger', nodeType: 'gate' as const, gateKind: 'trigger_gate' as const, title: 'Trigger Intent', selected: false as const, active: false as const, off: false as const, triggered: false as const, required: false as const, tagsMatched: [], state: 'passed' as const, gatePassed: true, selectedRouteIds: ['route_service'], activeTargetIds: ['stack_service'], dormantTargetIds: [], suppressedTargetIds: [], blockedTargetIds: [], governedNodeIds: ['stack_service'], requiredApproval: false, routingDecision: 'service_path', reason: 'source runtime says active', traceEventIds: ['trace_gate_trigger'] },
      { rowId: 'gate_ir_routing', nodeId: 'gate_routing', nodeType: 'gate' as const, gateKind: 'routing_gate' as const, title: 'Routing Gate', selected: false as const, active: false as const, off: false as const, triggered: false as const, required: false as const, tagsMatched: [], state: 'inactive' as const, gatePassed: false, selectedRouteIds: [], activeTargetIds: [], dormantTargetIds: ['stack_sales'], suppressedTargetIds: [], blockedTargetIds: [], governedNodeIds: ['stack_sales'], requiredApproval: false, routingDecision: 'not_evaluated', reason: 'not evaluated', traceEventIds: [] },
      { rowId: 'gate_ir_governance', nodeId: 'gate_governance', nodeType: 'gate' as const, gateKind: 'governance_gate' as const, title: 'Safety Guard', selected: false as const, active: false as const, off: false as const, triggered: false as const, required: false as const, tagsMatched: [], state: 'blocked' as const, gatePassed: false, selectedRouteIds: [], activeTargetIds: [], dormantTargetIds: [], suppressedTargetIds: [], blockedTargetIds: ['unsafe_path'], governedNodeIds: ['unsafe_path'], requiredApproval: false, routingDecision: 'blocked_by_policy', reason: 'blocked by source runtime', traceEventIds: ['trace_governance'] },
      { rowId: 'gate_ir_action', nodeId: 'gate_action', nodeType: 'gate' as const, gateKind: 'action_gate' as const, title: 'Tool Approval', selected: false as const, active: false as const, off: false as const, triggered: false as const, required: false as const, tagsMatched: [], state: 'requires_approval' as const, gatePassed: false, selectedRouteIds: [], activeTargetIds: [], dormantTargetIds: [], suppressedTargetIds: [], blockedTargetIds: ['proposal_schedule_tool'], governedNodeIds: ['proposal_schedule_tool'], requiredApproval: true, reason: 'approval required; no execution', traceEventIds: [] }
    ];
    const trace = [{ id: 'trace_gate_trigger', kind: 'gate_passed' }, { id: 'trace_governance', kind: 'gate_blocked' }];
    const glyphMatrix = projectGlyphMatrix({ runtimeSpec: { source: 'test', gate_context: { gates: [], gate_decisions: [], route_state: { active_paths: ['stack_service'], dormant_paths: ['stack_sales'], suppressed_paths: [], blocked_paths: ['unsafe_path'] } } }, irMatrix: rows as any, trace, viewMode: 'debug' });
    const text = renderGlyphMatrixText(glyphMatrix);

    expect(glyphMatrix.lines.find((line) => line.objectId === 'gate_trigger')).toMatchObject({ nodeClass: 'Gt', stateGlyph: '[#]', relationOut: '==>' });
    expect(glyphMatrix.lines.find((line) => line.objectId === 'gate_routing')).toMatchObject({ nodeClass: 'Gr', stateGlyph: '( )', relationOut: '-->' });
    expect(glyphMatrix.lines.find((line) => line.objectId === 'gate_governance')).toMatchObject({ nodeClass: 'Gv', stateGlyph: '[x]', relationOut: '-x->' });
    expect(glyphMatrix.lines.find((line) => line.objectId === 'gate_action')).toMatchObject({ nodeClass: 'Ga', stateGlyph: '[!]', relationOut: '-x->' });
    expect(text).toContain('M Service Prompt ==>');
    expect(text).toContain('[ ] M Sales Prompt');
    expect(text).toContain('(1)');
    expect(text).toContain('(2)');
    expect(text).not.toContain('tool_results');
    expect(rows.filter((row) => row.nodeType === 'molt_block')).toHaveLength(2);
    expect((normalizedLibraryBlocks as any[]).filter((block) => block.role === 'trigger' && block.sourceLayer === 'AI')).toHaveLength(0);
  });

  it('exports safe Glyph Matrix projection in Hermes packets without API keys, tool results, or invented route truth', () => {
    const card = parseTriggerGateSourceMarkdown('/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md', trg001Markdown);
    const gate = buildRuntimeGateFromSourceCard(card, { id: 'gate_trg_001_packet_glyph_test' });
    const sleeve = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'lean' }, normalizedLibraryBlocks as any[]).draft_sleeve;
    const graph = buildGraphFromSleeve(sleeve);
    const attached = attachRuntimeGateToGraph(graph, gate, { kind: 'node_boundary', nodeId: graph.nodes.find((node) => node.nodeType === 'neoblock')!.id });
    const workspace: UMGWorkspace = { id: 'ws_glyph_packet', title: 'Glyph Packet Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: attached.graph, runtimeGates: attached.runtimeGates };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'mobile-detailing'] });
    const packet = exportHermesPacket('Build a mobile detailing customer intake chatbot', compiled, { endpoint: 'http://localhost:9999', apiKey: 'secret-key', model: 'hermes-default', temperature: 0.3, maxTokens: 1200 }) as any;

    expect(packet.glyph_matrix.lines.some((line: any) => line.nodeClass === 'Gt' && line.text.includes('not_evaluated'))).toBe(true);
    expect(packet.glyph_matrix.lines.some((line: any) => line.nodeClass === 'Gt' && line.stateGlyph === '[#]')).toBe(false);
    expect(packet.glyph_matrix.lines.some((line: any) => line.text.includes('service_intent_detected'))).toBe(false);
    expect(packet.settings.apiKey).toBeUndefined();
    expect(JSON.stringify(packet)).not.toContain('secret-key');
    expect(JSON.stringify(packet)).not.toContain('tool_results');
  });

  it('exports inert gate_context in Hermes packets without API keys, tool results, or route decisions', () => {
    const card = parseTriggerGateSourceMarkdown('/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.001-technical-analysis-request.md', trg001Markdown);
    const gate = buildRuntimeGateFromSourceCard(card, { id: 'gate_trg_001_packet_test' });
    const sleeve = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'lean' }, normalizedLibraryBlocks as any[]).draft_sleeve;
    const graph = buildGraphFromSleeve(sleeve);
    const targetEdge = graph.edges[0];
    const attached = attachRuntimeGateToGraph(graph, gate, { kind: 'edge', edgeId: targetEdge.id });
    const workspace: UMGWorkspace = { id: 'ws_gate_packet', title: 'Gate Packet Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: attached.graph, runtimeGates: attached.runtimeGates };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'mobile-detailing'] });
    const packet = exportHermesPacket('Build a mobile detailing customer intake chatbot', compiled, { endpoint: 'http://localhost:9999', apiKey: 'secret-key', model: 'hermes-default', temperature: 0.3, maxTokens: 1200 }) as any;

    expect(packet.gate_context.gates[0]).toMatchObject({ id: 'gate_trg_001_packet_test', sourceCardId: 'TRG.001', gateKind: 'trigger_gate', placement: { kind: 'edge', targetId: targetEdge.id }, runtimeState: { state: 'inactive', passed: false } });
    expect(packet.gate_context.gate_decisions).toEqual([]);
    expect(packet.gate_context.route_state).toEqual({ active_paths: [], dormant_paths: [], suppressed_paths: [], blocked_paths: [] });
    expect(packet.settings.apiKey).toBeUndefined();
    expect(JSON.stringify(packet)).not.toContain('secret-key');
    expect(JSON.stringify(packet)).not.toContain('tool_results');
  });

  it('keeps TriggerGate source-card visibility inert for compose, real compile, IR Matrix, and live tool execution', () => {
    const sourceCards = Array.from({ length: 200 }, (_, index) => parseTriggerGateSourceMarkdown(`/home/neomagnetar/umg-block-library/HUMAN/GATES/TRG.${String(index + 1).padStart(3, '0')}-sample.md`, trg001Markdown.replace('TRG.001', `TRG.${String(index + 1).padStart(3, '0')}`)));
    const blocks = normalizedLibraryBlocks as Array<{ role?: string; sourceLayer?: string; legacy?: { parentSourcePath?: string } }>;
    const shelves = buildAssetShelves({ blocks: blocks as any[], neoblocks: [], neostacks: [], sleeves: [], gateSourceCards: sourceCards });
    const sleeve = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'balanced' }, blocks as any[]).draft_sleeve;
    const workspace = { id: 'ws_gate_sources', title: 'Gate Source Read-only Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'mobile-detailing'] });

    expect(shelves.find((shelf) => shelf.id === 'control_sources')?.items).toHaveLength(200);
    expect(blocks.filter((block) => block.role === 'trigger' && block.sourceLayer === 'AI')).toHaveLength(0);
    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(compiled.irMatrix.every((row) => row.nodeType === 'molt_block')).toBe(true);
    expect(JSON.stringify(compiled.runtimeSpec)).not.toContain('RuntimeGate');
    expect(JSON.stringify(compiled.runtimeSpec)).not.toContain('tool_results');
  });

  it('formalizes TriggerGate as a gate subtype that selectively controls runtime path states without creating MOLT trigger blocks', () => {
    expect(GATE_KINDS).toEqual(['trigger_gate', 'routing_gate', 'governance_gate', 'action_gate']);

    const gate = buildRuntimeGate({
      id: 'gate_service_repair_route',
      title: 'Service repair route gate',
      gateKind: 'trigger_gate',
      condition: 'Customer asks for repair or service appointment',
      routeControl: {
        activates: [{ targetId: 'stack_service', targetType: 'neostack', defaultPathState: 'active' }],
        dormants: [{ targetId: 'stack_sales', targetType: 'neostack', defaultPathState: 'dormant' }],
        suppresses: [{ targetId: 'block_marketing_upsell', targetType: 'molt_block', defaultPathState: 'suppressed' }],
        blocks: []
      },
      runtimeState: { state: 'passed', passed: true, reason: 'repair intent matched service route' },
      priorityOrder: { orderIndex: 0, priorityMeaning: 'hierarchy_order_only' },
      traceRefs: ['trace_repair_intent'],
      sourcePath: 'local/gates/service-repair-route.json'
    });

    expect(gate).toMatchObject({ type: 'RuntimeGate', gateKind: 'trigger_gate', runtimeState: { state: 'passed', passed: true } });
    expect(gate.routeControl.activates.map((target) => target.targetId)).toEqual(['stack_service']);
    expect(gate.routeControl.dormants.map((target) => target.targetId)).toEqual(['stack_sales']);
    expect(gate.routeControl.suppresses.map((target) => target.targetId)).toEqual(['block_marketing_upsell']);
    expect(gate.routeControl.activates[0].targetType).toBe('neostack');
  });

  it('allows RuntimeGate targets to govern MOLT blocks, NeoBlocks, NeoStacks, sleeve routes, and tool proposals while ActionGate remains inert', () => {
    const gate = buildRuntimeGate({
      id: 'gate_multi_scope',
      title: 'Multi-scope gate',
      gateKind: 'action_gate',
      condition: 'Tool proposal requires approval before execution',
      routeControl: {
        activates: [
          { targetId: 'block_service_prompt', targetType: 'molt_block', defaultPathState: 'active' },
          { targetId: 'nb_service_intake', targetType: 'neoblock', defaultPathState: 'active' },
          { targetId: 'stack_service', targetType: 'neostack', defaultPathState: 'active' },
          { targetId: 'route_service', targetType: 'sleeve_route', defaultPathState: 'active' },
          { targetId: 'proposal_schedule_tool', targetType: 'tool_proposal', defaultPathState: 'blocked' }
        ],
        dormants: [],
        suppresses: [],
        blocks: [{ targetId: 'proposal_schedule_tool', targetType: 'tool_proposal', defaultPathState: 'blocked' }]
      },
      runtimeState: { state: 'requires_approval', passed: false, reason: 'live tool execution is not implemented' }
    });

    expect(gate.routeControl.activates.map((target) => target.targetType)).toEqual(['molt_block', 'neoblock', 'neostack', 'sleeve_route', 'tool_proposal']);
    expect(gate.routeControl.blocks[0]).toMatchObject({ targetType: 'tool_proposal', defaultPathState: 'blocked' });
    expect(gate.runtimeState).toMatchObject({ state: 'requires_approval', passed: false });
  });

  it('adds Gate IR rows without converting existing MOLT IR rows into Gate rows', () => {
    const gate = buildRuntimeGate({
      id: 'gate_service_route',
      title: 'Service route gate',
      gateKind: 'routing_gate',
      condition: 'Repair request selects service path',
      routeControl: {
        activates: [{ targetId: 'stack_service', targetType: 'neostack', defaultPathState: 'active' }],
        dormants: [{ targetId: 'stack_sales', targetType: 'neostack', defaultPathState: 'dormant' }],
        suppresses: [{ targetId: 'block_marketing_upsell', targetType: 'molt_block', defaultPathState: 'suppressed' }],
        blocks: [{ targetId: 'proposal_schedule_tool', targetType: 'tool_proposal', defaultPathState: 'blocked' }]
      },
      runtimeState: { state: 'passed', passed: true, reason: 'service route selected' },
      traceRefs: ['trace_gate_service']
    });
    const gateRow = buildGateIRRow(gate, { selectedRouteIds: ['route_service'], routingDecision: 'service_path' });
    const moltRow = { rowId: 'ir_molt_1', nodeId: 'block_service_prompt', nodeType: 'molt_block', role: 'instruction', title: 'Service Prompt', selected: true, active: true, off: false, triggered: false, required: true, tagsMatched: [], pathState: 'active', governingGateIds: ['gate_service_route'] };

    expect(gateRow).toMatchObject({ nodeType: 'gate', gateKind: 'routing_gate', state: 'passed', gatePassed: true, routingDecision: 'service_path' });
    expect(gateRow.activeTargetIds).toEqual(['stack_service']);
    expect(gateRow.dormantTargetIds).toEqual(['stack_sales']);
    expect(gateRow.suppressedTargetIds).toEqual(['block_marketing_upsell']);
    expect(gateRow.blockedTargetIds).toEqual(['proposal_schedule_tool']);
    expect(moltRow.nodeType).toBe('molt_block');
    expect(moltRow).toMatchObject({ pathState: 'active', governingGateIds: ['gate_service_route'] });
  });

  it('projects GateIRRow path states onto graph nodes and edges without mutating the GateIRRow source of truth', () => {
    const graph = {
      nodes: [
        { id: 'node_stack_service', sourceId: 'stack_service', nodeType: 'neostack' as const, label: 'Service NeoStack', position: { x: 320, y: 80 }, state: { selected: false, active: true, off: false, triggered: false, invalid: false } },
        { id: 'node_stack_sales', sourceId: 'stack_sales', nodeType: 'neostack' as const, label: 'Sales NeoStack', position: { x: 320, y: 260 }, state: { selected: false, active: true, off: false, triggered: false, invalid: false } },
        { id: 'node_block_marketing_upsell', sourceId: 'block_marketing_upsell', nodeType: 'molt_block' as const, label: 'Marketing Upsell', position: { x: 940, y: 260 }, state: { selected: false, active: true, off: false, triggered: false, invalid: false } },
        { id: 'node_route_blocked', sourceId: 'route_blocked', nodeType: 'neostack' as const, label: 'Blocked Path', position: { x: 320, y: 420 }, state: { selected: false, active: true, off: false, triggered: false, invalid: false } },
        { id: 'node_proposal_schedule_tool', sourceId: 'proposal_schedule_tool', nodeType: 'gate' as const, label: 'Schedule Tool Proposal', position: { x: 620, y: 420 }, state: { selected: false, active: false, off: false, triggered: false, invalid: false } }
      ],
      edges: [
        { id: 'edge_service', source: 'node_sleeve', target: 'node_stack_service', type: 'activates' as const },
        { id: 'edge_sales', source: 'node_sleeve', target: 'node_stack_sales', type: 'activates' as const },
        { id: 'edge_upsell', source: 'node_stack_sales', target: 'node_block_marketing_upsell', type: 'contains' as const },
        { id: 'edge_blocked', source: 'node_sleeve', target: 'node_route_blocked', type: 'conflicts_with' as const },
        { id: 'edge_tool', source: 'node_route_blocked', target: 'node_proposal_schedule_tool', type: 'activates' as const }
      ]
    };
    const gateRows = [
      { rowId: 'gate_ir_service', nodeId: 'gate_service', nodeType: 'gate' as const, gateKind: 'trigger_gate' as const, title: 'Service intent', selected: false as const, active: false as const, off: false as const, triggered: false as const, required: false as const, tagsMatched: [], state: 'passed' as const, gatePassed: true, selectedRouteIds: ['route_service'], activeTargetIds: ['stack_service'], dormantTargetIds: ['stack_sales'], suppressedTargetIds: ['block_marketing_upsell'], blockedTargetIds: ['route_blocked'], governedNodeIds: ['stack_service', 'stack_sales', 'block_marketing_upsell', 'route_blocked'], requiredApproval: false, routingDecision: 'service_path', reason: 'repair intent matched', traceEventIds: ['trace_service'] },
      { rowId: 'gate_ir_action', nodeId: 'gate_action', nodeType: 'gate' as const, gateKind: 'action_gate' as const, title: 'Tool approval', selected: false as const, active: false as const, off: false as const, triggered: false as const, required: false as const, tagsMatched: [], state: 'requires_approval' as const, gatePassed: false, selectedRouteIds: [], activeTargetIds: [], dormantTargetIds: [], suppressedTargetIds: [], blockedTargetIds: ['proposal_schedule_tool'], governedNodeIds: ['proposal_schedule_tool'], requiredApproval: true, reason: 'tool proposal requires approval; no execution', traceEventIds: [] }
    ];
    const sourceRows = structuredClone(gateRows);

    const projected = projectGateRowsToGraph(graph, gateRows);

    expect(projected).not.toBe(graph);
    expect(gateRows).toEqual(sourceRows);
    expect(projected.nodes.find((node) => node.sourceId === 'stack_service')).toMatchObject({ pathState: 'active', governingGateIds: ['gate_service'], gateKind: 'trigger_gate', gateLabel: 'Gt: Service intent' });
    expect(projected.nodes.find((node) => node.sourceId === 'stack_sales')?.pathState).toBe('dormant');
    expect(projected.nodes.find((node) => node.sourceId === 'block_marketing_upsell')?.pathState).toBe('suppressed');
    const blocked = projected.nodes.find((node) => node.sourceId === 'route_blocked');
    expect(blocked).toMatchObject({ pathState: 'blocked', state: { invalid: false } });
    expect(projected.nodes.find((node) => node.sourceId === 'proposal_schedule_tool')).toMatchObject({ pathState: 'requires_approval', gateKind: 'action_gate', debugExpandable: true });
    expect(projected.edges.find((edge) => edge.id === 'edge_service')).toMatchObject({ pathState: 'active', governingGateId: 'gate_service', gateKind: 'trigger_gate' });
    expect(projected.edges.find((edge) => edge.id === 'edge_sales')?.pathState).toBe('dormant');
    expect(projected.edges.find((edge) => edge.id === 'edge_upsell')?.pathState).toBe('suppressed');
    expect(projected.edges.find((edge) => edge.id === 'edge_blocked')).toMatchObject({ pathState: 'blocked', governanceOverride: false });
    expect(projected.edges.find((edge) => edge.id === 'edge_tool')).toMatchObject({ pathState: 'requires_approval', governanceOverride: true });
  });

  it('exposes compact gate strip and badge visual metadata only when graph projection metadata exists', () => {
    const triggerEdge = { id: 'edge_trigger', source: 'node_sleeve', target: 'node_stack_service', type: 'activates' as const, gateKind: 'trigger_gate' as const, governingGateId: 'gate_service', gateLabel: 'Gt: service_intent', pathState: 'active' as const };
    const routingEdge = { id: 'edge_routing', source: 'node_sleeve', target: 'node_stack_sales', type: 'activates' as const, gateKind: 'routing_gate' as const, governingGateId: 'gate_route', gateLabel: 'Gr: route_sales_vs_service', pathState: 'dormant' as const };
    const governedNode = { id: 'node_stack_service', sourceId: 'stack_service', nodeType: 'neostack' as const, label: 'Service NeoStack', position: { x: 320, y: 80 }, state: { selected: false, active: true, off: false, triggered: false, invalid: false }, gateKind: 'trigger_gate' as const, gateLabel: 'Gt: service_intent', pathState: 'active' as const };
    const plainEdge = { id: 'edge_plain', source: 'node_sleeve', target: 'node_stack_plain', type: 'contains' as const };
    const plainNode = { id: 'node_plain', sourceId: 'plain', nodeType: 'molt_block' as const, label: 'Plain Block', position: { x: 1, y: 1 }, state: { selected: false, active: true, off: false, triggered: false, invalid: false } };

    expect(gateVisualMetadataForEdge(triggerEdge)).toMatchObject({ renderGateStrip: true, className: 'gate-strip gate-strip-trigger', label: 'Gt: service_intent' });
    expect(gateVisualMetadataForEdge(routingEdge)).toMatchObject({ renderGateStrip: true, className: 'gate-strip gate-strip-routing', label: 'Gr: route_sales_vs_service' });
    expect(gateVisualMetadataForNode(governedNode)).toMatchObject({ renderGateBadge: true, className: 'gate-badge gate-badge-trigger', label: 'Gt: service_intent' });
    expect(gateVisualMetadataForEdge(plainEdge)).toMatchObject({ renderGateStrip: false });
    expect(gateVisualMetadataForNode(plainNode)).toMatchObject({ renderGateBadge: false });
  });

  it('keeps visual gate strip and badge scaffolding inert for Trigger imports and ActionGate execution', () => {
    const actionEdge = { id: 'edge_tool', source: 'node_route_blocked', target: 'node_proposal_schedule_tool', type: 'activates' as const, gateKind: 'action_gate' as const, governingGateId: 'gate_action', gateLabel: 'Ga: tool_approval', pathState: 'requires_approval' as const, governanceOverride: true };
    const actionNode = { id: 'node_proposal_schedule_tool', sourceId: 'proposal_schedule_tool', nodeType: 'gate' as const, label: 'Schedule Tool Proposal', position: { x: 620, y: 420 }, state: { selected: false, active: false, off: false, triggered: false, invalid: false }, gateKind: 'action_gate' as const, gateLabel: 'Ga: tool_approval', pathState: 'requires_approval' as const };
    const blocks = normalizedLibraryBlocks as Array<{ role?: string; sourceLayer?: string; sourcePath?: string; legacy?: { sourcePath?: string; parentSourcePath?: string } }>;
    const pathOf = (block: { sourcePath?: string; legacy?: { sourcePath?: string; parentSourcePath?: string } }) => `${block.sourcePath ?? ''} ${block.legacy?.sourcePath ?? ''} ${block.legacy?.parentSourcePath ?? ''}`;

    expect(gateVisualMetadataForEdge(actionEdge)).toMatchObject({ renderGateStrip: true, label: 'Ga: tool_approval', className: 'gate-strip gate-strip-action' });
    expect(gateVisualMetadataForNode(actionNode)).toMatchObject({ renderGateBadge: true, className: 'gate-badge gate-badge-action' });
    expect(blocks.filter((block) => block.role === 'trigger' && block.sourceLayer === 'AI')).toHaveLength(0);
    expect(blocks.some((block) => pathOf(block).includes('HUMAN/GATES'))).toBe(false);
  });

  it('keeps gate visual projection inert for existing MOLT counts, HUMAN/GATES exclusions, Trigger imports, compose, real compile, and IR Matrix behavior', () => {
    const blocks = normalizedLibraryBlocks as Array<{ role?: string; sourceLayer?: string; sourcePath?: string; legacy?: { sourcePath?: string; parentSourcePath?: string } }>;
    const pathOf = (block: { sourcePath?: string; legacy?: { sourcePath?: string; parentSourcePath?: string } }) => `${block.sourcePath ?? ''} ${block.legacy?.sourcePath ?? ''} ${block.legacy?.parentSourcePath ?? ''}`;
    const aiCount = (role: string, parentPath: string) => blocks.filter((block) => block.role === role && block.sourceLayer === 'AI' && block.legacy?.parentSourcePath === parentPath).length;
    const activeBlocks = blocks.filter((block) => block.sourceLayer === 'AI' || !block.sourceLayer) as any[];
    const sleeve = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'balanced' }, activeBlocks).draft_sleeve;
    const workspace = { id: 'ws_gate_projection', title: 'Gate Projection Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'mobile-detailing'] });
    const projected = projectGateRowsToGraph(applyCompileResultToGraph(workspace.graph, compiled), []);
    const activeRows = compiled.irMatrix.filter((row) => row.active && !row.off);

    expect(aiCount('instruction', 'AI/MOLT-BLOCKS/instructions/library.v1.0.0.json')).toBe(300);
    expect(aiCount('subject', 'AI/MOLT-BLOCKS/subjects/library.v1.0.0.json')).toBe(200);
    expect(aiCount('primary', 'AI/MOLT-BLOCKS/primary/library.v1.0.0.json')).toBe(200);
    expect(aiCount('directive', 'AI/MOLT-BLOCKS/directives/library.v1.0.0.json')).toBe(200);
    expect(aiCount('philosophy', 'AI/MOLT-BLOCKS/philosophy/library.v1.0.0.json')).toBe(270);
    expect(aiCount('blueprint', 'AI/MOLT-BLOCKS/blueprints/library.v1.0.0.json')).toBe(200);
    expect(blocks.filter((block) => block.role === 'trigger' && block.sourceLayer === 'AI')).toHaveLength(0);
    expect(blocks.some((block) => pathOf(block).includes('HUMAN/GATES'))).toBe(false);
    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(compiled.irMatrix.every((row) => row.nodeType === 'molt_block')).toBe(true);
    for (const row of activeRows) expect(projected.nodes.find((node) => node.sourceId === row.nodeId)?.state.active).toBe(true);
    expect(projected.nodes.every((node) => node.pathState === undefined)).toBe(true);
  });

  it('documents IR Matrix as source of truth and Glyph Matrix as projection for gate state', () => {
    expect(gateProjectionPrinciples).toMatchObject({
      irMatrixSourceOfTruth: true,
      glyphMatrixProjectionOnly: true,
      gateNodesProjectAs: 'G',
      noLiveToolExecution: true
    });
  });

  it('keeps HUMAN/GATES out of MOLT imports and preserves existing generated MOLT family counts', () => {
    const blocks = normalizedLibraryBlocks as Array<{ role?: string; sourceLayer?: string; sourcePath?: string; legacy?: { sourcePath?: string; parentSourcePath?: string } }>;
    const byAIParent = (role: string, parentPath: string) => blocks.filter((block) => block.role === role && block.sourceLayer === 'AI' && block.legacy?.parentSourcePath === parentPath).length;
    const pathOf = (block: { sourcePath?: string; legacy?: { sourcePath?: string; parentSourcePath?: string } }) => `${block.sourcePath ?? ''} ${block.legacy?.sourcePath ?? ''} ${block.legacy?.parentSourcePath ?? ''}`;

    expect(byAIParent('instruction', 'AI/MOLT-BLOCKS/instructions/library.v1.0.0.json')).toBe(300);
    expect(byAIParent('subject', 'AI/MOLT-BLOCKS/subjects/library.v1.0.0.json')).toBe(200);
    expect(byAIParent('primary', 'AI/MOLT-BLOCKS/primary/library.v1.0.0.json')).toBe(200);
    expect(byAIParent('directive', 'AI/MOLT-BLOCKS/directives/library.v1.0.0.json')).toBe(200);
    expect(byAIParent('philosophy', 'AI/MOLT-BLOCKS/philosophy/library.v1.0.0.json')).toBe(270);
    expect(byAIParent('blueprint', 'AI/MOLT-BLOCKS/blueprints/library.v1.0.0.json')).toBe(200);
    expect(blocks.filter((block) => block.role === 'trigger' && block.sourceLayer === 'AI').length).toBe(0);
    expect(blocks.some((block) => pathOf(block).includes('HUMAN/GATES'))).toBe(false);
    expect(blocks.some((block) => pathOf(block).includes('AI/MOLT-BLOCKS/triggers'))).toBe(false);
  });

  it('preserves the existing mobile-detailing compose and real compiler flow with Gate scaffold inactive', () => {
    const blocks = normalizeImportedBlocks(rawBlocks);
    const sleeve = composeBlocks({ freeform_request: 'Build a mobile detailing customer intake chatbot', target_type: 'chatbot', depth: 'balanced' }, blocks).draft_sleeve;
    const workspace = { id: 'ws_gate_scaffold', title: 'Gate Scaffold Workspace', activeSleeveId: sleeve.id, sleeves: [sleeve], libraryRefs: [], graph: buildGraphFromSleeve(sleeve) };
    const compiled = compileWorkspaceToRuntime(workspace, { tags: ['chatbot', 'intake', 'mobile-detailing'] });
    const graph = applyCompileResultToGraph(workspace.graph, compiled);
    const activeRows = compiled.irMatrix.filter((row) => row.active && !row.off);

    expect(compiled.runtimeSpec).toMatchObject({ compiler: 'umg-compiler', source: 'real' });
    expect(compiled.irMatrix.every((row) => row.nodeType === 'molt_block')).toBe(true);
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
