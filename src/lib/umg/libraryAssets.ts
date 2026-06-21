import { buildGraphFromSleeve } from './graphBuilder';
import { classifyLibraryDisplay, detectUnsupportedRole, SourceAsset } from './migrateLibrary';
import { GraphFocusMode, MOLTDisplayType, NeoBlock, NeoStack, Sleeve, TriggerGateSourceCard, UMGBlock, UMGWorkspace } from './types';

type ShelfKind = 'molt_block' | 'neoblock' | 'neostack' | 'sleeve' | 'source_asset' | 'trigger_gate_source';
export type AssetShelfId = 'molt_blocks' | 'neoblocks' | 'neostacks' | 'sleeves' | 'source_audit' | 'control_sources';
export type SourceAssetOutcome = 'runnable_molt' | 'meta' | 'neoblock' | 'neostack' | 'sleeve' | 'skipped' | 'duplicate' | 'unsupported' | 'reference_only' | 'warning';
export type SourceAuditItem = {
  id: string;
  title: string;
  detectedType: string;
  normalizedRole?: string;
  outcome: SourceAssetOutcome;
  tags: string[];
  sourcePath: string;
  reason?: string;
  legacySource?: unknown;
};
export type SourceAuditSummary = { totalScanned: number; accountedTotal: number; unaccountedCount: number; outcomeCounts: Record<SourceAssetOutcome, number>; reasonSummary: Record<string, number> };
export type SourceAssetAudit = { items: SourceAuditItem[]; summary: SourceAuditSummary };
export type ShelfAsset = {
  id: string;
  kind: ShelfKind;
  title: string;
  tags: string[];
  sourcePath?: string;
  status?: string;
  displayType?: MOLTDisplayType;
  containedRoles: string[];
  containedTitles: string[];
  displayRole?: string;
  displayFamily?: string;
  cardSurface?: 'trigger_gate_source' | 'molt_block' | 'neoblock' | 'neostack' | 'sleeve' | 'source';
  asset: UMGBlock | NeoBlock | NeoStack | Sleeve | SourceAuditItem | TriggerGateSourceCard;
};
export type AssetShelf = { id: AssetShelfId; label: string; items: ShelfAsset[] };
export type InsertContext = { mode: GraphFocusMode; selectedStackId?: string; selectedNeoBlockId?: string };

export const triggerGateCategoryDisplayCopy = {
  controlSourcesLabel: 'Control Sources: TriggerGate Sources',
  triggerGateSourcesLabel: 'TriggerGate Sources',
  actualTriggers: 'Actual triggers are available as TriggerGate Sources. They are browseable and attachable as gate/control geometry, not MOLT prompt-content blocks.',
  triggerZeroCrossReference: 'No canonical MOLT Trigger prompt blocks exist. Use TriggerGate Sources (200) under Control Sources for actual TRG.* trigger/gate records.',
  sourceRecordNote: 'TriggerGate Sources are the actual TRG.* trigger/gate source records.',
  promptTriggerCountLabel: 'MOLT prompt triggers',
  promptTriggerCountValue: 0,
  triggerSourceCardsCountLabel: 'TriggerGate source cards',
  triggerCardsRoleHint: 'Trigger cards are TriggerGate source/control records. They are attachable as gate geometry, not prompt-content blocks.',
  visiblePrompt: 'Trigger'
};

const stamp = () => Date.now().toString(36);
const clone = <T>(value: T): T => structuredClone(value);

function cloneBlockForWorkspace(block: UMGBlock): UMGBlock {
  const classification = classifyLibraryDisplay(block);
  return {
    ...clone(block),
    id: `${block.id}_copy_${stamp()}`,
    displayType: classification.displayType,
    presentationStatus: classification.status,
    defaultState: classification.displayType === 'meta' ? 'off' : block.defaultState,
    visibility: classification.displayType === 'meta' ? 'audit_only' : block.visibility,
    source: { origin: 'workspace', sourceId: block.id, version: '0.1' }
  };
}

function cloneNeoBlockForWorkspace(neoblock: NeoBlock): NeoBlock {
  return {
    ...clone(neoblock),
    id: `${neoblock.id}_copy_${stamp()}`,
    blocks: neoblock.blocks.map(cloneBlockForWorkspace),
    defaultState: neoblock.defaultState ?? 'on'
  };
}

function cloneNeoStackForWorkspace(neostack: NeoStack): NeoStack {
  return {
    ...clone(neostack),
    id: `${neostack.id}_copy_${stamp()}`,
    neoblocks: neostack.neoblocks.map(cloneNeoBlockForWorkspace),
    directBlocks: neostack.directBlocks?.map(cloneBlockForWorkspace),
    defaultState: neostack.defaultState ?? 'on'
  };
}

function cloneSleeveForWorkspace(sleeve: Sleeve, titlePrefix?: string): Sleeve {
  return {
    ...clone(sleeve),
    id: `${sleeve.id}_copy_${stamp()}`,
    title: titlePrefix ? `${titlePrefix} ${sleeve.title}` : sleeve.title,
    stacks: sleeve.stacks.map(cloneNeoStackForWorkspace),
    runtimeConfig: { ...sleeve.runtimeConfig }
  };
}

function rebuild(ws: UMGWorkspace): UMGWorkspace {
  const active = ws.sleeves.find((sleeve) => sleeve.id === ws.activeSleeveId) ?? ws.sleeves[0];
  return { ...ws, activeSleeveId: active?.id, graph: active ? buildGraphFromSleeve(active) : ws.graph };
}

function activeSleeve(ws: UMGWorkspace): Sleeve {
  return ws.sleeves.find((sleeve) => sleeve.id === ws.activeSleeveId) ?? ws.sleeves[0];
}

function ensureDefaultStack(sleeve: Sleeve, stackId?: string): NeoStack {
  const existing = stackId ? sleeve.stacks.find((stack) => stack.id === stackId) : sleeve.stacks[0];
  if (existing) return existing;
  const stack: NeoStack = { id: `stk_draft_${stamp()}`, title: 'Draft NeoStack', type: 'neostack', tags: ['draft'], neoblocks: [], defaultState: 'on', compileStrategy: 'role_then_priority' };
  sleeve.stacks.push(stack);
  return stack;
}

function ensureDefaultNeoBlock(stack: NeoStack, neoblockId?: string): NeoBlock {
  const existing = neoblockId ? stack.neoblocks.find((neoblock) => neoblock.id === neoblockId) : stack.neoblocks[0];
  if (existing) return existing;
  const neoblock: NeoBlock = { id: `nb_draft_${stamp()}`, title: 'Draft NeoBlock', type: 'neoblock', tags: ['draft'], blocks: [], defaultState: 'on' };
  stack.neoblocks.push(neoblock);
  return neoblock;
}

export function insertMoltBlockIntoWorkspace(workspace: UMGWorkspace, block: UMGBlock, context: InsertContext): UMGWorkspace {
  const ws = clone(workspace);
  const sleeve = activeSleeve(ws);
  const stack = ensureDefaultStack(sleeve, context.selectedStackId);
  const neoblock = ensureDefaultNeoBlock(stack, context.selectedNeoBlockId);
  neoblock.blocks.push(cloneBlockForWorkspace(block));
  return rebuild(ws);
}

export function insertNeoBlockIntoWorkspace(workspace: UMGWorkspace, neoblock: NeoBlock, context: InsertContext): UMGWorkspace {
  const ws = clone(workspace);
  const sleeve = activeSleeve(ws);
  const stack = ensureDefaultStack(sleeve, context.selectedStackId);
  stack.neoblocks.push(cloneNeoBlockForWorkspace(neoblock));
  return rebuild(ws);
}

export function insertNeoStackIntoWorkspace(workspace: UMGWorkspace, neostack: NeoStack, _context: InsertContext): UMGWorkspace {
  const ws = clone(workspace);
  activeSleeve(ws).stacks.push(cloneNeoStackForWorkspace(neostack));
  return rebuild(ws);
}

export function openSleeveAsWorkspace(sleeve: Sleeve): UMGWorkspace {
  const opened = cloneSleeveForWorkspace(sleeve, 'Opened');
  return { id: `ws_${opened.id}`, title: opened.title, activeSleeveId: opened.id, sleeves: [opened], libraryRefs: [], graph: buildGraphFromSleeve(opened) };
}

export function duplicateSleeveIntoWorkspace(workspace: UMGWorkspace, sleeve: Sleeve): UMGWorkspace {
  const ws = clone(workspace);
  const duplicated = cloneSleeveForWorkspace(sleeve, 'Duplicate');
  ws.sleeves.push(duplicated);
  return rebuild(ws);
}

function blockAsset(block: UMGBlock): ShelfAsset {
  const classification = classifyLibraryDisplay(block);
  return { id: block.id, kind: 'molt_block', title: block.title, tags: block.tags, sourcePath: block.legacy?.sourcePath, status: classification.status, displayType: classification.displayType, containedRoles: [block.role], containedTitles: [block.title], asset: block };
}
function neoblockAsset(neoblock: NeoBlock): ShelfAsset {
  return { id: neoblock.id, kind: 'neoblock', title: neoblock.title, tags: neoblock.tags, sourcePath: (neoblock as any).legacy?.sourcePath, containedRoles: neoblock.blocks.map((block) => block.role), containedTitles: neoblock.blocks.map((block) => block.title), asset: neoblock };
}
function neostackAsset(neostack: NeoStack): ShelfAsset {
  const neoblocks = neostack.neoblocks ?? [];
  const childTags = neoblocks.flatMap((nb) => [...nb.tags, ...nb.blocks.flatMap((block) => block.tags)]);
  return { id: neostack.id, kind: 'neostack', title: neostack.title, tags: [...neostack.tags, ...childTags], sourcePath: (neostack as any).legacy?.sourcePath, containedRoles: neoblocks.flatMap((nb) => nb.blocks.map((block) => block.role)), containedTitles: neoblocks.flatMap((nb) => [nb.title, ...nb.blocks.map((block) => block.title)]), asset: neostack };
}
function sleeveAsset(sleeve: Sleeve): ShelfAsset {
  const stacks = sleeve.stacks ?? [];
  const childTags = stacks.flatMap((stack) => [...stack.tags, ...stack.neoblocks.flatMap((nb) => [...nb.tags, ...nb.blocks.flatMap((block) => block.tags)])]);
  return { id: sleeve.id, kind: 'sleeve', title: sleeve.title, tags: [...sleeve.tags, ...childTags], sourcePath: (sleeve as any).legacy?.sourcePath, containedRoles: stacks.flatMap((stack) => stack.neoblocks.flatMap((nb) => nb.blocks.map((block) => block.role))), containedTitles: stacks.flatMap((stack) => [stack.title, ...stack.neoblocks.flatMap((nb) => [nb.title, ...nb.blocks.map((block) => block.title)])]), asset: sleeve };
}

const emptyOutcomeCounts = (): Record<SourceAssetOutcome, number> => ({ runnable_molt: 0, meta: 0, neoblock: 0, neostack: 0, sleeve: 0, skipped: 0, duplicate: 0, unsupported: 0, reference_only: 0, warning: 0 });
const titleFromPath = (sourcePath: string) => (sourcePath.split('/').pop() ?? sourcePath).replace(/\.json$/i, '').replace(/[-_]+/g, ' ');
const sourcePathOf = (asset: any) => asset?.legacy?.sourcePath ?? asset?.sourcePath;
const firstBySourcePath = <T,>(items: T[]) => new Map(items.map((item: any) => [sourcePathOf(item), item]).filter(([sourcePath]) => Boolean(sourcePath)) as [string, T][]);
const reasonEntries = (items: unknown[] | undefined) => (Array.isArray(items) ? items : []).map((item: any) => ({ sourcePath: String(item.sourcePath ?? ''), reason: String(item.reason ?? item.warning ?? 'recorded by migration report') })).filter((item) => item.sourcePath);

export function buildSourceAssetAudit(input: { sourceAssets: SourceAsset[]; blocks: UMGBlock[]; neoblocks: NeoBlock[]; neostacks: NeoStack[]; sleeves: Sleeve[]; report?: any }): SourceAssetAudit {
  const blockBySource = firstBySourcePath(input.blocks);
  const neoblockBySource = firstBySourcePath(input.neoblocks as any[]);
  const neostackBySource = firstBySourcePath(input.neostacks as any[]);
  const sleeveBySource = firstBySourcePath(input.sleeves as any[]);
  const skipped = new Map(reasonEntries(input.report?.skippedAssets).map((item) => [item.sourcePath, item.reason]));
  const duplicates = new Map(reasonEntries(input.report?.duplicateAssets).map((item) => [item.sourcePath, item.reason]));
  const counts = emptyOutcomeCounts();
  const reasonSummary: Record<string, number> = {};

  const items = input.sourceAssets.map((source, index) => {
    const sourcePath = source.sourcePath;
    const duplicateReason = duplicates.get(sourcePath);
    const skippedReason = skipped.get(sourcePath);
    let title = titleFromPath(sourcePath);
    let detectedType: string = source.lane;
    let normalizedRole: string | undefined;
    let tags: string[] = [];
    let reason = duplicateReason ?? skippedReason;
    let outcome: SourceAssetOutcome = duplicateReason ? 'duplicate' : skippedReason ? 'skipped' : 'skipped';
    if (!duplicateReason && skippedReason && /unsupported role/i.test(skippedReason)) outcome = 'unsupported';
    if (!duplicateReason && skippedReason && /no runnable block fields detected/i.test(skippedReason)) outcome = 'meta';
    const block = blockBySource.get(sourcePath);
    const neoblock = neoblockBySource.get(sourcePath) as any;
    const neostack = neostackBySource.get(sourcePath) as any;
    const sleeve = sleeveBySource.get(sourcePath) as any;

    if (!duplicateReason && block) {
      const classification = classifyLibraryDisplay(block);
      title = block.title;
      detectedType = 'molt_block';
      normalizedRole = block.role;
      tags = block.tags;
      const unsupported = detectUnsupportedRole(block.legacy?.sourcePath) ?? block.legacy?.migrationWarnings?.map(detectUnsupportedRole).find(Boolean) ?? block.legacy?.migrationWarnings?.map((warning) => /unsupported role preserved: ([a-z0-9_-]+)/i.exec(warning)?.[1]).find(Boolean);
      if (unsupported || classification.status === 'unsupported') { outcome = 'unsupported'; reason = `unsupported role preserved: ${unsupported ?? block.role}`; }
      else if (classification.status === 'reference-only' || !block.content.trim() || /(^|\/)(schemas?|manifests?|catalog)(\/|\.|$)/i.test(block.legacy?.sourcePath ?? '')) { outcome = 'reference_only'; reason = 'reference-only / non-runtime source'; }
      else if (classification.status === 'warning-bearing') { outcome = 'warning'; reason = block.legacy?.migrationWarnings?.join('; ') || 'missing-field/warning asset'; }
      else if (classification.displayType === 'meta' || classification.status === 'meta') { outcome = 'meta'; reason = block.legacy?.migrationWarnings?.join('; ') || 'Meta / non-compiler asset'; }
      else outcome = 'runnable_molt';
    } else if (!duplicateReason && neoblock) {
      title = neoblock.title; detectedType = 'neoblock'; tags = neoblock.tags ?? []; outcome = 'neoblock';
    } else if (!duplicateReason && neostack) {
      title = neostack.title; detectedType = 'neostack'; tags = neostack.tags ?? []; outcome = 'neostack';
    } else if (!duplicateReason && sleeve) {
      title = sleeve.title; detectedType = 'sleeve'; tags = sleeve.tags ?? []; outcome = 'sleeve';
    } else if (!duplicateReason && source.lane === 'sleeves' && !skippedReason) {
      detectedType = 'sleeve'; outcome = 'sleeve';
    } else if (!duplicateReason && !skippedReason) {
      outcome = 'meta'; reason = 'no runnable block fields detected';
    }
    counts[outcome] += 1;
    if (reason) reasonSummary[reason] = (reasonSummary[reason] ?? 0) + 1;
    return { id: `src_${index}_${sourcePath.replace(/[^a-z0-9]+/gi, '_')}`, title, detectedType, normalizedRole, outcome, tags, sourcePath, reason, legacySource: source.data };
  });
  const accountedTotal = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { items, summary: { totalScanned: input.sourceAssets.length, accountedTotal, unaccountedCount: input.sourceAssets.length - accountedTotal, outcomeCounts: counts, reasonSummary } };
}

function sourceAuditAsset(item: SourceAuditItem): ShelfAsset {
  return { id: item.id, kind: 'source_asset', title: item.title, tags: item.tags, sourcePath: item.sourcePath, status: item.outcome, displayType: item.outcome === 'runnable_molt' ? undefined : 'meta', containedRoles: [item.normalizedRole, item.detectedType, item.outcome].filter(Boolean) as string[], containedTitles: [item.reason ?? '', item.sourcePath], asset: item };
}

function triggerGateSourceAsset(card: TriggerGateSourceCard): ShelfAsset {
  return {
    id: card.id,
    kind: 'trigger_gate_source',
    title: card.title,
    tags: card.tags,
    sourcePath: card.sourcePath,
    status: card.status,
    displayType: undefined,
    displayRole: 'trigger',
    displayFamily: 'Trigger',
    cardSurface: 'trigger_gate_source',
    containedRoles: ['trigger_gate_source', card.gateKind, 'source_control', 'trigger'],
    containedTitles: [card.summary, card.activation.conditionSummary],
    asset: card
  };
}

export function buildAssetShelves(input: { blocks: UMGBlock[]; neoblocks: NeoBlock[]; neostacks: NeoStack[]; sleeves: Sleeve[]; sourceAuditItems?: SourceAuditItem[]; gateSourceCards?: TriggerGateSourceCard[] }): AssetShelf[] {
  return [
    { id: 'molt_blocks', label: 'MOLT Blocks', items: input.blocks.map(blockAsset) },
    { id: 'neoblocks', label: 'NeoBlocks', items: input.neoblocks.map(neoblockAsset) },
    { id: 'neostacks', label: 'NeoStacks', items: input.neostacks.map(neostackAsset) },
    { id: 'sleeves', label: 'Sleeves', items: input.sleeves.map(sleeveAsset) },
    { id: 'control_sources', label: triggerGateCategoryDisplayCopy.controlSourcesLabel, items: (input.gateSourceCards ?? []).map(triggerGateSourceAsset) },
    { id: 'source_audit', label: 'Source Assets / Audit — audit only', items: (input.sourceAuditItems ?? []).map(sourceAuditAsset) }
  ];
}

export function searchShelfAssets(items: ShelfAsset[], filters: { query?: string; tags?: string[] }): ShelfAsset[] {
  const query = (filters.query ?? '').toLowerCase().trim();
  const tags = (filters.tags ?? []).map((tag) => tag.toLowerCase());
  return items.filter((item) => {
    const haystack = [item.title, item.kind, item.status, item.displayType, item.sourcePath, ...item.tags, ...item.containedRoles, ...item.containedTitles].filter(Boolean).join(' ').toLowerCase();
    const queryTokens = query.split(/\s+/).filter(Boolean);
    return (!query || haystack.includes(query) || queryTokens.every((token) => haystack.includes(token))) && tags.every((tag) => haystack.includes(tag));
  });
}
