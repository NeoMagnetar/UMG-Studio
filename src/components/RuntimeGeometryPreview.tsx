import { useMemo, useState } from 'react';
import type { NeoBlockGeometryNode, NeoStackGeometryNode, RuntimeConnectionType, RuntimeGeometryNode, UMGGeometryManifest } from '../lib/umg/runtimeGeometryTypes';
import { summarizeGeometryManifest } from '../lib/umg/runtimeGeometryProjection';
import './RuntimeGeometryPreview.css';

export type RuntimeGeometryPreviewProps = {
  manifest?: UMGGeometryManifest;
};

const connectionTypes: RuntimeConnectionType[] = [
  'hierarchy',
  'dependency',
  'execution_next',
  'gate_control',
  'tool_capability',
  'data_source',
  'memory_context',
  'feedback_loop',
  'inheritance',
  'reuse_binding'
];

const roleLabels = [
  ['hasDirective', 'Directive'],
  ['hasInstruction', 'Instruction'],
  ['hasSubject', 'Subject'],
  ['hasPrimary', 'Primary'],
  ['hasBlueprint', 'Blueprint']
] as const;

export function RuntimeGeometryPreview({ manifest }: RuntimeGeometryPreviewProps) {
  const [expandedStackId, setExpandedStackId] = useState<string | undefined>();

  const summary = useMemo(() => manifest ? summarizeGeometryManifest(manifest) : undefined, [manifest]);
  const grouped = useMemo(() => manifest ? buildStackGroups(manifest) : [], [manifest]);
  const connectionCounts = useMemo(() => {
    const counts = Object.fromEntries(connectionTypes.map((type) => [type, 0])) as Record<RuntimeConnectionType, number>;
    manifest?.connections.forEach((connection) => {
      counts[connection.type] = (counts[connection.type] ?? 0) + 1;
    });
    return counts;
  }, [manifest]);

  if (!manifest || !summary) return null;

  const sleeveNode = manifest.nodes.find((node): node is Extract<RuntimeGeometryNode, { kind: 'sleeve' }> => node.kind === 'sleeve');
  const selectedStack = grouped.find((group) => group.stack.neoStackId === expandedStackId) ?? grouped[0];
  const activeCount = manifest.nodes.filter((node) => node.state !== 'idle').length;

  return <section className="geometryPreview" aria-label="Geometry Manifest Preview">
    <header className="geometryPreviewHeader">
      <div>
        <span>Phase 12C</span>
        <h3>Geometry Manifest Preview</h3>
        <p>Structure View foundation for the future live UMG runtime map.</p>
      </div>
      <div className="geometryPreviewTruth">
        <b>{manifest.viewMode === 'runtime' ? 'Runtime overlay available' : 'Structure idle preview'}</b>
        <small>Geometry nodes default idle. Runtime activation appears only from real Hermes trace events.</small>
      </div>
    </header>

    <div className="geometryPreviewCounts" aria-label="Geometry manifest counts">
      <Count label="Sleeve" value={summary.totalSleeves} />
      <Count label="NeoStacks" value={summary.totalNeoStacks} />
      <Count label="NeoBlocks" value={summary.totalNeoBlocks} />
      <Count label="MOLT bindings" value={summary.totalMoltBindings} />
      <Count label="Gates" value={summary.totalGates} />
      <Count label="Tools" value={summary.totalToolEndpoints} />
      <Count label="Connections" value={summary.totalConnections} />
      <Count label="Active nodes" value={activeCount} />
    </div>

    {sleeveNode && <div className={`geometryPreviewSleeve geometryState-${sleeveNode.state}`}>
      <div>
        <span>Sleeve package</span>
        <b>{sleeveNode.label}</b>
        <small>{sleeveNode.sleeveId}</small>
      </div>
      <p>{sleeveNode.description}</p>
      <em>{sleeveNode.state}</em>
    </div>}

    <div className="geometryPreviewMain">
      <div className="geometryPreviewStacks" aria-label="NeoStack geometry groups">
        {grouped.map((group) => <button
          type="button"
          key={group.stack.neoStackId}
          className={`geometryPreviewStack geometryState-${group.stack.state}${selectedStack?.stack.neoStackId === group.stack.neoStackId ? ' selected' : ''}`}
          onClick={() => setExpandedStackId(group.stack.neoStackId)}
        >
          <span>{group.stack.neoStackId}</span>
          <b>{group.stack.label}</b>
          <small>{group.blocks.length} NeoBlocks · {group.moltBindingCount} MOLT bindings · {group.gateCount} Gates</small>
          <em>{group.stack.state}</em>
          <i>{group.blocks.slice(0, 3).map((block) => block.label).join(' · ')}{group.blocks.length > 3 ? ' · …' : ''}</i>
        </button>)}
      </div>

      <div className="geometryPreviewBlockPanel" aria-label="Selected NeoStack NeoBlocks">
        <div className="geometryPreviewPanelTitle">
          <span>Expanded NeoStack</span>
          <b>{selectedStack ? `${selectedStack.stack.neoStackId} · ${selectedStack.stack.label}` : 'No stack selected'}</b>
          <small>Compact rows only; MOLT and Gate internals stay summarized.</small>
        </div>
        <div className="geometryPreviewBlocks">
          {selectedStack?.blocks.slice(0, 8).map((block) => <NeoBlockRow key={block.neoBlockId} block={block} moltCount={selectedStack.moltByBlock.get(block.neoBlockId) ?? 0} gateCount={selectedStack.gateByBlock.get(block.neoBlockId) ?? 0} />)}
          {selectedStack && selectedStack.blocks.length > 8 && <div className="geometryPreviewMore">{selectedStack.blocks.length - 8} more NeoBlocks collapsed for MVP preview.</div>}
        </div>
      </div>
    </div>

    <div className="geometryPreviewConnections" aria-label="Connection type summary">
      <b>Connection summary</b>
      <div>
        {connectionTypes.map((type) => <span key={type}><strong>{connectionCounts[type]}</strong>{type}</span>)}
      </div>
    </div>

    {summary.unmappedRuntimeTargets > 0 && <div className="geometryPreviewUnmapped">{summary.unmappedRuntimeTargets} runtime event target{summary.unmappedRuntimeTargets === 1 ? '' : 's'} remain unmapped; no fallback activation was fabricated.</div>}
  </section>;
}

function Count({ label, value }: { label: string; value: number }) {
  return <div><b>{value}</b><span>{label}</span></div>;
}

function NeoBlockRow({ block, moltCount, gateCount }: { block: NeoBlockGeometryNode; moltCount: number; gateCount: number }) {
  return <div className={`geometryPreviewBlock geometryState-${block.state}`}>
    <div>
      <span>{block.neoBlockId}</span>
      <b>{block.label}</b>
      <small>{moltCount} MOLT bindings · {gateCount} gates · {block.state}</small>
    </div>
    <div className="geometryPreviewRoleHealth">
      {roleLabels.map(([key, label]) => <em key={key} className={block.roleHealth?.[key] ? 'present' : 'missing'}>{label}</em>)}
      {Boolean(block.roleHealth?.warnings.length) && <em className="warning">{block.roleHealth?.warnings.length} warning{block.roleHealth?.warnings.length === 1 ? '' : 's'}</em>}
    </div>
  </div>;
}

function buildStackGroups(manifest: UMGGeometryManifest) {
  const stacks = manifest.nodes.filter((node): node is NeoStackGeometryNode => node.kind === 'neostack');
  const blocks = manifest.nodes.filter((node): node is NeoBlockGeometryNode => node.kind === 'neoblock');
  const moltBindings = manifest.nodes.filter((node) => node.kind === 'molt_binding');
  const gates = manifest.nodes.filter((node) => node.kind === 'gate');

  return stacks.map((stack) => {
    const stackBlocks = blocks.filter((block) => block.neoStackId === stack.neoStackId);
    const blockIds = new Set(stackBlocks.map((block) => block.neoBlockId));
    const moltByBlock = new Map<string, number>();
    const gateByBlock = new Map<string, number>();
    moltBindings.forEach((binding) => {
      if (blockIds.has(binding.parentNeoBlockId)) {
        moltByBlock.set(binding.parentNeoBlockId, (moltByBlock.get(binding.parentNeoBlockId) ?? 0) + 1);
      }
    });
    gates.forEach((gate) => {
      gate.controlsNodeIds.forEach((nodeId) => {
        const neoBlockId = nodeId.replace(/^neoblock:/, '');
        if (blockIds.has(neoBlockId)) gateByBlock.set(neoBlockId, (gateByBlock.get(neoBlockId) ?? 0) + 1);
      });
    });
    return {
      stack,
      blocks: stackBlocks,
      moltByBlock,
      gateByBlock,
      moltBindingCount: Array.from(moltByBlock.values()).reduce((sum, count) => sum + count, 0),
      gateCount: Array.from(gateByBlock.values()).reduce((sum, count) => sum + count, 0)
    };
  });
}
