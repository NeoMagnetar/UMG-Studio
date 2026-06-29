import { BusinessMap } from './businessIntakeTypes';
import { UMGGateRecord } from './cognitiveRuntimeTypes';
import { InstantiatedTemplateSleeve, NormalizedTemplateMoltBlock, NormalizedTemplateSleeve } from './templateSleeveStructures';
import { NeoBlock, NeoStack, Sleeve, UMGBlock, UMGControllerBlock } from './types';

export const BUSINESS_AUTOMATION_CORE_SLEEVE_ID = 'sleeve.business_automation_consultant.core.v1';

const stackDefinitions = [["01", "BUSINESS ASSESSMENT & DISCOVERY STACK", "Assess business model, current processes, pain points, automation opportunities, budget/resources, and success metrics.", ["Business Model and Revenue Analysis", "Current Process Documentation", "Pain Point and Bottleneck Identification", "Automation Opportunity Scoring", "Budget and Resource Assessment", "Success Metrics Definition"]], ["02", "AUTOMATION ARCHITECTURE DESIGN STACK", "Plan OpenClaw configuration, multi-agent architecture, tools/channels, skills, integrations, and phased rollout.", ["OpenClaw Configuration Planning", "Multi-Agent Architecture Design", "Tool and Channel Selection", "Skill Requirements Identification", "Integration Point Mapping", "Phased Rollout Planning"]], ["03", "SOCIAL MEDIA AUTOMATION STACK", "Plan sustainable social media automation: content calendar, scheduling, engagement, hashtags/SEO, analytics, and platforms.", ["Content Calendar Management", "Post Scheduling and Publishing", "Engagement Monitoring and Response", "Hashtag and SEO Optimization", "Analytics and Performance Tracking", "Multi-Platform Management"]], ["04", "OPERATIONS & PROCESS AUTOMATION STACK", "Automate inventory, orders, customer communication, invoicing/payment, data entry, and operational reporting.", ["Inventory Management Systems", "Order Processing Workflows", "Customer Communication Automation", "Invoice and Payment Processing", "Data Entry and Record Keeping", "Reporting and Analytics Automation"]], ["05", "SCHEDULING & CALENDAR AUTOMATION STACK", "Automate appointments, calendar sync, reminders/follow-up, resources/staff, meetings, and availability.", ["Appointment Scheduling Systems", "Calendar Management and Sync", "Reminder and Follow-up Automation", "Resource and Staff Scheduling", "Meeting Coordination", "Availability Management"]], ["06", "FINANCIAL AUTOMATION STACK", "Automate expenses, invoices, payment reminders, financial reports, tax organization, and budget alerts.", ["Expense Tracking and Categorization", "Invoice Generation and Sending", "Payment Reminder Automation", "Financial Report Generation", "Tax Document Organization", "Budget Tracking and Alerts"]], ["07", "IMPLEMENTATION & TRAINING STACK", "Implement OpenClaw/UMG setup, prompts, workflows, client training, validation, and handoff/go-live.", ["OpenClaw Installation and Setup", "Custom Prompt Engineering", "Workflow Configuration", "Client Training and Documentation", "Testing and Validation", "Handoff and Go-Live"]], ["08", "MONITORING & OPTIMIZATION STACK", "Track performance, costs, feedback, system health, improvements, and scaling/expansion.", ["Performance Metrics Tracking", "Cost Analysis and Optimization", "Client Feedback Collection", "System Health Monitoring", "Continuous Improvement Identification", "Scaling and Expansion Planning"]]] as const;
const governanceDefinitions = [["PRIM.BIZ.001", "Client Success Over Feature Complexity", "ABSOLUTE RULE: The client must succeed with their automation. Simple working solution > complex perfect system. Start with one painful process automated well. Expand only when they're comfortable. Client adoption = success. Unused features = failure. Practical results > technical elegance."], ["PRIM.BIZ.002", "Cost Consciousness and ROI Focus", "CORE PRINCIPLE: Every automation must save more than it costs. Track time saved vs API costs. Free/cheap solutions first. Scale spending with proven value. Client's budget is sacred. No expensive tools without clear ROI calculation. Value > bells and whistles."], ["PRIM.BIZ.003", "Privacy and Data Security First", "FOUNDATIONAL VALUE: Client data is their livelihood. Never expose customer info. Sandbox untrusted operations. API keys in environment variables. No public channel access without authentication. GDPR/privacy compliance. Data breach = business death. Security > convenience."], ["PRIM.BIZ.004", "Progressive Rollout and Training", "TECHNICAL PRINCIPLE: Don't deploy everything at once. One automation live, working, understood, then next. Train the client thoroughly. Documentation mandatory. Handoff complete before moving on. Rushed deployment = abandonment. Adoption > deployment speed."], ["PRIM.BIZ.005", "Business Domain Understanding Required", "QUALITY PRINCIPLE: Understand their business before automating. What's painful? What's repetitive? Where's the bottleneck? Generic automation fails. Custom fit wins. Ask questions. Shadow workflows. Domain knowledge = better automation."], ["PRIM.BIZ.006", "Sustainable and Maintainable Systems", "MAINTENANCE PRINCIPLE: Client must be able to maintain this without you. Clear documentation. Simple architecture. No magic. Teach them troubleshooting. openclaw doctor is their friend. Self-sufficient client = good client. Dependency = fragility."], ["PRIM.BIZ.007", "Measurable Impact and Reporting", "ACCOUNTABILITY PRINCIPLE: Track what the automation accomplishes. Time saved per week. Revenue impact. Error reduction. Client needs proof of value. Metrics = retention. Vague benefits = cancelled service. Measure > assume."], ["PRIM.BIZ.008", "Ethical Automation Boundaries", "ETHICAL STANDARD: Don't automate away the human touch where it matters. Customer service needs empathy. Social media needs authenticity. Automation supports humans, doesn't replace relationships. Augment > replace. Ethics > efficiency."]] as const;

const stackTags: Record<string, string[]> = {
  '01': ['assessment', 'discovery', 'roi'],
  '02': ['architecture', 'openclaw', 'integrations'],
  '03': ['social-media', 'content', 'calendar'],
  '04': ['operations', 'inventory', 'orders', 'invoicing'],
  '05': ['scheduling', 'calendar', 'appointments'],
  '06': ['financial', 'payments', 'bookkeeping'],
  '07': ['implementation', 'training', 'handoff'],
  '08': ['monitoring', 'optimization', 'metrics']
};

const subjectDomains: Record<string, Array<[string, string, string]>> = {
  '01': [
    ['SUBJ.BIZ.001', 'Small Business Discovery Fundamentals', 'Small business discovery maps revenue model, customer flow, current process burden, staff capacity, bottlenecks, and measurable outcomes before any automation is proposed.'],
    ['SUBJ.BIZ.002', 'Automation Opportunity Assessment', 'Automation opportunity assessment ranks repetitive, error-prone, high-volume, and measurable workflows before low-value novelty automation.'],
    ['SUBJ.BIZ.003', 'ROI and Success Metric Basics', 'ROI and success metrics connect automation work to time saved, revenue impact, error reduction, customer response speed, and adoption.']
  ],
  '02': [
    ['SUBJ.ARCH.001', 'OpenClaw/UMG Architecture Fundamentals', 'Architecture planning defines agents, tools, channels, skills, integrations, governance, rollout order, and support boundaries before implementation.'],
    ['SUBJ.ARCH.002', 'Tool and Channel Fit', 'Tool and channel fit selects only the systems the client can authorize, maintain, and benefit from using.'],
    ['SUBJ.ARCH.003', 'Phased Rollout Discipline', 'Phased rollout sequences the smallest useful automation first, validates adoption, then expands with measured confidence.']
  ],
  '03': [
    ['SUBJ.SOCIAL.001', 'Social Media Automation Fundamentals', 'Social media automation covers platform-specific posting patterns, content pillars, 80/20 value-to-promotion balance, engagement timing, hashtag relevance, voice consistency, automation boundaries, and performance metrics. Automate mechanics such as scheduling and analytics; preserve authentic human engagement.'],
    ['SUBJ.SOCIAL.002', 'Platform and Engagement Context', 'Each social platform has different cadence, format, and engagement expectations; automation should support human reply workflows rather than impersonate relationships.'],
    ['SUBJ.SOCIAL.003', 'Analytics and Content Learning Loop', 'Social content automation needs weekly learning from reach, engagement, saves, clicks, comments, and client capacity so the calendar improves over time.']
  ],
  '04': [
    ['SUBJ.OPS.001', 'Operational Process Automation', 'Operations automation targets inventory, orders, customer communications, invoices, records, and reports where repetitive work causes delay or errors.'],
    ['SUBJ.OPS.002', 'Customer Communication Flow', 'Customer communication automation should accelerate updates, reminders, summaries, and handoffs while preserving human escalation points.'],
    ['SUBJ.OPS.003', 'Operational Reporting Context', 'Operational reporting turns records, orders, payments, and service activity into simple summaries that owners can act on.']
  ],
  '05': [
    ['SUBJ.SCHED.001', 'Scheduling Automation Fundamentals', 'Scheduling automation coordinates appointments, calendars, reminders, follow-ups, staff, resources, and availability without creating conflicts.'],
    ['SUBJ.SCHED.002', 'Reminder and Follow-up Patterns', 'Reminder automation reduces no-shows and missed follow-ups when timing, channel, and consent are explicit.'],
    ['SUBJ.SCHED.003', 'Availability and Resource Constraints', 'Availability automation must respect working hours, travel time, staffing, equipment, buffers, and manual override needs.']
  ],
  '06': [
    ['SUBJ.FIN.001', 'Financial Automation Fundamentals', 'Financial automation handles expenses, invoices, payment reminders, reports, tax organization, budget alerts, and auditability with privacy-first controls.'],
    ['SUBJ.FIN.002', 'Cashflow and Payment Workflow', 'Payment workflow automation should improve invoice timing, reminders, reconciliation, and owner visibility without hiding risk.'],
    ['SUBJ.FIN.003', 'Tax and Budget Organization', 'Tax and budget automation organizes categories, documents, alerts, and reports so the business owner can review and approve.']
  ],
  '07': [
    ['SUBJ.IMPL.001', 'Implementation and Client Training', 'Implementation converts the selected automation into configured workflows, prompts, docs, tests, client training, and go-live handoff.'],
    ['SUBJ.IMPL.002', 'Prompt and Workflow Configuration', 'Prompt and workflow configuration should be simple, documented, testable, and easy for the client to adjust later.'],
    ['SUBJ.IMPL.003', 'Validation and Handoff Readiness', 'Validation and handoff prove the automation works, is understood, and can be operated without hidden dependency.']
  ],
  '08': [
    ['SUBJ.MON.001', 'Monitoring and Optimization Fundamentals', 'Monitoring tracks performance, costs, feedback, health, improvement opportunities, and scaling readiness after deployment.'],
    ['SUBJ.MON.002', 'Cost and Impact Review', 'Cost and impact review compares time saved, revenue impact, errors reduced, API/tool cost, and owner satisfaction.'],
    ['SUBJ.MON.003', 'Scaling and Continuous Improvement', 'Scaling expands only after current automations are stable, adopted, measured, and worth maintaining.']
  ]
};

function makeMoltBlock(args: { id: string; title: string; role: UMGBlock['role']; content: string; tags: string[]; parentNeoBlockId?: string; parentNeoStackId?: string; orderIndex?: number }): UMGBlock {
  return {
    id: args.id,
    title: args.title,
    type: 'molt_block',
    role: args.role,
    displayType: args.role,
    content: args.content,
    category: 'business-automation-core',
    tags: ['business-automation', 'template', 'core', args.role, ...args.tags],
    priorityOrder: args.orderIndex,
    hierarchy: { orderIndex: args.orderIndex, orderSource: 'priorityOrder', priorityMeaning: 'hierarchy_order' },
    defaultState: 'off',
    visibility: 'visible',
    activation: { mode: 'gate' },
    sourcePath: `built-in://business-automation-core/${args.id}`,
    sourceLayer: 'AI',
    status: 'runnable',
    presentationStatus: 'runnable',
    source: { origin: 'generated', sourceId: args.id, version: 'business-automation-core.v1' },
    legacy: { original: { parentNeoBlockId: args.parentNeoBlockId, parentNeoStackId: args.parentNeoStackId }, sourcePath: `built-in://business-automation-core/${args.id}` }
  };
}

function makeNormalizedMolt(block: UMGBlock, parentNeoBlockId?: string, parentNeoStackId?: string): NormalizedTemplateMoltBlock {
  return {
    id: block.id,
    sourceId: block.source?.sourceId,
    title: block.title,
    role: block.role === 'trigger' ? 'meta' : block.role,
    content: block.content,
    tags: [...block.tags],
    parentNeoBlockId,
    parentNeoStackId,
    sourceNotes: ['Normalized Business Automation Core content block; TRG source records are represented separately as gates.'],
    defaultState: block.defaultState
  };
}

function makeGate(stackNumber: string, blockNumber: string, neoBlockId: string, title: string, stackTitle: string): UMGGateRecord {
  const id = `GATE.BIZ.${stackNumber}.${blockNumber}`;
  const sequential = String((Number(stackNumber) - 1) * 6 + Number(blockNumber)).padStart(3, '0');
  const conditionText = stackNumber === '03' && blockNumber === '01'
    ? 'Activate when client needs social media automation. Keywords: social media, posting schedule, content calendar, Instagram, Facebook, TikTok, LinkedIn. Essential for consistent online presence.'
    : `Activate when the client request or BusinessMap needs ${title.toLowerCase()} within ${stackTitle.toLowerCase()}. Keywords: ${title.toLowerCase()}, ${stackTags[stackNumber].join(', ')}.`;
  return {
    id,
    sourceId: `TRG.BIZ.${sequential}`,
    title: `${title} Trigger`,
    attachesTo: { kind: 'neoblock', id: neoBlockId },
    triggerType: 'user_intent',
    conditionText,
    action: 'activate',
    targetIds: [neoBlockId],
    defaultState: 'closed',
    runtimeState: 'inactive',
    tags: ['trigger', 'gate', 'business-automation', ...stackTags[stackNumber]],
    metadata: { promptContent: false, normalizedFromTrigger: true, sourceFamily: 'TRG.BIZ', stackNumber, blockNumber }
  };
}

function buildTemplate() {
  const neoStacks = [] as NormalizedTemplateSleeve['neoStacks'];
  const neoBlocks = [] as NormalizedTemplateSleeve['neoBlocks'];
  const moltBlocks = [] as NormalizedTemplateMoltBlock[];
  const gates = [] as UMGGateRecord[];
  const sleeveStacks = [] as NeoStack[];
  const governanceBlocks = governanceDefinitions.map(([id, title, content], index) => makeMoltBlock({ id, title, role: 'primary', content, tags: ['governance', 'primary'], orderIndex: index + 1 }));
  governanceBlocks.forEach((block) => moltBlocks.push(makeNormalizedMolt(block)));

  stackDefinitions.forEach(([stackNumber, stackTitle, stackPurpose, blockTitles], stackIndex) => {
    const stackId = `S.${stackNumber}`;
    const stackBlockIds: string[] = [];
    const sleeveNeoBlocks: NeoBlock[] = [];
    const philosophy = makeMoltBlock({ id: stackNumber === '03' ? 'PHIL.SOCIAL.001' : `PHIL.BIZ.${stackNumber}`, title: stackNumber === '03' ? 'Social Media Automation Philosophy' : `${stackTitle.replace(' STACK', '')} Philosophy`, role: 'philosophy', content: stackNumber === '03' ? 'Social media automation must preserve authenticity. Automate scheduling, formatting, monitoring, and analytics; do not automate away human relationship-building. The goal is to free the client from repetitive posting burden while keeping their voice.' : `Automation in ${stackTitle.toLowerCase()} should prioritize client adoption, clear ownership, measurable improvement, and simple workflows the business can maintain.`, tags: stackTags[stackNumber], parentNeoStackId: stackId, orderIndex: 200 + stackIndex });
    const blueprint = makeMoltBlock({ id: stackNumber === '03' ? 'BP.SOCIAL.001' : `BP.BIZ.${stackNumber}`, title: stackNumber === '03' ? 'Content Calendar Template' : `${stackTitle.replace(' STACK', '')} Blueprint`, role: 'blueprint', content: stackNumber === '03' ? 'Weekly template: Monday educational post, Wednesday behind-the-scenes, Friday customer spotlight, Saturday product/service feature. Client provides inputs; AI assists with captions, formatting, hashtags, scheduling, monitoring, and weekly analytics summary.' : 'Blueprint: assess current state, choose one high-value workflow, define owner approval, configure tool support, test on real examples, document handoff, and review metrics after launch.', tags: stackTags[stackNumber], parentNeoStackId: stackId, orderIndex: 300 + stackIndex });
    moltBlocks.push(makeNormalizedMolt(philosophy, undefined, stackId), makeNormalizedMolt(blueprint, undefined, stackId));
    const subjects = subjectDomains[stackNumber].map(([id, title, content], subjectIndex) => makeMoltBlock({ id, title, role: 'subject', content, tags: stackTags[stackNumber], parentNeoStackId: stackId, orderIndex: 100 + subjectIndex }));
    subjects.forEach((subject) => moltBlocks.push(makeNormalizedMolt(subject, undefined, stackId)));

    blockTitles.forEach((blockTitle, blockIndex) => {
      const blockNumber = String(blockIndex + 1).padStart(2, '0');
      const absoluteIndex = stackIndex * 6 + blockIndex + 1;
      const neoBlockId = `N.BIZ.${stackNumber}.${blockNumber}`;
      stackBlockIds.push(neoBlockId);
      const directive = makeMoltBlock({
        id: stackNumber === '03' && blockNumber === '01' ? 'DIR.BIZ.013' : `DIR.BIZ.${String(absoluteIndex).padStart(3, '0')}`,
        title: stackNumber === '03' && blockNumber === '01' ? 'Establish Sustainable Content Calendar' : `${blockTitle} Directive`,
        role: 'directive',
        content: stackNumber === '03' && blockNumber === '01' ? 'GOAL: Create realistic, maintainable social media schedule. Success means: posts scheduled 1-2 weeks ahead, client can maintain independently, brand voice consistent, engagement tracked. Prioritize sustainability over volume, quality over quantity, and client\'s capacity over ideal frequency.' : `GOAL: Complete ${blockTitle.toLowerCase()} for the client. Success means the current workflow is understood, a practical automation opportunity is documented, client capacity and approval needs are clear, and the next implementation step is measurable.`,
        tags: stackTags[stackNumber], parentNeoBlockId: neoBlockId, parentNeoStackId: stackId, orderIndex: absoluteIndex
      });
      const instruction = makeMoltBlock({
        id: stackNumber === '03' && blockNumber === '01' ? 'INST.SOCIAL.001' : `INST.BIZ.${String(absoluteIndex).padStart(3, '0')}`,
        title: stackNumber === '03' && blockNumber === '01' ? 'Content Calendar Setup Procedure' : `${blockTitle} Procedure`,
        role: 'instruction',
        content: stackNumber === '03' && blockNumber === '01' ? 'STEPS:\n\n1. Assess client\'s weekly content creation capacity.\n2. Determine realistic posting frequency.\n3. Identify 3-5 content pillars.\n4. Create content batch production workflow.\n5. Select scheduling tool or native scheduler.\n6. Configure agent support for content ideas, captions, hashtags, and timing.\n7. Build evergreen content library for gaps.\n8. Establish weekly/monthly performance review cadence.\n9. Create an easy client request template for custom posts.\n10. Train client on batch creation workflow.' : `STEPS: 1. Capture the client's current ${blockTitle.toLowerCase()} process. 2. Identify repetitive work, tools, data, risks, and approval points. 3. Select the smallest useful automation. 4. Define expected output and owner review. 5. Document setup, training, measurement, and rollback notes.`,
        tags: stackTags[stackNumber], parentNeoBlockId: neoBlockId, parentNeoStackId: stackId, orderIndex: 1000 + absoluteIndex
      });
      const attachedBlocks = [directive, instruction, subjects[blockIndex % subjects.length]];
      if (blockIndex === 0) attachedBlocks.push(philosophy);
      if (blockIndex === 1) attachedBlocks.push(blueprint);
      const gate = makeGate(stackNumber, blockNumber, neoBlockId, blockTitle, stackTitle);
      gates.push(gate);
      moltBlocks.push(makeNormalizedMolt(directive, neoBlockId, stackId), makeNormalizedMolt(instruction, neoBlockId, stackId));
      sleeveNeoBlocks.push({ id: neoBlockId, title: blockTitle, type: 'neoblock', description: `Core business automation NeoBlock for ${blockTitle.toLowerCase()}.`, category: 'business-automation-core', tags: ['business-automation', 'template', 'core', ...stackTags[stackNumber]], blocks: attachedBlocks, defaultState: 'off', priorityOrder: absoluteIndex, activation: { mode: 'gate', gateId: gate.id } });
      neoBlocks.push({ id: neoBlockId, title: blockTitle, description: `Core business automation NeoBlock for ${blockTitle.toLowerCase()}.`, neoStackId: stackId, blockOrder: blockIndex + 1, tags: ['business-automation', ...stackTags[stackNumber]], moltBlockIds: attachedBlocks.map((block) => block.id), gateIds: [gate.id], defaultState: 'off', runtimeState: 'idle' });
    });

    neoStacks.push({ id: stackId, title: stackTitle, description: stackPurpose, stackOrder: stackIndex + 1, tags: ['business-automation', ...stackTags[stackNumber]], neoBlockIds: stackBlockIds });
    sleeveStacks.push({ id: stackId, title: stackTitle, type: 'neostack', description: stackPurpose, tags: ['business-automation', 'template', 'core', ...stackTags[stackNumber]], neoblocks: sleeveNeoBlocks, role: 'business_template', defaultState: 'off', compileStrategy: 'role_then_priority' });
  });

  const rootController: UMGControllerBlock = {
    id: `${BUSINESS_AUTOMATION_CORE_SLEEVE_ID}__governance_controller`,
    title: 'Business Automation Consultant Core Governance',
    controllerKind: 'sleeve_root',
    ownerScopeKind: 'sleeve',
    ownerScopeId: BUSINESS_AUTOMATION_CORE_SLEEVE_ID,
    molts: governanceBlocks,
    metadata: { createdBy: 'virtual', scopePurpose: 'Sleeve-level governance Primary MOLT values for Business Automation Core.', version: 'business-automation-core.v1' }
  };

  const sleeve: NormalizedTemplateSleeve = {
    id: BUSINESS_AUTOMATION_CORE_SLEEVE_ID,
    title: 'Business Automation Consultant Core',
    version: '1.0.0',
    description: 'Business automation consultant Sleeve for assessing small-business workflows, selecting automation opportunities, designing OpenClaw/UMG agent architecture, calculating ROI, training clients, and monitoring improvement.',
    isTemplate: true,
    templateKind: 'business',
    source: 'built_in_seed',
    tags: ['business', 'automation', 'small-business', 'side-hustle', 'openclaw', 'umg', 'roi', 'scheduling', 'social-media', 'inventory', 'invoicing', 'financial', 'training', 'monitoring'],
    neoStacks,
    neoBlocks,
    moltBlocks,
    gates,
    governanceBlockIds: governanceBlocks.map((block) => block.id),
    defaultExecutionMode: 'liveAllowed',
    metadata: { sourceScale: { neoStacks: 8, neoBlocks: 48, sourceMoltRecords: 192 }, normalizedCounts: { normalizedMoltContentBlocks: 144, gates: 48 }, triggerSemantics: 'TRG.BIZ.* source records are gates/control records, not MOLT prompt blocks.', blocksDefault: 'off', gatesDefault: 'closed' }
  };
  return { sleeve, sleeveStacks, rootController };
}

export function getBusinessAutomationCoreSleeve(): NormalizedTemplateSleeve {
  return structuredClone(buildTemplate().sleeve);
}

export function getBusinessAutomationCoreStats() {
  const sleeve = getBusinessAutomationCoreSleeve();
  return { neoStacks: sleeve.neoStacks.length, neoBlocks: sleeve.neoBlocks.length, moltBlocks: sleeve.moltBlocks.length, gates: sleeve.gates.length, governanceBlocks: sleeve.governanceBlockIds.length };
}

export function getRecommendedBusinessAutomationStackIds(businessMap?: BusinessMap): string[] {
  const text = [businessMap?.businessSummary, businessMap?.inferredIndustry, ...(businessMap?.coreOperations ?? []), ...(businessMap?.automationCandidates ?? []), ...(businessMap?.recurringWorkflows.map((workflow) => workflow.title) ?? [])].filter(Boolean).join(' ').toLowerCase();
  const ids = new Set<string>(['S.01', 'S.02']);
  if (/social|post|instagram|tiktok|content|facebook|linkedin/.test(text)) ids.add('S.03');
  if (/inventory|order|customer communication|invoice|report|operation/.test(text)) ids.add('S.04');
  if (/appointment|schedul|calendar|reminder/.test(text)) ids.add('S.05');
  if (/expense|payment|bookkeep|tax|budget|financial/.test(text)) ids.add('S.06');
  if (/install|setup|train|handoff|openclaw|implement/.test(text)) ids.add('S.07');
  if (/metric|optimi|monitor|scal|roi|improvement/.test(text)) ids.add('S.08');
  return [...ids];
}

function cloneSleeveForWorkspace(args: { createdAt: string; businessMap?: BusinessMap; sourcePrompt?: string }): Sleeve {
  const built = buildTemplate();
  return {
    id: BUSINESS_AUTOMATION_CORE_SLEEVE_ID,
    title: 'Business Automation Consultant Core',
    type: 'sleeve',
    version: '1.0.0',
    description: built.sleeve.description,
    tags: ['business', 'automation', 'template', 'core'],
    stacks: built.sleeveStacks,
    rootController: built.rootController,
    runtimeConfig: { active: false, depth: 'full', hermesEnabled: false, runtimeAdaptation: true, showRuntimeTrace: false },
    metadata: { author: 'UMG Studio built-in seed', createdAt: args.createdAt, updatedAt: args.createdAt }
  } as Sleeve;
}

export function instantiateBusinessAutomationCoreSleeve(args: { businessMap?: BusinessMap; selectedTemplateId?: string; sourcePrompt?: string; createdAt?: string } = {}): InstantiatedTemplateSleeve {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const templateSleeve = getBusinessAutomationCoreSleeve();
  const sleeve = cloneSleeveForWorkspace({ createdAt, businessMap: args.businessMap, sourcePrompt: args.sourcePrompt });
  const recommendedStackIds = getRecommendedBusinessAutomationStackIds(args.businessMap);
  return { templateSleeve, sleeve, recommendedStackIds, stats: getBusinessAutomationCoreStats() };
}
