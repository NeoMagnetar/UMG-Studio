import {
  HermesCognitiveRuntimeRequest,
  HermesCognitiveRuntimeResult,
  UMGApprovalRequest,
  UMGRuntimeArtifact,
  UMGRuntimeError,
  UMGToolCallTrace,
  UMGCompiledRuntimeManifest
} from './cognitiveRuntimeTypes';
import { normalizeHermesTracePayload } from './cognitiveRuntimeState';

export type HermesRuntimeAdapterConfig = {
  endpoint?: string;
  enabled: boolean;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

const endpointNotConfiguredError = (traceId: string): HermesCognitiveRuntimeResult => ({
  status: 'error',
  finalOutput: 'Hermes runtime endpoint is not configured.',
  trace: [],
  toolCalls: [],
  blockedCalls: [],
  approvalRequests: [],
  errors: [{
    code: 'HERMES_ENDPOINT_NOT_CONFIGURED',
    message: 'Hermes runtime endpoint is not configured.',
    traceId
  }],
  artifacts: [],
  nextSuggestedActions: ['Configure a Hermes cognitive runtime endpoint before requesting live execution.']
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function arrayField<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeRuntimeErrors(raw: unknown, traceId: string): UMGRuntimeError[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    if (!isRecord(entry)) {
      return { code: `HERMES_RUNTIME_ERROR_${index + 1}`, message: String(entry), traceId };
    }
    return {
      code: stringField(entry.code, `HERMES_RUNTIME_ERROR_${index + 1}`),
      message: stringField(entry.message, JSON.stringify(entry)),
      targetId: stringField(entry.targetId) || undefined,
      traceId: stringField(entry.traceId, traceId),
      raw: entry
    };
  });
}

function normalizeRuntimeResult(raw: unknown, request: HermesCognitiveRuntimeRequest): HermesCognitiveRuntimeResult {
  if (!isRecord(raw)) {
    return {
      status: 'error',
      finalOutput: typeof raw === 'string' ? raw : 'Hermes runtime returned a non-object response.',
      trace: [],
      toolCalls: [],
      blockedCalls: [],
      approvalRequests: [],
      errors: [{ code: 'HERMES_RUNTIME_INVALID_RESPONSE', message: 'Hermes runtime returned a non-object response.', traceId: request.traceId, raw }],
      artifacts: [],
      nextSuggestedActions: [],
      raw
    };
  }

  const status = ['ok', 'blocked', 'needsApproval', 'error'].includes(String(raw.status))
    ? raw.status as HermesCognitiveRuntimeResult['status']
    : 'ok';

  return {
    status,
    finalOutput: stringField(raw.finalOutput, stringField(raw.output, '')),
    trace: normalizeHermesTracePayload(raw, request.traceId),
    toolCalls: arrayField<UMGToolCallTrace>(raw.toolCalls),
    blockedCalls: arrayField<UMGToolCallTrace>(raw.blockedCalls),
    approvalRequests: arrayField<UMGApprovalRequest>(raw.approvalRequests),
    errors: normalizeRuntimeErrors(raw.errors, request.traceId),
    artifacts: arrayField<UMGRuntimeArtifact>(raw.artifacts),
    unmappedEvents: normalizeHermesTracePayload(arrayField(raw.unmappedEvents), request.traceId),
    nextSuggestedActions: arrayField<string>(raw.nextSuggestedActions),
    raw
  };
}

export async function runHermesCognitiveRuntime(
  request: HermesCognitiveRuntimeRequest,
  config: HermesRuntimeAdapterConfig
): Promise<HermesCognitiveRuntimeResult> {
  if (!config.enabled || !config.endpoint) {
    return endpointNotConfiguredError(request.traceId);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 30000);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    const rawText = await response.text();
    let parsed: unknown = rawText;
    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsed = rawText;
    }

    const normalized = normalizeRuntimeResult(parsed, request);
    if (!response.ok) {
      return {
        ...normalized,
        status: 'error',
        finalOutput: normalized.finalOutput || `Hermes runtime request failed: HTTP ${response.status}`,
        errors: [
          ...normalized.errors,
          { code: 'HERMES_RUNTIME_HTTP_ERROR', message: `Hermes runtime request failed: HTTP ${response.status}`, traceId: request.traceId, raw: parsed }
        ],
        raw: parsed
      };
    }
    return normalized;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'error',
      finalOutput: `Hermes runtime request failed: ${message}`,
      trace: [],
      toolCalls: [],
      blockedCalls: [],
      approvalRequests: [],
      errors: [{ code: 'HERMES_RUNTIME_REQUEST_FAILED', message, traceId: request.traceId, raw: error }],
      artifacts: [],
      nextSuggestedActions: [],
      raw: error
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function createHermesRuntimeRequest(input: {
  compiledSleeveManifest: UMGCompiledRuntimeManifest;
  userGoal: string;
  executionMode: HermesCognitiveRuntimeRequest['executionMode'];
  approvalMode: HermesCognitiveRuntimeRequest['approvalMode'];
  traceId: string;
  contextFiles?: unknown[];
  userProvidedContext?: string;
  metadata?: Record<string, unknown>;
}): HermesCognitiveRuntimeRequest {
  return {
    compiledSleeveManifest: input.compiledSleeveManifest,
    userGoal: input.userGoal,
    executionMode: input.executionMode,
    approvalMode: input.approvalMode,
    contextFiles: input.contextFiles,
    userProvidedContext: input.userProvidedContext,
    traceId: input.traceId,
    metadata: input.metadata
  };
}
