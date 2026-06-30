import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { applyRuntimeTraceEvents, createEmptyRuntimeVisualState } from '../lib/umg/cognitiveRuntimeState';

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

  it('injects the app-local UMG runtime skill pack and capability registry into the Hermes prompt', async () => {
    const { buildHermesRuntimePrompt } = await getRuntimeBridgeModule();
    const request = {
      ...safeRuntimeRequest,
      toolCapabilityRegistry: [{ capabilityId: 'customer_message_draft', available: 'yes', safeForLiveExecution: true }],
      umgRuntimeSkillPack: { id: 'umg_runtime_skill_pack.v1', instructions: 'UMG Runtime Skill Pack: use supplied UMG IDs only.' },
      currentExecutionRoute: { route: ['block_strategy'], activeNeoBlockId: 'block_strategy' }
    };
    const prompt = buildHermesRuntimePrompt(request);
    expect(prompt).toContain('UMG Runtime Skill Pack');
    expect(prompt).toContain('toolCapabilityRegistry');
    expect(prompt).toContain('customer_message_draft');
    expect(prompt).toContain('currentExecutionRoute');
    expect(prompt).toContain('run_started');
    expect(prompt).toContain('tool_call_blocked');
  });

  it('executes customer_message_draft as real safe app-local capability with artifact and trace events', async () => {
    const { buildSafeCapabilityTraceEnvelope, buildRuntimeBridgeResponse } = await getRuntimeBridgeModule();
    const request = {
      ...safeRuntimeRequest,
      traceId: 'trace.phase13f.customer_message_draft',
      executionMode: 'approvalRequired',
      compiledSleeveManifest: {
        ...safeRuntimeRequest.compiledSleeveManifest,
        sleeveTitle: 'Customer Return & Refund Orchestration Sleeve',
        sourceBlocks: [
          { id: 'nb.customer.message', title: 'Draft Customer Return Instructions', scopeKind: 'neoblock' },
          { id: 'molt.customer.primary', title: 'Draft Customer Return Instructions Primary', scopeKind: 'molt', role: 'primary', metadata: { parentNeoBlockId: 'nb.customer.message' } }
        ]
      },
      toolCapabilityRegistry: [{ capabilityId: 'customer_message_draft', available: 'yes', executionPolicy: 'autoAllowed', safeForLiveExecution: true, mappedHermesToolName: 'app_local_customer_message_draft', relatedNeoBlockId: 'nb.customer.message', relatedGateId: 'gate.customer.safe', relatedMoltId: 'molt.customer.primary' }]
    };
    const envelope = buildSafeCapabilityTraceEnvelope(request);
    expect(envelope.status).toBe('ok');
    expect(envelope.toolCalls[0]).toMatchObject({ toolId: 'customer_message_draft', toolName: 'app_local_customer_message_draft', status: 'executed' });
    expect(envelope.toolCalls[0].output).toMatchObject({ artifactType: 'customer_message_draft', nonDestructive: true, externalActionTaken: false, relatedNeoBlockId: 'nb.customer.message', relatedGateId: 'gate.customer.safe', relatedMoltId: 'molt.customer.primary' });
    expect(envelope.artifacts[0]).toMatchObject({ kind: 'customer_message_draft', label: 'Return Request Customer Reply Draft' });
    expect(envelope.events.map((event) => event.eventType)).toEqual(expect.arrayContaining(['tool_call_prepared', 'tool_call_executed', 'tool_result_received', 'neoblock_completed', 'run_completed']));
    const response = await buildRuntimeBridgeResponse(request, {}, async () => { throw new Error('safe capability should not invoke external CLI'); });
    expect(response.status).toBe(200);
    expect(response.body.artifacts[0].content.externalActionTaken).toBe(false);
  });

  it('routes customer_message_draft to report_generate as a second safe app-local capability', async () => {
    const { buildSafeCapabilityTraceEnvelope, selectNextRuntimeStepAfterCapability } = await getRuntimeBridgeModule();
    const request = {
      ...safeRuntimeRequest,
      traceId: 'trace.phase13g.multi_step_route',
      executionMode: 'approvalRequired',
      compiledSleeveManifest: {
        ...safeRuntimeRequest.compiledSleeveManifest,
        sleeveTitle: 'Customer Return & Refund Orchestration Sleeve',
        sourceBlocks: [
          { id: 'nb.customer.message', title: 'Draft Customer Return Instructions', scopeKind: 'neoblock' },
          { id: 'molt.customer.primary', title: 'Draft Customer Return Instructions Primary', scopeKind: 'molt', role: 'primary', metadata: { parentNeoBlockId: 'nb.customer.message' } },
          { id: 'nb.report.generate', title: 'Generate Return Metrics', scopeKind: 'neoblock' },
          { id: 'molt.report.primary', title: 'Generate Return Metrics Primary', scopeKind: 'molt', role: 'primary', metadata: { parentNeoBlockId: 'nb.report.generate' } }
        ]
      },
      toolCapabilityRegistry: [
        { capabilityId: 'customer_message_draft', available: 'yes', executionPolicy: 'autoAllowed', safeForLiveExecution: true, mappedHermesToolName: 'app_local_customer_message_draft', relatedNeoBlockId: 'nb.customer.message', relatedMoltId: 'molt.customer.primary' },
        { capabilityId: 'report_generate', available: 'yes', executionPolicy: 'autoAllowed', safeForLiveExecution: true, mappedHermesToolName: 'app_local_report_generate', relatedNeoBlockId: 'nb.report.generate', relatedMoltId: 'molt.report.primary' }
      ]
    };
    const route = selectNextRuntimeStepAfterCapability(request, 'customer_message_draft', 'nb.customer.message');
    expect(route).toMatchObject({ nextCapabilityId: 'report_generate', nextNeoBlockId: 'nb.report.generate', nextMoltId: 'molt.report.primary', safeForLiveExecution: true, externalActionTaken: false });
    const envelope = buildSafeCapabilityTraceEnvelope(request);
    expect(envelope.artifacts).toHaveLength(2);
    expect(envelope.artifacts[1].content).toMatchObject({ artifactType: 'return_workflow_report', sourceCapability: 'report_generate', nonDestructive: true, externalActionTaken: false, previousArtifactSummary: 'Return Request Customer Reply Draft completed' });
    expect(envelope.toolCalls.map((call) => call.toolId)).toEqual(['customer_message_draft', 'report_generate']);
    expect(envelope.events.filter((event) => event.eventType === 'tool_call_executed')).toHaveLength(2);
    expect(envelope.events.filter((event) => event.eventType === 'tool_result_received')).toHaveLength(2);
    const visualEvents = envelope.events.map((event) => ({ ...event, state: event.state ?? event.status }));
    const visualState = applyRuntimeTraceEvents(createEmptyRuntimeVisualState(request.traceId), visualEvents);
    expect(visualState.completeIds).toEqual(expect.arrayContaining(['nb.customer.message', 'nb.report.generate']));
    expect(envelope.unmappedEvents).toHaveLength(0);
  });

  it('does not invent or execute a second route when no safe next capability is available', async () => {
    const { buildSafeCapabilityTraceEnvelope, selectNextRuntimeStepAfterCapability } = await getRuntimeBridgeModule();
    const request = {
      ...safeRuntimeRequest,
      traceId: 'trace.phase13g.no_safe_next_route',
      executionMode: 'approvalRequired',
      toolCapabilityRegistry: [
        { capabilityId: 'customer_message_draft', available: 'yes', executionPolicy: 'autoAllowed', safeForLiveExecution: true, mappedHermesToolName: 'app_local_customer_message_draft', relatedNeoBlockId: 'nb.customer.message', relatedMoltId: 'molt.customer.primary' },
        { capabilityId: 'report_generate', available: 'no', executionPolicy: 'blocked', safeForLiveExecution: false, mappedHermesToolName: 'app_local_report_generate', relatedNeoBlockId: 'nb.report.generate', relatedMoltId: 'molt.report.primary' }
      ]
    };
    const route = selectNextRuntimeStepAfterCapability(request, 'customer_message_draft', 'nb.customer.message');
    expect(route).toMatchObject({ nextCapabilityId: undefined, safeForLiveExecution: false, externalActionTaken: false });
    const envelope = buildSafeCapabilityTraceEnvelope(request);
    expect(envelope.artifacts).toHaveLength(1);
    expect(envelope.toolCalls).toHaveLength(1);
    expect(envelope.events.filter((event) => event.neoBlockId === 'nb.report.generate')).toHaveLength(0);
  });

  it('labels local continuation fallback as local_dev_proof and non external', async () => {
    const { buildContinuationTraceEnvelope } = await getRuntimeBridgeModule();
    const envelope = buildContinuationTraceEnvelope({
      ...safeRuntimeRequest,
      traceId: 'trace.phase13e.local_fallback',
      continuationMode: 'continue_after_approval',
      previousTraceId: 'trace.phase13e.start',
      approvalDecision: 'approve',
      approvedCapabilities: ['order_lookup'],
      deniedCapabilities: [],
      pendingToolCapability: { capabilityId: 'order_lookup', executionPolicy: 'approvalRequired', available: 'unknown', riskLevel: 'medium' },
      previousTrace: [],
      preserveUMGTrace: true
    });
    expect(envelope.toolCalls[0].output.proofType).toBe('local_dev_proof');
    expect(envelope.toolCalls[0].output.notExternalTool).toBe(true);
    expect(envelope.artifacts[0].kind).toBe('local_dev_proof');
  });

});

