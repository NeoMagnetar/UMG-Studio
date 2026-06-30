import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RuntimeGeometryObserver, buildRuntimeVisualViewModel } from '../components/RuntimeGeometryObserver';

function makeSleeve() {
  return {
    id: 'sleeve.greek_note',
    title: 'Greek Philosophy Desktop Note Sleeve',
    version: '0.1',
    templateKind: 'custom',
    source: 'runtime_session',
    description: 'Creates desktop notes with Greek philosophy.',
    tags: ['runtime-session'],
    governanceBlockIds: [],
    neoStacks: [
      { id: 'stack.note_capture', title: 'Note Capture', description: 'Capture the requested note.', blockIds: ['block.request_intake'], stackOrder: 0, tags: [] },
      { id: 'stack.philosophical_framing', title: 'Philosophical Framing', description: 'Apply Greek philosophy.', blockIds: ['block.philosophy_alignment'], stackOrder: 1, tags: [] },
      { id: 'stack.desktop_rendering', title: 'Desktop Note Rendering', description: 'Prepare local note artifact.', blockIds: ['block.output_assembly'], stackOrder: 2, tags: [] }
    ],
    neoBlocks: [
      { id: 'block.request_intake', title: 'Request Intake NeoBlock', description: 'Capture prompt and context.', neoStackId: 'stack.note_capture', moltBlockIds: ['molt.directive', 'molt.instruction'], gateIds: ['gate.approval'], blockOrder: 0, tags: [] },
      { id: 'block.philosophy_alignment', title: 'Philosophy Alignment NeoBlock', description: 'Greek philosophical lens.', neoStackId: 'stack.philosophical_framing', moltBlockIds: ['molt.subject', 'molt.philosophy'], gateIds: [], blockOrder: 1, tags: [] },
      { id: 'block.output_assembly', title: 'Output Assembly NeoBlock', description: 'Draft safe local artifact.', neoStackId: 'stack.desktop_rendering', moltBlockIds: ['molt.primary', 'molt.blueprint'], gateIds: [], blockOrder: 2, tags: [] }
    ],
    moltBlocks: [
      { id: 'molt.directive', title: 'Directive Layer', role: 'directive', summary: 'Always incorporate Greek philosophy.', content: 'Always incorporate Greek philosophy.', stackOrder: 0, tags: [] },
      { id: 'molt.instruction', title: 'Instruction Layer', role: 'instruction', summary: 'Write a note.', content: 'Write a note.', stackOrder: 1, tags: [] },
      { id: 'molt.subject', title: 'Subject Layer', role: 'subject', summary: 'Apples.', content: 'Apples.', stackOrder: 2, tags: [] },
      { id: 'molt.primary', title: 'Primary Layer', role: 'primary', summary: 'Coherent useful note.', content: 'Coherent useful note.', stackOrder: 3, tags: [] },
      { id: 'molt.philosophy', title: 'Philosophy Layer', role: 'philosophy', summary: 'Aristotle and Stoicism.', content: 'Aristotle and Stoicism.', stackOrder: 4, tags: [] },
      { id: 'molt.blueprint', title: 'Blueprint Layer', role: 'blueprint', summary: 'Markdown note artifact.', content: 'Markdown note artifact.', stackOrder: 5, tags: [] }
    ],
    gates: [{ id: 'gate.approval', title: 'Approval Boundary', sourceId: 'gate.approval', attachesTo: { kind: 'neoblock', id: 'block.request_intake' }, triggerType: 'user_intent', conditionText: 'Require approval before file write.', action: 'activate', targetIds: ['block.output_assembly'], defaultState: 'closed', runtimeState: 'inactive', tags: [] }],
    metadata: { runtimeSessionOnly: true, capabilities: [{ capabilityId: 'umg.capability.local_note_file_write', label: 'Local note safe artifact', sourceNeoBlock: 'block.output_assembly' }] }
  };
}

const compiledRuntimeManifest = {
  sleeveId: 'sleeve.greek_note',
  sleeveTitle: 'Greek Philosophy Desktop Note Sleeve',
  compiledStructure: { source: 'test' },
  runtimeInstructions: ['Use UMG route IDs.'],
  executionPlan: [{ id: 'step.request', label: 'Request Intake', targetId: 'block.request_intake', requiredGateIds: [], requiredToolIds: ['umg.capability.local_note_file_write'] }],
  gates: [],
  toolPolicy: { executionMode: 'dryRun', approvalMode: 'beforeToolUse', allowedTools: ['umg.capability.local_note_file_write'], blockedTools: [] },
  sourceBlocks: [{ id: 'block.request_intake', title: 'Request Intake NeoBlock', scopeKind: 'neoblock' }],
  routeEdges: [{ id: 'route.request.output', fromId: 'block.request_intake', toId: 'block.output_assembly', fromType: 'neoblock', toType: 'neoblock' }],
  structuralIR: makeSleeve().metadata.structuralIR,
  traceMetadata: { dynamicRoutingPrepared: true }
};

const trace = [
  { traceId: 'trace.greek', timestamp: 1, eventType: 'neoblock_started', state: 'active', neoBlockId: 'block.request_intake', label: 'Request Intake started' },
  { traceId: 'trace.greek', timestamp: 2, eventType: 'approval_granted', state: 'complete', approvalId: 'approval.umg.capability.local_note_file_write', label: 'Approval granted' },
  { traceId: 'trace.greek', timestamp: 3, eventType: 'tool_result_received', state: 'complete', toolId: 'umg.capability.local_note_file_write', label: 'Safe artifact prepared' },
  { traceId: 'trace.greek', timestamp: 4, eventType: 'molt_role_used', state: 'processing', moltBlockId: 'molt.philosophy', label: 'Philosophy layer used' },
  { traceId: 'trace.greek', timestamp: 5, eventType: 'tool_call_executed', state: 'complete', toolId: 'missing.tool', label: 'Unmapped tool' }
];

const result = {
  status: 'needsApproval',
  finalOutput: 'approval required',
  trace,
  toolCalls: [],
  blockedCalls: [],
  approvalRequests: [],
  errors: [],
  artifacts: [{ id: 'artifact.note', traceId: 'trace.greek', label: 'Greek Apple Note Artifact', kind: 'local_note_safe_artifact', content: 'Apples through Aristotle.', metadata: { sourceCapability: 'umg.capability.local_note_file_write', externalActionTaken: false, fileWritePerformed: false } }],
  nextSuggestedActions: []
};

function renderObserver(extra = {}) {
  return render(<RuntimeGeometryObserver
    activeSessionSleeve={makeSleeve()}
    runtimePrompt="WRITE A NOTE ON MY DESKTOP ABOUT APPLES"
    onRuntimePromptChange={() => {}}
    onRunHermesRuntime={() => {}}
    onContinueRuntimeApproval={() => {}}
    onBackToBuilder={() => {}}
    compileStatus="Compile succeeded"
    runtimeStatus="needsApproval"
    isHermesRunning={false}
    hermesRuntimeResult={result}
    pendingRuntimeApproval={{ traceId: 'trace.greek', approvalId: 'approval.local', capabilityId: 'umg.capability.local_note_file_write', requestedAction: 'local note safe artifact', riskLevel: 'medium', reason: 'Desktop write requires approval' }}
    {...extra}
  />);
}

describe('Phase 13I-H runtime graph visual redesign', () => {
  it('builds a NeoBlock-level runtime path and keeps MOLT as internal layers', () => {
    const model = buildRuntimeVisualViewModel({ activeSessionSleeve: makeSleeve(), hermesRuntimeResult: result, mode: 'runtime_path' });
    expect(model.pathNodes.every((node) => node.kind !== 'molt_layer')).toBe(true);
    expect(model.pathNodes.map((node) => node.kind)).toEqual(expect.arrayContaining(['neoblock', 'gate', 'capability']));
    expect(model.neoBlockLayers.get('block.philosophy_alignment').map((node) => node.kind)).toEqual(['molt_layer', 'molt_layer']);
    expect(model.unmappedEvents).toHaveLength(1);
    expect(model.nodes.find((node) => node.id === 'molt:molt.philosophy')?.status).toBe('processing');
  });

  it('renders graph-first tabs, rails, foundation rail, and bottom drawer without source-library controls', () => {
    renderObserver();
    expect(screen.getByRole('button', { name: 'System Sleeve' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'NeoStack View' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'NeoBlock View' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Runtime Path' })).toBeTruthy();
    expect(screen.getByLabelText('Runtime hierarchy rail')).toBeTruthy();
    expect(screen.getByLabelText('Runtime trace and artifact rail')).toBeTruthy();
    expect(screen.getByText('source library')).toBeTruthy();
    expect(screen.getByText('compiler manifest')).toBeTruthy();
    expect(screen.getByText('Hermes runtime')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'JSON' })).toBeTruthy();
    expect(screen.queryByText('Save to Source Library')).toBeNull();
  });

  it('shows System Sleeve clusters, NeoStack hierarchy, NeoBlock cube layers, and non-blank MOLT details', () => {
    renderObserver();
    expect(screen.getAllByText('Note Capture').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Philosophical Framing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Desktop Note Rendering').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'NeoStack View' }));
    expect(screen.getByText('Selected NeoStack hierarchy')).toBeTruthy();
    expect(screen.getAllByText('Request Intake NeoBlock').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'NeoBlock View' }));
    expect(screen.getByText('Compressed MOLT layers')).toBeTruthy();
    expect(screen.getByText('Directive')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Directive Layer/ }));
    expect(screen.getByText('MOLT detail')).toBeTruthy();
    expect(screen.getByText('Always incorporate Greek philosophy.')).toBeTruthy();
  });

  it('renders Runtime Path as NeoBlock/control/capability graph with honest unmapped events and artifacts', () => {
    renderObserver();
    fireEvent.click(screen.getByRole('button', { name: 'Runtime Path' }));
    const surface = screen.getByLabelText('Runtime graph surface');
    expect(within(surface).getByText('Request Intake NeoBlock')).toBeTruthy();
    expect(within(surface).getByText('Approval Boundary')).toBeTruthy();
    expect(within(surface).getByText('umg.capability.local_note_file_write')).toBeTruthy();
    expect(within(surface).queryByText('Directive Layer')).toBeNull();
    expect(screen.getByText('Unmapped Events')).toBeTruthy();
    expect(screen.getByText('missing.tool · target_not_found')).toBeTruthy();
    expect(screen.getAllByText('Greek Apple Note Artifact').length).toBeGreaterThan(0);
    expect(screen.getByText('Approval boundary active')).toBeTruthy();
  });

  it('submits the runtime prompt with Enter, keeps Shift+Enter as newline, and labels the button Send to Hermes', () => {
    const onRunHermesRuntime = vi.fn();
    renderObserver({ compiledRuntimeManifest, hermesRuntimeResult: undefined, pendingRuntimeApproval: undefined, runtimePrompt: 'draft a file', onRunHermesRuntime });
    expect(screen.getByRole('button', { name: 'Send to Hermes' })).toBeTruthy();
    const prompt = screen.getByLabelText('Runtime prompt');
    fireEvent.keyDown(prompt, { key: 'Enter', code: 'Enter', shiftKey: true });
    expect(onRunHermesRuntime).not.toHaveBeenCalled();
    fireEvent.keyDown(prompt, { key: 'Enter', code: 'Enter' });
    expect(onRunHermesRuntime).toHaveBeenCalledTimes(1);
  });

  it('does not submit empty prompts and disables execution before compile', () => {
    const onRunHermesRuntime = vi.fn();
    renderObserver({ compiledRuntimeManifest: undefined, hermesRuntimeResult: undefined, pendingRuntimeApproval: undefined, runtimePrompt: '   ', onRunHermesRuntime, compileStatus: 'Structure view is available. Runtime execution requires compile.', runtimeStatus: 'compiling_required' });
    const send = screen.getByRole('button', { name: 'Send to Hermes' });
    expect(send.disabled).toBe(true);
    fireEvent.keyDown(screen.getByLabelText('Runtime prompt'), { key: 'Enter', code: 'Enter' });
    expect(onRunHermesRuntime).not.toHaveBeenCalled();
    expect(screen.getAllByText('compiling_required').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Structure view is available. Runtime execution requires compile.').length).toBeGreaterThan(0);
  });

  it('shows runtime execution state transitions and compiler bridge setup copy', () => {
    renderObserver({ compiledRuntimeManifest: undefined, hermesRuntimeResult: undefined, pendingRuntimeApproval: undefined, compileStatus: 'Compiler bridge not connected. Start it with: npm run umg:compiler-bridge', runtimeStatus: 'compiling_required' });
    expect(screen.getByText('Compiler bridge not connected. Start it with: npm run umg:compiler-bridge')).toBeTruthy();
    expect(screen.getByText('Starting route: compile required')).toBeTruthy();
  });

  it('shows working and returned-trace graph state without fake trace activation', () => {
    renderObserver({ compiledRuntimeManifest, hermesRuntimeResult: undefined, pendingRuntimeApproval: undefined, isHermesRunning: true, runtimeStatus: 'Hermes working…' });
    expect(screen.getByText('sending')).toBeTruthy();
    expect(screen.getAllByText('Hermes working…').length).toBeGreaterThan(0);
    expect(screen.getByText('Starting route · Waiting for trace')).toBeTruthy();
  });

  it('shows running state once real returned trace events are present', () => {
    renderObserver({ compiledRuntimeManifest, isHermesRunning: true, runtimeStatus: 'Hermes working…' });
    expect(screen.getByText('running')).toBeTruthy();
    expect(screen.getByText('Running')).toBeTruthy();
  });

  it('keeps MOLT as internal layers and exposes compact MOLT rows', () => {
    renderObserver();
    fireEvent.click(screen.getByRole('button', { name: 'NeoBlock View' }));
    expect(screen.getByText('Directive')).toBeTruthy();
    expect(screen.getByText('Instruction')).toBeTruthy();
    expect(screen.getByText('Subject')).toBeTruthy();
    expect(screen.getByText('Primary')).toBeTruthy();
    expect(screen.getByText('Philosophy')).toBeTruthy();
    expect(screen.getByText('Blueprint')).toBeTruthy();
    expect(screen.getByText('Merge')).toBeTruthy();
    expect(screen.getByText('Tool')).toBeTruthy();
    expect(screen.getByText('Gate')).toBeTruthy();
    expect(screen.getByText(/MOLT details stay in drawer/)).toBeTruthy();
  });
});
