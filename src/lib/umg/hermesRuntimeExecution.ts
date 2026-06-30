import type { BusinessInput } from './businessIntakeTypes';
import type {
  HermesCognitiveRuntimeRequest,
  HermesCognitiveRuntimeResult,
  UMGCompiledRuntimeManifest,
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
      minimumMappedEvents: ['run_started', 'neostack_started', 'neoblock_started', 'gate_evaluated', 'molt_role_used', 'neoblock_completed', 'run_completed'],
      eventFields: ['eventId', 'timestamp', 'eventType', 'message', 'scopeKind', 'sleeveId', 'neoStackId', 'neoBlockId', 'moltBlockId', 'gateId', 'sourceId', 'metadataAliases', 'status'],
      mappingRule: 'Events must carry local IDs, source IDs, gate IDs, metadata aliases, or compiler/runtime manifest IDs. Unmapped events stay in the timeline only and must not activate visual nodes.'
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
