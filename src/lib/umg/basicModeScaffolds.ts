import type { SleeveArchitectPlan } from './sleeveArchitectTypes';
import type { NormalizedTemplateSleeve } from './templateSleeveStructures';
import type { ToolCapabilityResolution } from './toolCapabilityResolver';

export type StudioMode = 'basic' | 'advanced';

export type BasicContentKind =
  | 'business_doc'
  | 'product_catalog'
  | 'contact_list'
  | 'api_documentation'
  | 'connector_instructions'
  | 'credential_or_secret'
  | 'brand_voice'
  | 'policy_or_rule'
  | 'workflow_notes'
  | 'output_template'
  | 'unknown';

export type BasicContentClassification = {
  kind: BasicContentKind;
  label: string;
  sensitive: boolean;
  redactedPreview: string;
  warnings: string[];
};

export type BasicStructureQuality = {
  status: 'strong' | 'needs_refinement';
  issues: string[];
};

export type BasicCapabilityCard = {
  label: string;
  capabilityId: string;
  description: string;
  sourceNeoBlock?: string;
  sourceNeoStack?: string;
  status: 'available' | 'needs connector' | 'needs approval' | 'unavailable' | 'unsafe/high-risk';
  riskLevel: 'low' | 'medium' | 'high';
  externalActionTaken: false;
  safeAction: boolean;
};

const secretPattern = /(?:api[_-]?key|secret|token|password|bearer|sk-[A-Za-z0-9]|ghp_[A-Za-z0-9]|xox[baprs]-|AKIA[0-9A-Z]{16})/i;

export function redactSensitiveText(value: string) {
  return value
    .replace(/(api[_-]?key|secret|token|password|bearer)\s*[:=]\s*[^\s,;]+/gi, '$1=[PROTECTED]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-[PROTECTED]')
    .replace(/ghp_[A-Za-z0-9_]{12,}/g, 'ghp_[PROTECTED]')
    .replace(/xox[baprs]-[A-Za-z0-9-]{12,}/g, 'xox-[PROTECTED]')
    .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA[PROTECTED]');
}

export function classifyBasicContent(args: { text?: string; filenames?: string[] }): BasicContentClassification[] {
  const text = args.text ?? '';
  const filenames = args.filenames ?? [];
  const lower = `${text}\n${filenames.join('\n')}`.toLowerCase();
  const kinds: BasicContentKind[] = [];
  const add = (kind: BasicContentKind) => { if (!kinds.includes(kind)) kinds.push(kind); };
  if (/email|phone|contacts?|csv|first_name|last_name/.test(lower)) add('contact_list');
  if (/sku|price|inventory|product catalog|product file|listing/.test(lower)) add('product_catalog');
  if (/openapi|endpoint|webhook|api doc|curl|graphql/.test(lower)) add('api_documentation');
  if (/connector|integration|oauth|smtp|imap|crm|shopify|stripe/.test(lower)) add('connector_instructions');
  if (/brand voice|tone|style guide|voice/.test(lower)) add('brand_voice');
  if (/policy|rule|sop|compliance|approval/.test(lower)) add('policy_or_rule');
  if (/template|format|outline|output/.test(lower)) add('output_template');
  if (/workflow|process|steps|handoff/.test(lower)) add('workflow_notes');
  if (/business plan|market|operations|financial/.test(lower)) add('business_doc');
  if (secretPattern.test(text)) add('credential_or_secret');
  if (!kinds.length) add('unknown');
  return kinds.map((kind) => ({
    kind,
    label: kind.replace(/_/g, ' '),
    sensitive: kind === 'credential_or_secret',
    redactedPreview: redactSensitiveText(text).slice(0, 240),
    warnings: kind === 'credential_or_secret' ? ['Sensitive material detected. It will not be shown in prompts, trace, or artifacts.'] : []
  }));
}

function promptNouns(text: string) {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4 && !['create', 'generator', 'template', 'professional', 'based'].includes(word)));
}

export function evaluateBasicSleeveQuality(plan?: SleeveArchitectPlan): BasicStructureQuality {
  if (!plan) return { status: 'needs_refinement', issues: ['No Sleeve has been created yet.'] };
  const issues: string[] = [];
  const title = plan.proposedSleeveTitle.toLowerCase();
  const nouns = promptNouns(plan.sourcePrompt);
  const stackTitles = plan.proposedNeoStacks.map((stack) => stack.title.toLowerCase());
  const blockTitles = plan.proposedNeoBlocks.map((block) => block.title.toLowerCase());
  const allTitles = [title, ...stackTitles, ...blockTitles].join(' ');
  if (/custom workflow architecture sleeve|custom sleeve|generic/.test(title)) issues.push('Sleeve title is generic.');
  if (blockTitles.filter((name) => name.includes('coordinator')).length > Math.max(1, Math.ceil(blockTitles.length / 3))) issues.push('Too many NeoBlocks use generic Coordinator names.');
  if (stackTitles.filter((name) => /intake|validation|planning|audit/.test(name)).length === stackTitles.length && nouns.size > 3) issues.push('Stack names are generic for a specific prompt.');
  if (plan.proposedMoltBlocks.some((block) => /content needed for/i.test(block.summary))) issues.push('Some MOLT summaries are placeholder text.');
  if (![...nouns].some((noun) => allTitles.includes(noun))) issues.push('No prompt-specific nouns appear in stack/block titles.');
  if (/business automation/i.test(plan.proposedSleeveTitle) && !/business automation/i.test(plan.sourcePrompt)) issues.push('Seed template name dominates custom prompt identity.');
  if (!plan.toolCapabilityNeeds.length && /generate|draft|email|report|analyze|create|export|send|file|plan/.test(plan.sourcePrompt.toLowerCase())) issues.push('Capability palette is empty despite action-oriented prompt.');
  return { status: issues.length ? 'needs_refinement' : 'strong', issues };
}

function statusFromResolution(capabilityId: string, resolutions: ToolCapabilityResolution[]) {
  const resolved = resolutions.find((entry) => entry.capabilityId === capabilityId);
  if (!resolved) return undefined;
  if (resolved.riskLevel === 'high') return 'unsafe/high-risk' as const;
  if (resolved.available === 'yes' && resolved.executionPolicy === 'autoAllowed') return 'available' as const;
  if (resolved.executionPolicy === 'approvalRequired') return 'needs approval' as const;
  if (resolved.available === 'no') return 'unavailable' as const;
  return 'needs connector' as const;
}

export function buildBasicCapabilityPalette(args: { plan?: SleeveArchitectPlan; activeSessionSleeve?: NormalizedTemplateSleeve; resolutions?: ToolCapabilityResolution[]; content?: BasicContentClassification[] }): BasicCapabilityCard[] {
  const plan = args.plan;
  const resolutions = args.resolutions ?? [];
  const text = `${plan?.sourcePrompt.toLowerCase() ?? ''} ${args.activeSessionSleeve?.title.toLowerCase() ?? ''} ${args.activeSessionSleeve?.description.toLowerCase() ?? ''}`;
  const cards: BasicCapabilityCard[] = [];
  const add = (card: Omit<BasicCapabilityCard, 'externalActionTaken' | 'safeAction'>) => {
    if (cards.some((existing) => existing.capabilityId === card.capabilityId)) return;
    cards.push({ ...card, externalActionTaken: false, safeAction: card.status === 'available' && card.riskLevel === 'low' });
  };
  const activeCapabilities = Array.isArray(args.activeSessionSleeve?.metadata?.capabilities)
    ? args.activeSessionSleeve?.metadata?.capabilities as Array<{ capabilityId?: string; label?: string; reason?: string; riskLevel?: string; safeForAppLocalExecution?: boolean; requiresConnector?: boolean }>
    : [];
  for (const capability of activeCapabilities) {
    const capabilityId = capability.capabilityId;
    if (!capabilityId) continue;
    const lowerId = capabilityId.toLowerCase();
    const sourceBlock = args.activeSessionSleeve?.neoBlocks.find((block) => {
      const haystack = `${block.title} ${block.description}`.toLowerCase();
      return lowerId.includes('text_composition') ? /compose|text|note|draft|write/.test(haystack)
        : lowerId.includes('note_file_write') ? /desktop|file|write|note|artifact|review/.test(haystack)
          : haystack.includes(lowerId.split(/[._-]+/).slice(-1)[0] ?? lowerId);
    });
    const resolvedStatus = statusFromResolution(capabilityId, resolutions);
    const status = resolvedStatus ?? (capability.requiresConnector ? 'needs connector' : capability.safeForAppLocalExecution ? 'available' : 'needs approval');
    const riskLevel = capability.riskLevel === 'high' ? 'high' : capability.riskLevel === 'low' || status === 'available' ? 'low' : 'medium';
    const label = capability.label
      ?? (capabilityId === 'umg.capability.local_text_composition' ? 'Compose local note text'
        : capabilityId === 'umg.capability.local_note_file_write' ? 'Prepare desktop note artifact'
          : capabilityId.replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()));
    add({ label, capabilityId, description: capability.reason ?? 'Declared by the active runtime-session Sleeve.', sourceNeoBlock: sourceBlock?.title, sourceNeoStack: args.activeSessionSleeve?.neoStacks.find((stack) => stack.id === sourceBlock?.neoStackId)?.title, status, riskLevel });
  }
  if (activeCapabilities.length) return cards.slice(0, 10);
  for (const tool of plan?.toolCapabilityNeeds ?? []) {
    const block = plan?.proposedNeoBlocks.find((candidate) => candidate.title.toLowerCase().includes(tool.capability.split('_')[0]));
    const status = statusFromResolution(tool.capability, resolutions) ?? (tool.capability.includes('send') || tool.capability.includes('refund') || tool.capability.includes('inventory') ? 'needs approval' : 'needs connector');
    const riskLevel = tool.capability.includes('refund') || tool.capability.includes('send') || tool.capability.includes('inventory') ? 'high' : status === 'available' ? 'low' : 'medium';
    const label = tool.capability === 'customer_message_draft' ? 'Draft customer email'
      : tool.capability === 'philosophy_principle_apply' ? 'Apply Greek philosophy principles'
        : tool.capability === 'report_generate' && /business plan|executive summary/.test(text) ? 'Assemble final business plan'
          : tool.capability.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    add({ label, capabilityId: tool.capability, description: tool.whyDeclared, sourceNeoBlock: block?.title, sourceNeoStack: plan?.proposedNeoStacks.find((stack) => stack.id === block?.parentNeoStackId)?.title, status, riskLevel });
  }
  if (/business plan|executive summary|market|financial|greek|philosophy/.test(text)) {
    add({ label: 'Generate executive summary', capabilityId: 'executive_summary_generate', description: 'Draft the executive summary inside the active business plan Sleeve.', sourceNeoBlock: plan?.proposedNeoBlocks.find((block) => /summary|assembly|narrative/i.test(block.title))?.title, sourceNeoStack: plan?.proposedNeoStacks.find((stack) => /narrative|plan/i.test(stack.title))?.title, status: 'available', riskLevel: 'low' });
    add({ label: 'Apply Greek philosophy principles', capabilityId: 'philosophy_principle_apply', description: 'Use Greek philosophy concepts as local reasoning guidance for plan structure and critique.', sourceNeoBlock: plan?.proposedNeoBlocks.find((block) => /philosophy|telos|ethics/i.test(block.title))?.title, sourceNeoStack: plan?.proposedNeoStacks.find((stack) => /philosophy|ethics|telos/i.test(stack.title))?.title, status: 'available', riskLevel: 'low' });
    add({ label: 'Create financial assumptions', capabilityId: 'financial_assumptions_draft', description: 'Prepare reviewable assumptions for the financial section; no external records are changed.', sourceNeoBlock: plan?.proposedNeoBlocks.find((block) => /financial/i.test(block.title))?.title, sourceNeoStack: plan?.proposedNeoStacks.find((stack) => /financial/i.test(stack.title))?.title, status: 'available', riskLevel: 'low' });
  }
  if (/email|customer/.test(text)) add({ label: 'Draft customer email', capabilityId: 'customer_message_draft', description: 'Draft customer-facing copy without sending it.', status: statusFromResolution('customer_message_draft', resolutions) ?? 'available', riskLevel: 'low', sourceNeoBlock: plan?.proposedNeoBlocks.find((block) => /draft|customer|communication/i.test(block.title))?.title });
  if ((args.content ?? []).some((entry) => entry.kind === 'contact_list')) add({ label: 'Read uploaded contact file', capabilityId: 'uploaded_contact_file_read', description: 'Use uploaded contact metadata only; protected content is not exposed.', status: 'available', riskLevel: 'low' });
  if (/send email|bulk send|newsletter/.test(text)) add({ label: 'Send email', capabilityId: 'email_send', description: 'Requires a configured connector and explicit approval; not executed in this phase.', status: 'unsafe/high-risk', riskLevel: 'high' });
  return cards.slice(0, 10);
}
