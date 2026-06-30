import type { BusinessInput, BusinessMap } from './businessIntakeTypes';
import type { GeneratedBlockDraft } from './blockMatchingTypes';
import type { MOLTRole } from './types';
import { searchBlocksForArchitectPlan } from './semanticBlockSearch';
import type { BuildSleeveArchitectPlanInput, SleeveArchitectPlan, SleeveArchitectureMode } from './sleeveArchitectTypes';
import { defaultArchitectExecutionPolicy } from './sleeveArchitectExecution';
import { normalizeLegacyMoltRole } from './legacySleeveImport';

const coreRoles: MOLTRole[] = ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];

const ecommerceStacks = [
  ['return_intake', 'Return Intake & Eligibility Stack', 'Captures return requests and determines whether a return path should open.'],
  ['purchase_validation', 'Purchase Validation Stack', 'Validates order, customer, item, and purchase record facts before any refund decision.'],
  ['refund_decision', 'Refund Decision & Approval Stack', 'Applies policy, routes approvals, and separates eligible from risky return decisions.'],
  ['customer_communication', 'Customer Communication Stack', 'Drafts customer replies, instructions, and status updates.'],
  ['inventory_restock', 'Inventory / Restock Coordination Stack', 'Coordinates item return, restock queue updates, and condition tracking.'],
  ['payment_refund', 'Payment / Refund Preparation Stack', 'Prepares refund or store-credit actions without directly executing payment tools.'],
  ['fraud_policy_risk', 'Fraud / Policy Risk Review Stack', 'Surfaces suspicious patterns, policy exceptions, and manual review needs.'],
  ['reporting_audit', 'Reporting & Audit Trail Stack', 'Logs decisions, produces metrics, and preserves reviewable audit output.']
] as const;

const genericStacks = [
  ['intake', 'Intake & Context Stack', 'Captures the user situation, actors, source data, and initial constraints.'],
  ['validation', 'Validation & Eligibility Stack', 'Checks requirements, prerequisites, policies, and available evidence.'],
  ['planning', 'Decision Planning Stack', 'Coordinates decisions, priorities, and route selection.'],
  ['communication', 'Communication & Response Stack', 'Drafts messages, summaries, and reviewable outputs.'],
  ['execution_prep', 'Execution Preparation Stack', 'Prepares actions and tool requests without executing them.'],
  ['risk', 'Risk & Approval Stack', 'Identifies sensitive steps, approval points, and blocked routes.'],
  ['feedback', 'Feedback & Iteration Stack', 'Handles corrections, updates, and follow-up loops.'],
  ['audit', 'Reporting & Audit Stack', 'Captures final outputs, logs, and status reports.']
] as const;

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 64) || 'custom_sleeve';
}

function titleCase(value: string) {
  return value.split(/\s+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}

function combinedText(input: BusinessInput) {
  return [input.text, ...input.documents.map((doc) => doc.text), input.rawQuickChip].filter(Boolean).join('\n');
}

function detectDomain(text: string, map: BusinessMap) {
  const lower = text.toLowerCase();
  if (/return|refund|e-?commerce|online retail|order|purchase/.test(lower)) return 'ecommerce return and refund orchestration';
  return map.inferredIndustry || 'custom workflow architecture';
}

function buildToolNeeds(text: string, input: BusinessInput) {
  const lower = text.toLowerCase();
  const declared = new Map<string, string>();
  const add = (capability: string, whyDeclared: string) => declared.set(capability, whyDeclared);
  if (/order|purchase/.test(lower)) add('order_lookup', 'Needed to validate purchase/order records before any return or refund decision.');
  if (/message|reply|customer|email/.test(lower)) add('customer_message_draft', 'Needed to draft reviewable customer communications without auto-sending.');
  if (/refund|payment|credit/.test(lower)) add('refund_prepare_or_request', 'Needed to prepare refund/store-credit requests without executing payment actions.');
  if (/inventory|restock|item/.test(lower)) add('inventory_update_request', 'Needed to prepare restock/inventory update requests for review.');
  if (/audit|log|record/.test(lower)) add('audit_log_write', 'Needed to write reviewable audit records after approval.');
  if (/report|metrics|dashboard/.test(lower)) add('report_generate', 'Needed to generate return/refund metrics and status reports.');
  if (/return|refund|e-?commerce|online retail/.test(lower)) {
    add('inventory_update_request', 'Needed to prepare restock/inventory update requests for review.');
    add('report_generate', 'Needed to generate return/refund metrics and status reports.');
  }
  input.toolsAvailable.forEach((tool) => add(tool.name.replace(/\s+/g, '_').toLowerCase(), tool.capability));
  return Array.from(declared.entries()).map(([capability, whyDeclared], index) => ({ id: `tool_capability_${index + 1}`, capability, whyDeclared, executionEnabled: false as const }));
}

function extractList(text: string, fallback: string[], keywords: RegExp) {
  const fragments = text.split(/[.\n;]+/).map((part) => part.trim()).filter((part) => part.length > 8 && keywords.test(part));
  return Array.from(new Set([...fragments.slice(0, 6), ...fallback])).slice(0, 8);
}

function draft(id: string, blockType: GeneratedBlockDraft['blockType'], title: string, summary: string, proposedParent: string, role?: GeneratedBlockDraft['role']): GeneratedBlockDraft {
  return {
    id,
    blockType,
    role,
    title,
    summary,
    body: summary,
    tags: ['architect_mode', 'draft_only', ...title.toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 3).slice(0, 6)],
    sourceReason: 'Generated by Phase 13A Architect Mode as a reviewable draft-only missing capability.',
    proposedParent,
    saveState: 'draft',
    confidence: 0.72,
    needsUserReview: true,
    accepted: false,
    defaultState: 'off',
    metadata: { draftOnly: true, sourceLibraryWrite: false, architectMode: true }
  };
}

export function shouldUseArchitectMode(input: BusinessInput, businessMap: BusinessMap): boolean {
  const text = combinedText(input);
  if (input.rawQuickChip === 'Business Automation' && text.trim().length < 120) return false;
  return text.trim().length >= 80 || businessMap.recurringWorkflows.length > 0;
}

export function buildSleeveArchitectPlan(args: BuildSleeveArchitectPlanInput): SleeveArchitectPlan {
  const text = combinedText(args.businessInput);
  const domainSummary = detectDomain(text, args.businessMap);
  const ecommerce = /return|refund|e-?commerce|online retail|purchase|order/.test(text.toLowerCase());
  const seed = ecommerce ? ecommerceStacks : genericStacks;
  const mode: SleeveArchitectureMode = args.mode ?? (shouldUseArchitectMode(args.businessInput, args.businessMap) ? 'architect_mode' : 'demo_template_mode');
  const title = ecommerce ? 'Customer Return & Refund Orchestration Sleeve' : `${titleCase(domainSummary)} Sleeve`;
  const sleeveSlug = slug(title);
  const semanticTags = Array.from(new Set([domainSummary, ...args.businessMap.coreOperations, ...args.businessMap.automationCandidates, ...args.businessMap.externalTools, ...args.businessMap.outputsNeeded].flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/)).filter((value) => value.length > 2))).slice(0, 24);
  const searchQueries = [title, domainSummary, ...seed.map((stack) => stack[1]), ...args.businessMap.recurringWorkflows.map((workflow) => workflow.title)].slice(0, 12);
  const matched = searchBlocksForArchitectPlan({ blocks: args.availableBlocks, queries: searchQueries, tags: semanticTags, preferredRoles: coreRoles, limit: 12 });
  const proposedNeoStacks = seed.map(([id, stackTitle, reason], index) => ({ id: `draft.stack.${sleeveSlug}.${id}`, title: stackTitle, reason, semanticTags: semanticTags.slice(0, 8), draftOnly: mode !== 'demo_template_mode' || true }));
  const blockTitles = ecommerce ? [
    ['return_intake', 'Capture Return Request', 'Collect customer, order, item, reason, and timing details.'],
    ['purchase_validation', 'Validate Order / Purchase Record', 'Confirm purchase record, customer identity, item, and fulfillment facts.'],
    ['purchase_validation', 'Check Return Window', 'Check timing eligibility against return policy.'],
    ['refund_decision', 'Inspect Refund Policy Rules', 'Apply return/refund rules and exceptions.'],
    ['refund_decision', 'Evaluate Condition / Reason Code', 'Assess reason code, item condition, and policy implications.'],
    ['fraud_policy_risk', 'Route Approval If High Risk', 'Escalate high-risk, high-value, or suspicious cases.'],
    ['customer_communication', 'Draft Customer Return Instructions', 'Produce reviewable customer instructions and reply copy.'],
    ['payment_refund', 'Prepare Refund or Store Credit Action', 'Prepare but do not execute refund/store-credit action.'],
    ['inventory_restock', 'Update Inventory / Restock Queue', 'Prepare inventory/restock queue update request.'],
    ['reporting_audit', 'Log Audit Trail', 'Persist reviewable decision, policy, and action log.'],
    ['reporting_audit', 'Generate Return Metrics', 'Summarize return/refund metrics for reporting.']
  ] : seed.map(([id, title, reason]) => [id, title.replace('Stack', 'Coordinator'), reason]);
  const proposedNeoBlocks = blockTitles.map(([stackKey, blockTitle, purpose], index) => {
    const stack = proposedNeoStacks.find((candidate) => candidate.id.includes(`.${stackKey}`)) ?? proposedNeoStacks[index % proposedNeoStacks.length];
    return { id: `draft.neoblock.${sleeveSlug}.${slug(blockTitle)}`, title: blockTitle, parentNeoStackId: stack.id, purpose, requiredMoltRoles: ['directive', 'instruction', 'subject', 'primary', 'blueprint'] as MOLTRole[], draftOnly: true };
  });
  const proposedMoltBlocks = proposedNeoBlocks.flatMap((block) => block.requiredMoltRoles.map((role) => ({
    id: `draft.molt.${slug(block.title)}.${role}`,
    title: `${block.title} ${titleCase(role)}`,
    role,
    parentNeoBlockId: block.id,
    summary: `${titleCase(role)} content needed for ${block.title}.`,
    draftOnly: true,
    matchedExistingBlockId: matched.find((match) => match.role === role)?.blockId
  })));
  const gates = ecommerce ? [
    ['return_eligibility', 'Return Eligibility Gate', 'Capture Return Request'],
    ['purchase_validation', 'Purchase Validation Gate', 'Validate Order / Purchase Record'],
    ['approval_required', 'Approval Required Gate', 'Route Approval If High Risk'],
    ['refund_execution', 'Refund Execution Gate', 'Prepare Refund or Store Credit Action'],
    ['fraud_risk', 'Fraud/Risk Review Gate', 'Route Approval If High Risk']
  ] : proposedNeoBlocks.slice(0, 5).map((block, index) => [`gate_${index + 1}`, `${block.title} Gate`, block.title]);
  const proposedGates = gates.map(([id, gateTitle, controlledTitle]) => ({
    id: `draft.gate.${sleeveSlug}.${id}`,
    title: gateTitle,
    controlledNeoBlockId: proposedNeoBlocks.find((block) => block.title === controlledTitle)?.id,
    reason: 'Gate/control record declared for routing, validation, approval, or safety; not a MOLT prompt block.',
    draftOnly: true
  }));
  const toolNeeds = buildToolNeeds(text, args.businessInput);
  const missingCapabilities = Array.from(new Set([
    ...toolNeeds.map((tool) => tool.capability),
    ...proposedNeoBlocks.filter((block) => !matched.some((match) => block.title.toLowerCase().includes(match.title.toLowerCase()))).slice(0, 6).map((block) => block.title)
  ]));
  const generatedDrafts = [
    ...proposedNeoStacks.slice(0, 3).map((stack, index) => draft(`draft_arch_stack_${index + 1}`, 'neostack', stack.title, stack.reason, title)),
    ...proposedNeoBlocks.slice(0, 6).map((block, index) => draft(`draft_arch_block_${index + 1}`, 'neoblock', block.title, block.purpose, block.parentNeoStackId)),
    ...proposedMoltBlocks.slice(0, 8).map((molt, index) => draft(`draft_arch_molt_${index + 1}`, 'molt', molt.title, molt.summary, molt.parentNeoBlockId, molt.role as GeneratedBlockDraft['role'])),
    ...proposedGates.slice(0, 5).map((gate, index) => draft(`draft_arch_gate_${index + 1}`, 'gate', gate.title, gate.reason, gate.controlledNeoBlockId ?? title))
  ];
  const executionRoute = mode === 'demo_template_mode' ? 'load_existing_sleeve' as const : matched.length ? 'modify_existing_sleeve' as const : 'create_new_sleeve' as const;
  return {
    id: `architect_plan_${Date.now()}`,
    mode,
    executionRoute,
    executionPolicy: defaultArchitectExecutionPolicy,
    sourcePrompt: args.businessInput.text,
    uploadedContextSummary: args.businessInput.documents.length ? `${args.businessInput.documents.length} uploaded/pasted context item(s) captured locally.` : 'No uploaded context parsed yet.',
    requestedAgentType: args.businessInput.requestedAgentType,
    domainSummary,
    userGoal: args.businessInput.goals[0] ?? args.businessInput.text,
    extractedWorkflow: args.businessMap.recurringWorkflows.map((workflow) => workflow.title).concat(proposedNeoStacks.slice(0, 4).map((stack) => stack.title)).slice(0, 8),
    actors: extractList(text, ['customer', 'support agent', 'manager/reviewer'], /customer|agent|manager|approver|staff|operator|admin/i),
    dataSources: extractList(text, args.businessMap.dataSources, /order|purchase|record|policy|inventory|customer|database|crm|shopify|stripe/i),
    toolCapabilityNeeds: toolNeeds,
    approvalPoints: extractList(text, args.businessMap.approvalPoints, /approval|approve|review|risk|high value|manual/i),
    riskPoints: extractList(text, args.businessMap.complianceOrSafetyConstraints, /fraud|risk|policy|eligibility|payment|refund|privacy|compliance/i),
    expectedOutputs: extractList(text, args.businessMap.outputsNeeded, /reply|summary|report|refund|instructions|audit|metrics|output/i),
    proposedSleeveId: `draft.sleeve.${sleeveSlug}.v1`,
    proposedSleeveTitle: title,
    proposedGovernancePrimaries: ecommerce ? ['Customer fairness', 'Policy compliance', 'Refund safety', 'Auditability'] : ['Goal fidelity', 'Reviewability', 'Safety', 'Traceability'],
    proposedNeoStacks,
    proposedNeoBlocks,
    proposedMoltBlocks,
    proposedGates,
    matchedExistingBlocks: matched.map(({ block: _block, explanation: _explanation, ...match }) => match),
    semanticSearchQueries: searchQueries,
    semanticTags,
    missingCapabilities,
    generatedDrafts,
    legacyRoleMappings: ['TRG', 'STRAT', 'AIM', 'NEED', 'USE', 'DIR', 'INST', 'SUBJ', 'PHIL', 'BP', 'PRIM'].map(normalizeLegacyMoltRole),
    confidence: Number(Math.min(0.86, Math.max(0.54, args.businessMap.confidence + (matched.length ? 0.08 : 0))).toFixed(2)),
    warnings: [
      mode === 'demo_template_mode' ? 'Current public demo is Seed Template Mode; it proves runtime but is not a fully custom Sleeve.' : 'Architect Plan is execution-ready as runtime-session architecture; optional review does not block compile/run.',
      'Search is currently limited to loaded/local blocks.',
      'No source library writes are performed.',
      'Tool capabilities are passed to Hermes as capability declarations; configured non-destructive tools may run, irreversible actions require confirmation.'
    ]
  };
}
