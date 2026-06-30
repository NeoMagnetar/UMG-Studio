import type { BusinessInput } from './businessIntakeTypes';
import type {
  HermesCognitiveRuntimeRequest,
  HermesCognitiveRuntimeResult,
  UMGCompiledRuntimeManifest,
  UMGNativeActionMode,
  UMGNativeHermesActionRequest,
  UMGNativeHermesActionResult,
  UMGRuntimeArtifact,
  UMGRuntimeError,
  UMGRuntimeVisualState
} from './cognitiveRuntimeTypes';
import { applyRuntimeTraceEvents, createEmptyRuntimeVisualState } from './cognitiveRuntimeState';
import { HermesRuntimeAdapterConfig, runHermesCognitiveRuntime } from './hermesCognitiveRuntimeAdapter';
import { buildHermesToolCapabilityRegistry } from './hermesToolCapabilityRegistry';
import { buildHermesUmgRuntimeSkillPacket, collectGeometryTraceMappingIds, getHermesUmgRuntimeSkillPack } from './hermesUmgRuntimeSkill';

export type HermesRuntimeConnectionSummary = {
  configured: boolean;
  endpoint?: string;
  source: 'env' | 'not_configured';
  message: string;
};

export type NativeHermesActionExecutionResult = {
  request: UMGNativeHermesActionRequest;
  result: UMGNativeHermesActionResult;
  runtimeResult: HermesCognitiveRuntimeResult;
  visualState: UMGRuntimeVisualState;
  warnings: string[];
};

export type HermesRuntimeRequestValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type HermesRuntimeExecutionResult = {
  request: HermesCognitiveRuntimeRequest;
  result: HermesCognitiveRuntimeResult;
  visualState: UMGRuntimeVisualState;
  warnings: string[];
};

export function getHermesRuntimeAdapterConfigFromEnv(env: Record<string, string | boolean | undefined> = import.meta.env): HermesRuntimeAdapterConfig {
  const endpoint = String(env.VITE_HERMES_RUNTIME_ENDPOINT || env.VITE_HERMES_RUNTIME_URL || '').trim();
  const enabledRaw = env.VITE_HERMES_RUNTIME_ENABLED;
  const explicitlyDisabled = enabledRaw === false || String(enabledRaw ?? '').toLowerCase() === 'false';
  const enabled = endpoint.length > 0 && !explicitlyDisabled;
  return { enabled, endpoint: endpoint || undefined, timeoutMs: 60000 };
}

export function getHermesRuntimeConnectionSummary(config: HermesRuntimeAdapterConfig): HermesRuntimeConnectionSummary {
  if (!config.enabled || !config.endpoint) {
    return { configured: false, source: 'not_configured', message: 'Hermes runtime endpoint is not configured.' };
  }
  return { configured: true, endpoint: config.endpoint, source: 'env', message: 'Hermes runtime endpoint configured from env.' };
}

function makeTraceId(manifest: UMGCompiledRuntimeManifest) {
  return `hermes_trace_${manifest.sleeveId}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function countSourceBlocks(manifest: UMGCompiledRuntimeManifest, scopeKind: string) {
  return manifest.sourceBlocks.filter((block) => block.scopeKind === scopeKind).length;
}

export function createHermesRuntimeRequestFromManifest(args: {
  compiledRuntimeManifest: UMGCompiledRuntimeManifest;
  userGoal: string;
  businessInput?: BusinessInput;
  executionMode?: HermesCognitiveRuntimeRequest['executionMode'];
  approvalMode?: HermesCognitiveRuntimeRequest['approvalMode'];
  traceId?: string;
}): HermesCognitiveRuntimeRequest {
  const { compiledRuntimeManifest, businessInput } = args;
  const executionMode = args.executionMode
    ?? compiledRuntimeManifest.toolPolicy.executionMode
    ?? 'dryRun';
  const approvalMode = args.approvalMode
    ?? compiledRuntimeManifest.toolPolicy.approvalMode
    ?? 'beforeToolUse';
  const traceId = args.traceId ?? makeTraceId(compiledRuntimeManifest);
  const toolCapabilityRegistry = buildHermesToolCapabilityRegistry({ manifest: compiledRuntimeManifest });
  const umgRuntimeSkillPack = getHermesUmgRuntimeSkillPack();
  const geometryTraceMappingIds = collectGeometryTraceMappingIds(compiledRuntimeManifest);
  const routePlanIds = compiledRuntimeManifest.executionPlan.length
    ? compiledRuntimeManifest.executionPlan.map((step) => step.id)
    : compiledRuntimeManifest.sourceBlocks.map((block) => block.id);
  const routeTargetIds = compiledRuntimeManifest.executionPlan.length
    ? compiledRuntimeManifest.executionPlan.map((step) => step.targetId)
    : compiledRuntimeManifest.sourceBlocks.map((block) => block.id);
  const currentExecutionRoute = {
    executionPlanIds: routePlanIds,
    targetIds: routeTargetIds,
    nextTargetId: routeTargetIds[0],
    dynamicRoutingPrepared: compiledRuntimeManifest.traceMetadata.dynamicRoutingPrepared === true
  };

  return {
    compiledSleeveManifest: compiledRuntimeManifest,
    compiledRuntimeManifest,
    userGoal: args.userGoal || businessInput?.text || `Run ${compiledRuntimeManifest.sleeveTitle}`,
    executionMode,
    approvalMode,
    contextFiles: businessInput?.documents ?? [],
    userProvidedContext: businessInput?.documents.map((doc) => doc.text).filter(Boolean).join('\n\n') || undefined,
    traceId,
    sleeve: { id: compiledRuntimeManifest.sleeveId, name: compiledRuntimeManifest.sleeveTitle },
    structure: compiledRuntimeManifest.compiledStructure,
    routeEdges: compiledRuntimeManifest.routeEdges,
    structuralIR: compiledRuntimeManifest.structuralIR,
    allowedTools: compiledRuntimeManifest.toolPolicy.allowedTools,
    blockedTools: compiledRuntimeManifest.toolPolicy.blockedTools,
    requiredTools: compiledRuntimeManifest.executionPlan.flatMap((step) => step.requiredToolIds),
    approvalPoints: compiledRuntimeManifest.executionPlan
      .filter((step) => step.requiredGateIds.length || step.requiredToolIds.length)
      .map((step) => ({ stepId: step.id, label: step.label, requiredGateIds: step.requiredGateIds, requiredToolIds: step.requiredToolIds })),
    runtimeInstructions: compiledRuntimeManifest.runtimeInstructions,
    sourceBlocks: compiledRuntimeManifest.sourceBlocks,
    umgRuntimeSkillPack,
    umgRuntimeSkillInstructions: umgRuntimeSkillPack.instructions,
    toolCapabilityRegistry,
    geometryTraceMappingIds,
    currentExecutionRoute,
    approvalRuntimeMode: approvalMode,
    expectedTraceContract: {
      traceId,
      status: 'ok | blocked | needsApproval | error',
      minimumMappedEvents: ['route_started', 'route_edge_activated', 'neostack_entered', 'neoblock_started', 'molt_layer_used', 'merge_started', 'gate_opened', 'tool_block_resolved', 'action_request_created', 'action_executed', 'file_created', 'artifact_created', 'run_completed'],
      eventFields: ['id', 'type', 'timestamp', 'targetId', 'targetType', 'routeEdgeId', 'status', 'message', 'metadata', 'eventId', 'eventType', 'scopeKind', 'sleeveId', 'neoStackId', 'neoBlockId', 'moltBlockId', 'gateId', 'toolId', 'sourceId', 'metadataAliases'],
      mappingRule: 'Emit runtime trace events using structuralIR IDs. Use targetId and targetType. Do not invent IDs; unmapped events stay in the timeline only and must not activate visual nodes.'
    },
    metadata: {
      source: 'umg_studio_phase13e_hermes_umg_runtime_skill_request',
      previousRequestSource: 'umg_studio_phase10_real_hermes_runtime_contract',
      umgRuntimeSkillPacket: buildHermesUmgRuntimeSkillPacket({ manifest: compiledRuntimeManifest, toolCapabilityRegistry }),
      businessName: businessInput?.businessName,
      requestedAgentType: businessInput?.requestedAgentType,
      createdFromCompiledManifest: true,
      traceContractVersion: 'phase10.v1',
      hierarchyProofCounts: {
        sourceBlocks: compiledRuntimeManifest.sourceBlocks.length,
        selectedStacks: countSourceBlocks(compiledRuntimeManifest, 'neostack'),
        selectedNeoBlocks: countSourceBlocks(compiledRuntimeManifest, 'neoblock'),
        selectedMolt: countSourceBlocks(compiledRuntimeManifest, 'molt'),
        gates: compiledRuntimeManifest.gates.length,
        requiredTools: compiledRuntimeManifest.executionPlan.flatMap((step) => step.requiredToolIds).length,
        approvalPoints: compiledRuntimeManifest.executionPlan.filter((step) => step.requiredGateIds.length || step.requiredToolIds.length).length
      },
      noFakeRuntime: true,
      compilerTraceIsNotHermesRuntimeTrace: true
    }
  };
}

export function validateHermesRuntimeRequest(request: HermesCognitiveRuntimeRequest): HermesRuntimeRequestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const manifest = request.compiledSleeveManifest;

  if (!manifest) errors.push('compiledSleeveManifest is required.');
  if (!request.userGoal?.trim()) errors.push('userGoal is required.');
  if (!request.traceId?.trim()) errors.push('traceId is required.');
  if (!request.executionMode) errors.push('executionMode is required.');
  if (!manifest?.sleeveId) errors.push('compiled manifest sleeveId is required.');
  if (!manifest?.sleeveTitle) errors.push('compiled manifest sleeveTitle is required.');
  if (!manifest?.runtimeInstructions?.length) warnings.push('compiled manifest has no runtimeInstructions.');
  if (!manifest?.executionPlan?.length) warnings.push('compiled manifest has no executionPlan.');
  if (!manifest?.sourceBlocks?.length) warnings.push('compiled manifest has no sourceBlocks.');

  return { valid: errors.length === 0, errors, warnings };
}

export async function runCompiledManifestThroughHermes(args: {
  request: HermesCognitiveRuntimeRequest;
  config: HermesRuntimeAdapterConfig;
}): Promise<HermesRuntimeExecutionResult> {
  const result = await runHermesCognitiveRuntime(args.request, args.config);
  const visualState = applyRuntimeTraceEvents(createEmptyRuntimeVisualState(args.request.traceId), result.trace);
  const warnings = result.trace.length ? [] : ['Hermes returned no runtime trace events.'];
  return { request: args.request, result, visualState, warnings };
}

function nativeActionEndpointFromRuntime(endpoint: string) {
  if (endpoint.endsWith('/api/hermes/runtime')) return endpoint.replace(/\/api\/hermes\/runtime$/, '/api/hermes/native-action');
  if (endpoint.includes('/api/hermes/runtime')) return endpoint.replace('/api/hermes/runtime', '/api/hermes/native-action');
  return endpoint.replace(/\/$/, '') + '/native-action';
}

function inferNativeCapability(prompt: string): { capabilityId: string; risk: UMGNativeHermesActionRequest['risk'] } {
  const text = prompt.toLowerCase();
  if (text.includes('read') && text.includes('file')) return { capabilityId: 'umg.native.hermes.file_read', risk: 'low' };
  if (text.includes('shell') || text.includes('terminal') || text.includes('command')) return { capabilityId: 'umg.native.hermes.shell_command', risk: 'high' };
  if (text.includes('project') && (text.includes('edit') || text.includes('source'))) return { capabilityId: 'umg.native.hermes.project_edit', risk: 'high' };
  if (text.includes('note')) return { capabilityId: 'umg.native.hermes.note_create', risk: 'low' };
  if (text.includes('file') || text.includes('write')) return { capabilityId: 'umg.native.hermes.file_write', risk: 'medium' };
  return { capabilityId: 'umg.native.hermes.runtime_task', risk: 'medium' };
}

function getConfiguredDesktopWslPath() {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_UMG_WINDOWS_DESKTOP_WSL_PATH?.replace(/\/$/, '') || '/mnt/c/Users/Magne/OneDrive/Desktop';
}

function guessDesktopNoteOutput(prompt: string) {
  const text = prompt.toLowerCase();
  if (!text.includes('desktop')) return undefined;
  const nameMatch = prompt.match(/(?:as|named|called)\s+[“\"]?([a-zA-Z0-9._-]+)[”\"]?/i);
  const base = (nameMatch?.[1] || 'umg-hermes-native-test').replace(/\.txt$/i, '');
  return `${getConfiguredDesktopWslPath()}/${base}.txt`;
}

export function createNativeHermesActionRequestFromManifest(args: {
  compiledRuntimeManifest: UMGCompiledRuntimeManifest;
  prompt: string;
  mode: Exclude<UMGNativeActionMode, 'blocked'>;
  traceId?: string;
  userApproved?: boolean;
}): UMGNativeHermesActionRequest {
  const inferred = inferNativeCapability(args.prompt);
  const firstStack = args.compiledRuntimeManifest.sourceBlocks.find((block) => block.scopeKind === 'neostack');
  const firstBlock = args.compiledRuntimeManifest.sourceBlocks.find((block) => block.scopeKind === 'neoblock');
  const firstMolt = args.compiledRuntimeManifest.sourceBlocks.find((block) => block.scopeKind === 'molt');
  const output = guessDesktopNoteOutput(args.prompt);
  return {
    actionId: `native_action_${Date.now()}`,
    capabilityId: inferred.capabilityId,
    mode: args.mode,
    risk: inferred.risk,
    prompt: args.prompt,
    expectedOutputs: output ? [output] : undefined,
    neoStackId: firstStack?.id,
    neoBlockId: firstBlock?.id,
    moltId: firstMolt?.id,
    gateId: args.compiledRuntimeManifest.gates[0]?.id,
    sleeveId: args.compiledRuntimeManifest.sleeveId,
    traceId: args.traceId ?? makeTraceId(args.compiledRuntimeManifest),
    userApproved: args.userApproved ?? args.mode === 'direct'
  };
}

function normalizeNativeResultToRuntimeResult(actionResult: UMGNativeHermesActionResult): HermesCognitiveRuntimeResult {
  const status: HermesCognitiveRuntimeResult['status'] = actionResult.status === 'approval_required'
    ? 'needsApproval'
    : actionResult.status === 'blocked'
      ? 'blocked'
      : actionResult.status === 'failed'
        ? 'error'
        : 'ok';
  const errors: UMGRuntimeError[] = actionResult.error ? [{ code: 'NATIVE_HERMES_ACTION_FAILED', message: actionResult.error, raw: actionResult }] : [];
  const artifacts: UMGRuntimeArtifact[] = actionResult.artifacts.map((artifact, index) => ({
    id: `${actionResult.actionId}_artifact_${index}`,
    traceId: actionResult.actionId,
    kind: 'file',
    label: typeof artifact === 'object' && artifact && 'path' in artifact ? String((artifact as { path?: unknown }).path) : `Native Hermes artifact ${index + 1}`,
    uri: typeof artifact === 'object' && artifact && 'path' in artifact ? String((artifact as { path?: unknown }).path) : undefined,
    content: artifact,
    metadata: typeof artifact === 'object' && artifact ? artifact as Record<string, unknown> : { value: artifact }
  }));
  return {
    status,
    finalOutput: actionResult.summary,
    trace: actionResult.traceEvents as HermesCognitiveRuntimeResult['trace'],
    toolCalls: [],
    blockedCalls: actionResult.status === 'blocked' ? [] : [],
    approvalRequests: actionResult.status === 'approval_required' ? [{ id: actionResult.actionId, traceId: actionResult.actionId, approvalId: actionResult.actionId, label: actionResult.capabilityId, reason: actionResult.summary, requestedAt: Date.now(), status: 'pending', raw: actionResult }] : [],
    errors,
    artifacts,
    nativeActionResult: actionResult,
    nextSuggestedActions: actionResult.status === 'approval_required' ? ['Approve the native Hermes action to execute it.'] : []
  };
}

export async function runNativeHermesAction(args: {
  request: UMGNativeHermesActionRequest;
  config: HermesRuntimeAdapterConfig;
}): Promise<NativeHermesActionExecutionResult> {
  if (!args.config.enabled || !args.config.endpoint) throw new Error('Hermes runtime endpoint is not configured.');
  const response = await fetch(nativeActionEndpointFromRuntime(args.config.endpoint), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args.request)
  });
  const raw = await response.text();
  let parsed: UMGNativeHermesActionResult;
  try {
    parsed = JSON.parse(raw) as UMGNativeHermesActionResult;
  } catch {
    throw new Error(`Native Hermes action bridge returned non-JSON response: ${raw.slice(0, 300)}`);
  }
  if (!response.ok && parsed.status !== 'failed') throw new Error(parsed.error || parsed.summary || `Native Hermes action bridge failed with HTTP ${response.status}`);
  const runtimeResult = normalizeNativeResultToRuntimeResult(parsed);
  const visualState = applyRuntimeTraceEvents(createEmptyRuntimeVisualState(args.request.traceId ?? args.request.actionId), runtimeResult.trace);
  return { request: args.request, result: parsed, runtimeResult, visualState, warnings: parsed.traceEvents.length ? [] : ['Native Hermes bridge returned no trace events.'] };
}
