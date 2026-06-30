import type { UMGGateRecord } from './cognitiveRuntimeTypes';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock, NormalizedTemplateNeoStack, NormalizedTemplateSleeve } from './templateSleeveStructures';
import type { UmgSupportedPromptMoltRole } from './hermesUmgSkillBundle';

export type HermesSleevePlanReuseDecision = {
  id: string;
  targetKind: 'molt' | 'neoblock' | 'neostack' | 'sleeve' | 'gate' | 'capability';
  reusedId: string;
  reason: string;
  confidence: number;
};

export type HermesSleevePlanGeneratedDecision = {
  id: string;
  targetKind: 'molt' | 'neoblock' | 'neostack' | 'sleeve' | 'gate' | 'capability';
  proposedId: string;
  reason: string;
  runtimeSessionOnly: true;
  sourceLibraryWrite: false;
  needsUserReview: boolean;
};

export type HermesSleevePlanCapabilityDeclaration = {
  id: string;
  capabilityId: string;
  label: string;
  reason: string;
  riskHint: 'low' | 'medium' | 'high' | 'irreversible' | 'unknown';
  connectorRequired: boolean;
  appLocalOnly: boolean;
};

export type HermesGeneratedMoltBlock = Omit<NormalizedTemplateMoltBlock, 'role'> & {
  role: UmgSupportedPromptMoltRole;
};

export type HermesCustomSleevePlan = {
  schemaVersion: 'umg-studio.hermes-custom-sleeve-plan.v0.1';
  source: 'hermes_custom_workflow_generation';
  mode: 'runtime_session_draft';
  sleeve: NormalizedTemplateSleeve;
  neoStacks: NormalizedTemplateNeoStack[];
  neoBlocks: NormalizedTemplateNeoBlock[];
  moltBlocks: HermesGeneratedMoltBlock[];
  gates: UMGGateRecord[];
  capabilities: HermesSleevePlanCapabilityDeclaration[];
  reuseDecisions: HermesSleevePlanReuseDecision[];
  generatedDecisions: HermesSleevePlanGeneratedDecision[];
  warnings: string[];
  validationNotes: string[];
};

export const HERMES_CUSTOM_SLEEVE_PLAN_SCHEMA_NOTE = [
  'Future Hermes custom Sleeve generation must return app-aligned structures, not uploaded bundle card schemas.',
  'sleeve maps to NormalizedTemplateSleeve.',
  'neoStacks map to NormalizedTemplateNeoStack.',
  'neoBlocks map to NormalizedTemplateNeoBlock.',
  'moltBlocks map to NormalizedTemplateMoltBlock with supported prompt roles only: directive, instruction, subject, primary, philosophy, blueprint.',
  'gates map to UMGGateRecord control/routing/approval records, not prompt MOLT blocks.',
  'capabilities are declarations only and are resolved by HermesToolCapabilityRegistry/toolCapabilityResolver later.',
  'generatedDecisions must mark runtimeSessionOnly true and sourceLibraryWrite false unless a separate explicit save/promote flow exists.'
].join('\n');

export function validateHermesCustomSleevePlanScaffold(plan: Pick<HermesCustomSleevePlan, 'schemaVersion' | 'mode' | 'moltBlocks' | 'generatedDecisions'>): string[] {
  const errors: string[] = [];
  if (plan.schemaVersion !== 'umg-studio.hermes-custom-sleeve-plan.v0.1') errors.push('Unsupported Hermes custom Sleeve plan schemaVersion.');
  if (plan.mode !== 'runtime_session_draft') errors.push('Hermes custom Sleeve plan must be runtime_session_draft.');
  const supportedRoles = new Set(['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint']);
  plan.moltBlocks.forEach((block) => {
    if (!supportedRoles.has(block.role)) errors.push(`Unsupported prompt MOLT role: ${block.role}`);
  });
  plan.generatedDecisions.forEach((decision) => {
    if (decision.runtimeSessionOnly !== true) errors.push(`Generated decision ${decision.id} must be runtimeSessionOnly.`);
    if (decision.sourceLibraryWrite !== false) errors.push(`Generated decision ${decision.id} must keep sourceLibraryWrite false.`);
  });
  return errors;
}
