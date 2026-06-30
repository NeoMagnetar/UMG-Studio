import { describe, expect, it } from 'vitest';
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
import { buildHermesToolCapabilityRegistry } from '../lib/umg/hermesToolCapabilityRegistry';
import { validateArchitectSleeveForCompiler } from '../lib/umg/sleeveArchitectCompilerValidation';
import { normalizeCompilerResponseToManifest } from '../lib/umg/umgCompilerAdapter';
import { architectureModeLabels } from '../lib/umg/sleeveArchitectTypes';
import { normalizeLegacyMoltRole, parseLegacyMarkdownSleeve } from '../lib/umg/legacySleeveImport';
import { buildBasicCapabilityPalette, classifyBasicContent, evaluateBasicSleeveQuality, redactSensitiveText } from '../lib/umg/basicModeScaffolds';

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

  it('packages UMG Runtime Skill knowledge with hierarchy rules, trace schema, and strict JSON envelope', () => {
    const skill = getHermesUmgRuntimeSkillPack();
    expect(skill.id).toBe('umg_runtime_skill_pack.v1');
    expect(skill.instructions).toContain('Sleeve');
    expect(skill.instructions).toContain('NeoStack');
    expect(skill.instructions).toContain('NeoBlock');
    expect(skill.instructions).toContain('MOLT');
    expect(skill.instructions).toContain('Gate/control record');
    expect(skill.traceEventTypes).toEqual(expect.arrayContaining(['run_started', 'tool_call_requires_approval', 'tool_result_received', 'run_completed']));
    expect(skill.outputEnvelopeSchema.required).toEqual(expect.arrayContaining(['traceId', 'status', 'finalOutput', 'events']));
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


