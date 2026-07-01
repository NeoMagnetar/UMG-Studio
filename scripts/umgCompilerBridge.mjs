#!/usr/bin/env node
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.UMG_COMPILER_BRIDGE_PORT || 8787);
const DEFAULT_MODULE = '/home/neomagnetar/umg-compiler/compiler-v0/dist/index.js';
const compilerModulePath = process.env.UMG_COMPILER_MODULE_PATH || DEFAULT_MODULE;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5_000_000) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asMoltType(role) {
  const allowed = new Set(['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint']);
  return allowed.has(role) ? role : undefined;
}

function buildCompilerSleeve(input) {
  const normalized = isRecord(input.normalizedStructure) ? input.normalizedStructure : {};
  const neoStacks = Array.isArray(normalized.neoStacks) ? normalized.neoStacks : [];
  const neoBlocks = Array.isArray(normalized.neoBlocks) ? normalized.neoBlocks : [];
  const moltBlocks = Array.isArray(normalized.moltBlocks) ? normalized.moltBlocks : [];
  const warnings = [];
  const blockIdsByNeoBlock = new Map(neoBlocks.map((block) => [block.id, Array.isArray(block.moltBlockIds) ? block.moltBlockIds : []]));
  const blocks = [];
  for (const block of moltBlocks) {
    const moltType = asMoltType(block.role);
    if (!moltType) {
      warnings.push({
        code: block.role === 'trigger' ? 'COMPILER_GATE_SCHEMA_PARTIAL_SUPPORT' : 'COMPILER_MOLT_ROLE_SKIPPED',
        message: block.role === 'trigger'
          ? 'Trigger records are not emitted as compiler MOLT prompt blocks; they remain gate/control metadata.'
          : `MOLT role ${block.role || 'unknown'} is not supported by compiler-v0 and was omitted.`,
        details: block.id
      });
      continue;
    }
    blocks.push({
      id: block.id,
      title: block.title,
      moltType,
      // Do not pass default UI off-state as compiler BlockRole "off"; compiler-v0
      // treats role=off as excluded from authority/primary selection.
      role: input.disabledStates?.[block.id] ? 'off' : undefined,
      content: block.content || '',
      tags: Array.isArray(block.tags) ? block.tags : []
    });
  }
  const validBlockIds = new Set(blocks.map((block) => block.id));
  const governancePrimaryBlockIds = moltBlocks
    .filter((block) => block.role === 'primary' && !block.parentNeoBlockId && validBlockIds.has(block.id))
    .map((block) => block.id);
  const stacks = neoStacks.map((stack) => {
    const blockIds = [
      ...governancePrimaryBlockIds,
      ...(Array.isArray(stack.neoBlockIds) ? stack.neoBlockIds : [])
      .flatMap((neoBlockId) => blockIdsByNeoBlock.get(neoBlockId) || [])
      .filter((blockId) => validBlockIds.has(blockId))
    ];
    const hasPrimary = blockIds.some((blockId) => blocks.find((block) => block.id === blockId)?.moltType === 'primary');
    if (blockIds.length > 0 && !hasPrimary) {
      const syntheticPrimaryId = `${stack.id}.COMPILER_PRIMARY`;
      blocks.push({
        id: syntheticPrimaryId,
        title: `${stack.title || stack.id} compiler primary`,
        moltType: 'primary',
        role: undefined,
        content: stack.description || `Compiler primary anchor for ${stack.title || stack.id}.`,
        tags: ['compiler-normalized-primary', 'runtime-session', ...(Array.isArray(stack.tags) ? stack.tags : [])]
      });
      validBlockIds.add(syntheticPrimaryId);
      blockIds.unshift(syntheticPrimaryId);
      warnings.push({
        code: 'COMPILER_PRIMARY_ANCHOR_ADDED',
        message: `Added compiler-only primary anchor for stack ${stack.id}; source-library MOLT bindings are preserved in metadata.`,
        details: syntheticPrimaryId
      });
    }
    return { id: stack.id, name: stack.title, domainKey: Array.isArray(stack.tags) ? stack.tags[0] : undefined, blockIds };
  }).filter((stack) => stack.blockIds.length > 0);

  if ((Array.isArray(normalized.gates) && normalized.gates.length) || (Array.isArray(input.gates) && input.gates.length)) {
    warnings.push({ code: 'COMPILER_GATE_SCHEMA_PARTIAL_SUPPORT', message: 'UMG gates preserved as metadata/control records; not compiled as MOLT prompt blocks.' });
  }

  return {
    sleeve: {
      id: input.sleeveId,
      name: input.sleeveTitle,
      version: normalized.version || 'phase6',
      blocks,
      stacks,
      triggers: [],
      governance: [],
      metadata: {
        gates: normalized.gates || input.gates || [],
        neoblocks: neoBlocks,
        activeStates: input.activeStates || {},
        disabledStates: input.disabledStates || {},
        traceMetadata: input.traceMetadata || {}
      }
    },
    triggerState: { activeTriggerIds: [] },
    warnings
  };
}

async function loadCompiler() {
  const mod = await import(pathToFileURL(compilerModulePath).href);
  if (typeof mod.compileSleeve !== 'function') {
    throw new Error(`Compiler module ${compilerModulePath} does not export compileSleeve.`);
  }
  return mod.compileSleeve;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method !== 'POST' || req.url !== '/compile') {
    return sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Use POST /compile.' } });
  }

  try {
    const body = await readBody(req);
    const request = JSON.parse(body);
    if (!request || request.mode !== 'compile' || !request.input) {
      return sendJson(res, 400, { ok: false, error: { code: 'INVALID_COMPILER_REQUEST', message: 'Expected UMGCompilerRequest with mode=compile and input.' } });
    }
    const { sleeve, triggerState, warnings } = buildCompilerSleeve(request.input);
    const compileSleeve = await loadCompiler();
    const compilerResult = compileSleeve(sleeve, triggerState);
    return sendJson(res, compilerResult?.hasErrors ? 422 : 200, {
      ok: !compilerResult?.hasErrors,
      compilerModulePath,
      compilerInput: { sleeve, triggerState },
      warnings,
      rawCompilerResult: compilerResult
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: {
        code: 'UMG_COMPILER_BRIDGE_ERROR',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      compilerModulePath
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`UMG compiler bridge listening on http://127.0.0.1:${PORT}/compile`);
  console.log(`Compiler module: ${compilerModulePath}`);
});
