import { useMemo, useState } from 'react';
import type { SleeveAssemblyPlan } from '../lib/umg/blockMatchingTypes';
import type { HermesCognitiveRuntimeResult, UMGCompiledRuntimeManifest, UMGRuntimeVisualState } from '../lib/umg/cognitiveRuntimeTypes';
import { buildRuntimeHierarchyViewModel, RuntimeHierarchyNode } from '../lib/umg/hierarchicalRuntimeViewModel';
import type { InstantiatedTemplateSleeve, NormalizedTemplateSleeve } from '../lib/umg/templateSleeveStructures';
import './HierarchicalRuntimeVisualizer.css';

export type HierarchicalRuntimeVisualizerProps = {
  templateSleeve?: NormalizedTemplateSleeve;
  instantiatedSleeve?: InstantiatedTemplateSleeve;
  assemblyPlan?: SleeveAssemblyPlan;
  compiledRuntimeManifest?: UMGCompiledRuntimeManifest;
  hermesRuntimeResult?: HermesCognitiveRuntimeResult;
  runtimeVisualState?: UMGRuntimeVisualState;
  hasHermesResult: boolean;
  hasRuntimeTrace: boolean;
  onSelectNeoStack?: (id: string) => void;
  onSelectNeoBlock?: (id: string) => void;
};

const roleOrder = ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint', 'meta'];

export function HierarchicalRuntimeVisualizer({
  templateSleeve,
  instantiatedSleeve,
  assemblyPlan,
  compiledRuntimeManifest,
  hermesRuntimeResult,
  runtimeVisualState,
  hasHermesResult,
  hasRuntimeTrace,
  onSelectNeoStack,
  onSelectNeoBlock
}: HierarchicalRuntimeVisualizerProps) {
  const [selectedNeoStackId, setSelectedNeoStackId] = useState<string | undefined>();
  const [selectedNeoBlockId, setSelectedNeoBlockId] = useState<string | undefined>();

  const viewModel = useMemo(() => buildRuntimeHierarchyViewModel({
    templateSleeve,
    instantiatedSleeve,
    assemblyPlan,
    compiledRuntimeManifest,
    runtimeVisualState,
    selectedNeoStackId,
    selectedNeoBlockId
  }), [templateSleeve, instantiatedSleeve, assemblyPlan, compiledRuntimeManifest, runtimeVisualState, selectedNeoStackId, selectedNeoBlockId]);

  const traceStatus = !hasHermesResult
    ? 'No Hermes run yet'
    : hasRuntimeTrace
      ? `Real trace active: ${runtimeVisualState?.timeline.length ?? 0} events`
      : 'Hermes returned no runtime trace events';

  const selectNeoStack = (node: RuntimeHierarchyNode) => {
    setSelectedNeoStackId(node.id);
    setSelectedNeoBlockId(undefined);
    onSelectNeoStack?.(node.id);
  };

  const selectNeoBlock = (node: RuntimeHierarchyNode) => {
    setSelectedNeoBlockId(node.id);
    onSelectNeoBlock?.(node.id);
  };

  const back = () => {
    if (viewModel.selectedLevel === 'neoblock') {
      setSelectedNeoBlockId(undefined);
      return;
    }
    if (viewModel.selectedLevel === 'neostack') setSelectedNeoStackId(undefined);
  };

  const reset = () => {
    setSelectedNeoStackId(undefined);
    setSelectedNeoBlockId(undefined);
  };

  const gateNodes = viewModel.selectedLevel === 'neoblock' && viewModel.selectedNeoBlockId
    ? viewModel.gateNodes.filter((gate) => gate.parentId === viewModel.selectedNeoBlockId)
    : viewModel.selectedLevel === 'neostack' && viewModel.selectedNeoStackId
      ? viewModel.gateNodes.filter((gate) => viewModel.neoBlockNodes.some((block) => block.parentId === viewModel.selectedNeoStackId && block.gateIds.includes(gate.id)))
      : [];

  return <section className="runtimeViz" aria-label="Hierarchical UMG runtime visualizer">
    <header className="runtimeVizHeader">
      <div>
        <span>Phase 8</span>
        <h3>Cognitive Runtime Visualizer</h3>
        <p>Sleeve → NeoStacks → NeoBlocks → MOLT. Structure displays before runtime; glow requires real Hermes trace.</p>
      </div>
      <div className="runtimeVizTraceStatus">
        <b>{traceStatus}</b>
        <small>{hermesRuntimeResult ? `Hermes status: ${hermesRuntimeResult.status}` : 'Hermes not run'}</small>
      </div>
    </header>

    <div className="runtimeVizCounts">
      <Count label="NeoStacks" value={viewModel.counts.neoStacks} />
      <Count label="NeoBlocks" value={viewModel.counts.neoBlocks} />
      <Count label="MOLT" value={viewModel.counts.moltBlocks} />
      <Count label="Gates" value={viewModel.counts.gates} />
      <Count label="Active" value={viewModel.counts.active} />
      <Count label="Complete" value={viewModel.counts.complete} />
      <Count label="Blocked" value={viewModel.counts.blocked} />
      <Count label="Error" value={viewModel.counts.error} />
    </div>

    <div className="runtimeVizBreadcrumb">
      <button type="button" onClick={reset}>Sleeve</button>
      {viewModel.breadcrumb.slice(1).map((node) => <button type="button" key={node.id} onClick={() => node.kind === 'neostack' ? (setSelectedNeoStackId(node.id), setSelectedNeoBlockId(undefined)) : setSelectedNeoBlockId(node.id)}>{node.title}</button>)}
      <span>{viewModel.selectedLevel}</span>
      <button type="button" onClick={back} disabled={viewModel.selectedLevel === 'sleeve'}>Back</button>
    </div>

    {viewModel.warnings.length > 0 && <div className="runtimeVizWarnings">{viewModel.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}

    {!viewModel.sleeveNode && <div className="runtimeVizEmpty">Create a Sleeve from template to view hierarchy.</div>}

    {viewModel.sleeveNode && <div className={`runtimeVizSleeveCard runtimeVizNode ${viewModel.sleeveNode.runtimeClass}`}>
      <b>{viewModel.sleeveNode.title}</b>
      <span>{viewModel.sleeveNode.subtitle}</span>
      <small>{viewModel.sleeveNode.description}</small>
    </div>}

    <div className="runtimeVizMap">
      {viewModel.selectedLevel === 'neoblock'
        ? <MoltRoleGroups nodes={viewModel.visibleNodes} />
        : viewModel.visibleNodes.map((node) => <RuntimeNodeCard key={node.id} node={node} onClick={() => node.kind === 'neostack' ? selectNeoStack(node) : node.kind === 'neoblock' ? selectNeoBlock(node) : undefined} />)}
    </div>

    {gateNodes.length > 0 && <div className="runtimeVizGateRail">
      <b>Attached gates / control records</b>
      {gateNodes.map((gate) => <div key={gate.id} className={`runtimeVizGate ${gate.runtimeClass}`}><span>{gate.title}</span><small>{gate.sourceId ?? gate.id} · {gate.subtitle}</small></div>)}
    </div>}

    <p className="runtimeVizFootnote">Runtime highlighting depends on Hermes trace IDs matching local IDs, source IDs, or metadata aliases. If no IDs match, the trace timeline can still show events while this hierarchy remains idle. No matches are fabricated.</p>
  </section>;
}

function Count({ label, value }: { label: string; value: number }) {
  return <div><b>{value}</b><span>{label}</span></div>;
}

function RuntimeNodeCard({ node, onClick }: { node: RuntimeHierarchyNode; onClick?: () => void }) {
  return <button type="button" className={`runtimeVizNode ${node.runtimeClass} runtimeVizKind-${node.kind}${node.role ? ` runtimeVizRole-${node.role}` : ''}`} onClick={onClick}>
    <span className="runtimeVizNodeKind">{node.kind}</span>
    <b>{node.title}</b>
    {node.subtitle && <span>{node.subtitle}</span>}
    {node.description && <small>{node.description}</small>}
    <em>{node.runtimeState}</em>
    {node.matchedRuntimeIds.length > 0 && <code>matched: {node.matchedRuntimeIds.join(', ')}</code>}
    {node.gateIds.length > 0 && <i>{node.gateIds.length} gate badge{node.gateIds.length === 1 ? '' : 's'}</i>}
  </button>;
}

function MoltRoleGroups({ nodes }: { nodes: RuntimeHierarchyNode[] }) {
  const grouped = roleOrder.map((role) => ({ role, nodes: nodes.filter((node) => node.role === role) })).filter((group) => group.nodes.length);
  const ungrouped = nodes.filter((node) => !node.role || !roleOrder.includes(node.role));
  if (!nodes.length) return <div className="runtimeVizEmpty">No MOLT blocks are attached to this NeoBlock.</div>;
  return <>
    {grouped.map((group) => <div key={group.role} className="runtimeVizRoleGroup">
      <h4>{group.role}</h4>
      <div>{group.nodes.map((node) => <RuntimeNodeCard key={node.id} node={node} />)}</div>
    </div>)}
    {ungrouped.length > 0 && <div className="runtimeVizRoleGroup"><h4>other</h4><div>{ungrouped.map((node) => <RuntimeNodeCard key={node.id} node={node} />)}</div></div>}
  </>;
}
