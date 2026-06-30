import type { UMGGateRecord, UMGSourceBlockRef, UMGTraceEvent } from './cognitiveRuntimeTypes';
import type { NormalizedTemplateSleeve } from './templateSleeveStructures';

export type RuntimeGeometryState =
  | 'idle'
  | 'queued'
  | 'active'
  | 'processing'
  | 'attention'
  | 'approval'
  | 'waiting_approval'
  | 'tool_calling'
  | 'blocked'
  | 'complete'
  | 'error'
  | 'unmapped';

export type RuntimeGeometryViewMode = 'builder' | 'structure' | 'runtime';

export type RuntimeConnectionType =
  | 'hierarchy'
  | 'dependency'
  | 'execution_next'
  | 'gate_control'
  | 'tool_capability'
  | 'data_source'
  | 'memory_context'
  | 'feedback_loop'
  | 'inheritance'
  | 'reuse_binding';

export type GeometryLayoutHint = {
  arrangement?: 'skyline' | 'pyramid' | 'cluster' | 'tiered' | 'hub_spoke' | 'asymmetric';
  semanticGroup?: 'foundation' | 'dependency_data' | 'execution' | 'synthesis_strategy' | 'feedback_optimization';
  orderIndex?: number;
  tier?: number;
  column?: number;
  row?: number;
  weight?: number;
  expandedByDefault?: boolean;
  notes?: string[];
};

export type RuntimeGeometryBaseNode = {
  id: string;
  sourceId?: string;
  label: string;
  description?: string;
  state: RuntimeGeometryState;
  layoutHint?: GeometryLayoutHint;
  mappedTraceEventIds?: string[];
  aliases?: string[];
  metadata?: Record<string, unknown>;
};

export type SleeveGeometryNode = RuntimeGeometryBaseNode & {
  kind: 'sleeve';
  sleeveId: string;
  neoStackIds: string[];
  foundationIds: string[];
  templateSleeve?: Pick<NormalizedTemplateSleeve, 'id' | 'title' | 'version' | 'templateKind'>;
};

export type NeoStackGeometryNode = RuntimeGeometryBaseNode & {
  kind: 'neostack';
  sleeveId: string;
  neoStackId: string;
  neoBlockIds: string[];
  domainPurpose?: string;
};

export type NeoBlockGeometryNode = RuntimeGeometryBaseNode & {
  kind: 'neoblock';
  sleeveId: string;
  neoStackId: string;
  neoBlockId: string;
  moltBindingIds: string[];
  gateIds: string[];
  toolEndpointIds: string[];
  roleHealth?: {
    hasDirective: boolean;
    hasInstruction: boolean;
    hasSubject: boolean;
    hasPrimary: boolean;
    hasBlueprint: boolean;
    warnings: string[];
  };
};

export type MoltGeometryBindingNode = RuntimeGeometryBaseNode & {
  kind: 'molt_binding';
  moltBlockId: string;
  reusedBlockId?: string;
  localSlotRole: 'directive' | 'instruction' | 'subject' | 'primary' | 'philosophy' | 'blueprint' | 'meta' | 'other';
  parentNeoBlockId: string;
  parentNeoStackId?: string;
  bindingReason?: string;
  inheritedFrom?: string;
  localOverride?: boolean;
};

export type GateGeometryNode = RuntimeGeometryBaseNode & {
  kind: 'gate';
  gateId: string;
  gate?: Pick<UMGGateRecord, 'id' | 'title' | 'attachesTo' | 'triggerType' | 'action' | 'targetIds' | 'defaultState'>;
  controlsConnectionIds: string[];
  controlsNodeIds: string[];
};

export type ToolEndpointNode = RuntimeGeometryBaseNode & {
  kind: 'tool_endpoint';
  toolId: string;
  provider?: string;
  capabilityLabel?: string;
  requiredByNodeIds: string[];
};

export type RuntimeGeometryNode =
  | SleeveGeometryNode
  | NeoStackGeometryNode
  | NeoBlockGeometryNode
  | MoltGeometryBindingNode
  | GateGeometryNode
  | ToolEndpointNode;

export type RuntimeConnection = {
  id: string;
  type: RuntimeConnectionType;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  state: RuntimeGeometryState;
  gateId?: string;
  layoutHint?: GeometryLayoutHint;
  mappedTraceEventIds?: string[];
  metadata?: Record<string, unknown>;
};

export type UMGGeometryManifest = {
  id: string;
  sleeveId: string;
  viewMode: RuntimeGeometryViewMode;
  generatedAt?: string;
  nodes: RuntimeGeometryNode[];
  connections: RuntimeConnection[];
  sourceBlocks: UMGSourceBlockRef[];
  runtimeTraceEvents?: UMGTraceEvent[];
  unmappedEvents?: UMGTraceEvent[];
  layoutHint?: GeometryLayoutHint;
  metadata?: Record<string, unknown>;
};
