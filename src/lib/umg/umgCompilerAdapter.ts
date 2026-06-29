import type { HermesCognitiveRuntimeRequest, UMGCompiledRuntimeManifest, UMGExecutionStep, UMGGateRecord, UMGSourceBlockRef, UMGToolPolicy } from './cognitiveRuntimeTypes';
import type { UMGCompilerAdapterConfig, CompilerConnectionSummary, UMGCompilerRequest, UMGCompilerResult, UMGCompilerWarning } from './compilerIntegrationTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function getCompilerAdapterConfigFromEnv(env: Record<string, string | boolean | undefined> = import.meta.env): UMGCompilerAdapterConfig {
  const endpoint = String(env.VITE_UMG_COMPILER_ENDPOINT || env.VITE_UMG_COMPILER_URL || '').trim();
  const enabledRaw = env.VITE_UMG_COMPILER_ENABLED;
  const enabled = endpoint.length > 0 && enabledRaw !== 'false';
  return { enabled, endpoint: endpoint || undefined, timeoutMs: 30000 };
}

export function getCompilerConnectionSummary(config: UMGCompilerAdapterConfig): CompilerConnectionSummary {
  if (!config.enabled || !config.endpoint) {
    return { configured: false, source: 'not_configured', message: 'UMG compiler endpoint is not configured.' };
  }
  const isLocalBridge = /127\.0\.0\.1|localhost/.test(config.endpoint);
  return { configured: true, endpoint: config.endpoint, source: isLocalBridge ? 'local_bridge' : 'env', message: isLocalBridge ? 'Local UMG compiler bridge configured.' : 'UMG compiler endpoint configured from env.' };
}

export async function compileWithRealCompiler(request: UMGCompilerRequest, config: UMGCompilerAdapterConfig): Promise<UMGCompilerResult> {
  if (!config.enabled || !config.endpoint) {
    return {
      status: 'not_configured',
      errors: [{ code: 'UMG_COMPILER_ENDPOINT_NOT_CONFIGURED', message: 'UMG compiler endpoint is not configured.' }],
      warnings: []
    };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), config.timeoutMs ?? 30000);
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.headers ?? {}) },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    const raw = await response.json().catch(() => undefined);
    if (!response.ok) {
      return { status: 'error', errors: [{ code: 'UMG_COMPILER_REQUEST_FAILED', message: `Compiler endpoint returned HTTP ${response.status}.`, raw }], warnings: [], raw };
    }
    return normalizeCompilerResponseToManifest(raw, request);
  } catch (error) {
    return { status: 'error', errors: [{ code: 'UMG_COMPILER_REQUEST_FAILED', message: error instanceof Error ? error.message : String(error), raw: error }], warnings: [] };
  } finally {
    window.clearTimeout(timeout);
  }
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function makeToolPolicy(request: UMGCompilerRequest, rawPolicy: unknown): UMGToolPolicy {
  if (isRecord(rawPolicy) && Array.isArray(rawPolicy.allowedTools) && Array.isArray(rawPolicy.blockedTools)) return rawPolicy as UMGToolPolicy;
  return {
    allowedTools: [...request.input.requiredTools],
    blockedTools: [],
    approvalMode: request.input.approvalPoints.length ? 'beforeToolUse' : 'manual',
    executionMode: 'approvalRequired',
    registry: request.input.requiredTools.map((toolId) => ({
      toolId,
      toolName: toolId,
      allowedActions: [],
      blockedActions: [],
      requiresApproval: request.input.approvalPoints.length > 0,
      riskLevel: 'medium',
      availableInHermes: false,
      status: 'missing'
    }))
  };
}

function makeExecutionPlan(request: UMGCompilerRequest, rawPlan: unknown): UMGExecutionStep[] {
  if (Array.isArray(rawPlan)) return rawPlan as UMGExecutionStep[];
  return request.input.executionOrder.map((targetId, orderIndex) => ({
    id: `compiler_step_${orderIndex + 1}_${targetId}`,
    label: targetId,
    scopeKind: targetId.includes('stack') ? 'neostack' : targetId.includes('block') ? 'neoblock' : 'molt',
    targetId,
    requiredGateIds: [],
    requiredToolIds: [],
    expectedState: 'queued',
    orderIndex
  }));
}

function getNormalizedStructureRecord(request: UMGCompilerRequest): Record<string, unknown> {
  return isRecord(request.input.normalizedStructure) ? request.input.normalizedStructure : {};
}

function collectSourceBlockMetadata(request: UMGCompilerRequest): Map<string, UMGSourceBlockRef> {
  const normalized = getNormalizedStructureRecord(request);
  const refs = new Map<string, UMGSourceBlockRef>();
  const addRef = (ref: UMGSourceBlockRef) => refs.set(ref.id, ref);

  if (typeof normalized.id === 'string') {
    addRef({ id: normalized.id, title: typeof normalized.title === 'string' ? normalized.title : undefined, scopeKind: 'sleeve', metadata: { source: 'normalizedStructure.id' } });
  }

  for (const stack of toArray(normalized.neoStacks)) {
    if (!isRecord(stack) || typeof stack.id !== 'string') continue;
    addRef({
      id: stack.id,
      title: typeof stack.title === 'string' ? stack.title : undefined,
      scopeKind: 'neostack',
      metadata: { source: 'normalizedStructure.neoStacks', tags: Array.isArray(stack.tags) ? stack.tags : undefined }
    });
  }

  for (const block of toArray(normalized.neoBlocks)) {
    if (!isRecord(block) || typeof block.id !== 'string') continue;
    addRef({
      id: block.id,
      title: typeof block.title === 'string' ? block.title : undefined,
      scopeKind: 'neoblock',
      metadata: {
        source: 'normalizedStructure.neoBlocks',
        parentNeoStackId: typeof block.neoStackId === 'string' ? block.neoStackId : undefined,
        tags: Array.isArray(block.tags) ? block.tags : undefined
      }
    });
  }

  for (const block of toArray(normalized.moltBlocks)) {
    if (!isRecord(block) || typeof block.id !== 'string') continue;
    addRef({
      id: block.id,
      title: typeof block.title === 'string' ? block.title : undefined,
      scopeKind: 'molt',
      role: typeof block.role === 'string' ? block.role : undefined,
      sourcePath: typeof block.sourceId === 'string' ? block.sourceId : undefined,
      metadata: {
        source: 'normalizedStructure.moltBlocks',
        sourceId: typeof block.sourceId === 'string' ? block.sourceId : undefined,
        parentNeoBlockId: typeof block.parentNeoBlockId === 'string' ? block.parentNeoBlockId : undefined,
        parentNeoStackId: typeof block.parentNeoStackId === 'string' ? block.parentNeoStackId : undefined,
        tags: Array.isArray(block.tags) ? block.tags : undefined
      }
    });
  }

  for (const gate of toArray(normalized.gates)) {
    if (!isRecord(gate) || typeof gate.id !== 'string') continue;
    const attachesTo = isRecord(gate.attachesTo) ? gate.attachesTo : undefined;
    addRef({
      id: gate.id,
      title: typeof gate.title === 'string' ? gate.title : undefined,
      scopeKind: 'gate',
      sourcePath: typeof gate.sourceId === 'string' ? gate.sourceId : undefined,
      metadata: {
        source: 'normalizedStructure.gates',
        sourceId: typeof gate.sourceId === 'string' ? gate.sourceId : undefined,
        attachesToId: typeof attachesTo?.id === 'string' ? attachesTo.id : undefined,
        promptContent: false
      }
    });
  }

  return refs;
}

function makeSourceBlocks(request: UMGCompilerRequest, rawSourceBlocks: unknown): UMGSourceBlockRef[] {
  if (Array.isArray(rawSourceBlocks) && rawSourceBlocks.every(isRecord)) return rawSourceBlocks as UMGSourceBlockRef[];
  const refs = collectSourceBlockMetadata(request);
  return request.input.sourceBlocks.map((id) => refs.get(id) ?? { id, scopeKind: 'molt', metadata: { source: 'compiler-request-sourceBlocks' } });
}

function collectCompilerOutput(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) return undefined;
  if (isRecord(raw.result)) return raw.result;
  if (isRecord(raw.compilerResult)) return raw.compilerResult;
  if (isRecord(raw.rawCompilerResult)) return raw.rawCompilerResult;
  return raw;
}

export function normalizeCompilerResponseToManifest(raw: unknown, request: UMGCompilerRequest): UMGCompilerResult {
  const output = collectCompilerOutput(raw);
  if (!output) {
    return { status: 'error', errors: [{ code: 'UMG_COMPILER_RESPONSE_INVALID', message: 'Compiler response was not an object.', raw }], warnings: [], raw };
  }
  const hasErrors = output.hasErrors === true || (isRecord(raw) && raw.ok === false);
  const runtime = output.runtime ?? output.runtimeSpec ?? output.compiledStructure;
  if (hasErrors || !runtime) {
    return {
      status: 'error',
      errors: [{ code: 'UMG_COMPILER_COMPILE_FAILED', message: 'Compiler did not return a successful runtime/compiled structure.', raw }],
      warnings: [],
      raw
    };
  }

  const runtimeRecord = isRecord(runtime) ? runtime : {};
  const warnings: UMGCompilerWarning[] = [];
  const wrapperWarnings = isRecord(raw) && Array.isArray(raw.warnings) ? raw.warnings as UMGCompilerWarning[] : [];
  warnings.push(...wrapperWarnings);
  if (!('promptSpec' in runtimeRecord)) warnings.push({ code: 'COMPILER_PROMPT_SPEC_MISSING', message: 'Compiler output did not include promptSpec.' });
  if (!('trace' in output)) warnings.push({ code: 'COMPILER_TRACE_WRAPPED_IN_METADATA', message: 'Compiler trace is preserved under traceMetadata.compilerTrace; no runtime execution trace is fabricated.' });

  const compiledAt = String((isRecord(runtimeRecord.meta) && runtimeRecord.meta.compiledAt) || output.compiledAt || new Date().toISOString());
  const promptSpec = runtimeRecord.promptSpec;
  const compiledPrompt = isRecord(promptSpec) && Array.isArray(promptSpec.neoBlockPrompts)
    ? promptSpec.neoBlockPrompts.map((entry) => isRecord(entry) ? entry.fullText : undefined).filter(Boolean).join('\n\n') || undefined
    : undefined;

  const manifest: UMGCompiledRuntimeManifest = {
    sleeveId: String(runtimeRecord.sleeveId ?? request.input.sleeveId),
    sleeveTitle: String(runtimeRecord.sleeveName ?? request.input.sleeveTitle),
    compiledAt,
    ...(compiledPrompt ? { compiledPrompt } : {}),
    compiledStructure: runtime,
    runtimeInstructions: Array.isArray(output.runtimeInstructions) ? output.runtimeInstructions as string[] : [...request.input.runtimeInstructions],
    executionPlan: makeExecutionPlan(request, output.executionPlan),
    gates: toArray(request.input.gates) as UMGGateRecord[],
    toolPolicy: makeToolPolicy(request, output.toolPolicy),
    sourceBlocks: makeSourceBlocks(request, output.sourceBlocks),
    traceMetadata: {
      ...request.input.traceMetadata,
      compilerTrace: output.trace,
      compilerDiagnostics: isRecord(raw) ? raw.diagnostics : undefined,
      compilerWarnings: warnings,
      compilerSource: 'actual-umg-compiler-v0'
    }
  };

  return { status: 'ok', manifest, errors: [], warnings, raw, compiledAt };
}

export function createHermesRequestPreview(args: { manifest: UMGCompiledRuntimeManifest; userGoal: string; traceId: string }): HermesCognitiveRuntimeRequest {
  return {
    compiledSleeveManifest: args.manifest,
    userGoal: args.userGoal,
    executionMode: 'approvalRequired',
    approvalMode: 'beforeToolUse',
    traceId: args.traceId,
    metadata: { status: 'prepared_not_sent', source: 'umg-studio-phase6-preview' }
  };
}
