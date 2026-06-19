import { BlockHierarchy, FullSourceRecord, GraphNode, IRMatrixRow, RuntimeBlock, SearchCard, UMGBlock } from './types';

export type BlockInspectorViews = {
  card: SearchCard;
  runtime: RuntimeBlock;
  nl: string;
  compilerJson: RuntimeBlock;
  legacySource: FullSourceRecord;
  trace?: Record<string, unknown>[];
  irRow?: IRMatrixRow;
};

export type BlockInspectorContext = {
  graphNode?: GraphNode;
  irRow?: IRMatrixRow;
  trace?: Record<string, unknown>[];
};

/**
 * SearchCard is the readable/search-facing projection of a MOLT block.
 * RuntimeBlock is the compiler-aligned JSON object and runtime-state carrier.
 * FullSourceRecord keeps normalized data beside legacy.original/source metadata.
 * NL and JSON must stay synchronized by deriving both from the same UMGBlock.
 * The IR Matrix is the post-compile source of truth for active/off/triggered state.
 * The Glyph Matrix/graph is a projection layer over workspace and IR state, not a second runtime truth.
 * ToolProposal, ActionGate, and ToolResult are prepared in types.ts for future live tool execution only.
 */
export function buildBlockInspectorViews(block: UMGBlock, context: BlockInspectorContext = {}): BlockInspectorViews {
  const hierarchy = blockHierarchy(block);
  const nl = blockNaturalLanguage(block, hierarchy);
  const runtimeState = {
    defaultState: block.defaultState,
    selected: context.irRow?.selected ?? context.graphNode?.state.selected ?? false,
    active: context.irRow?.active ?? context.graphNode?.state.active ?? block.defaultState !== 'off',
    off: context.irRow?.off ?? context.graphNode?.state.off ?? block.defaultState === 'off',
    triggered: context.irRow?.triggered ?? context.graphNode?.state.triggered ?? false
  };
  const card: SearchCard = {
    type: 'SearchCard',
    id: block.id,
    title: block.title,
    role: block.role,
    category: block.category,
    tags: block.tags,
    sourcePath: block.legacy?.sourcePath ?? block.sourcePath,
    status: block.presentationStatus ?? block.status,
    hierarchy,
    summary: block.description ?? block.content.slice(0, 160)
  };
  const runtime: RuntimeBlock = {
    type: 'RuntimeBlock',
    id: block.id,
    title: block.title,
    role: block.role,
    content: block.content,
    nl,
    action: block.action,
    expectedOutput: block.expectedOutput,
    tags: block.tags,
    hierarchy,
    compiler: { source: 'compiler_aligned_json', moltType: block.role },
    runtimeState
  };
  const legacySource: FullSourceRecord = {
    type: 'FullSourceRecord',
    sourcePath: block.legacy?.sourcePath ?? block.sourcePath,
    sourceLayer: block.sourceLayer,
    legacyOriginal: block.legacy?.original,
    normalized: block
  };
  return { card, runtime, nl, compilerJson: runtime, legacySource, trace: context.trace, irRow: context.irRow };
}

function blockHierarchy(block: UMGBlock): BlockHierarchy {
  if (block.hierarchy) return block.hierarchy;
  if (typeof block.priorityOrder === 'number') return { orderIndex: block.priorityOrder, orderSource: 'priorityOrder', priorityMeaning: 'hierarchy_order' };
  return { orderSource: 'default', priorityMeaning: 'hierarchy_order' };
}

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function blockNaturalLanguage(block: UMGBlock, hierarchy: BlockHierarchy) {
  const lines = [
    `${block.title}`,
    `role: ${label(block.role)}`,
    block.category ? `category: ${block.category}` : undefined,
    block.legacy?.libraryEntryId ? `id: ${block.legacy.libraryEntryId}` : undefined,
    `tags: ${block.tags.join(', ') || 'none'}`,
    `sourcePath: ${block.legacy?.sourcePath ?? block.sourcePath ?? 'local asset'}`,
    `hierarchy order: ${hierarchy.orderIndex ?? 'default'} (${hierarchy.priorityMeaning})`,
    block.description ? `description: ${block.description}` : undefined,
    block.action ? `action: ${block.action}` : undefined,
    block.expectedOutput ? `expected output: ${block.expectedOutput}` : undefined,
    block.content ? `content: ${block.content}` : undefined
  ];
  return lines.filter(Boolean).join('\n');
}
