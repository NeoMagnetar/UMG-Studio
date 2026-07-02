import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve, NormalizedTemplateSourceKind } from './templateSleeveStructures';
import { getHermesUmgAppLocalSkillBundle, UMG_SUPPORTED_PROMPT_MOLT_ROLES, type HermesUmgAppLocalSkillBundle, type UmgSupportedPromptMoltRole } from './hermesUmgSkillBundle';
import { retrieveRoleTargetedUmgLibraryCandidates, summarizeUmgLibraryCandidates, umgLibraryIndexInfo, type UmgLibraryCandidate, type UmgLibraryCandidatesByRole, type UmgLibraryCandidateRoleBucket } from './umgLibraryCandidateRetrieval';
import { validateHermesCustomSleevePlanScaffold } from './hermesSleevePlanSchema';
import { buildExpandedRetrievalQuery, buildIntakeDiagnostics, buildUploadedContextNarrative, type UploadedIntakeContext } from './intakeSemanticExtraction';
import { getHermesNativeToolBlockByCapability } from './nativeHermesToolBlocks';
import { getOverlayById, inferRoutingOverlaysFromContext, type OverlayInferenceResult } from './overlayLattice';

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
  candidatesByRole: UmgLibraryCandidatesByRole;
  missingRoles: UmgLibraryCandidateRoleBucket[];
  rejectedCandidateIds: string[];
  libraryCandidateSummary: ReturnType<typeof summarizeUmgLibraryCandidates>;
  overlayInference: OverlayInferenceResult;
  overlayBoostedTags: string[];
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

export type HermesStructuralIR = {
  sleeve: Record<string, unknown>;
  neoStacks: Array<Record<string, unknown>>;
  neoBlocks: Array<Record<string, unknown>>;
  moltLayers: Array<Record<string, unknown>>;
  mergeOps: Array<Record<string, unknown>>;
  gates: Array<Record<string, unknown>>;
  toolBlocks: Array<Record<string, unknown>>;
  routes: Array<Record<string, unknown>>;
};

export type HermesStructuralAuditResult = {
  passed: boolean;
  checks: Array<{ id: string; passed: boolean; notes: string }>;
  revisionRequired: boolean;
};

export type HermesCustomSleevePlanV01 = {
  schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1';
  source: 'hermes_custom_workflow_generation';
  mode: 'runtime_session_draft';
  generationSource?: 'live_hermes_cli' | 'live_hermes_provider' | 'mocked_test' | string;
  structuralIR: HermesStructuralIR;
  auditResult: HermesStructuralAuditResult;
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

const COMPETITOR_BRIDGE_PATTERN = /openclaw|langchain/i;
const HERMES_NATIVE_CANDIDATE_PATTERN = /hermes|metamolt|tool|note|file|runtime task|text document|documentation|aristotelian|stoic|platon/i;

export function promptExplicitlyRequestsCompetitorBridge(text: string) {
  return COMPETITOR_BRIDGE_PATTERN.test(text);
}

export function isCompetitorBridgeCandidate(candidate: Pick<UmgLibraryCandidate, 'id' | 'title' | 'description' | 'domain' | 'tags' | 'sourcePath' | 'matchReasons'>) {
  const haystack = [candidate.id, candidate.title, candidate.description, candidate.domain, candidate.sourcePath, ...(candidate.tags ?? []), ...(candidate.matchReasons ?? [])].filter(Boolean).join(' ');
  return COMPETITOR_BRIDGE_PATTERN.test(haystack);
}

export function rankHermesNativeCandidates(candidates: UmgLibraryCandidate[], query: string, limit = candidates.length) {
  const allowCompetitor = promptExplicitlyRequestsCompetitorBridge(query);
  return [...candidates]
    .filter((candidate) => allowCompetitor || !isCompetitorBridgeCandidate(candidate))
    .sort((a, b) => {
      const aText = [a.id, a.title, a.description, a.domain, ...(a.tags ?? [])].join(' ');
      const bText = [b.id, b.title, b.description, b.domain, ...(b.tags ?? [])].join(' ');
      const aHermes = HERMES_NATIVE_CANDIDATE_PATTERN.test(aText) ? 0 : 1;
      const bHermes = HERMES_NATIVE_CANDIDATE_PATTERN.test(bText) ? 0 : 1;
      return aHermes - bHermes;
    })
    .slice(0, limit);
}

function candidateOverlayBoost(candidate: UmgLibraryCandidate, boostedTags: string[], domainTerms: string[]) {
  const text = [candidate.id, candidate.title, candidate.description, candidate.domain, candidate.category, candidate.sourcePath, ...(candidate.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
  let boost = 0;
  boostedTags.forEach((tag) => {
    const term = tag.toLowerCase();
    if (term && (candidate.tags ?? []).map((entry) => entry.toLowerCase()).includes(term)) boost += 6;
    else if (term && text.includes(term)) boost += 3;
  });
  domainTerms.forEach((term) => {
    const normalized = term.toLowerCase();
    if (normalized && text.includes(normalized)) boost += normalized.length > 8 ? 8 : 5;
  });
  return boost;
}

function boostCandidatesForOverlays(candidates: UmgLibraryCandidate[], overlayInference: OverlayInferenceResult) {
  const selectedDefinitions = overlayInference.selectedOverlays.map((overlay) => getOverlayById(overlay.overlayId)).filter(Boolean) as NonNullable<ReturnType<typeof getOverlayById>>[];
  const boostedTags = Array.from(new Set(selectedDefinitions.flatMap((overlay) => overlay.boostedTags)));
  const domainTerms = Array.from(new Set(selectedDefinitions.flatMap((overlay) => overlay.triggerTerms))).filter((term) => term.length > 2);
  return {
    boostedTags,
    candidates: [...candidates]
      .map((candidate) => {
        const boost = candidateOverlayBoost(candidate, boostedTags, domainTerms);
        return boost > 0
          ? { ...candidate, score: candidate.score + boost, matchReasons: Array.from(new Set([...candidate.matchReasons, `overlay boost +${boost}`])) }
          : candidate;
      })
      .sort((a, b) => b.score - a.score)
  };
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
  const roleTargetedRetrieval = retrieveRoleTargetedUmgLibraryCandidates(expandedRetrievalQuery, { perRoleLimit: 8, combinedLimit: 48 });
  const overlayInference = inferRoutingOverlaysFromContext({
    prompt: args.userPrompt,
    uploadedText: userContext,
    candidateBlocks: roleTargetedRetrieval.candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      blockType: candidate.blockType,
      role: candidate.role,
      tags: candidate.tags,
      category: candidate.category,
      domain: candidate.domain,
      description: candidate.description,
      sourcePath: candidate.sourcePath,
      sourceKind: candidate.sourceKind,
      content: candidate.content
    }))
  });
  const overlayBoostedRetrieval = boostCandidatesForOverlays(roleTargetedRetrieval.candidates, overlayInference);
  const libraryCandidates = rankHermesNativeCandidates(overlayBoostedRetrieval.candidates, expandedRetrievalQuery, 48);
  const libraryCandidateSummary = summarizeUmgLibraryCandidates(libraryCandidates, roleTargetedRetrieval.candidatesByRole);
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
    candidatesByRole: roleTargetedRetrieval.candidatesByRole,
    missingRoles: roleTargetedRetrieval.missingRoles,
    rejectedCandidateIds: roleTargetedRetrieval.rejectedCandidateIds,
    libraryCandidateSummary,
    overlayInference,
    overlayBoostedTags: overlayBoostedRetrieval.boostedTags,
    outputContract: `STRUCTURAL IR COMPOSER CONTRACT: Hermes must generate UMG IR first, not a generic workflow outline that is converted later. Required order: 1 parse prompt/context/uploads; 2 search library candidates; 3 identify domain and action intent; 4 identify major kinds of work; 5 create NeoStacks from kinds of work; 6 create NeoBlocks as reusable modules inside each NeoStack; 7 place MOLT roles inside each NeoBlock; 8 add Merge operations where concepts/layers must fuse; 9 add Gates for validation/routing/approval/policy; 10 add MetaMOLT Tool Blocks for Hermes-native tool actions; 11 define route edges; 12 run audit pass; 13 revise failed geometry; 14 convert final IR into JSON; 15 return JSON only. UMG ontology: NeoStack = kind of work; NeoBlock = module or step inside that work; MOLT = atomic thought role inside the module; Merge = semantic/cognitive fusion operation; Gate = control/routing/approval object; MetaMOLT Tool Block = executable Hermes capability; Capability = runtime binding; Trace = what actually happened. Return a single JSON object with REQUIRED top-level structuralIR, auditResult, and final Sleeve JSON fields matching schemaVersion umg-studio.hermes-custom-sleeve-plan.v0.1. structuralIR must contain sleeve, neoStacks, neoBlocks, moltLayers, mergeOps, gates, toolBlocks, routes. auditResult must contain passed, checks, revisionRequired. Every NeoStack/NeoBlock/MOLT record must include a concise generationReason explaining why that line exists. Every generated MOLT draft must include id, title, role, content, description, tags, sourceKind="runtime-session draft" or "generated glue", stackOrder, optional jsonSchema, nlCard {title, role, category, tags, description, content}, and generationReason. Every NeoBlock must contain meaningful MOLT layers and include id, title, purpose/description, parentNeoStackId or neoStackId, stackOrder/blockOrder, moltBlocks or moltBlockIds, gates, capabilities, sourceKind, nlCard, jsonSchema, and generationReason. Every NeoStack must contain meaningful NeoBlocks and include id, title, purpose/description, stackOrder, neoBlocks or neoBlockIds, sourceKind, nlCard, jsonSchema, kindOfWork, and generationReason. Merge operations must be explicit in structuralIR.mergeOps when semantic/cognitive fusion occurs. Use source-library candidates first from the supplied libraryCandidates array and preserve reusedBlockId/matchedCandidateId/sourcePath/sourceKind="source-library reused" when reused. Gates are control records, not fake MOLT. MetaMOLT Tool Blocks attach to tool-using NeoBlocks. Include runtime trace expectations/routes for app-surface observation: after compile/run, trace events should map to Sleeve/NeoStack/NeoBlock/MOLT/Gate/Tool IDs so the Runtime Graph can light active blocks, grey unused blocks, and show Hermes terminal/cognitive execution as it happens without inventing activation. Do not write files, mutate source libraries, import Website Builder, or claim success without valid UMG structure. CALIBRATION EXAMPLE — GREEK DESKTOP NOTE SLEEVE: User prompt: workflow that creates and saves notes on my desktop in haiku form whenever prompted to generate a written text note, while integrating Greek philosophy into the note context and semantics. Correct structure: S.GREEK_NOTE.01 Greek Philosophy Desktop Note Sleeve. NeoStacks: NS.01 Prompt Intake and Note Triggering kindOfWork intake/request normalization/trigger detection with NB.01 Detect Note Generation Request and NB.02 Normalize Note Intent; NS.02 Greek Philosophical Lens Selection kindOfWork philosophical retrieval/worldview selection with NB.03 Retrieve Greek Philosophy Candidates and NB.04 Select Greek Lens; NS.03 Semantic Merge and Note Composition kindOfWork semantic fusion/meaning transformation/note generation with NB.05 Merge Philosophy into Note Semantics MERGE.GREEK_SEMANTIC_FRAME, NB.06 Merge Requested Form with Enriched Meaning MERGE.FORM_WITH_SEMANTICS, NB.07 Compose Final Note Draft MERGE.DRAFT_SYNTHESIS, NB.08 Validate Greek Integration G.GREEK_INTEGRATION_CHECK; NS.04 Desktop Note Emission and Hermes Native Execution kindOfWork output preparation/native Hermes tool invocation/verification with NB.09 Prepare Desktop Note Action using TOOL.HERMES.NOTE_CREATE.v0.1 and TOOL.HERMES.FILE_WRITE.v0.1 plus G.DESKTOP_WRITE_ACTION, and NB.10 Verify Note Creation with G.OUTPUT_VERIFICATION. Route: NB.01 ==> NB.02 ==> NB.03 ==> NB.04 ==> NB.05 ==> NB.06 ==> NB.07 ==> NB.08 ==> NB.09 ==> NB.10. Audit checklist: neostack_kind_of_work, stack_has_blocks, block_is_reusable_module, block_has_molt, molt_internal_layers, source_candidates_bound_as_molt_children, tool_blocks_attached, gates_are_control_objects, merge_ops_explicit, route_renderable, structure_inside_budget, runtime_graph_renderable_without_invented_geometry. If any audit item fails, revise structuralIR before returning JSON.`
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
  const structuralIR = (candidate as Record<string, unknown>).structuralIR as Record<string, unknown> | undefined;
  const auditResult = (candidate as Record<string, unknown>).auditResult as Record<string, unknown> | undefined;
  if (!structuralIR || typeof structuralIR !== 'object') errors.push('structuralIR is required before final Sleeve JSON.');
  else {
    for (const field of ['sleeve', 'neoStacks', 'neoBlocks', 'moltLayers', 'mergeOps', 'gates', 'toolBlocks', 'routes']) {
      if (!(field === 'sleeve' ? structuralIR[field] && typeof structuralIR[field] === 'object' : Array.isArray(structuralIR[field]))) errors.push(`structuralIR.${field} is required.`);
    }
  }
  if (!auditResult || typeof auditResult !== 'object') errors.push('auditResult is required.');
  else {
    if (auditResult.passed !== true) errors.push('auditResult.passed must be true after revision.');
    if (auditResult.revisionRequired !== false) errors.push('auditResult.revisionRequired must be false.');
    if (!Array.isArray(auditResult.checks) || auditResult.checks.length === 0) errors.push('auditResult.checks must be non-empty.');
  }
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
  (candidate.neoStacks ?? []).forEach((stack) => {
    const record = stack as Record<string, unknown>;
    if (!String(record.generationReason ?? record.reason ?? '').trim()) errors.push(`NeoStack ${String(record.id ?? '(unknown)')} requires generationReason.`);
  });
  (candidate.neoBlocks ?? []).forEach((block) => {
    const record = block as Record<string, unknown>;
    if (!String(record.generationReason ?? record.reason ?? '').trim()) errors.push(`NeoBlock ${String(record.id ?? '(unknown)')} requires generationReason.`);
  });
  (candidate.moltBlocks ?? []).forEach((block) => {
    const record = block as Record<string, unknown>;
    if (!String(record.generationReason ?? record.reason ?? '').trim()) errors.push(`MOLT ${String(record.id ?? '(unknown)')} requires generationReason.`);
  });
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

type JsonSchemaLike = Record<string, unknown>;

function isJsonSchemaLike(value: unknown): value is JsonSchemaLike {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function normalizeMoltJsonSchema(molt: { role?: string; title?: string; content?: string; sourceKind?: string; matchedCandidateId?: string; sourcePath?: string; jsonSchema?: unknown; schema?: unknown }, fallback: { jsonSchema?: unknown; schema?: unknown; role?: string; title?: string; content?: string; sourceKind?: string; matchedCandidateId?: string; sourcePath?: string } = {}): JsonSchemaLike {
  if (isJsonSchemaLike(molt.jsonSchema)) return molt.jsonSchema;
  if (isJsonSchemaLike(fallback.jsonSchema)) return fallback.jsonSchema;
  if (isJsonSchemaLike((molt as { schema?: unknown }).schema)) return (molt as { schema?: JsonSchemaLike }).schema as JsonSchemaLike;
  if (isJsonSchemaLike(fallback.schema)) return fallback.schema;
  const role = String(molt.role ?? fallback.role ?? 'molt');
  const sourceKind = String(molt.sourceKind ?? fallback.sourceKind ?? 'runtime-session draft');
  const required = ['role', 'content'];
  return {
    type: 'object',
    required,
    properties: {
      role: { type: 'string', const: role },
      title: { type: 'string' },
      content: { type: 'string' },
      sourceKind: { type: 'string', const: sourceKind },
      matchedCandidateId: { type: 'string' },
      sourcePath: { type: 'string' },
      directive: role === 'directive' ? { type: 'string' } : undefined,
      instruction: role === 'instruction' ? { type: 'string' } : undefined,
      subject: role === 'subject' ? { type: 'string' } : undefined,
      primary: role === 'primary' ? { type: 'string' } : undefined,
      philosophy: role === 'philosophy' ? { type: 'string' } : undefined,
      blueprint: role === 'blueprint' ? { type: 'string' } : undefined,
      merge: /merge/i.test(role) ? { type: 'string' } : undefined,
      gate: /gate/i.test(role) ? { type: 'string' } : undefined,
      tool: role === 'meta' || /tool/i.test(role) ? { type: 'string' } : undefined
    }
  };
}

function normalizeMoltNlCard(molt: { title?: string; role?: string; content?: string; description?: string; tags?: string[]; nlCard?: Record<string, unknown>; category?: string }, fallbackCategory = 'runtime-session') {
  const current = isJsonSchemaLike(molt.nlCard) ? molt.nlCard : {};
  return {
    title: String(current.title ?? molt.title ?? 'Untitled MOLT'),
    role: String(current.role ?? molt.role ?? 'molt'),
    category: String(current.category ?? molt.category ?? fallbackCategory),
    tags: Array.isArray(current.tags) ? current.tags : Array.isArray(molt.tags) ? molt.tags : [],
    description: String(current.description ?? molt.description ?? molt.content ?? molt.title ?? ''),
    content: String(current.content ?? molt.content ?? molt.description ?? molt.title ?? '')
  };
}

function asMoltChildFromLibraryCandidate(candidate: UmgLibraryCandidate, parentNeoBlockId: string, parentNeoStackId: string, index: number): NormalizedTemplateMoltBlock {
  const role = normalizedMoltRole(candidate.role);
  const content = candidate.description || candidate.title;
  const molt = {
    id: candidate.id,
    sourceId: candidate.id,
    title: candidate.title,
    role,
    content,
    description: candidate.description || candidate.title,
    tags: Array.from(new Set([...(candidate.tags ?? []), 'source-library', 'reused'])),
    parentNeoBlockId,
    parentNeoStackId,
    stackOrder: index + 1,
    sourceKind: 'source-library reused' as const,
    reusedBlockId: candidate.id,
    matchedCandidateId: candidate.id,
    sourcePath: candidate.sourcePath,
    blockType: 'molt' as const,
    defaultState: 'off' as const,
    generationReason: `Bound source-library MOLT candidate ${candidate.id} into ${parentNeoBlockId}.`
  };
  return {
    ...molt,
    nlCard: normalizeMoltNlCard(molt, candidate.category ?? 'source-library'),
    jsonSchema: normalizeMoltJsonSchema(molt, candidate)
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
    description: tool.description ?? tool.content ?? tool.title,
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
    sourceNotes: [`Attached for capability ${capability.capabilityId ?? capability.label}`],
    nlCard: normalizeMoltNlCard({ title: tool.title, role: 'meta', content: tool.content ?? tool.description ?? tool.title, description: tool.description ?? tool.content ?? tool.title, tags: tool.tags }, 'metamolt'),
    jsonSchema: normalizeMoltJsonSchema({ role: 'meta', content: tool.content ?? tool.description ?? tool.title, sourceKind: 'metamolt tool', matchedCandidateId: tool.id, sourcePath: tool.sourcePath })
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
    const normalizedBlock = {
      ...block,
      ...sourceMetadataFor(block, request, 'molt'),
      role: normalizedMoltRole(block.role),
      content: block.content || (block as { description?: string }).description || block.title,
      description: (block as { description?: string }).description || block.content || block.title,
      tags: block.tags ?? [],
      parentNeoBlockId,
      parentNeoStackId,
      stackOrder: block.stackOrder ?? index + 1,
      defaultState: block.defaultState ?? 'off',
      generationReason: block.generationReason ?? (block as { reason?: string }).reason ?? `Runtime-session MOLT ${block.id} belongs to ${parentNeoBlockId}.`
    };
    existing.set(block.id, {
      ...normalizedBlock,
      nlCard: normalizeMoltNlCard(normalizedBlock),
      jsonSchema: normalizeMoltJsonSchema(normalizedBlock, getCandidateForRecord(normalizedBlock, request, 'molt'))
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
  const candidatesByRole = request.libraryCandidates
    .filter((candidate) => candidate.blockType === 'molt')
    .reduce((acc, candidate) => {
      const role = normalizedMoltRole(candidate.role);
      const bucket = acc.get(role) ?? [];
      bucket.push(candidate);
      acc.set(role, bucket);
      return acc;
    }, new Map<NormalizedTemplateMoltBlock['role'], UmgLibraryCandidate[]>());
  const requiredRoles: NormalizedTemplateMoltBlock['role'][] = ['directive', 'instruction', 'subject', 'primary'];
  const optionalRoles: NormalizedTemplateMoltBlock['role'][] = ['philosophy', 'blueprint'];
  plan.neoBlocks.forEach((neoBlock, blockIndex) => {
    const parentNeoBlockId = neoBlock.id ?? firstBlockId;
    const parentNeoStackId = neoBlock.neoStackId ?? (neoBlock as Record<string, unknown>).parentNeoStackId as string | undefined ?? firstStackId;
    const existingRoles = new Set(Array.from(existing.values()).filter((molt) => molt.parentNeoBlockId === parentNeoBlockId).map((molt) => molt.role));
    for (const role of [...requiredRoles, ...optionalRoles]) {
      if (existingRoles.has(role)) continue;
      const candidate = (candidatesByRole.get(role) ?? []).find((entry) => !existing.has(entry.id));
      if (!candidate) continue;
      const order = plan.moltBlocks.length + existing.size + blockIndex + 1;
      existing.set(candidate.id, asMoltChildFromLibraryCandidate(candidate, parentNeoBlockId, parentNeoStackId, order));
      existingRoles.add(role);
    }
  });
  capabilities.forEach((capability, index) => {
    const parentNeoBlockId = firstBlockId;
    const parentNeoStackId = plan.neoBlocks.find((block) => block.id === parentNeoBlockId)?.neoStackId ?? firstStackId;
    const toolChild = createMetaMoltToolChild(capability, parentNeoBlockId, parentNeoStackId, index);
    if (toolChild && !existing.has(toolChild.id)) existing.set(toolChild.id, toolChild);
  });
  return Array.from(existing.values()).sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
}

export function buildCompositionSourceDiagnostics(args: { sleeve?: NormalizedTemplateSleeve; request?: HermesCustomSleeveGenerationRequest; route: 'live Hermes' | 'offline template' | 'intake draft' | 'calibrated_library_backed_sleeve' | 'imported_legacy_sleeve_package'; reasonIfNotEligible?: string }) {
  const sleeve = args.sleeve;
  const moltBlocks = sleeve?.moltBlocks ?? [];
  const isImportedLegacyPackage = args.route === 'imported_legacy_sleeve_package' || sleeve?.metadata?.generationRoute === 'imported_legacy_sleeve_package' || sleeve?.metadata?.importedPackage === true;
  const boundMoltCount = isImportedLegacyPackage
    ? moltBlocks.length
    : moltBlocks.filter((block) => block.sourceKind === 'source-library reused' || block.sourceKind === 'metamolt tool' || block.sourceKind === 'runtime-session draft' || block.sourceKind === 'generated glue').length;
  const sourceLibraryBoundCount = moltBlocks.filter((block) => block.sourceKind === 'source-library reused').length;
  const unresolvedCount = moltBlocks.filter((block) => block.sourceKind === 'unresolved').length;
  const structurallyValidImport = isImportedLegacyPackage && Boolean(sleeve?.neoStacks.length && sleeve.neoBlocks.length && sleeve.moltBlocks.length) && (sleeve?.metadata?.compileEligible === true || sleeve?.metadata?.mode === 'runtime_session_draft' || sleeve?.metadata?.sourceKind === 'imported-legacy-package');
  const compileEligible = (args.route === 'live Hermes' && Boolean(sleeve?.metadata?.generatedByHermes) || args.route === 'calibrated_library_backed_sleeve' && sleeve?.metadata?.generationRoute === 'calibrated_library_backed_sleeve' && sleeve?.metadata?.compileEligible === true || structurallyValidImport) && Boolean(sleeve?.neoStacks.length && sleeve.neoBlocks.length && sleeve.moltBlocks.length);
  return {
    generationRoute: args.route,
    libraryIndex: {
      moltBlocks: umgLibraryIndexInfo.counts?.molt ?? 0,
      neoBlocks: umgLibraryIndexInfo.counts?.neoblock ?? 0,
      neoStacks: umgLibraryIndexInfo.counts?.neostack ?? 0,
      metaMoltToolBlocks: moltBlocks.filter((block) => block.sourceKind === 'metamolt tool').length
    },
    libraryRetrieval: args.request ? 'ran' : 'skipped',
    candidateCount: args.request?.libraryCandidates.length ?? 0,
    candidatesReturned: args.request?.libraryCandidates.length ?? 0,
    candidatesByRole: args.request?.candidatesByRole ? Object.fromEntries(Object.entries(args.request.candidatesByRole).map(([role, candidates]) => [role, candidates.map((candidate) => ({ id: candidate.id, title: candidate.title, role: candidate.role, blockType: candidate.blockType, sourcePath: candidate.sourcePath }))])) : undefined,
    missingRoles: args.request?.missingRoles ?? [],
    rejectedCandidateIds: args.request?.rejectedCandidateIds ?? [],
    candidatesBoundIntoSleeve: sourceLibraryBoundCount,
    generatedRuntimeDrafts: moltBlocks.filter((block) => block.sourceKind === 'runtime-session draft' || block.sourceKind === 'generated glue').length,
    topCandidates: args.request?.libraryCandidates.slice(0, 5).map((candidate) => ({ id: candidate.id, title: candidate.title, role: candidate.role, blockType: candidate.blockType, sourcePath: candidate.sourcePath })) ?? [],
    selectedBoundCandidates: moltBlocks.filter((block) => block.matchedCandidateId || block.sourcePath).slice(0, 8).map((block) => ({ id: block.id, title: block.title, role: block.role, sourceKind: block.sourceKind, matchedCandidateId: block.matchedCandidateId, sourcePath: block.sourcePath })),
    boundMoltCount,
    boundNeoBlockCount: sleeve?.neoBlocks.length ?? 0,
    boundNeoStackCount: sleeve?.neoStacks.length ?? 0,
    metaMoltToolBlockCount: moltBlocks.filter((block) => block.sourceKind === 'metamolt tool').length,
    generatedDraftCount: moltBlocks.filter((block) => block.sourceKind === 'runtime-session draft' || block.sourceKind === 'generated glue').length,
    unresolvedCount,
    sourceBindingStatus: !sleeve ? 'missing' : isImportedLegacyPackage ? 'optional_import_not_resolved' : sourceLibraryBoundCount === 0 ? 'missing' : unresolvedCount > 0 ? 'partial' : 'complete',
    compileEligibility: compileEligible ? 'yes' : 'no',
    reasonIfNotEligible: compileEligible ? undefined : args.reasonIfNotEligible ?? 'ActiveSessionSleeve is only compileable after live Hermes composition binds library/runtime MOLT children.'
  };
}

export function isActiveSessionSleeveCompileEligible(sleeve?: NormalizedTemplateSleeve) {
  const route = sleeve?.metadata?.generationRoute === 'imported_legacy_sleeve_package' || sleeve?.metadata?.importedPackage === true
    ? 'imported_legacy_sleeve_package'
    : sleeve?.metadata?.generationRoute === 'calibrated_library_backed_sleeve'
      ? 'calibrated_library_backed_sleeve'
      : sleeve?.metadata?.generatedByHermes
        ? 'live Hermes'
        : 'intake draft';
  return buildCompositionSourceDiagnostics({ sleeve, route }).compileEligibility === 'yes';
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
      structuralIR: plan.structuralIR,
      auditResult: plan.auditResult,
      routeEdges: plan.structuralIR?.routes,
      libraryCandidateSummary: request.libraryCandidateSummary,
      libraryCandidates: request.libraryCandidates.slice(0, 24),
      candidatesByRole: request.candidatesByRole,
      missingRoles: request.missingRoles,
      rejectedCandidateIds: request.rejectedCandidateIds,
      sourceStatusSummary: {
        libraryCandidateCount: request.libraryCandidates.length,
        candidatesReturned: request.libraryCandidates.length,
        candidatesByRole: Object.fromEntries(Object.entries(request.candidatesByRole).map(([role, candidates]) => [role, candidates.length])),
        missingRoles: request.missingRoles,
        rejectedCandidateIds: request.rejectedCandidateIds,
        candidatesBoundIntoSleeve: boundMoltBlocks.filter((block) => block.sourceKind === 'source-library reused').length,
        generatedRuntimeDrafts: boundMoltBlocks.filter((block) => block.sourceKind === 'runtime-session draft' || block.sourceKind === 'generated glue').length,
        libraryIndex: {
          moltBlocks: umgLibraryIndexInfo.counts?.molt ?? 0,
          neoBlocks: umgLibraryIndexInfo.counts?.neoblock ?? 0,
          neoStacks: umgLibraryIndexInfo.counts?.neostack ?? 0,
          metaMoltToolBlocks: boundMoltBlocks.filter((block) => block.sourceKind === 'metamolt tool').length
        },
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

export function compactCandidateForHermesPrompt(candidate: UmgLibraryCandidate) {
  const preview = String(candidate.content || candidate.description || candidate.nlCard?.content || candidate.title || '').replace(/\s+/g, ' ').trim().slice(0, 520);
  return {
    id: candidate.id,
    title: candidate.title,
    blockType: candidate.blockType,
    role: candidate.role,
    tags: candidate.tags?.slice(0, 10),
    description: candidate.description?.slice(0, 240),
    contentPreview: preview,
    category: candidate.category,
    sourcePath: candidate.sourcePath,
    sourceKind: candidate.sourceKind,
    score: candidate.score,
    hasNlCard: Boolean(candidate.nlCard),
    hasJsonSchema: Boolean(candidate.jsonSchema),
    nlCard: candidate.nlCard ? {
      title: candidate.nlCard.title,
      role: candidate.nlCard.role,
      category: candidate.nlCard.category,
      tags: Array.isArray(candidate.nlCard.tags) ? candidate.nlCard.tags.slice(0, 8) : [],
      description: String(candidate.nlCard.description ?? '').slice(0, 220),
      content: String(candidate.nlCard.content ?? '').slice(0, 320)
    } : undefined
  };
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
    libraryCandidates: args.request.libraryCandidates.slice(0, 16).map(compactCandidateForHermesPrompt),
    candidatesByRole: Object.fromEntries(Object.entries(args.request.candidatesByRole).map(([role, candidates]) => [role, candidates.slice(0, 5).map(compactCandidateForHermesPrompt)])),
    missingRoles: args.request.missingRoles,
    rejectedCandidateIds: args.request.rejectedCandidateIds
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
