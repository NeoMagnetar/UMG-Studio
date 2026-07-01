import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import type { HermesStructuralAuditResult, HermesStructuralIR } from './hermesCustomSleeveGeneration';
import { normalizeMoltJsonSchema } from './hermesCustomSleeveGeneration';
import { getHermesNativeToolBlockByCapability } from './nativeHermesToolBlocks';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve } from './templateSleeveStructures';
import type { UmgLibraryCandidate, UmgLibraryCandidatesByRole, UmgLibraryCandidateRoleBucket } from './umgLibraryCandidateRetrieval';
import { retrieveRoleTargetedUmgLibraryCandidates, summarizeUmgLibraryCandidates, umgLibraryIndexInfo } from './umgLibraryCandidateRetrieval';
import { resolveWorkflowSlots } from './umgBlockResolver';
import { composeSleeveFromResolvedSlots } from './umgSleeveComposer';
import { parseWorkflowIntent } from './umgWorkflowIntent';
import { planWorkflowSlots } from './umgWorkflowSlots';

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
  const intent = parseWorkflowIntent(input.sourcePrompt);
  const slots = planWorkflowSlots(intent);
  const roleTargeted = input.candidatesByRole
    ? { candidates: input.retrievedLibraryCandidates ?? [], candidatesByRole: input.candidatesByRole, missingRoles: input.missingRoles ?? [], rejectedCandidateIds: input.rejectedCandidateIds ?? [] }
    : retrieveRoleTargetedUmgLibraryCandidates(input.sourcePrompt, input.retrievedLibraryCandidates?.length ? { index: input.retrievedLibraryCandidates, perRoleLimit: 8, combinedLimit: 48 } : { perRoleLimit: 8, combinedLimit: 48 });
  const resolution = resolveWorkflowSlots({
    prompt: input.sourcePrompt,
    intent,
    slots,
    candidates: [...(input.retrievedLibraryCandidates ?? []), ...roleTargeted.candidates, ...Object.values(roleTargeted.candidatesByRole).flat()]
  });
  const composed = composeSleeveFromResolvedSlots({
    sourcePrompt: input.sourcePrompt,
    intent,
    slots,
    resolvedSlots: resolution.resolvedSlots,
    generationFailureReason: input.generationFailureReason,
    requestId: input.requestId
  });
  return {
    ...composed.sleeve,
    metadata: {
      ...composed.sleeve.metadata,
      uploadedContext: input.uploadedContext,
      libraryCandidateSummary: summarizeUmgLibraryCandidates(roleTargeted.candidates, roleTargeted.candidatesByRole),
      libraryCandidates: roleTargeted.candidates.slice(0, 24),
      candidatesByRole: roleTargeted.candidatesByRole,
      missingRoles: roleTargeted.missingRoles,
      rejectedCandidateIds: Array.from(new Set([...roleTargeted.rejectedCandidateIds, ...resolution.rejectedCandidateIds])),
      sourceStatusSummary: {
        ...(composed.sleeve.metadata.sourceStatusSummary as Record<string, unknown>),
        candidatesByRole: Object.fromEntries(Object.entries(roleTargeted.candidatesByRole).map(([role, roleCandidates]) => [role, roleCandidates.length])),
        missingRoles: roleTargeted.missingRoles,
        rejectedCandidateIds: Array.from(new Set([...roleTargeted.rejectedCandidateIds, ...resolution.rejectedCandidateIds])),
        libraryIndex: { moltBlocks: umgLibraryIndexInfo.counts?.molt ?? 0, neoBlocks: umgLibraryIndexInfo.counts?.neoblock ?? 0, neoStacks: umgLibraryIndexInfo.counts?.neostack ?? 0, metaMoltToolBlocks: 2 }
      }
    }
  };
}

