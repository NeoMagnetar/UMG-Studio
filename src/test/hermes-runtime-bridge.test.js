import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const getRuntimeBridgeModule = async () => import('../../dev/hermes-runtime-bridge.mjs');

const safeRuntimeRequest = {
  traceId: 'trace_phase10_test',
  executionMode: 'dryRun',
  approvalMode: 'beforeToolUse',
  userGoal: 'Art of War integrated Generic Business plan template creator',
  compiledSleeveManifest: {
    sleeveId: 'sleeve_business_automation_core',
    sleeveTitle: 'Business Automation Core Sleeve',
    compiledStructure: { kind: 'sleeve' },
    runtimeInstructions: ['Dry-run the sleeve only.'],
    executionPlan: [{ id: 'step_1', label: 'Load sleeve', scopeKind: 'sleeve', targetId: 'sleeve_business_automation_core', requiredGateIds: [], requiredToolIds: [], orderIndex: 0 }],
    gates: [{ id: 'TRG.BIZ.001', sourceId: 'TRG.BIZ.001', title: 'Business gate', attachesTo: { kind: 'neoblock', id: 'block_strategy' }, triggerType: 'user_intent', conditionText: 'if business request', action: 'activate', targetIds: ['block_strategy'], defaultState: 'closed', runtimeState: 'inactive', tags: ['TRG'] }],
    toolPolicy: { allowedTools: [], blockedTools: ['terminal', 'browser'], approvalMode: 'beforeToolUse', executionMode: 'dryRun', registry: [] },
    sourceBlocks: [{ id: 'molt_strategy', title: 'Strategy role', scopeKind: 'molt', role: 'instruction', sourcePath: 'local#strategy' }],
    traceMetadata: { compilerTraceIsNotHermesRuntimeTrace: true }
  },
  allowedTools: [],
  blockedTools: ['terminal', 'browser'],
  requiredTools: [],
  approvalPoints: [],
  runtimeInstructions: ['Dry-run the sleeve only.'],
  sourceBlocks: [{ id: 'molt_strategy', title: 'Strategy role', scopeKind: 'molt', role: 'instruction', sourcePath: 'local#strategy' }]
};

function makeMockStream() {
  const stream = new EventEmitter();
  stream.setEncoding = () => stream;
  return stream;
}

function makeMockProcess({ stdout = '', stderr = '', code = 0, delayMs = 1 } = {}) {
  const stdoutStream = makeMockStream();
  const stderrStream = makeMockStream();
  const proc = new EventEmitter();
  proc.stdout = stdoutStream;
  proc.stderr = stderrStream;
  proc.kill = vi.fn();
  setTimeout(() => {
    if (stdout) stdoutStream.emit('data', stdout);
    if (stderr) stderrStream.emit('data', stderr);
    proc.emit('close', code, null);
  }, delayMs);
  return proc;
}

describe('Hermes runtime bridge helpers', () => {
  it('rejects liveAllowed unless explicitly enabled by server env', async () => {
    const { validateRuntimeRequest } = await getRuntimeBridgeModule();
    expect(validateRuntimeRequest({ ...safeRuntimeRequest, executionMode: 'liveAllowed' }, {})).toMatchObject({ ok: false, status: 403 });
    expect(validateRuntimeRequest({ ...safeRuntimeRequest, executionMode: 'liveAllowed' }, { HERMES_RUNTIME_ALLOW_LIVE: 'true' })).toMatchObject({ ok: true });
  });

  it('invokes Hermes CLI with safe toolsets for runtime dry-run', async () => {
    const { runHermesRuntimeCli } = await getRuntimeBridgeModule();
    const captured = {};
    const spawnMock = vi.fn((command, args, options) => {
      captured.command = command;
      captured.args = args;
      captured.options = options;
      return makeMockProcess({ stdout: '{"traceId":"trace_phase10_test","status":"ok","finalOutput":"done","events":[],"toolCalls":[],"blockedCalls":[],"approvalRequests":[],"errors":[],"artifacts":[],"unmappedEvents":[]}' });
    });
    const result = await runHermesRuntimeCli('runtime prompt', { HERMES_CLI_PATH: '/home/neomagnetar/.local/bin/hermes', HERMES_INFERENCE_PROVIDER: 'openai-codex', HERMES_INFERENCE_MODEL: 'gpt-5.3-codex-spark' }, spawnMock);
    expect(result.ok).toBe(true);
    expect(captured.command).toBe('/home/neomagnetar/.local/bin/hermes');
    expect(captured.args).toEqual(['-z', 'runtime prompt', '--provider', 'openai-codex', '--model', 'gpt-5.3-codex-spark', '--toolsets', 'safe']);
    expect(captured.options.shell).toBeUndefined();
  });

  it('normalizes real Hermes JSON into trace envelope without fabricating unmapped visual IDs', async () => {
    const { buildTraceEnvelopeFromHermesOutput } = await getRuntimeBridgeModule();
    const envelope = buildTraceEnvelopeFromHermesOutput(safeRuntimeRequest, JSON.stringify({
      traceId: 'trace_phase10_test',
      status: 'ok',
      finalOutput: 'Hermes reasoned over the sleeve.',
      events: [{ eventId: 'evt_1', timestamp: 1, eventType: 'sleeve_loaded', message: 'Sleeve loaded', sleeveId: 'sleeve_business_automation_core', status: 'active' }],
      toolCalls: [],
      blockedCalls: [{ id: 'blocked_tool', toolId: 'terminal', status: 'blocked' }],
      approvalRequests: [],
      errors: [],
      artifacts: [],
      unmappedEvents: [{ eventId: 'evt_unmapped', timestamp: 2, eventType: 'molt_role_used', message: 'Referenced unknown role without ID', status: 'complete' }]
    }));

    expect(envelope.status).toBe('ok');
    expect(envelope.events).toHaveLength(1);
    expect(envelope.events[0]).toMatchObject({ sleeveId: 'sleeve_business_automation_core', state: 'active' });
    expect(envelope.unmappedEvents).toHaveLength(1);
    expect(envelope.unmappedEvents[0].moltBlockId).toBeUndefined();
  });

  it('returns a runtime bridge envelope from mocked Hermes output', async () => {
    const { buildRuntimeBridgeResponse } = await getRuntimeBridgeModule();
    const response = await buildRuntimeBridgeResponse(safeRuntimeRequest, {}, async () => ({ ok: true, status: 200, text: JSON.stringify({ traceId: 'trace_phase10_test', status: 'ok', finalOutput: 'ok', events: [], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], unmappedEvents: [] }) }));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ traceId: 'trace_phase10_test', status: 'ok', finalOutput: 'ok', events: [], unmappedEvents: [] });
  });
});
