import { MOLTRole, Sleeve, UMGBlock } from './types';

const roles: MOLTRole[] = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];
const unsupportedRoleNames = ['aim', 'use', 'need'];
export const rolePriority: Record<MOLTRole, number> = { trigger: 0, directive: 10, instruction: 20, subject: 30, primary: 40, philosophy: 50, blueprint: 60 };

export type SourceLane = 'AI' | 'sleeves' | 'HUMAN' | 'blocks' | 'other';
export type SourceAsset = { lane: SourceLane; sourcePath: string; data: unknown };
export type MigrationReport = {
  sourceRepo: 'UMG-Block-Library';
  importedBlocks: number;
  importedSleeves: number;
  skippedHumanReferences: number;
  unsupportedRoles: string[];
  warnings: string[];
};
export type NormalizedSourceCatalog = { blocks: UMGBlock[]; sleeves: Sleeve[]; report: MigrationReport };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'block';
const asRecord = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asTags = (value: unknown): string[] => Array.isArray(value) ? value.map(String).filter(Boolean) : String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const titleFromPath = (sourcePath?: string) => (sourcePath?.split('/').pop() ?? 'Imported Asset').replace(/\.json$/i, '').replace(/[-_]+/g, ' ');

export function detectRole(value: unknown): MOLTRole | undefined {
  const text = String(value ?? '').toLowerCase();
  return roles.find((role) => text === role || text.includes(role));
}

export function detectUnsupportedRole(value: unknown): string | undefined {
  const text = String(value ?? '').toLowerCase();
  return unsupportedRoleNames.find((role) => text === role || text.includes(`/${role}/`) || text.includes(`.${role}.`) || text.includes(` ${role} `) || text.includes(`${role} blocks`) || text.includes(`molt ${role}`));
}

export function normalizeRole(value: unknown): MOLTRole {
  return detectRole(value) ?? 'instruction';
}

function extractBlockCandidates(data: unknown): Record<string, any>[] {
  const raw = asRecord(data);
  if (Array.isArray(data)) return data.map(asRecord).filter((item) => Object.keys(item).length > 0);
  for (const key of ['blocks', 'molt_blocks', 'MOLT', 'items', 'rules']) {
    const values = asArray(raw[key]).map(asRecord).filter((item) => Object.keys(item).length > 0);
    if (values.length > 0) return values;
  }
  return Object.keys(raw).length > 0 ? [raw] : [];
}

function likelyRunnableBlock(raw: Record<string, any>): boolean {
  return Boolean(
    raw.role ?? raw.moltType ?? raw.molt_role ?? raw.moltRole ?? raw.block_role ??
    raw.content ?? raw.prompt ?? raw.body ?? raw.description ?? raw.rule_name ?? raw.rule_id
  );
}

export function normalizeImportedBlocks(input: unknown[], sourcePath?: string, sourceRepo = 'UMG-Block-Library'): UMGBlock[] {
  return input.map((rawValue: any, i) => {
    const raw = asRecord(rawValue);
    const roleInput = raw.role ?? raw.moltType ?? raw.molt_role ?? raw.moltRole ?? raw.block_role ?? raw.type;
    const role = normalizeRole(roleInput);
    const title = String(raw.title ?? raw.name ?? raw.label ?? raw.rule_name ?? raw.id ?? raw.rule_id ?? `${role} block ${i + 1}`);
    const tags = asTags(raw.tags ?? raw.keywords ?? raw.categories);
    const warnings: string[] = [];
    if (!detectRole(roleInput)) warnings.push('role inferred');
    if (!raw.tags) warnings.push('tags defaulted');
    if (detectUnsupportedRole(roleInput)) warnings.push(`unsupported role preserved: ${detectUnsupportedRole(roleInput)}`);
    return {
      id: String(raw.id ?? raw.block_id ?? raw.rule_id ?? `blk_${slug(title)}_${i + 1}`),
      title,
      type: 'molt_block',
      role,
      content: String(raw.content ?? raw.prompt ?? raw.body ?? raw.description ?? raw.rule_name ?? ''),
      description: raw.description ? String(raw.description) : undefined,
      category: String(raw.category ?? raw.governance_layer ?? raw.type ?? 'uncategorized'),
      tags,
      priorityOrder: Number(raw.priorityOrder ?? raw.priority ?? rolePriority[role]),
      defaultState: (String(raw.defaultState ?? raw.state ?? 'on').toLowerCase() === 'off' ? 'off' : 'on'),
      visibility: (['collapsed', 'audit_only'].includes(String(raw.visibility)) ? raw.visibility : 'visible') as UMGBlock['visibility'],
      activation: raw.activation ?? { mode: 'always' },
      dependencies: Array.isArray(raw.dependencies) ? raw.dependencies.map(String) : [],
      conflicts: Array.isArray(raw.conflicts) ? raw.conflicts.map(String) : [],
      compatibleSleeves: Array.isArray(raw.compatibleSleeves) ? raw.compatibleSleeves.map(String) : [],
      compatibleStacks: Array.isArray(raw.compatibleStacks) ? raw.compatibleStacks.map(String) : [],
      source: { origin: 'library', sourceId: String(raw.id ?? raw.block_id ?? raw.rule_id ?? '') || undefined, version: String(raw.version ?? '0.1') },
      legacy: { sourceRepo, original: rawValue, sourcePath, migrationWarnings: warnings }
    };
  });
}

function normalizeSleeveAsset(data: unknown, sourcePath: string): Sleeve {
  const raw = asRecord(data);
  const id = String(raw.id ?? raw.sleeve_id ?? raw.catalog_id ?? `slv_${slug(titleFromPath(sourcePath))}`);
  const blockRefs = asArray(raw.block_refs ?? raw.blocks).map(asRecord);
  const directBlocks = blockRefs.map((ref, index) => normalizeImportedBlocks([{ id: ref.block_id ?? ref.id ?? `ref_${index}`, title: ref.block_id ?? ref.id ?? `Referenced Block ${index + 1}`, role: ref.role ?? 'instruction', content: ref.content ?? `Referenced upstream block ${ref.block_id ?? ref.id ?? index + 1}`, tags: ref.tags ?? [], defaultState: ref.enabled === false ? 'off' : 'on' }], sourcePath)[0]);
  return {
    id,
    title: String(raw.title ?? raw.name ?? titleFromPath(sourcePath)),
    type: 'sleeve',
    version: String(raw.version ?? '0.1'),
    description: raw.description ? String(raw.description) : undefined,
    tags: asTags(raw.tags ?? raw.context ?? raw.values),
    stacks: [{
      id: `${id}_stack`,
      title: 'Imported Sleeve Stack',
      type: 'neostack',
      tags: asTags(raw.tags),
      neoblocks: [{ id: `${id}_neoblock`, title: 'Imported Sleeve Blocks', type: 'neoblock', tags: [], blocks: directBlocks, defaultState: 'on' }],
      defaultState: 'on',
      compileStrategy: 'role_then_priority'
    }],
    runtimeConfig: { active: true, depth: 'balanced', hermesEnabled: false, runtimeAdaptation: false, showRuntimeTrace: true },
    metadata: { author: 'UMG-Block-Library' }
  };
}

export function normalizeSourceCatalog(assets: SourceAsset[]): NormalizedSourceCatalog {
  const warnings: string[] = [];
  const unsupported = new Set<string>();
  const blocks: UMGBlock[] = [];
  const sleeves: Sleeve[] = [];
  let skippedHumanReferences = 0;

  for (const asset of assets) {
    if (asset.lane === 'HUMAN') {
      skippedHumanReferences += 1;
      continue;
    }
    if (asset.lane === 'sleeves') {
      try {
        sleeves.push(normalizeSleeveAsset(asset.data, asset.sourcePath));
      } catch (error) {
        warnings.push(`${asset.sourcePath}: sleeve import failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      continue;
    }
    if (asset.lane !== 'AI') continue;

    const candidates = extractBlockCandidates(asset.data);
    for (const candidate of candidates) {
      const roleInput = candidate.role ?? candidate.moltType ?? candidate.molt_role ?? candidate.moltRole ?? candidate.block_role ?? candidate.type;
      const unsupportedRole = detectUnsupportedRole(roleInput) ?? detectUnsupportedRole(asset.sourcePath) ?? detectUnsupportedRole(candidate.title ?? candidate.name ?? candidate.description);
      if (unsupportedRole) {
        unsupported.add(unsupportedRole);
        warnings.push(`${asset.sourcePath}: unsupported role ${unsupportedRole} preserved in legacy only`);
        continue;
      }
      if (!likelyRunnableBlock(candidate)) {
        warnings.push(`${asset.sourcePath}: no runnable block fields detected`);
        continue;
      }
      blocks.push(normalizeImportedBlocks([candidate], asset.sourcePath)[0]);
    }
  }

  return {
    blocks,
    sleeves,
    report: {
      sourceRepo: 'UMG-Block-Library',
      importedBlocks: blocks.length,
      importedSleeves: sleeves.length,
      skippedHumanReferences,
      unsupportedRoles: [...unsupported].sort(),
      warnings
    }
  };
}
