import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 8788;
export const RUNTIME_PATH = '/api/hermes/runtime';
export const NATIVE_ACTION_PATH = '/api/hermes/native-action';
export const CUSTOM_SLEEVE_GENERATION_PATH = '/api/hermes/custom-sleeve-generation';
export const BODY_LIMIT_BYTES = 1024 * 1024;

export const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5177',
  'http://localhost:5177',
  'http://127.0.0.1:5179',
  'http://localhost:5179',
  'http://127.0.0.1:5185',
  'http://localhost:5185'
]);

const SECRET_KEYS = /authorization|api[_-]?key|\bkey\b|token|secret/i;
const HERMES_DEFAULT_CLI_PATH = '/home/neomagnetar/.local/bin/hermes';
const HERMES_DEFAULT_PROVIDER = 'openai-codex';
const HERMES_DEFAULT_MODEL = 'gpt-5.3-codex-spark';
const SAFE_TOOLSETS = 'safe';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (!value || typeof value !== 'object') return value;
  const redacted = {};
  for (const [key, entry] of Object.entries(value)) {
    redacted[key] = SECRET_KEYS.test(key) ? '[REDACTED]' : isRecord(entry) || Array.isArray(entry) ? redactSecrets(entry) : entry;
  }
  return redacted;
}

function logSafe(event, details = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...redactSecrets(details) }));
}

function corsHeaders(origin) {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

function jsonResponse(status, body, origin) {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
    body
  };
}

function truncateText(text, limit) {
  if (typeof text !== 'string') return text;
  return text.length > limit ? `${text.slice(0, limit)}\n...[truncated]` : text;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
}

function countByScope(sourceBlocks, scopeKind) {
  return sourceBlocks.filter((block) => block?.scopeKind === scopeKind).length;
}

function firstSourceBlock(sourceBlocks, scopeKind) {
  return sourceBlocks.find((block) => block?.scopeKind === scopeKind);
}

export function validateRuntimeRequest(request, env = process.env) {
  if (!isRecord(request)) return { ok: false, status: 400, error: 'Hermes runtime bridge received invalid JSON.' };
  if (!isRecord(request.compiledSleeveManifest)) return { ok: false, status: 400, error: 'compiledSleeveManifest is required.' };
  if (!request.traceId || typeof request.traceId !== 'string') return { ok: false, status: 400, error: 'traceId is required.' };
  if (!request.userGoal || typeof request.userGoal !== 'string') return { ok: false, status: 400, error: 'userGoal is required.' };
  if (!['dryRun', 'approvalRequired', 'liveAllowed'].includes(request.executionMode)) return { ok: false, status: 400, error: 'executionMode must be dryRun, approvalRequired, or liveAllowed.' };
  if (request.executionMode === 'liveAllowed' && env.HERMES_RUNTIME_ALLOW_LIVE !== 'true') {
    return { ok: false, status: 403, error: 'liveAllowed runtime execution is disabled by the local bridge. Use dryRun or approvalRequired.' };
  }
  return { ok: true };
}

function summarizeStructure(manifest) {
  const sourceBlocks = Array.isArray(manifest.sourceBlocks) ? manifest.sourceBlocks : [];
  const gates = Array.isArray(manifest.gates) ? manifest.gates : [];
  const firstNeoStack = firstSourceBlock(sourceBlocks, 'neostack');
  const firstNeoBlock = firstSourceBlock(sourceBlocks, 'neoblock');
  const firstMolt = firstSourceBlock(sourceBlocks, 'molt');
  const firstGate = firstSourceBlock(sourceBlocks, 'gate') || gates[0];
  return {
    sleeveId: manifest.sleeveId,
    sleeveTitle: manifest.sleeveTitle,
    executionSteps: Array.isArray(manifest.executionPlan) ? manifest.executionPlan.length : 0,
    sourceBlockCount: sourceBlocks.length,
    selectedStackCount: countByScope(sourceBlocks, 'neostack'),
    selectedNeoBlockCount: countByScope(sourceBlocks, 'neoblock'),
    selectedMoltCount: countByScope(sourceBlocks, 'molt'),
    gateCount: gates.length,
    firstMappableIds: {
      sleeveId: manifest.sleeveId,
      neoStackId: firstNeoStack?.id,
      neoBlockId: firstNeoBlock?.id,
      moltBlockId: firstMolt?.id,
      gateId: firstGate?.id,
      moltRole: firstMolt?.role,
      aliases: uniqueStrings([firstNeoStack?.sourcePath, firstNeoBlock?.sourcePath, firstMolt?.sourcePath, firstGate?.sourcePath || firstGate?.sourceId])
    },
    sourceBlocks: sourceBlocks.slice(0, 48).map((block) => ({
      id: block.id,
      title: block.title,
      role: block.role,
      scopeKind: block.scopeKind,
      sourcePath: block.sourcePath,
      metadata: {
        sourceId: block.metadata?.sourceId,
        parentNeoBlockId: block.metadata?.parentNeoBlockId,
        parentNeoStackId: block.metadata?.parentNeoStackId,
        attachesToId: block.metadata?.attachesToId,
        promptContent: block.metadata?.promptContent
      }
    })),
    gates: gates.slice(0, 24).map((gate) => ({
      id: gate.id,
      sourceId: gate.sourceId,
      title: gate.title,
      attachesTo: gate.attachesTo,
      action: gate.action,
      triggerType: gate.triggerType,
      promptContent: false
    }))
  };
}

export function buildHermesRuntimePrompt(request) {
  const manifest = request.compiledSleeveManifest;
  const packet = {
    traceId: request.traceId,
    executionMode: request.executionMode,
    approvalMode: request.approvalMode,
    userGoal: truncateText(request.userGoal, 1200),
    sleeve: request.sleeve || { id: manifest.sleeveId, name: manifest.sleeveTitle },
    allowedTools: request.allowedTools || manifest.toolPolicy?.allowedTools || [],
    blockedTools: request.blockedTools || manifest.toolPolicy?.blockedTools || [],
    requiredTools: request.requiredTools || [],
    approvalPoints: request.approvalPoints || [],
    continuationMode: request.continuationMode,
    previousTraceId: request.previousTraceId,
    linkedTraceId: request.linkedTraceId,
    approvalDecision: request.approvalDecision,
    approvedCapabilities: request.approvedCapabilities || [],
    deniedCapabilities: request.deniedCapabilities || [],
    pendingToolCapability: request.pendingToolCapability,
    umgRuntimeSkillPack: request.umgRuntimeSkillPack,
    umgRuntimeSkillInstructions: request.umgRuntimeSkillInstructions,
    toolCapabilityRegistry: Array.isArray(request.toolCapabilityRegistry) ? request.toolCapabilityRegistry : [],
    geometryTraceMappingIds: request.geometryTraceMappingIds,
    currentExecutionRoute: request.currentExecutionRoute,
    approvalRuntimeMode: request.approvalRuntimeMode,
    previousTrace: Array.isArray(request.previousTrace) ? request.previousTrace.slice(-12) : [],
    runtimeInstructions: (request.runtimeInstructions || manifest.runtimeInstructions || []).slice(0, 12),
    structure: summarizeStructure(manifest),
    sourceBlocks: (request.sourceBlocks || manifest.sourceBlocks || []).slice(0, 48).map((block) => ({
      id: block.id,
      title: block.title,
      role: block.role,
      scopeKind: block.scopeKind,
      sourcePath: block.sourcePath
    })),
    expectedTraceContract: request.expectedTraceContract || {
      eventFields: ['eventId', 'timestamp', 'eventType', 'message', 'sleeveId', 'neoStackId', 'neoBlockId', 'moltBlockId', 'gateId', 'sourceId', 'metadataAliases', 'status', 'rawHermesPayload'],
      rule: 'Only emit IDs that are present in the supplied manifest/source structure. If unsure, omit IDs and explain in unmappedEvents.'
    }
  };

  return [
    'You are the real local Hermes cognition runtime for a UMG Studio proof.',
    'UMG Runtime Skill Pack is app-local request knowledge, not a global Hermes skill install. Follow its instructions when present in the packet.',
    'Reason through the supplied compiled UMG runtime manifest. Do not request shell, browser, network, or filesystem tools. Use only the supplied toolCapabilityRegistry for capability availability.',
    'Return ONLY compact JSON with this shape. The events array should prove a real dry-run reasoning walk over supplied IDs when present:',
    '{"traceId":"...","status":"ok|blocked|needsApproval|error","finalOutput":"...","events":[{"eventId":"evt_run_started","timestamp":0,"eventType":"run_started","message":"Hermes dry-run started","scopeKind":"sleeve","sleeveId":"<supplied sleeveId>","status":"active"},{"eventId":"evt_neostack_started","timestamp":1,"eventType":"neostack_started","message":"NeoStack considered","scopeKind":"neostack","neoStackId":"<real supplied NeoStack id>","status":"active"},{"eventId":"evt_neoblock_started","timestamp":2,"eventType":"neoblock_started","message":"NeoBlock considered","scopeKind":"neoblock","neoBlockId":"<real supplied NeoBlock id>","status":"active"},{"eventId":"evt_gate_evaluated","timestamp":3,"eventType":"gate_evaluated","message":"Gate evaluated as dry-run/control metadata only","scopeKind":"gate","gateId":"<real supplied Gate id>","status":"complete"},{"eventId":"evt_molt_role_used","timestamp":4,"eventType":"molt_role_used","message":"MOLT role used for reasoning","scopeKind":"molt","moltBlockId":"<real supplied MOLT id>","status":"processing"},{"eventId":"evt_neoblock_completed","timestamp":5,"eventType":"neoblock_completed","message":"NeoBlock dry-run reasoning completed","scopeKind":"neoblock","neoBlockId":"<same real NeoBlock id>","status":"complete"},{"eventId":"evt_run_completed","timestamp":6,"eventType":"run_completed","message":"Hermes dry-run completed","scopeKind":"sleeve","sleeveId":"<supplied sleeveId>","status":"complete"}],"toolCalls":[],"blockedCalls":[],"approvalRequests":[],"errors":[],"artifacts":[],"unmappedEvents":[]}',
    'Events may use only real IDs from the request. Prefer structure.firstMappableIds and sourceBlocks entries. Emit neostack_started, neoblock_started, gate_evaluated, molt_role_used, and neoblock_completed only when a real supplied ID exists. If a target cannot be mapped to a supplied ID, put that attempted event in unmappedEvents with no fabricated ID instead of lighting a node.',
    'For dryRun, toolCalls must be empty. If a tool would be needed, put it in blockedCalls or approvalRequests without execution.',
    'If continuationMode is continue_after_approval, this is a second-call continuation linked to previousTraceId. Use only approvedCapabilities, emit approval_granted or approval_denied, tool_call_prepared, tool_call_executed or tool_call_blocked, tool_result_received for safe draft/report/order lookup behavior when applicable, then gate_opened/gate_blocked, neoblock_completed, neoblock_rerouted if skipped, next neoblock_started, or run_completed. Do not perform real external side effects; safe proof artifacts may be local/in-memory draft/report content only.',
    'Compiler trace is not Hermes runtime trace; use only this Hermes reasoning run for events.',
    '',
    JSON.stringify(packet, null, 2)
  ].join('\n');
}

function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        return isRecord(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

function normalizeStatus(value) {
  return ['ok', 'blocked', 'needsApproval', 'error'].includes(String(value)) ? String(value) : 'ok';
}

function firstApprovalTarget(request) {
  const manifest = request.compiledSleeveManifest || {};
  const executionPlan = Array.isArray(manifest.executionPlan) ? manifest.executionPlan : [];
  const registry = Array.isArray(manifest.toolPolicy?.registry) ? manifest.toolPolicy.registry : [];
  const capabilityRegistry = Array.isArray(request.toolCapabilityRegistry) ? request.toolCapabilityRegistry : [];
  const allowedTools = Array.isArray(request.allowedTools) ? request.allowedTools : Array.isArray(manifest.toolPolicy?.allowedTools) ? manifest.toolPolicy.allowedTools : [];
  const approvalEntry = capabilityRegistry.find((entry) => entry?.executionPolicy === 'approvalRequired' && entry?.capabilityId)
    || capabilityRegistry.find((entry) => entry?.requiredApproval === true && entry?.capabilityId);
  const stepForApproval = approvalEntry
    ? executionPlan.find((entry) => Array.isArray(entry.requiredToolIds) && entry.requiredToolIds.includes(approvalEntry.capabilityId))
    : undefined;
  const step = stepForApproval
    || executionPlan.find((entry) => Array.isArray(entry.requiredToolIds) && entry.requiredToolIds.length)
    || executionPlan.find((entry) => Array.isArray(entry.requiredGateIds) && entry.requiredGateIds.length)
    || executionPlan[0];
  const capabilityId = approvalEntry?.capabilityId
    || step?.requiredToolIds?.[0]
    || allowedTools.find((tool) => typeof tool === 'string' && tool.trim())
    || registry.find((entry) => entry?.toolId)?.toolId
    || 'runtime_capability';
  const registryEntry = registry.find((entry) => entry?.toolId === capabilityId || entry?.toolName === capabilityId);
  return {
    capabilityId,
    toolName: approvalEntry?.mappedHermesToolName || registryEntry?.toolName || capabilityId,
    neoBlockId: approvalEntry?.relatedNeoBlockId || (step?.scopeKind === 'neoblock' ? step.targetId : undefined),
    gateId: approvalEntry?.relatedGateId || step?.requiredGateIds?.[0],
    moltBlockId: approvalEntry?.relatedMoltId,
    sleeveId: manifest.sleeveId
  };
}

export function buildNeedsApprovalTraceEnvelope(request) {
  const target = firstApprovalTarget(request);
  const timestamp = Date.now();
  const eventBase = String(request.traceId || 'approval_trace').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const approval = {
    id: `approval.${eventBase}.${target.capabilityId}`,
    approvalId: `approval.${eventBase}.${target.capabilityId}`,
    traceId: request.traceId,
    label: target.capabilityId,
    reason: `${target.capabilityId} requires explicit runtime approval before Hermes continues past the tool boundary.`,
    requestedAt: timestamp,
    status: 'pending',
    raw: {
      capabilityId: target.capabilityId,
      toolId: target.toolName,
      neoBlockId: target.neoBlockId,
      gateId: target.gateId
    }
  };
  const events = [{
    traceId: request.traceId,
    eventId: `${eventBase}.tool.requires_approval`,
    timestamp,
    eventType: 'tool_call_requires_approval',
    message: `${target.capabilityId} requires runtime approval`,
    label: `${target.capabilityId} requires runtime approval`,
    scopeKind: 'tool',
    toolId: target.toolName,
    neoBlockId: target.neoBlockId,
    gateId: target.gateId,
    sleeveId: target.sleeveId,
    status: 'attention'
  }];
  return {
    traceId: request.traceId,
    status: 'needsApproval',
    finalOutput: `Runtime approval required for ${target.capabilityId}. No tool was executed.`,
    events,
    trace: events,
    toolCalls: [],
    blockedCalls: [],
    approvalRequests: [approval],
    errors: [],
    artifacts: [],
    unmappedEvents: [],
    nextSuggestedActions: ['Approve & Continue', 'Continue Without Tool', 'Deny / Skip']
  };
}

function normalizeEvent(entry, index, fallbackTraceId, rawHermesPayload) {
  if (!isRecord(entry)) return undefined;
  const eventType = typeof entry.eventType === 'string' ? entry.eventType : typeof entry.type === 'string' ? entry.type : undefined;
  const status = typeof entry.status === 'string' ? entry.status : typeof entry.state === 'string' ? entry.state : undefined;
  if (!eventType || !status) return undefined;
  return {
    traceId: typeof entry.traceId === 'string' ? entry.traceId : fallbackTraceId,
    eventId: typeof entry.eventId === 'string' ? entry.eventId : `hermes_event_${index + 1}`,
    timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now() + index,
    eventType,
    message: typeof entry.message === 'string' ? entry.message : typeof entry.label === 'string' ? entry.label : eventType,
    label: typeof entry.label === 'string' ? entry.label : typeof entry.message === 'string' ? entry.message : eventType,
    details: typeof entry.details === 'string' ? entry.details : undefined,
    scopeKind: typeof entry.scopeKind === 'string' ? entry.scopeKind : entry.gateId ? 'gate' : entry.moltBlockId ? 'molt' : entry.neoBlockId ? 'neoblock' : entry.neoStackId ? 'neostack' : entry.sleeveId ? 'sleeve' : 'sleeve',
    sleeveId: typeof entry.sleeveId === 'string' ? entry.sleeveId : undefined,
    neoStackId: typeof entry.neoStackId === 'string' ? entry.neoStackId : undefined,
    neoBlockId: typeof entry.neoBlockId === 'string' ? entry.neoBlockId : undefined,
    moltBlockId: typeof entry.moltBlockId === 'string' ? entry.moltBlockId : undefined,
    gateId: typeof entry.gateId === 'string' ? entry.gateId : undefined,
    sourceId: typeof entry.sourceId === 'string' ? entry.sourceId : undefined,
    metadataAliases: Array.isArray(entry.metadataAliases) ? uniqueStrings(entry.metadataAliases) : undefined,
    state: status,
    status,
    rawHermesPayload
  };
}

export function buildTraceEnvelopeFromHermesOutput(request, hermesText) {
  const parsed = parseJsonObject(hermesText);
  const rawHermesPayload = parsed || { text: truncateText(hermesText, 12000) };
  const events = Array.isArray(parsed?.events) ? parsed.events.map((entry, index) => normalizeEvent(entry, index, request.traceId, rawHermesPayload)).filter(Boolean) : [];
  const unmappedEvents = Array.isArray(parsed?.unmappedEvents) ? parsed.unmappedEvents.map((entry, index) => normalizeEvent(entry, index, request.traceId, rawHermesPayload)).filter(Boolean) : [];

  return {
    traceId: typeof parsed?.traceId === 'string' ? parsed.traceId : request.traceId,
    status: normalizeStatus(parsed?.status),
    finalOutput: typeof parsed?.finalOutput === 'string' ? parsed.finalOutput : typeof parsed?.output === 'string' ? parsed.output : truncateText(hermesText.trim(), 12000),
    events,
    trace: events,
    toolCalls: Array.isArray(parsed?.toolCalls) ? parsed.toolCalls : [],
    blockedCalls: Array.isArray(parsed?.blockedCalls) ? parsed.blockedCalls : [],
    approvalRequests: Array.isArray(parsed?.approvalRequests) ? parsed.approvalRequests : [],
    errors: Array.isArray(parsed?.errors) ? parsed.errors : [],
    artifacts: Array.isArray(parsed?.artifacts) ? parsed.artifacts : [],
    unmappedEvents,
    rawHermesPayload
  };
}

export function runHermesRuntimeCli(prompt, env = process.env, spawnFn = spawn, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const cliPath = env.HERMES_CLI_PATH || HERMES_DEFAULT_CLI_PATH;
    const provider = env.HERMES_INFERENCE_PROVIDER || HERMES_DEFAULT_PROVIDER;
    const model = env.HERMES_INFERENCE_MODEL || HERMES_DEFAULT_MODEL;
    const toolsets = env.HERMES_RUNTIME_TOOLSETS || SAFE_TOOLSETS;
    const args = ['-z', prompt, '--provider', provider, '--model', model, '--toolsets', toolsets];
    const childEnv = {
      PATH: env.PATH,
      HOME: env.HOME,
      USER: env.USER,
      LANG: env.LANG || 'C.UTF-8',
      HERMES_HOME: env.HERMES_HOME,
      HERMES_PROFILE: env.HERMES_PROFILE,
      HERMES_INFERENCE_PROVIDER: provider,
      HERMES_INFERENCE_MODEL: model,
      HERMES_RUNTIME_TOOLSETS: toolsets
    };
    for (const [key, value] of Object.entries(env)) {
      if (/^(OPENAI|ANTHROPIC|XAI|OPENROUTER|NOUS|HERMES_API|HERMES_PROVIDER|HERMES_MODEL)/.test(key) && value != null) childEnv[key] = value;
    }
    for (const key of Object.keys(childEnv)) if (childEnv[key] == null) delete childEnv[key];
    let stdout = '';
    let stderr = '';
    let settled = false;
    let child;

    const timer = setTimeout(() => {
      if (child?.kill) child.kill('SIGKILL');
      if (!settled) {
        settled = true;
        reject(Object.assign(new Error('Hermes runtime CLI timed out.'), { code: 'ETIMEDOUT', stderr }));
      }
    }, timeoutMs);

    child = spawnFn(cliPath, args, { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    if (!child || typeof child.on !== 'function') {
      clearTimeout(timer);
      reject(new Error('Hermes runtime CLI spawn returned no process.'));
      return;
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      reject(error);
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      if (code === 0 && !signal) resolve({ ok: true, status: 200, text: stdout.trim() });
      else reject(Object.assign(new Error(signal ? `Hermes runtime CLI exited with ${signal}` : `Hermes runtime CLI exited with status ${code}`), { code: signal || code, stderr }));
    });
  });
}

const NATIVE_CAPABILITY_POLICIES = {
  'umg.native.hermes.note_create': { risk: 'low', directAllowed: true, approvalRequiredByDefault: true, toolsets: 'file,terminal' },
  'umg.native.hermes.file_write': { risk: 'medium', directAllowed: true, approvalRequiredByDefault: true, toolsets: 'file,terminal' },
  'umg.native.hermes.file_read': { risk: 'low', directAllowed: true, approvalRequiredByDefault: false, toolsets: 'file,terminal' },
  'umg.native.hermes.shell_command': { risk: 'high', directAllowed: false, approvalRequiredByDefault: true, toolsets: 'terminal' },
  'umg.native.hermes.project_edit': { risk: 'high', directAllowed: false, approvalRequiredByDefault: true, toolsets: 'file,terminal' },
  'umg.native.hermes.runtime_task': { risk: 'medium', directAllowed: true, approvalRequiredByDefault: true, toolsets: 'file,terminal,browser,web' }
};

export function validateNativeActionRequest(request) {
  if (!isRecord(request)) return { ok: false, status: 400, error: 'Native Hermes action request must be JSON.' };
  if (!String(request.actionId || '').trim()) return { ok: false, status: 400, error: 'actionId is required.' };
  if (!String(request.capabilityId || '').trim()) return { ok: false, status: 400, error: 'capabilityId is required.' };
  if (!String(request.sleeveId || '').trim()) return { ok: false, status: 400, error: 'sleeveId is required.' };
  if (!String(request.prompt || '').trim()) return { ok: false, status: 400, error: 'prompt is required.' };
  if (!['direct', 'approval', 'observe', 'blocked'].includes(request.mode)) return { ok: false, status: 400, error: 'mode must be direct, approval, observe, or blocked.' };
  if (!['low', 'medium', 'high', 'irreversible'].includes(request.risk)) return { ok: false, status: 400, error: 'risk must be low, medium, high, or irreversible.' };
  if (!NATIVE_CAPABILITY_POLICIES[request.capabilityId]) return { ok: false, status: 400, error: `Unsupported native Hermes capability: ${request.capabilityId}` };
  return { ok: true };
}

function nativeActionTraceEvent(request, eventType, state, label, extra = {}) {
  return {
    traceId: request.traceId || request.actionId,
    eventId: `${request.actionId}.${eventType}.${Date.now()}`,
    timestamp: Date.now(),
    eventType,
    scopeKind: eventType.includes('approval') || eventType.includes('blocked') ? 'gate' : eventType.includes('file') || eventType.includes('artifact') ? 'tool' : 'neoblock',
    sleeveId: request.sleeveId,
    neoStackId: request.neoStackId,
    neoBlockId: request.neoBlockId,
    moltBlockId: request.moltId,
    gateId: request.gateId,
    toolId: request.capabilityId,
    status: state,
    state,
    message: label,
    label,
    rawHermesPayload: { actionId: request.actionId, capabilityId: request.capabilityId, mode: request.mode, ...extra }
  };
}

function buildNativeActionResult(request, status, summary, extra = {}) {
  const traceEvents = [
    nativeActionTraceEvent(request, 'tool_block_resolved', 'processing', `Resolved MetaMOLT Tool Block for ${request.capabilityId}`),
    nativeActionTraceEvent(request, 'action_request_created', status === 'failed' ? 'error' : status === 'blocked' ? 'blocked' : status === 'approval_required' ? 'attention' : status === 'observed' ? 'queued' : 'processing', `Native Hermes action request created for ${request.capabilityId}`)
  ];
  if (status === 'approval_required') traceEvents.push(nativeActionTraceEvent(request, 'action_approval_required', 'attention', `${request.capabilityId} requires approval before execution.`));
  if (status === 'blocked') traceEvents.push(nativeActionTraceEvent(request, 'action_blocked', 'blocked', `${request.capabilityId} blocked by action policy.`));
  if (status === 'failed') traceEvents.push(nativeActionTraceEvent(request, 'action_failed', 'error', `${request.capabilityId} failed.`));
  return {
    actionId: request.actionId,
    capabilityId: request.capabilityId,
    mode: request.mode,
    status,
    externalActionTaken: false,
    summary,
    artifacts: [],
    traceEvents,
    ...extra
  };
}

export function buildNativeHermesActionPrompt(request) {
  const expectedOutputs = Array.isArray(request.expectedOutputs) ? request.expectedOutputs : [];
  return [
    'You are native Hermes executing one UMG-approved action request using your normal tools.',
    'Do the requested action for real if it is low-risk or already approved by the supplied request. Do not fake file paths or success.',
    'After execution, return a short JSON summary only. The bridge will independently verify expected output paths when supplied.',
    JSON.stringify({
      actionId: request.actionId,
      capabilityId: request.capabilityId,
      mode: request.mode,
      risk: request.risk,
      prompt: request.prompt,
      workingDirectory: request.workingDirectory,
      expectedOutputs,
      userApproved: request.userApproved === true,
      outputContract: { createdFiles: expectedOutputs, externalActionTaken: true, noFakeSuccess: true }
    }, null, 2)
  ].join('\n\n');
}

export function runNativeHermesActionCli(request, env = process.env, spawnFn = spawn, timeoutMs = 120000) {
  const policy = NATIVE_CAPABILITY_POLICIES[request.capabilityId] || {};
  const prompt = buildNativeHermesActionPrompt(request);
  const toolsets = env.HERMES_NATIVE_ACTION_TOOLSETS || policy.toolsets || 'file,terminal';
  const childEnv = { ...env, HERMES_RUNTIME_TOOLSETS: toolsets };
  return runHermesRuntimeCli(prompt, childEnv, spawnFn, timeoutMs);
}

function statOutputPaths(paths) {
  return uniqueStrings(paths).map((filePath) => {
    try {
      const stat = fs.statSync(filePath);
      return { path: filePath, exists: true, mtimeMs: stat.mtimeMs, size: stat.size, isFile: stat.isFile() };
    } catch {
      return { path: filePath, exists: false };
    }
  });
}

function windowsPathToWslPath(windowsPath) {
  const normalized = String(windowsPath || '').trim().replace(/\\/g, '/');
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!match) return normalized;
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

function detectWindowsDesktopWslPath(env = process.env) {
  if (env.UMG_WINDOWS_DESKTOP_WSL_PATH) return { path: env.UMG_WINDOWS_DESKTOP_WSL_PATH.replace(/\/$/, ''), source: 'env' };
  try {
    const desktop = execFileSync('powershell.exe', ['-NoProfile', '-Command', '[Environment]::GetFolderPath(\'Desktop\')'], { encoding: 'utf8', timeout: 5000 }).trim();
    if (desktop) return { path: windowsPathToWslPath(desktop).replace(/\/$/, ''), source: 'powershell' };
  } catch {}
  return { path: '/mnt/c/Users/Magne/OneDrive/Desktop', source: 'fallback' };
}

function inferDesktopNoteOutputFromPrompt(request, env = process.env) {
  const text = String(request?.prompt || '').toLowerCase();
  if (!text.includes('desktop') || !(request?.capabilityId === 'umg.native.hermes.note_create' || request?.capabilityId === 'umg.native.hermes.file_write')) return undefined;
  const nameMatch = String(request.prompt || '').match(/(?:as|named|called)\s+[“\"]?([a-zA-Z0-9._-]+)[”\"]?/i);
  const base = (nameMatch?.[1] || 'umg-hermes-native-test').replace(/\.txt$/i, '');
  const desktop = detectWindowsDesktopWslPath(env);
  return { path: `${desktop.path}/${base}.txt`, source: desktop.source };
}

function withInferredExpectedOutputs(request, env = process.env) {
  if (Array.isArray(request.expectedOutputs) && request.expectedOutputs.length) return { request, pathSource: 'request' };
  const inferred = inferDesktopNoteOutputFromPrompt(request, env);
  if (!inferred) return { request, pathSource: 'none' };
  return { request: { ...request, expectedOutputs: [inferred.path], pathResolutionSource: inferred.source }, pathSource: inferred.source };
}

function hasDirectPermission(request, env = process.env) {
  const policy = NATIVE_CAPABILITY_POLICIES[request.capabilityId];
  if (!policy || request.mode !== 'direct') return false;
  if (request.risk === 'irreversible') return false;
  if (['high'].includes(request.risk) && request.userApproved !== true) return false;
  if (request.risk === 'medium' && policy.approvalRequiredByDefault && request.userApproved !== true && env.HERMES_NATIVE_ALLOW_MEDIUM_DIRECT !== 'true') return false;
  return policy.directAllowed === true || request.userApproved === true;
}

export async function buildNativeActionBridgeResponse(inputRequest, env = process.env, nativePost = runNativeHermesActionCli) {
  const inferredRequest = withInferredExpectedOutputs(inputRequest || {}, env);
  const request = inferredRequest.request;
  const validation = validateNativeActionRequest(request);
  if (!validation.ok) return jsonResponse(validation.status, buildNativeActionResult(request || {}, 'failed', validation.error, { error: validation.error }), undefined);
  if (request.mode === 'observe') return jsonResponse(200, buildNativeActionResult(request, 'observed', `Observed native Hermes action only; no execution occurred for ${request.capabilityId}.`), undefined);
  if (request.mode === 'blocked') return jsonResponse(200, buildNativeActionResult(request, 'blocked', `${request.capabilityId} blocked by UMG action policy.`), undefined);
  if (request.mode === 'approval' || !hasDirectPermission(request, env)) {
    return jsonResponse(200, buildNativeActionResult(request, 'approval_required', `${request.capabilityId} requires explicit approval before native Hermes execution.`), undefined);
  }
  const before = statOutputPaths(Array.isArray(request.expectedOutputs) ? request.expectedOutputs : []);
  try {
    const timeoutMs = Number(env.HERMES_NATIVE_ACTION_TIMEOUT_MS || 120000);
    const hermes = await nativePost(request, env, undefined, Number.isFinite(timeoutMs) ? timeoutMs : 120000);
    const after = statOutputPaths(Array.isArray(request.expectedOutputs) ? request.expectedOutputs : []);
    const createdFiles = after.filter((entry) => entry.exists && !before.find((pre) => pre.path === entry.path && pre.exists)).map((entry) => entry.path);
    const modifiedFiles = after.filter((entry) => entry.exists && before.find((pre) => pre.path === entry.path && pre.exists && pre.mtimeMs !== entry.mtimeMs)).map((entry) => entry.path);
    const externalActionTaken = createdFiles.length > 0 || modifiedFiles.length > 0 || request.capabilityId === 'umg.native.hermes.shell_command';
    if ((request.capabilityId === 'umg.native.hermes.note_create' || request.capabilityId === 'umg.native.hermes.file_write') && !externalActionTaken) {
      return jsonResponse(502, buildNativeActionResult(request, 'failed', 'Hermes CLI returned without producing the expected file output.', { stdout: hermes.text || '', commandOutput: hermes.text || '', error: 'Expected file output was not created or modified.' }), undefined);
    }
    const traceEvents = [
      ...buildNativeActionResult(request, 'executed', `${request.capabilityId} executed through native Hermes CLI.`).traceEvents,
      nativeActionTraceEvent(request, 'action_executed', 'complete', `${request.capabilityId} executed through native Hermes CLI.`),
      ...createdFiles.map((filePath) => nativeActionTraceEvent(request, 'file_created', 'complete', `File created: ${filePath}`, { filePath })),
      ...modifiedFiles.map((filePath) => nativeActionTraceEvent(request, 'file_modified', 'complete', `File modified: ${filePath}`, { filePath })),
      ...[...createdFiles, ...modifiedFiles].map((filePath) => nativeActionTraceEvent(request, 'artifact_created', 'complete', `Artifact recorded: ${filePath}`, { filePath }))
    ];
    return jsonResponse(200, {
      actionId: request.actionId,
      capabilityId: request.capabilityId,
      mode: request.mode,
      status: 'executed',
      externalActionTaken,
      createdFiles,
      modifiedFiles,
      pathResolutionSource: inferredRequest.pathSource,
      commandOutput: hermes.text || '',
      stdout: hermes.text || '',
      stderr: hermes.stderr || '',
      summary: `${request.capabilityId} executed through native Hermes CLI.${createdFiles.length ? ` Created: ${createdFiles.join(', ')}` : ''}${modifiedFiles.length ? ` Modified: ${modifiedFiles.join(', ')}` : ''}`,
      artifacts: [...createdFiles, ...modifiedFiles].map((filePath) => ({ kind: 'file', uri: filePath, path: filePath, sourceCapability: request.capabilityId, externalActionTaken: true })),
      traceEvents
    }, undefined);
  } catch (error) {
    const stderr = error && typeof error === 'object' ? String(error.stderr || '') : '';
    return jsonResponse(502, buildNativeActionResult(request, 'failed', `Hermes native action CLI failed.${stderr ? ` ${truncateText(stderr, 220)}` : ''}`, { error: error?.message || String(error), stderr }), undefined);
  }
}

function firstContinuationTarget(request) {
  const manifest = request.compiledSleeveManifest || {};
  const capability = request.pendingToolCapability || {};
  const firstStep = Array.isArray(manifest.executionPlan) ? manifest.executionPlan.find((step) => Array.isArray(step.requiredToolIds) && step.requiredToolIds.length) || manifest.executionPlan[0] : undefined;
  return {
    capabilityId: capability.capabilityId || request.approvedCapabilities?.[0] || request.deniedCapabilities?.[0] || firstStep?.requiredToolIds?.[0] || 'runtime_capability',
    neoBlockId: capability.requestedByNeoBlockId || (firstStep?.scopeKind === 'neoblock' ? firstStep.targetId : undefined),
    gateId: capability.requestedByGateId || firstStep?.requiredGateIds?.[0],
    moltBlockId: capability.requestedByMoltId,
    sleeveId: manifest.sleeveId
  };
}

function findRegistryEntry(request, capabilityId) {
  const registry = Array.isArray(request.toolCapabilityRegistry) ? request.toolCapabilityRegistry : [];
  return registry.find((entry) => entry?.capabilityId === capabilityId || entry?.mappedHermesToolName === capabilityId);
}

function safeCapabilityEntry(request, capabilityId) {
  const entry = findRegistryEntry(request, capabilityId);
  return entry?.capabilityId === capabilityId && entry.available === 'yes' && entry.executionPolicy === 'autoAllowed' && entry.safeForLiveExecution === true ? entry : undefined;
}

function capabilityTargetFromEntry(request, entry) {
  const manifest = request.compiledSleeveManifest || {};
  return {
    capabilityId: entry.capabilityId,
    toolName: entry.mappedHermesToolName || entry.capabilityId,
    neoBlockId: entry.relatedNeoBlockId,
    gateId: entry.relatedGateId,
    moltBlockId: entry.relatedMoltId,
    sleeveId: manifest.sleeveId
  };
}

function firstSafeCapabilityTarget(request) {
  const entry = safeCapabilityEntry(request, 'customer_message_draft') || safeCapabilityEntry(request, 'report_generate') || safeCapabilityEntry(request, 'umg.capability.local_text_composition');
  return entry ? capabilityTargetFromEntry(request, entry) : undefined;
}

export function selectNextRuntimeStepAfterCapability(request, completedCapability, completedNeoBlockId) {
  const preferredNext = completedCapability === 'customer_message_draft' ? ['report_generate', 'audit_log_write'] : [];
  for (const capabilityId of preferredNext) {
    const entry = safeCapabilityEntry(request, capabilityId);
    if (!entry) continue;
    const target = capabilityTargetFromEntry(request, entry);
    return {
      nextCapabilityId: capabilityId,
      nextNeoBlockId: target.neoBlockId,
      nextMoltId: target.moltBlockId,
      nextGateId: target.gateId,
      routeReason: `${completedCapability} completed; ${capabilityId} is the next configured safe app-local runtime capability.`,
      routeConfidence: capabilityId === 'report_generate' ? 0.86 : 0.64,
      safeForLiveExecution: true,
      externalActionTaken: false,
      fromCapabilityId: completedCapability,
      fromNeoBlockId: completedNeoBlockId,
      target
    };
  }
  return {
    nextCapabilityId: undefined,
    routeReason: `${completedCapability} completed; no configured safe next capability is available.`,
    routeConfidence: 0,
    safeForLiveExecution: false,
    externalActionTaken: false,
    fromCapabilityId: completedCapability,
    fromNeoBlockId: completedNeoBlockId
  };
}

function buildCustomerMessageDraftContent(request, target) {
  const manifest = request.compiledSleeveManifest || {};
  const title = manifest.sleeveTitle || 'Return Request Workflow';
  return {
    artifactType: 'customer_message_draft',
    title: 'Return Request Customer Reply Draft',
    body: [
      'Hello,',
      '',
      `Thanks for contacting us about your return request. We are reviewing the purchase record and eligibility details using the ${title} workflow.`,
      'Please keep the item and order information available while the return window, item condition, and refund path are checked.',
      'If the return is eligible, we will provide return instructions and prepare the appropriate refund or store-credit request for review. No refund or inventory action has been executed from this draft.',
      '',
      'Regards,',
      'Customer Support'
    ].join('\n'),
    sourceCapability: 'customer_message_draft',
    nonDestructive: true,
    externalActionTaken: false,
    relatedNeoBlockId: target.neoBlockId,
    relatedGateId: target.gateId,
    relatedMoltId: target.moltBlockId
  };
}

function buildReportGenerateContent(request, target, previousArtifact) {
  const manifest = request.compiledSleeveManifest || {};
  return {
    artifactType: 'return_workflow_report',
    title: 'Return Workflow Runtime Summary',
    body: [
      `Runtime summary for ${manifest.sleeveTitle || 'the generated return/refund Sleeve'}.`,
      'The customer response draft was prepared as a safe app-local artifact.',
      'Purchase validation and eligibility review still require real order-system data before any business decision.',
      'No email was sent, no refund was issued, and no inventory or production record was changed.',
      'Recommended next action: a human operator should review the draft, verify order/eligibility data in the real system, and approve any refund or customer send action outside this proof path.'
    ].join('\n'),
    sourceCapability: 'report_generate',
    nonDestructive: true,
    externalActionTaken: false,
    relatedNeoBlockId: target.neoBlockId,
    relatedGateId: target.gateId,
    relatedMoltId: target.moltBlockId,
    previousArtifactSummary: previousArtifact?.title ? `${previousArtifact.title} completed` : 'customer_message_draft completed',
    routeRelationship: 'Generated after customer_message_draft'
  };
}

function buildLocalNoteArtifactContent(request, target) {
  const userGoal = String(request.userGoal || '').toLowerCase();
  const mentionsApples = userGoal.includes('apple');
  const mentionsGreek = /greek|philosophy|stoic|aristotle|plato|socrates/.test(userGoal);
  return {
    artifactType: 'local_note_safe_artifact',
    title: 'Greek-Infused Desktop Note',
    body: [
      'Greek-Infused Desktop Note',
      '',
      mentionsApples
        ? 'Apples invite a simple meditation: like Aristotle’s idea of telos, each apple carries purpose from seed to fruit, nourishing the person who chooses it with care.'
        : 'This note is prepared as a Greek philosophy reflection for the requested desktop note topic.',
      mentionsGreek
        ? 'A Stoic lens adds: value the apple in front of you, act with moderation, and let wisdom shape the appetite before action.'
        : 'Greek philosophy can still guide the note through moderation, purpose, and practical wisdom.',
      '',
      'Prepared as a reviewable app-local artifact only. No desktop file was written.'
    ].join('\n'),
    sourceCapability: target.capabilityId,
    nonDestructive: true,
    externalActionTaken: false,
    destructiveAction: false,
    fileWritePerformed: false,
    safeAppLocalArtifact: true,
    relatedNeoBlockId: target.neoBlockId,
    relatedGateId: target.gateId,
    relatedMoltId: target.moltBlockId
  };
}

function buildCapabilityEvents(request, target, eventBase, base, offset) {
  return [
    ...(target.neoBlockId ? [{ traceId: request.traceId, eventId: `${eventBase}.${target.capabilityId}.neoblock.started`, timestamp: base + offset, eventType: 'neoblock_started', message: `${target.capabilityId} NeoBlock started`, scopeKind: 'neoblock', neoBlockId: target.neoBlockId, status: 'active' }] : []),
    ...(target.moltBlockId ? [{ traceId: request.traceId, eventId: `${eventBase}.${target.capabilityId}.molt.used`, timestamp: base + offset + 1, eventType: 'molt_role_used', message: `${target.capabilityId} used MOLT guidance`, scopeKind: 'molt', moltBlockId: target.moltBlockId, status: 'processing' }] : []),
    { traceId: request.traceId, eventId: `${eventBase}.${target.capabilityId}.tool.prepared`, timestamp: base + offset + 2, eventType: 'tool_call_prepared', message: `${target.capabilityId} prepared as configured safe app-local capability`, scopeKind: 'tool', toolId: target.capabilityId, neoBlockId: target.neoBlockId, gateId: target.gateId, moltBlockId: target.moltBlockId, status: 'attention' },
    { traceId: request.traceId, eventId: `${eventBase}.${target.capabilityId}.tool.executed`, timestamp: base + offset + 3, eventType: 'tool_call_executed', message: `${target.capabilityId} executed as real safe app-local Hermes capability without external side effects`, scopeKind: 'tool', toolId: target.capabilityId, neoBlockId: target.neoBlockId, gateId: target.gateId, moltBlockId: target.moltBlockId, status: 'complete' },
    { traceId: request.traceId, eventId: `${eventBase}.${target.capabilityId}.tool.result`, timestamp: base + offset + 4, eventType: 'tool_result_received', message: `${target.capabilityId} returned structured non-destructive artifact`, scopeKind: 'tool', toolId: target.capabilityId, neoBlockId: target.neoBlockId, gateId: target.gateId, moltBlockId: target.moltBlockId, status: 'processing' },
    ...(target.neoBlockId ? [{ traceId: request.traceId, eventId: `${eventBase}.${target.capabilityId}.neoblock.completed`, timestamp: base + offset + 5, eventType: 'neoblock_completed', message: `${target.capabilityId} NeoBlock completed after artifact generation`, scopeKind: 'neoblock', neoBlockId: target.neoBlockId, status: 'complete' }] : [])
  ];
}

export function buildSafeCapabilityTraceEnvelope(request) {
  const target = firstSafeCapabilityTarget(request);
  if (!target) return undefined;
  const base = Date.now();
  const eventBase = String(request.traceId || 'safe_capability_trace').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const artifactContent = target.capabilityId === 'customer_message_draft'
    ? buildCustomerMessageDraftContent(request, target)
    : buildReportGenerateContent(request, target);
  const route = selectNextRuntimeStepAfterCapability(request, target.capabilityId, target.neoBlockId);
  const secondTarget = route.target;
  const secondArtifactContent = secondTarget?.capabilityId === 'report_generate' ? buildReportGenerateContent(request, secondTarget, artifactContent) : undefined;
  const routeEvents = secondTarget ? [
    ...(route.nextGateId ? [{ traceId: request.traceId, eventId: `${eventBase}.route.gate.opened`, timestamp: base + 6, eventType: 'gate_opened', message: route.routeReason, scopeKind: 'gate', gateId: route.nextGateId, status: 'active' }] : []),
    ...buildCapabilityEvents(request, secondTarget, eventBase, base, 7)
  ] : [];
  const events = [
    ...buildCapabilityEvents(request, target, eventBase, base, 0),
    ...routeEvents,
    { traceId: request.traceId, eventId: `${eventBase}.run.completed`, timestamp: base + (secondTarget ? 14 : 7), eventType: 'run_completed', message: secondTarget ? 'Hermes bridge completed multi-step safe app-local capability route' : 'Hermes bridge completed safe app-local capability execution', scopeKind: 'sleeve', sleeveId: target.sleeveId, status: 'complete' }
  ];
  const toolCalls = [
    { id: `tool.${eventBase}.${target.capabilityId}`, traceId: request.traceId, toolId: target.capabilityId, toolName: target.toolName, status: 'executed', input: { capabilityId: target.capabilityId, userGoal: request.userGoal, sleeveId: target.sleeveId, relatedNeoBlockId: target.neoBlockId, relatedGateId: target.gateId, relatedMoltId: target.moltBlockId }, output: artifactContent },
    ...(secondTarget && secondArtifactContent ? [{ id: `tool.${eventBase}.${secondTarget.capabilityId}`, traceId: request.traceId, toolId: secondTarget.capabilityId, toolName: secondTarget.toolName, status: 'executed', input: { capabilityId: secondTarget.capabilityId, previousCapabilityId: target.capabilityId, routeReason: route.routeReason, userGoal: request.userGoal, sleeveId: secondTarget.sleeveId, relatedNeoBlockId: secondTarget.neoBlockId, relatedGateId: secondTarget.gateId, relatedMoltId: secondTarget.moltBlockId }, output: secondArtifactContent }] : [])
  ];
  const artifacts = [
    { id: `artifact.${eventBase}.${target.capabilityId}`, traceId: request.traceId, label: artifactContent.title, kind: artifactContent.artifactType, content: artifactContent, metadata: { sourceCapability: target.capabilityId, realSafeAppLocalCapability: true, externalActionTaken: false } },
    ...(secondTarget && secondArtifactContent ? [{ id: `artifact.${eventBase}.${secondTarget.capabilityId}`, traceId: request.traceId, label: secondArtifactContent.title, kind: secondArtifactContent.artifactType, content: secondArtifactContent, metadata: { sourceCapability: secondTarget.capabilityId, realSafeAppLocalCapability: true, externalActionTaken: false, routeRelationship: 'Generated after customer_message_draft' } }] : [])
  ];
  return {
    traceId: request.traceId,
    status: 'ok',
    finalOutput: secondTarget ? `${target.capabilityId} completed, routed to ${secondTarget.capabilityId}, and generated two structured non-destructive runtime artifacts. No external email, refund, inventory, or production mutation occurred.` : `${target.capabilityId} generated a structured non-destructive runtime artifact. No safe next route was executed. No external email, refund, inventory, or production mutation occurred.`,
    events,
    trace: events,
    toolCalls,
    blockedCalls: [],
    approvalRequests: [],
    errors: [],
    artifacts,
    unmappedEvents: [],
    nextSuggestedActions: []
  };
}

export function buildContinuationTraceEnvelope(request) {
  const target = firstContinuationTarget(request);
  const approved = request.approvalDecision === 'approve';
  const base = Date.now();
  const eventBase = String(request.traceId || 'continuation_trace').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const localNoteArtifact = approved && target.capabilityId === 'umg.capability.local_note_file_write'
    ? buildLocalNoteArtifactContent(request, target)
    : undefined;
  const genericProof = approved ? { proofType: 'local_dev_proof', nonDestructive: true, notExternalTool: true, safeProof: true, destructiveAction: false, result: `${target.capabilityId} local_dev_proof continuation completed.` } : undefined;
  const toolOutput = localNoteArtifact ?? genericProof;
  const events = [
    {
      traceId: request.traceId,
      eventId: `${eventBase}.approval.${approved ? 'granted' : 'denied'}`,
      timestamp: base,
      eventType: approved ? 'approval_granted' : 'approval_denied',
      message: approved ? `Approval granted for ${target.capabilityId}` : `Approval denied for ${target.capabilityId}`,
      scopeKind: 'approval',
      approvalId: `approval.${target.capabilityId}`,
      status: approved ? 'complete' : 'blocked'
    },
    {
      traceId: request.traceId,
      eventId: `${eventBase}.tool.prepared`,
      timestamp: base + 1,
      eventType: 'tool_call_prepared',
      message: localNoteArtifact ? `${target.capabilityId} prepared as safe app-local note artifact; no desktop write will be performed` : `${target.capabilityId} continuation boundary prepared`,
      scopeKind: 'tool',
      toolId: target.capabilityId,
      neoBlockId: target.neoBlockId,
      gateId: target.gateId,
      moltBlockId: target.moltBlockId,
      status: 'attention'
    },
    {
      traceId: request.traceId,
      eventId: `${eventBase}.tool.${approved ? 'executed' : 'blocked'}`,
      timestamp: base + 2,
      eventType: approved ? 'tool_call_executed' : 'tool_call_blocked',
      message: approved ? `${target.capabilityId} safe continuation completed without irreversible external side effects` : `${target.capabilityId} was blocked by denial/skip`,
      scopeKind: 'tool',
      toolId: target.capabilityId,
      neoBlockId: target.neoBlockId,
      gateId: target.gateId,
      moltBlockId: target.moltBlockId,
      status: approved ? 'complete' : 'blocked'
    },
    ...(approved ? [{
      traceId: request.traceId,
      eventId: `${eventBase}.tool.result`,
      timestamp: base + 3,
      eventType: 'tool_result_received',
      message: localNoteArtifact ? 'Safe app-local desktop note artifact returned; fileWritePerformed false' : `${target.capabilityId} returned local_dev_proof non-destructive continuation result`,
      scopeKind: 'tool',
      toolId: target.capabilityId,
      neoBlockId: target.neoBlockId,
      gateId: target.gateId,
      moltBlockId: target.moltBlockId,
      status: 'processing'
    }] : []),
    ...(target.gateId ? [{
      traceId: request.traceId,
      eventId: `${eventBase}.gate.${approved ? 'opened' : 'blocked'}`,
      timestamp: base + 4,
      eventType: approved ? 'gate_opened' : 'gate_blocked',
      message: approved ? 'Gate opened after approval continuation' : 'Gate blocked after denial/skip continuation',
      scopeKind: 'gate',
      gateId: target.gateId,
      status: approved ? 'active' : 'blocked'
    }] : []),
    ...(target.neoBlockId ? [{
      traceId: request.traceId,
      eventId: `${eventBase}.neoblock.${approved ? 'completed' : 'rerouted'}`,
      timestamp: base + 5,
      eventType: approved ? 'neoblock_completed' : 'neoblock_rerouted',
      message: approved ? 'NeoBlock completed after approved continuation' : 'NeoBlock rerouted after denied/skipped capability',
      scopeKind: 'neoblock',
      neoBlockId: target.neoBlockId,
      status: approved ? 'complete' : 'attention'
    }] : []),
    {
      traceId: request.traceId,
      eventId: `${eventBase}.run.completed`,
      timestamp: base + 6,
      eventType: 'run_completed',
      message: 'Hermes bridge continuation completed from explicit runtime approval decision',
      scopeKind: 'sleeve',
      sleeveId: target.sleeveId,
      status: approved ? 'complete' : 'skipped'
    }
  ];
  const toolCall = {
    id: `tool.${eventBase}.${target.capabilityId}`,
    traceId: request.traceId,
    toolId: target.capabilityId,
    toolName: target.capabilityId,
    status: approved ? 'executed' : 'blocked',
    input: { continuationMode: request.continuationMode, approvalDecision: request.approvalDecision, relatedNeoBlockId: target.neoBlockId, relatedGateId: target.gateId, relatedMoltId: target.moltBlockId },
    output: toolOutput
  };
  return {
    traceId: request.traceId,
    status: approved ? 'ok' : 'blocked',
    finalOutput: approved ? `Continuation completed after approval for ${target.capabilityId}; safe app-local artifact path used and no irreversible external action was executed.` : `Continuation skipped ${target.capabilityId}; route blocked/rerouted without executing the tool.`,
    events,
    trace: events,
    toolCalls: approved ? [toolCall] : [],
    blockedCalls: approved ? [] : [toolCall],
    approvalRequests: [],
    errors: [],
    artifacts: approved ? [{ id: `artifact.${eventBase}.${target.capabilityId}`, traceId: request.traceId, label: localNoteArtifact?.title ?? `${target.capabilityId} local_dev_proof`, kind: localNoteArtifact?.artifactType ?? 'local_dev_proof', content: toolOutput, metadata: { sourceCapability: target.capabilityId, realSafeAppLocalCapability: Boolean(localNoteArtifact), externalActionTaken: false, destructiveAction: false, fileWritePerformed: false } }] : [],
    unmappedEvents: [],
    nextSuggestedActions: []
  };
}

export function validateCustomSleeveGenerationRequest(request) {
  if (!isRecord(request)) return { ok: false, status: 400, error: 'Hermes custom Sleeve generation request must be JSON.' };
  if (request.selectedMode !== 'custom_workflow') return { ok: false, status: 400, error: 'Only custom_workflow generation is enabled.' };
  if (!String(request.requestId || '').trim()) return { ok: false, status: 400, error: 'requestId is required.' };
  if (!String(request.userPrompt || '').trim()) return { ok: false, status: 400, error: 'userPrompt is required.' };
  const supported = ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];
  const requestedRoles = Array.isArray(request.supportedPromptMoltRoles) ? request.supportedPromptMoltRoles : [];
  if (!supported.every((role) => requestedRoles.includes(role))) return { ok: false, status: 400, error: 'supportedPromptMoltRoles must include current compiler-supported prompt roles.' };
  return { ok: true };
}

export function buildCustomSleeveGenerationPrompt(request) {
  const safeRequest = redactSecrets(request);
  return [
    'You are Hermes generating a UMG Studio Custom Workflow Sleeve plan.',
    'Use the app-local UMG skill bundle supplied below. Do not assume global Hermes skills are installed.',
    'Do not provide hidden reasoning. Include only a concise decompositionSummary.',
    'Do not perform external actions. Do not write source libraries. Do not import Website Builder.',
    'You are not merely producing a workflow outline. You are composing UMG Structural IR first: Sleeve → NeoStacks → NeoBlocks → MOLT roles → Merge operations → Gates → MetaMOLT Tool Blocks → Capabilities → Routes → Runtime trace expectations.',
    'Do not generate a generic workflow outline and then convert it. Think in UMG ontology before JSON: NeoStack = kind of work; NeoBlock = module/step inside that work; MOLT = atomic thought role inside the module; Merge = semantic/cognitive fusion operation; Gate = control/routing/approval object; MetaMOLT Tool Block = executable Hermes capability; Capability = runtime binding; Trace = what actually happened.',
    'Analyze userPrompt + userContext + uploadedIntakeContexts. Uploaded content must influence block selection and block generation; if uploaded content is unsupported or unreadable, say so and do not invent file contents.',
    'Use libraryCandidates first. Reuse relevant source-library blocks when they fit. Create only missing runtime-session draft blocks; do not emit lazy generic Process Task-style filler.',
    'Gates are control/routing/approval records, not prompt MOLT blocks.',
    'Required generation order: 1 parse prompt/context/uploads; 2 search library candidates; 3 identify domain and action intent; 4 identify major kinds of work; 5 create NeoStacks from kinds of work; 6 create NeoBlocks as reusable modules inside each NeoStack; 7 place MOLT roles inside each NeoBlock; 8 add Merge operations where concepts/layers must fuse; 9 add Gates for validation/routing/approval/policy; 10 add MetaMOLT Tool Blocks for Hermes-native tool actions; 11 define route edges; 12 run audit pass; 13 revise failed geometry; 14 convert final IR into JSON; 15 return JSON only.',
    'Return ONLY JSON matching schemaVersion umg-studio.hermes-custom-sleeve-plan.v0.1.',
    'Required top-level fields: structuralIR, auditResult, schemaVersion, source, mode, generationSource, requestId, title, summary, decompositionSummary, reuseDecisions, generatedDecisions, neoStacks, neoBlocks, moltBlocks, gates, capabilities, warnings.',
    'Exact required constants: source must equal hermes_custom_workflow_generation; mode must equal runtime_session_draft.',
    'structuralIR contract: {sleeve:{}, neoStacks:[], neoBlocks:[], moltLayers:[], mergeOps:[], gates:[], toolBlocks:[], routes:[]}. auditResult contract: {passed:true, checks:[{id, passed, notes}], revisionRequired:false}.',
    'Greek note calibration ground truth: S.GREEK_NOTE.01 Greek Philosophy Desktop Note Sleeve. NeoStacks: NS.01 Prompt Intake and Note Triggering with NB.01 Detect Note Generation Request and NB.02 Normalize Note Intent; NS.02 Greek Philosophical Lens Selection with NB.03 Retrieve Greek Philosophy Candidates and NB.04 Select Greek Lens; NS.03 Semantic Merge and Note Composition with NB.05 Merge Philosophy into Note Semantics / MERGE.GREEK_SEMANTIC_FRAME, NB.06 Merge Requested Form with Enriched Meaning / MERGE.FORM_WITH_SEMANTICS, NB.07 Compose Final Note Draft / MERGE.DRAFT_SYNTHESIS, NB.08 Validate Greek Integration / G.GREEK_INTEGRATION_CHECK; NS.04 Desktop Note Emission and Hermes Native Execution with NB.09 Prepare Desktop Note Action / TOOL.HERMES.NOTE_CREATE.v0.1 / TOOL.HERMES.FILE_WRITE.v0.1 / G.DESKTOP_WRITE_ACTION and NB.10 Verify Note Creation / G.OUTPUT_VERIFICATION. Route NB.01 ==> NB.02 ==> NB.03 ==> NB.04 ==> NB.05 ==> NB.06 ==> NB.07 ==> NB.08 ==> NB.09 ==> NB.10.',
    'Audit checklist ids must include: neostack_kind_of_work, stack_has_blocks, block_is_reusable_module, block_has_molt, molt_internal_layers, source_candidates_bound_as_molt_children, tool_blocks_attached, gates_are_control_objects, merge_ops_explicit, route_renderable, structure_inside_budget, runtime_graph_renderable_without_invented_geometry. If any audit item fails, revise structuralIR before returning JSON.',
    'Exact object field contract: every generated MOLT draft uses id, title, role, content, description, tags, sourceKind, stackOrder, optional jsonSchema, nlCard {title, role, category, tags, description, content}, and generationReason; every NeoBlock uses id, title, description/purpose, neoStackId or parentNeoStackId, stackOrder/blockOrder, moltBlockIds or moltBlocks, gates, capabilities, sourceKind, nlCard, jsonSchema, and generationReason; every NeoStack uses id, title, description/purpose, stackOrder, neoBlockIds or neoBlocks, sourceKind, nlCard, jsonSchema, kindOfWork, and generationReason.',
    'Every NeoBlock must contain meaningful MOLT layers. Every NeoStack must contain meaningful NeoBlocks. Every Sleeve must explain why each NeoStack exists. No bare NeoBlocks are allowed.',
    'Do not use alternate keys such as name, stackId, type-only blocks, id-only capability objects, or source objects without the required fields above.',
    'Use only prompt MOLT roles: directive, instruction, subject, primary, philosophy, blueprint.',
    'Every generatedDecision must set runtimeSessionOnly true and sourceLibraryWrite false.',
    'Capability declarations are declarations only; externalActionTaken must remain false.',
    'Runtime trace expectation: this app is the observing UMG surface for Hermes terminal/cognitive work. Generated routes and IDs must allow runtime events to light the active Sleeve/NeoStack/NeoBlock/MOLT/Gate/Tool path as Hermes executes, while unused blocks remain grey/off. Do not invent trace activation; define observable IDs and expected event mapping only.',
    `CUSTOM_WORKFLOW_REQUEST_JSON:\n${JSON.stringify(safeRequest, null, 2)}`
  ].join('\n\n');
}

export function parseJsonObjectFromText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Hermes returned empty output.');
  try { return JSON.parse(trimmed); } catch {}
  const fencedBlocks = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const fenced of fencedBlocks) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  const candidates = extractJsonObjectCandidates(trimmed);
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch {}
  }
  throw new Error('Hermes output did not contain a valid JSON object.');
}

function extractJsonObjectCandidates(text) {
  const candidates = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return candidates;
}

function hasObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validateNlCard(card, label, errors) {
  if (!hasObject(card)) {
    errors.push(`${label} requires nlCard.`);
    return;
  }
  for (const field of ['title', 'role', 'category', 'description', 'content']) {
    if (!String(card[field] || '').trim()) errors.push(`${label} nlCard requires ${field}.`);
  }
  if (!Array.isArray(card.tags)) errors.push(`${label} nlCard requires tags array.`);
}

function validateJsonSchema(schema, label, errors) {
  if (!hasObject(schema)) errors.push(`${label} requires jsonSchema.`);
}

function hasChildren(value, idsField, embeddedField) {
  return (Array.isArray(value?.[idsField]) && value[idsField].length > 0) || (Array.isArray(value?.[embeddedField]) && value[embeddedField].length > 0);
}

export function validateCustomSleevePlan(plan) {
  const errors = [];
  const supported = new Set(['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint']);
  if (!isRecord(plan)) return { valid: false, errors: ['Hermes custom Sleeve plan must be an object.'], warnings: [] };
  if (plan.schemaVersion !== 'umg-studio.hermes-custom-sleeve-plan.v0.1') errors.push('Unsupported Hermes custom Sleeve plan schemaVersion.');
  if (plan.source !== 'hermes_custom_workflow_generation') errors.push('source must be hermes_custom_workflow_generation.');
  if (plan.mode !== 'runtime_session_draft') errors.push('mode must be runtime_session_draft.');
  if (!plan.requestId) errors.push('requestId is required.');
  if (!plan.title) errors.push('title is required.');
  if (!plan.decompositionSummary) errors.push('decompositionSummary is required.');
  if (!hasObject(plan.structuralIR)) errors.push('structuralIR is required before final Sleeve JSON.');
  else {
    if (!hasObject(plan.structuralIR.sleeve)) errors.push('structuralIR.sleeve is required.');
    for (const field of ['neoStacks', 'neoBlocks', 'moltLayers', 'mergeOps', 'gates', 'toolBlocks', 'routes']) {
      if (!Array.isArray(plan.structuralIR[field])) errors.push(`structuralIR.${field} is required.`);
    }
  }
  if (!hasObject(plan.auditResult)) errors.push('auditResult is required.');
  else {
    if (plan.auditResult.passed !== true) errors.push('auditResult.passed must be true after revision.');
    if (plan.auditResult.revisionRequired !== false) errors.push('auditResult.revisionRequired must be false.');
    if (!Array.isArray(plan.auditResult.checks) || !plan.auditResult.checks.length) errors.push('auditResult.checks must be non-empty.');
  }
  if (!Array.isArray(plan.neoStacks) || !plan.neoStacks.length) errors.push('neoStacks must be non-empty.');
  if (!Array.isArray(plan.neoBlocks) || !plan.neoBlocks.length) errors.push('neoBlocks must be non-empty.');
  if (!Array.isArray(plan.moltBlocks) || !plan.moltBlocks.length) errors.push('moltBlocks must be non-empty.');
  for (const stack of plan.neoStacks || []) {
    const label = `NeoStack ${stack?.id || '(unknown)'}`;
    if (!String(stack?.sourceKind || '').trim()) errors.push(`${label} requires sourceKind.`);
    if (!String(stack?.generationReason || stack?.reason || '').trim()) errors.push(`${label} requires generationReason.`);
    if (!Number.isFinite(Number(stack?.stackOrder))) errors.push(`${label} requires stackOrder.`);
    if (!hasChildren(stack, 'neoBlockIds', 'neoBlocks')) errors.push(`${label} requires meaningful NeoBlock children.`);
    validateNlCard(stack?.nlCard, label, errors);
    validateJsonSchema(stack?.jsonSchema, label, errors);
  }
  for (const block of plan.neoBlocks || []) {
    const label = `NeoBlock ${block?.id || '(unknown)'}`;
    if (!String(block?.sourceKind || '').trim()) errors.push(`${label} requires sourceKind.`);
    if (!String(block?.generationReason || block?.reason || '').trim()) errors.push(`${label} requires generationReason.`);
    if (!String(block?.neoStackId || block?.parentNeoStackId || '').trim()) errors.push(`${label} requires neoStackId or parentNeoStackId.`);
    if (!Number.isFinite(Number(block?.stackOrder ?? block?.blockOrder))) errors.push(`${label} requires stackOrder or blockOrder.`);
    if (!hasChildren(block, 'moltBlockIds', 'moltBlocks')) errors.push(`${label} requires meaningful MOLT children.`);
    if (!Array.isArray(block?.gates)) errors.push(`${label} requires gates array.`);
    if (!Array.isArray(block?.capabilities)) errors.push(`${label} requires capabilities array.`);
    validateNlCard(block?.nlCard, label, errors);
    validateJsonSchema(block?.jsonSchema, label, errors);
  }
  for (const block of plan.moltBlocks || []) {
    const label = `MOLT ${block?.id || '(unknown)'}`;
    if (!supported.has(block?.role)) errors.push(`Unsupported prompt MOLT role: ${block?.role}`);
    if (!String(block?.content || '').trim()) errors.push(`${label} requires content.`);
    if (!String(block?.description || '').trim()) errors.push(`${label} requires description.`);
    if (!Array.isArray(block?.tags)) errors.push(`${label} requires tags array.`);
    if (!String(block?.sourceKind || '').trim()) errors.push(`${label} requires sourceKind.`);
    if (!String(block?.generationReason || block?.reason || '').trim()) errors.push(`${label} requires generationReason.`);
    if (!Number.isFinite(Number(block?.stackOrder))) errors.push(`${label} requires stackOrder.`);
    if (!/source-library/i.test(String(block?.sourceKind || ''))) {
      validateNlCard(block?.nlCard, label, errors);
      validateJsonSchema(block?.jsonSchema, label, errors);
    }
  }
  for (const decision of plan.generatedDecisions || []) {
    if (decision?.runtimeSessionOnly !== true) errors.push(`Generated decision ${decision?.id || '(unknown)'} must be runtimeSessionOnly.`);
    if (decision?.sourceLibraryWrite !== false) errors.push(`Generated decision ${decision?.id || '(unknown)'} must keep sourceLibraryWrite false.`);
  }
  return { valid: errors.length === 0, errors, warnings: Array.isArray(plan.warnings) ? plan.warnings : [] };
}

export async function buildCustomSleeveGenerationResponse(request, env = process.env, runtimePost = runHermesRuntimeCli) {
  const debug = {
    receivedLibraryCandidateCount: Array.isArray(request?.libraryCandidates) ? request.libraryCandidates.length : 0,
    receivedLibraryCandidateTopIds: Array.isArray(request?.libraryCandidates) ? request.libraryCandidates.slice(0, 5).map((candidate) => candidate?.id).filter(Boolean) : [],
    generationMode: 'live_hermes_cli',
    fallbackUsed: false,
    fallbackReason: undefined,
    responseSleeveTitle: undefined
  };
  const validation = validateCustomSleeveGenerationRequest(request);
  if (!validation.ok) return jsonResponse(validation.status, { ok: false, error: validation.error, validation: { valid: false, errors: [validation.error], warnings: [] }, externalActionTaken: false, debug: { ...debug, generationMode: 'rejected_request', fallbackUsed: false, fallbackReason: validation.error } }, undefined);
  const prompt = buildCustomSleeveGenerationPrompt(request);
  try {
    const timeoutMs = Number(env.HERMES_CUSTOM_SLEEVE_TIMEOUT_MS || env.HERMES_RUNTIME_TIMEOUT_MS || 90000);
    const hermes = await runtimePost(prompt, env, undefined, Number.isFinite(timeoutMs) ? timeoutMs : 90000);
    let plan;
    let parseRetryUsed = false;
    try {
      plan = parseJsonObjectFromText(hermes.text || '');
    } catch (parseError) {
      parseRetryUsed = true;
      const strictPrompt = `${prompt}

STRICT_RETRY_INSTRUCTION: Return only the JSON object. No prose. No markdown.`;
      const strictHermes = await runtimePost(strictPrompt, env, undefined, Number.isFinite(timeoutMs) ? timeoutMs : 90000);
      try {
        plan = parseJsonObjectFromText(strictHermes.text || '');
      } catch (strictParseError) {
        const reason = `Hermes output did not contain a valid JSON object after strict JSON retry. ${strictParseError?.message || parseError?.message || ''}`.trim();
        return jsonResponse(502, { ok: false, error: reason, validation: { valid: false, errors: [reason], warnings: [] }, externalActionTaken: false, debug: { ...debug, generationMode: 'live_hermes_json_parse_failed', failureStage: 'strict_json_retry_parse', fallbackUsed: false, fallbackReason: reason, parseRetryUsed: true, rawOutputPreview: truncateText(hermes.text || '', 400), retryOutputPreview: truncateText(strictHermes.text || '', 400) } }, undefined);
      }
    }
    let planValidation = validateCustomSleevePlan(plan);
    let structuralContractRetryUsed = false;
    if (!planValidation.valid && planValidation.errors.some((error) => /structuralIR|auditResult/i.test(error))) {
      structuralContractRetryUsed = true;
      const contractRetryPrompt = `${prompt}

STRICT_STRUCTURAL_IR_RETRY_INSTRUCTION: Return only valid JSON containing structuralIR, auditResult, and final Sleeve JSON fields. No prose. No markdown. structuralIR must contain sleeve, neoStacks, neoBlocks, moltLayers, mergeOps, gates, toolBlocks, routes. auditResult must contain passed:true, non-empty checks, revisionRequired:false. Include generationReason on every NeoStack, NeoBlock, and MOLT.`;
      const retryHermes = await runtimePost(contractRetryPrompt, env, undefined, Number.isFinite(timeoutMs) ? timeoutMs : 90000);
      try {
        plan = parseJsonObjectFromText(retryHermes.text || '');
        planValidation = validateCustomSleevePlan(plan);
      } catch (retryParseError) {
        const reason = `Hermes structural IR retry did not return valid JSON. ${retryParseError?.message || ''}`.trim();
        return jsonResponse(502, { ok: false, error: reason, validation: { valid: false, errors: [reason], warnings: [] }, externalActionTaken: false, debug: { ...debug, generationMode: 'live_hermes_structural_ir_retry_parse_failed', failureStage: 'structural_ir_retry_parse', fallbackUsed: false, fallbackReason: reason, parseRetryUsed, structuralContractRetryUsed: true, rawOutputPreview: truncateText(hermes.text || '', 400), retryOutputPreview: truncateText(retryHermes.text || '', 400) } }, undefined);
      }
    }
    if (!planValidation.valid) return jsonResponse(422, { ok: false, plan, validation: planValidation, externalActionTaken: false, debug: { ...debug, generationMode: 'live_hermes_validation_failed', failureStage: structuralContractRetryUsed ? 'structural_ir_retry_validation' : 'plan_validation', fallbackUsed: false, fallbackReason: planValidation.errors.join(' '), responseSleeveTitle: plan?.title, parseRetryUsed, structuralContractRetryUsed } }, undefined);
    return jsonResponse(200, { ok: true, plan: { ...plan, generationSource: plan.generationSource || 'live_hermes_cli' }, validation: planValidation, externalActionTaken: false, debug: { ...debug, responseSleeveTitle: plan.title, parseRetryUsed, structuralContractRetryUsed } }, undefined);
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    const stderr = error && typeof error === 'object' ? String(error.stderr || '') : '';
    const status = code === 'ETIMEDOUT' ? 504 : 502;
    const message = code === 'ETIMEDOUT' ? 'Hermes custom Sleeve generation CLI timed out.' : `Hermes custom Sleeve generation CLI failed.${stderr ? ` ${truncateText(stderr, 220)}` : ` ${error?.message || String(error)}`}`;
    return jsonResponse(status, { ok: false, error: message, validation: { valid: false, errors: [message], warnings: [] }, externalActionTaken: false, debug: { ...debug, generationMode: 'live_hermes_cli_error', fallbackUsed: false, fallbackReason: message } }, undefined);
  }
}

export async function buildRuntimeBridgeResponse(request, env = process.env, runtimePost = runHermesRuntimeCli) {
  const validation = validateRuntimeRequest(request, env);
  if (!validation.ok) return jsonResponse(validation.status, { status: 'error', finalOutput: validation.error, trace: [], events: [], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [{ code: 'HERMES_RUNTIME_REQUEST_REJECTED', message: validation.error, traceId: request?.traceId }], artifacts: [], unmappedEvents: [] }, undefined);

  if (request.continuationMode === 'continue_after_approval') {
    return jsonResponse(200, buildContinuationTraceEnvelope(request), undefined);
  }

  if (request.executionMode === 'approvalRequired') {
    const registry = Array.isArray(request.toolCapabilityRegistry) ? request.toolCapabilityRegistry : [];
    const hasApprovalRequiredCapability = registry.some((entry) => entry?.executionPolicy === 'approvalRequired' || entry?.requiredApproval === true);
    if (hasApprovalRequiredCapability) return jsonResponse(200, buildNeedsApprovalTraceEnvelope(request), undefined);
    const safeCapabilityEnvelope = buildSafeCapabilityTraceEnvelope(request);
    if (safeCapabilityEnvelope) return jsonResponse(200, safeCapabilityEnvelope, undefined);
    return jsonResponse(200, buildNeedsApprovalTraceEnvelope(request), undefined);
  }

  const prompt = buildHermesRuntimePrompt(request);
  try {
    const timeoutMs = Number(env.HERMES_RUNTIME_TIMEOUT_MS || 60000);
    const hermes = await runtimePost(prompt, env, undefined, Number.isFinite(timeoutMs) ? timeoutMs : 60000);
    const envelope = buildTraceEnvelopeFromHermesOutput(request, hermes.text || '');
    return jsonResponse(200, envelope, undefined);
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    const stderr = error && typeof error === 'object' ? String(error.stderr || '') : '';
    const status = code === 'ETIMEDOUT' ? 504 : 502;
    const message = code === 'ETIMEDOUT' ? 'Hermes runtime CLI timed out.' : 'Hermes runtime CLI failed.';
    const errorCode = code === 'ETIMEDOUT' ? 'HERMES_RUNTIME_TIMEOUT' : 'HERMES_RUNTIME_CLI_FAILED';
    return jsonResponse(status, { status: code === 'ETIMEDOUT' ? 'timeout' : 'error', finalOutput: `${message}${stderr ? ` ${truncateText(stderr, 220)}` : ''}`, trace: [], events: [], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [{ code: errorCode, message, traceId: request.traceId }], artifacts: [], unmappedEvents: [] }, undefined);
  }
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw) > BODY_LIMIT_BYTES) {
        reject(Object.assign(new Error('request body too large'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function writeNodeResponse(res, response, origin) {
  const headers = { ...response.headers, ...corsHeaders(origin) };
  res.writeHead(response.status, headers);
  res.end(JSON.stringify(response.body));
}

export function createRuntimeBridgeServer(env = process.env) {
  return http.createServer(async (req, res) => {
    const started = Date.now();
    const origin = req.headers.origin;
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    if (requestUrl.pathname !== RUNTIME_PATH && requestUrl.pathname !== CUSTOM_SLEEVE_GENERATION_PATH && requestUrl.pathname !== NATIVE_ACTION_PATH) {
      writeNodeResponse(res, jsonResponse(404, { status: 'error', finalOutput: 'Hermes runtime bridge route not found.' }, origin), origin);
      return;
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      writeNodeResponse(res, jsonResponse(403, { status: 'error', finalOutput: 'Hermes runtime bridge rejected disallowed origin.' }, undefined), undefined);
      return;
    }
    if (req.method === 'OPTIONS') {
      writeNodeResponse(res, { status: 204, headers: corsHeaders(origin), body: '' }, origin);
      return;
    }
    if (req.method !== 'POST') {
      writeNodeResponse(res, jsonResponse(405, { status: 'error', finalOutput: 'Hermes runtime bridge only supports POST.' }, origin), origin);
      return;
    }

    try {
      const raw = await readRequestBody(req);
      let parsed;
      try {
        parsed = JSON.parse(raw || '{}');
      } catch {
        writeNodeResponse(res, jsonResponse(400, { status: 'error', finalOutput: 'Hermes runtime bridge received invalid JSON.' }, origin), origin);
        return;
      }
      const response = requestUrl.pathname === CUSTOM_SLEEVE_GENERATION_PATH
        ? await buildCustomSleeveGenerationResponse(parsed, env)
        : requestUrl.pathname === NATIVE_ACTION_PATH
          ? await buildNativeActionBridgeResponse(parsed, env)
          : await buildRuntimeBridgeResponse(parsed, env);
      writeNodeResponse(res, response, origin);
      logSafe(requestUrl.pathname === CUSTOM_SLEEVE_GENERATION_PATH ? 'hermes_custom_sleeve_generation_post' : requestUrl.pathname === NATIVE_ACTION_PATH ? 'hermes_native_action_post' : 'hermes_runtime_bridge_post', { status: response.status, durationMs: Date.now() - started, executionMode: parsed.executionMode, selectedMode: parsed.selectedMode, actionMode: parsed.mode, capabilityId: parsed.capabilityId, traceId: parsed.traceId, requestId: parsed.requestId, actionId: parsed.actionId });
    } catch (error) {
      const status = error?.status === 413 ? 413 : 500;
      const text = status === 413 ? 'Hermes runtime bridge request body is too large.' : 'Hermes runtime bridge internal error.';
      writeNodeResponse(res, jsonResponse(status, { status: 'error', finalOutput: text }, origin), origin);
      logSafe('hermes_runtime_bridge_error', { status, durationMs: Date.now() - started, error: error?.message || String(error) });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const host = process.env.HERMES_RUNTIME_BRIDGE_HOST || DEFAULT_HOST;
  const port = Number(process.env.HERMES_RUNTIME_BRIDGE_PORT || DEFAULT_PORT);
  const server = createRuntimeBridgeServer(process.env);
  server.listen(port, host, () => {
    logSafe('hermes_runtime_bridge_listening', { host, port, path: RUNTIME_PATH, cli: process.env.HERMES_CLI_PATH || HERMES_DEFAULT_CLI_PATH, toolsets: process.env.HERMES_RUNTIME_TOOLSETS || SAFE_TOOLSETS });
  });
}
