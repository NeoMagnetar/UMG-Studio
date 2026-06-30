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
import { normalizeCompilerResponseToManifest } from '../lib/umg/umgCompilerAdapter';
import { architectureModeLabels } from '../lib/umg/sleeveArchitectTypes';
import { normalizeLegacyMoltRole, parseLegacyMarkdownSleeve } from '../lib/umg/legacySleeveImport';

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
});

