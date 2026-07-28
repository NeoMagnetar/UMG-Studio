import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import { normalizeMoltJsonSchema } from './hermesCustomSleeveGeneration';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve } from './templateSleeveStructures';
import type { UmgLibraryCandidate, UmgLibraryCandidatesByRole, UmgLibraryCandidateRoleBucket } from './umgLibraryCandidateRetrieval';
import { summarizeUmgLibraryCandidates, umgLibraryIndexInfo } from './umgLibraryCandidateRetrieval';
import { parseWorkflowIntent } from './umgWorkflowIntent';

export type ArchitectureDesignAgentSleeveInput = {
  sourcePrompt: string;
  retrievedLibraryCandidates?: UmgLibraryCandidate[];
  candidatesByRole?: UmgLibraryCandidatesByRole;
  missingRoles?: UmgLibraryCandidateRoleBucket[];
  rejectedCandidateIds?: string[];
  uploadedContext?: string;
  generationFailureReason?: string;
  requestId?: string;
};

type ArchitectBlockSpec = {
  id: string;
  stackId: string;
  title: string;
  description: string;
  gateIds?: string[];
};

const moltRoles: Array<NormalizedTemplateMoltBlock['role']> = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];

const stackSpecs = [
  { id: 'ARCH.STACK.CLIENT_INTAKE', title: 'CLIENT_INTAKE_STACK', description: 'Capture client goals, site address, design scope, budget range, schedule, review cadence, and decision stakeholders.' },
  { id: 'ARCH.STACK.SITE_CONTEXT', title: 'SITE_CONTEXT_STACK', description: 'Organize site constraints, orientation, access, climate, adjacencies, survey assumptions, and GIS/site data warnings.' },
  { id: 'ARCH.STACK.PROGRAM_REQUIREMENTS', title: 'PROGRAM_REQUIREMENTS_STACK', description: 'Translate client brief into program spaces, relationships, occupancy assumptions, area targets, and success criteria.' },
  { id: 'ARCH.STACK.CONCEPT_DESIGN', title: 'CONCEPT_DESIGN_STACK', description: 'Generate massing, circulation, spatial organization, envelope ideas, and concept narratives for review.' },
  { id: 'ARCH.STACK.CODE_AND_CONSTRAINTS', title: 'CODE_AND_CONSTRAINTS_STACK', description: 'Plan zoning/code review, accessibility assumptions, life-safety checkpoints, setbacks, and compliance questions without claiming authority.' },
  { id: 'ARCH.STACK.MATERIAL_SYSTEMS', title: 'MATERIAL_SYSTEMS_STACK', description: 'Compare structure, envelope, material palettes, sustainability goals, constructability, and cost-risk tradeoffs.' },
  { id: 'ARCH.STACK.DOCUMENTATION', title: 'DOCUMENTATION_STACK', description: 'Plan drawings, schedules, narratives, construction-document sequencing, and coordination notes.' },
  { id: 'ARCH.STACK.REVIEW_AND_ITERATION', title: 'REVIEW_AND_ITERATION_STACK', description: 'Manage client review, consultant coordination, issue tracking, option comparison, and revision loops.' },
  { id: 'ARCH.STACK.RUNTIME_OBSERVER', title: 'RUNTIME_OBSERVER_STACK', description: 'Report deterministic fallback route, missing optional architecture tools, compile readiness, and runtime trace state.' }
] as const;

const blockSpecs: ArchitectBlockSpec[] = [
  { id: 'ARCH.BLOCK.CLIENT_BRIEF_INTAKE', stackId: 'ARCH.STACK.CLIENT_INTAKE', title: 'CLIENT_BRIEF_INTAKE', description: 'Gather client goals, project type, decision criteria, budget, timeline, and deliverables.', gateIds: ['ARCH.GATE.CLIENT_REVIEW_GATE'] },
  { id: 'ARCH.BLOCK.EXISTING_CONDITIONS_SUMMARY', stackId: 'ARCH.STACK.SITE_CONTEXT', title: 'EXISTING_CONDITIONS_SUMMARY', description: 'Summarize site context, orientation, climate, utility assumptions, access, survey gaps, and risks.' },
  { id: 'ARCH.BLOCK.PROGRAM_MATRIX_BUILDER', stackId: 'ARCH.STACK.PROGRAM_REQUIREMENTS', title: 'PROGRAM_MATRIX_BUILDER', description: 'Create a program matrix with spaces, approximate areas, adjacency needs, and priority notes.' },
  { id: 'ARCH.BLOCK.CONCEPT_MASSING_PLANNER', stackId: 'ARCH.STACK.CONCEPT_DESIGN', title: 'CONCEPT_MASSING_PLANNER', description: 'Develop concept massing, circulation, zoning of public/private/service zones, and narrative options.' },
  { id: 'ARCH.BLOCK.CODE_CONSTRAINT_REVIEW', stackId: 'ARCH.STACK.CODE_AND_CONSTRAINTS', title: 'CODE_CONSTRAINT_REVIEW', description: 'Identify likely zoning/code/accessibility/life-safety questions for professional verification.', gateIds: ['ARCH.GATE.CODE_REVIEW_GATE'] },
  { id: 'ARCH.BLOCK.MATERIAL_AND_SYSTEMS_SELECTOR', stackId: 'ARCH.STACK.MATERIAL_SYSTEMS', title: 'MATERIAL_AND_SYSTEMS_SELECTOR', description: 'Compare structure/envelope/material systems and flag sustainability, availability, maintenance, and cost implications.' },
  { id: 'ARCH.BLOCK.DOCUMENTATION_PLAN', stackId: 'ARCH.STACK.DOCUMENTATION', title: 'DOCUMENTATION_PLAN', description: 'Plan schematic/design-development/construction-document outputs, drawing sets, schedules, and coordination notes.' },
  { id: 'ARCH.BLOCK.COORDINATION_ISSUE_REVIEW', stackId: 'ARCH.STACK.REVIEW_AND_ITERATION', title: 'COORDINATION_ISSUE_REVIEW', description: 'Track client comments, consultant issues, option comparisons, and revision decisions without writing external systems.', gateIds: ['ARCH.GATE.COORDINATION_GATE'] },
  { id: 'ARCH.BLOCK.RUNTIME_TRACE_REPORTER', stackId: 'ARCH.STACK.RUNTIME_OBSERVER', title: 'RUNTIME_TRACE_REPORTER', description: 'Report deterministic architecture fallback, missing optional connectors, compile eligibility, and runtime graph readiness.' }
];

const missingOptionalTools = [
  'Revit/BIM connector',
  'CAD/DWG connector',
  'PDF markup connector',
  'rendering pipeline connector',
  'GIS/site data connector',
  'BCF/coordination issue connector'
];

function nlCardFor(title: string, role: string, content: string, tags: string[]) {
  return { title, role, category: 'deterministic_architecture_design_agent', tags, description: content, content };
}

function schemaFor(kind: string, title: string) {
  return { type: 'object', required: ['id', 'title', 'content'], properties: { id: { type: 'string' }, title: { type: 'string', const: title }, content: { type: 'string' }, kind: { type: 'string', const: kind } } };
}

function moltFor(block: ArchitectBlockSpec, role: NormalizedTemplateMoltBlock['role'], roleIndex: number, globalIndex: number): NormalizedTemplateMoltBlock {
  const title = `${block.title} ${role.toUpperCase()}`;
  const tags = ['architecture-design-agent', 'modern-architect', 'runtime-session', role];
  const content = `${block.description} Role: ${role}. This deterministic runtime-session draft supports architectural design planning without external tool requirements; missing Revit/BIM, CAD/DWG, PDF markup, rendering, GIS/site data, and BCF coordination connectors are warnings only, not compile blockers.`;
  const base = {
    id: `${block.id}.MOLT.${role.toUpperCase()}.${roleIndex + 1}`,
    title,
    role,
    content,
    description: content,
    tags,
    parentNeoBlockId: block.id,
    parentNeoStackId: block.stackId,
    stackOrder: globalIndex,
    sourceKind: 'runtime-session draft' as const,
    blockType: 'molt' as const,
    defaultState: 'off' as const,
    generationReason: `Deterministic architecture_design_agent fallback generated this ${role} MOLT because optional architecture tools are not required for compile eligibility.`
  };
  return { ...base, nlCard: nlCardFor(title, role, content, tags), jsonSchema: normalizeMoltJsonSchema(base) };
}

function gateRecord(id: string, title: string, blockId: string, conditionText: string, action: UMGGateRecord['action']): UMGGateRecord {
  return { id, title, attachesTo: { kind: 'neoblock', id: blockId }, triggerType: action === 'require_approval' ? 'approval' : 'runtime_condition', conditionText, action, targetIds: [blockId], defaultState: 'closed', runtimeState: 'inactive', tags: ['architecture-design-agent', 'modern-architect', 'runtime-control', 'gate'], metadata: { promptContent: false, sourceKind: 'runtime-session draft' } };
}

export function buildArchitectureDesignAgentSleeve(input: ArchitectureDesignAgentSleeveInput): NormalizedTemplateSleeve {
  const requestId = input.requestId ?? `architecture_design_agent_${Date.now()}`;
  const intent = parseWorkflowIntent(input.sourcePrompt);
  const neoStacks: NormalizedTemplateNeoStack[] = stackSpecs.map((stack, index) => ({
    id: stack.id,
    title: stack.title,
    description: stack.description,
    stackOrder: index + 1,
    tags: ['architecture-design-agent', 'modern-architect', 'runtime-session'],
    neoBlockIds: blockSpecs.filter((block) => block.stackId === stack.id).map((block) => block.id),
    sourceKind: 'runtime-session draft',
    blockType: 'neostack',
    generationReason: 'Deterministic architecture_design_agent fallback stack generated without source-library mutation.',
    nlCard: nlCardFor(stack.title, 'neostack', stack.description, ['architecture-design-agent', 'neostack']),
    jsonSchema: schemaFor('neostack', stack.title)
  }));
  const neoBlocks: NormalizedTemplateNeoBlock[] = blockSpecs.map((block, index) => ({
    id: block.id,
    title: block.title,
    description: block.description,
    neoStackId: block.stackId,
    blockOrder: index + 1,
    tags: ['architecture-design-agent', 'modern-architect', 'runtime-session'],
    moltBlockIds: moltRoles.map((role, roleIndex) => `${block.id}.MOLT.${role.toUpperCase()}.${roleIndex + 1}`),
    gateIds: block.gateIds ?? [],
    defaultState: 'off',
    runtimeState: 'idle',
    sourceKind: 'runtime-session draft',
    blockType: 'neoblock',
    generationReason: 'Deterministic architecture_design_agent fallback NeoBlock generated to fill compile-required workflow structure.',
    nlCard: nlCardFor(block.title, 'neoblock', block.description, ['architecture-design-agent', 'neoblock']),
    jsonSchema: schemaFor('neoblock', block.title)
  }));
  let globalMoltIndex = 0;
  const moltBlocks = blockSpecs.flatMap((block) => moltRoles.map((role, roleIndex) => moltFor(block, role, roleIndex, ++globalMoltIndex)));
  const gates = [
    gateRecord('ARCH.GATE.CLIENT_REVIEW_GATE', 'CLIENT_REVIEW_GATE', 'ARCH.BLOCK.CLIENT_BRIEF_INTAKE', 'Require client review before treating design criteria as settled.', 'require_approval'),
    gateRecord('ARCH.GATE.CODE_REVIEW_GATE', 'CODE_REVIEW_GATE', 'ARCH.BLOCK.CODE_CONSTRAINT_REVIEW', 'Treat code and zoning outputs as planning prompts for licensed professional review.', 'require_approval'),
    gateRecord('ARCH.GATE.COORDINATION_GATE', 'COORDINATION_GATE', 'ARCH.BLOCK.COORDINATION_ISSUE_REVIEW', 'Keep consultant coordination issues reviewable until a real BCF/issue connector is attached.', 'activate')
  ];
  const candidateCount = input.retrievedLibraryCandidates?.length ?? 0;
  const sourceStatusSummary = {
    candidateCount,
    candidatesBoundIntoSleeve: 0,
    runtimeWorkspaceDraftBlocksGenerated: neoStacks.length + neoBlocks.length + moltBlocks.length,
    generatedRuntimeDrafts: moltBlocks.length,
    sourceBindingStatus: 'runtime_draft_fallback_no_source_binding',
    compileEligibility: 'yes',
    reason: 'Recognized architecture_design_agent intent; deterministic runtime/workspace draft blocks fill required structure. Source-library binding and optional architecture tools are not required for compile eligibility.',
    libraryIndex: { moltBlocks: umgLibraryIndexInfo.counts?.molt ?? 0, neoBlocks: umgLibraryIndexInfo.counts?.neoblock ?? 0, neoStacks: umgLibraryIndexInfo.counts?.neostack ?? 0, metaMoltToolBlocks: 0 }
  };
  return {
    id: `SLV.ARCH.MODERN_ARCHITECT.${requestId}`,
    title: 'Modern Architect Sleeve',
    version: '1.0.0',
    description: 'Deterministic compile-eligible UMG Sleeve for architecture/design planning. It handles client intake, site context, program requirements, concept design, code/constraint review, material systems, documentation planning, review iteration, and runtime observation without requiring external architecture tools at generation time.',
    isTemplate: true,
    templateKind: 'custom',
    source: 'session',
    tags: ['architecture-design-agent', 'modern-architect', 'architect-sleeve', 'deterministic-fallback', 'runtime-session'],
    neoStacks,
    neoBlocks,
    moltBlocks,
    gates,
    governanceBlockIds: gates.map((gate) => gate.id),
    defaultExecutionMode: 'approvalRequired',
    metadata: {
      requestId,
      sourcePrompt: input.sourcePrompt,
      uploadedContext: input.uploadedContext,
      workflowIntent: intent,
      workflowIntentName: 'architecture_design_agent',
      workflowIntentSubtype: 'modern_architect_sleeve',
      inferredIndustry: 'architecture / building design',
      coreOperations: ['client intake', 'site context', 'program requirements', 'concept design', 'code review planning', 'construction documentation planning'],
      generationRoute: 'deterministic_architecture_design_agent',
      deterministicFallbackUsed: 'architecture_design_agent',
      fallbackUsed: true,
      fallbackReason: 'recognized architecture_design_agent prompt; deterministic Modern Architect Sleeve fallback is compile-eligible without live Hermes or architecture connectors',
      hermesEnhancementFailed: Boolean(input.generationFailureReason),
      hermesEnhancementWarning: input.generationFailureReason ? `Hermes enhancement failed: ${input.generationFailureReason}` : undefined,
      liveHermesGenerated: false,
      generatedByHermes: false,
      noFakeLiveHermesGeneration: true,
      noFakeHermesOutput: true,
      noFakeSourceBinding: true,
      sourceLibraryWrite: false,
      protectedSourceLibraryWrite: false,
      compileEligible: true,
      compileEligibility: 'yes',
      libraryCandidateSummary: summarizeUmgLibraryCandidates(input.retrievedLibraryCandidates ?? [], input.candidatesByRole),
      libraryCandidates: (input.retrievedLibraryCandidates ?? []).slice(0, 24),
      candidatesByRole: input.candidatesByRole ?? {},
      missingRoles: input.missingRoles ?? [],
      rejectedCandidateIds: input.rejectedCandidateIds ?? [],
      generatedDrafts: [...neoStacks.map((stack) => stack.id), ...neoBlocks.map((block) => block.id), ...moltBlocks.map((block) => block.id)],
      sourceStatusSummary,
      missingOptionalTools,
      capabilitiesNeeded: missingOptionalTools,
      capabilities: [],
      toolAvailabilityMessage: 'Missing architecture connectors are warnings only; compile eligibility does not require Revit/BIM, CAD/DWG, PDF markup, rendering, GIS/site data, or BCF connectors.',
      warnings: [
        'Deterministic fallback used: architecture_design_agent / modern_architect_sleeve.',
        ...(input.generationFailureReason ? [`Hermes enhancement failed: ${input.generationFailureReason}; warning only.`] : []),
        'Missing architecture connectors are warnings only, not compile blockers.',
        'No source-library candidates were claimed as bound; all generated structure is runtime-session draft content.'
      ]
    }
  };
}
