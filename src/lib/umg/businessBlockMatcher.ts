import { BusinessInput, BusinessMap } from './businessIntakeTypes';
import { BlockMatch, BlockMatchPlan } from './blockMatchingTypes';
import { NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve } from './templateSleeveStructures';

const stackSignals: Record<string, string[]> = {
  'S.01': ['business', 'assessment', 'discovery', 'revenue', 'pain point', 'bottleneck', 'success metric', 'roi'],
  'S.02': ['architecture', 'openclaw', 'agent', 'tool', 'integration', 'workflow configuration', 'rollout'],
  'S.03': ['social', 'content', 'instagram', 'facebook', 'tiktok', 'linkedin', 'posts', 'scheduler', 'calendar content', 'hashtag', 'engagement', 'creator', 'influencer'],
  'S.04': ['inventory', 'orders', 'customer communication', 'invoice', 'reports', 'data entry', 'shopify', 'etsy', 'restaurant', 'food truck', 'fulfillment', 'crm', 'support', 'faq'],
  'S.05': ['appointment', 'scheduling', 'calendar', 'reminder', 'availability', 'staff', 'meeting', 'booking', 'no-show'],
  'S.06': ['expense', 'payment', 'bookkeeping', 'tax', 'budget', 'financial', 'revenue', 'receipt', 'quickbooks', 'stripe', 'invoice'],
  'S.07': ['setup', 'install', 'configure', 'openclaw', 'training', 'handoff', 'workflow configuration', 'go-live', 'documentation'],
  'S.08': ['metrics', 'optimize', 'monitoring', 'scaling', 'roi', 'feedback', 'analytics', 'health', 'performance']
};

const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
const textOf = (businessMap: BusinessMap, input?: BusinessInput) => unique([
  input?.text ?? '', input?.rawQuickChip ?? '', input?.industry ?? '', businessMap.businessSummary, businessMap.inferredIndustry ?? '',
  ...(input?.goals ?? []), ...(input?.constraints ?? []), ...(input?.toolsAvailable.map((tool) => `${tool.name} ${tool.capability}`) ?? []),
  ...businessMap.coreOperations, ...businessMap.automationCandidates, ...businessMap.externalTools, ...businessMap.communicationChannels,
  ...businessMap.outputsNeeded, ...businessMap.approvalPoints, ...businessMap.dataSources, ...businessMap.complianceOrSafetyConstraints,
  ...businessMap.recurringWorkflows.flatMap((workflow) => [workflow.title, workflow.description, ...workflow.automationCandidates, ...workflow.likelyTools])
]).join(' ').toLowerCase();

function matchedSignalsFrom(text: string, signals: string[]) {
  return unique(signals.filter((signal) => text.includes(signal.toLowerCase())));
}

function confidenceFrom(signalCount: number, baseline = 0.35) {
  return Number(Math.min(0.95, baseline + signalCount * 0.09).toFixed(2));
}

export function scoreBusinessAutomationNeoStack(stack: NormalizedTemplateNeoStack, businessMap: BusinessMap, input?: BusinessInput) {
  const text = textOf(businessMap, input);
  const signals = matchedSignalsFrom(text, [...(stackSignals[stack.id] ?? []), stack.title, ...stack.tags]);
  const required = stack.id === 'S.01' || stack.id === 'S.02';
  const confidence = required ? Math.max(0.82, confidenceFrom(signals.length, 0.55)) : confidenceFrom(signals.length);
  return { confidence, matchedSignals: required ? unique(['business automation foundation', ...signals]) : signals };
}

export function scoreBusinessAutomationNeoBlock(block: NormalizedTemplateNeoBlock, stack: NormalizedTemplateNeoStack, businessMap: BusinessMap, input?: BusinessInput, templateSleeve?: NormalizedTemplateSleeve) {
  const text = textOf(businessMap, input);
  const gateText = templateSleeve?.gates.filter((gate) => block.gateIds.includes(gate.id)).map((gate) => gate.conditionText).join(' ') ?? '';
  const signals = matchedSignalsFrom(text, unique([block.title, stack.title, stack.description, ...block.tags, ...stack.tags, ...gateText.toLowerCase().split(/[^a-z0-9-]+/).filter((word) => word.length > 4)]));
  const stackScore = scoreBusinessAutomationNeoStack(stack, businessMap, input);
  const confidence = Math.max(stackScore.confidence - 0.18, confidenceFrom(signals.length, block.neoStackId === 'S.01' || block.neoStackId === 'S.02' ? 0.5 : 0.28));
  return { confidence: Number(Math.min(0.93, confidence).toFixed(2)), matchedSignals: signals.length ? signals.slice(0, 10) : stackScore.matchedSignals.slice(0, 5) };
}

function matchRecord(args: Omit<BlockMatch, 'source' | 'reusedExisting' | 'proposedUse'>): BlockMatch {
  return { ...args, source: 'template', reusedExisting: true, proposedUse: args.confidence >= 0.75 ? 'directReuse' : 'partialReuse' };
}

export function matchMoltBlocksForMatchedNeoBlocks(templateSleeve: NormalizedTemplateSleeve, matchedNeoBlocks: BlockMatch[]): BlockMatch[] {
  const selectedNeoBlockIds = new Set(matchedNeoBlocks.map((match) => match.targetId));
  const selectedStackIds = new Set(matchedNeoBlocks.map((match) => match.parentId).filter(Boolean));
  return templateSleeve.moltBlocks
    .filter((block) => templateSleeve.governanceBlockIds.includes(block.id) || (block.parentNeoBlockId && selectedNeoBlockIds.has(block.parentNeoBlockId)) || (block.parentNeoStackId && selectedStackIds.has(block.parentNeoStackId)))
    .map((block) => matchRecord({
      id: `match.molt.${block.id}`,
      targetKind: 'molt', targetId: block.id, sourceId: block.sourceId, title: block.title, summary: block.content.slice(0, 160),
      parentId: block.parentNeoBlockId ?? block.parentNeoStackId, role: block.role, confidence: templateSleeve.governanceBlockIds.includes(block.id) ? 0.88 : 0.76,
      reason: templateSleeve.governanceBlockIds.includes(block.id) ? 'Governance Primary block is included at Sleeve level.' : 'MOLT content belongs to a matched NeoBlock or matched stack context.',
      matchedSignals: templateSleeve.governanceBlockIds.includes(block.id) ? ['governance', 'primary'] : [block.role]
    }));
}

export function matchGatesForMatchedNeoBlocks(templateSleeve: NormalizedTemplateSleeve, matchedNeoBlocks: BlockMatch[]): BlockMatch[] {
  const selectedNeoBlockIds = new Set(matchedNeoBlocks.map((match) => match.targetId));
  return templateSleeve.gates
    .filter((gate) => selectedNeoBlockIds.has(gate.attachesTo.id))
    .map((gate) => matchRecord({
      id: `match.gate.${gate.id}`,
      targetKind: 'gate', targetId: gate.id, sourceId: gate.sourceId, title: gate.title, summary: gate.conditionText,
      parentId: gate.attachesTo.id, confidence: 0.8, reason: 'Gate activates/controls the matched NeoBlock and remains closed/inactive until runtime.',
      matchedSignals: ['gate', 'control', gate.sourceId ?? gate.id]
    }));
}

export function calculateOverallMatchConfidence(matches: BlockMatch[]) {
  if (!matches.length) return 0;
  const average = matches.reduce((sum, match) => sum + match.confidence, 0) / matches.length;
  return Number(Math.min(0.91, Math.max(0.35, average)).toFixed(2));
}

export function matchBusinessMapToBusinessAutomationCore(args: { businessInput?: BusinessInput; businessMap: BusinessMap; templateSleeve: NormalizedTemplateSleeve }): BlockMatchPlan {
  const { businessInput, businessMap, templateSleeve } = args;
  const matchedSleeves = [matchRecord({ id: `match.sleeve.${templateSleeve.id}`, targetKind: 'sleeve', targetId: templateSleeve.id, title: templateSleeve.title, summary: templateSleeve.description, confidence: 0.88, reason: 'Business Automation Core is the selected template Sleeve.', matchedSignals: ['business automation', 'template sleeve'] })];
  const stackScores = templateSleeve.neoStacks.map((stack) => ({ stack, ...scoreBusinessAutomationNeoStack(stack, businessMap, businessInput) }));
  const matchedNeoStacks = stackScores.filter(({ stack, confidence }) => stack.id === 'S.01' || stack.id === 'S.02' || confidence >= 0.44).map(({ stack, confidence, matchedSignals }) => matchRecord({ id: `match.stack.${stack.id}`, targetKind: 'neostack', targetId: stack.id, title: stack.title, summary: stack.description, confidence, reason: stack.id === 'S.01' || stack.id === 'S.02' ? 'Required foundation stack for business automation.' : `Matched ${matchedSignals.slice(0, 5).join(', ') || 'domain signals'}.`, matchedSignals }));
  const matchedStackIds = new Set(matchedNeoStacks.map((match) => match.targetId));
  const matchedNeoBlocks = templateSleeve.neoBlocks
    .filter((block) => matchedStackIds.has(block.neoStackId))
    .map((block) => {
      const stack = templateSleeve.neoStacks.find((entry) => entry.id === block.neoStackId)!;
      const score = scoreBusinessAutomationNeoBlock(block, stack, businessMap, businessInput, templateSleeve);
      return matchRecord({ id: `match.block.${block.id}`, targetKind: 'neoblock', targetId: block.id, title: block.title, summary: block.description, parentId: stack.id, parentTitle: stack.title, confidence: score.confidence, reason: `NeoBlock reused from Business Automation Core because it covers ${score.matchedSignals.slice(0, 4).join(', ') || stack.title}.`, matchedSignals: score.matchedSignals });
    });
  const matchedMoltBlocks = matchMoltBlocksForMatchedNeoBlocks(templateSleeve, matchedNeoBlocks);
  const matchedGates = matchGatesForMatchedNeoBlocks(templateSleeve, matchedNeoBlocks);
  const confidence = calculateOverallMatchConfidence([...matchedNeoStacks, ...matchedNeoBlocks]);
  return {
    id: `block_match_plan_${Date.now()}`,
    templateSleeveId: templateSleeve.id,
    businessMapSummary: businessMap.businessSummary,
    matchedSleeves, matchedNeoStacks, matchedNeoBlocks, matchedMoltBlocks, matchedGates,
    confidence,
    reasonForMatch: `Reused ${matchedNeoBlocks.length} existing NeoBlocks and ${matchedMoltBlocks.length} MOLT content blocks before proposing new drafts.`,
    missingCapabilities: [], generatedDrafts: [], createdAt: new Date().toISOString(),
    warnings: ['Deterministic local block matching only. Hermes, AI generation, compiler, and runtime trace were not called.']
  };
}
