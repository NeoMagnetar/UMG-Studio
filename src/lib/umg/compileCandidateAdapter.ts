import type { BlockMatchPlan, CompileCandidate, SleeveAssemblyPlan } from './blockMatchingTypes';
import type { BusinessInput, BusinessMap } from './businessIntakeTypes';
import type { UMGCompilerInput, UMGCompilerRequest } from './compilerIntegrationTypes';

export function createCompilerInputFromCompileCandidate(args: {
  compileCandidate: CompileCandidate;
  assemblyPlan: SleeveAssemblyPlan;
  blockMatchPlan: BlockMatchPlan;
  businessMap: BusinessMap;
  businessInput?: BusinessInput;
}): UMGCompilerInput {
  const { compileCandidate, assemblyPlan, blockMatchPlan, businessMap, businessInput } = args;
  if (compileCandidate.compileStatus !== 'ready_for_compiler') {
    throw new Error('CompileCandidate must be ready_for_compiler before compiler input can be created.');
  }
  const normalizedStructure = structuredClone(compileCandidate.normalizedStructure) as Record<string, unknown>;
  const normalizedGates = Array.isArray(normalizedStructure.gates) ? normalizedStructure.gates : [];

  return {
    id: `compiler_input_${compileCandidate.id}`,
    compileCandidateId: compileCandidate.id,
    assemblyPlanId: assemblyPlan.id,
    sleeveId: compileCandidate.sleeveId,
    sleeveTitle: compileCandidate.sleeveTitle,
    normalizedStructure,
    gates: normalizedGates.length ? normalizedGates : [...assemblyPlan.gates],
    activeStates: { ...assemblyPlan.activeStates },
    disabledStates: { ...assemblyPlan.disabledStates },
    executionOrder: [...assemblyPlan.executionOrder],
    requiredTools: [...assemblyPlan.requiredTools],
    approvalPoints: [...assemblyPlan.approvalPoints],
    runtimeInstructions: [...compileCandidate.runtimeInstructions],
    sourceBlocks: [...compileCandidate.sourceBlocks],
    traceMetadata: {
      ...compileCandidate.traceMetadata,
      businessSummary: businessMap.businessSummary,
      selectedTemplateSleeveId: blockMatchPlan.templateSleeveId,
      blockMatchPlanId: blockMatchPlan.id,
      assemblyPlanId: assemblyPlan.id,
      acceptedDraftIds: [...assemblyPlan.acceptedDraftIds],
      missingCapabilityCount: blockMatchPlan.missingCapabilities.length,
      generatedDraftCount: blockMatchPlan.generatedDrafts.length,
      compileCandidateId: compileCandidate.id,
      requestedAgentType: businessInput?.requestedAgentType,
      source: 'umg-studio-phase6-compiler-input'
    },
    metadata: {
      compileCandidateWarnings: [...compileCandidate.warnings],
      assemblyWarnings: [...assemblyPlan.warnings],
      blockMatchWarnings: [...blockMatchPlan.warnings]
    }
  };
}

export function validateCompilerInput(input: UMGCompilerInput): string[] {
  const errors: string[] = [];
  if (!input.sleeveId) errors.push('sleeveId is required.');
  if (!input.sleeveTitle) errors.push('sleeveTitle is required.');
  if (input.normalizedStructure === undefined || input.normalizedStructure === null) errors.push('normalizedStructure is required.');
  if (!Array.isArray(input.executionOrder)) errors.push('executionOrder must be an array.');
  if (!Array.isArray(input.sourceBlocks)) errors.push('sourceBlocks must be an array.');
  if (!Array.isArray(input.requiredTools)) errors.push('requiredTools must be an array.');
  if (!Array.isArray(input.approvalPoints)) errors.push('approvalPoints must be an array.');
  if (Array.isArray(input.sourceBlocks) && input.sourceBlocks.length < 1) errors.push('at least one source block is required.');
  if (Array.isArray(input.executionOrder) && input.executionOrder.length < 1) errors.push('at least one execution order entry is required.');
  return errors;
}

export function createCompilerRequest(input: UMGCompilerInput): UMGCompilerRequest {
  return {
    input,
    mode: 'compile',
    requestedAt: new Date().toISOString(),
    source: 'umg-studio',
    schemaVersion: 'phase6.compiler-request.v1'
  };
}
