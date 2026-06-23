import { exportHermesPacket } from './exporters';
import { CompileResult, HermesConfig, IRMatrixRow, NeoBlock, NeoStack, Sleeve, UMGWorkspace } from './types';

export type HermesGenerateConfig = Pick<HermesConfig, 'endpoint' | 'apiKey' | 'model' | 'temperature' | 'maxTokens'>;
export type HermesGenerateEndpointMode = 'bridge' | 'legacy';

export type HermesGenerateRequest = {
  userRequest: string;
  workspace?: UMGWorkspace;
  compiled: CompileResult;
  config: HermesGenerateConfig;
  endpointMode?: HermesGenerateEndpointMode;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type HermesGenerateResult = {
  ok: boolean;
  output: string;
  status: string;
  packet?: unknown;
};

export const HERMES_GENERATE_MISSING_ENDPOINT = 'Hermes generation endpoint is not configured. Set VITE_HERMES_GENERATE_URL or legacy VITE_HERMES_ENDPOINT.';

export function inferHermesGenerateEndpointMode(endpoint: string): HermesGenerateEndpointMode {
  return endpoint.includes('/api/hermes/generate') ? 'bridge' : 'legacy';
}

export function resolveHermesGenerateConfig(env: Record<string, string | undefined>) {
  const bridgeEndpoint = env.VITE_HERMES_GENERATE_URL ?? '';
  const legacyEndpoint = env.VITE_HERMES_ENDPOINT ?? '';
  const endpoint = bridgeEndpoint || legacyEndpoint || '';
  return {
    endpointMode: bridgeEndpoint ? 'bridge' as const : legacyEndpoint ? 'legacy' as const : 'bridge' as const,
    config: {
      endpoint,
      apiKey: env.VITE_HERMES_API_KEY || undefined,
      model: env.VITE_HERMES_MODEL ?? 'hermes-default',
      temperature: 0.3,
      maxTokens: 1200
    } satisfies HermesGenerateConfig
  };
}

function activeMoltRows(compiled: CompileResult) {
  return compiled.irMatrix.filter((row) => row.nodeType === 'molt_block' && Boolean(row.active) && !Boolean(row.off));
}

function summarizeRuntimeSpec(runtimeSpec: unknown) {
  if (!runtimeSpec || typeof runtimeSpec !== 'object') return { source: 'unknown' };
  const spec = runtimeSpec as Record<string, unknown>;
  return {
    source: spec.source,
    compiler: spec.compiler,
    hasErrors: spec.hasErrors,
    sleeveId: spec.sleeveId,
    gate_context: spec.gate_context ? { projectionOnly: true, value: spec.gate_context } : undefined
  };
}

function summarizeSleeve(sleeve?: Sleeve) {
  if (!sleeve) return undefined;
  return {
    id: sleeve.id,
    title: sleeve.title,
    stacks: sleeve.stacks.map((stack: NeoStack) => ({
      id: stack.id,
      title: stack.title,
      role: stack.role,
      neoblocks: stack.neoblocks.map((block: NeoBlock) => ({
        id: block.id,
        title: block.title,
        blockTitles: block.blocks.map((molt) => ({ id: molt.id, title: molt.title, role: molt.role }))
      }))
    }))
  };
}

function selectedBlockTitles(rows: IRMatrixRow[]) {
  return rows.slice(0, 48).map((row) => ({
    id: row.nodeId,
    title: row.title,
    role: row.role,
    active: row.active,
    off: row.off
  }));
}

export function buildHermesGeneratePacket(userRequest: string, compiled: CompileResult, workspace?: UMGWorkspace) {
  const activeBlocks = activeMoltRows(compiled);
  return {
    mode: 'umg_studio_generate_test',
    userRequest,
    compiledPromptPreview: compiled.promptPreview,
    runtimeSpecSummary: summarizeRuntimeSpec(compiled.runtimeSpec),
    selectedMoltBlocks: selectedBlockTitles(activeBlocks),
    workspaceStructure: {
      id: workspace?.id,
      title: workspace?.title,
      activeSleeveId: workspace?.activeSleeveId,
      sleeve: summarizeSleeve(workspace?.sleeves[0])
    },
    gateContext: (compiled.runtimeSpec as { gate_context?: unknown } | undefined)?.gate_context ? {
      projectionOnly: true,
      value: (compiled.runtimeSpec as { gate_context?: unknown }).gate_context
    } : undefined,
    safety: {
      routeSwitching: false,
      liveExecution: false,
      toolExecution: false,
      promptContentMutation: false
    }
  };
}

export function extractHermesGeneratedText(payload: unknown) {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return String(payload ?? '');
  const record = payload as Record<string, unknown>;
  for (const key of ['text', 'output', 'message', 'result']) {
    if (typeof record[key] === 'string') return record[key] as string;
  }
  return JSON.stringify(record, null, 2);
}

export async function generateWithHermesEndpoint(input: HermesGenerateRequest): Promise<HermesGenerateResult> {
  if (!input.config.endpoint) {
    return { ok: false, output: HERMES_GENERATE_MISSING_ENDPOINT, status: 'Hermes generation endpoint missing' };
  }

  const endpointMode = input.endpointMode ?? inferHermesGenerateEndpointMode(input.config.endpoint);
  const packet = endpointMode === 'legacy'
    ? exportHermesPacket(input.userRequest, input.compiled, input.config as HermesConfig)
    : buildHermesGeneratePacket(input.userRequest, input.compiled, input.workspace);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 15000);
  const fetcher = input.fetchImpl ?? fetch;

  try {
    const response = await fetcher(input.config.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.config.apiKey ? { authorization: `Bearer ${input.config.apiKey}` } : {})
      },
      body: JSON.stringify(endpointMode === 'legacy' ? packet : {
        ...packet,
        generation: {
          model: input.config.model,
          temperature: input.config.temperature,
          maxTokens: input.config.maxTokens
        }
      }),
      signal: controller.signal
    });
    const rawText = await response.text();
    if (endpointMode === 'legacy') {
      return { ok: response.ok, output: response.ok ? rawText : `Hermes generation failed: HTTP ${response.status}\n${rawText}`, status: response.ok ? 'Hermes generation complete' : 'Hermes generation failed', packet };
    }
    let parsed: unknown = rawText;
    try {
      parsed = rawText ? JSON.parse(rawText) : '';
    } catch {
      parsed = rawText;
    }
    const output = extractHermesGeneratedText(parsed);
    return { ok: response.ok, output: response.ok ? output : `Hermes generation failed: HTTP ${response.status}\n${output}`, status: response.ok ? 'Hermes generation complete' : 'Hermes generation failed', packet };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, output: `Hermes generation failed: ${message}`, status: 'Hermes generation failed', packet };
  } finally {
    clearTimeout(timeout);
  }
}
