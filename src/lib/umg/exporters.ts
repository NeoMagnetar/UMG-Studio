import { projectGlyphMatrix } from './glyphMatrix';
import { CompileResult, HermesConfig } from './types';

export function exportHermesPacket(user_request: string, compiled: CompileResult, settings: HermesConfig) {
  const runtimeSpec = compiled.runtimeSpec as { gate_context?: unknown } | undefined;
  const gate_context = runtimeSpec && typeof runtimeSpec === 'object' ? runtimeSpec.gate_context : undefined;
  const glyph_matrix = projectGlyphMatrix({ runtimeSpec: compiled.runtimeSpec, irMatrix: compiled.irMatrix, trace: compiled.trace, viewMode: 'compact' });
  return {
    mode: 'generate',
    user_request,
    compiled_prompt: compiled.promptPreview,
    runtime_spec: compiled.runtimeSpec,
    active_blocks: compiled.irMatrix.filter((r) => r.nodeType === 'molt_block' && Boolean((r as any).active)).map((r) => r.nodeId),
    gate_context,
    glyph_matrix,
    trace: compiled.trace,
    settings: {
      endpoint: settings.endpoint,
      model: settings.model,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens
    }
  };
}

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
