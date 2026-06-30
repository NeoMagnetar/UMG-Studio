export type UMGRuntimeScopeKind =
  | 'sleeve'
  | 'neostack'
  | 'neoblock'
  | 'molt'
  | 'gate'
  | 'tool'
  | 'approval';

export type UMGRuntimeState =
  | 'idle'
  | 'queued'
  | 'active'
  | 'processing'
  | 'attention'
  | 'complete'
  | 'skipped'
  | 'blocked'
  | 'error';

export type UMGTraceEventType =
  | 'run_started'
  | 'sleeve_loaded'
  | 'gate_evaluated'
  | 'gate_blocked'
  | 'neostack_started'
  | 'neostack_completed'
  | 'neoblock_started'
  | 'neoblock_completed'
  | 'neoblock_rerouted'
  | 'molt_role_used'
  | 'tool_call_prepared'
  | 'tool_call_requires_approval'
  | 'approval_granted'
  | 'approval_denied'
  | 'tool_call_executed'
  | 'tool_call_blocked'
  | 'tool_result_received'
  | 'run_completed'
  | 'run_error'
  | 'route_started'
  | 'gate_opened'
  | 'gate_closed'
  | 'block_queued'
  | 'block_activated'
  | 'block_processing'
  | 'block_completed'
  | 'block_skipped'
  | 'tool_requested'
  | 'approval_required'
  | 'tool_executed'
  | 'tool_blocked'
  | 'route_completed'
  | 'tool_block_resolved'
  | 'action_request_created'
  | 'action_approval_required'
  | 'action_executed'
  | 'file_created'
  | 'file_modified'
  | 'artifact_created'
  | 'action_failed'
  | 'action_blocked'
  | 'error';

export type UMGTraceEvent = {
  traceId: string;
  timestamp: number;
  scopeKind: UMGRuntimeScopeKind;
  sleeveId?: string;
  neoStackId?: string;
  neoBlockId?: string;
  moltBlockId?: string;
  gateId?: string;
  sourceId?: string;
  metadataAliases?: string[];
  toolId?: string;
  approvalId?: string;
  eventType: UMGTraceEventType;
  state: UMGRuntimeState;
  label: string;
  details?: string;
  raw?: unknown;
};

export type UMGGateAttachTargetKind = 'sleeve' | 'neostack' | 'neoblock' | 'moltRole' | 'tool';

export type UMGGateTriggerType =
  | 'user_intent'
  | 'runtime_condition'
  | 'tool_result'
  | 'approval'
  | 'capability_gap'
  | 'risk_detected'
  | 'completion'
  | 'error';

export type UMGGateAction =
  | 'activate'
  | 'deactivate'
  | 'route'
  | 'block'
  | 'escalate'
  | 'require_approval'
  | 'close_gate';

export type UMGGateRecord = {
  id: string;
  sourceId?: string;
  title: string;
  attachesTo: {
    kind: UMGGateAttachTargetKind;
    id: string;
  };
  triggerType: UMGGateTriggerType;
  conditionText: string;
  action: UMGGateAction;
  targetIds: string[];
  defaultState: 'open' | 'closed';
  runtimeState: 'inactive' | 'active' | 'blocked' | 'complete';
  tags: string[];
  metadata?: Record<string, unknown>;
};

export type UMGExecutionStep = {
  id: string;
  label: string;
  scopeKind: UMGRuntimeScopeKind;
  targetId: string;
  requiredGateIds: string[];
  requiredToolIds: string[];
  expectedState?: UMGRuntimeState;
  orderIndex: number;
};

export type UMGToolRegistryEntry = {
  toolId: string;
  toolName: string;
  provider?: string;
  description?: string;
  allowedActions: string[];
  blockedActions: string[];
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  availableInHermes: boolean;
  status: 'available' | 'missing' | 'needsAuth' | 'disabled';
  inputSchema?: unknown;
  outputSchema?: unknown;
  lastChecked?: string;
};

export type UMGToolPolicy = {
  allowedTools: string[];
  blockedTools: string[];
  approvalMode: 'none' | 'beforeToolUse' | 'beforeHighRisk' | 'manual';
  executionMode: 'dryRun' | 'approvalRequired' | 'liveAllowed';
  registry: UMGToolRegistryEntry[];
};

export type UMGSourceBlockRef = {
  id: string;
  title?: string;
  scopeKind: UMGRuntimeScopeKind;
  role?: string;
  sourcePath?: string;
  metadata?: Record<string, unknown>;
};

export type UMGCompiledRuntimeManifest = {
  sleeveId: string;
  sleeveTitle: string;
  compiledAt?: string;
  compiledPrompt?: string;
  compiledStructure: unknown;
  runtimeInstructions: string[];
  executionPlan: UMGExecutionStep[];
  gates: UMGGateRecord[];
  toolPolicy: UMGToolPolicy;
  sourceBlocks: UMGSourceBlockRef[];
  traceMetadata: Record<string, unknown>;
};

export type HermesCognitiveRuntimeRequest = {
  compiledSleeveManifest: UMGCompiledRuntimeManifest;
  compiledRuntimeManifest?: UMGCompiledRuntimeManifest;
  userGoal: string;
  executionMode: 'dryRun' | 'approvalRequired' | 'liveAllowed';
  approvalMode: 'none' | 'beforeToolUse' | 'beforeHighRisk' | 'manual';
  contextFiles?: unknown[];
  userProvidedContext?: string;
  sleeve?: { id: string; name: string };
  structure?: unknown;
  allowedTools?: string[];
  blockedTools?: string[];
  requiredTools?: string[];
  approvalPoints?: unknown[];
  runtimeInstructions?: string[];
  sourceBlocks?: UMGSourceBlockRef[];
  expectedTraceContract?: unknown;
  umgRuntimeSkillPack?: unknown;
  umgRuntimeSkillInstructions?: string;
  toolCapabilityRegistry?: unknown[];
  geometryTraceMappingIds?: unknown;
  currentExecutionRoute?: unknown;
  approvalRuntimeMode?: string;
  traceId: string;
  metadata?: Record<string, unknown>;
};

export type UMGToolCallTrace = {
  id: string;
  traceId: string;
  toolId: string;
  toolName?: string;
  status: 'requested' | 'executed' | 'blocked' | 'error';
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  raw?: unknown;
};

export type UMGApprovalRequest = {
  id: string;
  traceId: string;
  approvalId: string;
  label: string;
  reason?: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  raw?: unknown;
};

export type UMGRuntimeError = {
  code: string;
  message: string;
  targetId?: string;
  traceId?: string;
  raw?: unknown;
};

export type UMGRuntimeArtifact = {
  id: string;
  traceId: string;
  label: string;
  kind: string;
  uri?: string;
  content?: unknown;
  metadata?: Record<string, unknown>;
};

export type UMGNativeActionMode = 'direct' | 'approval' | 'observe' | 'blocked';

export type UMGNativeActionRisk = 'low' | 'medium' | 'high' | 'irreversible';

export type UMGNativeHermesActionRequest = {
  actionId: string;
  capabilityId: string;
  mode: UMGNativeActionMode;
  risk: UMGNativeActionRisk;
  prompt: string;
  workingDirectory?: string;
  expectedOutputs?: string[];
  neoStackId?: string;
  neoBlockId?: string;
  moltId?: string;
  gateId?: string;
  sleeveId: string;
  traceId?: string;
  userApproved?: boolean;
};

export type UMGNativeHermesActionResult = {
  actionId: string;
  capabilityId: string;
  mode: UMGNativeActionMode;
  status: 'executed' | 'approval_required' | 'observed' | 'blocked' | 'failed';
  externalActionTaken: boolean;
  createdFiles?: string[];
  modifiedFiles?: string[];
  commandOutput?: string;
  stdout?: string;
  stderr?: string;
  summary: string;
  artifacts: unknown[];
  traceEvents: unknown[];
  error?: string;
};

export type HermesCognitiveRuntimeResult = {
  status: 'ok' | 'blocked' | 'needsApproval' | 'error';
  finalOutput: string;
  trace: UMGTraceEvent[];
  toolCalls: UMGToolCallTrace[];
  blockedCalls: UMGToolCallTrace[];
  approvalRequests: UMGApprovalRequest[];
  errors: UMGRuntimeError[];
  artifacts: UMGRuntimeArtifact[];
  nativeActionResult?: UMGNativeHermesActionResult;
  unmappedEvents?: UMGTraceEvent[];
  nextSuggestedActions: string[];
  raw?: unknown;
};

export type UMGRuntimeVisualState = {
  traceId: string;
  activeIds: string[];
  queuedIds: string[];
  processingIds: string[];
  attentionIds: string[];
  completeIds: string[];
  skippedIds: string[];
  blockedIds: string[];
  errorIds: string[];
  currentPath: string[];
  latestEvent?: UMGTraceEvent;
  timeline: UMGTraceEvent[];
  updatedAt: number;
};
