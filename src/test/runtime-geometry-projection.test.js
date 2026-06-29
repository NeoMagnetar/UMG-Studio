import { describe, expect, it } from 'vitest';
import { getBusinessAutomationCoreSleeve } from '../lib/umg/businessAutomationCoreSleeve';
import {
  applyRuntimeStateToGeometryManifest,
  buildRuntimeGeometryManifest,
  summarizeGeometryManifest
} from '../lib/umg/runtimeGeometryProjection';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('runtime geometry projection', () => {
  it('projects the Business Automation Sleeve into a geometry manifest', () => {
    const sleeve = getBusinessAutomationCoreSleeve();
    const manifest = buildRuntimeGeometryManifest({ templateSleeve: sleeve, generatedAt: '2026-06-29T00:00:00.000Z' });
    const summary = summarizeGeometryManifest(manifest);

    expect(summary.totalSleeves).toBe(1);
    expect(summary.totalNeoStacks).toBe(8);
    expect(summary.totalNeoBlocks).toBe(48);
    expect(summary.totalMoltBindings).toBeGreaterThan(144);
    expect(summary.totalGates).toBe(48);
    expect(summary.totalToolEndpoints).toBe(0);
    expect(manifest.nodes.some((node) => node.kind === 'sleeve' && node.sleeveId === sleeve.id)).toBe(true);
  });

  it('creates hierarchy and control connections without activating nodes', () => {
    const sleeve = getBusinessAutomationCoreSleeve();
    const manifest = buildRuntimeGeometryManifest({ templateSleeve: sleeve });

    expect(manifest.connections.some((edge) => edge.type === 'hierarchy' && edge.sourceNodeId === `sleeve:${sleeve.id}` && edge.targetNodeId === 'neostack:S.01')).toBe(true);
    expect(manifest.connections.some((edge) => edge.type === 'hierarchy' && edge.sourceNodeId === 'neostack:S.01' && edge.targetNodeId === 'neoblock:N.BIZ.01.01')).toBe(true);
    expect(manifest.connections.some((edge) => edge.type === 'gate_control' && edge.sourceNodeId === 'gate:GATE.BIZ.01.01' && edge.targetNodeId === 'neoblock:N.BIZ.01.01')).toBe(true);
    expect(manifest.nodes.every((node) => node.state === 'idle')).toBe(true);
  });

  it('does not mutate the source input', () => {
    const sleeve = getBusinessAutomationCoreSleeve();
    const before = clone(sleeve);
    buildRuntimeGeometryManifest({ templateSleeve: sleeve });
    expect(sleeve).toEqual(before);
  });

  it('overlays only real runtime trace targets and leaves unknown IDs unmapped', () => {
    const sleeve = getBusinessAutomationCoreSleeve();
    const manifest = buildRuntimeGeometryManifest({ templateSleeve: sleeve });
    const runtimeManifest = applyRuntimeStateToGeometryManifest(manifest, [
      {
        traceId: 'trace.real',
        timestamp: 1,
        scopeKind: 'neostack',
        neoStackId: 'S.01',
        eventType: 'neostack_started',
        state: 'active',
        label: 'NeoStack considered'
      },
      {
        traceId: 'trace.real',
        timestamp: 2,
        scopeKind: 'neoblock',
        neoBlockId: 'N.BIZ.01.01',
        eventType: 'neoblock_completed',
        state: 'complete',
        label: 'NeoBlock completed'
      },
      {
        traceId: 'trace.real',
        timestamp: 3,
        scopeKind: 'molt',
        moltBlockId: 'UNKNOWN.MOLT.ID',
        eventType: 'molt_role_used',
        state: 'processing',
        label: 'Unknown MOLT'
      }
    ]);

    expect(runtimeManifest.nodes.find((node) => node.id === 'neostack:S.01')?.state).toBe('active');
    expect(runtimeManifest.nodes.find((node) => node.id === 'neoblock:N.BIZ.01.01')?.state).toBe('complete');
    expect(runtimeManifest.unmappedEvents).toHaveLength(1);
    expect(runtimeManifest.nodes.some((node) => node.id.includes('UNKNOWN.MOLT.ID') && node.state !== 'idle')).toBe(false);
  });
});
