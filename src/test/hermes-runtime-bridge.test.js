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

function withStructuralContract(plan) {
  const neoStacks = (plan.neoStacks || []).map((stack, index) => ({ generationReason: `Stack ${index + 1} is a distinct kind of work.`, kindOfWork: stack.kindOfWork || stack.title, ...stack }));
  const neoBlocks = (plan.neoBlocks || []).map((block, index) => ({ generationReason: `Block ${index + 1} is a reusable module inside its stack.`, ...block }));
  const moltBlocks = (plan.moltBlocks || []).map((block, index) => ({ generationReason: `MOLT ${index + 1} is an internal thought layer for the parent NeoBlock.`, ...block }));
  return {
    ...plan,
    structuralIR: {
      sleeve: { id: plan.requestId, title: plan.title, generationReason: 'Sleeve coordinates the full workflow.' },
      neoStacks,
      neoBlocks,
      moltLayers: moltBlocks,
      mergeOps: [{ id: 'MERGE.TEST.01', mergeType: 'semantic_overlay', inputs: ['input'], output: 'merged output', generationReason: 'Explicit semantic fusion placeholder for validation.' }],
      gates: plan.gates || [],
      toolBlocks: [],
      routes: [{ from: neoBlocks[0]?.id || 'start', to: neoBlocks[1]?.id || 'end', generationReason: 'Renderable route edge.' }]
    },
    auditResult: {
      passed: true,
      revisionRequired: false,
      checks: [
        { id: 'neostack_kind_of_work', passed: true, notes: 'Each stack performs a distinct work lane.' },
        { id: 'stack_has_blocks', passed: true, notes: 'Every stack has blocks.' },
        { id: 'block_has_molt', passed: true, notes: 'Every block has MOLT layers.' }
      ]
    },
    neoStacks,
    neoBlocks,
    moltBlocks
  };
}

function makeNlCardNormalizationPlan(overrides = {}) {
  const plan = {
    schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1',
    source: 'hermes_custom_workflow_generation',
    mode: 'runtime_session_draft',
    generationSource: 'live_hermes_cli',
    requestId: 'req.nlcard.normalize',
    title: 'nlCard Normalization Sleeve',
    summary: 'Valid structure with intentionally sparse cards.',
    decompositionSummary: 'Sparse cards should be normalized before validation.',
    reuseDecisions: [],
    generatedDecisions: [{ id: 'generated.nlcard', title: 'nlCard normalization', runtimeSessionOnly: true, sourceLibraryWrite: false, reason: 'Needed to validate normalization.' }],
    neoStacks: [{ id: 'stack.nlcard', title: 'Normalization Stack', purpose: 'Coordinate nlCard normalization work.', kindOfWork: 'schema normalization', description: 'Normalize returned UMG cards.', stackOrder: 1, neoBlockIds: ['block.nlcard'], sourceKind: 'runtime-session draft', nlCard: { title: 'Normalization Stack', role: 'neostack', category: 'test', tags: ['nlcard'] }, jsonSchema: { type: 'object' }, generationReason: 'Stack exists to test schema normalization.' }],
    neoBlocks: [{ id: 'block.nlcard', title: 'Normalization Block', description: 'Normalize module card data.', modulePurpose: 'Fill nlCard content from modulePurpose.', neoStackId: 'stack.nlcard', stackOrder: 1, blockOrder: 1, moltBlockIds: ['molt.nlcard'], gates: [], capabilities: [], sourceKind: 'runtime-session draft', nlCard: { title: 'Normalization Block', role: 'neoblock', category: 'test', tags: ['nlcard'] }, jsonSchema: { type: 'object' }, generationReason: 'Block exists to test NeoBlock card normalization.' }],
    moltBlocks: [{ id: 'molt.nlcard', title: 'Normalization MOLT', role: 'primary', content: 'Actual thought-role content.', description: 'Normalize MOLT card data.', tags: ['nlcard'], sourceKind: 'runtime-session draft', stackOrder: 1, parentNeoBlockId: 'block.nlcard', parentNeoStackId: 'stack.nlcard', nlCard: { title: 'Normalization MOLT', role: 'primary', category: 'test', tags: ['nlcard'] }, jsonSchema: { type: 'object' }, generationReason: 'MOLT exists to test thought-role content normalization.' }],
    gates: [],
    capabilities: [],
    warnings: []
  };
  const structuralPlan = withStructuralContract(plan);
  return { ...structuralPlan, ...overrides };
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

  it('builds a live Hermes custom Sleeve generation prompt and parses validated JSON output', async () => {
    const { buildCustomSleeveGenerationPrompt, buildCustomSleeveGenerationResponse } = await getRuntimeBridgeModule();
    const request = {
      requestId: 'req.phase13ic.bridge',
      userPrompt: 'Generate a custom refund workflow Sleeve.',
      userContext: '',
      selectedMode: 'custom_workflow',
      supportedPromptMoltRoles: ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'],
      appLocalSkillBundle: { sleeveDecompositionSkill: 'UMG Sleeve Decomposition Skill', hierarchyCardSkill: 'UMG hierarchy', compilerAlignmentRules: 'compiler rules', sourceLibraryBoundaryRules: 'No source-library mutation', capabilityBoundaryRules: 'capability rules', websiteBuilderBoundary: 'Website Builder future pack' },
      gatePolicy: 'Gates are control/routing/approval records, not prompt MOLT blocks.',
      sourceLibraryPolicy: 'No source-library mutation.'
    };
    const prompt = buildCustomSleeveGenerationPrompt(request);
    expect(prompt).toContain('UMG Sleeve Decomposition Skill');
    expect(prompt).toContain('Return ONLY JSON');
    expect(prompt).toContain('You are not merely producing a workflow outline');
    expect(prompt).toContain('Sleeve → NeoStacks → NeoBlocks → MOLT roles → Merge operations → Gates → MetaMOLT Tool Blocks → Capabilities');
    expect(prompt).toContain('Uploaded content must influence block selection and block generation');
    expect(prompt).toContain('nlCard');
    expect(prompt).toContain('jsonSchema');
    expect(prompt).toContain('Every NeoBlock must contain meaningful MOLT layers');
    expect(prompt).toContain('UMG Structural IR');
    expect(prompt).toContain('structuralIR');
    expect(prompt).toContain('auditResult');
    expect(prompt).toContain('Greek Philosophy Desktop Note Sleeve');
    expect(prompt).toContain('Runtime trace expectation');
    expect(prompt).toContain('custom_workflow');
    expect(prompt).not.toContain('chain-of-thought');
    const hermesPlan = {
      schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1',
      source: 'hermes_custom_workflow_generation',
      mode: 'runtime_session_draft',
      generationSource: 'live_hermes_cli',
      requestId: 'req.phase13ic.bridge',
      title: 'Bridge Generated Sleeve',
      summary: 'Generated by mocked Hermes CLI.',
      decompositionSummary: 'Concise visible summary only.',
      reuseDecisions: [],
      generatedDecisions: [{ id: 'generated.safe', title: 'Safe generated block', runtimeSessionOnly: true, sourceLibraryWrite: false, reason: 'Needed for test.' }],
      neoStacks: [{ id: 'stack.bridge', title: 'Bridge Stack', description: 'Bridge generated stack.', stackOrder: 1, neoBlockIds: ['block.bridge'], sourceKind: 'runtime-session draft', nlCard: { title: 'Bridge Stack', role: 'neostack', category: 'test', tags: ['bridge'], description: 'Bridge generated stack.', content: 'Bridge stack exists for test synthesis.' }, jsonSchema: { type: 'object', properties: { purpose: { type: 'string' } } } }],
      neoBlocks: [{ id: 'block.bridge', title: 'Bridge Block', description: 'Bridge generated block.', neoStackId: 'stack.bridge', stackOrder: 1, blockOrder: 1, moltBlockIds: ['molt.bridge.primary'], gates: [], capabilities: [], sourceKind: 'runtime-session draft', nlCard: { title: 'Bridge Block', role: 'neoblock', category: 'test', tags: ['bridge'], description: 'Bridge generated block.', content: 'Bridge block contains the test primary MOLT.' }, jsonSchema: { type: 'object', properties: { purpose: { type: 'string' } } } }],
      moltBlocks: [{ id: 'molt.bridge.primary', title: 'Bridge Primary', role: 'primary', content: 'Primary content.', description: 'Primary content for bridge validation.', tags: ['bridge'], sourceKind: 'runtime-session draft', stackOrder: 1, parentNeoBlockId: 'block.bridge', parentNeoStackId: 'stack.bridge', nlCard: { title: 'Bridge Primary', role: 'primary', category: 'test', tags: ['bridge'], description: 'Primary content for bridge validation.', content: 'Primary content.' }, jsonSchema: { type: 'object', properties: { content: { type: 'string' } } } }],
      gates: [],
      capabilities: [],
      warnings: []
    };
    const structuralHermesPlan = withStructuralContract(hermesPlan);
    const response = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: `Here is the plan:

\`\`\`json
${JSON.stringify(structuralHermesPlan)}
\`\`\`` }));
    expect(response.status).toBe(200);
    expect(response.body.plan.title).toBe('Bridge Generated Sleeve');
    expect(response.body.plan.generationSource).toBe('live_hermes_cli');
    expect(response.body.validation.valid).toBe(true);
    expect(response.body.externalActionTaken).toBe(false);
    expect(prompt).toContain('Every nlCard must include title, description, content, tags, and category');
    expect(prompt).toContain('nlCard.content should summarize the kind of work');
    const invalidMissingCards = { ...structuralHermesPlan, moltBlocks: [{ id: 'molt.bad', title: 'Bad Primary', role: 'primary', content: 'Missing required card/schema/source fields.', parentNeoBlockId: 'block.bridge', parentNeoStackId: 'stack.bridge' }] };
    const invalidResponse = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: JSON.stringify(invalidMissingCards) }));
    expect(invalidResponse.status).toBe(422);
    expect(invalidResponse.body.validation.errors.join(' ')).toMatch(/jsonSchema|sourceKind|tags/);
  });

  it('normalizes sparse nlCards before final custom Sleeve validation', async () => {
    const { buildCustomSleeveGenerationResponse } = await getRuntimeBridgeModule();
    const request = { requestId: 'req.nlcard.normalize', userPrompt: 'Generate sparse nlCards.', userContext: '', selectedMode: 'custom_workflow', supportedPromptMoltRoles: ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'] };

    const stackContentPlan = makeNlCardNormalizationPlan();
    const stackContentResponse = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: JSON.stringify(stackContentPlan) }));
    expect(stackContentResponse.status).toBe(200);
    expect(stackContentResponse.body.plan.neoStacks[0].nlCard.content).toBe('Coordinate nlCard normalization work.');
    expect(stackContentResponse.body.validation.valid).toBe(true);

    const missingStackCardPlan = makeNlCardNormalizationPlan();
    delete missingStackCardPlan.neoStacks[0].nlCard;
    const missingStackCardResponse = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: JSON.stringify(missingStackCardPlan) }));
    expect(missingStackCardResponse.status).toBe(200);
    expect(missingStackCardResponse.body.plan.neoStacks[0].nlCard).toMatchObject({ title: 'Normalization Stack', content: 'Coordinate nlCard normalization work.', category: 'runtime-session', tags: [] });

    const blockModulePurposePlan = makeNlCardNormalizationPlan();
    delete blockModulePurposePlan.neoBlocks[0].description;
    delete blockModulePurposePlan.neoBlocks[0].nlCard.content;
    const blockModulePurposeResponse = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: JSON.stringify(blockModulePurposePlan) }));
    expect(blockModulePurposeResponse.status).toBe(200);
    expect(blockModulePurposeResponse.body.plan.neoBlocks[0].nlCard.content).toBe('Fill nlCard content from modulePurpose.');

    const moltContentPlan = makeNlCardNormalizationPlan();
    delete moltContentPlan.moltBlocks[0].nlCard.content;
    const moltContentResponse = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: JSON.stringify(moltContentPlan) }));
    expect(moltContentResponse.status).toBe(200);
    expect(moltContentResponse.body.plan.moltBlocks[0].nlCard.content).toBe('Actual thought-role content.');
  });

  it('preserves strict rejection for empty components and missing structural contract', async () => {
    const { buildCustomSleeveGenerationResponse } = await getRuntimeBridgeModule();
    const request = { requestId: 'req.nlcard.strict', userPrompt: 'Generate invalid sparse cards.', userContext: '', selectedMode: 'custom_workflow', supportedPromptMoltRoles: ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'] };

    const emptyComponentPlan = makeNlCardNormalizationPlan();
    emptyComponentPlan.neoStacks[0] = { ...emptyComponentPlan.neoStacks[0], id: '', title: '', purpose: '', description: '', kindOfWork: '', generationReason: '', nlCard: undefined };
    const emptyComponentResponse = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: JSON.stringify(emptyComponentPlan) }));
    expect(emptyComponentResponse.status).toBe(422);
    expect(emptyComponentResponse.body.validation.errors.join(' ')).toMatch(/requires generationReason|nlCard requires title|nlCard requires content/);

    const missingStructural = makeNlCardNormalizationPlan();
    delete missingStructural.structuralIR;
    const missingStructuralResponse = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: JSON.stringify(missingStructural) }));
    expect(missingStructuralResponse.status).toBe(422);
    expect(missingStructuralResponse.body.validation.errors.join(' ')).toMatch(/structuralIR/);

    const missingAudit = makeNlCardNormalizationPlan();
    delete missingAudit.auditResult;
    const missingAuditResponse = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: JSON.stringify(missingAudit) }));
    expect(missingAuditResponse.status).toBe(422);
    expect(missingAuditResponse.body.validation.errors.join(' ')).toMatch(/auditResult/);
  });

  it('extracts custom Sleeve JSON from prose and retries once with strict JSON instructions when no object exists', async () => {
    const { buildCustomSleeveGenerationResponse, parseJsonObjectFromText } = await getRuntimeBridgeModule();
    const plan = {
      schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1',
      source: 'hermes_custom_workflow_generation',
      mode: 'runtime_session_draft',
      generationSource: 'live_hermes_cli',
      requestId: 'req.s1d.retry',
      title: 'Strict Retry Sleeve',
      summary: 'Generated after retry.',
      decompositionSummary: 'Retry returned strict JSON.',
      reuseDecisions: [],
      generatedDecisions: [{ id: 'generated.retry', title: 'Retry block', runtimeSessionOnly: true, sourceLibraryWrite: false, reason: 'Needed for test.' }],
      neoStacks: [{ id: 'stack.retry', title: 'Retry Stack', description: 'Retry stack.', stackOrder: 1, neoBlockIds: ['block.retry'], sourceKind: 'runtime-session draft', nlCard: { title: 'Retry Stack', role: 'neostack', category: 'test', tags: ['retry'], description: 'Retry stack.', content: 'Retry stack content.' }, jsonSchema: { type: 'object' } }],
      neoBlocks: [{ id: 'block.retry', title: 'Retry Block', description: 'Retry block.', neoStackId: 'stack.retry', stackOrder: 1, blockOrder: 1, moltBlockIds: ['molt.retry'], gates: [], capabilities: [], sourceKind: 'runtime-session draft', nlCard: { title: 'Retry Block', role: 'neoblock', category: 'test', tags: ['retry'], description: 'Retry block.', content: 'Retry block content.' }, jsonSchema: { type: 'object' } }],
      moltBlocks: [{ id: 'molt.retry', title: 'Retry Directive', role: 'directive', content: 'Retry content.', description: 'Retry content.', tags: ['retry'], sourceKind: 'runtime-session draft', stackOrder: 1, parentNeoBlockId: 'block.retry', parentNeoStackId: 'stack.retry', nlCard: { title: 'Retry Directive', role: 'directive', category: 'test', tags: ['retry'], description: 'Retry content.', content: 'Retry content.' }, jsonSchema: { type: 'object' } }],
      gates: [],
      capabilities: [],
      warnings: []
    };
    const structuralPlan = withStructuralContract(plan);
    expect(parseJsonObjectFromText(`prefix {"ignored": true} suffix`).ignored).toBe(true);
    const request = { requestId: 'req.s1d.retry', userPrompt: 'Generate a retry Sleeve.', userContext: '', selectedMode: 'custom_workflow', supportedPromptMoltRoles: ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'] };
    const calls = [];
    const response = await buildCustomSleeveGenerationResponse(request, {}, async (prompt) => {
      calls.push(prompt);
      return calls.length === 1 ? { ok: true, status: 200, text: 'I cannot format this yet.' } : { ok: true, status: 200, text: JSON.stringify(structuralPlan) };
    });
    expect(response.status).toBe(200);
    expect(response.body.plan.title).toBe('Strict Retry Sleeve');
    expect(response.body.debug.parseRetryUsed).toBe(true);
    expect(calls[1]).toContain('Return only the JSON object. No prose. No markdown.');

    const failed = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: 'still no JSON here' }));
    expect(failed.status).toBe(502);
    expect(failed.body.validation.errors.join(' ')).toContain('strict JSON retry');
    expect(failed.body.debug.fallbackUsed).toBe(false);
    expect(failed.body.debug.parseRetryUsed).toBe(true);
    expect(failed.body.debug.failureStage).toBe('strict_json_retry_parse');
    expect(failed.body.debug.rawOutputPreview).toContain('still no JSON');
    expect(failed.body.debug.retryOutputPreview).toContain('still no JSON');
  });

  it('rejects or retries Hermes outputs that skip structuralIR or auditResult', async () => {
    const { buildCustomSleeveGenerationResponse } = await getRuntimeBridgeModule();
    const basePlan = {
      schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1',
      source: 'hermes_custom_workflow_generation',
      mode: 'runtime_session_draft',
      generationSource: 'live_hermes_cli',
      requestId: 'req.structural.retry',
      title: 'Structural Retry Sleeve',
      summary: 'Generated after structural retry.',
      decompositionSummary: 'Structural retry returned IR and audit.',
      reuseDecisions: [],
      generatedDecisions: [{ id: 'generated.structural', title: 'Structural draft', runtimeSessionOnly: true, sourceLibraryWrite: false, reason: 'Needed for test.' }],
      neoStacks: [{ id: 'stack.structural', title: 'Structural Stack', description: 'Structural stack.', stackOrder: 1, neoBlockIds: ['block.structural'], sourceKind: 'runtime-session draft', nlCard: { title: 'Structural Stack', role: 'neostack', category: 'test', tags: ['structural'], description: 'Structural stack.', content: 'Structural stack content.' }, jsonSchema: { type: 'object' } }],
      neoBlocks: [{ id: 'block.structural', title: 'Structural Block', description: 'Structural block.', neoStackId: 'stack.structural', stackOrder: 1, blockOrder: 1, moltBlockIds: ['molt.structural'], gates: [], capabilities: [], sourceKind: 'runtime-session draft', nlCard: { title: 'Structural Block', role: 'neoblock', category: 'test', tags: ['structural'], description: 'Structural block.', content: 'Structural block content.' }, jsonSchema: { type: 'object' } }],
      moltBlocks: [{ id: 'molt.structural', title: 'Structural Directive', role: 'directive', content: 'Structural content.', description: 'Structural content.', tags: ['structural'], sourceKind: 'runtime-session draft', stackOrder: 1, parentNeoBlockId: 'block.structural', parentNeoStackId: 'stack.structural', nlCard: { title: 'Structural Directive', role: 'directive', category: 'test', tags: ['structural'], description: 'Structural content.', content: 'Structural content.' }, jsonSchema: { type: 'object' } }],
      gates: [],
      capabilities: [],
      warnings: []
    };
    const request = { requestId: 'req.structural.retry', userPrompt: 'Generate a structural Sleeve.', userContext: '', selectedMode: 'custom_workflow', supportedPromptMoltRoles: ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'] };
    const calls = [];
    const response = await buildCustomSleeveGenerationResponse(request, {}, async (prompt) => {
      calls.push(prompt);
      return calls.length === 1 ? { ok: true, status: 200, text: JSON.stringify(basePlan) } : { ok: true, status: 200, text: JSON.stringify(withStructuralContract(basePlan)) };
    });
    expect(response.status).toBe(200);
    expect(response.body.debug.structuralContractRetryUsed).toBe(true);
    expect(calls[1]).toContain('Return only valid JSON containing structuralIR, auditResult, and final Sleeve JSON fields');

    const failed = await buildCustomSleeveGenerationResponse(request, {}, async () => ({ ok: true, status: 200, text: JSON.stringify(basePlan) }));
    expect(failed.status).toBe(422);
    expect(failed.body.debug.structuralContractRetryUsed).toBe(true);
    expect(failed.body.validation.errors.join(' ')).toMatch(/structuralIR|auditResult/);
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

  it('continues approved local note file write as safe app-local artifact without desktop write', async () => {
    const { buildRuntimeBridgeResponse, buildContinuationTraceEnvelope } = await getRuntimeBridgeModule();
    const request = {
      ...safeRuntimeRequest,
      traceId: 'trace.phase13i_e.local_note.start',
      executionMode: 'approvalRequired',
      userGoal: 'write a note on my desktop about apples',
      compiledSleeveManifest: {
        ...safeRuntimeRequest.compiledSleeveManifest,
        sleeveId: 'sleeve.greek.desktop.note',
        sleeveTitle: 'Greek-Infused Desktop Note Creator',
        executionPlan: [{ id: 'step.note', label: 'Prepare desktop note', scopeKind: 'neoblock', targetId: 'nb.desktop.note.compose', requiredGateIds: ['gate.note.approval'], requiredToolIds: ['umg.capability.local_text_composition', 'umg.capability.local_note_file_write'], orderIndex: 0 }],
        sourceBlocks: [
          { id: 'nb.desktop.note.compose', title: 'Compose Greek Desktop Note', scopeKind: 'neoblock' },
          { id: 'molt.note.philosophy', title: 'Greek Philosophy Note Guidance', scopeKind: 'molt', role: 'philosophy', metadata: { parentNeoBlockId: 'nb.desktop.note.compose' } }
        ],
        toolPolicy: { ...safeRuntimeRequest.compiledSleeveManifest.toolPolicy, allowedTools: ['umg.capability.local_text_composition', 'umg.capability.local_note_file_write'], registry: [] }
      },
      toolCapabilityRegistry: [
        { capabilityId: 'umg.capability.local_text_composition', available: 'yes', executionPolicy: 'autoAllowed', safeForLiveExecution: true, mappedHermesToolName: 'app_local_umg_local_text_composition', relatedNeoBlockId: 'nb.desktop.note.compose', relatedMoltId: 'molt.note.philosophy' },
        { capabilityId: 'umg.capability.local_note_file_write', available: 'yes', executionPolicy: 'approvalRequired', requiredApproval: true, safeForLiveExecution: false, mappedHermesToolName: 'app_local_umg_local_note_artifact_prepare', relatedNeoBlockId: 'nb.desktop.note.compose', relatedGateId: 'gate.note.approval', relatedMoltId: 'molt.note.philosophy' }
      ]
    };
    const first = await buildRuntimeBridgeResponse(request, {}, async () => { throw new Error('approval-required request should not invoke CLI'); });
    expect(first.body.status).toBe('needsApproval');
    expect(first.body.approvalRequests[0].raw.capabilityId).toBe('umg.capability.local_note_file_write');
    const continuation = buildContinuationTraceEnvelope({
      ...request,
      traceId: 'trace.phase13i_e.local_note.continue',
      continuationMode: 'continue_after_approval',
      previousTraceId: request.traceId,
      linkedTraceId: 'trace.phase13i_e.local_note.continue',
      approvalDecision: 'approve',
      approvedCapabilities: ['umg.capability.local_note_file_write'],
      deniedCapabilities: [],
      pendingToolCapability: { capabilityId: 'umg.capability.local_note_file_write', executionPolicy: 'approvalRequired', available: 'yes', riskLevel: 'medium', requestedByNeoBlockId: 'nb.desktop.note.compose', requestedByGateId: 'gate.note.approval', requestedByMoltId: 'molt.note.philosophy' },
      previousTrace: first.body.trace,
      preserveUMGTrace: true
    });
    expect(continuation.status).toBe('ok');
    expect(continuation.events.map((event) => event.eventType)).toEqual(expect.arrayContaining(['approval_granted', 'tool_call_prepared', 'tool_call_executed', 'tool_result_received', 'neoblock_completed', 'run_completed']));
    expect(continuation.artifacts[0]).toMatchObject({ label: 'Greek-Infused Desktop Note', kind: 'local_note_safe_artifact' });
    expect(continuation.artifacts[0].content).toMatchObject({ title: 'Greek-Infused Desktop Note', externalActionTaken: false, destructiveAction: false, fileWritePerformed: false });
    expect(continuation.artifacts[0].content.body).toContain('Apples');
    expect(continuation.artifacts[0].content.body).toContain('Greek philosophy');
  });

  it('prepares native Hermes action approval without executing external actions', async () => {
    const { buildNativeActionBridgeResponse } = await getRuntimeBridgeModule();
    const request = { actionId: 'native.note.approval', capabilityId: 'umg.native.hermes.note_create', mode: 'approval', risk: 'low', prompt: 'Create a desktop note', sleeveId: 'sleeve_business_automation_core', neoBlockId: 'block_strategy', gateId: 'gate.native.note' };
    const response = await buildNativeActionBridgeResponse(request, {}, async () => { throw new Error('approval mode must not invoke Hermes CLI'); });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approval_required');
    expect(response.body.externalActionTaken).toBe(false);
    expect(response.body.traceEvents.map((event) => event.eventType)).toEqual(expect.arrayContaining(['tool_block_resolved', 'action_request_created', 'action_approval_required']));
  });

  it('reports real created files for direct native Hermes note execution', async () => {
    const { buildNativeActionBridgeResponse } = await getRuntimeBridgeModule();
    const tmpFile = '/tmp/umg-hermes-native-bridge-test-note.txt';
    await import('node:fs/promises').then((fs) => fs.rm(tmpFile, { force: true }));
    const request = { actionId: 'native.note.direct', capabilityId: 'umg.native.hermes.note_create', mode: 'direct', risk: 'low', prompt: 'Create a desktop note', expectedOutputs: [tmpFile], sleeveId: 'sleeve_business_automation_core', neoBlockId: 'block_strategy', moltId: 'molt_strategy', gateId: 'gate.native.note', userApproved: true };
    const response = await buildNativeActionBridgeResponse(request, {}, async () => {
      await import('node:fs/promises').then((fs) => fs.writeFile(tmpFile, 'hi im hermes from UMG\n', 'utf8'));
      return { text: 'created real note', stderr: '' };
    });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('executed');
    expect(response.body.externalActionTaken).toBe(true);
    expect(response.body.createdFiles).toContain(tmpFile);
    expect(response.body.artifacts[0]).toMatchObject({ kind: 'file', path: tmpFile, externalActionTaken: true });
    expect(response.body.traceEvents.map((event) => event.eventType)).toEqual(expect.arrayContaining(['action_executed', 'file_created', 'artifact_created']));
  });

});

