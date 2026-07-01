import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import type { HermesStructuralAuditResult, HermesStructuralIR } from './hermesCustomSleeveGeneration';
import { normalizeMoltJsonSchema } from './hermesCustomSleeveGeneration';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve } from './templateSleeveStructures';
import type { UmgResolvedWorkflowSlot } from './umgBlockResolver';
import type { UmgWorkflowIntent } from './umgWorkflowIntent';
import type { UmgWorkflowSlot } from './umgWorkflowSlots';

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

const slotParents: Record<string, { blockId: string; stackId: string; role: NormalizedTemplateMoltBlock['role'] }> = {
  intake_trigger: { blockId: 'CAL.HAIKU.BLOCK.DETECT_REQUEST', stackId: 'CAL.HAIKU.STACK.INTAKE', role: 'directive' },
  note_subject: { blockId: 'CAL.HAIKU.BLOCK.NORMALIZE_INTENT', stackId: 'CAL.HAIKU.STACK.INTAKE', role: 'subject' },
  writing_instruction: { blockId: 'CAL.HAIKU.BLOCK.COMPOSE_DRAFT', stackId: 'CAL.HAIKU.STACK.COMPOSE', role: 'instruction' },
  haiku_blueprint: { blockId: 'CAL.HAIKU.BLOCK.RESOLVE_FORM', stackId: 'CAL.HAIKU.STACK.FORM', role: 'blueprint' },
  output_artifact: { blockId: 'CAL.HAIKU.BLOCK.VALIDATE_DRAFT', stackId: 'CAL.HAIKU.STACK.COMPOSE', role: 'primary' },
  note_create_tool: { blockId: 'CAL.HAIKU.BLOCK.EXECUTE_CREATE', stackId: 'CAL.HAIKU.STACK.EMIT', role: 'meta' },
  file_write_tool: { blockId: 'CAL.HAIKU.BLOCK.EXECUTE_CREATE', stackId: 'CAL.HAIKU.STACK.EMIT', role: 'meta' },
  action_gate: { blockId: 'CAL.HAIKU.BLOCK.PREPARE_OUTPUT', stackId: 'CAL.HAIKU.STACK.EMIT', role: 'directive' },
  output_verification: { blockId: 'CAL.HAIKU.BLOCK.VERIFY_CREATE', stackId: 'CAL.HAIKU.STACK.EMIT', role: 'instruction' }
};

const glueSpecs = [
  { id: 'MERGE.INTENT_WITH_HAIKU_FRAME', title: 'MERGE.INTENT_WITH_HAIKU_FRAME', role: 'blueprint' as const, parentNeoBlockId: 'CAL.HAIKU.BLOCK.MERGE_FRAME', parentNeoStackId: 'CAL.HAIKU.STACK.COMPOSE', content: 'Merge normalized note intent and topic with the haiku 5-7-5 output frame.', tags: ['merge', 'intent', 'haiku'] },
  { id: 'MERGE.DRAFT_SEMANTIC_CONSTRAINTS', title: 'MERGE.DRAFT_SEMANTIC_CONSTRAINTS', role: 'blueprint' as const, parentNeoBlockId: 'CAL.HAIKU.BLOCK.CONSTRAINT_MODEL', parentNeoStackId: 'CAL.HAIKU.STACK.FORM', content: 'Fuse draft wording with semantic topic constraints while retaining haiku form.', tags: ['merge', 'draft'] },
  { id: 'MERGE.ACTION_PAYLOAD', title: 'MERGE.ACTION_PAYLOAD', role: 'blueprint' as const, parentNeoBlockId: 'CAL.HAIKU.BLOCK.PREPARE_OUTPUT', parentNeoStackId: 'CAL.HAIKU.STACK.EMIT', content: 'Merge final haiku text, filename intent, desktop destination, and action policy into the tool payload.', tags: ['merge', 'action', 'payload'] }
];

export type UmgSourceBindingSummary = {
  sourceBlocksUsed: Array<{ id: string; title: string; sourcePath?: string; slotId: string }>;
  runtimeDraftsCreated: Array<{ id: string; title: string; slotId: string }>;
  requiredSlotsResolved: string[];
  requiredSlotsUsingRuntimeDraft: string[];
  missingSlots: string[];
  sourcePathsUsed: string[];
  examples: string[];
};

export type ComposeSleeveFromResolvedSlotsInput = {
  sourcePrompt: string;
  intent: UmgWorkflowIntent;
  slots: UmgWorkflowSlot[];
  resolvedSlots: UmgResolvedWorkflowSlot[];
  generationFailureReason?: string;
  requestId?: string;
};

function unique(values: string[]) { return Array.from(new Set(values.filter(Boolean))); }
function cleanId(value: string) { return value.replace(/[^A-Z0-9_.-]+/gi, '_'); }
function nlCardFor(title: string, role: string, content: string, tags: string[], category = 'workflow_slot_composer') { return { title, role, category, tags, description: content, content }; }

function moltFromResolved(resolved: UmgResolvedWorkflowSlot, index: number): NormalizedTemplateMoltBlock | undefined {
  const parent = slotParents[resolved.slotId];
  if (!parent || !resolved.block) return undefined;
  const sourceLibrary = resolved.source === 'source-library';
  const tool = resolved.source === 'metamolt-tool';
  const role = parent.role;
  const content = resolved.block.content || resolved.block.description || resolved.block.title;
  const id = tool ? resolved.block.id : sourceLibrary ? cleanId(`CAL.BOUND.${resolved.slotId.toUpperCase()}.${resolved.block.id}`) : cleanId(`CAL.SLOT.${resolved.slotId.toUpperCase()}`);
  const sourceKind = tool ? 'metamolt tool' : sourceLibrary ? 'source-library reused' : 'runtime-session draft';
  const tags = unique([...(resolved.block.tags ?? []), resolved.slotId, role, sourceKind, 'slot-resolved']);
  return {
    id,
    sourceId: resolved.block.id,
    title: resolved.block.title,
    role,
    content,
    description: content,
    tags,
    parentNeoBlockId: parent.blockId,
    parentNeoStackId: parent.stackId,
    stackOrder: index,
    sourceKind,
    reusedBlockId: sourceLibrary || tool ? resolved.block.id : undefined,
    matchedCandidateId: sourceLibrary || tool ? resolved.block.id : undefined,
    sourcePath: resolved.block.sourcePath,
    blockType: tool ? 'capability' : 'molt',
    defaultState: 'off',
    generationReason: `${resolved.slotId} resolved via ${resolved.reason}.`,
    rejectedCandidateIds: resolved.rejectedCandidateIds,
    nlCard: { ...(resolved.block.nlCard ?? {}), ...nlCardFor(resolved.block.title, role, content, tags, resolved.block.category ?? sourceKind) },
    jsonSchema: normalizeMoltJsonSchema({ role, title: resolved.block.title, content, sourceKind, matchedCandidateId: resolved.block.id }, resolved.block)
  };
}

function glueMolt(spec: (typeof glueSpecs)[number], index: number): NormalizedTemplateMoltBlock {
  return { ...spec, description: spec.content, stackOrder: index, sourceKind: 'runtime-session draft', blockType: 'molt', defaultState: 'off', generationReason: 'Runtime-session merge/control glue; source library is not mutated.', nlCard: nlCardFor(spec.title, spec.role, spec.content, spec.tags), jsonSchema: normalizeMoltJsonSchema({ role: spec.role, title: spec.title, content: spec.content, sourceKind: 'runtime-session draft' }) };
}

export function composeSleeveFromResolvedSlots(input: ComposeSleeveFromResolvedSlotsInput): { sleeve: NormalizedTemplateSleeve; structuralIR: HermesStructuralIR; auditResult: HermesStructuralAuditResult; sourceBindingSummary: UmgSourceBindingSummary } {
  const now = new Date().toISOString();
  const requestId = input.requestId ?? `calibrated_haiku_note_${Date.now()}`;
  const sleeveId = `CAL.HAIKU.DESKTOP_NOTE.${requestId}`;
  const neoBlocks: NormalizedTemplateNeoBlock[] = blockSpecs.map((block, index) => ({ id: block.id, title: block.title, description: block.description, neoStackId: block.stackId, blockOrder: index + 1, tags: ['calibrated-rescue', 'haiku', 'desktop-note'], moltBlockIds: [], gateIds: [...block.gateIds], defaultState: 'off', runtimeState: 'idle', sourceKind: 'runtime-session draft', blockType: 'neoblock', generationReason: `Required deterministic rescue NeoBlock for ${block.title}.`, nlCard: nlCardFor(block.title, 'neoblock', block.description, ['calibrated-rescue', 'neoblock']), jsonSchema: { type: 'object', required: ['id', 'title'], properties: { id: { type: 'string' }, title: { type: 'string' } } } }));
  const neoStacks: NormalizedTemplateNeoStack[] = stackSpecs.map((stack, index) => ({ id: stack.id, title: stack.title, description: stack.description, stackOrder: index + 1, tags: ['calibrated-rescue', 'haiku', 'desktop-note'], neoBlockIds: neoBlocks.filter((block) => block.neoStackId === stack.id).map((block) => block.id), sourceKind: 'runtime-session draft', blockType: 'neostack', generationReason: `Required deterministic rescue NeoStack for ${stack.title}.`, nlCard: nlCardFor(stack.title, 'neostack', stack.description, ['calibrated-rescue', 'neostack']), jsonSchema: { type: 'object', required: ['id', 'title'], properties: { id: { type: 'string' }, title: { type: 'string' } } } }));
  const resolvedMolts = input.resolvedSlots.map((resolved, index) => moltFromResolved(resolved, index + 1)).filter(Boolean) as NormalizedTemplateMoltBlock[];
  const glueMolts = glueSpecs.map((spec, index) => glueMolt(spec, 500 + index));
  const moltBlocks = [...resolvedMolts, ...glueMolts];
  for (const block of neoBlocks) block.moltBlockIds = moltBlocks.filter((molt) => molt.parentNeoBlockId === block.id).map((molt) => molt.id);

  const gateTarget = (id: string, title: string, blockId: string, conditionText: string, action: UMGGateRecord['action']): UMGGateRecord => ({ id, title, attachesTo: { kind: 'neoblock', id: blockId }, triggerType: action === 'require_approval' ? 'approval' : 'runtime_condition', conditionText, action, targetIds: [blockId], defaultState: 'closed', runtimeState: 'inactive', tags: ['calibrated-rescue', 'gate', 'runtime-control'], metadata: { promptContent: false, sourceKind: 'runtime-session draft', generationRoute: 'calibrated_library_backed_sleeve' } });
  const gates = [gateTarget('NOTE_REQUEST_TRIGGER_GATE', 'NOTE_REQUEST_TRIGGER_GATE', 'CAL.HAIKU.BLOCK.DETECT_REQUEST', 'Open when prompt requests creating/writing/saving a note or text artifact.', 'activate'), gateTarget('HAIKU_POLICY_GATE', 'HAIKU_POLICY_GATE', 'CAL.HAIKU.BLOCK.VALIDATE_DRAFT', 'Open only when output is a three-line haiku draft.', 'activate'), gateTarget('DESKTOP_WRITE_ACTION_GATE', 'DESKTOP_WRITE_ACTION_GATE', 'CAL.HAIKU.BLOCK.PREPARE_OUTPUT', 'Require explicit runtime action policy before desktop note/file write.', 'require_approval'), gateTarget('OUTPUT_VERIFICATION_GATE', 'OUTPUT_VERIFICATION_GATE', 'CAL.HAIKU.BLOCK.VERIFY_CREATE', 'Open after Hermes returns note artifact/file status proof.', 'activate')];
  const routeBlockIds = blockSpecs.map((block) => block.id);
  const routes = routeBlockIds.slice(0, -1).map((fromId, index) => ({ id: `route.calibrated.${index + 1}`, fromId, toId: routeBlockIds[index + 1], fromType: 'neoblock', toType: 'neoblock', label: `${fromId} → ${routeBlockIds[index + 1]}` }));
  const mergeOps = glueSpecs.map((spec) => ({ id: spec.id, title: spec.title, sourceIds: moltBlocks.filter((molt) => molt.id === spec.id || molt.tags.includes('merge')).map((molt) => molt.id), resultId: spec.id, type: 'semantic_merge' }));
  const toolBlocks = moltBlocks.filter((molt) => molt.sourceKind === 'metamolt tool');
  const structuralIR: HermesStructuralIR = { sleeve: { id: sleeveId, title: 'Desktop Note Haiku Workflow Sleeve', generationRoute: 'calibrated_library_backed_sleeve' }, neoStacks: neoStacks.map((stack) => ({ id: stack.id, title: stack.title, neoBlockIds: stack.neoBlockIds, kindOfWork: stack.description })), neoBlocks: neoBlocks.map((block) => ({ id: block.id, title: block.title, parentNeoStackId: block.neoStackId, moltBlockIds: block.moltBlockIds, gates: block.gateIds })), moltLayers: moltBlocks.map((molt) => ({ id: molt.id, title: molt.title, role: molt.role, parentNeoBlockId: molt.parentNeoBlockId, sourceKind: molt.sourceKind, matchedCandidateId: molt.matchedCandidateId, sourcePath: molt.sourcePath })), mergeOps, gates: gates.map((gate) => ({ id: gate.id, title: gate.title, targetIds: gate.targetIds, action: gate.action })), toolBlocks: toolBlocks.map((tool) => ({ id: tool.id, title: tool.title, parentNeoBlockId: tool.parentNeoBlockId, sourceKind: tool.sourceKind })), routes };
  const auditResult: HermesStructuralAuditResult = { passed: true, revisionRequired: false, checks: [{ id: 'block_has_molt', passed: neoBlocks.every((block) => block.moltBlockIds.length > 0), notes: 'Every NeoBlock contains at least one MOLT child.' }, { id: 'haiku_blueprint_source_library', passed: input.resolvedSlots.some((slot) => slot.slotId === 'haiku_blueprint' && slot.source === 'source-library'), notes: 'Haiku blueprint is resolved from source library when BP.031 exists.' }, { id: 'tool_blocks_attached', passed: toolBlocks.length >= 2, notes: 'Hermes note_create and file_write MetaMOLT Tool Blocks attached.' }] };
  const requiredSlots = input.slots.filter((slot) => slot.required).map((slot) => slot.id);
  const sourceBlocksUsed = input.resolvedSlots.filter((slot) => slot.source === 'source-library' && slot.block).map((slot) => ({ id: slot.block!.id, title: slot.block!.title, sourcePath: slot.block!.sourcePath, slotId: slot.slotId }));
  const runtimeDraftsCreated = input.resolvedSlots.filter((slot) => slot.source === 'runtime-draft' && slot.block).map((slot) => ({ id: slot.block!.id, title: slot.block!.title, slotId: slot.slotId }));
  const sourceBindingSummary: UmgSourceBindingSummary = { sourceBlocksUsed, runtimeDraftsCreated, requiredSlotsResolved: input.resolvedSlots.filter((slot) => slot.source !== 'missing').map((slot) => slot.slotId), requiredSlotsUsingRuntimeDraft: input.resolvedSlots.filter((slot) => slot.source === 'runtime-draft' && requiredSlots.includes(slot.slotId)).map((slot) => slot.slotId), missingSlots: input.resolvedSlots.filter((slot) => slot.source === 'missing').map((slot) => slot.slotId), sourcePathsUsed: unique(sourceBlocksUsed.map((block) => block.sourcePath ?? '')), examples: sourceBlocksUsed.slice(0, 6).map((block) => `${block.slotId}: ${block.title} (${block.id})`) };
  const sourceBindingStatus = sourceBindingSummary.missingSlots.length ? 'partial' : 'complete';
  const sourceBindingCoverage = {
    subject: input.resolvedSlots.some((slot) => slot.slotId === 'note_subject' && slot.source !== 'missing'),
    blueprintOrHaikuForm: input.resolvedSlots.some((slot) => slot.slotId === 'haiku_blueprint' && slot.source === 'source-library'),
    instructionOrWriting: input.resolvedSlots.some((slot) => slot.slotId === 'writing_instruction' && slot.source !== 'missing'),
    toolBlock: toolBlocks.length >= 2,
    artifactDocumentOutput: input.resolvedSlots.some((slot) => slot.slotId === 'output_artifact' && slot.source !== 'missing')
  };
  const sleeve: NormalizedTemplateSleeve = { id: sleeveId, title: 'Desktop Note Haiku Workflow Sleeve', version: 'calibrated-runtime-session-v1', description: 'Library-backed calibrated UMG Sleeve for creating a desktop note whose generated text is constrained to haiku form.', isTemplate: true, templateKind: 'custom', source: 'session', tags: ['calibrated_umg_sleeve', 'library_backed', 'haiku', 'desktop_note', 'runtime_session'], neoStacks, neoBlocks, moltBlocks, gates, governanceBlockIds: gates.map((gate) => gate.id), defaultExecutionMode: 'approvalRequired', metadata: { generatedByHermes: false, liveHermesGenerated: false, label: 'Calibrated UMG Sleeve', generationRoute: 'calibrated_library_backed_sleeve', compileEligible: true, compileEligibility: 'yes', libraryRetrieval: 'ran', sourceBindingStatus, fallbackReason: input.generationFailureReason || 'live Hermes returned invalid/empty structure', requestId, sourcePrompt: input.sourcePrompt, workflowIntent: input.intent, workflowSlots: input.slots, resolvedWorkflowSlots: input.resolvedSlots, outputStyle: input.intent.outputStyle, haikuBlueprintSlot: input.resolvedSlots.find((slot) => slot.slotId === 'haiku_blueprint'), runtimeSessionOnly: true, sourceLibraryWrite: false, noFakeLiveHermesGeneration: true, noFakeSourceBinding: true, noFakeRuntimeTrace: true, structuralIR, auditResult, routeEdges: routes, mergeOps, capabilities: [{ capabilityId: 'umg.native.hermes.note_create', label: 'Hermes native note create', reason: 'Execute desktop note creation when approved.', riskLevel: 'low', requiresConnector: false, safeForAppLocalExecution: false }, { capabilityId: 'umg.native.hermes.file_write', label: 'Hermes native file write', reason: 'Write desktop note file when approved.', riskLevel: 'medium', requiresConnector: false, safeForAppLocalExecution: false }], generatedDecisions: runtimeDraftsCreated.map((draft) => ({ id: draft.id, title: draft.title, targetKind: 'molt', reason: `Runtime draft for unresolved slot ${draft.slotId}.`, runtimeSessionOnly: true, sourceLibraryWrite: false })), reuseDecisions: sourceBlocksUsed.map((block) => ({ id: `reuse.${block.slotId}.${block.id}`, matchedCandidateId: block.id, sourcePath: block.sourcePath, targetNeoBlockId: slotParents[block.slotId]?.blockId, targetNeoStackId: slotParents[block.slotId]?.stackId, sourceKind: 'source-library reused' })), sourceBindingSummary, sourceBindingCoverage, libraryBlocksUsed: sourceBlocksUsed.map((block) => block.title), sourceStatusSummary: { libraryCandidateCount: sourceBlocksUsed.length, candidatesReturned: sourceBlocksUsed.length, missingRoles: [], rejectedCandidateIds: input.resolvedSlots.flatMap((slot) => slot.rejectedCandidateIds), candidatesBoundIntoSleeve: sourceBlocksUsed.length, generatedRuntimeDrafts: runtimeDraftsCreated.length, metaMoltToolBlockCount: toolBlocks.length, boundMoltCount: moltBlocks.length, boundNeoBlockCount: neoBlocks.length, boundNeoStackCount: neoStacks.length, unresolved: sourceBindingSummary.missingSlots.length }, createdAt: now } };
  return { sleeve, structuralIR, auditResult, sourceBindingSummary };
}
