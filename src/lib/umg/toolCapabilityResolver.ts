import type { HermesCognitiveRuntimeRequest, HermesCognitiveRuntimeResult, UMGApprovalRequest, UMGCompiledRuntimeManifest, UMGTraceEvent } from './cognitiveRuntimeTypes';

export type ToolCapabilityRiskLevel = 'low' | 'medium' | 'high' | 'irreversible';
export type ToolCapabilityAvailability = 'yes' | 'no' | 'unknown';
export type ToolCapabilityExecutionPolicy = 'autoAllowed' | 'approvalRequired' | 'blocked' | 'unavailable';
export type ApprovalDecision = 'approve' | 'deny' | 'modify' | 'skip';

export type ToolCapabilityResolution = {
  capabilityId: string;
  requestedByNeoBlockId?: string;
  requestedByGateId?: string;
  requestedByMoltId?: string;
  riskLevel: ToolCapabilityRiskLevel;
  available: ToolCapabilityAvailability;
  mappedHermesToolName?: string;
  executionPolicy: ToolCapabilityExecutionPolicy;
  reason: string;
};

export type PendingRuntimeApproval = {
  pendingApprovalRun: true;
  pendingApprovalTraceId: string;
  pendingToolCapability: ToolCapabilityResolution;
  approvalReason: string;
  relatedNeoBlockId?: string;
  relatedGateId?: string;
  relatedMoltId?: string;
  continuationPayload: HermesContinuationRequest;
};

export type HermesContinuationRequest = HermesCognitiveRuntimeRequest & {
  continuationMode: 'continue_after_approval';
  previousTraceId: string;
  linkedTraceId: string;
  previousRunId?: string;
  sessionId?: string;
  approvalDecision: ApprovalDecision;
  approvedCapabilities: string[];
  deniedCapabilities: string[];
  userInstruction?: string;
  currentRuntimeState?: unknown;
  previousTrace: UMGTraceEvent[];
  preserveUMGTrace: true;
  pendingToolCapability?: ToolCapabilityResolution;
};

const safeDraftCapabilities = new Set(['customer_message_draft', 'report_generate']);
const mediumApprovalCapabilities = new Set(['order_lookup', 'inventory_update_request', 'audit_log_write']);
const irreversibleCapabilities = new Set(['refund_prepare_or_request']);

function unique(values: string[]) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function riskForCapability(capabilityId: string): ToolCapabilityRiskLevel {
  if (irreversibleCapabilities.has(capabilityId)) return 'irreversible';
  if (mediumApprovalCapabilities.has(capabilityId)) return 'medium';
  if (safeDraftCapabilities.has(capabilityId)) return 'low';
  return 'medium';
}

function policyForCapability(capabilityId: string, available: ToolCapabilityAvailability): ToolCapabilityExecutionPolicy {
  if (available === 'no') return 'unavailable';
  if (irreversibleCapabilities.has(capabilityId)) return 'approvalRequired';
  if (mediumApprovalCapabilities.has(capabilityId)) return 'approvalRequired';
  if (safeDraftCapabilities.has(capabilityId) && available === 'yes') return 'autoAllowed';
  return 'approvalRequired';
}

function reasonFor(capabilityId: string, available: ToolCapabilityAvailability, policy: ToolCapabilityExecutionPolicy) {
  if (available === 'no') return `${capabilityId} is declared by the Sleeve but unavailable in the current Hermes/local resolver boundary.`;
  if (policy === 'autoAllowed') return `${capabilityId} is a safe non-destructive draft/report capability and may execute when Hermes has a configured mapping.`;
  if (irreversibleCapabilities.has(capabilityId)) return `${capabilityId} may prepare refund actions only; actual irreversible refund execution requires explicit user approval.`;
  return `${capabilityId} is declared by the runtime Sleeve and requires approval before Hermes continues past this capability boundary.`;
}

function inferCapabilityFromApproval(approval?: UMGApprovalRequest, fallback?: string) {
  const raw = isRecord(approval?.raw) ? approval.raw : {};
  const label = `${approval?.label ?? ''} ${approval?.reason ?? ''} ${raw.capabilityId ?? ''} ${raw.toolId ?? ''}`.toLowerCase();
  const candidates = ['order_lookup', 'customer_message_draft', 'refund_prepare_or_request', 'inventory_update_request', 'audit_log_write', 'report_generate'];
  return candidates.find((candidate) => label.includes(candidate)) ?? fallback;
}

function relatedFromManifest(manifest: UMGCompiledRuntimeManifest, capabilityId: string) {
  const step = manifest.executionPlan.find((entry) => entry.requiredToolIds.includes(capabilityId))
    ?? manifest.executionPlan.find((entry) => entry.requiredToolIds.length);
  const gateId = step?.requiredGateIds[0];
  const sourceBlock = manifest.sourceBlocks.find((block) => block.id === step?.targetId || block.metadata?.parentNeoBlockId === step?.targetId);
  return {
    requestedByNeoBlockId: step?.scopeKind === 'neoblock' ? step.targetId : sourceBlock?.scopeKind === 'neoblock' ? sourceBlock.id : typeof sourceBlock?.metadata?.parentNeoBlockId === 'string' ? sourceBlock.metadata.parentNeoBlockId : undefined,
    requestedByGateId: gateId,
    requestedByMoltId: sourceBlock?.scopeKind === 'molt' ? sourceBlock.id : undefined
  };
}

export function resolveToolCapabilities(args: {
  manifest: UMGCompiledRuntimeManifest;
  declaredCapabilities?: string[];
  configuredCapabilities?: string[];
  unavailableCapabilities?: string[];
}): ToolCapabilityResolution[] {
  const manifest = args.manifest;
  const declared = unique(args.declaredCapabilities?.length ? args.declaredCapabilities : [
    ...(manifest.toolPolicy.allowedTools ?? []),
    ...manifest.executionPlan.flatMap((step) => step.requiredToolIds ?? [])
  ]);
  const configured = new Set(args.configuredCapabilities?.length ? args.configuredCapabilities : manifest.toolPolicy.registry.filter((entry) => entry.availableInHermes && entry.status === 'available').map((entry) => entry.toolId));
  const unavailable = new Set(args.unavailableCapabilities ?? []);
  return declared.map((capabilityId) => {
    const registryEntry = manifest.toolPolicy.registry.find((entry) => entry.toolId === capabilityId || entry.toolName === capabilityId);
    const available: ToolCapabilityAvailability = unavailable.has(capabilityId)
      ? 'no'
      : configured.has(capabilityId) || registryEntry?.availableInHermes
        ? 'yes'
        : 'unknown';
    const executionPolicy = policyForCapability(capabilityId, available);
    return {
      capabilityId,
      ...relatedFromManifest(manifest, capabilityId),
      riskLevel: riskForCapability(capabilityId),
      available,
      mappedHermesToolName: registryEntry?.toolName ?? (available === 'yes' ? capabilityId : undefined),
      executionPolicy,
      reason: reasonFor(capabilityId, available, executionPolicy)
    };
  });
}

export function createPendingRuntimeApproval(args: {
  request: HermesCognitiveRuntimeRequest;
  result: HermesCognitiveRuntimeResult;
  resolutions: ToolCapabilityResolution[];
  currentRuntimeState?: unknown;
}): PendingRuntimeApproval | undefined {
  if (args.result.status !== 'needsApproval') return undefined;
  const approval = args.result.approvalRequests.find((entry) => entry.status === 'pending') ?? args.result.approvalRequests[0];
  const fallbackCapability = args.resolutions.find((entry) => entry.executionPolicy === 'approvalRequired') ?? args.resolutions[0];
  if (!fallbackCapability) return undefined;
  const capabilityId = inferCapabilityFromApproval(approval, fallbackCapability.capabilityId) ?? fallbackCapability.capabilityId;
  const pendingToolCapability = args.resolutions.find((entry) => entry.capabilityId === capabilityId) ?? fallbackCapability;
  const linkedTraceId = `${args.request.traceId}_approval_continuation`;
  const continuationPayload: HermesContinuationRequest = {
    ...args.request,
    traceId: linkedTraceId,
    continuationMode: 'continue_after_approval',
    previousTraceId: args.request.traceId,
    linkedTraceId,
    approvalDecision: 'approve',
    approvedCapabilities: [pendingToolCapability.capabilityId],
    deniedCapabilities: [],
    currentRuntimeState: args.currentRuntimeState,
    previousTrace: args.result.trace,
    preserveUMGTrace: true,
    pendingToolCapability,
    metadata: {
      ...args.request.metadata,
      continuationOfTraceId: args.request.traceId,
      pendingApprovalId: approval?.approvalId ?? approval?.id,
      preserveUMGTrace: true
    }
  };
  return {
    pendingApprovalRun: true,
    pendingApprovalTraceId: args.request.traceId,
    pendingToolCapability,
    approvalReason: approval?.reason ?? pendingToolCapability.reason,
    relatedNeoBlockId: pendingToolCapability.requestedByNeoBlockId,
    relatedGateId: pendingToolCapability.requestedByGateId,
    relatedMoltId: pendingToolCapability.requestedByMoltId,
    continuationPayload
  };
}

export function createHermesContinuationRequest(args: {
  pendingApproval: PendingRuntimeApproval;
  decision: ApprovalDecision;
  userInstruction?: string;
}): HermesContinuationRequest {
  const capabilityId = args.pendingApproval.pendingToolCapability.capabilityId;
  return {
    ...args.pendingApproval.continuationPayload,
    approvalDecision: args.decision,
    approvedCapabilities: args.decision === 'approve' ? [capabilityId] : [],
    deniedCapabilities: args.decision === 'approve' ? [] : [capabilityId],
    userInstruction: args.userInstruction,
    metadata: {
      ...args.pendingApproval.continuationPayload.metadata,
      approvalDecision: args.decision,
      userInstruction: args.userInstruction
    }
  };
}
