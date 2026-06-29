import { BusinessInput, BusinessMap } from './businessIntakeTypes';
import { BlockMatchPlan, CompileCandidate, GeneratedBlockDraft, SleeveAssemblyPlan, AssemblyEdge } from './blockMatchingTypes';
import { NormalizedTemplateSleeve } from './templateSleeveStructures';

const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

function deriveRequiredTools(businessMap: BusinessMap, blockMatchPlan: BlockMatchPlan) {
  return unique([
    ...businessMap.externalTools,
    ...blockMatchPlan.missingCapabilities.filter((capability) => capability.requiresTool).map((capability) => capability.requestedToolCapability ?? capability.title)
  ]);
}

function deriveApprovalPoints(businessMap: BusinessMap, blockMatchPlan: BlockMatchPlan) {
  const text = [businessMap.businessSummary, ...businessMap.coreOperations, ...businessMap.automationCandidates, ...businessMap.outputsNeeded, ...businessMap.communicationChannels, ...businessMap.complianceOrSafetyConstraints].join(' ').toLowerCase();
  const approvals = [...businessMap.approvalPoints];
  if (/customer|message|email|sms|whatsapp|discord|slack/.test(text)) approvals.push('customer-facing messaging');
  if (/payment|invoice|stripe|quickbooks|square/.test(text)) approvals.push('payment/invoice actions');
  if (/post|social|instagram|facebook|tiktok|linkedin/.test(text)) approvals.push('external posting');
  if (/export|csv|spreadsheet|data/.test(text)) approvals.push('data export');
  if (/delete|cancel|refund|overwrite|destructive|irreversible/.test(text)) approvals.push('destructive/irreversible actions');
  if (/hipaa|legal|regulated|privacy|pii|medical|therapy|financial advice/.test(text)) approvals.push('regulated/sensitive data');
  blockMatchPlan.missingCapabilities.filter((capability) => capability.requiresTool).forEach((capability) => approvals.push(`missing tool integration: ${capability.title}`));
  return unique(approvals);
}

function deterministicExecutionOrder(selectedStackIds: string[], businessMap: BusinessMap) {
  const text = [businessMap.businessSummary, ...businessMap.automationCandidates, ...businessMap.coreOperations, ...businessMap.outputsNeeded].join(' ').toLowerCase();
  const order = ['S.01', 'S.02', ...selectedStackIds.filter((id) => !['S.01', 'S.02', 'S.07', 'S.08'].includes(id)).sort()];
  if (selectedStackIds.includes('S.07') || /setup|install|train|handoff|openclaw|implement/.test(text)) order.push('S.07');
  if (selectedStackIds.includes('S.08') || /metric|optimi|monitor|scal|roi|improvement/.test(text)) order.push('S.08');
  return unique(order).filter((id) => selectedStackIds.includes(id));
}

function buildEdges(plan: Pick<SleeveAssemblyPlan, 'sleeveId' | 'selectedNeoStackIds' | 'selectedNeoBlockIds' | 'selectedMoltBlockIds' | 'selectedGateIds'>, templateSleeve: NormalizedTemplateSleeve): AssemblyEdge[] {
  const edges: AssemblyEdge[] = [];
  plan.selectedNeoStackIds.forEach((id) => edges.push({ id: `edge.contains.${plan.sleeveId}.${id}`, fromId: plan.sleeveId, toId: id, kind: 'contains' }));
  plan.selectedNeoBlockIds.forEach((id) => {
    const block = templateSleeve.neoBlocks.find((entry) => entry.id === id);
    if (block) edges.push({ id: `edge.contains.${block.neoStackId}.${id}`, fromId: block.neoStackId, toId: id, kind: 'contains' });
  });
  plan.selectedMoltBlockIds.forEach((id) => {
    const block = templateSleeve.moltBlocks.find((entry) => entry.id === id);
    if (block?.parentNeoBlockId) edges.push({ id: `edge.contains.${block.parentNeoBlockId}.${id}`, fromId: block.parentNeoBlockId, toId: id, kind: 'contains' });
    else if (block?.parentNeoStackId) edges.push({ id: `edge.references.${block.parentNeoStackId}.${id}`, fromId: block.parentNeoStackId, toId: id, kind: 'references' });
    else edges.push({ id: `edge.references.${plan.sleeveId}.${id}`, fromId: plan.sleeveId, toId: id, kind: 'references' });
  });
  plan.selectedGateIds.forEach((id) => {
    const gate = templateSleeve.gates.find((entry) => entry.id === id);
    if (gate) edges.push({ id: `edge.activates.${id}.${gate.attachesTo.id}`, fromId: id, toId: gate.attachesTo.id, kind: 'activates' });
  });
  return edges;
}

export function createSleeveAssemblyPlan(args: { templateSleeve: NormalizedTemplateSleeve; blockMatchPlan: BlockMatchPlan; acceptedDrafts: GeneratedBlockDraft[]; businessMap: BusinessMap; businessInput?: BusinessInput }): SleeveAssemblyPlan {
  const selectedNeoStackIds = unique(args.blockMatchPlan.matchedNeoStacks.map((match) => match.targetId)).sort();
  const selectedNeoBlockIds = unique(args.blockMatchPlan.matchedNeoBlocks.map((match) => match.targetId)).sort();
  const selectedMoltBlockIds = unique(args.blockMatchPlan.matchedMoltBlocks.map((match) => match.targetId)).sort();
  const selectedGateIds = unique(args.blockMatchPlan.matchedGates.map((match) => match.targetId)).sort();
  const acceptedDraftIds = args.acceptedDrafts.filter((draft) => draft.accepted && draft.saveState !== 'discarded').map((draft) => draft.id);
  const discardedDraftIds = args.blockMatchPlan.generatedDrafts.filter((draft) => draft.saveState === 'discarded').map((draft) => draft.id);
  const allIds = [...selectedNeoStackIds, ...selectedNeoBlockIds, ...selectedMoltBlockIds, ...selectedGateIds, ...acceptedDraftIds];
  const compileReady = Boolean(args.templateSleeve.id && selectedNeoStackIds.length && selectedNeoBlockIds.length && selectedMoltBlockIds.length);
  const base = {
    id: `assembly_plan_${Date.now()}`,
    sleeveId: args.templateSleeve.id,
    sleeveTitle: args.templateSleeve.title,
    templateSleeveId: args.templateSleeve.id,
    selectedNeoStackIds, selectedNeoBlockIds, selectedMoltBlockIds, selectedGateIds,
    acceptedDraftIds, discardedDraftIds,
    gates: selectedGateIds,
    activeStates: Object.fromEntries(allIds.map((id) => [id, false])),
    disabledStates: Object.fromEntries(discardedDraftIds.map((id) => [id, true])),
    executionOrder: deterministicExecutionOrder(selectedNeoStackIds, args.businessMap),
    requiredTools: deriveRequiredTools(args.businessMap, args.blockMatchPlan),
    approvalPoints: deriveApprovalPoints(args.businessMap, args.blockMatchPlan),
    compileStatus: compileReady ? 'compile_ready' as const : 'not_compiled' as const,
    traceMetadata: { source: 'phase5_assembly_plan', runtimeTrace: false, compilerRan: false, hermesCalled: false },
    warnings: ['Assembly plan is compile-ready only as a candidate. The real compiler has not run.', 'Blocks remain off/dim and gates remain closed/inactive.'],
    createdAt: new Date().toISOString()
  };
  return { ...base, edges: buildEdges(base, args.templateSleeve) };
}

export function createCompileCandidateFromAssemblyPlan(args: { templateSleeve: NormalizedTemplateSleeve; assemblyPlan: SleeveAssemblyPlan; blockMatchPlan: BlockMatchPlan }): CompileCandidate {
  return {
    id: `compile_candidate_${Date.now()}`,
    assemblyPlanId: args.assemblyPlan.id,
    sleeveId: args.assemblyPlan.sleeveId,
    sleeveTitle: args.assemblyPlan.sleeveTitle,
    compileStatus: args.assemblyPlan.compileStatus === 'compile_ready' ? 'ready_for_compiler' : 'not_compiled',
    normalizedStructure: {
      sleeveId: args.templateSleeve.id,
      selectedNeoStackIds: args.assemblyPlan.selectedNeoStackIds,
      selectedNeoBlockIds: args.assemblyPlan.selectedNeoBlockIds,
      selectedMoltBlockIds: args.assemblyPlan.selectedMoltBlockIds,
      gates: args.assemblyPlan.selectedGateIds,
      acceptedDraftIds: args.assemblyPlan.acceptedDraftIds,
      requiredTools: args.assemblyPlan.requiredTools,
      approvalPoints: args.assemblyPlan.approvalPoints
    },
    runtimeInstructions: ['Use selected template blocks before generated drafts.', 'Route live tool use through Hermes/user authorization.', 'Keep gates closed until runtime opens them.'],
    executionPlan: args.assemblyPlan.executionOrder.map((id, index) => ({ id: `candidate_step_${index + 1}`, targetId: id, orderIndex: index, status: 'proposed_not_executed' })),
    toolPolicySummary: args.assemblyPlan.requiredTools.map((tool) => `${tool}: requested/user-declared only; Hermes must verify availability and authorization.`),
    sourceBlocks: [...args.assemblyPlan.selectedNeoStackIds, ...args.assemblyPlan.selectedNeoBlockIds, ...args.assemblyPlan.selectedMoltBlockIds, ...args.assemblyPlan.selectedGateIds, ...args.assemblyPlan.acceptedDraftIds],
    traceMetadata: { ...args.assemblyPlan.traceMetadata, compileCandidateOnly: true },
    warnings: ['CompileCandidate has not been processed by the real compiler yet.', 'This is a compile candidate, not a compiled runtime manifest.', ...args.assemblyPlan.warnings]
  };
}
