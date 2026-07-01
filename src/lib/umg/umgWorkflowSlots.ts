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

export function planWorkflowSlots(intent: UmgWorkflowIntent): UmgWorkflowSlot[] {
  if (intent.workflowType === 'desktop_note_generation' && intent.outputStyle === 'haiku') return desktopHaikuSlots.map((slot) => ({ ...slot, acceptedRoles: [...slot.acceptedRoles], searchTerms: [...slot.searchTerms], preferredBlockIds: [...slot.preferredBlockIds] }));
  return [];
}
