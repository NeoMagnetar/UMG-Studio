import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { RuntimeGeometryObserver, buildRuntimeCognitiveTopology, buildRuntimeGeometryObserverGraph, buildRuntimeVisualViewModel, deriveRuntimeExecutionState } from '../components/RuntimeGeometryObserver';
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


function makeCompiledManifest(overrides = {}) {
  return {
    sleeveId: 'sleeve.greek_note',
    sleeveTitle: 'Greek Note',
    compiledAt: 'now',
    compiledStructure: {},
    runtimeInstructions: ['run'],
    executionPlan: [],
    gates: [],
    toolPolicy: { allowedTools: [], blockedTools: [], approvalMode: 'manual', executionMode: 'dryRun', registry: [] },
    sourceBlocks: [],
    traceMetadata: {},
    ...overrides
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

function renderInteractiveObserver(extra = {}) {
  return rtlRender(<RuntimeGeometryObserver
    activeSessionSleeve={makeSleeve()}
    runtimePrompt="write a note on my desktop about apples"
    onRuntimePromptChange={() => {}}
    onRunHermesRuntime={() => {}}
    onContinueRuntimeApproval={() => {}}
    onBackToBuilder={() => {}}
    compileStatus="Compile succeeded"
    runtimeStatus="Hermes ready"
    isHermesRunning={false}
    {...extra}
  />);
}

describe('RuntimeGeometryObserver', () => {
  afterEach(() => {
    cleanup();
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

  it('Sleeve Overview view does not render source library/compiler manifest/Hermes runtime/resource graph nodes', () => {
    renderInteractiveObserver();
    expect(screen.queryByRole('button', { name: 'Show context resources' })).toBeNull();
    expect(screen.queryByRole('button', { name: /source library/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /compiler manifest/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hermes runtime/i })).toBeNull();
    expect(screen.queryByText(/context resource/i)).toBeNull();
    expect(document.querySelectorAll('.runtime-node--resource, .runtime-node--context, .runtime-foundation-item')).toHaveLength(0);
  });

  it('NeoStack Map renders NeoStack nodes only', () => {
    renderInteractiveObserver();
    fireEvent.click(screen.getByRole('button', { name: 'NeoStack Map' }));
    expect(screen.getByLabelText('NeoStack-only runtime graph')).toBeTruthy();
    expect(document.querySelectorAll('.runtime-stack-node')).toHaveLength(1);
    expect(document.querySelectorAll('.runtime-neoblock-tile, .runtime-neoblock-module, .runtime-molt-layer, .runtime-node--resource, .runtime-node--context')).toHaveLength(0);
  });

  it('NeoBlock Map renders NeoBlock nodes only and does not render MOLT rows as graph cards', () => {
    renderInteractiveObserver();
    fireEvent.click(screen.getByRole('button', { name: 'NeoBlock Map' }));
    expect(screen.getByLabelText('All NeoBlocks by NeoStack')).toBeTruthy();
    expect(document.querySelectorAll('.runtime-neoblock-module')).toHaveLength(1);
    expect(document.querySelectorAll('.runtime-stack-node, .runtime-molt-layer, .runtime-node--molt_layer, .runtime-node--resource, .runtime-node--context')).toHaveLength(0);
    expect(screen.queryByText('Instruction')).toBeNull();
  });

  it('NeoBlock Map renders the structural NeoBlock route without runtime trace', () => {
    renderInteractiveObserver();
    fireEvent.click(screen.getByRole('button', { name: 'NeoBlock Map' }));
    expect(screen.getByText('Structural route of all NeoBlocks across all NeoStacks. Runtime trace is not required.')).toBeTruthy();
    expect(screen.getByLabelText('All NeoBlocks by NeoStack')).toBeTruthy();
    expect(screen.getAllByText('Capture and Draft Note').length).toBeGreaterThan(0);
    expect(screen.getByText('NeoBlock inspector')).toBeTruthy();
    expect(screen.getByText('MOLT child count')).toBeTruthy();
    expect(screen.getByText('source-bound count')).toBeTruthy();
    expect(screen.getByText(/View all MOLT/)).toBeTruthy();
  });

  it('uses corrected graph labels, MOLT Block terminology, and pan/zoom controls', () => {
    renderInteractiveObserver();
    expect(screen.getByRole('button', { name: 'Sleeve Overview' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'System Sleeve' })).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Runtime trace and artifact rail' }).textContent).toContain('Runtime Inspector');
    expect(screen.queryByText('Runtime Rail')).toBeNull();
    expect(screen.getByText(/3 MOLT Blocks/)).toBeTruthy();
    expect(screen.queryByText(/MOLT Layers/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Fit graph' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset graph' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Zoom in/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Zoom out/i })).toBeNull();
  });

  it('NeoBlock Map cards show MOLT Block counts and share graph-card styling', () => {
    renderInteractiveObserver();
    fireEvent.click(screen.getByRole('button', { name: 'NeoBlock Map' }));
    const blockCard = document.querySelector('.runtime-neoblock-module');
    expect(blockCard?.className).toContain('runtime-map-card');
    expect(blockCard?.textContent).toContain('3 MOLT Blocks');
    expect(blockCard?.textContent).not.toContain('0 NeoBlocks');
  });

  it('Runtime graph surface supports wheel zoom and drag pan state', () => {
    renderInteractiveObserver();
    const surface = screen.getByLabelText('Runtime graph surface');
    fireEvent.wheel(surface, { deltaY: -100 });
    expect(screen.getByText('108%')).toBeTruthy();
    fireEvent.mouseDown(surface, { button: 0, clientX: 10, clientY: 10 });
    expect(surface.className).toContain('runtime-graph-surface--dragging');
    fireEvent.mouseMove(surface, { clientX: 40, clientY: 25 });
    fireEvent.mouseUp(surface);
    expect(surface.className).not.toContain('runtime-graph-surface--dragging');
  });

  it('Runtime Path stays idle and shows the no-trace message until Hermes emits a trace', () => {
    renderInteractiveObserver();
    fireEvent.click(screen.getByRole('button', { name: 'Runtime Path' }));
    expect(screen.getByText('No runtime trace yet. Send a task to Hermes to activate the route.')).toBeTruthy();
    expect(screen.getByText('Planned route skeleton is shown idle until a real Hermes trace arrives.')).toBeTruthy();
    expect(document.querySelectorAll('.runtime-node--active, .runtime-map-edge--glow')).toHaveLength(0);
  });

  it('left Sleeve hierarchy is collapsed by default and resources remain in diagnostics drawer', () => {
    renderInteractiveObserver();
    expect(screen.getByRole('button', { name: 'Open hierarchy' })).toBeTruthy();
    expect(screen.queryByText('Sleeve hierarchy')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));
    expect(screen.getByText(/source library/i)).toBeTruthy();
    expect(screen.getByText(/compiler manifest/i)).toBeTruthy();
    expect(screen.getAllByText(/Hermes runtime/i).length).toBeGreaterThan(0);
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


  it('keeps Hermes Chat out of the Runtime Graph surface and exposes a Hermes Terminal drawer tab', () => {
    renderInteractiveObserver({ compiledRuntimeManifest: makeCompiledManifest() });
    const graphSurface = screen.getByLabelText('Runtime graph surface');
    expect(graphSurface.textContent).not.toContain('Hermes Chat');
    expect(graphSurface.textContent).not.toContain('Runtime prompt');
    expect(graphSurface.textContent).not.toContain('Hermes Work Log / Terminal');
    expect(screen.queryByLabelText('Hermes Chat')).toBeNull();
    expect(screen.getByRole('button', { name: 'Hermes Terminal' })).toBeTruthy();
  });

  it('Hermes Terminal drawer renders runtime prompt and appends a user prompt when sending', () => {
    const onRun = vi.fn();
    renderInteractiveObserver({ compiledRuntimeManifest: makeCompiledManifest(), onRunHermesRuntime: onRun });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    expect(screen.getByLabelText('Hermes Terminal drawer')).toBeTruthy();
    expect(screen.getByLabelText('Runtime prompt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send to Hermes' }));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('write a note on my desktop about apples').length).toBeGreaterThan(1);
  });

  it('Hermes Terminal default view hides debug fields and premature missing capability card', () => {
    renderInteractiveObserver({ compiledRuntimeManifest: makeCompiledManifest() });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    const drawer = screen.getByLabelText('Hermes Terminal drawer');
    expect(drawer.textContent).toContain('No runtime request yet. Send a prompt to Hermes.');
    expect(screen.queryByLabelText('Missing capability detected')).toBeNull();
    const chatPanel = screen.getByLabelText('Hermes Chat');
    expect(chatPanel.textContent).not.toContain('thought summary');
    expect(chatPanel.textContent).not.toContain('last NL');
    expect(chatPanel.textContent).not.toContain('last error');
    expect(chatPanel.textContent).not.toContain('tool access');
    expect(chatPanel.textContent).not.toContain('Visible transcript only');
    expect(screen.getByRole('group', { name: 'Runtime Debug' })).toBeTruthy();
  });

  it('runtime response with finalOutput appends a visible Hermes message in the drawer transcript', async () => {
    renderInteractiveObserver({
      compiledRuntimeManifest: makeCompiledManifest(),
      hermesRuntimeResult: { status: 'ok', finalOutput: 'I can draft the ServUO item script, but file edit needs approval.', trace: [], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    await waitFor(() => expect(screen.getAllByText('I can draft the ServUO item script, but file edit needs approval.').length).toBeGreaterThan(0));
  });

  it('action_prepared with no natural-language response appends transparent system and Observe explanation messages in the drawer', async () => {
    renderInteractiveObserver({
      compiledRuntimeManifest: makeCompiledManifest(),
      nativeActionMode: 'observe',
      hermesRuntimeResult: { status: 'ok', finalOutput: '', trace: [{ traceId: 'trace.action', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' }], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    await waitFor(() => expect(screen.getByText('Hermes prepared an action but did not return a natural-language response.')).toBeTruthy());
    expect(screen.getAllByText(/Action prepared\. Observe mode prepares the route only/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Runtime graph surface').textContent).not.toContain('Observe mode prepares the route only');
  });

  it('Work Log shows compact trace events in the drawer without dumping raw JSON by default', () => {
    renderInteractiveObserver({
      compiledRuntimeManifest: makeCompiledManifest(),
      hermesRuntimeResult: { status: 'ok', finalOutput: 'prepared', trace: [{ traceId: 'trace.action', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' }], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    expect(screen.getByRole('group', { name: 'Hermes Work Log / Terminal' })).toBeTruthy();
    expect(screen.getAllByText('action_request_created').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Action request created').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.runtime-work-log-rows details').length).toBeGreaterThan(0);
    expect(document.querySelector('.runtime-work-log-rows pre')).toBeNull();
  });

  it('Missing capability card can request a workspace MOLT draft from Block Forge integration inside the drawer', () => {
    const onDraft = vi.fn();
    renderInteractiveObserver({
      compiledRuntimeManifest: makeCompiledManifest(),
      runtimePrompt: 'Make me a dagger with 1000 deadly poison charges.',
      hermesRuntimeResult: { status: 'ok', finalOutput: 'prepared', trace: [{ traceId: 'trace.action', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' }], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] },
      onDraftMissingMoltBlock: onDraft
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    expect(screen.queryByLabelText('Missing capability detected')).toBeNull();
    cleanup();
    renderInteractiveObserver({
      compiledRuntimeManifest: makeCompiledManifest(),
      runtimePrompt: 'Make me a dagger with 1000 deadly poison charges.',
      hermesRuntimeResult: { status: 'ok', finalOutput: 'prepared', trace: [{ traceId: 'trace.action', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' }], toolCalls: [], blockedCalls: [{ toolId: 'umg.native.project_file_edit', toolName: 'project file edit', status: 'blocked', error: 'missing capability' }], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] },
      onDraftMissingMoltBlock: onDraft
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    expect(screen.getByLabelText('Missing capability detected')).toBeTruthy();
    expect(screen.getByText('ServUO Item Script Creation Tool Requirement')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Draft MOLT Block' }));
    expect(onDraft).toHaveBeenCalledWith('Create MOLT Block: ServUO Item Script Creation Tool Requirement');
  });

  it('Graph trace remains separate from drawer chat transcript messages', async () => {
    renderInteractiveObserver({
      compiledRuntimeManifest: makeCompiledManifest(),
      hermesRuntimeResult: { status: 'ok', finalOutput: 'Hermes says hello.', trace: [{ traceId: 'trace.action', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' }], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    await waitFor(() => expect(screen.getAllByText('Hermes says hello.').length).toBeGreaterThan(0));
    expect(screen.getByLabelText('Hermes Chat').textContent).toContain('Hermes says hello.');
    expect(screen.getByRole('complementary', { name: 'Runtime trace and artifact rail' }).textContent).toContain('Action request created');
    expect(screen.getByLabelText('Runtime graph surface').textContent).not.toContain('Hermes says hello.');
  });


  it('Hermes Terminal renders split left transcript and right Hermes Response pane with no response placeholder', () => {
    renderInteractiveObserver({ compiledRuntimeManifest: makeCompiledManifest() });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    expect(screen.getByLabelText('Hermes transcript and prompt')).toBeTruthy();
    expect(screen.getByLabelText('Hermes Response')).toBeTruthy();
    expect(screen.getByText('No Hermes response yet.')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Hermes Work Log / Terminal' })).toBeTruthy();
    expect(document.querySelector('.runtime-work-log-panel')?.hasAttribute('open')).toBe(false);
  });

  it('Hermes Response pane shows the latest Hermes/system response after runtime result', async () => {
    renderInteractiveObserver({
      compiledRuntimeManifest: makeCompiledManifest(),
      hermesRuntimeResult: { status: 'ok', finalOutput: 'Visible response belongs in the right pane.', trace: [], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    await waitFor(() => expect(screen.getByLabelText('Hermes Response').textContent).toContain('Visible response belongs in the right pane.'));
  });

  it('renders persistent Action Mode control and selecting mode updates runtime action mode state', () => {
    const onMode = vi.fn();
    renderInteractiveObserver({ compiledRuntimeManifest: makeCompiledManifest(), nativeActionMode: 'observe', onNativeActionModeChange: onMode });
    const control = screen.getByLabelText('Action Mode');
    expect(control.textContent).toContain('Observe');
    expect(control.textContent).toContain('Approval');
    expect(control.textContent).toContain('Direct');
    fireEvent.click(screen.getByRole('button', { name: 'Approval' }));
    expect(onMode).toHaveBeenCalledWith('approval');
    expect(screen.getByText('Graph Mode')).toBeTruthy();
    expect(screen.getByText('Action Mode')).toBeTruthy();
  });

  it('Observe mode prepares without external execution artifacts when only an action request is returned', () => {
    renderInteractiveObserver({
      compiledRuntimeManifest: makeCompiledManifest(),
      nativeActionMode: 'observe',
      hermesRuntimeResult: { status: 'ok', finalOutput: '', nativeActionResult: { status: 'observed', externalActionTaken: false }, trace: [{ traceId: 'trace.action', timestamp: 1, eventType: 'action_request_created', state: 'processing', label: 'Action request created' }], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [], artifacts: [], nextSuggestedActions: [] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    expect(screen.getByLabelText('Hermes Response').textContent).toContain('externalActionTaken remains false');
    expect(screen.getByLabelText('Hermes Response').textContent).toContain('artifacts0');
  });

  it('cognitive topology creates multiple x positions for semantic NeoStack and NeoBlock branches without fake dependency edges', () => {
    const nodes = [
      { id: 'stack.intake', kind: 'neostack', label: 'Prompt Intake', icon: '▦', status: 'idle' },
      { id: 'stack.source', kind: 'neostack', label: 'Source Library Read', icon: '▦', status: 'idle' },
      { id: 'stack.domain', kind: 'neostack', label: 'Domain Model Parse', icon: '▦', status: 'idle' },
      { id: 'stack.compose', kind: 'neostack', label: 'NeoBlock Composer Plan', icon: '▦', status: 'idle' },
      { id: 'stack.validate', kind: 'neostack', label: 'Validate Review', icon: '▦', status: 'idle' },
      { id: 'stack.report', kind: 'neostack', label: 'Artifact Report', icon: '▦', status: 'idle' }
    ];
    const positioned = buildRuntimeCognitiveTopology(nodes, []);
    const multiNodeRow = Array.from(positioned.reduce((rows, node) => rows.set(node.layout.y, [...(rows.get(node.layout.y) ?? []), node.layout.x]), new Map()).values()).find((xs) => new Set(xs).size > 1);
    expect(multiNodeRow).toBeTruthy();
    expect(positioned.every((node) => node.metadata.layoutEvidence.inferredOnly)).toBe(true);
    expect(positioned.every((node) => node.metadata.layoutEvidence.dependency !== 'explicit')).toBe(true);
  });

  it('NeoStack and NeoBlock view models expose topology evidence metadata for inspector rendering', () => {
    const model = buildRuntimeVisualViewModel({ activeSessionSleeve: makeSleeve(), compiledRuntimeManifest: makeCompiledManifest(), mode: 'neoblock' });
    expect(model.neoStacks[0].metadata.layoutEvidence.source).toMatch(/semantic phase|fallback order|explicit dependency/);
    expect(model.neoBlocks[0].metadata.layoutEvidence.phase).toBeTruthy();
    expect(model.edges.every((edge) => edge.kind !== 'fallback')).toBe(true);
  });

  it('keeps the Runtime bottom drawer collapsed by default', () => {
    const html = renderObserver();
    expect(html).toContain('runtime-bottom-drawer');
    expect(html).not.toContain('runtime-bottom-drawer--open');
  });

  it('shows selected native action mode help in the Hermes Terminal drawer', () => {
    renderInteractiveObserver({ nativeActionMode: 'direct' });
    fireEvent.click(screen.getByRole('button', { name: 'Hermes Terminal' }));
    expect(screen.getByText(/Selected action mode: Direct/)).toBeTruthy();
    expect(screen.getByText(/Direct: executes allowed native Hermes actions/)).toBeTruthy();
  });
});
