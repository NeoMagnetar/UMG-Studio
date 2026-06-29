import { BusinessInput, BusinessMap } from './businessIntakeTypes';
import { BlockMatchPlan, GeneratedBlockDraft, MissingCapability, MissingCapabilityType } from './blockMatchingTypes';
import { NormalizedTemplateSleeve } from './templateSleeveStructures';

const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
const textOf = (businessMap: BusinessMap, input?: BusinessInput) => unique([
  input?.text ?? '', input?.rawQuickChip ?? '', ...(input?.goals ?? []), ...(input?.constraints ?? []),
  ...(input?.toolsAvailable.map((tool) => `${tool.name} ${tool.capability}`) ?? []), businessMap.businessSummary,
  ...businessMap.coreOperations, ...businessMap.automationCandidates, ...businessMap.externalTools,
  ...businessMap.communicationChannels, ...businessMap.outputsNeeded, ...businessMap.approvalPoints,
  ...businessMap.dataSources, ...businessMap.complianceOrSafetyConstraints,
  ...businessMap.recurringWorkflows.flatMap((workflow) => [workflow.title, workflow.description, ...workflow.likelyTools, ...workflow.automationCandidates])
]).join(' ').toLowerCase();

const toolPatterns: Array<{ name: string; pattern: RegExp; type: MissingCapabilityType; parent: string }> = [
  { name: 'Gmail / email sending', pattern: /gmail|email sending|send email|outbound email/, type: 'integration', parent: 'S.04' },
  { name: 'Google Calendar / calendar API', pattern: /google calendar|calendar api/, type: 'integration', parent: 'S.05' },
  { name: 'Google Sheets', pattern: /google sheets|spreadsheet|sheets/, type: 'integration', parent: 'S.04' },
  { name: 'Notion', pattern: /notion/, type: 'integration', parent: 'S.04' },
  { name: 'Airtable', pattern: /airtable/, type: 'integration', parent: 'S.04' },
  { name: 'CRM', pattern: /\bcrm\b|hubspot|salesforce/, type: 'integration', parent: 'S.04' },
  { name: 'Shopify', pattern: /shopify/, type: 'integration', parent: 'S.04' },
  { name: 'Etsy', pattern: /etsy/, type: 'integration', parent: 'S.04' },
  { name: 'Stripe', pattern: /stripe/, type: 'integration', parent: 'S.06' },
  { name: 'QuickBooks', pattern: /quickbooks/, type: 'integration', parent: 'S.06' },
  { name: 'Square / POS', pattern: /square|\bpos\b|point of sale/, type: 'integration', parent: 'S.06' },
  { name: 'WhatsApp', pattern: /whatsapp/, type: 'channel', parent: 'S.04' },
  { name: 'SMS / Twilio', pattern: /sms|twilio|text message/, type: 'channel', parent: 'S.04' },
  { name: 'Telegram', pattern: /telegram/, type: 'channel', parent: 'S.04' },
  { name: 'Slack', pattern: /slack/, type: 'channel', parent: 'S.04' },
  { name: 'Discord', pattern: /discord/, type: 'channel', parent: 'S.04' },
  { name: 'Buffer / Hootsuite / Later', pattern: /buffer|hootsuite|later/, type: 'integration', parent: 'S.03' }
];

const templateGapPatterns = [
  { name: 'Website / landing page / SEO', pattern: /website|landing page|seo|web design/, signals: ['website', 'landing page', 'seo'], parent: 'S.02' },
  { name: 'Chatbot / knowledge base / live support bot', pattern: /chatbot|knowledge base|live support bot|support bot/, signals: ['chatbot', 'knowledge base'], parent: 'S.04' },
  { name: 'Research / citations / literature / source report', pattern: /research|citations|literature|source report/, signals: ['research', 'citations'], parent: 'S.01' },
  { name: 'DevOps / GitHub / repo / code shipping', pattern: /devops|github|repo|code shipping|commit|pull request/, signals: ['devops', 'github'], parent: 'S.07' }
];

const domainPolicyPatterns = [
  { name: 'Regulated healthcare / therapy data', pattern: /healthcare|therapy|patient|hipaa|medical/, signals: ['regulated data', 'healthcare'] },
  { name: 'Legal advice or legal data sensitivity', pattern: /legal|lawyer|attorney|contract review/, signals: ['legal', 'policy'] },
  { name: 'Financial advice / regulated finance sensitivity', pattern: /financial advice|investment|tax advice|regulated finance/, signals: ['financial advice', 'approval'] }
];

function hasDirectCoverage(capability: string, matchPlan: BlockMatchPlan, templateSleeve: NormalizedTemplateSleeve) {
  const coverageText = [
    ...matchPlan.matchedNeoBlocks.map((match) => `${match.title} ${match.summary} ${match.matchedSignals.join(' ')}`),
    ...templateSleeve.tags
  ].join(' ').toLowerCase();
  return capability.toLowerCase().split(/\W+/).filter((word) => word.length > 4).some((word) => coverageText.includes(word));
}

function missing(args: { index: number; title: string; description: string; capabilityType: MissingCapabilityType; sourceSignals: string[]; whyMissing: string; parent?: string; requiresTool?: boolean; tool?: string; confidence?: number; blockType?: MissingCapability['suggestedBlockType']; role?: MissingCapability['suggestedMoltRole'] }): MissingCapability {
  return {
    id: `missing.capability.${String(args.index).padStart(3, '0')}`,
    title: args.title,
    description: args.description,
    capabilityType: args.capabilityType,
    sourceSignals: args.sourceSignals,
    whyMissing: args.whyMissing,
    suggestedBlockType: args.blockType ?? 'neoblock',
    suggestedParentStackId: args.parent,
    suggestedMoltRole: args.role,
    requiresTool: args.requiresTool,
    requestedToolCapability: args.tool,
    confidence: args.confidence ?? 0.78,
    status: 'detected'
  };
}

export function detectMissingCapabilities(args: { businessInput?: BusinessInput; businessMap: BusinessMap; matchPlanWithoutDrafts: BlockMatchPlan; templateSleeve: NormalizedTemplateSleeve }): MissingCapability[] {
  const text = textOf(args.businessMap, args.businessInput);
  const found: MissingCapability[] = [];
  toolPatterns.forEach((entry) => {
    if (entry.pattern.test(text) && !hasDirectCoverage(entry.name, args.matchPlanWithoutDrafts, args.templateSleeve)) {
      found.push(missing({ index: found.length + 1, title: `${entry.name} capability`, description: `User mentioned ${entry.name}; Business Automation Core covers the workflow category but not the concrete user-connected integration.`, capabilityType: entry.type, sourceSignals: [entry.name], whyMissing: 'Specific integration must be routed through Hermes/user-connected tools and reviewed before use.', parent: entry.parent, requiresTool: true, tool: entry.name }));
    }
  });
  templateGapPatterns.forEach((entry) => {
    if (entry.pattern.test(text)) {
      found.push(missing({ index: found.length + 1, title: `${entry.name} template gap`, description: `${entry.name} is relevant but outside the Business Automation Core normalization scope.`, capabilityType: 'templateGap', sourceSignals: entry.signals, whyMissing: 'A planned or alternate template is more specific; Phase 5 records the gap without importing another template.', parent: entry.parent, confidence: 0.72, blockType: 'molt', role: 'meta' }));
    }
  });
  domainPolicyPatterns.forEach((entry) => {
    if (entry.pattern.test(text)) {
      found.push(missing({ index: found.length + 1, title: `${entry.name} policy gap`, description: 'Sensitive or regulated domain signal needs explicit policy/approval handling before execution.', capabilityType: 'policy', sourceSignals: entry.signals, whyMissing: 'Business Automation Core does not authorize regulated-domain execution by itself.', parent: 'S.01', confidence: 0.84, blockType: 'gate' }));
    }
  });
  return found;
}

function parentLabel(id?: string) {
  const labels: Record<string, string> = { 'S.03': 'S.03 Social Media Automation', 'S.04': 'S.04 Operations & Process Automation', 'S.05': 'S.05 Scheduling & Calendar Automation', 'S.06': 'S.06 Financial Automation', 'S.07': 'S.07 Implementation & Training', 'S.08': 'S.08 Monitoring & Optimization', 'S.02': 'S.02 Automation Architecture Design', 'S.01': 'S.01 Business Assessment & Discovery' };
  return labels[id ?? ''] ?? 'Business Automation Core';
}

export function generateDraftsForMissingCapabilities(args: { missingCapabilities: MissingCapability[]; businessMap: BusinessMap; templateSleeve: NormalizedTemplateSleeve }): GeneratedBlockDraft[] {
  const selected = [...args.missingCapabilities].sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  const drafts: GeneratedBlockDraft[] = [];
  selected.forEach((capability, index) => {
    const safeTitle = capability.title.replace(/ capability| template gap| policy gap/g, '');
    if (capability.requiresTool) {
      drafts.push({
        id: `draft.neoblock.${String(index + 1).padStart(3, '0')}`,
        blockType: 'neoblock', title: `${safeTitle} Integration Requirement`,
        summary: 'Draft local NeoBlock proposal for connecting the requested capability through Hermes/user-connected tools.',
        body: `Confirm the user wants ${safeTitle}. Identify the user-connected tool and permissions. Route any live action through Hermes only after user authorization. Record trace/result data when Hermes returns it.`,
        tags: ['draft', 'missing-capability', 'integration'], sourceReason: capability.whyMissing,
        proposedParent: parentLabel(capability.suggestedParentStackId), proposedParentId: capability.suggestedParentStackId,
        sourceMissingCapabilityId: capability.id, saveState: 'draft', confidence: capability.confidence, needsUserReview: true, accepted: false, defaultState: 'off',
        metadata: { draftOnly: true, librarySaved: false, requestedToolCapability: capability.requestedToolCapability }
      });
      drafts.push({
        id: `draft.molt.${String(index + 1).padStart(3, '0')}`,
        blockType: 'molt', role: 'instruction', title: `${safeTitle} Integration Procedure`,
        summary: 'Draft Instruction MOLT for safe Hermes-mediated integration setup.',
        body: `1. Identify the user-connected ${safeTitle} tool.\n2. Confirm user request, available permissions, and approval boundaries.\n3. Route execution through Hermes rather than Studio.\n4. Capture Hermes trace/result data when available.\n5. Keep this draft sleeve-local until reviewed and explicitly saved later.`,
        tags: ['draft', 'instruction', 'integration'], sourceReason: capability.whyMissing,
        proposedParent: `${safeTitle} Integration Requirement`, proposedParentId: capability.suggestedParentNeoBlockId,
        sourceMissingCapabilityId: capability.id, saveState: 'draft', confidence: capability.confidence, needsUserReview: true, accepted: false, defaultState: 'off',
        metadata: { draftOnly: true, librarySaved: false }
      });
    } else {
      drafts.push({
        id: `draft.${capability.suggestedBlockType}.${String(index + 1).padStart(3, '0')}`,
        blockType: capability.suggestedBlockType, role: capability.suggestedMoltRole,
        title: `${safeTitle} Gap Note`, summary: 'Draft-only note for a capability gap that should not be treated as an imported template or generated library block.',
        body: `${capability.description}\n\nReason: ${capability.whyMissing}\n\nRecommended next step: review whether a later template, policy gate, or Hermes-connected tool should handle this capability.`,
        tags: ['draft', 'gap', capability.capabilityType], sourceReason: capability.whyMissing,
        proposedParent: parentLabel(capability.suggestedParentStackId), proposedParentId: capability.suggestedParentStackId,
        sourceMissingCapabilityId: capability.id, saveState: 'draft', confidence: capability.confidence, needsUserReview: true, accepted: false, defaultState: 'off',
        metadata: { draftOnly: true, librarySaved: false }
      });
    }
  });
  return drafts;
}
