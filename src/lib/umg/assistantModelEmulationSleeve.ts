import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import { normalizeMoltJsonSchema } from './hermesCustomSleeveGeneration';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve } from './templateSleeveStructures';
import type { UmgLibraryCandidate, UmgLibraryCandidatesByRole, UmgLibraryCandidateRoleBucket } from './umgLibraryCandidateRetrieval';
import { summarizeUmgLibraryCandidates, umgLibraryIndexInfo } from './umgLibraryCandidateRetrieval';
import { parseWorkflowIntent } from './umgWorkflowIntent';

export type AssistantModelEmulationSleeveInput = {
  sourcePrompt: string;
  retrievedLibraryCandidates?: UmgLibraryCandidate[];
  candidatesByRole?: UmgLibraryCandidatesByRole;
  missingRoles?: UmgLibraryCandidateRoleBucket[];
  rejectedCandidateIds?: string[];
  uploadedContext?: string;
  generationFailureReason?: string;
  requestId?: string;
};

type AssistantBlockSpec = {
  id: string;
  stackId: string;
  title: string;
  description: string;
  roles: Array<NormalizedTemplateMoltBlock['role']>;
  triggerTag?: boolean;
};

const stackSpecs = [
  { id: 'ASST.STACK.CONVERSATIONAL_INTAKE', title: 'CONVERSATIONAL_INTAKE_STACK', description: 'Normalize natural-language chat and user goals into safe assistant workflow state.' },
  { id: 'ASST.STACK.INSTRUCTION_FOLLOWING', title: 'INSTRUCTION_FOLLOWING_STACK', description: 'Resolve instruction hierarchy, explicit constraints, and assistant behavioral boundaries.' },
  { id: 'ASST.STACK.REASONING_AND_PLANNING', title: 'REASONING_AND_PLANNING_STACK', description: 'Decompose tasks and prepare structured reasoning summaries without exposing proprietary model internals.' },
  { id: 'ASST.STACK.CODING_ASSISTANCE', title: 'CODING_ASSISTANCE_STACK', description: 'Handle coding-help requests, explanations, reviews, and implementation planning.' },
  { id: 'ASST.STACK.CONTEXT_MEMORY_AWARENESS', title: 'CONTEXT_MEMORY_AWARENESS_STACK', description: 'Use provided context and memory hints while respecting boundaries and uncertainty.' },
  { id: 'ASST.STACK.TOOL_USE_PLANNING', title: 'TOOL_USE_PLANNING_STACK', description: 'Plan tool calls, check capabilities, and require approval gates before risky action.' },
  { id: 'ASST.STACK.OUTPUT_FORMATTING', title: 'OUTPUT_FORMATTING_STACK', description: 'Format answers in markdown, JSON, or concise summaries as requested.' },
  { id: 'ASST.STACK.SAFETY_BOUNDARY', title: 'SAFETY_BOUNDARY_STACK', description: 'Apply safety, uncertainty, hallucination-risk, and non-impersonation constraints.' },
  { id: 'ASST.STACK.RUNTIME_OBSERVER', title: 'RUNTIME_OBSERVER_STACK', description: 'Report runtime trace, workflow progress, and compile/runtime state for UMG Studio.' }
] as const;

const blockSpecs: AssistantBlockSpec[] = [
  { id: 'ASST.BLOCK.USER_INTENT_PARSER', stackId: 'ASST.STACK.CONVERSATIONAL_INTAKE', title: 'USER_INTENT_PARSER', description: 'Parse the user utterance, requested output mode, and task type from natural-language chat.', roles: ['directive', 'subject'], triggerTag: true },
  { id: 'ASST.BLOCK.CONVERSATION_STATE_TRACKER', stackId: 'ASST.STACK.CONVERSATIONAL_INTAKE', title: 'CONVERSATION_STATE_TRACKER', description: 'Track session state, prior context references, unresolved questions, and active objective.', roles: ['subject', 'primary'] },
  { id: 'ASST.BLOCK.INSTRUCTION_PRIORITY_RESOLVER', stackId: 'ASST.STACK.INSTRUCTION_FOLLOWING', title: 'INSTRUCTION_PRIORITY_RESOLVER', description: 'Apply instruction following with system, developer, user, and runtime constraints in priority order.', roles: ['directive', 'instruction', 'blueprint'] },
  { id: 'ASST.BLOCK.TASK_DECOMPOSER', stackId: 'ASST.STACK.REASONING_AND_PLANNING', title: 'TASK_DECOMPOSER', description: 'Break complex requests into ordered, checkable steps and identify missing context.', roles: ['instruction', 'blueprint'] },
  { id: 'ASST.BLOCK.REASONING_SUMMARY_BUILDER', stackId: 'ASST.STACK.REASONING_AND_PLANNING', title: 'REASONING_SUMMARY_BUILDER', description: 'Produce concise structured reasoning summaries and decisions without claiming proprietary internals.', roles: ['primary', 'blueprint'] },
  { id: 'ASST.BLOCK.CODE_HELP_REQUEST_HANDLER', stackId: 'ASST.STACK.CODING_ASSISTANCE', title: 'CODE_HELP_REQUEST_HANDLER', description: 'Classify coding-help requests and choose explain, patch, review, debug, or planning modes.', roles: ['directive', 'instruction'] },
  { id: 'ASST.BLOCK.CODE_EXPLANATION_BUILDER', stackId: 'ASST.STACK.CODING_ASSISTANCE', title: 'CODE_EXPLANATION_BUILDER', description: 'Draft code explanations, implementation guidance, and safe patch summaries.', roles: ['primary', 'blueprint'] },
  { id: 'ASST.BLOCK.CONTEXT_RETRIEVAL_PLANNER', stackId: 'ASST.STACK.CONTEXT_MEMORY_AWARENESS', title: 'CONTEXT_RETRIEVAL_PLANNER', description: 'Plan use of supplied context, memory awareness, and retrieval hints without inventing sources.', roles: ['instruction', 'subject'] },
  { id: 'ASST.BLOCK.MEMORY_BOUNDARY_CHECKER', stackId: 'ASST.STACK.CONTEXT_MEMORY_AWARENESS', title: 'MEMORY_BOUNDARY_CHECKER', description: 'Separate durable context, temporary session facts, and unknowns before producing answers.', roles: ['directive', 'primary'] },
  { id: 'ASST.BLOCK.TOOL_CAPABILITY_CHECKER', stackId: 'ASST.STACK.TOOL_USE_PLANNING', title: 'TOOL_CAPABILITY_CHECKER', description: 'Inspect available tools and determine whether a requested action needs a tool or can be answered directly.', roles: ['directive', 'subject'] },
  { id: 'ASST.BLOCK.TOOL_CALL_PLAN_BUILDER', stackId: 'ASST.STACK.TOOL_USE_PLANNING', title: 'TOOL_CALL_PLAN_BUILDER', description: 'Build explicit tool-use plans with inputs, expected outputs, side-effect boundaries, and verification steps.', roles: ['instruction', 'blueprint'] },
  { id: 'ASST.BLOCK.TOOL_APPROVAL_GATE', stackId: 'ASST.STACK.TOOL_USE_PLANNING', title: 'TOOL_APPROVAL_GATE', description: 'Gate destructive or externally mutating tool actions behind approval and policy checks.', roles: ['directive', 'primary'] },
  { id: 'ASST.BLOCK.MARKDOWN_OUTPUT_FORMATTER', stackId: 'ASST.STACK.OUTPUT_FORMATTING', title: 'MARKDOWN_OUTPUT_FORMATTER', description: 'Render final answers in clear markdown when requested or appropriate.', roles: ['primary', 'blueprint'] },
  { id: 'ASST.BLOCK.JSON_OUTPUT_FORMATTER', stackId: 'ASST.STACK.OUTPUT_FORMATTING', title: 'JSON_OUTPUT_FORMATTER', description: 'Render strict JSON objects when requested and avoid invalid mixed-format output.', roles: ['primary', 'blueprint'] },
  { id: 'ASST.BLOCK.SAFETY_BOUNDARY_CHECKER', stackId: 'ASST.STACK.SAFETY_BOUNDARY', title: 'SAFETY_BOUNDARY_CHECKER', description: 'Enforce safety, identity, privacy, and non-impersonation boundaries for a GPT-style assistant emulator.', roles: ['directive', 'instruction'] },
  { id: 'ASST.BLOCK.HALLUCINATION_RISK_CHECKER', stackId: 'ASST.STACK.SAFETY_BOUNDARY', title: 'HALLUCINATION_RISK_CHECKER', description: 'Flag unsupported claims, uncertainty, and citations/sources that were not actually retrieved.', roles: ['directive', 'primary'] },
  { id: 'ASST.BLOCK.RUNTIME_TRACE_REPORTER', stackId: 'ASST.STACK.RUNTIME_OBSERVER', title: 'RUNTIME_TRACE_REPORTER', description: 'Report UMG runtime trace, active block state, compile readiness, warnings, and final outputs.', roles: ['instruction', 'primary', 'blueprint'] }
];

function nlCardFor(title: string, role: string, content: string, tags: string[]) {
  return { title, role, category: 'deterministic_assistant_model_emulation', tags, description: content, content };
}

function schemaFor(kind: string, title: string) {
  return { type: 'object', required: ['id', 'title', 'content'], properties: { id: { type: 'string' }, title: { type: 'string', const: title }, content: { type: 'string' }, kind: { type: 'string', const: kind } } };
}

function moltFor(block: AssistantBlockSpec, role: NormalizedTemplateMoltBlock['role'], roleIndex: number, globalIndex: number): NormalizedTemplateMoltBlock {
  const title = `${block.title} ${role.toUpperCase()}`;
  const tags = ['assistant-model-emulation', 'gpt-style', 'gpt-4-class-behavior-emulator', 'runtime-session', role, ...(block.triggerTag ? ['trigger'] : [])];
  const content = `${block.description} Role: ${role}. This deterministic runtime-session draft supports GPT-style assistant workflow behavior without claiming GPT-4 identity or recreating proprietary OpenAI internals.`;
  const base = {
    id: `${block.id}.MOLT.${role.toUpperCase()}.${roleIndex + 1}`,
    title,
    role,
    content,
    description: content,
    tags,
    parentNeoBlockId: block.id,
    parentNeoStackId: block.stackId,
    stackOrder: globalIndex,
    sourceKind: 'runtime-session draft' as const,
    blockType: 'molt' as const,
    defaultState: 'off' as const,
    generationReason: `Deterministic assistant_model_emulation fallback generated this ${role} MOLT because no verified source-library candidate was bound.`
  };
  return { ...base, nlCard: nlCardFor(title, role, content, tags), jsonSchema: normalizeMoltJsonSchema(base) };
}

function gateRecord(id: string, title: string, blockId: string, conditionText: string, action: UMGGateRecord['action']): UMGGateRecord {
  return { id, title, attachesTo: { kind: 'neoblock', id: blockId }, triggerType: action === 'require_approval' ? 'approval' : 'runtime_condition', conditionText, action, targetIds: [blockId], defaultState: 'closed', runtimeState: 'inactive', tags: ['assistant-model-emulation', 'runtime-control', 'gate'], metadata: { promptContent: false, sourceKind: 'runtime-session draft' } };
}

export function buildAssistantModelEmulationSleeve(input: AssistantModelEmulationSleeveInput): NormalizedTemplateSleeve {
  const requestId = input.requestId ?? `assistant_model_emulation_${Date.now()}`;
  const intent = parseWorkflowIntent(input.sourcePrompt);
  const neoStacks: NormalizedTemplateNeoStack[] = stackSpecs.map((stack, index) => ({
    id: stack.id,
    title: stack.title,
    description: stack.description,
    stackOrder: index + 1,
    tags: ['assistant-model-emulation', 'gpt-style', 'runtime-session'],
    neoBlockIds: blockSpecs.filter((block) => block.stackId === stack.id).map((block) => block.id),
    sourceKind: 'runtime-session draft',
    blockType: 'neostack',
    generationReason: 'Deterministic assistant_model_emulation fallback stack generated without source-library mutation.',
    nlCard: nlCardFor(stack.title, 'neostack', stack.description, ['assistant-model-emulation', 'neostack']),
    jsonSchema: schemaFor('neostack', stack.title)
  }));
  const neoBlocks: NormalizedTemplateNeoBlock[] = blockSpecs.map((block, index) => ({
    id: block.id,
    title: block.title,
    description: block.description,
    neoStackId: block.stackId,
    blockOrder: index + 1,
    tags: ['assistant-model-emulation', 'gpt-style', 'runtime-session'],
    moltBlockIds: block.roles.map((role, roleIndex) => `${block.id}.MOLT.${role.toUpperCase()}.${roleIndex + 1}`),
    gateIds: block.id === 'ASST.BLOCK.TOOL_APPROVAL_GATE' ? ['ASST.GATE.TOOL_APPROVAL_REQUIRED'] : block.id === 'ASST.BLOCK.SAFETY_BOUNDARY_CHECKER' ? ['ASST.GATE.SAFETY_BOUNDARY'] : [],
    defaultState: 'off',
    runtimeState: 'idle',
    sourceKind: 'runtime-session draft',
    blockType: 'neoblock',
    generationReason: 'Deterministic assistant_model_emulation fallback NeoBlock generated to fill compile-required workflow structure.',
    nlCard: nlCardFor(block.title, 'neoblock', block.description, ['assistant-model-emulation', 'neoblock']),
    jsonSchema: schemaFor('neoblock', block.title)
  }));
  let globalMoltIndex = 0;
  const moltBlocks = blockSpecs.flatMap((block) => block.roles.map((role, roleIndex) => moltFor(block, role, roleIndex, ++globalMoltIndex)));
  const gates = [
    gateRecord('ASST.GATE.TOOL_APPROVAL_REQUIRED', 'Tool Approval Gate', 'ASST.BLOCK.TOOL_APPROVAL_GATE', 'Require approval before externally mutating or risky tool-use plans execute.', 'require_approval'),
    gateRecord('ASST.GATE.SAFETY_BOUNDARY', 'Safety Boundary Gate', 'ASST.BLOCK.SAFETY_BOUNDARY_CHECKER', 'Open only when the assistant response respects safety, privacy, non-impersonation, and uncertainty boundaries.', 'activate')
  ];
  const candidateCount = input.retrievedLibraryCandidates?.length ?? 0;
  const hermesEmptyOutput = /empty output|did not contain a valid JSON object|strict JSON retry/i.test(input.generationFailureReason ?? '');
  const sourceStatusSummary = {
    candidateCount,
    candidatesBoundIntoSleeve: 0,
    runtimeWorkspaceDraftBlocksGenerated: neoStacks.length + neoBlocks.length + moltBlocks.length,
    generatedRuntimeDrafts: moltBlocks.length,
    sourceBindingStatus: 'runtime_draft_fallback_no_source_binding',
    compileEligibility: 'yes',
    reason: candidateCount > 0 ? 'Library candidates were found, but none were bound; deterministic runtime/workspace draft blocks filled required roles.' : 'Deterministic runtime/workspace draft blocks filled required roles.',
    libraryIndex: { moltBlocks: umgLibraryIndexInfo.counts?.molt ?? 0, neoBlocks: umgLibraryIndexInfo.counts?.neoblock ?? 0, neoStacks: umgLibraryIndexInfo.counts?.neostack ?? 0, metaMoltToolBlocks: 0 }
  };
  return {
    id: `SLV.ASST.MODEL_EMULATION.${requestId}`,
    title: 'GPT-4-Class Assistant Behavior Emulator Sleeve',
    version: '1.0.0',
    description: 'Deterministic GPT-style general assistant workflow emulator for UMG Studio. It supports chat, instruction following, coding help, reasoning summaries, tool-use planning, context awareness, markdown/JSON output modes, and safety boundaries without claiming to be GPT-4 or recreating proprietary internals.',
    isTemplate: true,
    templateKind: 'custom',
    source: 'session',
    tags: ['assistant-model-emulation', 'gpt-style', 'gpt-4-class-behavior-emulator', 'deterministic-fallback', 'runtime-session'],
    neoStacks,
    neoBlocks,
    moltBlocks,
    gates,
    governanceBlockIds: gates.map((gate) => gate.id),
    defaultExecutionMode: 'approvalRequired',
    metadata: {
      requestId,
      sourcePrompt: input.sourcePrompt,
      uploadedContext: input.uploadedContext,
      workflowIntent: intent,
      workflowIntentName: 'assistant_model_emulation',
      generationRoute: 'deterministic_assistant_model_emulation',
      deterministicFallbackUsed: 'assistant_model_emulation',
      fallbackUsed: true,
      fallbackReason: 'recognized assistant_model_emulation prompt; runtime/workspace draft fallback is compile-eligible without source-library binding',
      hermesEnhancementFailed: Boolean(input.generationFailureReason),
      hermesEnhancementWarning: input.generationFailureReason ? `Hermes enhancement failed: ${hermesEmptyOutput ? 'empty output' : input.generationFailureReason}` : undefined,
      liveHermesGenerated: false,
      generatedByHermes: false,
      noFakeLiveHermesGeneration: true,
      noFakeHermesOutput: true,
      noFakeSourceBinding: true,
      sourceLibraryWrite: false,
      protectedSourceLibraryWrite: false,
      compileEligible: true,
      compileEligibility: 'yes',
      libraryCandidateSummary: summarizeUmgLibraryCandidates(input.retrievedLibraryCandidates ?? [], input.candidatesByRole),
      libraryCandidates: (input.retrievedLibraryCandidates ?? []).slice(0, 24),
      candidatesByRole: input.candidatesByRole ?? {},
      missingRoles: input.missingRoles ?? [],
      rejectedCandidateIds: input.rejectedCandidateIds ?? [],
      generatedDrafts: [...neoStacks.map((stack) => stack.id), ...neoBlocks.map((block) => block.id), ...moltBlocks.map((block) => block.id)],
      sourceStatusSummary,
      capabilities: [],
      warnings: [
        'Deterministic fallback used: assistant_model_emulation.',
        ...(input.generationFailureReason ? [`Hermes enhancement failed: ${hermesEmptyOutput ? 'empty output' : input.generationFailureReason}.`] : []),
        'No source-library candidates were claimed as bound; all generated structure is runtime-session draft content.'
      ]
    }
  };
}
