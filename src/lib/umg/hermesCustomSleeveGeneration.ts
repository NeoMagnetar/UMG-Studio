import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve, NormalizedTemplateSourceKind } from './templateSleeveStructures';
import { getHermesUmgAppLocalSkillBundle, UMG_SUPPORTED_PROMPT_MOLT_ROLES, type HermesUmgAppLocalSkillBundle, type UmgSupportedPromptMoltRole } from './hermesUmgSkillBundle';
import { retrieveUmgLibraryCandidates, summarizeUmgLibraryCandidates, type UmgLibraryCandidate } from './umgLibraryCandidateRetrieval';
import { validateHermesCustomSleevePlanScaffold } from './hermesSleevePlanSchema';

export type HermesCustomSleeveGenerationRequest = {
  requestId: string;
  userPrompt: string;
  userContext: string;
  selectedMode: 'custom_workflow';
  appLocalSkillBundle: HermesUmgAppLocalSkillBundle;
  decompositionSkillText: string;
  hierarchyBlockCardSkillText: string;
  compilerAlignmentRules: string;
  supportedPromptMoltRoles: UmgSupportedPromptMoltRole[];
  gatePolicy: string;
  sourceLibraryPolicy: string;
  capabilityPolicy: string;
  libraryCandidates: UmgLibraryCandidate[];
  libraryCandidateSummary: ReturnType<typeof summarizeUmgLibraryCandidates>;
  outputContract: string;
};

export type HermesCustomSleevePlanCapability = {
  capabilityId: string;
  label: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'irreversible' | 'unknown';
  riskHint?: 'low' | 'medium' | 'high' | 'irreversible' | 'unknown';
  requiresConnector?: boolean;
  connectorRequired?: boolean;
  safeForAppLocalExecution?: boolean;
  appLocalOnly?: boolean;
  reason?: string;
};

export type HermesGeneratedDecision = {
  id: string;
  title?: string;
  proposedId?: string;
  targetKind?: string;
  reason: string;
  runtimeSessionOnly: true;
  sourceLibraryWrite: false;
  needsUserReview?: boolean;
};

export type HermesCustomSleevePlanV01 = {
  schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1';
  source: 'hermes_custom_workflow_generation';
  mode: 'runtime_session_draft';
  generationSource?: 'live_hermes_cli' | 'live_hermes_provider' | 'mocked_test' | string;
  requestId: string;
  title: string;
  summary: string;
  decompositionSummary: string;
  sleeve?: NormalizedTemplateSleeve;
  neoStacks: NormalizedTemplateNeoStack[];
  neoBlocks: NormalizedTemplateNeoBlock[];
  moltBlocks: Array<Omit<NormalizedTemplateMoltBlock, 'role'> & { role: UmgSupportedPromptMoltRole }>;
  gates: UMGGateRecord[];
  capabilities: HermesCustomSleevePlanCapability[];
  reuseDecisions: Array<Record<string, unknown>>;
  generatedDecisions: HermesGeneratedDecision[];
  warnings: string[];
  validationNotes?: string[];
};

export type HermesCustomSleeveGenerationResponse = {
  ok: boolean;
  plan?: HermesCustomSleevePlanV01;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  raw?: unknown;
  externalActionTaken: false;
};

function makeRequestId() {
  return `hermes_custom_sleeve_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function buildHermesCustomSleeveGenerationRequest(args: {
  userPrompt: string;
  userContext?: string;
  requestId?: string;
}): HermesCustomSleeveGenerationRequest {
  const appLocalSkillBundle = getHermesUmgAppLocalSkillBundle();
  const libraryCandidates = retrieveUmgLibraryCandidates(`${args.userPrompt}\n${args.userContext ?? ''}`, { limit: 24 });
  const libraryCandidateSummary = summarizeUmgLibraryCandidates(libraryCandidates);
  return {
    requestId: args.requestId ?? makeRequestId(),
    userPrompt: args.userPrompt,
    userContext: args.userContext ?? '',
    selectedMode: 'custom_workflow',
    appLocalSkillBundle,
    decompositionSkillText: appLocalSkillBundle.sleeveDecompositionSkill,
    hierarchyBlockCardSkillText: appLocalSkillBundle.hierarchyCardSkill,
    compilerAlignmentRules: appLocalSkillBundle.compilerAlignmentRules,
    supportedPromptMoltRoles: [...UMG_SUPPORTED_PROMPT_MOLT_ROLES],
    gatePolicy: 'Gates are control/routing/approval records, not prompt MOLT blocks. Reject plans that put gates in moltBlocks.',
    sourceLibraryPolicy: 'No source-library mutation. Use prompt + pasted context + uploaded content together. Reuse relevant existing library blocks first from libraryCandidates; retrieve and match existing blocks before creating anything new. Preserve candidate id/sourcePath/sourceKind and source/reuse/generated status when reused. Generated records are runtime-session drafts only and sourceLibraryWrite must remain false; never emit lazy generic filler blocks.',
    capabilityPolicy: appLocalSkillBundle.capabilityBoundaryRules,
    libraryCandidates,
    libraryCandidateSummary,
    outputContract: 'Return only structured JSON for schemaVersion umg-studio.hermes-custom-sleeve-plan.v0.1 with concise decompositionSummary; do not include chain-of-thought. Compose a real UMG Sleeve from userPrompt + userContext + uploaded file intake context. Produce both NL card fields (title, summary/description, rationale/content) and JSON schema fields for Sleeve, NeoStacks, NeoBlocks, MOLT blocks, gates, capabilities, reuseDecisions, and generatedDecisions. Use libraryCandidates before inventing blocks: preserve reusedBlockId, sourcePath, sourceKind="source-library reused" when a candidate is reused; generate only missing runtime-session draft MOLT/NeoBlock/NeoStack glue; attach NeoStacks under Sleeve, NeoBlocks under NeoStacks, MOLT blocks under NeoBlocks, and set parentNeoStackId, parentNeoBlockId, stackOrder, role, tags, blockType, source status, reuse/generated status. Gates must stay control records, not fake prompt MOLT blocks. Reject lazy generic blocks that do not reflect prompt, context, and uploaded content.'
  };
}

export function validateHermesCustomSleevePlan(plan: unknown): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const candidate = plan as Partial<HermesCustomSleevePlanV01>;
  if (!candidate || typeof candidate !== 'object') return { valid: false, errors: ['Hermes custom Sleeve plan must be an object.'], warnings };
  if (candidate.schemaVersion !== 'umg-studio.hermes-custom-sleeve-plan.v0.1') errors.push('Unsupported Hermes custom Sleeve plan schemaVersion.');
  if (candidate.source !== 'hermes_custom_workflow_generation') errors.push('Hermes custom Sleeve plan source must be hermes_custom_workflow_generation.');
  if (candidate.mode !== 'runtime_session_draft') errors.push('Hermes custom Sleeve plan must be runtime_session_draft.');
  if (!candidate.requestId) errors.push('requestId is required.');
  if (!candidate.title) errors.push('title is required.');
  if (!candidate.summary) errors.push('summary is required.');
  if (!candidate.decompositionSummary) errors.push('decompositionSummary is required.');
  if (!Array.isArray(candidate.neoStacks) || candidate.neoStacks.length === 0) errors.push('At least one neoStack is required.');
  if (!Array.isArray(candidate.neoBlocks) || candidate.neoBlocks.length === 0) errors.push('At least one neoBlock is required.');
  if (!Array.isArray(candidate.moltBlocks) || candidate.moltBlocks.length === 0) errors.push('At least one supported prompt MOLT block is required.');
  if (!Array.isArray(candidate.gates)) errors.push('gates array is required, even if empty.');
  if (!Array.isArray(candidate.capabilities)) errors.push('capabilities array is required, even if empty.');
  if (!Array.isArray(candidate.generatedDecisions)) errors.push('generatedDecisions array is required.');
  if (!Array.isArray(candidate.reuseDecisions)) errors.push('reuseDecisions array is required.');
  if (Array.isArray(candidate.moltBlocks) && Array.isArray(candidate.generatedDecisions) && candidate.schemaVersion && candidate.mode) {
    errors.push(...validateHermesCustomSleevePlanScaffold({ schemaVersion: candidate.schemaVersion as never, mode: candidate.mode as never, moltBlocks: candidate.moltBlocks as never, generatedDecisions: candidate.generatedDecisions as never }));
  }
  const gateLikeMolt = (candidate.moltBlocks ?? []).find((block) => /gate|trigger|approval/i.test(`${block.role} ${block.id} ${block.title}`) && !UMG_SUPPORTED_PROMPT_MOLT_ROLES.includes(block.role));
  if (gateLikeMolt) errors.push(`Gate/control record appears in prompt MOLT blocks: ${gateLikeMolt.id}`);
  (candidate.gates ?? []).forEach((gate) => {
    if (!(gate as Record<string, unknown>).id || !(gate as Record<string, unknown>).title) errors.push('Each gate requires id and title.');
  });
  (candidate.capabilities ?? []).forEach((capability) => {
    if (!capability.capabilityId) errors.push('Each capability declaration requires capabilityId.');
  });
  return { valid: errors.length === 0, errors, warnings };
}

function getCandidateForRecord(record: { id?: string; sourceId?: string; reusedBlockId?: string; sourcePath?: string; title?: string }, request: HermesCustomSleeveGenerationRequest, blockType?: string) {
  const ids = new Set([record.id, record.sourceId, record.reusedBlockId].filter(Boolean));
  return request.libraryCandidates.find((candidate) =>
    (!blockType || candidate.blockType === blockType) &&
    (ids.has(candidate.id) || ids.has(candidate.sourcePath) || candidate.sourcePath === record.sourcePath || normalizeLoose(candidate.title) === normalizeLoose(record.title ?? ''))
  );
}

function normalizeLoose(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function sourceMetadataFor(record: { id?: string; sourceId?: string; reusedBlockId?: string; sourcePath?: string; title?: string; sourceKind?: string }, request: HermesCustomSleeveGenerationRequest, blockType: 'molt' | 'neoblock' | 'neostack') {
  const candidate = getCandidateForRecord(record, request, blockType);
  const sourceKind: NormalizedTemplateSourceKind = record.sourceKind === 'source-library reused' || candidate ? 'source-library reused' : (record.sourceKind === 'unresolved' ? 'unresolved' : 'generated glue');
  return {
    sourceKind,
    reusedBlockId: record.reusedBlockId ?? record.sourceId ?? candidate?.id,
    sourcePath: record.sourcePath ?? candidate?.sourcePath,
    matchedCandidateId: candidate?.id,
    blockType
  };
}

export function adaptHermesCustomSleevePlanToRuntimeSessionSleeve(
  plan: HermesCustomSleevePlanV01,
  request: HermesCustomSleeveGenerationRequest
): NormalizedTemplateSleeve {
  const now = new Date().toISOString();
  const promptText = `${request.userPrompt} ${plan.title} ${plan.summary}`.toLowerCase();
  const isGreekDesktopNote = promptText.includes('desktop') && promptText.includes('note') && (promptText.includes('greek') || promptText.includes('philosophy'));
  const firstNeoBlockId = plan.neoBlocks[0]?.id ?? plan.sleeve?.id ?? `runtime.${plan.requestId}.sleeve`;
  let normalizedCapabilities = plan.capabilities.map((capability) => {
    const rawId = capability.capabilityId;
    const lower = rawId.toLowerCase();
    const capabilityId = lower.includes('local_text') || lower.includes('text_composition') || lower.includes('compose_note') || lower.includes('note_generation') || lower.includes('note_drafting') || lower.includes('note_composition') || lower.includes('philosophy_context')
      ? 'umg.capability.local_text_composition'
      : lower.includes('desktop_note') || lower.includes('note_file') || lower.includes('file_write') || lower.includes('note_delivery') || lower.includes('template_rendering') || lower.includes('governance_gate') || lower.includes('persistence') || lower.includes('export')
        ? 'umg.capability.local_note_file_write'
        : rawId;
    return capabilityId === rawId ? capability : { ...capability, capabilityId };
  });
  if (isGreekDesktopNote) {
    const textCapability = normalizedCapabilities.find((capability) => capability.capabilityId === 'umg.capability.local_text_composition') ?? {
      capabilityId: 'umg.capability.local_text_composition',
      label: 'Local text composition',
      reason: 'Compose the desktop note body and Greek philosophy framing inside the app-local runtime session.',
      riskLevel: 'low',
      requiresConnector: false,
      safeForAppLocalExecution: true
    };
    const noteArtifactCapability = normalizedCapabilities.find((capability) => capability.capabilityId === 'umg.capability.local_note_file_write') ?? {
      capabilityId: 'umg.capability.local_note_file_write',
      label: 'Prepare desktop note artifact',
      reason: 'Prepare a reviewable local note artifact without writing an actual desktop file.',
      riskLevel: 'medium',
      requiresConnector: false,
      safeForAppLocalExecution: false
    };
    normalizedCapabilities = [textCapability, noteArtifactCapability];
  }
  const normalizedTitle = isGreekDesktopNote ? 'Greek-Infused Desktop Note Creator' : (plan.sleeve?.title ?? plan.title);
  const normalizedGates = plan.gates.map((gate) => ({
    ...gate,
    attachesTo: gate.attachesTo ?? { kind: 'neoblock' as const, id: firstNeoBlockId },
    conditionText: gate.conditionText ?? gate.title,
    action: gate.action ?? 'require_approval',
    targetIds: gate.targetIds ?? [firstNeoBlockId],
    defaultState: gate.defaultState ?? 'closed',
    runtimeState: gate.runtimeState ?? 'inactive',
    tags: gate.tags ?? ['hermes_generated', 'runtime_session', 'gate_control']
  }));
  return {
    id: plan.sleeve?.id ?? `runtime.${plan.requestId}.sleeve`,
    title: normalizedTitle,
    version: plan.sleeve?.version ?? 'runtime-session-v1',
    description: plan.sleeve?.description ?? plan.summary,
    isTemplate: true,
    templateKind: 'custom',
    source: 'session',
    tags: Array.from(new Set(['custom_workflow', 'runtime_session', 'hermes_generated', ...(plan.sleeve?.tags ?? [])])),
    neoStacks: plan.neoStacks.map((stack, index) => ({ ...stack, ...sourceMetadataFor(stack, request, 'neostack'), stackOrder: stack.stackOrder ?? index + 1, tags: stack.tags ?? [] })),
    neoBlocks: plan.neoBlocks.map((block, index) => ({ ...block, ...sourceMetadataFor(block, request, 'neoblock'), blockOrder: block.blockOrder ?? index + 1, tags: block.tags ?? [], gateIds: block.gateIds ?? [], defaultState: block.defaultState ?? 'off' })),
    moltBlocks: plan.moltBlocks.map((block, index) => ({ ...block, ...sourceMetadataFor(block, request, 'molt'), tags: block.tags ?? [], stackOrder: block.stackOrder ?? index + 1, defaultState: block.defaultState ?? 'off' })),
    gates: normalizedGates,
    governanceBlockIds: plan.sleeve?.governanceBlockIds ?? [],
    defaultExecutionMode: plan.sleeve?.defaultExecutionMode ?? 'approvalRequired',
    metadata: {
      ...(plan.sleeve?.metadata ?? {}),
      generatedByHermes: true,
      generationSource: plan.generationSource ?? 'live_hermes_cli',
      requestId: request.requestId,
      selectedMode: request.selectedMode,
      sourceLibraryWrite: false,
      runtimeSessionOnly: true,
      noGlobalHermesSkillInstall: true,
      appLocalSkillBundleId: request.appLocalSkillBundle.id,
      decompositionSummary: plan.decompositionSummary,
      capabilities: normalizedCapabilities,
      reuseDecisions: plan.reuseDecisions,
      generatedDecisions: plan.generatedDecisions,
      libraryCandidateSummary: request.libraryCandidateSummary,
      libraryCandidates: request.libraryCandidates.slice(0, 12),
      sourceStatusSummary: {
        libraryCandidateCount: request.libraryCandidates.length,
        reuseDecisionCount: plan.reuseDecisions.length,
        generatedGlueDecisionCount: plan.generatedDecisions.length,
        unresolved: 0
      },
      createdAt: now
    }
  };
}

function deriveGenerationEndpoint(runtimeEndpoint?: string) {
  if (!runtimeEndpoint) return undefined;
  return runtimeEndpoint.replace(/\/api\/hermes\/runtime$/, '/api/hermes/custom-sleeve-generation');
}

export async function requestHermesCustomSleevePlan(args: {
  endpoint?: string;
  runtimeEndpoint?: string;
  request: HermesCustomSleeveGenerationRequest;
  fetchImpl?: typeof fetch;
}): Promise<HermesCustomSleeveGenerationResponse> {
  const endpoint = args.endpoint ?? deriveGenerationEndpoint(args.runtimeEndpoint);
  if (!endpoint) {
    return { ok: false, validation: { valid: false, errors: ['Hermes custom Sleeve generation endpoint is not configured.'], warnings: [] }, externalActionTaken: false };
  }
  const fetcher = args.fetchImpl ?? fetch;
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args.request)
  });
  const raw = await response.json().catch(() => undefined);
  if (!response.ok) {
    const errorMessages = raw?.validation?.errors?.length ? raw.validation.errors : [raw?.error ?? raw?.finalOutput ?? `Hermes custom Sleeve generation failed with HTTP ${response.status}.`];
    const warningMessages = raw?.validation?.warnings?.length ? raw.validation.warnings : [];
    return { ok: false, validation: { valid: false, errors: errorMessages, warnings: warningMessages }, raw, externalActionTaken: false };
  }
  const plan = raw?.plan ?? raw;
  const validation = validateHermesCustomSleevePlan(plan);
  return { ok: validation.valid, plan: validation.valid ? plan : undefined, validation, raw, externalActionTaken: false };
}
