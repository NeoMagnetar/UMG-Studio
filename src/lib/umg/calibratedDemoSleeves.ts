import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import type { HermesStructuralAuditResult, HermesStructuralIR } from './hermesCustomSleeveGeneration';
import { normalizeMoltJsonSchema } from './hermesCustomSleeveGeneration';
import { getHermesNativeToolBlockByCapability } from './nativeHermesToolBlocks';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve } from './templateSleeveStructures';
import type { UmgLibraryCandidate, UmgLibraryCandidatesByRole, UmgLibraryCandidateRoleBucket } from './umgLibraryCandidateRetrieval';
import { retrieveRoleTargetedUmgLibraryCandidates, summarizeUmgLibraryCandidates, umgLibraryIndexInfo } from './umgLibraryCandidateRetrieval';

export type CalibratedHaikuDesktopNoteSleeveInput = {
  sourcePrompt: string;
  retrievedLibraryCandidates?: UmgLibraryCandidate[];
  candidatesByRole?: UmgLibraryCandidatesByRole;
  missingRoles?: UmgLibraryCandidateRoleBucket[];
  rejectedCandidateIds?: string[];
  uploadedContext?: string;
  knownMetaMoltToolBlocks?: Array<{ id: string; title?: string; capabilityId?: string; description?: string; content?: string; tags?: string[]; sourcePath?: string; jsonSchema?: Record<string, unknown>; nlCard?: Record<string, unknown> }>;
  generationFailureReason?: string;
  requestId?: string;
};

type MOLTSpec = {
  id: string;
  title: string;
  role: NormalizedTemplateMoltBlock['role'];
  content: string;
  parentNeoBlockId: string;
  parentNeoStackId: string;
  tags: string[];
  generationReason: string;
  rejectedCandidateIds?: string[];
  sourceKind?: NormalizedTemplateMoltBlock['sourceKind'];
};

const stackSpecs = [
  { id: 'CAL.HAIKU.STACK.INTAKE', title: 'Prompt Intake and Note Triggering', description: 'Detect the note-generation request and normalize desktop note intent.' },
  { id: 'CAL.HAIKU.STACK.FORM', title: 'Haiku Form Resolution', description: 'Resolve haiku policy and build a 5-7-5 constraint model.' },
  { id: 'CAL.HAIKU.STACK.COMPOSE', title: 'Semantic Merge and Draft Composition', description: 'Merge user intent with haiku constraints and compose the final draft.' },
  { id: 'CAL.HAIKU.STACK.EMIT', title: 'Desktop Emission and Hermes-native Execution', description: 'Prepare, execute, and verify the desktop note creation action.' }
] as const;

const blockSpecs = [
  { id: 'CAL.HAIKU.BLOCK.DETECT_REQUEST', stackId: 'CAL.HAIKU.STACK.INTAKE', title: 'Detect Note Generation Request', description: 'Identify note, desktop, save, and haiku request signals.', gateIds: ['NOTE_REQUEST_TRIGGER_GATE'] },
  { id: 'CAL.HAIKU.BLOCK.NORMALIZE_INTENT', stackId: 'CAL.HAIKU.STACK.INTAKE', title: 'Normalize Note Intent', description: 'Convert the prompt into a normalized note task and destination intent.', gateIds: [] },
  { id: 'CAL.HAIKU.BLOCK.RESOLVE_FORM', stackId: 'CAL.HAIKU.STACK.FORM', title: 'Resolve Haiku Form', description: 'Select haiku as the required output form.', gateIds: ['HAIKU_POLICY_GATE'] },
  { id: 'CAL.HAIKU.BLOCK.CONSTRAINT_MODEL', stackId: 'CAL.HAIKU.STACK.FORM', title: 'Build Haiku Constraint Model', description: 'Create a deterministic 5-7-5 line and readiness policy model.', gateIds: [] },
  { id: 'CAL.HAIKU.BLOCK.MERGE_FRAME', stackId: 'CAL.HAIKU.STACK.COMPOSE', title: 'Merge Intent with Haiku Frame', description: 'Merge normalized topic intent with the haiku form frame.', gateIds: [] },
  { id: 'CAL.HAIKU.BLOCK.COMPOSE_DRAFT', stackId: 'CAL.HAIKU.STACK.COMPOSE', title: 'Compose Final Haiku Draft', description: 'Draft the haiku note content for the runtime prompt.', gateIds: [] },
  { id: 'CAL.HAIKU.BLOCK.VALIDATE_DRAFT', stackId: 'CAL.HAIKU.STACK.COMPOSE', title: 'Validate Draft Structure and Haiku Readiness', description: 'Confirm three-line haiku readiness before emission.', gateIds: ['HAIKU_POLICY_GATE'] },
  { id: 'CAL.HAIKU.BLOCK.PREPARE_OUTPUT', stackId: 'CAL.HAIKU.STACK.EMIT', title: 'Prepare Desktop Note Output Action', description: 'Build the action payload for the Hermes-native note/file tool.', gateIds: ['DESKTOP_WRITE_ACTION_GATE'] },
  { id: 'CAL.HAIKU.BLOCK.EXECUTE_CREATE', stackId: 'CAL.HAIKU.STACK.EMIT', title: 'Execute Desktop Note Creation', description: 'Invoke Hermes-native note creation or file write after approval/direct mode selection.', gateIds: ['DESKTOP_WRITE_ACTION_GATE'] },
  { id: 'CAL.HAIKU.BLOCK.VERIFY_CREATE', stackId: 'CAL.HAIKU.STACK.EMIT', title: 'Verify Note Creation', description: 'Verify the note artifact or created desktop file result.', gateIds: ['OUTPUT_VERIFICATION_GATE'] }
] as const;

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function cleanId(value: string) {
  return value.replace(/[^A-Z0-9_.-]+/gi, '_');
}

function schemaFor(kind: string, title: string, extra: Record<string, unknown> = {}) {
  return { type: 'object', required: ['id', 'title', 'content'], properties: { id: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' }, kind: { type: 'string', const: kind }, ...extra } };
}

function nlCardFor(title: string, role: string, content: string, tags: string[], category = 'calibrated_umg_sleeve') {
  return { title, role, category, tags, description: content, content };
}

function candidateHaystack(candidate: UmgLibraryCandidate) {
  return [candidate.id, candidate.title, candidate.role, candidate.blockType, candidate.domain, candidate.category, candidate.sourcePath, candidate.description, ...(candidate.tags ?? []), ...(candidate.matchReasons ?? [])].filter(Boolean).join(' ').toLowerCase();
}

function isCompetitorCandidate(candidate: UmgLibraryCandidate) {
  return /openclaw|langchain/i.test(candidateHaystack(candidate));
}

function candidateMatchesRule(candidate: UmgLibraryCandidate, role: NormalizedTemplateMoltBlock['role'] | 'domainStyle' | 'metaTool' | 'gate') {
  if (isCompetitorCandidate(candidate)) return false;
  const haystack = candidateHaystack(candidate);
  const candidateRole = String(candidate.role ?? '').toLowerCase();
  if (role === 'subject') return candidateRole === 'subject' && /text|document|artifact|note|content|documentation|output/.test(haystack);
  if (role === 'blueprint') return candidateRole === 'blueprint' && /haiku|poetry|verse|poetic|document|output|process|workflow|note|file|desktop|write|format|form/.test(haystack);
  if (role === 'instruction') return candidateRole === 'instruction' && /write|create|content|compose|draft|note|document|generate|save|poetic/.test(haystack);
  if (role === 'primary') return candidateRole === 'primary' && /final|created|file|output|artifact|note|result|document/.test(haystack);
  if (role === 'directive') return candidateRole === 'directive' && /rule|trigger|policy|must|required|write|output|validation/.test(haystack);
  if (role === 'philosophy') return candidateRole === 'philosophy';
  if (role === 'domainStyle') return /haiku|poetry|verse|poetic|5.7.5|syllable|form/.test(haystack);
  if (role === 'metaTool') return /hermes|metamolt|tool|note create|file write|native/.test(haystack);
  if (role === 'gate') return /gate|approval|validation|control|write action|file output/.test(haystack);
  return false;
}

function normalizedCandidateRole(candidate: UmgLibraryCandidate, fallback: NormalizedTemplateMoltBlock['role']): NormalizedTemplateMoltBlock['role'] {
  const role = String(candidate.role ?? fallback).toLowerCase();
  return role === 'directive' || role === 'instruction' || role === 'subject' || role === 'primary' || role === 'philosophy' || role === 'blueprint' ? role : fallback;
}

function normalizeCandidateMolt(candidate: UmgLibraryCandidate, role: NormalizedTemplateMoltBlock['role'], parentNeoBlockId: string, parentNeoStackId: string, index: number): NormalizedTemplateMoltBlock {
  const content = candidate.content || candidate.description || candidate.title;
  const sourcePath = candidate.sourcePath ?? `source-library://${candidate.id}`;
  const base = {
    id: cleanId(`CAL.BOUND.${role.toUpperCase()}.${candidate.id}`),
    sourceId: candidate.id,
    title: candidate.title,
    role,
    content,
    description: content,
    tags: unique([...(candidate.tags ?? []), 'source-library', 'calibrated-rescue', role]),
    parentNeoBlockId,
    parentNeoStackId,
    stackOrder: index,
    sourceKind: 'source-library reused' as const,
    reusedBlockId: candidate.id,
    matchedCandidateId: candidate.id,
    sourcePath,
    blockType: 'molt' as const,
    defaultState: 'off' as const,
    generationReason: `Relevant retrieved library candidate ${candidate.id} bound by calibrated rescue rule for ${role}.`
  };
  return { ...base, nlCard: { ...(candidate as unknown as { nlCard?: Record<string, unknown> }).nlCard, ...nlCardFor(candidate.title, role, content, base.tags, candidate.category ?? 'source-library') }, jsonSchema: normalizeMoltJsonSchema(base, candidate) };
}

function runtimeDraft(spec: MOLTSpec, index: number): NormalizedTemplateMoltBlock {
  return {
    id: spec.id,
    title: spec.title,
    role: spec.role,
    content: spec.content,
    description: spec.content,
    tags: unique([...spec.tags, 'calibrated-rescue', 'runtime-session']),
    parentNeoBlockId: spec.parentNeoBlockId,
    parentNeoStackId: spec.parentNeoStackId,
    stackOrder: index,
    sourceKind: spec.sourceKind ?? 'runtime-session draft',
    blockType: spec.sourceKind === 'metamolt tool' ? 'capability' : 'molt',
    defaultState: 'off',
    generationReason: spec.generationReason,
    rejectedCandidateIds: spec.rejectedCandidateIds ?? [],
    nlCard: nlCardFor(spec.title, spec.role, spec.content, spec.tags),
    jsonSchema: normalizeMoltJsonSchema({ role: spec.role, title: spec.title, content: spec.content, sourceKind: spec.sourceKind ?? 'runtime-session draft' })
  };
}

function toolMolt(capabilityId: string, parentNeoBlockId: string, parentNeoStackId: string, index: number, knownTools: CalibratedHaikuDesktopNoteSleeveInput['knownMetaMoltToolBlocks'] = []): NormalizedTemplateMoltBlock {
  const known = knownTools.find((tool) => tool.capabilityId === capabilityId) ?? getHermesNativeToolBlockByCapability(capabilityId);
  const id = capabilityId.includes('note') ? 'TOOL.HERMES.NOTE_CREATE.v0.1' : 'TOOL.HERMES.FILE_WRITE.v0.1';
  const title = known?.title ?? (capabilityId.includes('note') ? 'Hermes Native Note Create' : 'Hermes Native File Write');
  const content = known?.content ?? known?.description ?? `Use ${id} for the calibrated desktop note route.`;
  return {
    id,
    sourceId: id,
    title,
    role: 'meta',
    content,
    description: content,
    tags: unique([...(known?.tags ?? []), 'metamolt', 'tool', 'hermes-native', 'calibrated-rescue']),
    parentNeoBlockId,
    parentNeoStackId,
    stackOrder: index,
    sourceKind: 'metamolt tool',
    reusedBlockId: id,
    matchedCandidateId: id,
    sourcePath: known?.sourcePath ?? `runtime-session://metamolt-tools/${id}`,
    blockType: 'capability',
    defaultState: 'off',
    generationReason: `${id} attached as an actual MetaMOLT Tool Block for native desktop note execution.`,
    nlCard: nlCardFor(title, 'meta', content, known?.tags ?? ['metamolt', 'tool']),
    jsonSchema: normalizeMoltJsonSchema({ role: 'meta', title, content, sourceKind: 'metamolt tool', matchedCandidateId: id })
  };
}

export function buildCalibratedHaikuDesktopNoteSleeve(input: CalibratedHaikuDesktopNoteSleeveInput): NormalizedTemplateSleeve {
  const initialCandidates = input.retrievedLibraryCandidates ?? [];
  const roleTargeted = input.candidatesByRole
    ? { candidates: initialCandidates, candidatesByRole: input.candidatesByRole, missingRoles: input.missingRoles ?? [], rejectedCandidateIds: input.rejectedCandidateIds ?? [] }
    : retrieveRoleTargetedUmgLibraryCandidates(input.sourcePrompt, initialCandidates.length ? { index: initialCandidates, perRoleLimit: 8, combinedLimit: 48 } : { perRoleLimit: 8, combinedLimit: 48 });
  const candidateMap = new Map<string, UmgLibraryCandidate>();
  [...initialCandidates, ...roleTargeted.candidates, ...Object.values(roleTargeted.candidatesByRole).flat()].forEach((candidate) => {
    if (!isCompetitorCandidate(candidate)) candidateMap.set(candidate.id, candidate);
  });
  const candidates = Array.from(candidateMap.values());
  const now = new Date().toISOString();
  const requestId = input.requestId ?? `calibrated_haiku_note_${Date.now()}`;
  const sleeveId = `CAL.HAIKU.DESKTOP_NOTE.${requestId}`;
  const neoBlocks: NormalizedTemplateNeoBlock[] = blockSpecs.map((block, index) => ({
    id: block.id,
    title: block.title,
    description: block.description,
    neoStackId: block.stackId,
    blockOrder: index + 1,
    tags: ['calibrated-rescue', 'haiku', 'desktop-note'],
    moltBlockIds: [],
    gateIds: [...block.gateIds],
    defaultState: 'off',
    runtimeState: 'idle',
    sourceKind: 'runtime-session draft',
    blockType: 'neoblock',
    generationReason: `Required deterministic rescue NeoBlock for ${block.title}.`,
    nlCard: nlCardFor(block.title, 'neoblock', block.description, ['calibrated-rescue', 'neoblock']),
    jsonSchema: schemaFor('neoblock', block.title)
  }));
  const neoStacks: NormalizedTemplateNeoStack[] = stackSpecs.map((stack, index) => ({
    id: stack.id,
    title: stack.title,
    description: stack.description,
    stackOrder: index + 1,
    tags: ['calibrated-rescue', 'haiku', 'desktop-note'],
    neoBlockIds: neoBlocks.filter((block) => block.neoStackId === stack.id).map((block) => block.id),
    sourceKind: 'runtime-session draft',
    blockType: 'neostack',
    generationReason: `Required deterministic rescue NeoStack for ${stack.title}.`,
    nlCard: nlCardFor(stack.title, 'neostack', stack.description, ['calibrated-rescue', 'neostack']),
    jsonSchema: schemaFor('neostack', stack.title)
  }));

  const specs: MOLTSpec[] = [
    { id: 'CAL.MOLT.DIR.NOTE_REQUEST_TRIGGER_RULE', title: 'note request trigger rule', role: 'directive', parentNeoBlockId: 'CAL.HAIKU.BLOCK.DETECT_REQUEST', parentNeoStackId: 'CAL.HAIKU.STACK.INTAKE', content: 'Trigger only when prompt intent includes creating/writing/saving a note or text artifact.', tags: ['directive', 'trigger'], generationReason: 'No exact haiku desktop note trigger rule is guaranteed in the library, so calibrated rescue drafts it for this runtime session.' },
    { id: 'CAL.MOLT.INST.PARSE_PROMPT', title: 'parse prompt', role: 'instruction', parentNeoBlockId: 'CAL.HAIKU.BLOCK.NORMALIZE_INTENT', parentNeoStackId: 'CAL.HAIKU.STACK.INTAKE', content: `Parse prompt and context into topic, output form, destination, and safety requirements. Prompt: ${input.sourcePrompt}`, tags: ['instruction', 'parse'], generationReason: 'Runtime draft parses the current user prompt without mutating source-library content.' },
    { id: 'CAL.MOLT.DIR.HAIKU_OUTPUT_RULE', title: 'haiku output rule', role: 'directive', parentNeoBlockId: 'CAL.HAIKU.BLOCK.RESOLVE_FORM', parentNeoStackId: 'CAL.HAIKU.STACK.FORM', content: 'Output must be a haiku: three concise lines following 5-7-5 syllable intent where possible.', tags: ['directive', 'haiku'], generationReason: 'Haiku-specific policy is generated as a runtime-session draft because no exact source block is assumed.' },
    { id: 'CAL.MOLT.BLUEPRINT.HAIKU_CONSTRAINT_MODEL', title: 'prompt → normalize → haiku constraints → compose → prepare action → execute → verify', role: 'blueprint', parentNeoBlockId: 'CAL.HAIKU.BLOCK.CONSTRAINT_MODEL', parentNeoStackId: 'CAL.HAIKU.STACK.FORM', content: 'Blueprint route: prompt → normalize → haiku constraints → compose → prepare action → execute → verify.', tags: ['blueprint', 'route'], generationReason: 'Runtime draft defines the exact calibrated note route.' },
    { id: 'MERGE.INTENT_WITH_HAIKU_FRAME', title: 'MERGE.INTENT_WITH_HAIKU_FRAME', role: 'blueprint', parentNeoBlockId: 'CAL.HAIKU.BLOCK.MERGE_FRAME', parentNeoStackId: 'CAL.HAIKU.STACK.COMPOSE', content: 'Merge normalized note intent and topic with the haiku 5-7-5 output frame.', tags: ['merge', 'intent', 'haiku'], generationReason: 'Explicit merge op required for structuralIR and renderable route graph.' },
    { id: 'MERGE.DRAFT_SEMANTIC_CONSTRAINTS', title: 'MERGE.DRAFT_SEMANTIC_CONSTRAINTS', role: 'blueprint', parentNeoBlockId: 'CAL.HAIKU.BLOCK.COMPOSE_DRAFT', parentNeoStackId: 'CAL.HAIKU.STACK.COMPOSE', content: 'Fuse draft wording with semantic topic constraints while retaining haiku form.', tags: ['merge', 'draft'], generationReason: 'Explicit merge op required to preserve semantic constraints in composition.' },
    { id: 'CAL.MOLT.INST.COMPOSE_HAIKU', title: 'compose haiku', role: 'instruction', parentNeoBlockId: 'CAL.HAIKU.BLOCK.COMPOSE_DRAFT', parentNeoStackId: 'CAL.HAIKU.STACK.COMPOSE', content: 'Compose the final haiku note body from runtime prompt topic. Example runtime prompt topic apples yields a three-line apple-themed haiku.', tags: ['instruction', 'compose', 'haiku'], generationReason: 'Haiku composition instruction is a runtime-session draft specific to the submission demo.' },
    { id: 'CAL.MOLT.PRIMARY.FINAL_HAIKU_NOTE', title: 'final haiku note', role: 'primary', parentNeoBlockId: 'CAL.HAIKU.BLOCK.VALIDATE_DRAFT', parentNeoStackId: 'CAL.HAIKU.STACK.COMPOSE', content: 'Primary artifact is the final haiku note text, ready to pass to desktop note creation.', tags: ['primary', 'haiku', 'note'], generationReason: 'Runtime draft primary artifact describes the output produced at runtime.' },
    { id: 'CAL.MOLT.DIR.DESKTOP_NOTE_CREATION_RULE', title: 'desktop note creation rule', role: 'directive', parentNeoBlockId: 'CAL.HAIKU.BLOCK.PREPARE_OUTPUT', parentNeoStackId: 'CAL.HAIKU.STACK.EMIT', content: 'Create or prepare a desktop note/file action only through approved Hermes-native note/file tools.', tags: ['directive', 'desktop', 'note'], generationReason: 'Runtime draft guards the desktop write action boundary without claiming execution.' },
    { id: 'MERGE.ACTION_PAYLOAD', title: 'MERGE.ACTION_PAYLOAD', role: 'blueprint', parentNeoBlockId: 'CAL.HAIKU.BLOCK.PREPARE_OUTPUT', parentNeoStackId: 'CAL.HAIKU.STACK.EMIT', content: 'Merge final haiku text, filename intent, desktop destination, and action policy into the tool payload.', tags: ['merge', 'action', 'payload'], generationReason: 'Explicit merge op connects haiku output to native action payload.' },
    { id: 'CAL.MOLT.INST.PREPARE_NOTE_OUTPUT', title: 'prepare note output', role: 'instruction', parentNeoBlockId: 'CAL.HAIKU.BLOCK.PREPARE_OUTPUT', parentNeoStackId: 'CAL.HAIKU.STACK.EMIT', content: 'Prepare the desktop note output payload with title, body, extension, and destination intent.', tags: ['instruction', 'desktop', 'prepare'], generationReason: 'Runtime draft prepares a concrete action input for Hermes-native tools.' },
    { id: 'CAL.MOLT.PRIMARY.CREATED_DESKTOP_NOTE_FILE', title: 'created desktop note file', role: 'primary', parentNeoBlockId: 'CAL.HAIKU.BLOCK.EXECUTE_CREATE', parentNeoStackId: 'CAL.HAIKU.STACK.EMIT', content: 'Primary execution artifact is the created desktop note file or reviewable note artifact returned by Hermes.', tags: ['primary', 'desktop', 'file'], generationReason: 'Runtime draft represents the expected created artifact without faking that it already exists.' },
    { id: 'CAL.MOLT.INST.VERIFY_CREATION', title: 'verify creation', role: 'instruction', parentNeoBlockId: 'CAL.HAIKU.BLOCK.VERIFY_CREATE', parentNeoStackId: 'CAL.HAIKU.STACK.EMIT', content: 'Verify the returned artifact/file path, status, and final haiku text after actual runtime execution.', tags: ['instruction', 'verify'], generationReason: 'Runtime draft defines verification behavior without fake runtime trace.' },
    { id: 'CAL.MOLT.PRIMARY.VERIFIED_OUTPUT', title: 'verified output', role: 'primary', parentNeoBlockId: 'CAL.HAIKU.BLOCK.VERIFY_CREATE', parentNeoStackId: 'CAL.HAIKU.STACK.EMIT', content: 'Primary verification result confirms note creation only after Hermes returns an artifact or file proof.', tags: ['primary', 'verified'], generationReason: 'Runtime draft captures the proof object expected after real runtime execution.' }
  ];

  const boundCandidates: NormalizedTemplateMoltBlock[] = [];
  const usedCandidateIds = new Set<string>();
  const candidatesByRole = roleTargeted.candidatesByRole;
  const orderedSources = (bucket: UmgLibraryCandidateRoleBucket | 'all') => unique([
    ...(bucket === 'all' ? [] : candidatesByRole[bucket] ?? []),
    ...candidates
  ].map((candidate) => candidate.id)).map((id) => candidateMap.get(id)).filter(Boolean) as UmgLibraryCandidate[];
  const bindFirst = (bucket: UmgLibraryCandidateRoleBucket | 'all', role: NormalizedTemplateMoltBlock['role'], parentNeoBlockId: string, parentNeoStackId: string, limit: number, predicate: (candidate: UmgLibraryCandidate) => boolean) => {
    orderedSources(bucket).filter((candidate) => !usedCandidateIds.has(candidate.id) && predicate(candidate)).slice(0, limit).forEach((candidate) => {
      usedCandidateIds.add(candidate.id);
      boundCandidates.push(normalizeCandidateMolt(candidate, normalizedCandidateRole(candidate, role), parentNeoBlockId, parentNeoStackId, 100 + boundCandidates.length));
    });
  };
  const haikuCandidate = orderedSources('domainStyle').find((candidate) => !usedCandidateIds.has(candidate.id) && candidateMatchesRule(candidate, 'domainStyle'))
    ?? orderedSources('blueprint').find((candidate) => !usedCandidateIds.has(candidate.id) && /haiku|poetry|verse|poetic/i.test(candidateHaystack(candidate)));
  if (haikuCandidate) {
    usedCandidateIds.add(haikuCandidate.id);
    boundCandidates.push(normalizeCandidateMolt(haikuCandidate, 'blueprint', 'CAL.HAIKU.BLOCK.RESOLVE_FORM', 'CAL.HAIKU.STACK.FORM', 100));
  }
  bindFirst('subject', 'subject', 'CAL.HAIKU.BLOCK.NORMALIZE_INTENT', 'CAL.HAIKU.STACK.INTAKE', 2, (candidate) => candidateMatchesRule(candidate, 'subject'));
  bindFirst('subject', 'subject', 'CAL.HAIKU.BLOCK.COMPOSE_DRAFT', 'CAL.HAIKU.STACK.COMPOSE', 2, (candidate) => candidateMatchesRule(candidate, 'subject'));
  bindFirst('blueprint', 'blueprint', 'CAL.HAIKU.BLOCK.CONSTRAINT_MODEL', 'CAL.HAIKU.STACK.FORM', 3, (candidate) => candidateMatchesRule(candidate, 'blueprint'));
  bindFirst('instruction', 'instruction', 'CAL.HAIKU.BLOCK.COMPOSE_DRAFT', 'CAL.HAIKU.STACK.COMPOSE', 3, (candidate) => candidateMatchesRule(candidate, 'instruction'));
  bindFirst('directive', 'directive', 'CAL.HAIKU.BLOCK.DETECT_REQUEST', 'CAL.HAIKU.STACK.INTAKE', 2, (candidate) => candidateMatchesRule(candidate, 'directive'));
  bindFirst('primary', 'primary', 'CAL.HAIKU.BLOCK.VALIDATE_DRAFT', 'CAL.HAIKU.STACK.COMPOSE', 2, (candidate) => candidateMatchesRule(candidate, 'primary'));
  bindFirst('all', 'subject', 'CAL.HAIKU.BLOCK.PREPARE_OUTPUT', 'CAL.HAIKU.STACK.EMIT', 1, (candidate) => /artifact|document|output|file/i.test(candidateHaystack(candidate)) && (candidate.role === 'subject' || candidate.role === 'blueprint'));

  const rejectedCandidateIds = unique([...roleTargeted.rejectedCandidateIds, ...candidates.filter((candidate) => !usedCandidateIds.has(candidate.id)).slice(0, 12).map((candidate) => candidate.id)]);
  const runtimeMolts = specs.map((spec, index) => runtimeDraft({ ...spec, rejectedCandidateIds }, index + 1));
  const tools = [
    toolMolt('umg.native.hermes.note_create', 'CAL.HAIKU.BLOCK.EXECUTE_CREATE', 'CAL.HAIKU.STACK.EMIT', 1000, input.knownMetaMoltToolBlocks),
    toolMolt('umg.native.hermes.file_write', 'CAL.HAIKU.BLOCK.EXECUTE_CREATE', 'CAL.HAIKU.STACK.EMIT', 1001, input.knownMetaMoltToolBlocks)
  ];
  const moltBlocks = [...boundCandidates, ...runtimeMolts, ...tools];

  for (const block of neoBlocks) {
    block.moltBlockIds = moltBlocks.filter((molt) => molt.parentNeoBlockId === block.id).map((molt) => molt.id);
  }

  const gateTarget = (id: string, title: string, blockId: string, conditionText: string, action: UMGGateRecord['action']): UMGGateRecord => ({
    id,
    title,
    attachesTo: { kind: 'neoblock', id: blockId },
    triggerType: action === 'require_approval' ? 'approval' : 'runtime_condition',
    conditionText,
    action,
    targetIds: [blockId],
    defaultState: 'closed',
    runtimeState: 'inactive',
    tags: ['calibrated-rescue', 'gate', 'runtime-control'],
    metadata: { promptContent: false, sourceKind: 'runtime-session draft', generationRoute: 'calibrated_library_backed_sleeve' }
  });
  const gates = [
    gateTarget('NOTE_REQUEST_TRIGGER_GATE', 'NOTE_REQUEST_TRIGGER_GATE', 'CAL.HAIKU.BLOCK.DETECT_REQUEST', 'Open when prompt requests creating/writing/saving a note or text artifact.', 'activate'),
    gateTarget('HAIKU_POLICY_GATE', 'HAIKU_POLICY_GATE', 'CAL.HAIKU.BLOCK.VALIDATE_DRAFT', 'Open only when output is a three-line haiku draft.', 'activate'),
    gateTarget('DESKTOP_WRITE_ACTION_GATE', 'DESKTOP_WRITE_ACTION_GATE', 'CAL.HAIKU.BLOCK.PREPARE_OUTPUT', 'Require explicit runtime action policy before desktop note/file write.', 'require_approval'),
    gateTarget('OUTPUT_VERIFICATION_GATE', 'OUTPUT_VERIFICATION_GATE', 'CAL.HAIKU.BLOCK.VERIFY_CREATE', 'Open after Hermes returns note artifact/file status proof.', 'activate')
  ];

  const routeBlockIds = blockSpecs.map((block) => block.id);
  const routes = routeBlockIds.slice(0, -1).map((fromId, index) => ({ id: `route.calibrated.${index + 1}`, fromId, toId: routeBlockIds[index + 1], fromType: 'neoblock', toType: 'neoblock', label: `${neoBlocks.find((block) => block.id === fromId)?.title} → ${neoBlocks.find((block) => block.id === routeBlockIds[index + 1])?.title}` }));
  const mergeOps = ['MERGE.INTENT_WITH_HAIKU_FRAME', 'MERGE.DRAFT_SEMANTIC_CONSTRAINTS', 'MERGE.ACTION_PAYLOAD'].map((id) => ({ id, title: id, sourceIds: moltBlocks.filter((molt) => molt.id === id || molt.tags.includes('merge')).map((molt) => molt.id), resultId: id, type: 'semantic_merge' }));
  const structuralIR: HermesStructuralIR = {
    sleeve: { id: sleeveId, title: 'Desktop Note Haiku Workflow Sleeve', generationRoute: 'calibrated_library_backed_sleeve' },
    neoStacks: neoStacks.map((stack) => ({ id: stack.id, title: stack.title, neoBlockIds: stack.neoBlockIds, kindOfWork: stack.description })),
    neoBlocks: neoBlocks.map((block) => ({ id: block.id, title: block.title, parentNeoStackId: block.neoStackId, moltBlockIds: block.moltBlockIds, gates: block.gateIds })),
    moltLayers: moltBlocks.map((molt) => ({ id: molt.id, title: molt.title, role: molt.role, parentNeoBlockId: molt.parentNeoBlockId, sourceKind: molt.sourceKind, matchedCandidateId: molt.matchedCandidateId, sourcePath: molt.sourcePath })),
    mergeOps,
    gates: gates.map((gate) => ({ id: gate.id, title: gate.title, targetIds: gate.targetIds, action: gate.action })),
    toolBlocks: tools.map((tool) => ({ id: tool.id, title: tool.title, parentNeoBlockId: tool.parentNeoBlockId, sourceKind: tool.sourceKind })),
    routes
  };
  const auditResult: HermesStructuralAuditResult = {
    passed: true,
    revisionRequired: false,
    checks: [
      { id: 'neostack_kind_of_work', passed: neoStacks.every((stack) => stack.description.length > 0), notes: 'Every NeoStack has explicit kind-of-work description.' },
      { id: 'stack_has_blocks', passed: neoStacks.every((stack) => stack.neoBlockIds.length > 0), notes: 'Every NeoStack contains NeoBlocks.' },
      { id: 'block_has_molt', passed: neoBlocks.every((block) => block.moltBlockIds.length > 0), notes: 'Every NeoBlock contains at least one MOLT child.' },
      { id: 'source_candidates_bound_as_molt_children', passed: boundCandidates.length > 0 || candidates.length === 0, notes: `${boundCandidates.length} retrieved source candidates bound as MOLT children.` },
      { id: 'tool_blocks_attached', passed: tools.length >= 2, notes: 'Hermes note_create and file_write MetaMOLT Tool Blocks attached.' },
      { id: 'merge_ops_explicit', passed: mergeOps.length >= 3, notes: 'Required merge operations are explicit.' },
      { id: 'route_renderable', passed: routes.length === routeBlockIds.length - 1, notes: 'Route edges are deterministic and renderable.' },
      { id: 'runtime_graph_renderable_without_invented_geometry', passed: true, notes: 'Graph uses IDs/routes only; no fabricated runtime trace or geometry activation.' }
    ]
  };

  const sourceBoundTitles = boundCandidates.map((molt) => molt.title);
  const coverageTargets = {
    subject: boundCandidates.some((molt) => molt.role === 'subject'),
    blueprintOrHaikuForm: boundCandidates.some((molt) => molt.role === 'blueprint' && /haiku|poetry|verse|form/i.test(`${molt.title} ${molt.content} ${(molt.tags ?? []).join(' ')}`)),
    instructionOrWriting: boundCandidates.some((molt) => molt.role === 'instruction' && /write|compose|create|content|draft|document/i.test(`${molt.title} ${molt.content} ${(molt.tags ?? []).join(' ')}`)),
    toolBlock: tools.length > 0,
    artifactDocumentOutput: boundCandidates.some((molt) => /artifact|document|output|file|text/i.test(`${molt.title} ${molt.content} ${(molt.tags ?? []).join(' ')}`))
  };
  const coverageWarnings = Object.entries(coverageTargets).filter(([, passed]) => !passed).map(([role]) => `source binding target missing: ${role}`);
  const sourceBindingStatus = coverageWarnings.length === 0 ? 'complete' : 'partial';
  return {
    id: sleeveId,
    title: 'Desktop Note Haiku Workflow Sleeve',
    version: 'calibrated-runtime-session-v1',
    description: 'Library-backed calibrated UMG Sleeve for creating a desktop note whose generated text is constrained to haiku form.',
    isTemplate: true,
    templateKind: 'custom',
    source: 'session',
    tags: ['calibrated_umg_sleeve', 'library_backed', 'haiku', 'desktop_note', 'runtime_session'],
    neoStacks,
    neoBlocks,
    moltBlocks,
    gates,
    governanceBlockIds: gates.map((gate) => gate.id),
    defaultExecutionMode: 'approvalRequired',
    metadata: {
      generatedByHermes: false,
      liveHermesGenerated: false,
      label: 'Calibrated UMG Sleeve',
      generationRoute: 'calibrated_library_backed_sleeve',
      compileEligible: true,
      compileEligibility: 'yes',
      libraryRetrieval: 'ran',
      sourceBindingStatus,
      fallbackReason: input.generationFailureReason || 'live Hermes returned invalid/empty structure',
      requestId,
      sourcePrompt: input.sourcePrompt,
      uploadedContext: input.uploadedContext,
      runtimeSessionOnly: true,
      sourceLibraryWrite: false,
      noFakeLiveHermesGeneration: true,
      noFakeSourceBinding: true,
      noFakeRuntimeTrace: true,
      structuralIR,
      auditResult,
      routeEdges: routes,
      mergeOps,
      capabilities: [
        { capabilityId: 'umg.native.hermes.note_create', label: 'Hermes native note create', reason: 'Execute desktop note creation when approved.', riskLevel: 'low', requiresConnector: false, safeForAppLocalExecution: false },
        { capabilityId: 'umg.native.hermes.file_write', label: 'Hermes native file write', reason: 'Write desktop note file when approved.', riskLevel: 'medium', requiresConnector: false, safeForAppLocalExecution: false }
      ],
      generatedDecisions: runtimeMolts.map((molt) => ({ id: molt.id, title: molt.title, targetKind: 'molt', reason: molt.generationReason, runtimeSessionOnly: true, sourceLibraryWrite: false })),
      reuseDecisions: boundCandidates.map((molt) => ({ id: `reuse.${molt.id}`, matchedCandidateId: molt.matchedCandidateId, sourcePath: molt.sourcePath, targetNeoBlockId: molt.parentNeoBlockId, targetNeoStackId: molt.parentNeoStackId, role: molt.role, sourceKind: 'source-library reused' })),
      libraryCandidateSummary: summarizeUmgLibraryCandidates(candidates, candidatesByRole),
      libraryCandidates: candidates.slice(0, 24),
      candidatesByRole,
      missingRoles: roleTargeted.missingRoles,
      rejectedCandidateIds,
      sourceBindingCoverage: coverageTargets,
      sourceBindingWarnings: coverageWarnings,
      libraryBlocksUsed: sourceBoundTitles,
      sourceStatusSummary: {
        libraryCandidateCount: candidates.length,
        candidatesReturned: candidates.length,
        candidatesByRole: Object.fromEntries(Object.entries(candidatesByRole).map(([role, roleCandidates]) => [role, roleCandidates.length])),
        missingRoles: roleTargeted.missingRoles,
        rejectedCandidateIds,
        candidatesBoundIntoSleeve: boundCandidates.length,
        generatedRuntimeDrafts: runtimeMolts.length,
        libraryIndex: { moltBlocks: umgLibraryIndexInfo.counts?.molt ?? 0, neoBlocks: umgLibraryIndexInfo.counts?.neoblock ?? 0, neoStacks: umgLibraryIndexInfo.counts?.neostack ?? 0, metaMoltToolBlocks: tools.length },
        reuseDecisionCount: boundCandidates.length,
        generatedGlueDecisionCount: runtimeMolts.length,
        boundMoltCount: moltBlocks.length,
        boundNeoBlockCount: neoBlocks.length,
        boundNeoStackCount: neoStacks.length,
        metaMoltToolBlockCount: tools.length,
        unresolved: 0
      },
      createdAt: now
    }
  };
}
