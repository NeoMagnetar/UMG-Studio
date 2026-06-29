import { BusinessInput, BusinessMap, TemplateSelectionResult, TemplateSleeveSummary } from './businessIntakeTypes';

const quickChipTemplateMap: Record<string, string> = {
  'Business Automation': 'template.business_automation_consultant.v1',
  'DevOps / Project Launcher': 'template.project_launcher.v1',
  'Website Builder': 'template.website_builder.v1',
  Chatbot: 'template.chatbot.v1',
  'Research Agent': 'template.research_agent.v1',
  'Custom Workflow': 'template.custom_workflow.v1'
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

function templateSignals(template: TemplateSleeveSummary): string[] {
  return unique([
    template.title,
    template.description,
    template.templateKind,
    ...template.tags,
    ...template.capabilities,
    ...template.suggestedUseCases,
    ...template.neoStackSummaries.flatMap((stack) => [stack.title, stack.description, ...stack.tags])
  ].map(normalize).filter(Boolean));
}

function scoreTemplate(template: TemplateSleeveSummary, input: BusinessInput, businessMap: BusinessMap) {
  const userSignals = unique([
    input.rawQuickChip ?? '',
    input.requestedAgentType ?? '',
    input.industry ?? '',
    businessMap.inferredIndustry ?? '',
    ...input.goals,
    ...input.constraints,
    ...input.toolsAvailable.map((tool) => `${tool.name} ${tool.capability}`),
    ...businessMap.coreOperations,
    ...businessMap.automationCandidates,
    ...businessMap.externalTools,
    ...businessMap.communicationChannels,
    ...businessMap.outputsNeeded,
    ...businessMap.recurringWorkflows.flatMap((workflow) => [workflow.title, workflow.description, ...workflow.automationCandidates])
  ].map(normalize));
  const templateSignalText = templateSignals(template).join(' ');
  const matchedSignals = userSignals.filter((signal) => signal.length > 2 && templateSignalText.includes(signal)).slice(0, 18);
  let score = matchedSignals.length;
  if (input.rawQuickChip && quickChipTemplateMap[input.rawQuickChip] === template.id) score += 10;
  if (template.available) score += 2;
  if (template.status === 'partial') score += 1;
  if (template.templateKind === 'business' && input.requestedAgentType === 'business_automation') score += 6;
  if (template.templateKind === 'developer' && input.requestedAgentType === 'devops_project_launcher') score += 6;
  if (template.templateKind === 'website' && input.requestedAgentType === 'website_builder') score += 6;
  if (template.templateKind === 'chatbot' && input.requestedAgentType === 'chatbot') score += 6;
  if (template.templateKind === 'research' && input.requestedAgentType === 'research_agent') score += 6;
  if (businessMap.inferredIndustry && template.suggestedUseCases.some((useCase) => normalize(useCase).includes(normalize(businessMap.inferredIndustry ?? '')))) score += 4;
  return { template, score, matchedSignals };
}

function availableFallback(scored: ReturnType<typeof scoreTemplate>[], preferredUnavailable?: ReturnType<typeof scoreTemplate>) {
  const available = scored.filter((entry) => entry.template.available).sort((a, b) => b.score - a.score);
  if (available[0] && available[0].score > 2) return available[0];
  if (preferredUnavailable?.template.id === 'template.website_builder.v1') {
    return available.find((entry) => entry.template.id === 'template.business_automation_consultant.v1') ?? available[0];
  }
  if (preferredUnavailable?.template.id === 'template.chatbot.v1') {
    return available.find((entry) => entry.template.id === 'template.business_automation_consultant.v1') ?? available[0];
  }
  if (preferredUnavailable?.template.id === 'template.research_agent.v1') {
    return available[0];
  }
  return available[0] ?? scored[0];
}

export function selectTemplateSleeve(input: BusinessInput, businessMap: BusinessMap, catalog: TemplateSleeveSummary[]): TemplateSelectionResult {
  const scored = catalog.map((template) => scoreTemplate(template, input, businessMap)).sort((a, b) => b.score - a.score);
  const quickPreferredId = input.rawQuickChip ? quickChipTemplateMap[input.rawQuickChip] : undefined;
  const quickPreferred = quickPreferredId ? scored.find((entry) => entry.template.id === quickPreferredId) : undefined;
  const preferredUnavailable = quickPreferred && !quickPreferred.template.available ? quickPreferred : undefined;
  const selected = quickPreferred?.template.available ? quickPreferred : availableFallback(scored, preferredUnavailable);
  const unavailableButRelevant = scored
    .filter((entry) => !entry.template.available && (entry.score > 2 || entry.template.id === quickPreferredId))
    .map((entry) => entry.template.id);
  const alternates = scored
    .filter((entry) => entry.template.id !== selected.template.id && entry.template.available)
    .slice(0, 3)
    .map((entry) => entry.template.id);
  const matchedSignals = unique([...(selected.matchedSignals.length ? selected.matchedSignals : scored[0]?.matchedSignals ?? []), input.rawQuickChip ?? '']).slice(0, 18);
  const warnings = [
    ...(selected.template.status === 'partial' ? [`${selected.template.title} is available only as built-in seed metadata; full Sleeve import is not complete.`] : []),
    ...(preferredUnavailable ? [`${preferredUnavailable.template.title} is relevant but planned, so the best available seed template was selected instead.`] : []),
    ...unavailableButRelevant.filter((id) => id !== preferredUnavailable?.template.id).map((id) => `${catalog.find((template) => template.id === id)?.title ?? id} is planned/relevant but not yet available.`),
    'Template selection does not generate Sleeve, NeoStack, NeoBlock, or MOLT records in this phase.',
    'Hermes runtime is not called by this selector.'
  ];
  const maxScore = Math.max(1, scored[0]?.score ?? 1);
  const confidence = Math.min(0.92, Math.max(0.35, (selected.score / maxScore) * businessMap.confidence));
  return {
    selectedTemplateId: selected.template.id,
    selectedTemplateTitle: selected.template.title,
    confidence: Number(confidence.toFixed(2)),
    reason: `${selected.template.title} best matches ${matchedSignals.length ? matchedSignals.slice(0, 5).join(', ') : 'the available intake signals'} while staying honest about ${selected.template.status} template status.`,
    matchedSignals,
    alternateTemplateIds: alternates,
    unavailableButRelevantTemplateIds: unique(unavailableButRelevant),
    nextRecommendedPhase: 'block_matching',
    warnings: unique(warnings)
  };
}
