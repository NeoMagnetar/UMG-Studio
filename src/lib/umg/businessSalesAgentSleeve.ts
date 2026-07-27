import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import { normalizeMoltJsonSchema } from './hermesCustomSleeveGeneration';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve } from './templateSleeveStructures';
import type { UmgLibraryCandidate, UmgLibraryCandidatesByRole, UmgLibraryCandidateRoleBucket } from './umgLibraryCandidateRetrieval';
import { summarizeUmgLibraryCandidates, umgLibraryIndexInfo } from './umgLibraryCandidateRetrieval';
import { parseWorkflowIntent } from './umgWorkflowIntent';

export type BusinessSalesAgentSleeveInput = {
  sourcePrompt: string;
  retrievedLibraryCandidates?: UmgLibraryCandidate[];
  candidatesByRole?: UmgLibraryCandidatesByRole;
  missingRoles?: UmgLibraryCandidateRoleBucket[];
  rejectedCandidateIds?: string[];
  uploadedContext?: string;
  generationFailureReason?: string;
  requestId?: string;
};

type SalesBlockSpec = {
  id: string;
  stackId: string;
  title: string;
  description: string;
  gateIds?: string[];
};

const moltRoles: Array<NormalizedTemplateMoltBlock['role']> = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];

const stackSpecs = [
  { id: 'BSA.STACK.CUSTOMER_INTAKE', title: 'CUSTOMER_INTAKE_STACK', description: 'Welcome dealership shoppers, disclose assistant scope, and capture contact/intake details.' },
  { id: 'BSA.STACK.VEHICLE_NEEDS_DISCOVERY', title: 'VEHICLE_NEEDS_DISCOVERY_STACK', description: 'Discover buyer intent, budget, vehicle preferences, and new/used/certified filters.' },
  { id: 'BSA.STACK.INVENTORY_MATCHING', title: 'INVENTORY_MATCHING_STACK', description: 'Plan inventory matching and test-drive recommendations while treating live inventory lookup as optional/missing until tool blocks exist.' },
  { id: 'BSA.STACK.FINANCING_AND_TRADE_IN', title: 'FINANCING_AND_TRADE_IN_STACK', description: 'Collect financing and trade-in inquiry details without making approval, valuation, or lending claims.' },
  { id: 'BSA.STACK.APPOINTMENT_SCHEDULING', title: 'APPOINTMENT_SCHEDULING_STACK', description: 'Plan test-drive, call-back, and showroom appointment requests; calendar booking requires a connector.' },
  { id: 'BSA.STACK.LEAD_CAPTURE_CRM_HANDOFF', title: 'LEAD_CAPTURE_AND_CRM_HANDOFF_STACK', description: 'Prepare lead records and concise sales-rep handoff summaries; CRM writes require declared capabilities.' },
  { id: 'BSA.STACK.FOLLOW_UP_MESSAGING', title: 'FOLLOW_UP_MESSAGING_STACK', description: 'Draft follow-up message plans for SMS/email without sending messages unless messaging tools are attached.' },
  { id: 'BSA.STACK.HUMAN_ESCALATION', title: 'HUMAN_ESCALATION_STACK', description: 'Escalate pricing, legal, financing, availability, and high-intent buyer cases to dealership staff.' },
  { id: 'BSA.STACK.COMPLIANCE_AND_SAFETY', title: 'COMPLIANCE_AND_SAFETY_STACK', description: 'Apply compliance boundaries for financing, trade-in, privacy, disclosures, and non-deceptive sales guidance.' },
  { id: 'BSA.STACK.RUNTIME_OBSERVER', title: 'RUNTIME_OBSERVER_STACK', description: 'Report compile readiness, missing tools, and runtime trace state for the generated Sleeve.' }
] as const;

const blockSpecs: SalesBlockSpec[] = [
  { id: 'BSA.BLOCK.CUSTOMER_GREETING_AND_DISCLOSURE', stackId: 'BSA.STACK.CUSTOMER_INTAKE', title: 'CUSTOMER_GREETING_AND_DISCLOSURE', description: 'Greet the shopper, identify dealership sales-bot scope, and disclose that live pricing/inventory/financing require dealership systems.', gateIds: ['BSA.GATE.COMPLIANCE_APPROVAL_GATE'] },
  { id: 'BSA.BLOCK.CONTACT_INFO_CAPTURE', stackId: 'BSA.STACK.CUSTOMER_INTAKE', title: 'CONTACT_INFO_CAPTURE', description: 'Capture name, phone/email, location, preferred contact channel, and consent hints for dealership follow-up.' },
  { id: 'BSA.BLOCK.BUYER_INTENT_CLASSIFIER', stackId: 'BSA.STACK.VEHICLE_NEEDS_DISCOVERY', title: 'BUYER_INTENT_CLASSIFIER', description: 'Classify shopper intent: browse, buy now, test drive, financing, trade-in, service question, or human sales rep.' },
  { id: 'BSA.BLOCK.BUDGET_RANGE_DISCOVERY', stackId: 'BSA.STACK.VEHICLE_NEEDS_DISCOVERY', title: 'BUDGET_RANGE_DISCOVERY', description: 'Ask budget range, payment preference, timeline, and constraints without claiming credit approval.' },
  { id: 'BSA.BLOCK.VEHICLE_PREFERENCE_DISCOVERY', stackId: 'BSA.STACK.VEHICLE_NEEDS_DISCOVERY', title: 'VEHICLE_PREFERENCE_DISCOVERY', description: 'Collect vehicle type, make/model, trim, must-have features, mileage tolerance, and usage needs.' },
  { id: 'BSA.BLOCK.NEW_USED_CERTIFIED_FILTER', stackId: 'BSA.STACK.VEHICLE_NEEDS_DISCOVERY', title: 'NEW_USED_CERTIFIED_FILTER', description: 'Distinguish new, used, certified pre-owned, lease, and purchase preferences.' },
  { id: 'BSA.BLOCK.INVENTORY_MATCH_PLANNER', stackId: 'BSA.STACK.INVENTORY_MATCHING', title: 'INVENTORY_MATCH_PLANNER', description: 'Plan matching against available inventory and alternatives; live lookup remains a missing optional capability.', gateIds: ['BSA.GATE.TOOL_AVAILABILITY_GATE'] },
  { id: 'BSA.BLOCK.TEST_DRIVE_OFFER_BUILDER', stackId: 'BSA.STACK.INVENTORY_MATCHING', title: 'TEST_DRIVE_OFFER_BUILDER', description: 'Build a test-drive offer or next-step recommendation based on shopper needs and available appointment path.' },
  { id: 'BSA.BLOCK.FINANCING_PREQUALIFICATION_INTAKE', stackId: 'BSA.STACK.FINANCING_AND_TRADE_IN', title: 'FINANCING_PREQUALIFICATION_INTAKE', description: 'Collect non-sensitive financing inquiry intent and route actual qualification to approved dealership/lender processes.', gateIds: ['BSA.GATE.COMPLIANCE_APPROVAL_GATE'] },
  { id: 'BSA.BLOCK.TRADE_IN_INFO_CAPTURE', stackId: 'BSA.STACK.FINANCING_AND_TRADE_IN', title: 'TRADE_IN_INFO_CAPTURE', description: 'Collect trade-in make/model/year/mileage/condition and mark valuation API or staff appraisal as required capability.' },
  { id: 'BSA.BLOCK.APPOINTMENT_REQUEST_HANDLER', stackId: 'BSA.STACK.APPOINTMENT_SCHEDULING', title: 'APPOINTMENT_REQUEST_HANDLER', description: 'Gather date/time preference for test drive, call, showroom visit, or financing appointment; calendar write is optional/missing.', gateIds: ['BSA.GATE.TOOL_AVAILABILITY_GATE'] },
  { id: 'BSA.BLOCK.SALES_REP_HANDOFF_SUMMARY', stackId: 'BSA.STACK.LEAD_CAPTURE_CRM_HANDOFF', title: 'SALES_REP_HANDOFF_SUMMARY', description: 'Summarize buyer profile, desired vehicle, budget, urgency, objections, and requested next action for a human rep.', gateIds: ['BSA.GATE.HUMAN_ESCALATION_GATE'] },
  { id: 'BSA.BLOCK.CRM_LEAD_RECORD_PLANNER', stackId: 'BSA.STACK.LEAD_CAPTURE_CRM_HANDOFF', title: 'CRM_LEAD_RECORD_PLANNER', description: 'Prepare CRM lead field mapping without writing CRM records unless a CRM capability exists.', gateIds: ['BSA.GATE.TOOL_AVAILABILITY_GATE'] },
  { id: 'BSA.BLOCK.FOLLOW_UP_MESSAGE_BUILDER', stackId: 'BSA.STACK.FOLLOW_UP_MESSAGING', title: 'FOLLOW_UP_MESSAGE_BUILDER', description: 'Draft follow-up SMS/email scripts for inventory matches, appointments, missing info, and human handoff; sending requires messaging tools.' },
  { id: 'BSA.BLOCK.HUMAN_ESCALATION_GATE', stackId: 'BSA.STACK.HUMAN_ESCALATION', title: 'HUMAN_ESCALATION_GATE', description: 'Route high-intent, pricing, complaint, legal, financing, availability, and policy-sensitive cases to dealership staff.', gateIds: ['BSA.GATE.HUMAN_ESCALATION_GATE'] },
  { id: 'BSA.BLOCK.COMPLIANCE_BOUNDARY_CHECKER', stackId: 'BSA.STACK.COMPLIANCE_AND_SAFETY', title: 'COMPLIANCE_BOUNDARY_CHECKER', description: 'Prevent deceptive pricing, unsupported financing promises, privacy violations, and unsafe data collection.', gateIds: ['BSA.GATE.COMPLIANCE_APPROVAL_GATE'] },
  { id: 'BSA.BLOCK.RUNTIME_TRACE_REPORTER', stackId: 'BSA.STACK.RUNTIME_OBSERVER', title: 'RUNTIME_TRACE_REPORTER', description: 'Report deterministic fallback route, missing capabilities, compile eligibility, and runtime trace readiness.' }
];

function nlCardFor(title: string, role: string, content: string, tags: string[]) {
  return { title, role, category: 'deterministic_business_sales_agent', tags, description: content, content };
}

function schemaFor(kind: string, title: string) {
  return { type: 'object', required: ['id', 'title', 'content'], properties: { id: { type: 'string' }, title: { type: 'string', const: title }, content: { type: 'string' }, kind: { type: 'string', const: kind } } };
}

function moltFor(block: SalesBlockSpec, role: NormalizedTemplateMoltBlock['role'], roleIndex: number, globalIndex: number): NormalizedTemplateMoltBlock {
  const title = `${block.title} ${role.toUpperCase()}`;
  const tags = ['business-sales-agent', 'automotive-dealership', 'car-dealership', 'sales-bot', 'runtime-session', role];
  const content = `${block.description} Role: ${role}. This deterministic runtime-session draft supports an automotive dealership sales bot without external tool requirements; missing inventory, CRM, calendar, messaging, financing, and trade-in systems are warnings/capabilities-needed, not compile blockers.`;
  const base = {
    id: `${block.id}.MOLT.${role.toUpperCase()}.${roleIndex + 1}`,
    title,
    role,
    content,
    description: content,
    tags,
    parentNeoBlockId: block.id,
    parentNeoStackId: block.stackId,
    stackOrder: globalIndex,
    sourceKind: 'runtime-session draft' as const,
    blockType: 'molt' as const,
    defaultState: 'off' as const,
    generationReason: `Deterministic business_sales_agent fallback generated this ${role} MOLT because no declared tools or verified source-library binding are required for compile eligibility.`
  };
  return { ...base, nlCard: nlCardFor(title, role, content, tags), jsonSchema: normalizeMoltJsonSchema(base) };
}

function gateRecord(id: string, title: string, blockId: string, conditionText: string, action: UMGGateRecord['action']): UMGGateRecord {
  return { id, title, attachesTo: { kind: 'neoblock', id: blockId }, triggerType: action === 'require_approval' ? 'approval' : 'runtime_condition', conditionText, action, targetIds: [blockId], defaultState: 'closed', runtimeState: 'inactive', tags: ['business-sales-agent', 'automotive-dealership', 'runtime-control', 'gate'], metadata: { promptContent: false, sourceKind: 'runtime-session draft' } };
}

export function buildBusinessSalesAgentSleeve(input: BusinessSalesAgentSleeveInput): NormalizedTemplateSleeve {
  const requestId = input.requestId ?? `business_sales_agent_${Date.now()}`;
  const intent = parseWorkflowIntent(input.sourcePrompt);
  const neoStacks: NormalizedTemplateNeoStack[] = stackSpecs.map((stack, index) => ({
    id: stack.id,
    title: stack.title,
    description: stack.description,
    stackOrder: index + 1,
    tags: ['business-sales-agent', 'automotive-dealership', 'runtime-session'],
    neoBlockIds: blockSpecs.filter((block) => block.stackId === stack.id).map((block) => block.id),
    sourceKind: 'runtime-session draft',
    blockType: 'neostack',
    generationReason: 'Deterministic business_sales_agent fallback stack generated without source-library mutation.',
    nlCard: nlCardFor(stack.title, 'neostack', stack.description, ['business-sales-agent', 'neostack']),
    jsonSchema: schemaFor('neostack', stack.title)
  }));
  const neoBlocks: NormalizedTemplateNeoBlock[] = blockSpecs.map((block, index) => ({
    id: block.id,
    title: block.title,
    description: block.description,
    neoStackId: block.stackId,
    blockOrder: index + 1,
    tags: ['business-sales-agent', 'automotive-dealership', 'runtime-session'],
    moltBlockIds: moltRoles.map((role, roleIndex) => `${block.id}.MOLT.${role.toUpperCase()}.${roleIndex + 1}`),
    gateIds: block.gateIds ?? [],
    defaultState: 'off',
    runtimeState: 'idle',
    sourceKind: 'runtime-session draft',
    blockType: 'neoblock',
    generationReason: 'Deterministic business_sales_agent fallback NeoBlock generated to fill compile-required workflow structure.',
    nlCard: nlCardFor(block.title, 'neoblock', block.description, ['business-sales-agent', 'neoblock']),
    jsonSchema: schemaFor('neoblock', block.title)
  }));
  let globalMoltIndex = 0;
  const moltBlocks = blockSpecs.flatMap((block) => moltRoles.map((role, roleIndex) => moltFor(block, role, roleIndex, ++globalMoltIndex)));
  const gates = [
    gateRecord('BSA.GATE.HUMAN_ESCALATION_GATE', 'HUMAN_ESCALATION_GATE', 'BSA.BLOCK.HUMAN_ESCALATION_GATE', 'Require human dealership staff handoff for pricing exceptions, complaints, legal/financing questions, or high-intent buyers.', 'require_approval'),
    gateRecord('BSA.GATE.COMPLIANCE_APPROVAL_GATE', 'COMPLIANCE_APPROVAL_GATE', 'BSA.BLOCK.COMPLIANCE_BOUNDARY_CHECKER', 'Open only when disclosures, privacy boundaries, financing language, and non-deceptive sales guidance are satisfied.', 'activate'),
    gateRecord('BSA.GATE.TOOL_AVAILABILITY_GATE', 'TOOL_AVAILABILITY_GATE', 'BSA.BLOCK.CRM_LEAD_RECORD_PLANNER', 'Treat inventory lookup, CRM write, calendar booking, messaging, financing calculator, trade-in valuation, policy source, and human handoff as optional/missing capabilities until tool blocks are declared.', 'activate')
  ];
  const missingCapabilities = [
    'inventory database lookup',
    'CRM write',
    'appointment calendar',
    'SMS/email follow-up',
    'financing calculator/API',
    'trade-in valuation API',
    'dealership policy source',
    'human sales rep handoff'
  ];
  const candidateCount = input.retrievedLibraryCandidates?.length ?? 0;
  const sourceStatusSummary = {
    candidateCount,
    candidatesBoundIntoSleeve: 0,
    runtimeWorkspaceDraftBlocksGenerated: neoStacks.length + neoBlocks.length + moltBlocks.length,
    generatedRuntimeDrafts: moltBlocks.length,
    sourceBindingStatus: 'runtime_draft_fallback_no_source_binding',
    compileEligibility: 'yes',
    reason: 'Recognized automotive dealership sales-agent intent; deterministic runtime/workspace draft blocks fill required structure. Source-library binding and declared tools are optional for compile eligibility.',
    libraryIndex: { moltBlocks: umgLibraryIndexInfo.counts?.molt ?? 0, neoBlocks: umgLibraryIndexInfo.counts?.neoblock ?? 0, neoStacks: umgLibraryIndexInfo.counts?.neostack ?? 0, metaMoltToolBlocks: 0 }
  };
  return {
    id: `SLV.BSA.AUTOMOTIVE_DEALERSHIP.${requestId}`,
    title: 'Automotive Dealership Sales Bot Sleeve',
    version: '1.0.0',
    description: 'Deterministic compile-eligible UMG Sleeve for a car dealership sales bot. It handles lead intake, customer qualification, vehicle matching, appointment scheduling, CRM handoff, follow-up messaging, human escalation, compliance boundaries, and runtime observation without requiring external tools at generation time.',
    isTemplate: true,
    templateKind: 'custom',
    source: 'session',
    tags: ['business-sales-agent', 'automotive-dealership', 'car-dealership', 'sales-bot', 'deterministic-fallback', 'runtime-session'],
    neoStacks,
    neoBlocks,
    moltBlocks,
    gates,
    governanceBlockIds: gates.map((gate) => gate.id),
    defaultExecutionMode: 'approvalRequired',
    metadata: {
      requestId,
      sourcePrompt: input.sourcePrompt,
      uploadedContext: input.uploadedContext,
      workflowIntent: intent,
      workflowIntentName: 'business_sales_agent',
      workflowIntentSubtype: 'automotive_dealership_sales_agent',
      inferredIndustry: 'automotive retail / car dealership',
      coreOperations: ['lead intake', 'customer qualification', 'vehicle matching', 'appointment scheduling', 'CRM handoff', 'follow-up messaging'],
      generationRoute: 'deterministic_business_sales_agent',
      deterministicFallbackUsed: 'business_sales_agent',
      fallbackUsed: true,
      fallbackReason: 'recognized automotive_dealership_sales_agent prompt; deterministic runtime/workspace draft fallback is compile-eligible without live Hermes or declared tools',
      hermesEnhancementFailed: Boolean(input.generationFailureReason),
      hermesEnhancementWarning: input.generationFailureReason ? `Hermes enhancement failed: ${input.generationFailureReason}` : undefined,
      liveHermesGenerated: false,
      generatedByHermes: false,
      noFakeLiveHermesGeneration: true,
      noFakeHermesOutput: true,
      noFakeSourceBinding: true,
      sourceLibraryWrite: false,
      protectedSourceLibraryWrite: false,
      compileEligible: true,
      compileEligibility: 'yes',
      libraryCandidateSummary: summarizeUmgLibraryCandidates(input.retrievedLibraryCandidates ?? [], input.candidatesByRole),
      libraryCandidates: (input.retrievedLibraryCandidates ?? []).slice(0, 24),
      candidatesByRole: input.candidatesByRole ?? {},
      missingRoles: input.missingRoles ?? [],
      rejectedCandidateIds: input.rejectedCandidateIds ?? [],
      generatedDrafts: [...neoStacks.map((stack) => stack.id), ...neoBlocks.map((block) => block.id), ...moltBlocks.map((block) => block.id)],
      sourceStatusSummary,
      missingCapabilities,
      capabilitiesNeeded: missingCapabilities,
      capabilities: [],
      noDeclaredToolsStillGenerated: true,
      toolAvailabilityMessage: 'Generated without external tools. Runtime can plan the workflow, but inventory lookup, CRM updates, scheduling, and messaging need tool blocks/capabilities.',
      warnings: [
        'Deterministic fallback used: business_sales_agent / automotive_dealership_sales_agent.',
        ...(input.generationFailureReason ? [`Hermes enhancement failed: ${input.generationFailureReason}; warning only.`] : []),
        'Generated without external tools. Runtime can plan the workflow, but inventory lookup, CRM updates, scheduling, and messaging need tool blocks/capabilities.',
        'No source-library candidates were claimed as bound; all generated structure is runtime-session draft content.'
      ]
    }
  };
}
