import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve, NormalizedTemplateSourceKind } from './templateSleeveStructures';
import { getHermesUmgAppLocalSkillBundle, UMG_SUPPORTED_PROMPT_MOLT_ROLES, type HermesUmgAppLocalSkillBundle, type UmgSupportedPromptMoltRole } from './hermesUmgSkillBundle';
import { retrieveUmgLibraryCandidates, summarizeUmgLibraryCandidates, type UmgLibraryCandidate } from './umgLibraryCandidateRetrieval';
import { validateHermesCustomSleevePlanScaffold } from './hermesSleevePlanSchema';
import { buildExpandedRetrievalQuery, buildIntakeDiagnostics, buildUploadedContextNarrative, type UploadedIntakeContext } from './intakeSemanticExtraction';
import { getHermesNativeToolBlockByCapability } from './nativeHermesToolBlocks';

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
  uploadedIntakeContexts: UploadedIntakeContext[];
  expandedRetrievalQuery: string;
  intakeDiagnostics: ReturnType<typeof buildIntakeDiagnostics>;
  libraryCandidates: UmgLibraryCandidate[];
  libraryCandidateSummary: ReturnType<typeof summarizeUmgLibraryCandidates>;
  outputContract: string;
};

export type HermesCustomSleevePlanCapability = {
  capabilityId: string;
  id?: string;
  capability?: string;
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
  uploadedContexts?: UploadedIntakeContext[];
  requestId?: string;
}): HermesCustomSleeveGenerationRequest {
  const appLocalSkillBundle = getHermesUmgAppLocalSkillBundle();
  const uploadedIntakeContexts = args.uploadedContexts ?? [];
  const uploadedNarrative = uploadedIntakeContexts.length ? buildUploadedContextNarrative(uploadedIntakeContexts) : '';
  const userContext = [args.userContext ?? '', uploadedNarrative].filter(Boolean).join('\n\n');
  const expandedRetrievalQuery = buildExpandedRetrievalQuery({ prompt: args.userPrompt, pastedContext: args.userContext, uploadedContexts: uploadedIntakeContexts });
  const libraryCandidates = retrieveUmgLibraryCandidates(expandedRetrievalQuery, { limit: 24 });
  const libraryCandidateSummary = summarizeUmgLibraryCandidates(libraryCandidates);
  const intakeDiagnostics = buildIntakeDiagnostics({
    prompt: args.userPrompt,
    pastedContext: args.userContext,
    uploadedContexts: uploadedIntakeContexts,
    expandedRetrievalQuery,
    candidateCount: libraryCandidates.length,
    topCandidates: libraryCandidates.slice(0, 8).map((candidate) => ({ id: candidate.id, title: candidate.title, role: candidate.role, domain: candidate.domain, blockType: candidate.blockType, matchReasons: candidate.matchReasons }))
  });
  return {
    requestId: args.requestId ?? makeRequestId(),
    userPrompt: args.userPrompt,
    userContext,
    selectedMode: 'custom_workflow',
    appLocalSkillBundle,
    decompositionSkillText: appLocalSkillBundle.sleeveDecompositionSkill,
    hierarchyBlockCardSkillText: appLocalSkillBundle.hierarchyCardSkill,
    compilerAlignmentRules: appLocalSkillBundle.compilerAlignmentRules,
    supportedPromptMoltRoles: [...UMG_SUPPORTED_PROMPT_MOLT_ROLES],
    gatePolicy: 'Gates are control/routing/approval records, not prompt MOLT blocks. Reject plans that put gates in moltBlocks.',
    sourceLibraryPolicy: 'No source-library mutation. Use prompt + pasted context + uploaded content together. Reuse relevant existing library blocks first from libraryCandidates; retrieve and match existing blocks before creating anything new. Preserve candidate id/sourcePath/sourceKind and source/reuse/generated status when reused. Generated records are runtime-session drafts only and sourceLibraryWrite must remain false; never emit lazy generic filler blocks.',
    capabilityPolicy: appLocalSkillBundle.capabilityBoundaryRules,
    uploadedIntakeContexts,
    expandedRetrievalQuery,
    intakeDiagnostics,
    libraryCandidates,
    libraryCandidateSummary,
    outputContract: 'You are not merely producing a workflow outline. You are composing a UMG hierarchy: Sleeve → NeoStacks → NeoBlocks → MOLT roles → Gates → Capabilities. Return only structured JSON for schemaVersion umg-studio.hermes-custom-sleeve-plan.v0.1 with concise decompositionSummary; do not include chain-of-thought. Compose a real UMG Sleeve from userPrompt + userContext + uploadedIntakeContexts. Uploaded content must influence block selection and block generation; if uploaded content is unsupported or unreadable, say so and do not invent file contents. Use source-library candidates first from the supplied libraryCandidates array and reuse relevant source blocks when they fit; create only missing runtime-session draft blocks. Every generated MOLT draft must include id, title, role, content, description, tags, sourceKind="runtime-session draft" or "generated glue", stackOrder, optional jsonSchema, and nlCard {title, role, category, tags, description, content}. Every NeoBlock must contain meaningful MOLT layers and include id, title, purpose/description, parentNeoStackId or neoStackId, stackOrder/blockOrder, moltBlocks or moltBlockIds, gates, capabilities, sourceKind, nlCard, and jsonSchema. Every NeoStack must contain meaningful NeoBlocks and include id, title, purpose/description, stackOrder, neoBlocks or neoBlockIds, sourceKind, nlCard, and jsonSchema. Every Sleeve must explain why each NeoStack exists. Produce both NL card fields and JSON schema fields. Preserve reusedBlockId, sourcePath, sourceKind="source-library reused" when a candidate is reused. Gates must stay control records, not fake prompt MOLT blocks. Do not claim source-library mutation. Do not write files. Do not emit lazy generic blocks such as Process Task unless the prompt truly only supports that.'
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
    if (!String(capability.capabilityId ?? capability.id ?? capability.capability ?? capability.label ?? '').trim()) errors.push('Each capability declaration requires capabilityId.');
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
    matchedCandidateId: candidate?.id ?? record.reusedBlockId ?? record.sourceId,
    blockType
  };
}

function normalizedMoltRole(value?: string): NormalizedTemplateMoltBlock['role'] {
  const role = String(value ?? '').toLowerCase();
  if (role === 'instruction' || role === 'subject' || role === 'primary' || role === 'philosophy' || role === 'blueprint' || role === 'meta') return role;
  return 'directive';
}

function asMoltChildFromLibraryCandidate(candidate: UmgLibraryCandidate, parentNeoBlockId: string, parentNeoStackId: string, index: number): NormalizedTemplateMoltBlock {
  return {
    id: candidate.id,
    sourceId: candidate.id,
    title: candidate.title,
    role: normalizedMoltRole(candidate.role),
    content: candidate.description || candidate.title,
    tags: Array.from(new Set([...(candidate.tags ?? []), 'source-library', 'reused'])),
    parentNeoBlockId,
    parentNeoStackId,
    stackOrder: index + 1,
    sourceKind: 'source-library reused',
    reusedBlockId: candidate.id,
    matchedCandidateId: candidate.id,
    sourcePath: candidate.sourcePath,
    blockType: 'molt',
    defaultState: 'off'
  };
}

function createMetaMoltToolChild(capability: HermesCustomSleevePlanCapability, parentNeoBlockId: string, parentNeoStackId: string, index: number): NormalizedTemplateMoltBlock | undefined {
  const rawId = String(capability.capabilityId ?? capability.id ?? capability.capability ?? capability.label ?? '').toLowerCase();
  const nativeCapabilityId = rawId.includes('note') ? 'umg.native.hermes.note_create'
    : rawId.includes('file') || rawId.includes('write') || rawId.includes('persistence') || rawId.includes('export') ? 'umg.native.hermes.file_write'
      : rawId.includes('read') ? 'umg.native.hermes.file_read'
        : rawId.includes('shell') || rawId.includes('terminal') || rawId.includes('command') ? 'umg.native.hermes.shell_command'
          : rawId.includes('project') || rawId.includes('edit') ? 'umg.native.hermes.project_edit'
            : rawId.includes('hermes') || rawId.includes('runtime') || rawId.includes('tool') || rawId.includes('capability') ? 'umg.native.hermes.runtime_task'
              : undefined;
  if (!nativeCapabilityId) return undefined;
  const tool = getHermesNativeToolBlockByCapability(nativeCapabilityId);
  if (!tool) return undefined;
  return {
    id: tool.id,
    sourceId: tool.id,
    title: tool.title,
    role: 'meta',
    content: tool.content ?? tool.description ?? tool.title,
    tags: Array.from(new Set([...(tool.tags ?? []), 'metamolt', 'tool', 'hermes', 'capability'])),
    parentNeoBlockId,
    parentNeoStackId,
    stackOrder: 10_000 + index,
    sourceKind: 'metamolt tool',
    reusedBlockId: tool.id,
    matchedCandidateId: tool.id,
    sourcePath: tool.sourcePath,
    blockType: 'capability',
    defaultState: 'off',
    sourceNotes: [`Attached for capability ${capability.capabilityId ?? capability.label}`]
  };
}

function bindPlanMoltChildrenToNeoBlocks(plan: HermesCustomSleevePlanV01, request: HermesCustomSleeveGenerationRequest, capabilities: HermesCustomSleevePlanCapability[]) {
  const firstBlock = plan.neoBlocks[0];
  const firstBlockId = firstBlock?.id ?? plan.sleeve?.id ?? `runtime.${plan.requestId}.neoblock`;
  const firstStackId = firstBlock?.neoStackId ?? (firstBlock as Record<string, unknown> | undefined)?.parentNeoStackId as string | undefined ?? plan.neoStacks[0]?.id ?? `runtime.${plan.requestId}.neostack`;
  const existing = new Map<string, NormalizedTemplateMoltBlock>();
  plan.moltBlocks.forEach((block, index) => {
    const parentNeoBlockId = block.parentNeoBlockId ?? firstBlockId;
    const parentNeoStackId = block.parentNeoStackId ?? plan.neoBlocks.find((candidate) => candidate.id === parentNeoBlockId)?.neoStackId ?? firstStackId;
    existing.set(block.id, {
      ...block,
      ...sourceMetadataFor(block, request, 'molt'),
      role: normalizedMoltRole(block.role),
      content: block.content || (block as { description?: string }).description || block.title,
      tags: block.tags ?? [],
      parentNeoBlockId,
      parentNeoStackId,
      stackOrder: block.stackOrder ?? index + 1,
      defaultState: block.defaultState ?? 'off'
    });
  });
  plan.reuseDecisions.forEach((decision, index) => {
    const record = decision as { id?: string; sourceId?: string; reusedBlockId?: string; matchedCandidateId?: string; targetNeoBlockId?: string; parentNeoBlockId?: string; targetNeoStackId?: string; parentNeoStackId?: string; title?: string };
    const candidateId = record.matchedCandidateId ?? record.reusedBlockId ?? record.sourceId ?? record.id;
    const candidate = request.libraryCandidates.find((entry) => entry.blockType === 'molt' && (entry.id === candidateId || entry.sourcePath === candidateId || normalizeLoose(entry.title) === normalizeLoose(record.title ?? '')));
    if (!candidate || existing.has(candidate.id)) return;
    const parentNeoBlockId = record.targetNeoBlockId ?? record.parentNeoBlockId ?? firstBlockId;
    const parentNeoStackId = record.targetNeoStackId ?? record.parentNeoStackId ?? plan.neoBlocks.find((block) => block.id === parentNeoBlockId)?.neoStackId ?? firstStackId;
    existing.set(candidate.id, asMoltChildFromLibraryCandidate(candidate, parentNeoBlockId, parentNeoStackId, plan.moltBlocks.length + index));
  });
  capabilities.forEach((capability, index) => {
    const parentNeoBlockId = firstBlockId;
    const parentNeoStackId = plan.neoBlocks.find((block) => block.id === parentNeoBlockId)?.neoStackId ?? firstStackId;
    const toolChild = createMetaMoltToolChild(capability, parentNeoBlockId, parentNeoStackId, index);
    if (toolChild && !existing.has(toolChild.id)) existing.set(toolChild.id, toolChild);
  });
  return Array.from(existing.values()).sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
}

export function buildCompositionSourceDiagnostics(args: { sleeve?: NormalizedTemplateSleeve; request?: HermesCustomSleeveGenerationRequest; route: 'live Hermes' | 'offline template' | 'intake draft'; reasonIfNotEligible?: string }) {
  const sleeve = args.sleeve;
  const moltBlocks = sleeve?.moltBlocks ?? [];
  const boundMoltCount = moltBlocks.filter((block) => block.sourceKind === 'source-library reused' || block.sourceKind === 'metamolt tool' || block.sourceKind === 'runtime-session draft' || block.sourceKind === 'generated glue').length;
  const sourceLibraryBoundCount = moltBlocks.filter((block) => block.sourceKind === 'source-library reused').length;
  const unresolvedCount = moltBlocks.filter((block) => block.sourceKind === 'unresolved').length;
  const compileEligible = args.route === 'live Hermes' && Boolean(sleeve?.metadata?.generatedByHermes) && Boolean(sleeve?.neoStacks.length && sleeve.neoBlocks.length && sleeve.moltBlocks.length);
  return {
    generationRoute: args.route,
    libraryRetrieval: args.request ? 'ran' : 'skipped',
    candidateCount: args.request?.libraryCandidates.length ?? 0,
    topCandidates: args.request?.libraryCandidates.slice(0, 5).map((candidate) => ({ id: candidate.id, title: candidate.title, role: candidate.role, blockType: candidate.blockType, sourcePath: candidate.sourcePath })) ?? [],
    selectedBoundCandidates: moltBlocks.filter((block) => block.matchedCandidateId || block.sourcePath).slice(0, 8).map((block) => ({ id: block.id, title: block.title, role: block.role, sourceKind: block.sourceKind, matchedCandidateId: block.matchedCandidateId, sourcePath: block.sourcePath })),
    boundMoltCount,
    boundNeoBlockCount: sleeve?.neoBlocks.length ?? 0,
    boundNeoStackCount: sleeve?.neoStacks.length ?? 0,
    metaMoltToolBlockCount: moltBlocks.filter((block) => block.sourceKind === 'metamolt tool').length,
    generatedDraftCount: moltBlocks.filter((block) => block.sourceKind === 'runtime-session draft' || block.sourceKind === 'generated glue').length,
    unresolvedCount,
    sourceBindingStatus: !sleeve ? 'missing' : sourceLibraryBoundCount === 0 ? 'missing' : unresolvedCount > 0 ? 'partial' : 'complete',
    compileEligibility: compileEligible ? 'yes' : 'no',
    reasonIfNotEligible: compileEligible ? undefined : args.reasonIfNotEligible ?? 'ActiveSessionSleeve is only compileable after live Hermes composition binds library/runtime MOLT children.'
  };
}

export function isActiveSessionSleeveCompileEligible(sleeve?: NormalizedTemplateSleeve) {
  return buildCompositionSourceDiagnostics({ sleeve, route: sleeve?.metadata?.generatedByHermes ? 'live Hermes' : 'intake draft' }).compileEligibility === 'yes';
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
    const rawId = String(capability.capabilityId ?? capability.id ?? capability.capability ?? capability.label ?? 'umg.capability.local_workflow_draft').trim() || 'umg.capability.local_workflow_draft';
    const lower = rawId.toLowerCase();
    const capabilityId = lower.includes('local_text') || lower.includes('text_composition') || lower.includes('compose_note') || lower.includes('note_generation') || lower.includes('note_drafting') || lower.includes('note_composition') || lower.includes('philosophy_context')
      ? 'umg.capability.local_text_composition'
      : lower.includes('desktop_note') || lower.includes('note_file') || lower.includes('file_write') || lower.includes('note_delivery') || lower.includes('template_rendering') || lower.includes('governance_gate') || lower.includes('persistence') || lower.includes('export')
        ? 'umg.capability.local_note_file_write'
        : rawId;
    const label = capability.label ?? capability.capability ?? capability.id ?? capabilityId;
    return { ...capability, capabilityId, label };
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
  const boundMoltBlocks = bindPlanMoltChildrenToNeoBlocks(plan, request, normalizedCapabilities);
  const moltIdsByNeoBlock = boundMoltBlocks.reduce((acc, molt) => {
    if (!molt.parentNeoBlockId) return acc;
    const ids = acc.get(molt.parentNeoBlockId) ?? [];
    ids.push(molt.id);
    acc.set(molt.parentNeoBlockId, ids);
    return acc;
  }, new Map<string, string[]>());
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
    neoBlocks: plan.neoBlocks.map((block, index) => {
      const boundIds = moltIdsByNeoBlock.get(block.id) ?? [];
      return { ...block, ...sourceMetadataFor(block, request, 'neoblock'), blockOrder: block.blockOrder ?? index + 1, tags: block.tags ?? [], moltBlockIds: Array.from(new Set([...(block.moltBlockIds ?? []), ...boundIds])), gateIds: block.gateIds ?? [], defaultState: block.defaultState ?? 'off' };
    }),
    moltBlocks: boundMoltBlocks,
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
        boundMoltCount: boundMoltBlocks.length,
        boundNeoBlockCount: plan.neoBlocks.length,
        boundNeoStackCount: plan.neoStacks.length,
        metaMoltToolBlockCount: boundMoltBlocks.filter((block) => block.sourceKind === 'metamolt tool').length,
        unresolved: boundMoltBlocks.filter((block) => block.sourceKind === 'unresolved').length
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
  const bridgeRequest = {
    ...args.request,
    appLocalSkillBundle: {
      id: args.request.appLocalSkillBundle.id,
      title: args.request.appLocalSkillBundle.title,
      version: args.request.appLocalSkillBundle.version,
      supportedPromptMoltRoles: args.request.appLocalSkillBundle.supportedPromptMoltRoles,
      sourceLibraryBoundaryRules: args.request.appLocalSkillBundle.sourceLibraryBoundaryRules,
      capabilityBoundaryRules: args.request.appLocalSkillBundle.capabilityBoundaryRules
    },
    decompositionSkillText: 'Decompose Custom Workflow prompt + pasted/uploaded context into Sleeve → NeoStacks → NeoBlocks → MOLT. Use library candidates first. Generate only missing runtime-session draft blocks. Keep Gates as control records and never mutate source libraries.',
    hierarchyBlockCardSkillText: 'UMG hierarchy: Sleeve contains NeoStacks; NeoStacks contain NeoBlocks; NeoBlocks contain MOLT role cards plus Gates/Capabilities. Generated stacks, blocks, and MOLT cards must include NL card fields and JSON schema fields.',
    compilerAlignmentRules: 'Current compiler-supported prompt MOLT roles: directive, instruction, subject, primary, philosophy, blueprint. Gates are UMGGateRecord/control records, not prompt MOLT records.',
    libraryCandidates: args.request.libraryCandidates.slice(0, 8).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      blockType: candidate.blockType,
      role: candidate.role,
      tags: candidate.tags,
      description: candidate.description,
      domain: candidate.domain,
      category: candidate.category,
      sourcePath: candidate.sourcePath,
      sourceKind: candidate.sourceKind,
      compatibility: candidate.compatibility,
      score: candidate.score,
      matchReasons: candidate.matchReasons
    }))
  };
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(bridgeRequest)
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
