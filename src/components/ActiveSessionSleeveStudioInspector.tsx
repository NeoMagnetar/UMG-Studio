import type { NormalizedTemplateSleeve } from '../lib/umg/templateSleeveStructures';

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

function ActiveSessionMoltRoleGroups({ sleeve, blockId }: { sleeve: NormalizedTemplateSleeve; blockId: string }) {
  const block = sleeve.neoBlocks.find((entry) => entry.id === blockId);
  const molts = block ? sleeve.moltBlocks.filter((molt) => block.moltBlockIds.includes(molt.id)) : [];
  return <div className="activeSessionMoltRoleGroups">
    {activeSessionMoltRoles.map((role) => {
      const roleMolts = molts.filter((molt) => molt.role === role);
      return <div key={role} className={`activeSessionRoleGroup ${role}`}>
        <b>{labelDisplayType(role)}</b>
        {roleMolts.length ? roleMolts.map((molt) => <article key={molt.id} className="activeSessionMoltCard">
          <strong>{molt.title}</strong>
          <small>{molt.id}</small>
          <p>{molt.content}</p>
        </article>) : <span className="notPresentChip">not present</span>}
      </div>;
    })}
  </div>;
}

export function ActiveSessionSleeveStudioInspector({ sleeve, selectedNeoStackId, selectedNeoBlockId, onSelectNeoStack, onSelectNeoBlock, compileStatus = 'Compile status unavailable', runtimeStatus = 'Runtime status unavailable', onCompile, isCompiling = false }: { sleeve: NormalizedTemplateSleeve; selectedNeoStackId?: string; selectedNeoBlockId?: string; onSelectNeoStack?: (stackId: string) => void; onSelectNeoBlock?: (blockId: string) => void; compileStatus?: string; runtimeStatus?: string; onCompile?: () => void; isCompiling?: boolean }) {
  const counts = getActiveSessionCounts(sleeve);
  const capabilities = getActiveSessionCapabilities(sleeve);
  const selectedStack = sleeve.neoStacks.find((stack) => stack.id === selectedNeoStackId) ?? sleeve.neoStacks[0];
  const selectedBlock = sleeve.neoBlocks.find((block) => block.id === selectedNeoBlockId) ?? sleeve.neoBlocks.find((block) => block.neoStackId === selectedStack?.id) ?? sleeve.neoBlocks[0];
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
            <summary onClick={() => onSelectNeoStack?.(stack.id)}><b>{stack.title}</b><span>{blocks.length} NeoBlocks</span><small>{stack.id}</small></summary>
            <ol>{blocks.map((block) => <li key={block.id}><button type="button" className={block.id === selectedBlock?.id ? 'activeSessionLink selected' : 'activeSessionLink'} onClick={() => onSelectNeoBlock?.(block.id)}>{block.title}</button><small>{block.description}</small></li>)}</ol>
          </details>;
        })}</div>
      </section>
      <section>
        <h3>Selected NeoBlock</h3>
        {selectedBlock ? <>
          <SummaryRows rows={[["NeoStack", selectedStack?.title ?? selectedBlock.neoStackId], ["NeoBlock title", selectedBlock.title], ["NeoBlock ID", selectedBlock.id], ["Description", selectedBlock.description], ["Attached Gates", String(selectedBlockGates.length)], ["Attached capabilities", capabilities.map((capability) => capability.capabilityId ?? capability.label ?? 'capability').join(', ') || 'none declared']]} />
          <ActiveSessionMoltRoleGroups sleeve={sleeve} blockId={selectedBlock.id} />
          <div className="activeSessionControlList"><b>Gates / controls attached to this block</b>{selectedBlockGates.length ? selectedBlockGates.map((gate) => <div key={gate.id} className="gateControlDeclaration"><strong>{gate.title}</strong><span>{gate.id}</span><small>{gate.conditionText ?? 'control declaration; not prompt MOLT content'}</small><em>{gate.action ?? 'control'} · default {gate.defaultState ?? 'closed'}</em></div>) : <span className="notPresentChip">not present</span>}</div>
          <div className="activeSessionControlList"><b>Capabilities declared for this runtime-session Sleeve</b>{capabilities.length ? capabilities.map((capability) => <span key={capability.capabilityId ?? capability.label} className="capabilityStatusChip">{capability.label ?? capability.capabilityId} · {capability.capabilityId ?? 'capability'} · risk {capability.riskLevel ?? 'unknown'}</span>) : <span className="notPresentChip">not present</span>}</div>
        </> : <p>No NeoBlock is present in this active session Sleeve.</p>}
      </section>
    </div>
  </div>;
}
