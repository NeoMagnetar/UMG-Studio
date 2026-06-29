import type { UMGCompilerInput, UMGCompilerWarning } from './compilerIntegrationTypes';

type CompilerMoltType = 'trigger' | 'directive' | 'instruction' | 'subject' | 'primary' | 'philosophy' | 'blueprint';
const compilerMoltTypes: CompilerMoltType[] = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];

type NormalizedStructureLike = {
  id?: string;
  title?: string;
  version?: string;
  neoStacks?: Array<{ id: string; title?: string; description?: string; tags?: string[]; neoBlockIds?: string[] }>;
  neoBlocks?: Array<{ id: string; title?: string; description?: string; neoStackId?: string; moltBlockIds?: string[]; gateIds?: string[]; tags?: string[]; defaultState?: string }>;
  moltBlocks?: Array<{ id: string; sourceId?: string; title?: string; role?: string; content?: string; tags?: string[]; parentNeoBlockId?: string; parentNeoStackId?: string; defaultState?: string }>;
  gates?: unknown[];
  metadata?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asStructure(value: unknown): NormalizedStructureLike {
  return isRecord(value) ? value as NormalizedStructureLike : {};
}

function asMoltType(role: string | undefined): CompilerMoltType | undefined {
  if (!role || role === 'meta' || role === 'trigger') return undefined;
  return compilerMoltTypes.includes(role as CompilerMoltType) ? role as CompilerMoltType : undefined;
}

export function buildCompilerSleeveInput(input: UMGCompilerInput): { sleeve: unknown; triggerState: { activeTriggerIds: string[] }; warnings: UMGCompilerWarning[] } {
  const normalized = asStructure(input.normalizedStructure);
  const warnings: UMGCompilerWarning[] = [];
  const neoBlocks = normalized.neoBlocks ?? [];
  const neoStacks = normalized.neoStacks ?? [];
  const moltBlocks = normalized.moltBlocks ?? [];
  const blockIdsByNeoBlock = new Map(neoBlocks.map((block) => [block.id, block.moltBlockIds ?? []]));
  const stackBlocks = new Map<string, string[]>();

  const compilerBlocks = moltBlocks.flatMap((block) => {
    const moltType = asMoltType(block.role);
    if (!moltType) {
      warnings.push({
        code: block.role === 'trigger' ? 'COMPILER_GATE_SCHEMA_PARTIAL_SUPPORT' : 'COMPILER_MOLT_ROLE_SKIPPED',
        message: block.role === 'trigger'
          ? 'Trigger records are not emitted as compiler MOLT prompt blocks; they remain gate/control metadata.'
          : `MOLT role ${block.role ?? 'unknown'} is not supported by compiler-v0 and was omitted from sleeve.blocks.`,
        details: block.id
      });
      return [];
    }
    return [{
      id: block.id,
      title: block.title,
      moltType,
      role: block.defaultState === 'off' || input.disabledStates[block.id] ? 'off' : undefined,
      content: block.content ?? '',
      tags: block.tags ?? []
    }];
  });
  const validBlockIds = new Set(compilerBlocks.map((block) => block.id));

  for (const stack of neoStacks) {
    const orderedBlockIds = (stack.neoBlockIds ?? [])
      .flatMap((neoBlockId) => blockIdsByNeoBlock.get(neoBlockId) ?? [])
      .filter((blockId) => validBlockIds.has(blockId));
    stackBlocks.set(stack.id, orderedBlockIds);
  }

  const compilerStacks = neoStacks.map((stack) => ({
    id: stack.id,
    name: stack.title,
    domainKey: (stack.tags ?? [])[0],
    blockIds: stackBlocks.get(stack.id) ?? []
  })).filter((stack) => stack.blockIds.length > 0);

  if ((normalized.gates?.length ?? 0) > 0 || input.gates.length > 0) {
    warnings.push({
      code: 'COMPILER_GATE_SCHEMA_PARTIAL_SUPPORT',
      message: 'compiler-v0 supports triggers/governance separately from prompt blocks; UMG gates are preserved in metadata and default closed unless compiler output says otherwise.',
      details: `${(normalized.gates?.length ?? 0) + input.gates.length} gate/control records preserved as metadata.`
    });
  }

  const sleeve = {
    id: input.sleeveId,
    name: input.sleeveTitle,
    version: normalized.version ?? 'phase6',
    blocks: compilerBlocks,
    stacks: compilerStacks,
    triggers: [],
    governance: [],
    metadata: {
      ...(normalized.metadata ?? {}),
      gates: normalized.gates ?? input.gates,
      neoblocks: neoBlocks,
      activeStates: input.activeStates,
      disabledStates: input.disabledStates,
      traceMetadata: input.traceMetadata,
      source: 'umg-studio-phase6-compiler-sleeve-input'
    }
  };

  if (compilerStacks.length === 0) {
    warnings.push({ code: 'COMPILER_STACKS_EMPTY', message: 'No compiler-v0 stacks with supported MOLT blocks were produced from the candidate.' });
  }
  if (compilerBlocks.length === 0) {
    warnings.push({ code: 'COMPILER_BLOCKS_EMPTY', message: 'No compiler-v0 supported MOLT prompt blocks were produced from the candidate.' });
  }

  return { sleeve, triggerState: { activeTriggerIds: [] }, warnings };
}
