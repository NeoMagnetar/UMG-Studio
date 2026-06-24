import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { spawn } from 'node:child_process';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 8787;
export const BRIDGE_PATH = '/api/hermes/generate';
export const BODY_LIMIT_BYTES = 512 * 1024;

export const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5177',
  'http://localhost:5177'
]);

const SECRET_KEYS = /authorization|api[_-]?key|\bkey\b|token|secret/i;
const UNSAFE_FLAGS = ['routeSwitching', 'liveExecution', 'toolExecution', 'promptContentMutation'];

const SPARK_DEFAULT_CLI_PATH = '/home/neomagnetar/.local/bin/hermes';
const SPARK_DEFAULT_PROVIDER = 'openai-codex';
const SPARK_DEFAULT_MODEL = 'gpt-5.3-codex-spark';
const LOCAL_SPARK_BACKEND = 'local_spark_cli';

function logSafe(event, details = {}) {
  const safe = redactSecrets(details);
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...safe }));
}

export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (!value || typeof value !== 'object') return value;
  const redacted = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEYS.test(key)) {
      redacted[key] = '[REDACTED]';
    } else if (entry && typeof entry === 'object') {
      redacted[key] = redactSecrets(entry);
    } else {
      redacted[key] = entry;
    }
  }
  return redacted;
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
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(origin)
    },
    body
  };
}

export function parseJsonBody(rawBody) {
  try {
    const parsed = JSON.parse(rawBody || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Hermes bridge received invalid JSON.' };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: 'Hermes bridge received invalid JSON.' };
  }
}

export function validateSafetyFlags(packet) {
  const safety = packet?.safety;
  if (!safety || typeof safety !== 'object') return { ok: true };
  const unsafe = UNSAFE_FLAGS.filter((flag) => safety[flag] === true);
  if (unsafe.length) {
    return { ok: false, error: 'Hermes bridge rejected unsafe execution request.', unsafe };
  }
  return { ok: true };
}

function truncateText(text, limit) {
  if (typeof text !== 'string') return text;
  return text.length > limit ? `${text.slice(0, limit)}\n...[truncated]` : text;
}

export function buildProviderPayload(packet, env = process.env) {
  const model = env.HERMES_MODEL || packet?.generation?.model || 'hermes-default';
  const content = {
    userRequest: truncateText(packet.userRequest || '', 4000),
    compiledPromptPreview: truncateText(packet.compiledPromptPreview || '', 12000),
    selectedMoltBlocks: Array.isArray(packet.selectedMoltBlocks) ? packet.selectedMoltBlocks.slice(0, 64) : [],
    workspaceStructure: packet.workspaceStructure || {},
    runtimeSpecSummary: packet.runtimeSpecSummary || {},
    gateContext: packet.gateContext ? { projectionOnly: true, value: packet.gateContext } : undefined,
    safety: {
      routeSwitching: false,
      liveExecution: false,
      toolExecution: false,
      promptContentMutation: false
    }
  };

  return {
    model,
    messages: [
      {
        role: 'system',
        content: 'Generate user-facing output from supplied UMG RuntimeSpec summary and selected block structure. Do not execute tools. Do not route switch. Do not mutate prompt content. Do not claim live execution.'
      },
      {
        role: 'user',
        content: JSON.stringify(content, null, 2)
      }
    ],
    temperature: packet?.generation?.temperature ?? 0.3,
    max_tokens: packet?.generation?.maxTokens ?? 1200
  };
}

function buildSparkPrompt(packet, env = process.env) {
  const providerModel = env.HERMES_INFERENCE_MODEL || SPARK_DEFAULT_MODEL;
  const blocks = Array.isArray(packet?.selectedMoltBlocks) ? packet.selectedMoltBlocks : [];
  const maxRequest = truncateText(packet?.userRequest || '', 1200);
  const maxPreview = truncateText(packet?.compiledPromptPreview || '', 1600);
  const selectedSummary = blocks
    .slice(0, 30)
    .map((block) => `${block.title || block.id || 'Untitled'} (${block.role || 'block'})`)
    .join(', ');
  const workspace = packet?.workspaceStructure;
  const runtimeSummary = packet?.runtimeSpecSummary;

  return [
    'You are an editor for UMG studio generated lead workflows.',
    `Model: ${providerModel}.`,
    'Generate concise user-facing output (about 500 words or less unless the user explicitly requests more).',
    'Use only the provided workspace context. Produce a practical assistant-ready summary and suggested follow-up.',
    'Rules:',
    '- Do not execute tools.',
    '- Do not route switch.',
    '- Do not claim live execution.',
    '- Keep output concise and safe for users.',
    '',
    `User request: ${maxRequest || 'No explicit user request.'}`,
    `Compiled preview: ${maxPreview || 'No compiled preview provided.'}`,
    `Workspace: ${JSON.stringify(workspace || {}, null, 2)}`,
    `RuntimeSpec summary: ${JSON.stringify(runtimeSummary || {}, null, 2)}`,
    `Selected blocks: ${selectedSummary || 'No selected blocks.'}`
  ].join('\n');
}

export function runHermesSparkCli(prompt, env = process.env, spawnFn = spawn, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const cliPath = env.HERMES_CLI_PATH || SPARK_DEFAULT_CLI_PATH;
    const provider = env.HERMES_INFERENCE_PROVIDER || SPARK_DEFAULT_PROVIDER;
    const model = env.HERMES_INFERENCE_MODEL || SPARK_DEFAULT_MODEL;
    const args = ['-z', prompt, '--provider', provider, '--model', model];
    let stdout = '';
    let stderr = '';
    let settled = false;
    let child;

    const finish = (code, signal) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      if (code === 0 && !signal) {
        return resolve({ ok: true, status: 200, text: truncateText(stdout.trim(), 12000) || 'Hermes Spark CLI returned empty output.' });
      }
      const error = new Error(signal ? `Hermes Spark CLI exited with ${signal}` : `Hermes Spark CLI exited with status ${code}`);
      error.code = signal || code;
      error.stderr = stderr;
      reject(error);
    };

    const timer = setTimeout(() => {
      if (child && child.kill) {
        child.kill('SIGKILL');
      }
      reject(Object.assign(new Error('Hermes Spark CLI command timed out.'), { code: 'ETIMEDOUT', stderr: stderr || 'Timeout after no response from Hermes Spark CLI.' }));
    }, timeoutMs);

    child = spawnFn(cliPath, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (!child || typeof child.on !== 'function') {
      clearTimeout(timer);
      reject(new Error('Hermes Spark CLI spawn returned no process.'));
      return;
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      reject(error);
    });

    child.on('close', (code, signal) => finish(code, signal));
  });
}

export function extractProviderText(payload) {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return String(payload ?? '');
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  if (typeof choice?.message?.content === 'string') return choice.message.content;
  if (typeof choice?.text === 'string') return choice.text;
  for (const key of ['text', 'output', 'message', 'result']) {
    if (typeof payload[key] === 'string') return payload[key];
  }
  return JSON.stringify(redactSecrets(payload), null, 2);
}

export function postToProvider(providerUrl, payload, env = process.env, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const url = new URL(providerUrl);
    const client = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const headers = {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body)
    };
    if (env.HERMES_API_KEY) headers.authorization = `Bearer ${env.HERMES_API_KEY}`;

    const req = client.request({
      method: 'POST',
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      headers,
      timeout: timeoutMs
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
        if (responseBody.length > BODY_LIMIT_BYTES) req.destroy(new Error('provider response too large'));
      });
      res.on('end', () => {
        let parsed = responseBody;
        try {
          parsed = responseBody ? JSON.parse(responseBody) : '';
        } catch {
          parsed = responseBody;
        }
        resolve({ status: res.statusCode || 0, ok: Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300), payload: parsed });
      });
    });

    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('provider timeout'), { code: 'ETIMEDOUT' }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function buildBridgeResponse(packet, env = process.env, providerPost = postToProvider, sparkPost = runHermesSparkCli) {
  const safety = validateSafetyFlags(packet);
  if (!safety.ok) return jsonResponse(400, { text: safety.error }, undefined);

  const backend = (env.HERMES_BACKEND || '').trim();
  if (backend === LOCAL_SPARK_BACKEND) {
    const prompt = buildSparkPrompt(packet, env);
    try {
      const sparkTimeoutMs = Number(env.HERMES_SPARK_TIMEOUT_MS || 30000);
      const spark = await sparkPost(prompt, env, undefined, Number.isFinite(sparkTimeoutMs) ? sparkTimeoutMs : 30000);
      return jsonResponse(200, { text: spark.text }, undefined);
    } catch (error) {
      const code = error && typeof error === 'object' ? error.code : undefined;
      const stderr = error && typeof error === 'object' ? String(error.stderr || '') : '';
      if (code === 'ETIMEDOUT') {
        return jsonResponse(504, { text: `Hermes Spark CLI timed out.${stderr ? ` stderr: ${truncateText(stderr, 220)}` : ''}` }, undefined);
      }
      return jsonResponse(502, {
        text: `Hermes Spark CLI failed.${stderr ? ` ${truncateText(stderr, 220)}` : ''}`
      }, undefined);
    }
  }

  if (!env.HERMES_PROVIDER_URL) {
    return jsonResponse(503, { text: 'Hermes bridge is not configured. Set HERMES_PROVIDER_URL server-side.' }, undefined);
  }

  const providerPayload = buildProviderPayload(packet, env);
  try {
    const provider = await providerPost(env.HERMES_PROVIDER_URL, providerPayload, env);
    const text = extractProviderText(provider.payload);
    if (!provider.ok) {
      return jsonResponse(provider.status || 502, { text: `Hermes provider error: HTTP ${provider.status}\n${text}` }, undefined);
    }
    return jsonResponse(200, { text }, undefined);
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    if (code === 'ETIMEDOUT') return jsonResponse(504, { text: 'Hermes bridge timed out waiting for provider.' }, undefined);
    return jsonResponse(502, { text: 'Hermes bridge could not reach provider.' }, undefined);
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

export function createBridgeServer(env = process.env) {
  return http.createServer(async (req, res) => {
    const started = Date.now();
    const origin = req.headers.origin;
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    if (requestUrl.pathname !== BRIDGE_PATH) {
      writeNodeResponse(res, jsonResponse(404, { text: 'Hermes bridge route not found.' }, origin), origin);
      return;
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      writeNodeResponse(res, jsonResponse(403, { text: 'Hermes bridge rejected disallowed origin.' }, undefined), undefined);
      return;
    }

    if (req.method === 'OPTIONS') {
      writeNodeResponse(res, { status: 204, headers: corsHeaders(origin), body: '' }, origin);
      return;
    }

    if (req.method !== 'POST') {
      writeNodeResponse(res, jsonResponse(405, { text: 'Hermes bridge only supports POST.' }, origin), origin);
      return;
    }

    try {
      const raw = await readRequestBody(req);
      const parsed = parseJsonBody(raw);
      if (!parsed.ok) {
        writeNodeResponse(res, jsonResponse(400, { text: parsed.error }, origin), origin);
        return;
      }
      const response = await buildBridgeResponse(parsed.value, env);
      writeNodeResponse(res, response, origin);
      logSafe('hermes_generate_bridge_post', {
        status: response.status,
        durationMs: Date.now() - started,
        providerUrl: env.HERMES_PROVIDER_URL ? new URL(env.HERMES_PROVIDER_URL).origin : 'not_configured'
      });
    } catch (error) {
      const status = error?.status === 413 ? 413 : 500;
      const text = status === 413 ? 'Hermes bridge request body is too large.' : 'Hermes bridge internal error.';
      writeNodeResponse(res, jsonResponse(status, { text }, origin), origin);
      logSafe('hermes_generate_bridge_error', { status, durationMs: Date.now() - started, error: error?.message || String(error) });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const host = process.env.HERMES_BRIDGE_HOST || DEFAULT_HOST;
  const port = Number(process.env.HERMES_BRIDGE_PORT || DEFAULT_PORT);
  const server = createBridgeServer(process.env);
  server.listen(port, host, () => {
    logSafe('hermes_generate_bridge_listening', { host, port, path: BRIDGE_PATH, providerConfigured: Boolean(process.env.HERMES_PROVIDER_URL) });
  });
}
