import { UMGGateRecord } from './cognitiveRuntimeTypes';
import { MOLTRole, Sleeve } from './types';

export type NormalizedTemplateNeoStack = {
  id: string;
  title: string;
  description: string;
  stackOrder: number;
  tags: string[];
  neoBlockIds: string[];
};

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
};

export type NormalizedTemplateMoltBlock = {
  id: string;
  sourceId?: string;
  title: string;
  role: Exclude<MOLTRole, 'trigger'> | 'meta';
  content: string;
  tags: string[];
  parentNeoBlockId?: string;
  parentNeoStackId?: string;
  sourceNotes?: string[];
  defaultState: 'off' | 'on';
};

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
