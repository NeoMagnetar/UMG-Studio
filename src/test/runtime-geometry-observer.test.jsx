import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RuntimeGeometryObserver, buildRuntimeGeometryObserverGraph } from '../components/RuntimeGeometryObserver';

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
  it('renders the active Sleeve title and runtime-session-only warning without source-library controls', () => {
    const html = renderObserver();
    expect(html).toContain('Greek-Infused Desktop Note Creator');
    expect(html).toContain('Runtime-session only');
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
});
