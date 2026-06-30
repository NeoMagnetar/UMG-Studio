import { UMGGateRecord } from './cognitiveRuntimeTypes';
import { MOLTRole, Sleeve } from './types';

export type NormalizedTemplateSourceKind = 'source-library reused' | 'reuse decision' | 'runtime-session draft' | 'generated glue' | 'metamolt tool' | 'unresolved';

export type NormalizedTemplateSourceMetadata = {
  sourceKind?: NormalizedTemplateSourceKind;
  reusedBlockId?: string;
  sourcePath?: string;
  matchedCandidateId?: string;
  blockType?: 'molt' | 'neoblock' | 'neostack' | 'gate' | 'capability' | 'unknown';
};

export type NormalizedTemplateNeoStack = {
  id: string;
  title: string;
  description: string;
  stackOrder: number;
  tags: string[];
  neoBlockIds: string[];
} & NormalizedTemplateSourceMetadata;

export type NormalizedTemplateNeoBlock = {
  id: string;
  title: string;
  description: string;
  neoStackId: string;
  blockOrder: number;
  tags: string[];
  moltBlockIds: string[];
  gateIds: string[];
  defaultState: 'off' | 'on';
  runtimeState?: 'idle' | 'queued' | 'active' | 'processing' | 'complete' | 'skipped' | 'blocked' | 'error';
} & NormalizedTemplateSourceMetadata;

export type NormalizedTemplateMoltBlock = {
  id: string;
  sourceId?: string;
  title: string;
  role: Exclude<MOLTRole, 'trigger'> | 'meta';
  content: string;
  tags: string[];
  parentNeoBlockId?: string;
  parentNeoStackId?: string;
  stackOrder?: number;
  sourceNotes?: string[];
  defaultState: 'off' | 'on';
} & NormalizedTemplateSourceMetadata;

export type NormalizedTemplateSleeve = {
  id: string;
  title: string;
  version: string;
  description: string;
  isTemplate: true;
  templateKind: 'business' | 'website' | 'chatbot' | 'research' | 'developer' | 'custom';
  source: 'built_in_seed' | 'library' | 'session' | 'planned';
  tags: string[];
  neoStacks: NormalizedTemplateNeoStack[];
  neoBlocks: NormalizedTemplateNeoBlock[];
  moltBlocks: NormalizedTemplateMoltBlock[];
  gates: UMGGateRecord[];
  governanceBlockIds: string[];
  defaultExecutionMode: 'dryRun' | 'approvalRequired' | 'liveAllowed';
  metadata: Record<string, unknown>;
};

export type InstantiatedTemplateSleeve = {
  templateSleeve: NormalizedTemplateSleeve;
  sleeve: Sleeve;
  recommendedStackIds: string[];
  stats: {
    neoStacks: number;
    neoBlocks: number;
    moltBlocks: number;
    gates: number;
    governanceBlocks: number;
  };
};

const numberFromMetadata = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;

export function summarizeNormalizedTemplateSourceStatus(sleeve: NormalizedTemplateSleeve) {
  const hierarchyNodes = [...sleeve.neoStacks, ...sleeve.neoBlocks, ...sleeve.moltBlocks];
  const nodeLevelReusedCount = hierarchyNodes.filter((entry) => entry.sourceKind === 'source-library reused').length;
  const generatedGlueCount = hierarchyNodes.filter((entry) => entry.sourceKind === 'generated glue').length;
  const runtimeDraftCount = hierarchyNodes.filter((entry) => entry.sourceKind === 'runtime-session draft').length;
  const metaMoltToolBlockCount = hierarchyNodes.filter((entry) => entry.sourceKind === 'metamolt tool' || entry.tags?.some((tag) => tag === 'metamolt' || tag === 'tool')).length;
  const unresolvedCount = hierarchyNodes.filter((entry) => entry.sourceKind === 'unresolved').length;
  const sourceStatusSummary = (sleeve.metadata?.sourceStatusSummary ?? {}) as Record<string, unknown>;
  const reuseDecisionCount = numberFromMetadata(sourceStatusSummary.reuseDecisionCount);
  const generatedGlueDecisionCount = numberFromMetadata(sourceStatusSummary.generatedGlueDecisionCount);
  const libraryCandidateCount = numberFromMetadata(sourceStatusSummary.libraryCandidateCount);
  const sourceBindingStatus = reuseDecisionCount === 0
    ? 'missing'
    : nodeLevelReusedCount >= reuseDecisionCount
      ? 'complete'
      : 'partial';
  const sourceBindingWarning = reuseDecisionCount > 0 && nodeLevelReusedCount < reuseDecisionCount
    ? 'Reuse decisions received; node-level source binding incomplete.'
    : undefined;
  return {
    libraryCandidateCount,
    nodeLevelReusedCount,
    reuseDecisionCount,
    generatedGlueCount,
    generatedGlueDecisionCount,
    runtimeDraftCount,
    metaMoltToolBlockCount,
    unresolvedCount,
    sourceBindingStatus,
    sourceBindingWarning
  };
}
