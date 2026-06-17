import { compileSleeve as realCompileSleeve } from '/home/neomagnetar/umg-compiler/compiler-v0/dist/compile.js';
import { CompileResult, Diagnostic, IRMatrixRow, MOLTRole, Sleeve, UMGBlock, UMGWorkspace } from './types';

const required: MOLTRole[] = ['directive', 'instruction', 'subject', 'primary', 'blueprint'];

type CompilerLikeResult = Partial<CompileResult> & {
  runtimeSpec?: unknown;
  trace?: Array<Record<string, unknown>>;
  diagnostics?: Diagnostic[];
  promptPreview?: string;
  irMatrix?: IRMatrixRow[];
};

type CompilerSleeve = {
  id: string;
  name?: string;
  version?: string;
  blocks: Array<{ id: string; title?: string; moltType: MOLTRole; priorityOrder?: number; content: string; tags?: string[] }>;
  stacks: Array<{ id: string; name?: string; domainKey?: string; blockIds: string[] }>;
  triggers?: Array<{ id: string; name: string; description?: string }>;
};

type RealCompileSleeve = (sleeve: CompilerSleeve, triggerState: { activeTriggerIds: string[] }) => {
  runtime?: Record<string, unknown>;
  trace: { sleeveId: string; events: Array<Record<string, unknown>> };
  hasErrors: boolean;
};

export type RealCompilerAdapter = (sleeve: Sleeve, triggerState: { tags?: string[] }, workspace: UMGWorkspace) => CompilerLikeResult;

export type CompilerBridgeOptions = {
  compilerName?: string;
  externalCompiler?: RealCompilerAdapter;
  disableInstalledCompiler?: boolean;
};

function activeBlocks(ws: UMGWorkspace) {
  const sleeve = ws.sleeves.find((s) => s.id === ws.activeSleeveId) || ws.sleeves[0];
  const blocks: UMGBlock[] = [];
  sleeve?.stacks.forEach((s) => s.defaultState !== 'off' && s.neoblocks.forEach((nb) => nb.defaultState !== 'off' && nb.blocks.forEach((b) => {
    if (b.defaultState !== 'off') blocks.push(b);
  })));
  return { sleeve, blocks };
}

function workspaceBlocks(sleeve: Sleeve | undefined) {
  const blocks: UMGBlock[] = [];
  sleeve?.stacks.forEach((s) => {
    s.neoblocks.forEach((nb) => nb.blocks.forEach((b) => blocks.push(b)));
    (s.directBlocks ?? []).forEach((b) => blocks.push(b));
  });
  return blocks;
}

function blockOffIds(sleeve: Sleeve | undefined) {
  const off = new Set<string>();
  sleeve?.stacks.forEach((s) => {
    const stackOff = s.defaultState === 'off';
    s.neoblocks.forEach((nb) => {
      const neoBlockOff = stackOff || nb.defaultState === 'off';
      nb.blocks.forEach((b) => {
        if (neoBlockOff || b.defaultState === 'off') off.add(b.id);
      });
    });
    (s.directBlocks ?? []).forEach((b) => {
      if (stackOff || b.defaultState === 'off') off.add(b.id);
    });
  });
  return off;
}

function normalizeCompilerResult(result: CompilerLikeResult, fallback: CompileResult, compilerName: string): CompileResult {
  return {
    runtimeSpec: result.runtimeSpec ?? fallback.runtimeSpec,
    trace: result.trace ?? fallback.trace,
    diagnostics: result.diagnostics ?? [{ id: `diag_${compilerName}`, type: 'compiler', severity: 'info', message: `${compilerName} used` }],
    promptPreview: result.promptPreview ?? fallback.promptPreview,
    irMatrix: result.irMatrix ?? fallback.irMatrix
  };
}

function toCompilerSleeve(sleeve: Sleeve): CompilerSleeve {
  const blocks: CompilerSleeve['blocks'] = [];
  const stacks: CompilerSleeve['stacks'] = [];
  const seen = new Set<string>();

  for (const stack of sleeve.stacks) {
    if (stack.defaultState === 'off') continue;
    const blockIds: string[] = [];
    for (const nb of stack.neoblocks) {
      if (nb.defaultState === 'off') continue;
      for (const block of nb.blocks) {
        if (block.defaultState === 'off') continue;
        blockIds.push(block.id);
        if (seen.has(block.id)) continue;
        seen.add(block.id);
        blocks.push({
          id: block.id,
          title: block.title,
          moltType: block.role,
          priorityOrder: block.priorityOrder,
          content: block.content,
          tags: block.tags
        });
      }
    }
    for (const block of stack.directBlocks ?? []) {
      if (block.defaultState === 'off') continue;
      blockIds.push(block.id);
      if (seen.has(block.id)) continue;
      seen.add(block.id);
      blocks.push({
        id: block.id,
        title: block.title,
        moltType: block.role,
        priorityOrder: block.priorityOrder,
        content: block.content,
        tags: block.tags
      });
    }
    stacks.push({ id: stack.id, name: stack.title, domainKey: stack.role ?? 'general', blockIds });
  }

  return { id: sleeve.id, name: sleeve.title, version: sleeve.version, blocks, stacks, triggers: [] };
}

function promptFromRealRuntime(runtime: Record<string, unknown> | undefined, fallback: string) {
  const promptSpec = runtime?.promptSpec as { neoBlockPrompts?: Array<{ fullText?: string }> } | undefined;
  const prompt = promptSpec?.neoBlockPrompts?.map((p) => p.fullText).filter(Boolean).join('\n\n---\n\n');
  return prompt || fallback;
}

function diagnosticsFromRealTrace(events: Array<Record<string, unknown>>): Diagnostic[] {
  return events.map((evt, i) => {
    const relatedBlockIds = Array.isArray(evt.relatedBlockIds) ? evt.relatedBlockIds : [];
    const relatedStackIds = Array.isArray(evt.relatedStackIds) ? evt.relatedStackIds : [];
    const nodeId = relatedBlockIds[0] ?? relatedStackIds[0];
    return {
      id: String(evt.id ?? `real_evt_${i + 1}`),
      type: String(evt.code ?? evt.kind ?? 'compiler'),
      severity: evt.severity === 'error' || evt.severity === 'warning' ? evt.severity : 'info',
      message: String(evt.message ?? JSON.stringify(evt)),
      nodeId: nodeId ? String(nodeId) : undefined
    };
  });
}

function realTraceTriggeredIds(events: Array<Record<string, unknown>>) {
  const triggered = new Set<string>();
  for (const evt of events) {
    const text = `${evt.code ?? ''} ${evt.kind ?? ''} ${evt.message ?? ''}`.toLowerCase();
    if (evt.triggered !== true && evt.gatePassed !== true && !text.includes('trigger') && !text.includes('activate')) continue;
    const direct = evt.nodeId ?? evt.sourceId ?? evt.blockId ?? evt.stackId;
    if (direct) triggered.add(String(direct));
    for (const key of ['relatedBlockIds', 'relatedStackIds', 'relatedNodeIds']) {
      const value = evt[key];
      if (Array.isArray(value)) value.forEach((id) => triggered.add(String(id)));
    }
  }
  return triggered;
}

function irMatrixFromRealRuntime(runtime: Record<string, unknown> | undefined, blocks: UMGBlock[], diagnostics: Diagnostic[], events: Array<Record<string, unknown>> = [], offIds = new Set<string>()): IRMatrixRow[] {
  const runtimeAny = runtime as { blocksByMoltType?: Record<string, string[]>; stacks?: Array<{ orderedBlockIds?: string[] }> } | undefined;
  const activeIds = new Set<string>();
  const triggeredIds = realTraceTriggeredIds(events);
  Object.values(runtimeAny?.blocksByMoltType ?? {}).forEach((ids) => ids.forEach((id) => activeIds.add(id)));
  runtimeAny?.stacks?.forEach((stack) => stack.orderedBlockIds?.forEach((id) => activeIds.add(id)));
  if (activeIds.size === 0) blocks.forEach((b) => activeIds.add(b.id));

  return blocks.map((b, i) => {
    const diagnostic = diagnostics.find((d) => d.nodeId === b.id && d.severity !== 'info');
    const off = offIds.has(b.id) || !activeIds.has(b.id);
    return {
      rowId: `ir_${i + 1}`,
      nodeId: b.id,
      nodeType: 'molt_block',
      role: b.role,
      title: b.title,
      selected: true,
      active: !off && activeIds.has(b.id),
      off,
      triggered: !off && triggeredIds.has(b.id),
      required: required.includes(b.role),
      tagsMatched: [],
      priority: b.priorityOrder,
      contribution: b.content,
      warning: diagnostic?.message
    };
  });
}

function compileWithInstalledCompiler(workspace: UMGWorkspace, triggerState: { tags?: string[] }, fallback: CompileResult): CompileResult {
  const { sleeve } = activeBlocks(workspace);
  if (!sleeve) return fallback;
  const allBlocks = workspaceBlocks(sleeve);
  const offIds = blockOffIds(sleeve);
  const compileSleeve = realCompileSleeve as unknown as RealCompileSleeve;
  const realSleeve = toCompilerSleeve(sleeve);
  const realResult = compileSleeve(realSleeve, { activeTriggerIds: triggerState.tags ?? [] });
  const events = realResult.trace?.events ?? [];
  const diagnostics = diagnosticsFromRealTrace(events);
  const promptPreview = promptFromRealRuntime(realResult.runtime, fallback.promptPreview);
  const irMatrix = irMatrixFromRealRuntime(realResult.runtime, allBlocks, diagnostics, events, offIds);

  return {
    runtimeSpec: {
      compiler: 'umg-compiler',
      source: 'real',
      packagePath: '/home/neomagnetar/umg-compiler/compiler-v0',
      sleeveId: realResult.runtime?.sleeveId ?? realSleeve.id,
      hasErrors: realResult.hasErrors,
      runtime: realResult.runtime
    },
    trace: events,
    diagnostics,
    promptPreview,
    irMatrix
  };
}

function deterministicCompile(workspace: UMGWorkspace, triggerState: { tags?: string[] } = {}, fallbackDiagnostic?: Diagnostic): CompileResult {
  const { sleeve, blocks } = activeBlocks(workspace);
  const diagnostics: Diagnostic[] = [];
  if (fallbackDiagnostic) diagnostics.push(fallbackDiagnostic);
  if (!sleeve) diagnostics.push({ id: 'diag_no_sleeve', type: 'Invalid JSON', severity: 'error', message: 'No active sleeve found' });
  for (const r of required) {
    if (!blocks.some((b) => b.role === r)) diagnostics.push({ id: `diag_missing_${r}`, type: 'Missing role', severity: 'error', message: `No ${r} block found` });
  }

  const seen = new Set<string>();
  blocks.forEach((b) => {
    const k = `${b.role}_${b.priorityOrder}`;
    if (seen.has(k) && b.role === 'blueprint') diagnostics.push({ id: `diag_dup_${b.id}`, type: 'Duplicate role', severity: 'warning', message: `Multiple Blueprint blocks with priority ${b.priorityOrder}`, nodeId: b.id });
    seen.add(k);
    (b.dependencies ?? []).forEach((dep) => {
      if (!blocks.some((x) => x.id === dep)) diagnostics.push({ id: `diag_dep_${b.id}_${dep}`, type: 'Dependency missing', severity: 'warning', message: `${b.title} requires missing block ${dep}`, nodeId: b.id });
    });
  });

  const sorted = [...blocks].sort((a, b) => (a.priorityOrder ?? 0) - (b.priorityOrder ?? 0));
  const trace = sorted.map((b, i) => ({ step: i + 1, nodeId: b.id, role: b.role, title: b.title, active: true, tagsMatched: b.tags.filter((t) => triggerState.tags?.includes(t)), contribution: b.content.slice(0, 160) }));
  const promptPreview = sorted.map((b) => `## ${b.title} [${b.role}]\n${b.content}`).join('\n\n');
  const irMatrix: IRMatrixRow[] = sorted.map((b, i) => ({ rowId: `ir_${i + 1}`, nodeId: b.id, nodeType: 'molt_block', role: b.role, title: b.title, selected: true, active: true, off: false, triggered: b.activation?.mode === 'tag_match' && (b.activation.tags ?? []).some((t) => triggerState.tags?.includes(t)), gatePassed: b.activation?.mode === 'gate' ? true : undefined, required: required.includes(b.role), tagsMatched: b.tags.filter((t) => triggerState.tags?.includes(t)), relevanceScore: undefined, priority: b.priorityOrder, contribution: b.content, warning: diagnostics.find((d) => d.nodeId === b.id)?.message }));
  const runtimeSpec = { mode: 'compile-only', compiler: 'deterministic-fallback', sleeveId: sleeve?.id, sleeveTitle: sleeve?.title, version: sleeve?.version, activeBlocks: sorted.map((b) => ({ id: b.id, title: b.title, role: b.role, priority: b.priorityOrder, tags: b.tags })), compileStrategy: 'role_then_priority', generatedAt: new Date().toISOString(), diagnostics: diagnostics.length };
  return { runtimeSpec, trace, diagnostics, promptPreview, irMatrix };
}

export function compileWorkspaceToRuntime(workspace: UMGWorkspace, triggerState: { tags?: string[] } = {}, options: CompilerBridgeOptions = {}): CompileResult {
  const fallback = deterministicCompile(workspace, triggerState);
  const { sleeve } = activeBlocks(workspace);

  if (options.externalCompiler && sleeve) {
    const compilerName = options.compilerName ?? 'real-umg-compiler';
    try {
      const realResult = options.externalCompiler(sleeve, triggerState, workspace);
      return normalizeCompilerResult(realResult, fallback, compilerName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return deterministicCompile(workspace, triggerState, {
        id: `diag_${compilerName}_fallback`,
        type: 'Compiler fallback',
        severity: 'warning',
        message: `${compilerName} unavailable; used deterministic fallback: ${message}`
      });
    }
  }

  if (options.disableInstalledCompiler) return fallback;

  try {
    return compileWithInstalledCompiler(workspace, triggerState, fallback);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return deterministicCompile(workspace, triggerState, {
      id: 'diag_umg_compiler_fallback',
      type: 'Compiler fallback',
      severity: 'warning',
      message: `umg-compiler unavailable; used deterministic fallback: ${message}`
    });
  }
}
