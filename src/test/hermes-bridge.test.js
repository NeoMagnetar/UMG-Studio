import { describe, expect, it } from 'vitest';
import { buildBridgeResponse, buildProviderPayload, extractProviderText, redactSecrets, validateSafetyFlags } from '../../dev/hermes-generate-bridge.mjs';

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

describe('Hermes Generate local bridge helpers', () => {
  it('rejects unsafe safety flags without route switching or live execution', () => {
    expect(validateSafetyFlags({ ...safePacket, safety: { ...safePacket.safety, liveExecution: true } })).toMatchObject({
      ok: false,
      error: 'Hermes bridge rejected unsafe execution request.'
    });
  });

  it('returns clear missing provider config response', async () => {
    const response = await buildBridgeResponse(safePacket, {}, async () => {
      throw new Error('provider should not be called');
    });
    expect(response.status).toBe(503);
    expect(response.body.text).toBe('Hermes bridge is not configured. Set HERMES_PROVIDER_URL server-side.');
  });

  it('maps generic provider text response to app-supported text shape', async () => {
    const response = await buildBridgeResponse(safePacket, { HERMES_PROVIDER_URL: 'http://127.0.0.1:9999/generate', HERMES_MODEL: 'server-model', HERMES_API_KEY: 'SECRET_KEY' }, async (_url, providerPayload) => {
      expect(JSON.stringify(providerPayload)).not.toContain('SECRET_KEY');
      return { ok: true, status: 200, payload: { text: 'Hermes bridge generated output' } };
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'Hermes bridge generated output' });
  });

  it('maps OpenAI-compatible message response to app-supported text shape', () => {
    expect(extractProviderText({ choices: [{ message: { content: 'OpenAI compatible output' } }] })).toBe('OpenAI compatible output');
  });

  it('builds bounded provider payload without exposing API keys', () => {
    const payload = buildProviderPayload(safePacket, { HERMES_MODEL: 'server-model', HERMES_API_KEY: 'SECRET_KEY' });
    const serialized = JSON.stringify(payload);
    expect(payload.model).toBe('server-model');
    expect(serialized).toContain('routeSwitching');
    expect(serialized).toContain('liveExecution');
    expect(serialized).not.toContain('SECRET_KEY');
  });

  it('redacts key token and secret fields in log-safe objects', () => {
    expect(redactSecrets({ Authorization: 'Bearer SECRET', api_key: 'A', nested: { token: 'B', normal: 'ok' } })).toEqual({
      Authorization: '[REDACTED]',
      api_key: '[REDACTED]',
      nested: { token: '[REDACTED]', normal: 'ok' }
    });
  });
});
