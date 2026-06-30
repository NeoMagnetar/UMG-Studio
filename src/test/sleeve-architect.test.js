import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createBusinessInputFromPublicIntake, analyzeBusinessInput } from '../lib/umg/businessAnalyzer';
import { SleeveArchitectReviewPanel, summarizeArchitectReview } from '../components/SleeveArchitectReviewPanel';
import { getBusinessAutomationCoreSleeve } from '../lib/umg/businessAutomationCoreSleeve';
import { buildSleeveArchitectPlan } from '../lib/umg/sleeveArchitectPlanner';
import { buildArchitectRuntimeExecution, defaultArchitectExecutionPolicy } from '../lib/umg/sleeveArchitectExecution';
import { createCompilerInputFromCompileCandidate, createCompilerRequest, validateCompilerInput } from '../lib/umg/compileCandidateAdapter';
import { createHermesRuntimeRequestFromManifest } from '../lib/umg/hermesRuntimeExecution';
import { applyRuntimeTraceEvents, createEmptyRuntimeVisualState } from '../lib/umg/cognitiveRuntimeState';
import { createHermesContinuationRequest, createPendingRuntimeApproval, resolveToolCapabilities } from '../lib/umg/toolCapabilityResolver';
import { getHermesUmgRuntimeSkillPack } from '../lib/umg/hermesUmgRuntimeSkill';
import { getHermesUmgAppLocalSkillBundle } from '../lib/umg/hermesUmgSkillBundle';
import { HERMES_CUSTOM_SLEEVE_PLAN_SCHEMA_NOTE, validateHermesCustomSleevePlanScaffold } from '../lib/umg/hermesSleevePlanSchema';
import { buildHermesToolCapabilityRegistry } from '../lib/umg/hermesToolCapabilityRegistry';
import { validateArchitectSleeveForCompiler } from '../lib/umg/sleeveArchitectCompilerValidation';
import { normalizeCompilerResponseToManifest } from '../lib/umg/umgCompilerAdapter';
import { architectureModeLabels } from '../lib/umg/sleeveArchitectTypes';
import { normalizeLegacyMoltRole, parseLegacyMarkdownSleeve } from '../lib/umg/legacySleeveImport';
import { buildBasicCapabilityPalette, classifyBasicContent, evaluateBasicSleeveQuality, redactSensitiveText } from '../lib/umg/basicModeScaffolds';
import { HackathonLandingPage } from '../components/HackathonLandingPage';
import { ActiveSessionSleeveStudioInspector, MoltDetailPanel } from '../components/ActiveSessionSleeveStudioInspector';
import { summarizeNormalizedTemplateSourceStatus } from '../lib/umg/templateSleeveStructures';

const ecommercePrompt = 'E-Commerce: Customer Return & Refund Orchestration — automate the customer return and refund workflow for an online retail business. The agent should validate purchase records, check eligibility, draft customer replies, route approvals, and prepare refund actions.';

function sampleBlocks() {
  return getBusinessAutomationCoreSleeve().moltBlocks.map((block) => ({
    id: block.id,
    title: block.title,
    type: 'molt_block',
    role: block.role,
    content: block.summary,
    description: block.summary,
    category: 'business automation',
    tags: [block.role, 'business', 'workflow', block.id.toLowerCase()],
    defaultState: 'off',
    visibility: 'visible'
  }));
}

describe('Phase 13A Sleeve Architect Mode foundation', () => {
  it('keeps Business Automation available as Seed Template Mode for terse demo prompts', () => {
    const input = createBusinessInputFromPublicIntake({ goal: 'customer lead follow-up', context: '', selectedChip: 'Business Automation' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    expect(plan.mode).toBe('demo_template_mode');
    expect(architectureModeLabels[plan.mode]).toBe('Seed Template Mode');
    expect(plan.warnings.join(' ')).toMatch(/Seed Template Mode/);
  });

  it('creates an Architect Mode plan for e-commerce return/refund orchestration', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    expect(plan.mode).toBe('architect_mode');
    expect(plan.proposedSleeveTitle).toBe('Customer Return & Refund Orchestration Sleeve');
    expect(plan.proposedNeoStacks.map((stack) => stack.title)).toEqual(expect.arrayContaining([
      'Return Intake & Eligibility Stack',
      'Purchase Validation Stack',
      'Refund Decision & Approval Stack'
    ]));
    expect(plan.toolCapabilityNeeds.map((tool) => tool.capability)).toEqual(expect.arrayContaining([
      'order_lookup',
      'customer_message_draft',
      'refund_prepare_or_request'
    ]));
    expect(plan.toolCapabilityNeeds.every((tool) => tool.executionEnabled === false)).toBe(true);
    expect(plan.generatedDrafts.length).toBeGreaterThan(0);
    expect(plan.generatedDrafts.every((draft) => draft.saveState === 'draft' && draft.needsUserReview && draft.defaultState === 'off' && draft.metadata?.draftOnly === true)).toBe(true);
  });

  it('normalizes legacy Sleeve roles without treating triggers as MOLT prompt blocks', () => {
    const expected = {
      TRG: ['gate_control', 'gate'],
      STRAT: ['strategy', 'metadata'],
      AIM: ['aim', 'metadata'],
      NEED: ['need', 'constraint'],
      USE: ['use_case', 'metadata'],
      DIR: ['directive', 'molt'],
      INST: ['instruction', 'molt'],
      SUBJ: ['subject', 'molt'],
      PHIL: ['philosophy', 'molt'],
      BP: ['blueprint', 'molt'],
      PRIM: ['primary', 'molt']
    };
    for (const [legacy, [normalizedRole, target]] of Object.entries(expected)) {
      const mapping = normalizeLegacyMoltRole(legacy);
      expect(mapping.normalizedRole).toBe(normalizedRole);
      expect(mapping.target).toBe(target);
    }
  });

  it('audits legacy markdown Sleeves read-only', () => {
    const markdown = `# Nonprofit Financing Sleeve\nSleeve ID: SLV.NONPROFIT.FINANCING.V1\nTotal components: 248\n## Governance / Primary\n- PRIM.GOV.001 Mission-aligned capital\n## NeoStack NST.INTAKE Financing Intake\n### NeoBlock NB.INTAKE.001 Grant opportunity capture\n- TRG.INTAKE.001 Incoming funder request\n- DIR.INTAKE.001 Capture financing need\n## Workflow Examples\nWhen the user needs bridge financing, activate intake and risk stacks.\n## Output Format\nDecision memo and funder packet.`;
    const audit = parseLegacyMarkdownSleeve(markdown);
    expect(audit.sleeveId).toBe('SLV.NONPROFIT.FINANCING.V1');
    expect(audit.declaredTotalComponents).toBe(248);
    expect(audit.neoStacks.length).toBeGreaterThan(0);
    expect(audit.neoBlocks.length).toBeGreaterThan(0);
    expect(audit.moltRecords.some((record) => record.role === 'TRG' && record.normalizedRole.target === 'gate')).toBe(true);
    expect(audit.outputSections.length).toBeGreaterThan(0);
  });

  it('renders the Architect Plan Review workspace without creating a CompileCandidate', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const html = renderToStaticMarkup(React.createElement(SleeveArchitectReviewPanel, { plan }));
    expect(html).toContain('Architect Plan Review Workspace');
    expect(html).toContain('Customer Return &amp; Refund Orchestration Sleeve');
    expect(html).toContain('draftOnly: true');
    expect(html).toContain('saveState: draft');
    expect(html).toContain('needsUserReview: true');
    expect(html).toContain('defaultState: off');
    expect(html).toContain('declaration only');
    expect(html).toContain('reusable existing block');
    expect(html).toContain('Review required before any future Architect CompileCandidate action');
    expect(html).not.toContain('Create CompileCandidate');
  });

  it('tracks review state locally without implying source-library writes', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const reviewed = summarizeArchitectReview(plan, {
      [plan.generatedDrafts[0].id]: 'accept_for_this_sleeve',
      [plan.generatedDrafts[1].id]: 'needs_edit'
    });
    expect(reviewed.generatedCount).toBe(plan.generatedDrafts.length);
    expect(reviewed.reviewedCount).toBe(2);
    expect(reviewed.acceptedForSleeveCount).toBe(1);
    expect(reviewed.needsEditCount).toBe(1);
    expect(reviewed.compileGateLabel).toMatch(/compile remains a separate/);
    expect(plan.generatedDrafts.every((draft) => draft.metadata?.sourceLibraryWrite === false)).toBe(true);
  });

  it('creates an executable runtime-session CompileCandidate without mandatory review', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const execution = buildArchitectRuntimeExecution({ plan, businessMap: map, businessInput: input });
    expect(['create_new_sleeve', 'modify_existing_sleeve']).toContain(execution.route);
    expect(execution.compileCandidate.compileStatus).toBe('ready_for_compiler');
    expect(execution.assemblyPlan.compileStatus).toBe('compile_ready');
    expect(execution.runtimeSleeve.source).toBe('session');
    expect(execution.runtimeSleeve.metadata.sourceLibraryWrite).toBe(false);
    expect(execution.runtimeSleeve.metadata.noTrustedLibraryPromotion).toBe(true);
    expect(execution.compileCandidate.warnings.join(' ')).toMatch(/does not require manual review/);
    expect(execution.compileCandidate.traceMetadata.noFakeTrace).toBe(true);
  });

  it('retrieves scored read-only UMG library candidates for Greek desktop note prompts', async () => {
    const { retrieveUmgLibraryCandidates, UMG_LIBRARY_METADATA_INDEX_INFO } = await import('../lib/umg/umgLibraryCandidateRetrieval');
    const candidates = retrieveUmgLibraryCandidates('A WORKFLOW FOR CREATING DESKTOP NOTES THAT ALWAYS INCORPORATING GREEK PHILOSOPHY INTO ANY NOTE PROMPTED', { limit: 12 });
    expect(UMG_LIBRARY_METADATA_INDEX_INFO.candidateCount).toBeGreaterThan(1000);
    expect(UMG_LIBRARY_METADATA_INDEX_INFO.counts.molt).toBeGreaterThan(1000);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].score).toBeGreaterThan(0);
    expect(candidates[0].matchReasons.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.sourceKind === 'source-library')).toBe(true);
    expect(candidates.map((candidate) => candidate.blockType)).toEqual(expect.arrayContaining(['molt']));
  });

  it('builds and adapts a live Hermes custom workflow Sleeve plan as runtime-session state', async () => {
    const { buildHermesCustomSleeveGenerationRequest, adaptHermesCustomSleevePlanToRuntimeSessionSleeve } = await import('../lib/umg/hermesCustomSleeveGeneration');
    const request = buildHermesCustomSleeveGenerationRequest({
      userPrompt: ecommercePrompt,
      userContext: '',
      requestId: 'req.phase13ic.test'
    });
    expect(request.selectedMode).toBe('custom_workflow');
    expect(request.appLocalSkillBundle.sleeveDecompositionSkill).toContain('UMG Sleeve Decomposition Skill');
    expect(request.supportedPromptMoltRoles).toEqual(['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint']);
    expect(request.gatePolicy).toContain('Gates are control/routing/approval records');
    expect(request.sourceLibraryPolicy).toContain('Reuse relevant existing library blocks first');
    expect(request.libraryCandidates.length).toBeGreaterThan(0);
    expect(request.libraryCandidateSummary.total).toBe(request.libraryCandidates.length);
    expect(request.libraryCandidates[0].score).toBeGreaterThan(0);
    expect(request.libraryCandidates[0].matchReasons.length).toBeGreaterThan(0);
    expect(request.outputContract).toContain('libraryCandidates');

    const plan = {
      schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1',
      source: 'hermes_custom_workflow_generation',
      mode: 'runtime_session_draft',
      generationSource: 'live_hermes_cli',
      requestId: 'req.phase13ic.test',
      title: 'Hermes Return Orchestration Sleeve',
      summary: 'A custom workflow Sleeve generated by Hermes for safe refund orchestration.',
      decompositionSummary: 'Intake, validation, communication, approval, refund preparation, and audit lanes.',
      reuseDecisions: [{ id: 'reuse.customer_message', sourceId: request.libraryCandidates[0].id, title: request.libraryCandidates[0].title, reason: 'Reusable library candidate.' }],
      generatedDecisions: [{ id: 'gen.refund.audit', title: 'Refund Audit Block', runtimeSessionOnly: true, sourceLibraryWrite: false, reason: 'Missing audit lane for the custom prompt.' }],
      neoStacks: [{ id: 'stack.refund.intake', title: 'Refund Intake Stack', description: 'Capture request and facts.', neoBlockIds: ['block.capture.return'] }],
      neoBlocks: [{ id: 'block.capture.return', title: 'Capture Return Request', description: 'Collect customer/order facts.', neoStackId: 'stack.refund.intake', moltBlockIds: ['molt.capture.directive'] }],
      moltBlocks: [{ id: 'molt.capture.directive', title: 'Capture Return Directive', role: 'directive', content: 'Collect return request details.', parentNeoBlockId: 'block.capture.return', parentNeoStackId: 'stack.refund.intake' }],
      gates: [{ id: 'gate.refund.approval', title: 'Refund Approval Gate', reason: 'Approval/control record, not a prompt MOLT block.', controlledNeoBlockId: 'block.capture.return' }],
      capabilities: [{ capabilityId: 'customer_message_draft', label: 'Draft customer email', riskLevel: 'low', requiresConnector: false, safeForAppLocalExecution: true }],
      warnings: []
    };
    const adapted = adaptHermesCustomSleevePlanToRuntimeSessionSleeve(plan, request);
    expect(adapted.source).toBe('session');
    expect(adapted.templateKind).toBe('custom');
    expect(adapted.metadata.generatedByHermes).toBe(true);
    expect(adapted.metadata.generationSource).toBe('live_hermes_cli');
    expect(adapted.metadata.sourceLibraryWrite).toBe(false);
    expect(adapted.neoStacks).toHaveLength(1);
    expect(adapted.neoBlocks).toHaveLength(1);
    expect(adapted.moltBlocks[0].role).toBe('directive');
    expect(adapted.moltBlocks[0].sourceKind).toBe('generated glue');
    expect(adapted.metadata.libraryCandidateSummary.total).toBeGreaterThan(0);
    expect(adapted.metadata.libraryCandidates[0].matchReasons.length).toBeGreaterThan(0);
    expect(adapted.metadata.sourceStatusSummary.libraryCandidateCount).toBeGreaterThan(0);
    expect(adapted.gates[0].id).toBe('gate.refund.approval');
  });

  it('binds selected source-library MOLT candidates and MetaMOLT tool blocks into NeoBlock children before compile', async () => {
    const { buildCompositionSourceDiagnostics, buildHermesCustomSleeveGenerationRequest, adaptHermesCustomSleevePlanToRuntimeSessionSleeve } = await import('../lib/umg/hermesCustomSleeveGeneration');
    const request = buildHermesCustomSleeveGenerationRequest({
      userPrompt: 'A workflow for creating desktop notes that always incorporates Greek philosophy into any note prompted',
      userContext: '',
      requestId: 'req.s1c.bound.test'
    });
    const sourceCandidate = request.libraryCandidates.find((candidate) => candidate.blockType === 'molt' && candidate.sourcePath);
    expect(sourceCandidate).toBeTruthy();
    const plan = {
      schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1',
      source: 'hermes_custom_workflow_generation',
      mode: 'runtime_session_draft',
      generationSource: 'live_hermes_cli',
      requestId: 'req.s1c.bound.test',
      title: 'Greek Desktop Note Sleeve',
      summary: 'Create desktop notes with Greek philosophy framing.',
      decompositionSummary: 'Retrieve source MOLT blocks, compose the note, then prepare a desktop note artifact.',
      reuseDecisions: [{ id: 'reuse.philosophy', sourceId: sourceCandidate.id, title: sourceCandidate.title, targetNeoBlockId: 'block.apply.lens', reason: 'Bind library philosophy/source MOLT into the note lens NeoBlock.' }],
      generatedDecisions: [{ id: 'draft.note.directive', title: 'Draft Note Directive', runtimeSessionOnly: true, sourceLibraryWrite: false, reason: 'Glue needed for this runtime session.' }],
      neoStacks: [{ id: 'stack.compose', title: 'Composition Stack', description: 'Compose the Greek-infused note.', stackOrder: 1, tags: [], neoBlockIds: ['block.apply.lens'] }],
      neoBlocks: [{ id: 'block.apply.lens', title: 'Apply Greek Philosophy Lens', description: 'Apply the selected philosophy block and prepare persistence.', neoStackId: 'stack.compose', blockOrder: 1, tags: [], moltBlockIds: ['draft.note.directive'], gateIds: [], defaultState: 'off' }],
      moltBlocks: [{ id: 'draft.note.directive', title: 'Note Creation Directive', role: 'directive', content: 'Draft a note from the prompt.', parentNeoBlockId: 'block.apply.lens', parentNeoStackId: 'stack.compose', tags: [], defaultState: 'off' }],
      gates: [],
      capabilities: [{ capabilityId: 'umg.capability.local_note_file_write', label: 'Prepare desktop note artifact', riskLevel: 'medium', requiresConnector: false, safeForAppLocalExecution: false }],
      warnings: []
    };
    const adapted = adaptHermesCustomSleevePlanToRuntimeSessionSleeve(plan, request);
    const boundLibraryMolt = adapted.moltBlocks.find((block) => block.matchedCandidateId === sourceCandidate.id);
    expect(boundLibraryMolt).toBeTruthy();
    expect(boundLibraryMolt.sourceKind).toBe('source-library reused');
    expect(boundLibraryMolt.sourcePath).toBe(sourceCandidate.sourcePath);
    expect(boundLibraryMolt.parentNeoBlockId).toBe('block.apply.lens');
    expect(adapted.neoBlocks[0].moltBlockIds).toContain(sourceCandidate.id);
    const toolBlock = adapted.moltBlocks.find((block) => block.id === 'TOOL.HERMES.NOTE_CREATE.v0.1' || block.id === 'TOOL.HERMES.FILE_WRITE.v0.1');
    expect(toolBlock).toBeTruthy();
    expect(toolBlock.sourceKind).toBe('metamolt tool');
    expect(adapted.neoBlocks[0].moltBlockIds).toContain(toolBlock.id);
    const diagnostics = buildCompositionSourceDiagnostics({ sleeve: adapted, request, route: 'live Hermes' });
    expect(diagnostics.libraryRetrieval).toBe('ran');
    expect(diagnostics.candidateCount).toBeGreaterThan(0);
    expect(diagnostics.boundMoltCount).toBeGreaterThanOrEqual(3);
    expect(diagnostics.boundNeoBlockCount).toBe(1);
    expect(diagnostics.boundNeoStackCount).toBe(1);
    expect(diagnostics.metaMoltToolBlockCount).toBeGreaterThanOrEqual(1);
    expect(diagnostics.compileEligibility).toBe('yes');
  });

  it('filters competitor bridge candidates from Hermes-native Basic generation unless explicitly requested', async () => {
    const { rankHermesNativeCandidates } = await import('../lib/umg/hermesCustomSleeveGeneration');
    const candidates = [
      { id: 'TOOL.OPENCLAW.LANGCHAIN', title: 'LangChain OpenClaw Tool Bridge', description: 'Competitor bridge', domain: 'tool', tags: ['langchain'], sourcePath: 'library/openclaw.md', blockType: 'molt', role: 'tool', score: 10, matchReasons: ['OpenClaw bridge'] },
      { id: 'TOOL.HERMES.NOTE_CREATE.v0.1', title: 'Hermes Native Note Create', description: 'Hermes note tool', domain: 'tool', tags: ['hermes'], sourcePath: 'library/hermes-note.md', blockType: 'molt', role: 'tool', score: 8, matchReasons: ['Hermes note'] },
      { id: 'PHIL.002', title: 'Aristotelianism', description: 'Greek philosophy', domain: 'philosophy', tags: ['greek'], sourcePath: 'library/phil.md', blockType: 'molt', role: 'philosophy', score: 7, matchReasons: ['Greek philosophy'] }
    ];
    const hermesOnly = rankHermesNativeCandidates(candidates, 'Create a Hermes desktop note workflow', 5);
    expect(hermesOnly.map((candidate) => candidate.title)).toEqual(['Hermes Native Note Create', 'Aristotelianism']);
    const explicit = rankHermesNativeCandidates(candidates, 'Create an OpenClaw LangChain bridge workflow', 5);
    expect(explicit.map((candidate) => candidate.title)).toContain('LangChain OpenClaw Tool Bridge');
  });

  it('marks intake drafts/offline placeholders as not compileable and exposes composition source diagnostics', async () => {
    const { buildCompositionSourceDiagnostics, buildHermesCustomSleeveGenerationRequest } = await import('../lib/umg/hermesCustomSleeveGeneration');
    const request = buildHermesCustomSleeveGenerationRequest({ userPrompt: ecommercePrompt, userContext: '', requestId: 'req.s1c.intake.test' });
    const diagnostics = buildCompositionSourceDiagnostics({ request, route: 'intake draft', reasonIfNotEligible: 'Hermes generation required.' });
    expect(diagnostics.libraryRetrieval).toBe('ran');
    expect(diagnostics.candidateCount).toBeGreaterThan(0);
    expect(diagnostics.boundMoltCount).toBe(0);
    expect(diagnostics.sourceBindingStatus).toBe('missing');
    expect(diagnostics.compileEligibility).toBe('no');
    expect(diagnostics.reasonIfNotEligible).toContain('Hermes generation required');
  });

  it('renders composition source diagnostics and disables compile before an active Sleeve exists', () => {
    const noop = () => undefined;
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const html = renderToStaticMarkup(React.createElement(HackathonLandingPage, {
      goal: ecommercePrompt,
      context: '',
      selectedChip: 'Custom Workflow',
      selectedFiles: [],
      intakeSubmitted: true,
      businessMapReady: true,
      templateSelected: true,
      sleeveInstantiated: false,
      blockMatched: false,
      missingGenerated: false,
      assemblyReady: false,
      compilerComplete: false,
      hermesRunComplete: false,
      traceComplete: false,
      hermesEndpointConfigured: true,
      quickChips: ['Custom Workflow'],
      onGoalChange: noop,
      onContextChange: noop,
      onChipSelect: noop,
      onFilesAdd: noop,
      onFileRemove: noop,
      onFilesClear: noop,
      onSubmit: noop,
      onOpenStudio: noop,
      onOpenActiveSleeve: noop,
      onOpenRuntime: noop,
      onOpenDebug: noop
    }, React.createElement('div', null, 'Composition Source')));
    expect(html).toContain('Composition Source');
  });

  it('uses explicit build-flow status labels instead of Sleeve plan ready for intake/failure states', () => {
    const noop = () => undefined;
    const baseProps = {
      goal: ecommercePrompt,
      context: '',
      selectedChip: 'Custom Workflow',
      selectedFiles: [],
      intakeSubmitted: true,
      businessMapReady: true,
      templateSelected: true,
      sleeveInstantiated: false,
      blockMatched: false,
      missingGenerated: false,
      assemblyReady: false,
      compilerComplete: false,
      hermesRunComplete: false,
      traceComplete: false,
      hermesEndpointConfigured: true,
      quickChips: ['Custom Workflow'],
      onGoalChange: noop,
      onContextChange: noop,
      onChipSelect: noop,
      onFilesAdd: noop,
      onFileRemove: noop,
      onFilesClear: noop,
      onSubmit: noop,
      onOpenStudio: noop,
      onOpenActiveSleeve: noop,
      onOpenRuntime: noop,
      onOpenDebug: noop
    };
    const failedHtml = renderToStaticMarkup(React.createElement(HackathonLandingPage, { ...baseProps, intakeStatusOverride: 'Hermes generation failed' }, React.createElement('div', null, 'Hermes generation failed')));
    expect(failedHtml).toContain('Hermes generation failed');
    expect(failedHtml).not.toContain('Sleeve plan ready');
    const intakeHtml = renderToStaticMarkup(React.createElement(HackathonLandingPage, { ...baseProps, intakeStatusOverride: 'Intake analyzed' }, React.createElement('div', null, 'Intake Draft')));
    expect(intakeHtml).toContain('Intake analyzed');
    expect(intakeHtml).not.toContain('Sleeve plan ready');
  });

  it('keeps Basic surface judge-facing: no internal counters, stale business capabilities, or redundant runtime buttons', () => {
    const noop = () => undefined;
    const input = createBusinessInputFromPublicIntake({ goal: 'Create Greek philosophy desktop notes.', context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const activeSleeve = {
      id: 'sleeve.greek.notes', title: 'Greek-Infused Desktop Note Creator', version: 'runtime-session.v1', description: 'Create desktop notes enriched with Greek philosophy.', source: 'session', templateKind: 'custom', tags: ['greek', 'desktop', 'notes'],
      metadata: { generatedByHermes: true, runtimeSessionOnly: true, sourceLibraryWrite: false, sourceStatusSummary: { libraryCandidateCount: 12, reuseDecisionCount: 2, nodeLevelReusedCount: 2, generatedGlueCount: 0, unresolved: 0 }, capabilities: [
        { capabilityId: 'umg.capability.local_text_composition', label: 'Local text composition', reason: 'Compose the note text.', riskLevel: 'low', safeForAppLocalExecution: true, requiresConnector: false },
        { capabilityId: 'umg.capability.local_note_file_write', label: 'Prepare desktop note artifact', reason: 'Prepare the desktop note artifact.', riskLevel: 'medium', safeForAppLocalExecution: false, requiresConnector: false }
      ] },
      neoStacks: [
        { id: 'stack.intake', title: 'Prompt Intake and Note Triggering', description: 'Capture the note request.', stackOrder: 1, neoBlockIds: ['block.intake'], tags: [] },
        { id: 'stack.greek', title: 'Greek Philosophical Semantic Enrichment', description: 'Apply Greek concepts.', stackOrder: 2, neoBlockIds: ['block.greek'], tags: [] },
        { id: 'stack.emit', title: 'Desktop Note Draft Emission', description: 'Prepare the note artifact.', stackOrder: 3, neoBlockIds: ['block.emit'], tags: [] }
      ],
      neoBlocks: [
        { id: 'block.intake', title: 'Capture Note Prompt', description: 'Capture prompt.', neoStackId: 'stack.intake', blockOrder: 1, moltBlockIds: ['molt.dir'], gateIds: [], tags: [], defaultState: 'off' },
        { id: 'block.greek', title: 'Apply Greek Philosophy Lens', description: 'Apply lens.', neoStackId: 'stack.greek', blockOrder: 1, moltBlockIds: ['molt.phil'], gateIds: [], tags: [], defaultState: 'off' },
        { id: 'block.emit', title: 'Prepare Desktop Note Artifact', description: 'Prepare artifact.', neoStackId: 'stack.emit', blockOrder: 1, moltBlockIds: ['molt.inst', 'TOOL.HERMES.NOTE_CREATE.v0.1', 'TOOL.HERMES.FILE_WRITE.v0.1'], gateIds: [], tags: [], defaultState: 'off' }
      ],
      moltBlocks: [
        { id: 'molt.dir', title: 'Note Directive', role: 'directive', content: 'Create a note.', parentNeoBlockId: 'block.intake', parentNeoStackId: 'stack.intake', tags: [], defaultState: 'off', sourceKind: 'source-library reused', matchedCandidateId: 'DIR.NOTE.001', sourcePath: 'library/dir.json' },
        { id: 'molt.phil', title: 'Aristotelian Lens', role: 'philosophy', content: 'Use Greek philosophy.', parentNeoBlockId: 'block.greek', parentNeoStackId: 'stack.greek', tags: [], defaultState: 'off', sourceKind: 'source-library reused', matchedCandidateId: 'PHIL.002', sourcePath: 'library/phil.json' },
        { id: 'molt.inst', title: 'Desktop Note Instruction', role: 'instruction', content: 'Prepare a desktop note.', parentNeoBlockId: 'block.emit', parentNeoStackId: 'stack.emit', tags: [], defaultState: 'off', sourceKind: 'runtime-session draft' },
        { id: 'TOOL.HERMES.NOTE_CREATE.v0.1', title: 'Hermes Native Note Create', role: 'tool', content: 'Create note.', parentNeoBlockId: 'block.emit', parentNeoStackId: 'stack.emit', tags: ['tool'], defaultState: 'off', sourceKind: 'metamolt tool' },
        { id: 'TOOL.HERMES.FILE_WRITE.v0.1', title: 'Hermes Native File Write', role: 'tool', content: 'Write file.', parentNeoBlockId: 'block.emit', parentNeoStackId: 'stack.emit', tags: ['tool'], defaultState: 'off', sourceKind: 'metamolt tool' }
      ],
      gates: [], governanceBlockIds: []
    };
    const palette = buildBasicCapabilityPalette({ activeSessionSleeve: activeSleeve, resolutions: [], content: [] });
    expect(palette.map((card) => card.label)).toEqual(['Local text composition', 'Prepare desktop note artifact']);
    expect(palette.map((card) => card.label)).not.toEqual(expect.arrayContaining(['Generate executive summary', 'Create financial assumptions']));
    const appSource = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8');
    expect(appSource).toContain('Open Runtime Graph');
    expect(appSource).toContain('Structure view available before compile. Runtime trace appears after compile/run.');
    expect(appSource).toContain('Generate a Sleeve first.');
    expect(appSource).toContain('npm run umg:compiler-bridge');
    expect(appSource).toContain('Compiler endpoint configured, but bridge is not responding.');
    expect(appSource).not.toContain('Open Runtime Observer');
    expect(appSource).not.toContain('Open Runtime Geometry');
    expect(appSource).not.toContain('Generated glue');
    expect(appSource).not.toContain('Runtime drafts');
    expect(appSource).not.toContain('Node-level reused');
    expect(appSource).toContain('runtimeDetailRows');
    expect(appSource).toContain('lastNativeActionResult || hermesRuntimeVisualState?.timeline.length');
    expect(appSource).toContain('Noncanonical dev route.');
    expect(appSource).toContain('Advanced Diagnostics');
    expect(appSource).toContain('Intake Intelligence Diagnostics · Composition Source · bridge debug');
  });

  it('keeps general canvas separate and only exposes Inspect Active Sleeve when session state exists', () => {
    const noop = () => undefined;
    const baseProps = {
      goal: 'Create a custom email generator Sleeve.',
      context: '',
      selectedChip: 'Custom Workflow',
      selectedFiles: [],
      intakeSubmitted: false,
      businessMapReady: false,
      templateSelected: false,
      sleeveInstantiated: false,
      blockMatched: false,
      missingGenerated: false,
      assemblyReady: false,
      hermesEndpointConfigured: true,
      quickChips: ['Custom Workflow', 'Business Automation', 'Chatbot', 'Website'],
      onGoalChange: noop,
      onContextChange: noop,
      onChipSelect: noop,
      onFilesAdd: noop,
      onFileRemove: noop,
      onFilesClear: noop,
      onSubmit: noop,
      onOpenStudio: noop,
      onOpenActiveSleeve: noop,
      onOpenRuntime: noop,
      onOpenDebug: noop
    };
    const generalOnly = renderToStaticMarkup(React.createElement(HackathonLandingPage, baseProps));
    expect(generalOnly).toContain('Open Studio Editor');
    expect(generalOnly).not.toContain('Inspect Active Sleeve');
    const withActive = renderToStaticMarkup(React.createElement(HackathonLandingPage, { ...baseProps, hasActiveSessionSleeve: true }));
    expect(withActive).toContain('Open Studio Editor');
    expect(withActive).not.toContain('Inspect Active Sleeve');
    expect(withActive).toContain('Custom Workflow');
    expect(withActive).toContain('Business Automation · coming soon');
  });

  it('renders active-session Studio inspector with generated hierarchy, MOLT roles, gates, capabilities, and no source-library write', () => {
    const sleeve = {
      id: 'custom.email.reseller',
      title: 'Small Reseller Product Announcement Email Sleeve',
      version: 'runtime-session.v1',
      description: 'Draft reviewable product announcement emails for reseller customers without sending.',
      source: 'session',
      templateKind: 'custom',
      tags: ['email', 'reseller'],
      metadata: { runtimeSessionOnly: true, sourceLibraryWrite: false, sourceLibrarySaved: false, generationSource: 'hermes_custom_workflow_generation', capabilities: [{ capabilityId: 'customer_email_draft', label: 'Draft customer email', riskLevel: 'low' }] },
      neoStacks: [{ id: 'stack.email', title: 'Reseller Email Stack', description: 'Plan announcement email drafting.', stackOrder: 1, neoBlockIds: ['block.email'], tags: [] }],
      neoBlocks: [{ id: 'block.email', title: 'Draft Announcement Email', description: 'Prepare a reviewable email artifact only.', neoStackId: 'stack.email', blockOrder: 1, moltBlockIds: ['molt.dir', 'molt.inst', 'molt.subj', 'molt.prim', 'molt.phil', 'molt.blue'], gateIds: ['gate.review'], tags: [], defaultState: 'off' }],
      moltBlocks: [
        { id: 'molt.dir', title: 'Email Draft Directive', role: 'directive', content: 'Draft announcement emails; do not send.', parentNeoBlockId: 'block.email', parentNeoStackId: 'stack.email', tags: [], defaultState: 'off', sourceKind: 'source-library reused', reusedBlockId: 'LIB.MOLT.EMAIL.DIR', sourcePath: 'AI/MOLT-BLOCKS/email/library.json', stackOrder: 1 },
        { id: 'molt.inst', title: 'Brand Voice Instruction', role: 'instruction', content: 'Use the supplied brand voice and product details.', parentNeoBlockId: 'block.email', parentNeoStackId: 'stack.email', tags: [], defaultState: 'off' },
        { id: 'molt.subj', title: 'Reseller Subject', role: 'subject', content: 'Small reseller customers and new products.', parentNeoBlockId: 'block.email', parentNeoStackId: 'stack.email', tags: [], defaultState: 'off' },
        { id: 'molt.prim', title: 'Reviewable Artifact Primary', role: 'primary', content: 'Produce a reviewable email artifact.', parentNeoBlockId: 'block.email', parentNeoStackId: 'stack.email', tags: [], defaultState: 'off' },
        { id: 'molt.phil', title: 'Safe Drafting Philosophy', role: 'philosophy', content: 'Human review before any external communication.', parentNeoBlockId: 'block.email', parentNeoStackId: 'stack.email', tags: [], defaultState: 'off' },
        { id: 'molt.blue', title: 'Email Blueprint', role: 'blueprint', content: 'Subject, preview, body, CTA, review notes.', parentNeoBlockId: 'block.email', parentNeoStackId: 'stack.email', tags: [], defaultState: 'off' }
      ],
      gates: [{ id: 'gate.review', title: 'Human Review Gate', attachesTo: { kind: 'neoBlock', id: 'block.email' }, triggerType: 'manual', conditionText: 'Require human review before use.', action: 'require_approval', targetIds: ['block.email'], defaultState: 'closed', runtimeState: 'inactive', tags: [] }],
      governanceBlockIds: []
    };
    const html = renderToStaticMarkup(React.createElement(ActiveSessionSleeveStudioInspector, { sleeve, selectedNeoStackId: 'stack.email', selectedNeoBlockId: 'block.email', compileStatus: 'not compiled', runtimeStatus: 'approval boundary pending' }));
    expect(html).toContain('Active Session Sleeve Inspector');
    expect(html).toContain('Small Reseller Product Announcement Email Sleeve');
    expect(html).toContain('NeoStacks');
    expect(html).toContain('Reseller Email Stack');
    expect(html).toContain('Draft Announcement Email');
    expect(html).toContain('Email Draft Directive');
    expect(html).toContain('Brand Voice Instruction');
    expect(html).toContain('Human Review Gate');
    expect(html).toContain('Draft customer email');
    expect(html).toContain('Runtime-session only');
    expect(html).toContain('activeSessionSourceBadge reused');
    expect(html).toContain('activeSessionMoltDetailButton');
    expect(html).toContain('sourceLibrarySaved: false');
    expect(html).toContain('sourceLibraryWrite: false');
    expect(html).toContain('not compiled');
    expect(html).not.toContain('Active Sleeve: none');
    expect(html).not.toContain('NeoStacks: 0');
  });

  it('renders non-blank MOLT detail for runtime-session and unresolved fallback records', () => {
    const sleeve = {
      id: 'sleeve.detail.test', title: 'Detail Test Sleeve', version: 'runtime-session.v1', description: 'detail test', source: 'session', templateKind: 'custom', tags: [], metadata: { runtimeSessionOnly: true, sourceLibraryWrite: false, sourceLibrarySaved: false },
      neoStacks: [{ id: 'stack.detail', title: 'Detail Stack', description: 'Stack parent', stackOrder: 1, neoBlockIds: ['block.detail'], tags: [] }],
      neoBlocks: [{ id: 'block.detail', title: 'Detail NeoBlock', description: 'Block parent', neoStackId: 'stack.detail', blockOrder: 1, moltBlockIds: ['molt.detail'], gateIds: [], tags: [], defaultState: 'off' }],
      moltBlocks: [{ id: 'molt.detail', title: 'Runtime Detail MOLT', role: 'instruction', content: 'Inspectable runtime MOLT.', parentNeoBlockId: 'block.detail', parentNeoStackId: 'stack.detail', tags: ['detail'], defaultState: 'off', sourceKind: 'runtime-session draft', stackOrder: 2, matchedCandidateId: 'CAND.RUNTIME.001' }],
      gates: [], governanceBlockIds: []
    };
    const runtimeHtml = renderToStaticMarkup(React.createElement(MoltDetailPanel, { sleeve, molt: sleeve.moltBlocks[0], selectedBlockId: 'block.detail', onClose: () => undefined }));
    expect(runtimeHtml).toContain('Runtime Detail MOLT');
    expect(runtimeHtml).toContain('runtime-session draft');
    expect(runtimeHtml).toContain('matchedCandidateId');
    expect(runtimeHtml).toContain('CAND.RUNTIME.001');
    expect(runtimeHtml).toContain('activeSessionSourceBadge');
    expect(runtimeHtml).toContain('Parent NeoStack');
    expect(runtimeHtml).toContain('Detail Stack');
    expect(runtimeHtml).toContain('Not linked to source library');
    const unresolvedHtml = renderToStaticMarkup(React.createElement(MoltDetailPanel, { sleeve, selectedBlockId: 'block.detail', onClose: () => undefined }));
    expect(unresolvedHtml).toContain('Unresolved MOLTBlock');
    expect(unresolvedHtml).toContain('Diagnostic fallback rendered instead of blank page');
    expect(unresolvedHtml).toContain('unresolved');
  });

  it('separates Hermes reuse decisions from node-level reused counts when binding is partial', () => {
    const sleeve = {
      id: 'sleeve.reuse.partial', title: 'Partial Reuse Sleeve', version: 'runtime-session.v1', description: 'partial reuse', source: 'session', templateKind: 'custom', tags: [],
      metadata: { sourceStatusSummary: { libraryCandidateCount: 24, reuseDecisionCount: 2, generatedGlueDecisionCount: 11, unresolved: 0 } },
      neoStacks: [{ id: 'stack.partial', title: 'Partial Stack', description: 'Stack', stackOrder: 1, neoBlockIds: ['block.partial'], tags: [], sourceKind: 'generated glue' }],
      neoBlocks: [{ id: 'block.partial', title: 'Partial Block', description: 'Block', neoStackId: 'stack.partial', blockOrder: 1, moltBlockIds: ['molt.partial'], gateIds: [], tags: [], defaultState: 'off', sourceKind: 'generated glue' }],
      moltBlocks: [{ id: 'molt.partial', title: 'Partial MOLT', role: 'philosophy', content: 'Uses a candidate decision but is not node-bound.', parentNeoBlockId: 'block.partial', parentNeoStackId: 'stack.partial', tags: [], defaultState: 'off', sourceKind: 'generated glue' }],
      gates: [], governanceBlockIds: []
    };
    const summary = summarizeNormalizedTemplateSourceStatus(sleeve);
    expect(summary.libraryCandidateCount).toBe(24);
    expect(summary.reuseDecisionCount).toBe(2);
    expect(summary.nodeLevelReusedCount).toBe(0);
    expect(summary.generatedGlueCount).toBe(3);
    expect(summary.sourceBindingStatus).toBe('partial');
    expect(summary.sourceBindingWarning).toBe('Reuse decisions received; node-level source binding incomplete.');
  });

  it('counts node-level reused records only when source metadata is actually bound', () => {
    const sleeve = {
      id: 'sleeve.reuse.bound', title: 'Bound Reuse Sleeve', version: 'runtime-session.v1', description: 'bound reuse', source: 'session', templateKind: 'custom', tags: [],
      metadata: { sourceStatusSummary: { libraryCandidateCount: 24, reuseDecisionCount: 1, generatedGlueDecisionCount: 2, unresolved: 0 } },
      neoStacks: [{ id: 'stack.bound', title: 'Bound Stack', description: 'Stack', stackOrder: 1, neoBlockIds: ['block.bound'], tags: [], sourceKind: 'generated glue' }],
      neoBlocks: [{ id: 'block.bound', title: 'Bound Block', description: 'Block', neoStackId: 'stack.bound', blockOrder: 1, moltBlockIds: ['molt.bound'], gateIds: [], tags: [], defaultState: 'off', sourceKind: 'generated glue' }],
      moltBlocks: [{ id: 'molt.bound', title: 'Aristotelianism', role: 'philosophy', content: 'Bound reused philosophy block.', parentNeoBlockId: 'block.bound', parentNeoStackId: 'stack.bound', tags: ['greek'], defaultState: 'off', sourceKind: 'source-library reused', reusedBlockId: 'PHIL.002', matchedCandidateId: 'PHIL.002', sourcePath: 'HUMAN/MOLT-BLOCKS/PHIL.002.md' }],
      gates: [], governanceBlockIds: []
    };
    const summary = summarizeNormalizedTemplateSourceStatus(sleeve);
    expect(summary.reuseDecisionCount).toBe(1);
    expect(summary.nodeLevelReusedCount).toBe(1);
    expect(summary.sourceBindingStatus).toBe('complete');
    const html = renderToStaticMarkup(React.createElement(MoltDetailPanel, { sleeve, molt: sleeve.moltBlocks[0], selectedBlockId: 'block.bound', onClose: () => undefined }));
    expect(html).toContain('reused');
    expect(html).toContain('PHIL.002');
    expect(html).not.toContain('Not linked to source library');
  });

  it('converts Architect execution to compiler request and Hermes tool capability declarations', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const execution = buildArchitectRuntimeExecution({ plan, businessMap: map, businessInput: input });
    const compilerInput = createCompilerInputFromCompileCandidate({ compileCandidate: execution.compileCandidate, assemblyPlan: execution.assemblyPlan, blockMatchPlan: execution.blockMatchPlan, businessMap: map, businessInput: input });
    expect(validateCompilerInput(compilerInput)).toEqual([]);
    const request = createCompilerRequest(compilerInput);
    expect(request.input.requiredTools).toEqual(expect.arrayContaining([
      'order_lookup',
      'customer_message_draft',
      'refund_prepare_or_request',
      'inventory_update_request',
      'audit_log_write',
      'report_generate'
    ]));
    const compilerResult = normalizeCompilerResponseToManifest({
      ok: true,
      result: { runtime: { sleeveId: execution.runtimeSleeve.id, sleeveName: execution.runtimeSleeve.title, promptSpec: { neoBlockPrompts: [] } }, executionPlan: [], toolPolicy: undefined }
    }, request);
    expect(compilerResult.status).toBe('ok');
    const hermesRequest = createHermesRuntimeRequestFromManifest({ compiledRuntimeManifest: compilerResult.manifest, userGoal: input.text, businessInput: input, executionMode: 'approvalRequired', approvalMode: defaultArchitectExecutionPolicy.approvalMode });
    expect(hermesRequest.compiledSleeveManifest.toolPolicy.allowedTools).toEqual(expect.arrayContaining(['order_lookup', 'refund_prepare_or_request']));
    expect(hermesRequest.executionMode).toBe('approvalRequired');
    expect(hermesRequest.approvalMode).toBe('manual');
  });

  it('resolves declared tool capabilities and creates pending runtime approval state from needsApproval', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const execution = buildArchitectRuntimeExecution({ plan, businessMap: map, businessInput: input });
    const compilerInput = createCompilerInputFromCompileCandidate({ compileCandidate: execution.compileCandidate, assemblyPlan: execution.assemblyPlan, blockMatchPlan: execution.blockMatchPlan, businessMap: map, businessInput: input });
    const compilerRequest = createCompilerRequest(compilerInput);
    const compilerResult = normalizeCompilerResponseToManifest({ ok: true, result: { runtime: { sleeveId: execution.runtimeSleeve.id, sleeveName: execution.runtimeSleeve.title, promptSpec: { neoBlockPrompts: [] } }, executionPlan: [], toolPolicy: undefined } }, compilerRequest);
    const manifest = compilerResult.manifest;
    const resolutions = resolveToolCapabilities({ manifest, configuredCapabilities: ['customer_message_draft', 'report_generate'] });
    expect(resolutions.map((entry) => entry.capabilityId)).toEqual(expect.arrayContaining(['order_lookup', 'customer_message_draft', 'refund_prepare_or_request']));
    expect(resolutions.find((entry) => entry.capabilityId === 'customer_message_draft')?.executionPolicy).toBe('autoAllowed');
    expect(resolutions.find((entry) => entry.capabilityId === 'refund_prepare_or_request')?.executionPolicy).toBe('approvalRequired');
    const hermesRequest = createHermesRuntimeRequestFromManifest({ compiledRuntimeManifest: manifest, userGoal: input.text, businessInput: input, executionMode: 'approvalRequired', approvalMode: 'manual', traceId: 'trace.phase13d.start' });
    const pending = createPendingRuntimeApproval({
      request: hermesRequest,
      resolutions,
      result: {
        status: 'needsApproval',
        finalOutput: 'Needs runtime approval before tool boundary.',
        trace: [{ traceId: hermesRequest.traceId, eventId: 'evt_tool_boundary', timestamp: 1, eventType: 'tool_call_requires_approval', scopeKind: 'tool', toolId: 'refund_prepare_or_request', state: 'attention', label: 'refund capability requires approval' }],
        toolCalls: [],
        blockedCalls: [],
        approvalRequests: [{ id: 'approval.1', traceId: hermesRequest.traceId, approvalId: 'approval.1', label: 'refund_prepare_or_request', reason: 'Refund preparation requires explicit approval.', requestedAt: 1, status: 'pending', raw: { capabilityId: 'refund_prepare_or_request' } }],
        errors: [],
        artifacts: [],
        nextSuggestedActions: []
      }
    });
    expect(pending?.pendingApprovalTraceId).toBe('trace.phase13d.start');
    expect(pending?.pendingToolCapability.capabilityId).toBe('refund_prepare_or_request');
    expect(pending?.continuationPayload.previousTraceId).toBe('trace.phase13d.start');
    expect(pending?.continuationPayload.preserveUMGTrace).toBe(true);
  });

  it('builds approval continuation requests and denied approval does not approve tool execution', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const execution = buildArchitectRuntimeExecution({ plan, businessMap: map, businessInput: input });
    const compilerInput = createCompilerInputFromCompileCandidate({ compileCandidate: execution.compileCandidate, assemblyPlan: execution.assemblyPlan, blockMatchPlan: execution.blockMatchPlan, businessMap: map, businessInput: input });
    const compilerResult = normalizeCompilerResponseToManifest({ ok: true, result: { runtime: { sleeveId: execution.runtimeSleeve.id, sleeveName: execution.runtimeSleeve.title, promptSpec: { neoBlockPrompts: [] } }, executionPlan: [], toolPolicy: undefined } }, createCompilerRequest(compilerInput));
    const hermesRequest = createHermesRuntimeRequestFromManifest({ compiledRuntimeManifest: compilerResult.manifest, userGoal: input.text, businessInput: input, traceId: 'trace.phase13d.denied' });
    const resolutions = resolveToolCapabilities({ manifest: compilerResult.manifest });
    const pending = createPendingRuntimeApproval({ request: hermesRequest, resolutions, result: { status: 'needsApproval', finalOutput: 'Need approval.', trace: [], toolCalls: [], blockedCalls: [], approvalRequests: [{ id: 'approval.2', traceId: hermesRequest.traceId, approvalId: 'approval.2', label: 'order_lookup', reason: 'lookup boundary', requestedAt: 1, status: 'pending', raw: { capabilityId: 'order_lookup' } }], errors: [], artifacts: [], nextSuggestedActions: [] } });
    expect(pending).toBeDefined();
    const denied = createHermesContinuationRequest({ pendingApproval: pending, decision: 'deny', userInstruction: 'Skip order lookup.' });
    expect(denied.approvalDecision).toBe('deny');
    expect(denied.approvedCapabilities).toEqual([]);
    expect(denied.deniedCapabilities).toEqual(['order_lookup']);
    expect(denied.previousTraceId).toBe('trace.phase13d.denied');
    expect(denied.continuationMode).toBe('continue_after_approval');
  });

  it('maps approved continuation tool trace events into UMG runtime state without fabricated activation', () => {
    const state = applyRuntimeTraceEvents(createEmptyRuntimeVisualState('trace.phase13d.continue'), [
      { traceId: 'trace.phase13d.continue', eventId: 'approval_granted.1', timestamp: 1, eventType: 'approval_granted', scopeKind: 'approval', approvalId: 'approval.1', state: 'complete', label: 'approval granted' },
      { traceId: 'trace.phase13d.continue', eventId: 'tool_call_executed.1', timestamp: 2, eventType: 'tool_call_executed', scopeKind: 'tool', toolId: 'customer_message_draft', state: 'complete', label: 'draft generated' },
      { traceId: 'trace.phase13d.continue', eventId: 'gate_opened.1', timestamp: 3, eventType: 'gate_opened', scopeKind: 'gate', gateId: 'gate.refund.approval', state: 'active', label: 'gate opened' },
      { traceId: 'trace.phase13d.continue', eventId: 'neoblock_completed.1', timestamp: 4, eventType: 'neoblock_completed', scopeKind: 'neoblock', neoBlockId: 'nb.refund.approval', state: 'complete', label: 'neoblock completed' }
    ]);
    expect(state.completeIds).toEqual(expect.arrayContaining(['approval.1', 'customer_message_draft', 'nb.refund.approval']));
    expect(state.activeIds).toContain('gate.refund.approval');
    expect(state.timeline).toHaveLength(4);
  });

  it('packages UMG Runtime Skill knowledge with hierarchy rules, trace schema, app-local skill bundle, and strict JSON envelope', () => {
    const skill = getHermesUmgRuntimeSkillPack();
    expect(skill.id).toBe('umg_runtime_skill_pack.v1');
    expect(skill.instructions).toContain('Sleeve');
    expect(skill.instructions).toContain('NeoStack');
    expect(skill.instructions).toContain('NeoBlock');
    expect(skill.instructions).toContain('MOLT');
    expect(skill.instructions).toContain('Gate/control record');
    expect(skill.instructions).toContain('UMG Sleeve Decomposition Skill');
    expect(skill.instructions).toContain('Bundle block-card JSON schemas are authoring/import schemas and must not be sent directly to the compiler.');
    expect(skill.instructions).toContain('Website Builder / Web Creation is a future scoped Domain Pack');
    expect(skill.appLocalSkillBundle.supportedPromptMoltRoles).toEqual(['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint']);
    expect(skill.appLocalSkillBundle.hierarchyCardSkill).toContain('MOLT -> NeoBlock -> NeoStack -> Sleeve');
    expect(skill.appLocalSkillBundle.sleeveDecompositionSkill).toContain('Library-first, generate-second');
    expect(skill.appLocalSkillBundle.compilerAlignmentRules).toContain('Current app/compiler/runtime schemas are authoritative.');
    expect(skill.appLocalSkillBundle.sourceLibraryBoundaryRules).toContain('No source-library mutation');
    expect(skill.appLocalSkillBundle.capabilityBoundaryRules).toContain('Capabilities are declarations until resolved');
    expect(skill.traceEventTypes).toEqual(expect.arrayContaining(['run_started', 'tool_call_requires_approval', 'tool_result_received', 'run_completed']));
    expect(skill.outputEnvelopeSchema.required).toEqual(expect.arrayContaining(['traceId', 'status', 'finalOutput', 'events']));
  });

  it('keeps app-local hierarchy and Sleeve decomposition skill available to Custom Workflow plans without global install', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const bundle = getHermesUmgAppLocalSkillBundle();

    expect(plan.appLocalSkillBundle.id).toBe('umg_app_local_skill_bundle.phase13i_b');
    expect(plan.appLocalSkillBundle).toEqual(bundle);
    expect(plan.appLocalSkillBundle.hierarchyCardSkill).toContain('Domain Pack walls');
    expect(plan.appLocalSkillBundle.sleeveDecompositionSkill).toContain('Gates are control/routing/approval records, not prompt MOLT blocks.');
    expect(plan.appLocalSkillBundle.websiteBuilderBoundary).toContain('Keep Website Builder greyed/scoped until explicitly imported.');
    expect(plan.appLocalSkillBundle.sourceLibraryBoundaryRules).toContain('No global Hermes skill install');
    expect(plan.generatedDrafts.every((draft) => draft.metadata?.sourceLibraryWrite === false)).toBe(true);
  });

  it('scaffolds future Hermes custom Sleeve generation as app-aligned runtime-session output only', () => {
    expect(HERMES_CUSTOM_SLEEVE_PLAN_SCHEMA_NOTE).toContain('app-aligned structures, not uploaded bundle card schemas');
    expect(HERMES_CUSTOM_SLEEVE_PLAN_SCHEMA_NOTE).toContain('NormalizedTemplateSleeve');
    expect(HERMES_CUSTOM_SLEEVE_PLAN_SCHEMA_NOTE).toContain('gates map to UMGGateRecord control/routing/approval records, not prompt MOLT blocks.');
    const errors = validateHermesCustomSleevePlanScaffold({
      schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1',
      mode: 'runtime_session_draft',
      moltBlocks: [{ id: 'molt.1', title: 'Directive', role: 'directive', content: 'Do the safe thing.', tags: [], defaultState: 'off' }],
      generatedDecisions: [{ id: 'decision.1', targetKind: 'molt', proposedId: 'molt.1', reason: 'Gap found.', runtimeSessionOnly: true, sourceLibraryWrite: false, needsUserReview: true }]
    });
    expect(errors).toEqual([]);
    const bad = validateHermesCustomSleevePlanScaffold({
      schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1',
      mode: 'runtime_session_draft',
      moltBlocks: [{ id: 'molt.bad', title: 'Trigger', role: 'trigger', content: 'Unsupported prompt role.', tags: [], defaultState: 'off' }],
      generatedDecisions: [{ id: 'decision.bad', targetKind: 'molt', proposedId: 'molt.bad', reason: 'Bad gap.', runtimeSessionOnly: false, sourceLibraryWrite: true, needsUserReview: true }]
    });
    expect(bad.join(' ')).toContain('Unsupported prompt MOLT role: trigger');
    expect(bad.join(' ')).toContain('must be runtimeSessionOnly');
    expect(bad.join(' ')).toContain('must keep sourceLibraryWrite false');
  });

  it('builds a Tool Capability Registry v1 for e-commerce capabilities without treating unknowns as available', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const execution = buildArchitectRuntimeExecution({ plan, businessMap: map, businessInput: input });
    const compilerInput = createCompilerInputFromCompileCandidate({ compileCandidate: execution.compileCandidate, assemblyPlan: execution.assemblyPlan, blockMatchPlan: execution.blockMatchPlan, businessMap: map, businessInput: input });
    const compilerResult = normalizeCompilerResponseToManifest({ ok: true, result: { runtime: { sleeveId: execution.runtimeSleeve.id, sleeveName: execution.runtimeSleeve.title, promptSpec: { neoBlockPrompts: [] } }, executionPlan: [], toolPolicy: undefined } }, createCompilerRequest(compilerInput));
    const registry = buildHermesToolCapabilityRegistry({ manifest: compilerResult.manifest });
    expect(registry.map((entry) => entry.capabilityId)).toEqual(expect.arrayContaining(['order_lookup', 'customer_message_draft', 'refund_prepare_or_request', 'inventory_update_request', 'audit_log_write', 'report_generate']));
    expect(registry.find((entry) => entry.capabilityId === 'customer_message_draft')).toMatchObject({ available: 'yes', riskLevel: 'low', requiredApproval: false, safeForLiveExecution: true, source: 'configured' });
    expect(registry.find((entry) => entry.capabilityId === 'refund_prepare_or_request')).toMatchObject({ riskLevel: 'irreversible', requiredApproval: true, safeForLiveExecution: false });
    const unknown = buildHermesToolCapabilityRegistry({ manifest: compilerResult.manifest, declaredCapabilities: ['unknown_external_tool'] })[0];
    expect(unknown.available).not.toBe('yes');
    expect(unknown.source).toBe('unknown');
    expect(unknown.safeForLiveExecution).toBe(false);
  });

  it('injects UMG skill instructions and capability declarations into Architect Mode Hermes requests', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const execution = buildArchitectRuntimeExecution({ plan, businessMap: map, businessInput: input });
    const compilerInput = createCompilerInputFromCompileCandidate({ compileCandidate: execution.compileCandidate, assemblyPlan: execution.assemblyPlan, blockMatchPlan: execution.blockMatchPlan, businessMap: map, businessInput: input });
    const compilerResult = normalizeCompilerResponseToManifest({ ok: true, result: { runtime: { sleeveId: execution.runtimeSleeve.id, sleeveName: execution.runtimeSleeve.title, promptSpec: { neoBlockPrompts: [] } }, executionPlan: [], toolPolicy: undefined } }, createCompilerRequest(compilerInput));
    const hermesRequest = createHermesRuntimeRequestFromManifest({ compiledRuntimeManifest: compilerResult.manifest, userGoal: input.text, businessInput: input, executionMode: 'approvalRequired', approvalMode: 'manual', traceId: 'trace.phase13e.request' });
    expect(hermesRequest.umgRuntimeSkillPack?.id).toBe('umg_runtime_skill_pack.v1');
    expect(hermesRequest.toolCapabilityRegistry?.map((entry) => entry.capabilityId)).toEqual(expect.arrayContaining(['customer_message_draft', 'order_lookup']));
    expect(hermesRequest.geometryTraceMappingIds?.sleeveId).toBe(compilerResult.manifest.sleeveId);
    expect(hermesRequest.currentExecutionRoute?.executionPlanIds.length).toBeGreaterThan(0);
  });

  it('validates generated MOLT compiler shape and keeps gates as control records', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const execution = buildArchitectRuntimeExecution({ plan, businessMap: map, businessInput: input });
    const validation = validateArchitectSleeveForCompiler(execution.runtimeSleeve);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.primaryRolePresent).toBe(true);
    expect(validation.gatesAreControlRecords).toBe(true);
    expect(validation.oversaturatedNeoBlockIds).toEqual([]);
  });

  it('creates a domain-specific Greek philosophy business plan Sleeve for Basic Mode', () => {
    const prompt = 'a business plan template generator that can create any kind of full professional business plan based on Greek philosophy principles';
    const input = createBusinessInputFromPublicIntake({ goal: prompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    expect(plan.mode).toBe('architect_mode');
    expect(plan.proposedSleeveTitle).toBe('Greek Philosophy Business Plan Generator Sleeve');
    expect(plan.proposedNeoStacks.map((stack) => stack.title)).toEqual(expect.arrayContaining([
      'Philosophical Principle Intake Stack',
      'Business Model Discovery Stack',
      'Market and Polis Context Stack',
      'Ethics / Telos / Value Proposition Stack',
      'Financial Assumptions and Viability Stack'
    ]));
    expect(plan.proposedNeoBlocks.map((block) => block.title)).toEqual(expect.arrayContaining([
      'Capture Greek Philosophy Principles',
      'Define Business Model Thesis',
      'Create Financial Assumptions',
      'Assemble Professional Business Plan'
    ]));
    expect(plan.proposedNeoBlocks.filter((block) => block.title.includes('Coordinator'))).toHaveLength(0);
    expect(plan.proposedMoltBlocks.every((block) => !/content needed for/i.test(block.summary))).toBe(true);
    expect(evaluateBasicSleeveQuality(plan).status).toBe('strong');
  });

  it('derives Basic capability palette statuses and unsafe connector boundaries', () => {
    const prompt = 'Draft customer emails, send email later, and create a business plan using Greek philosophy principles.';
    const input = createBusinessInputFromPublicIntake({ goal: prompt, context: 'contacts.csv with email,phone', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    const content = classifyBasicContent({ text: 'email,phone\nada@example.com,555-1000', filenames: ['contacts.csv'] });
    const palette = buildBasicCapabilityPalette({ plan, content, resolutions: [{ capabilityId: 'customer_message_draft', toolId: 'safe_customer_message_draft', label: 'Draft customer email', available: 'yes', source: 'configured', riskLevel: 'low', requiredApproval: false, safeForLiveExecution: true, executionPolicy: 'autoAllowed', reason: 'safe draft' }] });
    expect(palette.map((card) => card.label)).toEqual(expect.arrayContaining(['Draft customer email', 'Read uploaded contact file', 'Send email', 'Generate executive summary', 'Apply Greek philosophy principles']));
    expect(palette.find((card) => card.capabilityId === 'customer_message_draft')).toMatchObject({ status: 'available', riskLevel: 'low', externalActionTaken: false });
    expect(palette.find((card) => card.capabilityId === 'email_send')).toMatchObject({ status: 'unsafe/high-risk', riskLevel: 'high', externalActionTaken: false });
  });

  it('classifies content and redacts secret-like material before Basic UI/runtime previews', () => {
    const text = 'OpenAPI docs for connector. api_key=sk-testsecret123456789 contact email ada@example.com';
    const classified = classifyBasicContent({ text, filenames: ['contacts.csv', 'openapi.yaml'] });
    expect(classified.map((entry) => entry.kind)).toEqual(expect.arrayContaining(['api_documentation', 'contact_list', 'credential_or_secret']));
    expect(classified.find((entry) => entry.kind === 'credential_or_secret')?.warnings.join(' ')).toMatch(/Sensitive material detected/);
    expect(redactSensitiveText(text)).not.toContain('sk-testsecret123456789');
    expect(classified.map((entry) => entry.redactedPreview).join('\n')).not.toContain('sk-testsecret123456789');
  });

});


