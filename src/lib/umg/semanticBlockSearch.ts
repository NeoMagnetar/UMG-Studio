import type { MOLTRole, UMGBlock } from './types';
import type { ArchitectBlockMatch } from './sleeveArchitectTypes';

export type BlockSemanticIndexEntry = {
  block: UMGBlock;
  text: string;
  tags: string[];
  tokens: Set<string>;
};

export type BlockSemanticSearchResult = ArchitectBlockMatch & {
  block: UMGBlock;
  explanation: string;
};

const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'agent', 'workflow', 'business', 'customer', 'should', 'need', 'needs', 'user', 'users', 'automate']);

export function normalizeSemanticTags(values: Array<string | undefined>): string[] {
  const tags = values
    .flatMap((value) => String(value ?? '').toLowerCase().split(/[^a-z0-9]+/g))
    .map((value) => value.trim())
    .filter((value) => value.length > 2 && !stopWords.has(value));
  return Array.from(new Set(tags));
}

function blockText(block: UMGBlock): string {
  return [
    block.id,
    block.title,
    block.role,
    block.displayType,
    block.category,
    block.description,
    block.content,
    block.expectedOutput,
    block.action,
    ...(block.tags ?? []),
    ...(block.compatibleStacks ?? []),
    ...(block.compatibleSleeves ?? [])
  ].filter(Boolean).join(' ');
}

export function buildBlockSemanticIndex(blocks: UMGBlock[]): BlockSemanticIndexEntry[] {
  return blocks.map((block) => {
    const text = blockText(block).toLowerCase();
    const tags = normalizeSemanticTags([block.id, block.title, block.role, block.category, block.description, block.content, ...(block.tags ?? [])]);
    return { block, text, tags, tokens: new Set(tags) };
  });
}

export function scoreBlockMatch(entry: BlockSemanticIndexEntry, query: string, tags: string[] = [], preferredRoles: MOLTRole[] = []): { score: number; matchedTags: string[] } {
  const queryTags = normalizeSemanticTags([query, ...tags]);
  const matchedTags = queryTags.filter((tag) => entry.text.includes(tag) || entry.tokens.has(tag));
  const roleBoost = preferredRoles.includes(entry.block.role) ? 0.18 : 0;
  const titleBoost = queryTags.some((tag) => entry.block.title.toLowerCase().includes(tag)) ? 0.12 : 0;
  const categoryBoost = queryTags.some((tag) => String(entry.block.category ?? '').toLowerCase().includes(tag)) ? 0.06 : 0;
  const score = Math.min(1, matchedTags.length / Math.max(5, queryTags.length) + roleBoost + titleBoost + categoryBoost);
  return { score: Number(score.toFixed(3)), matchedTags: Array.from(new Set(matchedTags)).slice(0, 10) };
}

export function explainBlockMatch(entry: BlockSemanticIndexEntry, matchedTags: string[], score: number): string {
  if (!matchedTags.length) return `Low-confidence candidate (${score}) from loaded/local blocks; no strong semantic tag overlap.`;
  return `Matched ${matchedTags.slice(0, 5).join(', ')} against ${entry.block.role} block metadata/content with score ${score}.`;
}

export function searchBlocksForArchitectPlan(args: { blocks: UMGBlock[]; queries: string[]; tags?: string[]; preferredRoles?: MOLTRole[]; limit?: number }): BlockSemanticSearchResult[] {
  const index = buildBlockSemanticIndex(args.blocks);
  const aggregate = new Map<string, BlockSemanticSearchResult>();
  for (const query of args.queries) {
    for (const entry of index) {
      const result = scoreBlockMatch(entry, query, args.tags ?? [], args.preferredRoles ?? []);
      if (result.score <= 0) continue;
      const existing = aggregate.get(entry.block.id);
      if (existing && existing.score >= result.score) continue;
      aggregate.set(entry.block.id, {
        block: entry.block,
        blockId: entry.block.id,
        title: entry.block.title,
        role: entry.block.role,
        score: result.score,
        matchedTags: result.matchedTags,
        reason: explainBlockMatch(entry, result.matchedTags, result.score),
        explanation: explainBlockMatch(entry, result.matchedTags, result.score),
        source: 'loaded_local_blocks'
      });
    }
  }
  return Array.from(aggregate.values())
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, args.limit ?? 16);
}
