import type { UMGBlock } from './types';
import type { UMGNativeActionMode, UMGNativeActionRisk } from './cognitiveRuntimeTypes';

export type UMGMetaMoltToolBlock = UMGBlock & {
  metaSubtype: 'tool';
  moltType: 'Meta / Other';
  category: 'metamolt_tool';
  provider: 'hermes-native';
  capabilityId: string;
  risk: UMGNativeActionRisk;
  defaultActionMode: UMGNativeActionMode;
  supportedActionModes: UMGNativeActionMode[];
  requiresApprovalByDefault: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  nlCard: Record<string, unknown>;
  jsonSchema: Record<string, unknown>;
  sourceKind: 'runtime-session draft';
  actionPolicy: {
    observeAllowed: boolean;
    approvalAllowed: boolean;
    directAllowed: boolean;
    externalActionMayBeTaken: boolean;
    createdFilesMayBeProduced: boolean;
    modifiedFilesMayBeProduced: boolean;
    commandOutputMayBeProduced: boolean;
  };
};

type ToolBlockSpec = {
  id: string;
  title: string;
  capabilityId: string;
  description: string;
  content: string;
  tags: string[];
  risk: UMGNativeActionRisk;
  defaultActionMode: UMGNativeActionMode;
  supportedActionModes: UMGNativeActionMode[];
  requiresApprovalByDefault: boolean;
  actionPolicy: UMGMetaMoltToolBlock['actionPolicy'];
};

const baseTags = ['metamolt', 'tool', 'hermes-native', 'capability', 'action', 'executable'];

const specs: ToolBlockSpec[] = [
  {
    id: 'TOOL.HERMES.NOTE_CREATE.v0.1',
    title: 'Hermes Native Note Create',
    capabilityId: 'umg.native.hermes.note_create',
    description: 'Calls Hermes native note/file creation capability when invoked by a NeoBlock.',
    content: 'Use Hermes native tools to create a text note according to the runtime request and action policy.',
    tags: [...baseTags, 'note', 'file', 'create'],
    risk: 'low',
    defaultActionMode: 'approval',
    supportedActionModes: ['observe', 'approval', 'direct'],
    requiresApprovalByDefault: true,
    actionPolicy: { observeAllowed: true, approvalAllowed: true, directAllowed: true, externalActionMayBeTaken: true, createdFilesMayBeProduced: true, modifiedFilesMayBeProduced: false, commandOutputMayBeProduced: true }
  },
  {
    id: 'TOOL.HERMES.FILE_WRITE.v0.1',
    title: 'Hermes Native File Write',
    capabilityId: 'umg.native.hermes.file_write',
    description: 'Calls Hermes native file-writing capability when invoked by a NeoBlock.',
    content: 'Use Hermes native tools to write or update a file according to the runtime request and action policy.',
    tags: [...baseTags, 'file', 'write'],
    risk: 'medium',
    defaultActionMode: 'approval',
    supportedActionModes: ['observe', 'approval', 'direct'],
    requiresApprovalByDefault: true,
    actionPolicy: { observeAllowed: true, approvalAllowed: true, directAllowed: true, externalActionMayBeTaken: true, createdFilesMayBeProduced: true, modifiedFilesMayBeProduced: true, commandOutputMayBeProduced: true }
  },
  {
    id: 'TOOL.HERMES.FILE_READ.v0.1',
    title: 'Hermes Native File Read',
    capabilityId: 'umg.native.hermes.file_read',
    description: 'Calls Hermes native file-reading capability when invoked by a NeoBlock.',
    content: 'Use Hermes native tools to read a file according to the runtime request and action policy.',
    tags: [...baseTags, 'file', 'read'],
    risk: 'low',
    defaultActionMode: 'direct',
    supportedActionModes: ['observe', 'approval', 'direct'],
    requiresApprovalByDefault: false,
    actionPolicy: { observeAllowed: true, approvalAllowed: true, directAllowed: true, externalActionMayBeTaken: false, createdFilesMayBeProduced: false, modifiedFilesMayBeProduced: false, commandOutputMayBeProduced: true }
  },
  {
    id: 'TOOL.HERMES.SHELL_COMMAND.v0.1',
    title: 'Hermes Native Shell Command',
    capabilityId: 'umg.native.hermes.shell_command',
    description: 'Calls Hermes native shell/terminal command capability when invoked by a NeoBlock.',
    content: 'Use Hermes native tools to run an explicitly requested shell command according to the runtime request and action policy.',
    tags: [...baseTags, 'shell', 'terminal', 'command'],
    risk: 'high',
    defaultActionMode: 'approval',
    supportedActionModes: ['observe', 'approval', 'direct'],
    requiresApprovalByDefault: true,
    actionPolicy: { observeAllowed: true, approvalAllowed: true, directAllowed: true, externalActionMayBeTaken: true, createdFilesMayBeProduced: true, modifiedFilesMayBeProduced: true, commandOutputMayBeProduced: true }
  },
  {
    id: 'TOOL.HERMES.PROJECT_EDIT.v0.1',
    title: 'Hermes Native Project Edit',
    capabilityId: 'umg.native.hermes.project_edit',
    description: 'Calls Hermes native project editing capability when invoked by a NeoBlock.',
    content: 'Use Hermes native tools to edit project files according to the runtime request and action policy.',
    tags: [...baseTags, 'project', 'edit', 'source'],
    risk: 'high',
    defaultActionMode: 'approval',
    supportedActionModes: ['observe', 'approval', 'direct'],
    requiresApprovalByDefault: true,
    actionPolicy: { observeAllowed: true, approvalAllowed: true, directAllowed: true, externalActionMayBeTaken: true, createdFilesMayBeProduced: true, modifiedFilesMayBeProduced: true, commandOutputMayBeProduced: true }
  },
  {
    id: 'TOOL.HERMES.RUNTIME_TASK.v0.1',
    title: 'Hermes Native Runtime Task',
    capabilityId: 'umg.native.hermes.runtime_task',
    description: 'Asks Hermes to perform a native runtime task using available configured tools.',
    content: 'Use Hermes native runtime tools to perform the requested task according to the active UMG Gate/action policy.',
    tags: [...baseTags, 'runtime', 'task'],
    risk: 'medium',
    defaultActionMode: 'approval',
    supportedActionModes: ['observe', 'approval', 'direct'],
    requiresApprovalByDefault: true,
    actionPolicy: { observeAllowed: true, approvalAllowed: true, directAllowed: true, externalActionMayBeTaken: true, createdFilesMayBeProduced: true, modifiedFilesMayBeProduced: true, commandOutputMayBeProduced: true }
  }
];

export const HERMES_NATIVE_META_MOLT_TOOL_BLOCKS: UMGMetaMoltToolBlock[] = specs.map((spec, index) => ({
  id: spec.id,
  title: spec.title,
  type: 'molt_block',
  role: 'meta' as UMGBlock['role'],
  displayType: 'meta',
  moltType: 'Meta / Other',
  metaSubtype: 'tool',
  category: 'metamolt_tool',
  provider: 'hermes-native',
  capabilityId: spec.capabilityId,
  description: spec.description,
  content: spec.content,
  tags: spec.tags,
  risk: spec.risk,
  defaultActionMode: spec.defaultActionMode,
  supportedActionModes: spec.supportedActionModes,
  requiresApprovalByDefault: spec.requiresApprovalByDefault,
  inputSchema: {},
  outputSchema: {},
  nlCard: {},
  jsonSchema: {},
  sourceKind: 'runtime-session draft',
  actionPolicy: spec.actionPolicy,
  defaultState: 'off',
  visibility: 'visible',
  priorityOrder: 10_000 + index,
  hierarchy: { orderIndex: 10_000 + index, orderSource: 'default', priorityMeaning: 'hierarchy_order' },
  sourcePath: `runtime-session://metamolt-tools/${spec.id}`,
  sourceLayer: 'runtime-session',
  status: 'runnable',
  presentationStatus: 'runnable',
  source: { origin: 'generated', sourceId: spec.id, version: 'native-hermes-tool-blocks.v0.1' },
  legacy: { original: spec, sourcePath: `runtime-session://metamolt-tools/${spec.id}`, migrationWarnings: [] }
}));

export function getHermesNativeToolBlockByCapability(capabilityId: string) {
  return HERMES_NATIVE_META_MOLT_TOOL_BLOCKS.find((block) => block.capabilityId === capabilityId);
}
