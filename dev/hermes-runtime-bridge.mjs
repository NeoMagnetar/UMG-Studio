import http from 'node:http';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 8788;
export const RUNTIME_PATH = '/api/hermes/runtime';
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
    'You are the real local Hermes cognition runtime for a UMG Studio dry-run proof.',
    'Reason through the supplied compiled UMG runtime manifest. Do not execute tools. Do not request shell, browser, network, or filesystem tools.',
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
  const allowedTools = Array.isArray(request.allowedTools) ? request.allowedTools : Array.isArray(manifest.toolPolicy?.allowedTools) ? manifest.toolPolicy.allowedTools : [];
  const step = executionPlan.find((entry) => Array.isArray(entry.requiredToolIds) && entry.requiredToolIds.length)
    || executionPlan.find((entry) => Array.isArray(entry.requiredGateIds) && entry.requiredGateIds.length)
    || executionPlan[0];
  const capabilityId = step?.requiredToolIds?.[0]
    || allowedTools.find((tool) => typeof tool === 'string' && tool.trim())
    || registry.find((entry) => entry?.toolId)?.toolId
    || 'runtime_capability';
  const registryEntry = registry.find((entry) => entry?.toolId === capabilityId || entry?.toolName === capabilityId);
  return {
    capabilityId,
    toolName: registryEntry?.toolName || capabilityId,
    neoBlockId: step?.scopeKind === 'neoblock' ? step.targetId : undefined,
    gateId: step?.requiredGateIds?.[0],
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

    child = spawnFn(cliPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
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

function firstContinuationTarget(request) {
  const manifest = request.compiledSleeveManifest || {};
  const capability = request.pendingToolCapability || {};
  const firstStep = Array.isArray(manifest.executionPlan) ? manifest.executionPlan.find((step) => Array.isArray(step.requiredToolIds) && step.requiredToolIds.length) || manifest.executionPlan[0] : undefined;
  return {
    capabilityId: capability.capabilityId || request.approvedCapabilities?.[0] || request.deniedCapabilities?.[0] || firstStep?.requiredToolIds?.[0] || 'runtime_capability',
    neoBlockId: capability.requestedByNeoBlockId || (firstStep?.scopeKind === 'neoblock' ? firstStep.targetId : undefined),
    gateId: capability.requestedByGateId || firstStep?.requiredGateIds?.[0],
    sleeveId: manifest.sleeveId
  };
}

export function buildContinuationTraceEnvelope(request) {
  const target = firstContinuationTarget(request);
  const approved = request.approvalDecision === 'approve';
  const base = Date.now();
  const eventBase = String(request.traceId || 'continuation_trace').replace(/[^a-zA-Z0-9_.-]/g, '_');
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
      message: `${target.capabilityId} continuation boundary prepared`,
      scopeKind: 'tool',
      toolId: target.capabilityId,
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
      status: approved ? 'complete' : 'blocked'
    },
    ...(approved ? [{
      traceId: request.traceId,
      eventId: `${eventBase}.tool.result`,
      timestamp: base + 3,
      eventType: 'tool_result_received',
      message: `${target.capabilityId} returned local non-destructive continuation result`,
      scopeKind: 'tool',
      toolId: target.capabilityId,
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
    input: { continuationMode: request.continuationMode, approvalDecision: request.approvalDecision },
    output: approved ? { safeProof: true, destructiveAction: false, result: `${target.capabilityId} local continuation proof completed.` } : undefined
  };
  return {
    traceId: request.traceId,
    status: approved ? 'ok' : 'blocked',
    finalOutput: approved ? `Continuation completed after approval for ${target.capabilityId}; no irreversible external action was executed.` : `Continuation skipped ${target.capabilityId}; route blocked/rerouted without executing the tool.`,
    events,
    trace: events,
    toolCalls: approved ? [toolCall] : [],
    blockedCalls: approved ? [] : [toolCall],
    approvalRequests: [],
    errors: [],
    artifacts: approved ? [{ id: `artifact.${eventBase}.${target.capabilityId}`, traceId: request.traceId, label: `${target.capabilityId} local proof`, kind: 'local_runtime_proof', content: { safe: true, destructiveAction: false } }] : [],
    unmappedEvents: [],
    nextSuggestedActions: []
  };
}

export async function buildRuntimeBridgeResponse(request, env = process.env, runtimePost = runHermesRuntimeCli) {
  const validation = validateRuntimeRequest(request, env);
  if (!validation.ok) return jsonResponse(validation.status, { status: 'error', finalOutput: validation.error, trace: [], events: [], toolCalls: [], blockedCalls: [], approvalRequests: [], errors: [{ code: 'HERMES_RUNTIME_REQUEST_REJECTED', message: validation.error, traceId: request?.traceId }], artifacts: [], unmappedEvents: [] }, undefined);

  if (request.continuationMode === 'continue_after_approval') {
    return jsonResponse(200, buildContinuationTraceEnvelope(request), undefined);
  }

  if (request.executionMode === 'approvalRequired') {
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

    if (requestUrl.pathname !== RUNTIME_PATH) {
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
      const response = await buildRuntimeBridgeResponse(parsed, env);
      writeNodeResponse(res, response, origin);
      logSafe('hermes_runtime_bridge_post', { status: response.status, durationMs: Date.now() - started, executionMode: parsed.executionMode, traceId: parsed.traceId });
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
