import type { UmgWorkflowIntent } from './umgWorkflowIntent';
import type { UmgLibraryCandidateBlockType } from './umgLibraryCandidateRetrieval';

export type UmgWorkflowSlot = {
  id: string;
  required: boolean;
  acceptedRoles: string[];
  searchTerms: string[];
  preferredBlockIds: string[];
  parentNeoBlockHint: string;
  fallbackDraftAllowed: boolean;
  acceptedBlockTypes?: UmgLibraryCandidateBlockType[];
};

const desktopHaikuSlots: UmgWorkflowSlot[] = [
  { id: 'intake_trigger', required: true, acceptedRoles: ['directive'], searchTerms: ['note', 'trigger', 'request'], preferredBlockIds: [], parentNeoBlockHint: 'Detect Note Generation Request', fallbackDraftAllowed: true },
  { id: 'note_subject', required: true, acceptedRoles: ['subject'], searchTerms: ['note', 'text document', 'desktop file'], preferredBlockIds: [], parentNeoBlockHint: 'Normalize Note Intent', fallbackDraftAllowed: true },
  { id: 'writing_instruction', required: true, acceptedRoles: ['instruction'], searchTerms: ['write', 'compose', 'generate text'], preferredBlockIds: [], parentNeoBlockHint: 'Compose Final Haiku Draft', fallbackDraftAllowed: true },
  { id: 'haiku_blueprint', required: true, acceptedRoles: ['blueprint'], searchTerms: ['haiku', 'poetry', 'verse', '5-7-5'], preferredBlockIds: ['BP.031'], parentNeoBlockHint: 'Resolve Haiku Form', fallbackDraftAllowed: true },
  { id: 'output_artifact', required: true, acceptedRoles: ['primary', 'subject'], searchTerms: ['output artifact', 'text note', 'desktop file'], preferredBlockIds: [], parentNeoBlockHint: 'Validate Draft Structure and Haiku Readiness', fallbackDraftAllowed: true },
  { id: 'note_create_tool', required: true, acceptedRoles: ['meta', 'metaTool', 'capability'], searchTerms: ['note create', 'Hermes note create', 'native tool'], preferredBlockIds: ['TOOL.HERMES.NOTE_CREATE.v0.1'], parentNeoBlockHint: 'Execute Desktop Note Creation', fallbackDraftAllowed: false, acceptedBlockTypes: ['capability'] },
  { id: 'file_write_tool', required: true, acceptedRoles: ['meta', 'metaTool', 'capability'], searchTerms: ['file write', 'Hermes file write', 'native tool'], preferredBlockIds: ['TOOL.HERMES.FILE_WRITE.v0.1'], parentNeoBlockHint: 'Execute Desktop Note Creation', fallbackDraftAllowed: false, acceptedBlockTypes: ['capability'] },
  { id: 'action_gate', required: true, acceptedRoles: ['gate'], searchTerms: ['approval', 'file write action', 'gate'], preferredBlockIds: [], parentNeoBlockHint: 'Prepare Desktop Note Output Action', fallbackDraftAllowed: true, acceptedBlockTypes: ['gate', 'molt'] },
  { id: 'output_verification', required: true, acceptedRoles: ['instruction', 'directive'], searchTerms: ['verify', 'validation', 'output'], preferredBlockIds: [], parentNeoBlockHint: 'Verify Note Creation', fallbackDraftAllowed: true }
];

const assistantModelEmulationSlots: UmgWorkflowSlot[] = [
  { id: 'assistant_intake_trigger', required: true, acceptedRoles: ['directive'], searchTerms: ['gpt', 'chatgpt', 'assistant', 'natural-language chat', 'trigger'], preferredBlockIds: [], parentNeoBlockHint: 'USER_INTENT_PARSER', fallbackDraftAllowed: true },
  { id: 'assistant_subject_context', required: true, acceptedRoles: ['subject'], searchTerms: ['language model', 'general assistant', 'conversation state', 'context'], preferredBlockIds: [], parentNeoBlockHint: 'CONVERSATION_STATE_TRACKER', fallbackDraftAllowed: true },
  { id: 'instruction_following_policy', required: true, acceptedRoles: ['directive', 'instruction'], searchTerms: ['instruction following', 'priority', 'policy', 'constraints'], preferredBlockIds: [], parentNeoBlockHint: 'INSTRUCTION_PRIORITY_RESOLVER', fallbackDraftAllowed: true },
  { id: 'reasoning_planning_blueprint', required: true, acceptedRoles: ['blueprint', 'instruction'], searchTerms: ['reasoning assistant', 'task decomposition', 'structured reasoning', 'planning'], preferredBlockIds: [], parentNeoBlockHint: 'TASK_DECOMPOSER', fallbackDraftAllowed: true },
  { id: 'coding_help_instruction', required: true, acceptedRoles: ['instruction', 'primary'], searchTerms: ['coding help', 'code explanation', 'developer assistance'], preferredBlockIds: [], parentNeoBlockHint: 'CODE_HELP_REQUEST_HANDLER', fallbackDraftAllowed: true },
  { id: 'tool_use_planning_policy', required: true, acceptedRoles: ['directive', 'blueprint'], searchTerms: ['tool-use planning', 'tool approval', 'capability checker'], preferredBlockIds: [], parentNeoBlockHint: 'TOOL_CALL_PLAN_BUILDER', fallbackDraftAllowed: true },
  { id: 'assistant_output_primary', required: true, acceptedRoles: ['primary'], searchTerms: ['markdown output', 'json output', 'reasoning summary', 'final answer'], preferredBlockIds: [], parentNeoBlockHint: 'MARKDOWN_OUTPUT_FORMATTER', fallbackDraftAllowed: true },
  { id: 'safety_boundary_policy', required: true, acceptedRoles: ['directive', 'instruction'], searchTerms: ['safety boundaries', 'hallucination risk', 'do not claim GPT-4', 'non impersonation'], preferredBlockIds: [], parentNeoBlockHint: 'SAFETY_BOUNDARY_CHECKER', fallbackDraftAllowed: true },
  { id: 'runtime_observer_blueprint', required: true, acceptedRoles: ['blueprint', 'primary'], searchTerms: ['runtime observer', 'trace reporter', 'compile status'], preferredBlockIds: [], parentNeoBlockHint: 'RUNTIME_TRACE_REPORTER', fallbackDraftAllowed: true }
];

function cloneSlots(slots: UmgWorkflowSlot[]) {
  return slots.map((slot) => ({ ...slot, acceptedRoles: [...slot.acceptedRoles], searchTerms: [...slot.searchTerms], preferredBlockIds: [...slot.preferredBlockIds], acceptedBlockTypes: slot.acceptedBlockTypes ? [...slot.acceptedBlockTypes] : undefined }));
}

export function planWorkflowSlots(intent: UmgWorkflowIntent): UmgWorkflowSlot[] {
  if (intent.workflowType === 'assistant_model_emulation') return cloneSlots(assistantModelEmulationSlots);
  if (intent.workflowType === 'desktop_note_generation' && intent.outputStyle === 'haiku') return cloneSlots(desktopHaikuSlots);
  return [];
}
