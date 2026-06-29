import { UMGGateRecord, UMGGateAttachTargetKind, UMGGateAction, UMGGateTriggerType } from './cognitiveRuntimeTypes';

export type LegacyTriggerAttachTarget = {
  kind: UMGGateAttachTargetKind;
  id: string;
};

type LegacyTriggerLike = {
  id?: unknown;
  sourceId?: unknown;
  title?: unknown;
  name?: unknown;
  content?: unknown;
  conditionText?: unknown;
  summary?: unknown;
  description?: unknown;
  tags?: unknown;
  sourcePath?: unknown;
  triggerType?: unknown;
  action?: unknown;
  targetIds?: unknown;
  metadata?: unknown;
  activation?: unknown;
};

const triggerTypes: UMGGateTriggerType[] = [
  'user_intent',
  'runtime_condition',
  'tool_result',
  'approval',
  'capability_gap',
  'risk_detected',
  'completion',
  'error'
];

const gateActions: UMGGateAction[] = ['activate', 'deactivate', 'route', 'block', 'escalate', 'require_approval', 'close_gate'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())) : [];
}

function inferTriggerType(value: unknown, text: string): UMGGateTriggerType {
  if (typeof value === 'string' && triggerTypes.includes(value as UMGGateTriggerType)) return value as UMGGateTriggerType;
  const normalized = text.toLowerCase();
  if (normalized.includes('approval')) return 'approval';
  if (normalized.includes('tool result') || normalized.includes('tool_result')) return 'tool_result';
  if (normalized.includes('risk')) return 'risk_detected';
  if (normalized.includes('capability') || normalized.includes('missing')) return 'capability_gap';
  if (normalized.includes('complete') || normalized.includes('done')) return 'completion';
  if (normalized.includes('error') || normalized.includes('fail')) return 'error';
  if (normalized.includes('condition')) return 'runtime_condition';
  return 'user_intent';
}

function inferGateAction(value: unknown, text: string): UMGGateAction {
  if (typeof value === 'string' && gateActions.includes(value as UMGGateAction)) return value as UMGGateAction;
  const normalized = text.toLowerCase();
  if (normalized.includes('approval')) return 'require_approval';
  if (normalized.includes('block') || normalized.includes('prevent')) return 'block';
  if (normalized.includes('escalate')) return 'escalate';
  if (normalized.includes('route')) return 'route';
  if (normalized.includes('deactivate') || normalized.includes('suppress')) return 'deactivate';
  if (normalized.includes('close')) return 'close_gate';
  return 'activate';
}

export function isTriggerGateRecord(value: unknown): value is UMGGateRecord {
  if (!isRecord(value)) return false;
  const attachesTo = value.attachesTo;
  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && isRecord(attachesTo)
    && ['sleeve', 'neostack', 'neoblock', 'moltRole', 'tool'].includes(String(attachesTo.kind))
    && typeof attachesTo.id === 'string'
    && triggerTypes.includes(value.triggerType as UMGGateTriggerType)
    && typeof value.conditionText === 'string'
    && gateActions.includes(value.action as UMGGateAction)
    && Array.isArray(value.targetIds)
    && (value.defaultState === 'open' || value.defaultState === 'closed')
    && ['inactive', 'active', 'blocked', 'complete'].includes(String(value.runtimeState))
    && Array.isArray(value.tags);
}

export function mapLegacyTriggerToGateRecord(legacyTrigger: unknown, attachesTo: LegacyTriggerAttachTarget): UMGGateRecord {
  const source = (isRecord(legacyTrigger) ? legacyTrigger : {}) as LegacyTriggerLike;
  const sourceId = asString(source.sourceId) ?? asString(source.id);
  const title = asString(source.title) ?? asString(source.name) ?? sourceId ?? 'Untitled Trigger Gate';
  const conditionText = asString(source.conditionText)
    ?? asString(source.content)
    ?? asString(source.summary)
    ?? asString(source.description)
    ?? title;
  const metadata = isRecord(source.metadata) ? source.metadata : {};
  const sourcePath = asString(source.sourcePath);

  return {
    id: sourceId ? `gate_${sourceId.replace(/[^a-zA-Z0-9_-]+/g, '_')}` : `gate_${title.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase()}`,
    sourceId,
    title,
    attachesTo,
    triggerType: inferTriggerType(source.triggerType, `${title} ${conditionText}`),
    conditionText,
    action: inferGateAction(source.action, `${title} ${conditionText}`),
    targetIds: asStringArray(source.targetIds).length ? asStringArray(source.targetIds) : [attachesTo.id],
    defaultState: 'closed',
    runtimeState: 'inactive',
    tags: [...new Set([...asStringArray(source.tags), 'trigger_gate', 'control_record'])],
    metadata: {
      ...metadata,
      sourcePath,
      legacyKind: 'TRG',
      promptContent: false,
      note: 'TRG.* source is mapped as a gate/control record, not ordinary MOLT prompt content. CON.* and VER.* sources are future gate-policy/MetaMOLT candidates.'
    }
  };
}

export function shouldGateActivateForText(gate: UMGGateRecord, text: string): boolean {
  const haystack = text.toLowerCase();
  const terms = [
    gate.title,
    gate.conditionText,
    ...gate.tags
  ]
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9_-]+/))
    .map((value) => value.trim())
    .filter((value) => value.length >= 3 && !['the', 'and', 'for', 'with', 'this', 'that', 'gate', 'trigger', 'control', 'record'].includes(value));

  return [...new Set(terms)].some((term) => haystack.includes(term));
}
