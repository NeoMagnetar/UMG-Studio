import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const getBridgeModule = async () => import('../../dev/hermes-generate-bridge.mjs');

const safePacket = {
  mode: 'umg_studio_generate_test',
  userRequest: 'Build a mobile detailing lead response.',
  compiledPromptPreview: 'Prompt preview must remain supplied data only.',
  selectedMoltBlocks: [{ id: 'molt_1', title: 'Collect customer name', role: 'instruction', active: true, off: false }],
  workspaceStructure: { id: 'ws_test', title: 'Test Workspace', activeSleeveId: 'sleeve_1' },
  runtimeSpecSummary: { source: 'real', compiler: 'umg-compiler' },
  gateContext: { projectionOnly: true, value: { attached: [] } },
  safety: {
    routeSwitching: false,
    liveExecution: false,
    toolExecution: false,
    promptContentMutation: false
  },
  generation: { model: 'browser-model', temperature: 0.3, maxTokens: 1200 }
};

function makeMockStream() {
  const stream = new EventEmitter();
  stream.setEncoding = () => stream;
  return stream;
}

function makeMockProcess({ stdout = '', stderr = '', code = 0, delayMs = 1, close = true } = {}) {
  const stdoutStream = makeMockStream();
  const stderrStream = makeMockStream();

  const proc = new EventEmitter();
  proc.stdout = stdoutStream;
  proc.stderr = stderrStream;
  proc.kill = vi.fn();

  setTimeout(() => {
    if (stdout) {
      stdoutStream.emit('data', stdout);
    }
    if (stderr) {
      stderrStream.emit('data', stderr);
    }
    if (close) {
      proc.emit('close', code, null);
    }
  }, delayMs);

  return proc;
}

describe('Hermes Generate local bridge helpers', () => {
  it('rejects unsafe safety flags without route switching or live execution', async () => {
    const { validateSafetyFlags } = await getBridgeModule();
    expect(validateSafetyFlags({ ...safePacket, safety: { ...safePacket.safety, liveExecution: true } })).toMatchObject({
      ok: false,
      error: 'Hermes bridge rejected unsafe execution request.'
    });
  });

  it('returns clear missing provider config response', async () => {
    const { buildBridgeResponse } = await getBridgeModule();
    const response = await buildBridgeResponse(safePacket, {}, async () => {
      throw new Error('provider should not be called');
    });
    expect(response.status).toBe(503);
    expect(response.body.text).toBe('Hermes bridge is not configured. Set HERMES_PROVIDER_URL server-side.');
  });

  it('maps generic provider text response to app-supported text shape', async () => {
    const { buildBridgeResponse } = await getBridgeModule();
    const response = await buildBridgeResponse(
      safePacket,
      { HERMES_PROVIDER_URL: 'http://127.0.0.1:9999/generate', HERMES_MODEL: 'server-model', HERMES_API_KEY: 'SECRET_KEY' },
      async (_url, providerPayload) => {
        expect(JSON.stringify(providerPayload)).not.toContain('SECRET_KEY');
        return { ok: true, status: 200, payload: { text: 'Hermes bridge generated output' } };
      }
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'Hermes bridge generated output' });
  });

  it('maps local Spark CLI stdout to app-supported text shape with bounded args', async () => {
    const { runHermesSparkCli } = await getBridgeModule();
    const captured = {};
    const spawnMock = vi.fn((command, args, options) => {
      captured.command = command;
      captured.args = args;
      captured.options = options;
      return makeMockProcess({
        stdout: 'Hermes Spark CLI generated output',
        stderr: '',
        code: 0
      });
    });
    const result = await runHermesSparkCli(
      'Build a concise mobile detailing lead response',
      {
        HERMES_CLI_PATH: '/home/neomagnetar/.local/bin/hermes',
        HERMES_INFERENCE_PROVIDER: 'openai-codex',
        HERMES_INFERENCE_MODEL: 'gpt-5.3-codex-spark'
      },
      spawnMock
    );

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(captured.command).toBe('/home/neomagnetar/.local/bin/hermes');
    expect(captured.args).toEqual([
      '-z',
      'Build a concise mobile detailing lead response',
      '--provider',
      'openai-codex',
      '--model',
      'gpt-5.3-codex-spark'
    ]);
    expect(captured.options).toMatchObject({
      stdio: ['ignore', 'pipe', 'pipe']
    });
    expect(captured.options.shell).toBeUndefined();
    expect(result).toEqual({ ok: true, status: 200, text: 'Hermes Spark CLI generated output' });
  });


  it('maps local Spark CLI stderr/exit failure to visible bridge response error text', async () => {
    const { buildBridgeResponse } = await getBridgeModule();
    const response = await buildBridgeResponse(
      safePacket,
      {
        HERMES_BACKEND: 'local_spark_cli'
      },
      async () => ({ ok: false, status: 500, payload: {} }),
      async () => {
        const err = new Error('command failed');
        err.code = 1;
        err.stderr = 'tool use not allowed';
        throw err;
      }
    );

    expect(response.status).toBe(502);
    expect(response.body.text).toContain('Hermes Spark CLI failed.');
    expect(response.body.text).toContain('tool use not allowed');
  });

  it('returns visible timeout error for local Spark CLI timeout', async () => {
    const { buildBridgeResponse } = await getBridgeModule();
    const response = await buildBridgeResponse(
      safePacket,
      {
        HERMES_BACKEND: 'local_spark_cli',
        HERMES_SPARK_TIMEOUT_MS: '8'
      },
      async () => ({ ok: false, status: 500, payload: {} }),
      async () => {
        const err = new Error('Hermes Spark CLI command timed out.');
        err.code = 'ETIMEDOUT';
        throw err;
      }
    );

    expect(response.status).toBe(504);
    expect(response.body.text).toContain('Hermes Spark CLI timed out.');
  });


  it('maps OpenAI-compatible message response to app-supported text shape', async () => {
    const { extractProviderText } = await getBridgeModule();
    expect(extractProviderText({ choices: [{ message: { content: 'OpenAI compatible output' } }] })).toBe('OpenAI compatible output');
  });

  it('builds bounded provider payload without exposing API keys', async () => {
    const { buildProviderPayload } = await getBridgeModule();
    const payload = buildProviderPayload(safePacket, { HERMES_MODEL: 'server-model', HERMES_API_KEY: 'SECRET_KEY' });
    const serialized = JSON.stringify(payload);
    expect(payload.model).toBe('server-model');
    expect(serialized).toContain('routeSwitching');
    expect(serialized).toContain('liveExecution');
    expect(serialized).not.toContain('SECRET_KEY');
  });

  it('redacts key token and secret fields in log-safe objects', async () => {
    const { redactSecrets } = await getBridgeModule();
    expect(redactSecrets({ Authorization: 'Bearer SECRET', api_key: 'A', nested: { token: 'B', normal: 'ok' } })).toEqual({
      Authorization: '[REDACTED]',
      api_key: '[REDACTED]',
      nested: { token: '[REDACTED]', normal: 'ok' }
    });
  });
});
