import type { UMGCompiledRuntimeManifest } from './cognitiveRuntimeTypes';

export type HermesToolCapabilityRiskLevel = 'low' | 'medium' | 'high' | 'irreversible';
export type HermesToolCapabilityAvailability = 'yes' | 'no' | 'unknown';
export type HermesToolCapabilitySource = 'configured' | 'inferred' | 'unavailable' | 'unknown';
export type HermesToolCapabilityExecutionPolicy = 'autoAllowed' | 'approvalRequired' | 'blocked' | 'unavailable';

export type HermesToolCapabilityRegistryEntry = {
  capabilityId: string;
  displayName: string;
  description: string;
  riskLevel: HermesToolCapabilityRiskLevel;
  available: HermesToolCapabilityAvailability;
  mappedHermesToolName?: string;
  mappedHermesSkillId?: string;
  source: HermesToolCapabilitySource;
  executionPolicy: HermesToolCapabilityExecutionPolicy;
  requiredApproval: boolean;
  safeForLiveExecution: boolean;
  relatedNeoBlockId?: string;
  relatedGateId?: string;
  relatedMoltId?: string;
  traceEventAliases: string[];
  unavailableReason?: string;
};

type KnownCapability = Omit<HermesToolCapabilityRegistryEntry, 'relatedNeoBlockId' | 'relatedGateId' | 'relatedMoltId' | 'traceEventAliases'>;

const knownCapabilities: Record<string, KnownCapability> = {
  order_lookup: {
    capabilityId: 'order_lookup',
    displayName: 'Order Lookup',
    description: 'Validate purchase/order facts against local/mock or configured order context before refund decisions.',
    riskLevel: 'medium',
    available: 'unknown',
    source: 'unknown',
    executionPolicy: 'approvalRequired',
    requiredApproval: true,
    safeForLiveExecution: false,
    unavailableReason: 'No app-local real order lookup tool is configured by default.'
  },
  customer_message_draft: {
    capabilityId: 'customer_message_draft',
    displayName: 'Customer Message Draft',
    description: 'Generate reviewable customer-facing reply/instruction draft without sending email or external messages.',
    riskLevel: 'low',
    available: 'yes',
    mappedHermesToolName: 'app_local_customer_message_draft',
    mappedHermesSkillId: 'app-local:umg_customer_message_draft',
    source: 'configured',
    executionPolicy: 'autoAllowed',
    requiredApproval: false,
    safeForLiveExecution: true
  },
  refund_prepare_or_request: {
    capabilityId: 'refund_prepare_or_request',
    displayName: 'Refund Prepare or Request',
    description: 'Prepare refund/store-credit request only; actual payment/refund execution is irreversible and disallowed without explicit confirmation.',
    riskLevel: 'irreversible',
    available: 'no',
    source: 'unavailable',
    executionPolicy: 'approvalRequired',
    requiredApproval: true,
    safeForLiveExecution: false,
    unavailableReason: 'Irreversible refund/payment execution is blocked in this proof path.'
  },
  inventory_update_request: {
    capabilityId: 'inventory_update_request',
    displayName: 'Inventory Update Request',
    description: 'Prepare a reviewable inventory/restock update request without modifying production inventory.',
    riskLevel: 'high',
    available: 'no',
    source: 'unavailable',
    executionPolicy: 'blocked',
    requiredApproval: true,
    safeForLiveExecution: false,
    unavailableReason: 'No production inventory write tool is configured; external writes are blocked.'
  },
  audit_log_write: {
    capabilityId: 'audit_log_write',
    displayName: 'Audit Log Write',
    description: 'Prepare reviewable audit record content. Persistent external audit writes are unavailable unless explicitly configured.',
    riskLevel: 'medium',
    available: 'unknown',
    source: 'unknown',
    executionPolicy: 'approvalRequired',
    requiredApproval: true,
    safeForLiveExecution: false,
    unavailableReason: 'No app-local durable audit log tool is configured by default.'
  },
  report_generate: {
    capabilityId: 'report_generate',
    displayName: 'Report Generate',
    description: 'Generate a local non-destructive report/artifact from supplied Sleeve context.',
    riskLevel: 'low',
    available: 'yes',
    mappedHermesToolName: 'app_local_report_generate',
    mappedHermesSkillId: 'app-local:umg_report_generate',
    source: 'configured',
    executionPolicy: 'autoAllowed',
    requiredApproval: false,
    safeForLiveExecution: true
  }
};

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function titleFromCapability(capabilityId: string) {
  return capabilityId.split(/[_-]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function preferredTermsForCapability(capabilityId: string) {
  if (capabilityId === 'customer_message_draft') return ['draft customer', 'customer return instructions', 'customer communication', 'reply'];
  if (capabilityId === 'report_generate') return ['generate return metrics', 'reporting', 'metrics'];
  if (capabilityId === 'order_lookup') return ['validate order', 'purchase record', 'order'];
  return capabilityId.split(/[_-]+/);
}

function titleMatchesCapability(title: string | undefined, capabilityId: string) {
  const normalized = (title ?? '').toLowerCase();
  return preferredTermsForCapability(capabilityId).some((term) => normalized.includes(term));
}

function relatedFromManifest(manifest: UMGCompiledRuntimeManifest, capabilityId: string) {
  const preferredBlock = manifest.sourceBlocks.find((block) => block.scopeKind === 'neoblock' && titleMatchesCapability(block.title, capabilityId));
  const preferredMolt = manifest.sourceBlocks.find((block) => block.scopeKind === 'molt' && (block.metadata?.parentNeoBlockId === preferredBlock?.id || titleMatchesCapability(block.title, capabilityId)));
  const step = manifest.executionPlan.find((entry) => entry.targetId === preferredBlock?.id)
    ?? manifest.executionPlan.find((entry) => entry.requiredToolIds.includes(capabilityId))
    ?? manifest.executionPlan.find((entry) => entry.requiredToolIds.length);
  const sourceBlock = preferredMolt
    ?? preferredBlock
    ?? manifest.sourceBlocks.find((block) => block.id === step?.targetId)
    ?? manifest.sourceBlocks.find((block) => block.metadata?.parentNeoBlockId === step?.targetId)
    ?? manifest.sourceBlocks.find((block) => block.scopeKind === 'molt');
  return {
    relatedNeoBlockId: preferredBlock?.id ?? (step?.scopeKind === 'neoblock' ? step.targetId : typeof sourceBlock?.metadata?.parentNeoBlockId === 'string' ? sourceBlock.metadata.parentNeoBlockId : undefined),
    relatedGateId: step?.requiredGateIds[0],
    relatedMoltId: sourceBlock?.scopeKind === 'molt' ? sourceBlock.id : undefined
  };
}

function unknownCapability(capabilityId: string): KnownCapability {
  return {
    capabilityId,
    displayName: titleFromCapability(capabilityId),
    description: `${capabilityId} is declared by the Sleeve but has no configured app-local Hermes skill/tool mapping.`,
    riskLevel: 'medium',
    available: 'unknown',
    source: 'unknown',
    executionPolicy: 'approvalRequired',
    requiredApproval: true,
    safeForLiveExecution: false,
    unavailableReason: 'No configured app-local Hermes skill/tool mapping.'
  };
}

export function collectDeclaredCapabilities(manifest: UMGCompiledRuntimeManifest, declaredCapabilities?: string[]): string[] {
  return unique(declaredCapabilities?.length ? declaredCapabilities : [
    ...manifest.toolPolicy.allowedTools,
    ...manifest.executionPlan.flatMap((step) => step.requiredToolIds),
    ...manifest.toolPolicy.registry.map((entry) => entry.toolId)
  ]);
}

export function buildHermesToolCapabilityRegistry(args: {
  manifest: UMGCompiledRuntimeManifest;
  declaredCapabilities?: string[];
}): HermesToolCapabilityRegistryEntry[] {
  const declared = collectDeclaredCapabilities(args.manifest, args.declaredCapabilities);
  return declared.map((capabilityId) => {
    const base = knownCapabilities[capabilityId] ?? unknownCapability(capabilityId);
    const manifestEntry = args.manifest.toolPolicy.registry.find((entry) => entry.toolId === capabilityId || entry.toolName === capabilityId);
    const related = relatedFromManifest(args.manifest, capabilityId);
    const available = base.available === 'yes' || manifestEntry?.availableInHermes ? 'yes' : base.available;
    const source = base.source === 'configured' || manifestEntry?.availableInHermes ? 'configured' : base.source;
    return {
      ...base,
      available,
      source,
      mappedHermesToolName: base.mappedHermesToolName ?? (manifestEntry?.availableInHermes ? manifestEntry.toolName : undefined),
      relatedNeoBlockId: related.relatedNeoBlockId,
      relatedGateId: related.relatedGateId,
      relatedMoltId: related.relatedMoltId,
      traceEventAliases: unique([capabilityId, base.mappedHermesToolName, base.mappedHermesSkillId, related.relatedNeoBlockId, related.relatedGateId, related.relatedMoltId])
    };
  });
}

export function getRegistryEntry(registry: HermesToolCapabilityRegistryEntry[], capabilityId: string) {
  return registry.find((entry) => entry.capabilityId === capabilityId || entry.mappedHermesToolName === capabilityId);
}
