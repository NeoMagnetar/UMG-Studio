import { useState } from 'react';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateSleeve } from '../lib/umg/templateSleeveStructures';

const activeSessionMoltRoles = ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'] as const;

function labelDisplayType(role: string) {
  return ({
    directive: 'Directive',
    instruction: 'Instruction',
    subject: 'Subject',
    primary: 'Primary',
    philosophy: 'Philosophy',
    blueprint: 'Blueprint',
    meta: 'Meta'
  } as Record<string, string>)[role] ?? role;
}

function SummaryRows({ rows }: { rows: [string, string][] }) {
  return <div className="analysisRows">{rows.map(([key, value]) => <div key={key}><b>{key}</b><span>{value}</span></div>)}</div>;
}

function getActiveSessionCapabilities(sleeve?: NormalizedTemplateSleeve) {
  const raw = sleeve?.metadata?.capabilities;
  return Array.isArray(raw) ? raw as Array<{ capabilityId?: string; label?: string; riskLevel?: string; reason?: string }> : [];
}

function getActiveSessionGenerationSource(sleeve?: NormalizedTemplateSleeve) {
  return String(sleeve?.metadata?.generationSource ?? (sleeve?.metadata?.generatedByHermes ? 'hermes_custom_workflow_generation' : 'unknown'));
}

function getActiveSessionCounts(sleeve: NormalizedTemplateSleeve) {
  return {
    neoStacks: sleeve.neoStacks.length,
    neoBlocks: sleeve.neoBlocks.length,
    moltRoles: sleeve.moltBlocks.length,
    gates: sleeve.gates.length,
    capabilities: getActiveSessionCapabilities(sleeve).length
  };
}

function SourceStatusBadge({ sourceKind }: { sourceKind?: string }) {
  const label = sourceKind === 'source-library reused' ? 'reused' : sourceKind ?? 'generated glue';
  return <span className={`activeSessionSourceBadge ${label.replace(/\s+/g, '-')}`}>{label}</span>;
}

export function MoltDetailPanel({ sleeve, molt, selectedBlockId, onClose }: { sleeve: NormalizedTemplateSleeve; molt?: NormalizedTemplateMoltBlock; selectedBlockId?: string; onClose: () => void }) {
  const parentBlock = sleeve.neoBlocks.find((block) => block.id === (molt?.parentNeoBlockId ?? selectedBlockId));
  const parentStack = sleeve.neoStacks.find((stack) => stack.id === (molt?.parentNeoStackId ?? parentBlock?.neoStackId));
  const sourceKind = molt?.sourceKind ?? (molt ? 'generated glue' : 'unresolved');
  return <aside className="activeSessionMoltDetailPanel" aria-label="MOLT Detail">
    <div className="templateActionRow"><div><b>{molt?.title ?? 'Unresolved MOLTBlock'}</b><small>{molt?.id ?? 'missing-molt-id'}</small><SourceStatusBadge sourceKind={sourceKind} /></div><button type="button" className="publicSecondaryCta" onClick={onClose}>Close MOLT Detail</button></div>
    <SummaryRows rows={[
      ['Title', molt?.title ?? 'Unresolved MOLTBlock'],
      ['ID', molt?.id ?? 'unresolved'],
      ['Role', molt?.role ?? 'unknown'],
      ['Type', molt?.blockType ?? 'molt'],
      ['Source kind', sourceKind],
      ['Parent NeoStack', parentStack?.title ?? molt?.parentNeoStackId ?? 'unlinked'],
      ['Parent NeoBlock', parentBlock?.title ?? molt?.parentNeoBlockId ?? 'unlinked'],
      ['Description', molt?.content ?? 'No MOLT schema was available. Diagnostic fallback rendered instead of blank page.'],
      ['Tags', molt?.tags?.join(', ') || 'none'],
      ['stackOrder', String(molt?.stackOrder ?? 'not declared')],
      ['reusedBlockId', molt?.reusedBlockId ?? molt?.sourceId ?? 'not linked'],
      ['matchedCandidateId', molt?.matchedCandidateId ?? 'not linked'],
      ['sourcePath', molt?.sourcePath ?? 'not linked']
    ]} />
    {sourceKind !== 'source-library reused' ? <div className="analysisWarnings"><b>Not linked to source library</b><span>This MOLT is inspectable as runtime-session/generated/unresolved data. No blank page and no source-library mutation.</span></div> : null}
    <pre>{JSON.stringify(molt ?? { status: 'unresolved', selectedBlockId, warning: 'Selected MOLT was missing from activeSessionSleeve.moltBlocks.' }, null, 2)}</pre>
  </aside>;
}

function ActiveSessionMoltRoleGroups({ sleeve, blockId, onSelectMolt }: { sleeve: NormalizedTemplateSleeve; blockId: string; onSelectMolt?: (moltId: string) => void }) {
  const block = sleeve.neoBlocks.find((entry) => entry.id === blockId);
  const molts = block ? sleeve.moltBlocks.filter((molt) => block.moltBlockIds.includes(molt.id)) : [];
  return <div className="activeSessionMoltRoleGroups">
    {activeSessionMoltRoles.map((role) => {
      const roleMolts = molts.filter((molt) => molt.role === role);
      return <div key={role} className={`activeSessionRoleGroup ${role}`}>
        <b>{labelDisplayType(role)}</b>
        {roleMolts.length ? roleMolts.sort((a, b) => (a.stackOrder ?? 999) - (b.stackOrder ?? 999)).map((molt) => <article key={molt.id} className="activeSessionMoltCard">
          <button type="button" className="activeSessionMoltDetailButton" onClick={() => onSelectMolt?.(molt.id)}><strong>{molt.title}</strong><small>{molt.id}</small></button>
          <SourceStatusBadge sourceKind={molt.sourceKind} />
          <p>{molt.content}</p>
        </article>) : <span className="notPresentChip">not present</span>}
      </div>;
    })}
  </div>;
}

export function ActiveSessionSleeveStudioInspector({ sleeve, selectedNeoStackId, selectedNeoBlockId, onSelectNeoStack, onSelectNeoBlock, compileStatus = 'Compile status unavailable', runtimeStatus = 'Runtime status unavailable', onCompile, isCompiling = false }: { sleeve: NormalizedTemplateSleeve; selectedNeoStackId?: string; selectedNeoBlockId?: string; onSelectNeoStack?: (stackId: string) => void; onSelectNeoBlock?: (blockId: string) => void; compileStatus?: string; runtimeStatus?: string; onCompile?: () => void; isCompiling?: boolean }) {
  const [selectedMoltId, setSelectedMoltId] = useState<string | undefined>();
  const counts = getActiveSessionCounts(sleeve);
  const capabilities = getActiveSessionCapabilities(sleeve);
  const selectedStack = sleeve.neoStacks.find((stack) => stack.id === selectedNeoStackId) ?? sleeve.neoStacks[0];
  const selectedBlock = sleeve.neoBlocks.find((block) => block.id === selectedNeoBlockId) ?? sleeve.neoBlocks.find((block) => block.neoStackId === selectedStack?.id) ?? sleeve.neoBlocks[0];
  const selectedMolt = selectedMoltId ? sleeve.moltBlocks.find((molt) => molt.id === selectedMoltId) : undefined;
  const selectedBlockGates = selectedBlock ? sleeve.gates.filter((gate) => selectedBlock.gateIds.includes(gate.id) || gate.attachesTo?.id === selectedBlock.id || gate.targetIds?.includes(selectedBlock.id)) : [];
  return <div className="analysisPanel activeSessionSleeveInspector studioActiveSessionInspector" aria-label="Active Session Sleeve Inspector">
    <div className="publicSectionTitle"><span>AS</span><div><b>Active Session Sleeve Inspector</b><small>Read-only Studio view of the generated runtime-session Sleeve.</small></div></div>
    <div className="analysisWarnings"><b>Runtime-session only</b><span>This generated Sleeve is inspectable in this session only. sourceLibrarySaved: false. sourceLibraryWrite: false. No source library JSON is written or promoted.</span></div>
    <SummaryRows rows={[
      ['Sleeve title', sleeve.title],
      ['Sleeve ID', sleeve.id],
      ['Purpose / summary', sleeve.description],
      ['Generation source', getActiveSessionGenerationSource(sleeve)],
      ['runtimeSessionOnly', String(sleeve.metadata?.runtimeSessionOnly === true)],
      ['sourceLibrarySaved', 'false'],
      ['sourceLibraryWrite', String(sleeve.metadata?.sourceLibraryWrite === true)],
      ['NeoStacks', String(counts.neoStacks)],
      ['NeoBlocks', String(counts.neoBlocks)],
      ['MOLT roles', String(counts.moltRoles)],
      ['Gates', String(counts.gates)],
      ['Capabilities', String(counts.capabilities)],
      ['Compile status', compileStatus],
      ['Runtime status', runtimeStatus]
    ]} />
    <div className="templateActionRow"><button type="button" className="publicPrimaryCta" disabled={!onCompile || isCompiling} onClick={onCompile}>{isCompiling ? 'Compiling…' : 'Compile Active Sleeve'}</button><span>Calls the existing real compiler bridge path; no Hermes runtime call and no source-library write.</span></div>
    <div className="activeSessionHierarchyGrid">
      <section>
        <h3>NeoStacks</h3>
        <div className="neoStackSummaryList">{sleeve.neoStacks.map((stack) => {
          const blocks = sleeve.neoBlocks.filter((block) => block.neoStackId === stack.id);
          return <details key={stack.id} className={stack.id === selectedStack?.id ? 'templateStackPreview selected' : 'templateStackPreview'} open={stack.id === selectedStack?.id}>
            <summary onClick={() => onSelectNeoStack?.(stack.id)}><b>{stack.title}</b><span>{blocks.length} NeoBlocks</span><SourceStatusBadge sourceKind={stack.sourceKind} /><small>{stack.id}</small></summary>
            <ol>{blocks.map((block) => <li key={block.id}><button type="button" className={block.id === selectedBlock?.id ? 'activeSessionLink selected' : 'activeSessionLink'} onClick={() => { setSelectedMoltId(undefined); onSelectNeoBlock?.(block.id); }}>{block.title}</button><SourceStatusBadge sourceKind={block.sourceKind} /><small>{block.description}</small></li>)}</ol>
          </details>;
        })}</div>
      </section>
      <section>
        <h3>Selected NeoBlock</h3>
        {selectedBlock ? <>
          <SummaryRows rows={[["NeoStack", selectedStack?.title ?? selectedBlock.neoStackId], ["NeoBlock title", selectedBlock.title], ["NeoBlock ID", selectedBlock.id], ["Source kind", selectedBlock.sourceKind ?? 'generated glue'], ["reusedBlockId", selectedBlock.reusedBlockId ?? 'not linked'], ["matchedCandidateId", selectedBlock.matchedCandidateId ?? 'not linked'], ["sourcePath", selectedBlock.sourcePath ?? 'not linked'], ["Description", selectedBlock.description], ["Attached Gates", String(selectedBlockGates.length)], ["Attached capabilities", capabilities.map((capability) => capability.capabilityId ?? capability.label ?? 'capability').join(', ') || 'none declared']]} />
          <ActiveSessionMoltRoleGroups sleeve={sleeve} blockId={selectedBlock.id} onSelectMolt={setSelectedMoltId} />
          <div className="activeSessionControlList"><b>Gates / controls attached to this block</b>{selectedBlockGates.length ? selectedBlockGates.map((gate) => <div key={gate.id} className="gateControlDeclaration"><strong>{gate.title}</strong><span>{gate.id}</span><small>{gate.conditionText ?? 'control declaration; not prompt MOLT content'}</small><em>{gate.action ?? 'control'} · default {gate.defaultState ?? 'closed'}</em></div>) : <span className="notPresentChip">not present</span>}</div>
          <div className="activeSessionControlList"><b>Capabilities declared for this runtime-session Sleeve</b>{capabilities.length ? capabilities.map((capability) => <span key={capability.capabilityId ?? capability.label} className="capabilityStatusChip">{capability.label ?? capability.capabilityId} · {capability.capabilityId ?? 'capability'} · risk {capability.riskLevel ?? 'unknown'}</span>) : <span className="notPresentChip">not present</span>}</div>
        </> : <p>No NeoBlock is present in this active session Sleeve.</p>}
      </section>
    </div>
    {selectedMoltId ? <MoltDetailPanel sleeve={sleeve} molt={selectedMolt} selectedBlockId={selectedBlock?.id} onClose={() => setSelectedMoltId(undefined)} /> : null}
  </div>;
}
