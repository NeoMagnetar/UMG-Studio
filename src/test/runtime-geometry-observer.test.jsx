import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RuntimeGeometryObserver, buildRuntimeGeometryObserverGraph, deriveRuntimeExecutionState } from '../components/RuntimeGeometryObserver';
import { buildRuntimeGeometryManifest } from '../lib/umg/runtimeGeometryProjection';
import { runNativeHermesAction } from '../lib/umg/hermesRuntimeExecution';
import { createCompilerRequest } from '../lib/umg/compileCandidateAdapter';
import { normalizeCompilerResponseToManifest } from '../lib/umg/umgCompilerAdapter';

function makeSleeve() {
  return {
    id: 'sleeve.greek_note',
    title: 'Greek-Infused Desktop Note Creator',
    version: '0.1',
    templateKind: 'custom',
    source: 'runtime_session',
    description: 'Creates desktop-note safe artifacts with Greek philosophy.',
    tags: ['runtime-session'],
    governanceBlockIds: [],
    neoStacks: [
      { id: 'stack.compose', title: 'Note Composition Stack', description: 'Capture note subject and Greek lens.', blockIds: ['block.capture'], stackOrder: 0, tags: [] }
    ],
    neoBlocks: [
      { id: 'block.capture', title: 'Capture and Draft Note', description: 'Draft local note body.', neoStackId: 'stack.compose', moltBlockIds: ['molt.instruction', 'molt.subject', 'molt.philosophy'], gateIds: ['gate.approval'], blockOrder: 0, tags: [] }
    ],
    moltBlocks: [
      { id: 'molt.instruction', title: 'Instruction Role', role: 'instruction', summary: 'Write the note.', content: 'write the note', tags: [] },
      { id: 'molt.subject', title: 'Subject Role', role: 'subject', summary: 'Apples', content: 'apples', tags: [] },
      { id: 'molt.philosophy', title: 'Philosophy Role', role: 'philosophy', summary: 'Greek lens', content: 'Greek philosophy', tags: [] }
    ],
    gates: [{ id: 'gate.approval', title: 'Local note approval gate', sourceId: 'gate.approval', attachesTo: { kind: 'neoblock', id: 'block.capture' }, triggerType: 'user_intent', conditionText: 'Require approval before note file capability.', action: 'activate', targetIds: ['block.capture'], defaultState: 'closed', runtimeState: 'inactive', tags: [] }],
    metadata: {
      runtimeSessionOnly: true,
      requiredTools: ['umg.capability.local_note_file_write'],
      structuralIR: {
        sleeve: { id: 'sleeve.greek_note' },
        neoStacks: [{ id: 'stack.compose', title: 'Note Composition Stack' }],
        neoBlocks: [{ id: 'block.capture', title: 'Capture and Draft Note' }],
        moltLayers: [{ id: 'molt.philosophy', parentNeoBlockId: 'block.capture' }],
        mergeOps: [{ id: 'merge.greek_semantic_frame', title: 'Merge Greek Philosophy' }],
        gates: [{ id: 'gate.approval' }],
        toolBlocks: [{ id: 'TOOL.HERMES.NOTE_CREATE.v0.1', title: 'Hermes note create', parentNeoBlockId: 'block.capture' }],
        routes: [{ id: 'edge.capture.to.merge', fromId: 'block.capture', fromType: 'neoblock', toId: 'merge.greek_semantic_frame', toType: 'merge', label: 'semantic merge' }]
      },
      routeEdges: [{ id: 'edge.capture.to.merge', fromId: 'block.capture', fromType: 'neoblock', toId: 'merge.greek_semantic_frame', toType: 'merge' }],
      capabilities: [
        { capabilityId: 'umg.capability.local_text_composition', label: 'Local text composition', sourceNeoBlock: 'block.capture' },
        { capabilityId: 'umg.capability.local_note_file_write', label: 'Local note safe artifact', sourceNeoBlock: 'block.capture' }
      ]
    }
  };
}

const trace = [
  { traceId: 'trace.1', timestamp: 1, scopeKind: 'tool', toolId: 'umg.capability.local_note_file_write', eventType: 'tool_call_requires_approval', state: 'attention', label: 'Approval required' },
  { traceId: 'trace.1', timestamp: 2, scopeKind: 'tool', toolId: 'umg.capability.local_note_file_write', eventType: 'tool_call_prepared', state: 'processing', label: 'Tool prepared' },
  { traceId: 'trace.1', timestamp: 3, scopeKind: 'tool', toolId: 'umg.capability.local_note_file_write', eventType: 'tool_result_received', state: 'complete', label: 'Tool result received' },
  { traceId: 'trace.1', timestamp: 4, scopeKind: 'neoblock', neoBlockId: 'block.capture', eventType: 'neoblock_completed', state: 'complete', label: 'NeoBlock complete' },
  { traceId: 'trace.1', timestamp: 5, scopeKind: 'tool', toolId: 'missing.tool', eventType: 'tool_call_executed', state: 'complete', label: 'Unknown tool' },
  { traceId: 'trace.1', timestamp: 6, scopeKind: 'sleeve', sleeveId: 'sleeve.greek_note', eventType: 'run_error', state: 'error', label: 'Runtime error' }
];

function renderObserver(extra = {}) {
  return renderToStaticMarkup(<RuntimeGeometryObserver
    activeSessionSleeve={makeSleeve()}
    runtimePrompt="write a note on my desktop about apples"
    onRuntimePromptChange={() => {}}
    onRunHermesRuntime={() => {}}
    onContinueRuntimeApproval={() => {}}
    onBackToBuilder={() => {}}
    compileStatus="Compile succeeded"
    runtimeStatus="Hermes completed"
    isHermesRunning={false}
    {...extra}
  />);
}

describe('RuntimeGeometryObserver', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('renders the active Sleeve title and Runtime Graph warning without source-library controls', () => {
    const html = renderObserver();
    expect(html).toContain('Greek-Infused Desktop Note Creator');
    expect(html).toContain('Runtime Graph');
    expect(html).toContain('Structure view is available. Runtime execution requires compile.');
    expect(html).not.toContain('Save to Source Library');
    expect(html).not.toContain('Promote to Source Library');
  });

  it('Structure View shows Sleeve, NeoStack, NeoBlock, MOLT, Gate, and Capability nodes without trace', () => {
    const html = renderObserver();
    expect(html).toContain('sleeve');
    expect(html).toContain('neostack');
    expect(html).toContain('neoblock');
    expect(html).toContain('molt');
    expect(html).toContain('gate');
    expect(html).toContain('capability');
    expect(html).toContain('umg.capability.local_text_composition');
    expect(html).toContain('umg.capability.local_note_file_write');
  });

  it('applies real runtime statuses, attaches artifacts, and leaves unmapped events unactivated', () => {
    const result = {
      status: 'ok',
      finalOutput: 'done',
      trace,
      toolCalls: [],
      blockedCalls: [],
      approvalRequests: [],
      errors: [],
      artifacts: [{ id: 'artifact.note', traceId: 'trace.1', label: 'Greek-Infused Desktop Note', kind: 'local_note_safe_artifact', content: 'Apples and Aristotle', metadata: { sourceCapability: 'umg.capability.local_note_file_write', externalActionTaken: false, fileWritePerformed: false, safeAppLocalArtifact: true } }],
      nextSuggestedActions: []
    };
    const graph = buildRuntimeGeometryObserverGraph({ activeSessionSleeve: makeSleeve(), hermesRuntimeResult: result, mode: 'runtime' });
    const capability = graph.nodes.find((node) => node.id === 'capability:umg.capability.local_note_file_write');
    expect(capability?.status).toBe('approval');
    expect(capability?.artifacts.map((artifact) => artifact.label)).toContain('Greek-Infused Desktop Note');
    expect(graph.unmappedEvents).toHaveLength(1);
    expect(graph.nodes.some((node) => node.status !== 'idle' && node.aliases.includes('missing.tool'))).toBe(false);
  });

  it('shows runtime error class from real trace state and unmapped rail in runtime mode helper output', () => {
    const result = { status: 'error', finalOutput: 'error', trace, toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] };
    const graph = buildRuntimeGeometryObserverGraph({ activeSessionSleeve: makeSleeve(), hermesRuntimeResult: result, mode: 'runtime' });
    expect(graph.nodes.find((node) => node.kind === 'sleeve')?.status).toBe('error');
    expect(graph.unmappedEvents[0].reason).toBe('target_not_found');
  });

  it('binds dynamic runtime trace events to structuralIR nodes, route edges, MOLT layers, tools, artifacts, and unmapped rail only by real IDs', () => {
    const dynamicTrace = [
      { traceId: 'trace.dynamic', eventId: 'evt.route', timestamp: 10, eventType: 'route_started', state: 'active', label: 'Route started', targetId: 'sleeve.greek_note', targetType: 'sleeve' },
      { traceId: 'trace.dynamic', eventId: 'evt.edge', timestamp: 11, eventType: 'route_edge_activated', state: 'active', label: 'Route edge active', routeEdgeId: 'edge.capture.to.merge' },
      { traceId: 'trace.dynamic', eventId: 'evt.block', timestamp: 12, eventType: 'neoblock_started', state: 'active', label: 'Block active', targetId: 'block.capture', targetType: 'neoblock' },
      { traceId: 'trace.dynamic', eventId: 'evt.molt', timestamp: 13, eventType: 'molt_layer_used', state: 'processing', label: 'MOLT used', targetId: 'molt.philosophy', targetType: 'molt' },
      { traceId: 'trace.dynamic', eventId: 'evt.merge', timestamp: 14, eventType: 'merge_started', state: 'processing', label: 'Merge active', targetId: 'merge.greek_semantic_frame', targetType: 'merge' },
      { traceId: 'trace.dynamic', eventId: 'evt.gate', timestamp: 15, eventType: 'gate_opened', state: 'active', label: 'Gate opened', targetId: 'gate.approval', targetType: 'gate' },
      { traceId: 'trace.dynamic', eventId: 'evt.tool', timestamp: 16, eventType: 'tool_block_resolved', state: 'processing', label: 'Tool resolved', targetId: 'TOOL.HERMES.NOTE_CREATE.v0.1', targetType: 'tool' },
      { traceId: 'trace.dynamic', eventId: 'evt.file', timestamp: 17, eventType: 'file_created', state: 'complete', label: 'File created', targetId: '/home/neomagnetar/Desktop/apple-haiku.txt', targetType: 'artifact', metadata: { filePath: '/home/neomagnetar/Desktop/apple-haiku.txt' } },
      { traceId: 'trace.dynamic', eventId: 'evt.unknown', timestamp: 18, eventType: 'neoblock_started', state: 'active', label: 'Unknown block', targetId: 'block.unknown', targetType: 'neoblock' }
    ];
    const result = {
      status: 'ok',
      finalOutput: 'done',
      trace: dynamicTrace,
      toolCalls: [],
      blockedCalls: [],
      approvalRequests: [],
      errors: [],
      artifacts: [{ id: 'artifact.apple_haiku', uri: '/home/neomagnetar/Desktop/apple-haiku.txt', label: 'apple-haiku.txt', kind: 'file', content: 'Apples rest in gold', metadata: { filePath: '/home/neomagnetar/Desktop/apple-haiku.txt' } }],
      nextSuggestedActions: []
    };
    const graph = buildRuntimeGeometryObserverGraph({ activeSessionSleeve: makeSleeve(), hermesRuntimeResult: result, mode: 'runtime' });
    expect(graph.nodes.find((node) => node.id === 'sleeve:sleeve.greek_note')?.status).toBe('active');
    expect(graph.nodes.find((node) => node.id === 'neoblock:block.capture')?.status).toBe('active');
    expect(graph.nodes.find((node) => node.sourceId === 'molt.philosophy')?.status).toBe('processing');
    expect(graph.nodes.find((node) => node.id === 'merge:merge.greek_semantic_frame')?.status).toBe('processing');
    expect(['active', 'complete']).toContain(graph.nodes.find((node) => node.id === 'gate:gate.approval')?.status);
    expect(graph.nodes.find((node) => node.id === 'capability:TOOL.HERMES.NOTE_CREATE.v0.1')?.status).toBe('processing');
    expect(graph.edges.find((edge) => edge.id === 'edge.capture.to.merge')?.status).toBe('active');
    expect(graph.nodes.find((node) => node.id === 'artifact:artifact.apple_haiku')?.status).toBe('complete');
    expect(graph.unmappedEvents.map((entry) => entry.event.eventId)).toContain('evt.unknown');
  });

  it('does not mark action_request_created alone as runtime completed', () => {
    const state = deriveRuntimeExecutionState({
      compiledRuntimeManifest: { sleeveId: 'sleeve.greek_note', sleeveTitle: 'Greek Note', compiledAt: 'now', compiledStructure: {}, runtimeInstructions: ['run'], executionPlan: [], gates: [], toolPolicy: { allowedTools: [], blockedTools: [], approvalMode: 'manual', executionMode: 'direct', registry: [] }, sourceBlocks: [], traceMetadata: {} },
      isHermesRunning: false,
      traceCount: 1,
      hermesRuntimeResult: { status: 'ok', finalOutput: 'prepared', trace: [{ traceId: 'trace.dynamic', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' }], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] }
    });
    expect(state).toBe('action_prepared');
  });

  it('requires action_executed plus file/artifact or run_completed before Direct desktop note runtime is completed', () => {
    const manifest = { sleeveId: 'sleeve.greek_note', sleeveTitle: 'Greek Note', compiledAt: 'now', compiledStructure: {}, runtimeInstructions: ['run'], executionPlan: [], gates: [], toolPolicy: { allowedTools: [], blockedTools: [], approvalMode: 'manual', executionMode: 'direct', registry: [] }, sourceBlocks: [], traceMetadata: {} };
    expect(deriveRuntimeExecutionState({ compiledRuntimeManifest: manifest, isHermesRunning: false, traceCount: 2, hermesRuntimeResult: { status: 'ok', finalOutput: 'executed', trace: [{ traceId: 'trace.dynamic', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' }, { traceId: 'trace.dynamic', timestamp: 2, eventType: 'action_executed', state: 'complete', label: 'Action executed' }], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] } })).toBe('action_prepared');
    expect(deriveRuntimeExecutionState({ compiledRuntimeManifest: manifest, isHermesRunning: false, traceCount: 3, hermesRuntimeResult: { status: 'ok', finalOutput: 'created', trace: [{ traceId: 'trace.dynamic', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' }, { traceId: 'trace.dynamic', timestamp: 2, eventType: 'action_executed', state: 'complete', label: 'Action executed' }, { traceId: 'trace.dynamic', timestamp: 3, eventType: 'file_created', state: 'complete', label: 'File created' }], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] } })).toBe('completed');
  });

  it('maps approval-only runtime to awaiting_approval, not completed', () => {
    const state = deriveRuntimeExecutionState({
      compiledRuntimeManifest: { sleeveId: 'sleeve.greek_note', sleeveTitle: 'Greek Note', compiledAt: 'now', compiledStructure: {}, runtimeInstructions: ['run'], executionPlan: [], gates: [], toolPolicy: { allowedTools: [], blockedTools: [], approvalMode: 'beforeToolUse', executionMode: 'approvalRequired', registry: [] }, sourceBlocks: [], traceMetadata: {} },
      isHermesRunning: false,
      traceCount: 1,
      hermesRuntimeResult: { status: 'needsApproval', finalOutput: 'approval required', trace: [{ traceId: 'trace.dynamic', timestamp: 1, eventType: 'action_approval_required', state: 'attention', label: 'Approval required' }], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] }
    });
    expect(state).toBe('awaiting_approval');
  });

  it('maps observe-mode native result to action_prepared instead of completed file action', () => {
    const state = deriveRuntimeExecutionState({
      compiledRuntimeManifest: { sleeveId: 'sleeve.greek_note', sleeveTitle: 'Greek Note', compiledAt: 'now', compiledStructure: {}, runtimeInstructions: ['run'], executionPlan: [], gates: [], toolPolicy: { allowedTools: [], blockedTools: [], approvalMode: 'manual', executionMode: 'dryRun', registry: [] }, sourceBlocks: [], traceMetadata: {} },
      isHermesRunning: false,
      traceCount: 1,
      hermesRuntimeResult: { status: 'ok', finalOutput: 'observed', nativeActionResult: { status: 'observed' }, trace: [{ traceId: 'trace.dynamic', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' }], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] }
    });
    expect(state).toBe('action_prepared');
  });

  it('projects capability/tool ownership under the parent NeoBlock and keeps MOLT internal', () => {
    const sleeve = makeSleeve();
    const manifest = buildRuntimeGeometryManifest({
      templateSleeve: sleeve,
      compiledRuntimeManifest: { sleeveId: sleeve.id, sleeveTitle: sleeve.title, compiledAt: 'now', compiledStructure: {}, runtimeInstructions: ['run'], executionPlan: [], gates: [], toolPolicy: { allowedTools: ['umg.capability.local_note_file_write'], blockedTools: [], approvalMode: 'manual', executionMode: 'direct', registry: [] }, sourceBlocks: [], traceMetadata: {} }
    });
    const tool = manifest.nodes.find((node) => node.kind === 'tool_endpoint' && node.toolId === 'umg.capability.local_note_file_write');
    expect(tool?.parentNeoBlockId).toBe('block.capture');
    expect(tool?.parentNeoStackId).toBe('stack.compose');
    const graph = buildRuntimeGeometryObserverGraph({ activeSessionSleeve: sleeve, geometryManifest: manifest, mode: 'structure' });
    expect(graph.nodes.find((node) => node.id === 'capability:umg.capability.local_note_file_write')?.parentId).toBe('neoblock:block.capture');
    expect(graph.nodes.filter((node) => node.kind === 'molt')).toHaveLength(3);
  });

  it('direct native action execution invokes native bridge and produces action/file/artifact terminal trace', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        actionId: 'native_action_test',
        capabilityId: 'umg.native.hermes.note_create',
        mode: 'direct',
        status: 'executed',
        externalActionTaken: true,
        summary: 'Created note file.',
        traceEvents: [
          { traceId: 'trace.native', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' },
          { traceId: 'trace.native', timestamp: 2, eventType: 'action_executed', state: 'complete', label: 'Action executed' },
          { traceId: 'trace.native', timestamp: 3, eventType: 'file_created', state: 'complete', label: 'File created' },
          { traceId: 'trace.native', timestamp: 4, eventType: 'artifact_created', state: 'complete', label: 'Artifact created' },
          { traceId: 'trace.native', timestamp: 5, eventType: 'run_completed', state: 'complete', label: 'Run completed' }
        ],
        artifacts: [{ path: '/tmp/apple-haiku.txt' }],
        diagnostics: { elapsedMs: 10 }
      })
    });
    const result = await runNativeHermesAction({
      config: { enabled: true, endpoint: 'http://127.0.0.1:8788/api/hermes/runtime', timeoutMs: 60000 },
      request: { actionId: 'native_action_test', capabilityId: 'umg.native.hermes.note_create', mode: 'direct', risk: 'low', prompt: 'Create a haiku note about apples and save it to my desktop.', traceId: 'trace.native', userApproved: true }
    });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8788/api/hermes/native-action', expect.any(Object));
    expect(result.runtimeResult.trace.map((event) => event.eventType)).toEqual(expect.arrayContaining(['action_executed', 'file_created', 'artifact_created', 'run_completed']));
    expect(result.runtimeResult.status).toBe('ok');
  });

  it('normalizes compiled stack orderedBlockIds to NeoBlock IDs, not MOLT IDs', () => {
    const request = createCompilerRequest({
      id: 'compiler_input_test',
      compileCandidateId: 'candidate.test',
      assemblyPlanId: 'assembly.test',
      sleeveId: 'sleeve.greek_note',
      sleeveTitle: 'Greek Note',
      normalizedStructure: makeSleeve(),
      gates: [],
      activeStates: {},
      disabledStates: {},
      executionOrder: ['molt.instruction', 'molt.subject'],
      requiredTools: [],
      approvalPoints: [],
      runtimeInstructions: ['run'],
      sourceBlocks: ['molt.instruction', 'molt.subject'],
      traceMetadata: {},
      metadata: {}
    });
    const result = normalizeCompilerResponseToManifest({ ok: true, result: { runtime: { sleeveId: 'sleeve.greek_note', sleeveName: 'Greek Note', promptSpec: { neoBlockPrompts: [] }, stacks: [{ id: 'stack.compose', orderedBlockIds: ['molt.instruction', 'molt.subject'] }] } } }, request);
    expect(result.status).toBe('ok');
    expect(result.manifest.executionPlan.map((step) => step.targetId)).toEqual(['block.capture']);
    expect(result.manifest.compiledStructure.stacks[0].orderedBlockIds).toEqual(['block.capture']);
  });

  it('keeps the Runtime bottom drawer collapsed by default', () => {
    const html = renderObserver();
    expect(html).toContain('runtime-bottom-drawer');
    expect(html).not.toContain('runtime-bottom-drawer--open');
  });

  it('shows selected native action mode help in Runtime Graph', () => {
    const html = renderObserver({ nativeActionMode: 'direct' });
    expect(html).toContain('Selected action mode: Direct');
    expect(html).toContain('Direct: executes allowed native Hermes actions');
  });
});
