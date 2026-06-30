import type { BusinessInput, BusinessMap } from './businessIntakeTypes';
import type { GeneratedBlockDraft } from './blockMatchingTypes';
import type { MOLTRole, UMGBlock } from './types';

export type SleeveArchitectureMode =
  | 'demo_template_mode'
  | 'architect_mode'
  | 'imported_sleeve_mode'
  | 'draft_generated_sleeve_mode';

export type ArchitectMoltRole = MOLTRole | 'gate_control' | 'strategy' | 'aim' | 'need' | 'use_case';

export type ArchitectNeoStackProposal = {
  id: string;
  title: string;
  reason: string;
  semanticTags: string[];
  draftOnly: boolean;
};

export type ArchitectNeoBlockProposal = {
  id: string;
  title: string;
  parentNeoStackId: string;
  purpose: string;
  requiredMoltRoles: MOLTRole[];
  draftOnly: boolean;
};

export type ArchitectMoltBlockProposal = {
  id: string;
  title: string;
  role: MOLTRole;
  parentNeoBlockId: string;
  summary: string;
  draftOnly: boolean;
  matchedExistingBlockId?: string;
};

export type ArchitectGateProposal = {
  id: string;
  title: string;
  controlledNeoBlockId?: string;
  reason: string;
  draftOnly: boolean;
};

export type ArchitectBlockMatch = {
  blockId: string;
  title: string;
  role: MOLTRole;
  score: number;
  matchedTags: string[];
  reason: string;
  source: 'loaded_local_blocks' | 'template_blocks' | 'uploaded_blocks';
};

export type LegacyRoleMapping = {
  legacyRole: string;
  normalizedRole: ArchitectMoltRole;
  target: 'gate' | 'molt' | 'metadata' | 'approval_point' | 'constraint';
  reason: string;
};

export type SleeveArchitectPlan = {
  id: string;
  mode: SleeveArchitectureMode;
  sourcePrompt: string;
  uploadedContextSummary: string;
  requestedAgentType?: BusinessInput['requestedAgentType'];
  domainSummary: string;
  userGoal: string;
  extractedWorkflow: string[];
  actors: string[];
  dataSources: string[];
  toolCapabilityNeeds: Array<{ id: string; capability: string; whyDeclared: string; executionEnabled: false }>;
  approvalPoints: string[];
  riskPoints: string[];
  expectedOutputs: string[];
  proposedSleeveId: string;
  proposedSleeveTitle: string;
  proposedGovernancePrimaries: string[];
  proposedNeoStacks: ArchitectNeoStackProposal[];
  proposedNeoBlocks: ArchitectNeoBlockProposal[];
  proposedMoltBlocks: ArchitectMoltBlockProposal[];
  proposedGates: ArchitectGateProposal[];
  matchedExistingBlocks: ArchitectBlockMatch[];
  semanticSearchQueries: string[];
  semanticTags: string[];
  missingCapabilities: string[];
  generatedDrafts: GeneratedBlockDraft[];
  legacyRoleMappings: LegacyRoleMapping[];
  confidence: number;
  warnings: string[];
};

export type BuildSleeveArchitectPlanInput = {
  businessInput: BusinessInput;
  businessMap: BusinessMap;
  availableBlocks: UMGBlock[];
  mode?: SleeveArchitectureMode;
};

export const architectureModeLabels: Record<SleeveArchitectureMode, string> = {
  demo_template_mode: 'Seed Template Mode',
  architect_mode: 'Architect Mode',
  imported_sleeve_mode: 'Imported Sleeve Mode',
  draft_generated_sleeve_mode: 'Draft Generated Sleeve Mode'
};

export const architectureModeDescriptions: Record<SleeveArchitectureMode, string> = {
  demo_template_mode: 'Loads an existing seed/demo Sleeve to prove compile, runtime, trace, and geometry.',
  architect_mode: 'Builds a unique Sleeve plan from prompt, uploaded context, semantic block matches, and draft-generated missing blocks.',
  imported_sleeve_mode: 'Uses a full uploaded/imported Sleeve as a draft/audit source before acceptance.',
  draft_generated_sleeve_mode: 'Creates an in-session draft Sleeve when no full matching library/template structure exists.'
};
