import type { BusinessInput } from './businessIntakeTypes';
import type {
  HermesCognitiveRuntimeRequest,
  HermesCognitiveRuntimeResult,
  UMGCompiledRuntimeManifest,
  UMGRuntimeVisualState
} from './cognitiveRuntimeTypes';
import { applyRuntimeTraceEvents, createEmptyRuntimeVisualState } from './cognitiveRuntimeState';
import { HermesRuntimeAdapterConfig, runHermesCognitiveRuntime } from './hermesCognitiveRuntimeAdapter';

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
    expectedTraceContract: {
      traceId,
      status: 'ok | blocked | needsApproval | error',
      events: ['run_started', 'sleeve_loaded', 'gate_evaluated', 'neostack_started', 'neoblock_started', 'molt_role_used', 'run_completed', 'run_error'],
      mappingRule: 'Events must carry local IDs, source IDs, gate IDs, metadata aliases, or compiler/runtime manifest IDs. Unmapped events stay in the timeline only.'
    },
    metadata: {
      source: 'umg_studio_phase10_real_hermes_runtime_contract',
      businessName: businessInput?.businessName,
      requestedAgentType: businessInput?.requestedAgentType,
      createdFromCompiledManifest: true,
      traceContractVersion: 'phase10.v1',
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
