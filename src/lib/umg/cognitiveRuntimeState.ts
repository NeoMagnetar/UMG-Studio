import { UMGTraceEvent, UMGTraceEventType, UMGRuntimeScopeKind, UMGRuntimeState, UMGRuntimeVisualState } from './cognitiveRuntimeTypes';

const stateListKeys = [
  'queuedIds',
  'activeIds',
  'processingIds',
  'attentionIds',
  'completeIds',
  'skippedIds',
  'blockedIds',
  'errorIds'
] as const;

type RuntimeStateListKey = typeof stateListKeys[number];

const eventTypes: UMGTraceEventType[] = [
  'run_started',
  'sleeve_loaded',
  'gate_evaluated',
  'gate_blocked',
  'neostack_started',
  'neostack_completed',
  'neoblock_started',
  'neoblock_completed',
  'molt_role_used',
  'tool_call_prepared',
  'tool_call_requires_approval',
  'tool_call_executed',
  'tool_call_blocked',
  'tool_result_received',
  'run_completed',
  'run_error',
  'route_started',
  'gate_opened',
  'gate_closed',
  'block_queued',
  'block_activated',
  'block_processing',
  'block_completed',
  'block_skipped',
  'tool_requested',
  'approval_required',
  'tool_executed',
  'tool_blocked',
  'route_completed',
  'error'
];

const runtimeStates: UMGRuntimeState[] = ['idle', 'queued', 'active', 'processing', 'attention', 'complete', 'skipped', 'blocked', 'error'];
const scopeKinds: UMGRuntimeScopeKind[] = ['sleeve', 'neostack', 'neoblock', 'molt', 'gate', 'tool', 'approval'];

const eventStateDefaults: Record<UMGTraceEventType, UMGRuntimeState> = {
  run_started: 'active',
  sleeve_loaded: 'active',
  gate_evaluated: 'attention',
  gate_blocked: 'blocked',
  neostack_started: 'active',
  neostack_completed: 'complete',
  neoblock_started: 'active',
  neoblock_completed: 'complete',
  molt_role_used: 'active',
  tool_call_prepared: 'attention',
  tool_call_requires_approval: 'attention',
  tool_call_executed: 'complete',
  tool_call_blocked: 'blocked',
  tool_result_received: 'processing',
  run_completed: 'complete',
  run_error: 'error',
  route_started: 'active',
  gate_opened: 'active',
  gate_closed: 'complete',
  block_queued: 'queued',
  block_activated: 'active',
  block_processing: 'processing',
  block_completed: 'complete',
  block_skipped: 'skipped',
  tool_requested: 'attention',
  approval_required: 'attention',
  tool_executed: 'complete',
  tool_blocked: 'blocked',
  route_completed: 'complete',
  error: 'error'
};

export function createEmptyRuntimeVisualState(traceId: string): UMGRuntimeVisualState {
  return {
    traceId,
    activeIds: [],
    queuedIds: [],
    processingIds: [],
    attentionIds: [],
    completeIds: [],
    skippedIds: [],
    blockedIds: [],
    errorIds: [],
    currentPath: [],
    timeline: [],
    updatedAt: Date.now()
  };
}

export function getRuntimeTargetId(event: UMGTraceEvent): string | undefined {
  return event.moltBlockId
    ?? event.neoBlockId
    ?? event.neoStackId
    ?? event.sleeveId
    ?? event.gateId
    ?? event.sourceId
    ?? event.metadataAliases?.[0]
    ?? event.toolId
    ?? event.approvalId;
}

function listKeyForRuntimeState(state: UMGRuntimeState): RuntimeStateListKey | undefined {
  if (state === 'idle') return undefined;
  return `${state}Ids` as RuntimeStateListKey;
}

function removeIdFromStateLists(state: UMGRuntimeVisualState, targetId: string): UMGRuntimeVisualState {
  return stateListKeys.reduce((next, key) => ({
    ...next,
    [key]: next[key].filter((id) => id !== targetId)
  }), state);
}

function addUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function removeMany(values: string[], removeIds: string[]) {
  if (!removeIds.length) return values;
  const remove = new Set(removeIds);
  return values.filter((value) => !remove.has(value));
}

export function applyRuntimeTraceEvent(state: UMGRuntimeVisualState, event: UMGTraceEvent): UMGRuntimeVisualState {
  const targetId = getRuntimeTargetId(event);
  let next: UMGRuntimeVisualState = {
    ...state,
    timeline: [...state.timeline, event],
    latestEvent: event,
    updatedAt: event.timestamp || Date.now()
  };

  if (event.eventType === 'route_started') {
    next = {
      ...next,
      activeIds: [],
      processingIds: [],
      attentionIds: [],
      queuedIds: [],
      currentPath: targetId ? [targetId] : []
    };
  }

  if (event.eventType === 'route_completed') {
    const completedPath = targetId ? addUnique(next.currentPath, targetId) : next.currentPath;
    next = {
      ...next,
      activeIds: removeMany(next.activeIds, completedPath),
      queuedIds: removeMany(next.queuedIds, completedPath),
      processingIds: removeMany(next.processingIds, completedPath),
      attentionIds: removeMany(next.attentionIds, completedPath),
      completeIds: [...new Set([...next.completeIds, ...completedPath])],
      currentPath: completedPath
    };
  }

  if (!targetId) return next;

  next = removeIdFromStateLists(next, targetId);
  const listKey = listKeyForRuntimeState(event.eventType === 'error' ? 'error' : event.state);
  if (!listKey) {
    return {
      ...next,
      currentPath: next.currentPath.filter((id) => id !== targetId)
    };
  }

  return {
    ...next,
    [listKey]: addUnique(next[listKey], targetId),
    currentPath: ['complete', 'skipped', 'blocked', 'error'].includes(event.state)
      ? next.currentPath.filter((id) => id !== targetId)
      : addUnique(next.currentPath, targetId)
  };
}

export function applyRuntimeTraceEvents(initialState: UMGRuntimeVisualState, events: UMGTraceEvent[]): UMGRuntimeVisualState {
  return events.reduce((state, event) => applyRuntimeTraceEvent(state, event), initialState);
}

export function getVisualStateForId(state: UMGRuntimeVisualState, id: string): UMGRuntimeState {
  if (state.errorIds.includes(id)) return 'error';
  if (state.blockedIds.includes(id)) return 'blocked';
  if (state.attentionIds.includes(id)) return 'attention';
  if (state.processingIds.includes(id)) return 'processing';
  if (state.activeIds.includes(id)) return 'active';
  if (state.queuedIds.includes(id)) return 'queued';
  if (state.completeIds.includes(id)) return 'complete';
  if (state.skippedIds.includes(id)) return 'skipped';
  return 'idle';
}

export function getRuntimeClassForId(state: UMGRuntimeVisualState, id: string): string {
  return `runtime-${getVisualStateForId(state, id)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseScopeKind(value: unknown, event: Record<string, unknown>): UMGRuntimeScopeKind | undefined {
  if (typeof value === 'string' && scopeKinds.includes(value as UMGRuntimeScopeKind)) return value as UMGRuntimeScopeKind;
  if (event.moltBlockId || event.blockId || event.nodeId || event.relatedBlockIds) return 'molt';
  if (event.neoBlockId || event.neoblockId) return 'neoblock';
  if (event.neoStackId || event.stackId || event.neoStackID) return 'neostack';
  if (event.sleeveId) return 'sleeve';
  if (event.gateId) return 'gate';
  if (event.toolId) return 'tool';
  if (event.approvalId) return 'approval';
  return undefined;
}

function parseEventType(value: unknown, event: Record<string, unknown>): UMGTraceEventType | undefined {
  if (typeof value === 'string' && eventTypes.includes(value as UMGTraceEventType)) return value as UMGTraceEventType;
  const text = String(value ?? event.type ?? event.kind ?? event.code ?? '').toLowerCase();
  if (!text) return undefined;
  if (text.includes('run') && text.includes('start')) return 'run_started';
  if (text.includes('sleeve') && text.includes('load')) return 'sleeve_loaded';
  if (text.includes('gate') && text.includes('evaluat')) return 'gate_evaluated';
  if (text.includes('gate') && text.includes('block')) return 'gate_blocked';
  if (text.includes('neostack') && text.includes('start')) return 'neostack_started';
  if (text.includes('neostack') && (text.includes('complete') || text.includes('finish'))) return 'neostack_completed';
  if (text.includes('neoblock') && text.includes('start')) return 'neoblock_started';
  if (text.includes('neoblock') && (text.includes('complete') || text.includes('finish'))) return 'neoblock_completed';
  if (text.includes('molt') && (text.includes('role') || text.includes('used'))) return 'molt_role_used';
  if (text.includes('tool') && text.includes('prepared')) return 'tool_call_prepared';
  if (text.includes('tool') && text.includes('approval')) return 'tool_call_requires_approval';
  if (text.includes('tool') && text.includes('result')) return 'tool_result_received';
  if (text.includes('run') && (text.includes('complete') || text.includes('finish'))) return 'run_completed';
  if (text.includes('run') && (text.includes('error') || text.includes('fail'))) return 'run_error';
  if (text.includes('route') && text.includes('start')) return 'route_started';
  if (text.includes('route') && (text.includes('complete') || text.includes('finish'))) return 'route_completed';
  if (text.includes('gate') && text.includes('open')) return 'gate_opened';
  if (text.includes('gate') && text.includes('close')) return 'gate_closed';
  if (text.includes('approval') && (text.includes('required') || text.includes('request'))) return 'approval_required';
  if (text.includes('tool') && text.includes('block')) return 'tool_blocked';
  if (text.includes('tool') && (text.includes('execut') || text.includes('complete'))) return 'tool_executed';
  if (text.includes('tool') && (text.includes('request') || text.includes('call'))) return 'tool_requested';
  if (text.includes('queue')) return 'block_queued';
  if (text.includes('process')) return 'block_processing';
  if (text.includes('skip')) return 'block_skipped';
  if (text.includes('complete') || text.includes('finish')) return 'block_completed';
  if (text.includes('active') || text.includes('trigger')) return 'block_activated';
  if (text.includes('error') || text.includes('fail')) return 'error';
  return undefined;
}

function parseRuntimeState(value: unknown, eventType: UMGTraceEventType): UMGRuntimeState {
  if (typeof value === 'string' && runtimeStates.includes(value as UMGRuntimeState)) return value as UMGRuntimeState;
  return eventStateDefaults[eventType];
}

function firstStringArrayValue(value: unknown): string | undefined {
  return Array.isArray(value) ? value.find((entry) => typeof entry === 'string' && entry.trim()) : undefined;
}

function stringArrayValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()));
  return values.length ? values : undefined;
}

function normalizeTraceEntry(entry: unknown, index: number, fallbackTraceId: string): UMGTraceEvent | undefined {
  if (!isRecord(entry)) return undefined;
  const eventType = parseEventType(entry.eventType, entry);
  if (!eventType) return undefined;
  const scopeKind = parseScopeKind(entry.scopeKind, entry);
  if (!scopeKind) return undefined;

  const moltBlockId = asString(entry.moltBlockId) ?? asString(entry.blockId) ?? firstStringArrayValue(entry.relatedBlockIds);
  const neoBlockId = asString(entry.neoBlockId) ?? asString(entry.neoblockId);
  const neoStackId = asString(entry.neoStackId) ?? asString(entry.stackId);
  const sleeveId = asString(entry.sleeveId);
  const gateId = asString(entry.gateId);
  const sourceId = asString(entry.sourceId);
  const metadataAliases = stringArrayValue(entry.metadataAliases ?? entry.aliases);
  const toolId = asString(entry.toolId);
  const approvalId = asString(entry.approvalId);

  return {
    traceId: asString(entry.traceId) ?? fallbackTraceId,
    timestamp: asTimestamp(entry.timestamp ?? entry.time ?? entry.createdAt) ?? Date.now() + index,
    scopeKind,
    sleeveId,
    neoStackId,
    neoBlockId,
    moltBlockId,
    gateId,
    sourceId,
    metadataAliases,
    toolId,
    approvalId,
    eventType,
    state: parseRuntimeState(entry.state, eventType),
    label: asString(entry.label) ?? asString(entry.title) ?? asString(entry.message) ?? eventType,
    details: asString(entry.details) ?? asString(entry.message),
    raw: entry
  };
}

function candidateTraceArray(raw: unknown): unknown[] | undefined {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return undefined;
  if (Array.isArray(raw.trace)) return raw.trace;
  if (Array.isArray(raw.events)) return raw.events;
  if (Array.isArray(raw.runtimeTrace)) return raw.runtimeTrace;
  const trace = raw.trace;
  if (isRecord(trace) && Array.isArray(trace.events)) return trace.events;
  return undefined;
}

export function normalizeHermesTracePayload(raw: unknown, fallbackTraceId: string): UMGTraceEvent[] {
  const events = candidateTraceArray(raw);
  if (!events) return [];
  return events
    .map((entry, index) => normalizeTraceEntry(entry, index, fallbackTraceId))
    .filter((event): event is UMGTraceEvent => Boolean(event));
}
