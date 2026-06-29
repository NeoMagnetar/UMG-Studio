export type BlockMatchSource = 'template' | 'session' | 'library' | 'generatedDraft';

export type BlockMatchTargetKind = 'sleeve' | 'neostack' | 'neoblock' | 'molt' | 'gate';

export type BlockMatch = {
  id: string;
  source: BlockMatchSource;
  targetKind: BlockMatchTargetKind;
  targetId: string;
  sourceId?: string;
  title: string;
  summary: string;
  parentId?: string;
  parentTitle?: string;
  role?: string;
  confidence: number;
  reason: string;
  matchedSignals: string[];
  reusedExisting: boolean;
  proposedUse: 'directReuse' | 'partialReuse' | 'referenceOnly' | 'draftReplacementCandidate';
};

export type MissingCapabilityType = 'tool' | 'integration' | 'workflow' | 'channel' | 'data' | 'policy' | 'output' | 'domain' | 'templateGap';

export type MissingCapability = {
  id: string;
  title: string;
  description: string;
  capabilityType: MissingCapabilityType;
  sourceSignals: string[];
  whyMissing: string;
  suggestedBlockType: 'neostack' | 'neoblock' | 'molt' | 'gate';
  suggestedParentStackId?: string;
  suggestedParentNeoBlockId?: string;
  suggestedMoltRole?: 'directive' | 'instruction' | 'subject' | 'primary' | 'philosophy' | 'blueprint' | 'meta';
  requiresTool?: boolean;
  requestedToolCapability?: string;
  confidence: number;
  status: 'detected' | 'drafted' | 'accepted' | 'discarded';
};

export type GeneratedDraftBlockType = 'neostack' | 'neoblock' | 'molt' | 'gate';
export type GeneratedDraftSaveState = 'draft' | 'sleeveLocal' | 'librarySaved' | 'discarded' | 'empty';

export type GeneratedBlockDraft = {
  id: string;
  blockType: GeneratedDraftBlockType;
  role?: 'directive' | 'instruction' | 'subject' | 'primary' | 'philosophy' | 'blueprint' | 'meta';
  title: string;
  summary: string;
  body: string;
  tags: string[];
  sourceReason: string;
  proposedParent: string;
  proposedParentId?: string;
  sourceMissingCapabilityId?: string;
  saveState: GeneratedDraftSaveState;
  confidence: number;
  needsUserReview: boolean;
  accepted: boolean;
  defaultState: 'off' | 'on';
  metadata?: Record<string, unknown>;
};

export type BlockMatchPlan = {
  id: string;
  templateSleeveId: string;
  businessMapSummary: string;
  matchedSleeves: BlockMatch[];
  matchedNeoStacks: BlockMatch[];
  matchedNeoBlocks: BlockMatch[];
  matchedMoltBlocks: BlockMatch[];
  matchedGates: BlockMatch[];
  confidence: number;
  reasonForMatch: string;
  missingCapabilities: MissingCapability[];
  generatedDrafts: GeneratedBlockDraft[];
  createdAt: string;
  warnings: string[];
};

export type AssemblyEdge = {
  id: string;
  fromId: string;
  toId: string;
  kind: 'contains' | 'activates' | 'references' | 'requiresApproval' | 'usesTool' | 'follows';
};

export type SleeveAssemblyPlan = {
  id: string;
  sleeveId: string;
  sleeveTitle: string;
  templateSleeveId: string;
  selectedNeoStackIds: string[];
  selectedNeoBlockIds: string[];
  selectedMoltBlockIds: string[];
  selectedGateIds: string[];
  acceptedDraftIds: string[];
  discardedDraftIds: string[];
  edges: AssemblyEdge[];
  gates: string[];
  activeStates: Record<string, boolean>;
  disabledStates: Record<string, boolean>;
  executionOrder: string[];
  requiredTools: string[];
  approvalPoints: string[];
  compileStatus: 'not_compiled' | 'compile_ready' | 'compile_error';
  traceMetadata: Record<string, unknown>;
  warnings: string[];
  createdAt: string;
};

export type CompileCandidate = {
  id: string;
  assemblyPlanId: string;
  sleeveId: string;
  sleeveTitle: string;
  compileStatus: 'not_compiled' | 'ready_for_compiler';
  normalizedStructure: unknown;
  runtimeInstructions: string[];
  executionPlan: unknown[];
  toolPolicySummary: string[];
  sourceBlocks: string[];
  traceMetadata: Record<string, unknown>;
  warnings: string[];
};
