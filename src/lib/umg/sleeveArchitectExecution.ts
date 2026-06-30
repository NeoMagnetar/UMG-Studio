import type { BlockMatchPlan, CompileCandidate, SleeveAssemblyPlan, AssemblyEdge } from './blockMatchingTypes';
import type { BusinessInput, BusinessMap } from './businessIntakeTypes';
import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import type { NormalizedTemplateSleeve } from './templateSleeveStructures';
import type { ArchitectBlockMatch, ArchitectExecutionPolicy, ArchitectExecutionRoute, SleeveArchitectPlan } from './sleeveArchitectTypes';

const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const defaultArchitectExecutionPolicy: ArchitectExecutionPolicy = {
  allowCompile: true,
  allowHermesRun: true,
  allowHermesTools: true,
  allowExternalToolExecution: true,
  requireConfirmationForIrreversibleActions: true,
  allowLibrarySave: false,
  generatedContentPersistence: 'runtime_session',
  generatedContentTrustLevel: 'runtime_ephemeral_until_saved',
  executionMode: 'live_or_approvalRequired',
  approvalMode: 'manual'
};

function isStrongExistingSleeveMatch(plan: SleeveArchitectPlan) {
  return plan.mode === 'demo_template_mode' && plan.confidence >= 0.75;
}

function hasReusableMatches(plan: SleeveArchitectPlan) {
  return plan.matchedExistingBlocks.some((match) => match.score >= 0.45);
}

export function decideArchitectExecutionRoute(plan: SleeveArchitectPlan): ArchitectExecutionRoute {
  if (isStrongExistingSleeveMatch(plan)) return 'load_existing_sleeve';
  if (hasReusableMatches(plan)) return 'modify_existing_sleeve';
  return 'create_new_sleeve';
}

function routeReason(route: ArchitectExecutionRoute, plan: SleeveArchitectPlan) {
  if (route === 'load_existing_sleeve') return 'A strong existing/seed Sleeve match is available, so the live path can load that structure.';
  if (route === 'modify_existing_sleeve') return 'Existing local blocks matched parts of the request, but missing architecture is generated for this runtime session.';
  return 'No full matching Sleeve is trusted for this request, so Architect Mode assembles a runtime-session Sleeve from semantic matches and generated parts.';
}

function sourceForMatch(match?: ArchitectBlockMatch) {
  if (!match) return { provenance: 'runtime_session_generated', sourceId: undefined };
  return { provenance: `reused_${match.source}`, sourceId: match.blockId };
}

const runtimeMoltRole = (role: string): 'directive' | 'instruction' | 'subject' | 'primary' | 'philosophy' | 'blueprint' | 'meta' => {
  if (role === 'directive' || role === 'instruction' || role === 'subject' || role === 'primary' || role === 'philosophy' || role === 'blueprint') return role;
  return 'meta';
};

function makeRuntimeSleeve(plan: SleeveArchitectPlan, policy: ArchitectExecutionPolicy): NormalizedTemplateSleeve {
  const blockById = new Map(plan.proposedNeoBlocks.map((block) => [block.id, block]));
  const moltIdsByBlock = new Map<string, string[]>();
  const gateIdsByBlock = new Map<string, string[]>();
  for (const block of plan.proposedNeoBlocks) {
    moltIdsByBlock.set(block.id, []);
    gateIdsByBlock.set(block.id, []);
  }
  for (const molt of plan.proposedMoltBlocks) {
    moltIdsByBlock.get(molt.parentNeoBlockId)?.push(molt.id);
  }
  for (const gate of plan.proposedGates) {
    if (gate.controlledNeoBlockId) gateIdsByBlock.get(gate.controlledNeoBlockId)?.push(gate.id);
  }

  const neoStacks = plan.proposedNeoStacks.map((stack, stackOrder) => ({
    id: stack.id,
    title: stack.title,
    description: stack.reason,
    stackOrder,
    tags: unique([...stack.semanticTags, 'architect_mode', 'runtime_session']),
    neoBlockIds: plan.proposedNeoBlocks.filter((block) => block.parentNeoStackId === stack.id).map((block) => block.id)
  }));

  const neoBlocks = plan.proposedNeoBlocks.map((block, blockOrder) => ({
    id: block.id,
    title: block.title,
    description: block.purpose,
    neoStackId: block.parentNeoStackId,
    blockOrder,
    tags: unique([...block.requiredMoltRoles, 'architect_mode', 'runtime_session', 'session_generated']),
    moltBlockIds: moltIdsByBlock.get(block.id) ?? [],
    gateIds: gateIdsByBlock.get(block.id) ?? [],
    defaultState: 'off' as const,
    runtimeState: 'idle' as const
  }));

  const moltBlocks = plan.proposedMoltBlocks.map((molt) => {
    const match = plan.matchedExistingBlocks.find((candidate) => candidate.blockId === molt.matchedExistingBlockId || candidate.role === molt.role);
    const provenance = sourceForMatch(match);
    const parent = blockById.get(molt.parentNeoBlockId);
    return {
      id: molt.id,
      sourceId: provenance.sourceId,
      title: molt.title,
      role: runtimeMoltRole(molt.role),
      content: molt.summary,
      tags: unique([molt.role, 'architect_mode', 'runtime_session', provenance.provenance, ...(match?.matchedTags ?? [])]),
      parentNeoBlockId: molt.parentNeoBlockId,
      parentNeoStackId: parent?.parentNeoStackId,
      sourceNotes: [
        match ? `Reused/grounded from existing block ${match.blockId}: ${match.reason}` : 'Generated for this runtime session by Architect Mode.',
        'Runtime-session content is not trusted reusable source-library content until explicitly saved.'
      ],
      defaultState: 'off' as const
    };
  });

  const gates: UMGGateRecord[] = plan.proposedGates.map((gate) => ({
    id: gate.id,
    title: gate.title,
    attachesTo: { kind: 'neoblock', id: gate.controlledNeoBlockId ?? plan.proposedNeoBlocks[0]?.id ?? plan.proposedSleeveId },
    triggerType: gate.reason.toLowerCase().includes('approval') ? 'approval' : gate.reason.toLowerCase().includes('risk') ? 'risk_detected' : 'runtime_condition',
    conditionText: gate.reason,
    action: gate.reason.toLowerCase().includes('approval') ? 'require_approval' : 'activate',
    targetIds: gate.controlledNeoBlockId ? [gate.controlledNeoBlockId] : [],
    defaultState: 'closed',
    runtimeState: 'inactive',
    tags: ['architect_mode', 'runtime_session', 'gate_control'],
    metadata: { promptContent: false, draftOnly: true, generatedContentTrustLevel: policy.generatedContentTrustLevel }
  }));

  return {
    id: plan.proposedSleeveId,
    title: plan.proposedSleeveTitle,
    version: 'runtime-session.v1',
    description: `${plan.domainSummary}. Generated by Architect Mode for live runtime session use only.`,
    isTemplate: true,
    templateKind: 'custom',
    source: 'session',
    tags: unique(['architect_mode', 'runtime_session', plan.domainSummary, ...plan.semanticTags]),
    neoStacks,
    neoBlocks,
    moltBlocks,
    gates,
    governanceBlockIds: moltBlocks.filter((block) => block.role === 'primary').map((block) => block.id),
    defaultExecutionMode: policy.allowHermesRun ? 'approvalRequired' : 'dryRun',
    metadata: {
      architectPlanId: plan.id,
      executionRoute: plan.executionRoute,
      generatedContentPersistence: policy.generatedContentPersistence,
      generatedContentTrustLevel: policy.generatedContentTrustLevel,
      allowLibrarySave: policy.allowLibrarySave,
      sourceLibraryWrite: false,
      noTrustedLibraryPromotion: true
    }
  };
}

function buildEdges(sleeve: NormalizedTemplateSleeve): AssemblyEdge[] {
  return [
    ...sleeve.neoStacks.map((stack) => ({ id: `edge.contains.${sleeve.id}.${stack.id}`, fromId: sleeve.id, toId: stack.id, kind: 'contains' as const })),
    ...sleeve.neoBlocks.map((block) => ({ id: `edge.contains.${block.neoStackId}.${block.id}`, fromId: block.neoStackId, toId: block.id, kind: 'contains' as const })),
    ...sleeve.moltBlocks.map((block) => ({ id: `edge.contains.${block.parentNeoBlockId}.${block.id}`, fromId: block.parentNeoBlockId ?? sleeve.id, toId: block.id, kind: 'contains' as const })),
    ...sleeve.gates.map((gate) => ({ id: `edge.activates.${gate.id}.${gate.attachesTo.id}`, fromId: gate.id, toId: gate.attachesTo.id, kind: 'activates' as const }))
  ];
}

function makeAssemblyPlan(plan: SleeveArchitectPlan, sleeve: NormalizedTemplateSleeve, policy: ArchitectExecutionPolicy): SleeveAssemblyPlan {
  const selectedNeoStackIds = sleeve.neoStacks.map((stack) => stack.id);
  const selectedNeoBlockIds = sleeve.neoBlocks.map((block) => block.id);
  const selectedMoltBlockIds = sleeve.moltBlocks.map((block) => block.id);
  const selectedGateIds = sleeve.gates.map((gate) => gate.id);
  const allIds = [sleeve.id, ...selectedNeoStackIds, ...selectedNeoBlockIds, ...selectedMoltBlockIds, ...selectedGateIds];
  return {
    id: `architect_assembly_${plan.id}`,
    sleeveId: sleeve.id,
    sleeveTitle: sleeve.title,
    templateSleeveId: sleeve.id,
    selectedNeoStackIds,
    selectedNeoBlockIds,
    selectedMoltBlockIds,
    selectedGateIds,
    acceptedDraftIds: plan.generatedDrafts.map((draft) => draft.id),
    discardedDraftIds: [],
    edges: buildEdges(sleeve),
    gates: selectedGateIds,
    activeStates: Object.fromEntries(allIds.map((id) => [id, false])),
    disabledStates: {},
    executionOrder: selectedNeoBlockIds,
    requiredTools: plan.toolCapabilityNeeds.map((tool) => tool.capability),
    approvalPoints: unique([...plan.approvalPoints, ...plan.riskPoints, ...(policy.requireConfirmationForIrreversibleActions ? ['irreversible/high-risk external actions require explicit confirmation'] : [])]),
    compileStatus: policy.allowCompile ? 'compile_ready' : 'not_compiled',
    traceMetadata: {
      source: 'architect_execution_first_runtime_session',
      architectPlanId: plan.id,
      executionRoute: plan.executionRoute,
      runtimeTrace: false,
      compilerRan: false,
      hermesCalled: false,
      sourceLibraryWrite: false
    },
    warnings: [
      'Architect runtime Sleeve is valid for this session only; source library is not modified.',
      'Runtime activation must come only from Hermes runtime trace events.'
    ],
    createdAt: new Date().toISOString()
  };
}

function makeBlockMatchPlan(plan: SleeveArchitectPlan, sleeve: NormalizedTemplateSleeve, businessMap: BusinessMap): BlockMatchPlan {
  return {
    id: `architect_match_${plan.id}`,
    templateSleeveId: sleeve.id,
    businessMapSummary: businessMap.businessSummary,
    matchedSleeves: [],
    matchedNeoStacks: sleeve.neoStacks.map((stack) => ({ id: `match.${stack.id}`, source: 'generatedDraft', targetKind: 'neostack', targetId: stack.id, title: stack.title, summary: stack.description, confidence: plan.confidence, reason: 'Architect Mode runtime-session NeoStack.', matchedSignals: stack.tags, reusedExisting: false, proposedUse: 'draftReplacementCandidate' })),
    matchedNeoBlocks: sleeve.neoBlocks.map((block) => ({ id: `match.${block.id}`, source: 'generatedDraft', targetKind: 'neoblock', targetId: block.id, parentId: block.neoStackId, title: block.title, summary: block.description, confidence: plan.confidence, reason: 'Architect Mode runtime-session NeoBlock.', matchedSignals: block.tags, reusedExisting: false, proposedUse: 'draftReplacementCandidate' })),
    matchedMoltBlocks: sleeve.moltBlocks.map((block) => ({ id: `match.${block.id}`, source: block.sourceId ? 'library' : 'generatedDraft', targetKind: 'molt', targetId: block.id, sourceId: block.sourceId, parentId: block.parentNeoBlockId, title: block.title, summary: block.content, role: block.role, confidence: block.sourceId ? 0.72 : 0.64, reason: block.sourceId ? 'Reused from semantic existing block match with runtime-session binding.' : 'Generated for runtime-session MOLT role coverage.', matchedSignals: block.tags, reusedExisting: Boolean(block.sourceId), proposedUse: block.sourceId ? 'partialReuse' : 'draftReplacementCandidate' })),
    matchedGates: sleeve.gates.map((gate) => ({ id: `match.${gate.id}`, source: 'generatedDraft', targetKind: 'gate', targetId: gate.id, title: gate.title, summary: gate.conditionText, parentId: gate.attachesTo.id, confidence: 0.64, reason: 'Architect Mode runtime-session Gate/control record.', matchedSignals: gate.tags, reusedExisting: false, proposedUse: 'draftReplacementCandidate' })),
    confidence: plan.confidence,
    reasonForMatch: routeReason(plan.executionRoute, plan),
    missingCapabilities: plan.missingCapabilities.map((capability, index) => ({ id: `architect_missing_${index + 1}`, title: capability, description: capability, capabilityType: 'domain', sourceSignals: plan.semanticTags, whyMissing: 'Required by Architect Mode runtime plan.', suggestedBlockType: 'molt', confidence: 0.68, status: 'drafted' })),
    generatedDrafts: plan.generatedDrafts,
    createdAt: new Date().toISOString(),
    warnings: ['Architect execution plan uses runtime-session generated content; no source library write.']
  };
}

function makeCompileCandidate(plan: SleeveArchitectPlan, sleeve: NormalizedTemplateSleeve, assemblyPlan: SleeveAssemblyPlan, blockMatchPlan: BlockMatchPlan, policy: ArchitectExecutionPolicy): CompileCandidate {
  return {
    id: `architect_compile_candidate_${plan.id}`,
    assemblyPlanId: assemblyPlan.id,
    sleeveId: sleeve.id,
    sleeveTitle: sleeve.title,
    compileStatus: assemblyPlan.compileStatus === 'compile_ready' ? 'ready_for_compiler' : 'not_compiled',
    normalizedStructure: {
      ...sleeve,
      selectedNeoStackIds: assemblyPlan.selectedNeoStackIds,
      selectedNeoBlockIds: assemblyPlan.selectedNeoBlockIds,
      selectedMoltBlockIds: assemblyPlan.selectedMoltBlockIds,
      selectedGateIds: assemblyPlan.selectedGateIds,
      requiredTools: assemblyPlan.requiredTools,
      approvalPoints: assemblyPlan.approvalPoints,
      routingHints: assemblyPlan.executionOrder.map((targetId, orderIndex) => ({ targetId, orderIndex, activateOnlyFromTrace: true })),
      traceMappingAliases: [...assemblyPlan.selectedNeoBlockIds, ...assemblyPlan.selectedMoltBlockIds, ...assemblyPlan.selectedGateIds],
      metadata: { ...sleeve.metadata, blockMatchPlanId: blockMatchPlan.id }
    },
    runtimeInstructions: [
      'Execute this Architect Mode Sleeve as runtime-session architecture only.',
      'Use semantic existing block matches where available and generated session blocks where needed.',
      'Hermes may use configured safe/non-destructive tools when available.',
      'Irreversible or high-risk external actions require explicit confirmation before execution.',
      'Emit real trace events for gates, active NeoBlocks, MOLT roles, tool calls, blocks, and completion; do not fabricate activation.'
    ],
    executionPlan: assemblyPlan.executionOrder.map((targetId, orderIndex) => ({ id: `architect_step_${orderIndex + 1}`, targetId, orderIndex, status: 'ready_for_live_runtime', requiredToolIds: assemblyPlan.requiredTools, requiredGateIds: assemblyPlan.gates.filter((gateId) => sleeve.gates.find((gate) => gate.id === gateId)?.attachesTo.id === targetId) })),
    toolPolicySummary: [
      `allowCompile: ${policy.allowCompile}`,
      `allowHermesRun: ${policy.allowHermesRun}`,
      `allowHermesTools: ${policy.allowHermesTools}`,
      `allowExternalToolExecution: ${policy.allowExternalToolExecution}`,
      `requireConfirmationForIrreversibleActions: ${policy.requireConfirmationForIrreversibleActions}`,
      ...assemblyPlan.requiredTools.map((tool) => `${tool}: declared capability; Hermes verifies availability/authorization.`)
    ],
    sourceBlocks: [sleeve.id, ...assemblyPlan.selectedNeoStackIds, ...assemblyPlan.selectedNeoBlockIds, ...assemblyPlan.selectedMoltBlockIds, ...assemblyPlan.selectedGateIds],
    traceMetadata: {
      ...assemblyPlan.traceMetadata,
      compileCandidateOnly: true,
      dynamicRoutingPrepared: true,
      noFakeTrace: true,
      noFabricatedVisualActivation: true,
      toolCapabilities: assemblyPlan.requiredTools
    },
    warnings: [
      'Generated architecture is runtime-session usable but not trusted library content.',
      'Compile/run is execution-first and does not require manual review.',
      'Review workspace is optional/advanced inspection only.'
    ]
  };
}

export function buildRuntimeSleeveExecutionArtifacts(args: { runtimeSleeve: NormalizedTemplateSleeve; requiredTools?: string[]; approvalPoints?: string[]; sourceLabel?: string }) {
  const sleeve = args.runtimeSleeve;
  const selectedNeoStackIds = sleeve.neoStacks.map((stack) => stack.id);
  const selectedNeoBlockIds = sleeve.neoBlocks.map((block) => block.id);
  const selectedMoltBlockIds = sleeve.moltBlocks.map((block) => block.id);
  const selectedGateIds = sleeve.gates.map((gate) => gate.id);
  const requiredTools = args.requiredTools ?? [];
  const allIds = [sleeve.id, ...selectedNeoStackIds, ...selectedNeoBlockIds, ...selectedMoltBlockIds, ...selectedGateIds];
  const createdAt = new Date().toISOString();
  const assemblyPlan: SleeveAssemblyPlan = {
    id: `runtime_session_assembly_${sleeve.id}`,
    sleeveId: sleeve.id,
    sleeveTitle: sleeve.title,
    templateSleeveId: sleeve.id,
    selectedNeoStackIds,
    selectedNeoBlockIds,
    selectedMoltBlockIds,
    selectedGateIds,
    acceptedDraftIds: [],
    discardedDraftIds: [],
    edges: buildEdges(sleeve),
    gates: selectedGateIds,
    activeStates: Object.fromEntries(allIds.map((id) => [id, false])),
    disabledStates: {},
    executionOrder: selectedNeoBlockIds,
    requiredTools,
    approvalPoints: args.approvalPoints ?? [],
    compileStatus: 'compile_ready',
    traceMetadata: { source: args.sourceLabel ?? 'hermes_custom_workflow_runtime_session', runtimeTrace: false, compilerRan: false, hermesCalled: false, sourceLibraryWrite: false },
    warnings: ['Runtime-session Sleeve is not source-library content.', 'Runtime activation must come only from Hermes runtime trace events.'],
    createdAt
  };
  const blockMatchPlan: BlockMatchPlan = {
    id: `runtime_session_match_${sleeve.id}`,
    templateSleeveId: sleeve.id,
    businessMapSummary: sleeve.description,
    matchedSleeves: [],
    matchedNeoStacks: sleeve.neoStacks.map((stack) => ({ id: `match.${stack.id}`, source: 'generatedDraft', targetKind: 'neostack', targetId: stack.id, title: stack.title, summary: stack.description, confidence: 0.76, reason: 'Hermes custom workflow runtime-session NeoStack.', matchedSignals: stack.tags, reusedExisting: false, proposedUse: 'draftReplacementCandidate' })),
    matchedNeoBlocks: sleeve.neoBlocks.map((block) => ({ id: `match.${block.id}`, source: 'generatedDraft', targetKind: 'neoblock', targetId: block.id, parentId: block.neoStackId, title: block.title, summary: block.description, confidence: 0.76, reason: 'Hermes custom workflow runtime-session NeoBlock.', matchedSignals: block.tags, reusedExisting: false, proposedUse: 'draftReplacementCandidate' })),
    matchedMoltBlocks: sleeve.moltBlocks.map((block) => ({ id: `match.${block.id}`, source: block.sourceId ? 'library' : 'generatedDraft', targetKind: 'molt', targetId: block.id, sourceId: block.sourceId, parentId: block.parentNeoBlockId, title: block.title, summary: block.content, role: block.role, confidence: block.sourceId ? 0.78 : 0.7, reason: 'Hermes custom workflow MOLT role binding.', matchedSignals: block.tags, reusedExisting: Boolean(block.sourceId), proposedUse: block.sourceId ? 'partialReuse' : 'draftReplacementCandidate' })),
    matchedGates: sleeve.gates.map((gate) => ({ id: `match.${gate.id}`, source: 'generatedDraft', targetKind: 'gate', targetId: gate.id, title: gate.title, summary: gate.conditionText, parentId: gate.attachesTo.id, confidence: 0.7, reason: 'Hermes custom workflow Gate/control record.', matchedSignals: gate.tags, reusedExisting: false, proposedUse: 'draftReplacementCandidate' })),
    confidence: 0.76,
    reasonForMatch: 'Live Hermes custom workflow generation produced runtime-session structure.',
    missingCapabilities: [],
    generatedDrafts: [],
    createdAt,
    warnings: ['No source library write.']
  };
  const compileCandidate: CompileCandidate = {
    id: `runtime_session_compile_candidate_${sleeve.id}`,
    assemblyPlanId: assemblyPlan.id,
    sleeveId: sleeve.id,
    sleeveTitle: sleeve.title,
    compileStatus: 'ready_for_compiler',
    normalizedStructure: { ...sleeve, selectedNeoStackIds, selectedNeoBlockIds, selectedMoltBlockIds, selectedGateIds, requiredTools, approvalPoints: assemblyPlan.approvalPoints, routingHints: assemblyPlan.executionOrder.map((targetId, orderIndex) => ({ targetId, orderIndex, activateOnlyFromTrace: true })), traceMappingAliases: [...selectedNeoBlockIds, ...selectedMoltBlockIds, ...selectedGateIds], metadata: { ...sleeve.metadata, blockMatchPlanId: blockMatchPlan.id } },
    runtimeInstructions: ['Execute this active Custom Workflow Sleeve as runtime-session architecture only.', 'Use only supplied Sleeve/NeoStack/NeoBlock/MOLT/Gate IDs for trace mapping.', 'Irreversible or high-risk external actions require explicit confirmation and connector setup.', 'Do not fabricate visual activation.'],
    executionPlan: assemblyPlan.executionOrder.map((targetId, orderIndex) => ({ id: `runtime_session_step_${orderIndex + 1}`, targetId, orderIndex, status: 'ready_for_live_runtime', requiredToolIds: requiredTools, requiredGateIds: assemblyPlan.gates.filter((gateId) => sleeve.gates.find((gate) => gate.id === gateId)?.attachesTo.id === targetId) })),
    toolPolicySummary: requiredTools.map((tool) => `${tool}: declared capability; resolver verifies availability/authorization.`),
    sourceBlocks: allIds,
    traceMetadata: { ...assemblyPlan.traceMetadata, compileCandidateOnly: true, dynamicRoutingPrepared: true, noFakeTrace: true, noFabricatedVisualActivation: true, toolCapabilities: requiredTools },
    warnings: ['Generated architecture is runtime-session usable but not trusted library content.', 'Review workspace is optional/advanced inspection only.']
  };
  return { assemblyPlan, blockMatchPlan, compileCandidate };
}

export function buildArchitectRuntimeExecution(args: { plan: SleeveArchitectPlan; businessMap: BusinessMap; businessInput?: BusinessInput; policy?: ArchitectExecutionPolicy }) {
  const policy = args.policy ?? defaultArchitectExecutionPolicy;
  const route = args.plan.executionRoute ?? decideArchitectExecutionRoute(args.plan);
  const plan = { ...args.plan, executionRoute: route, executionPolicy: policy };
  const runtimeSleeve = makeRuntimeSleeve(plan, policy);
  const assemblyPlan = makeAssemblyPlan(plan, runtimeSleeve, policy);
  const blockMatchPlan = makeBlockMatchPlan(plan, runtimeSleeve, args.businessMap);
  const compileCandidate = makeCompileCandidate(plan, runtimeSleeve, assemblyPlan, blockMatchPlan, policy);
  return {
    route,
    routeReason: routeReason(route, plan),
    policy,
    plan,
    runtimeSleeve,
    assemblyPlan,
    blockMatchPlan,
    compileCandidate
  };
}
