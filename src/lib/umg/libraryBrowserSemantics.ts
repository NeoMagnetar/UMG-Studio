import type { ShelfAsset } from './libraryAssets';
import type { UMGBlock } from './types';
import type { UmgLibraryCandidateBase } from './umgLibraryCandidateRetrieval';

export type UploadedIntakeContext = {
  name: string;
  size: number;
  lastModified: number;
  mimeType?: string;
  status: 'parsed_text' | 'unsupported_type' | 'read_error';
  text?: string;
  summary?: string;
  keywords: string[];
  error?: string;
};

export function normalizeLibraryText(value: unknown) {
  return String(value ?? '').toLowerCase().trim().replace(/[\s_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function slugEquivalent(value: unknown) {
  return String(value ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleTokens(value: string) {
  return normalizeLibraryText(value).split(/\s+/).filter(Boolean);
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
}

export function getPrefixFirstBlockSearchTier(item: ShelfAsset, query: string) {
  const needle = normalizeLibraryText(query);
  const needleSlug = slugEquivalent(query);
  if (!needle && !needleSlug) return undefined;
  const asset = item.asset as Partial<UMGBlock> & Record<string, unknown>;
  const title = normalizeLibraryText(item.title || asset.title);
  const assetId = normalizeLibraryText(asset.id || item.id);
  const slugTitle = slugEquivalent(item.title || asset.title);
  const slugId = slugEquivalent(asset.id || item.id);
  const tokens = uniqueStrings([...titleTokens(title), ...titleTokens(slugTitle.replace(/-/g, ' '))]);
  const tags = uniqueStrings([...(asset.tags as string[] | undefined ?? []), ...item.tags]).map((tag) => ({ text: normalizeLibraryText(tag), slug: slugEquivalent(tag) }));
  const categories = uniqueStrings([asset.category, asset.domain, item.displayFamily, item.displayRole, item.displayType, item.kind]).map(normalizeLibraryText);
  const content = uniqueStrings([asset.description, asset.content, ...(item.containedTitles ?? [])]).map(normalizeLibraryText);
  const fallback = uniqueStrings([item.id, asset.id, item.sourcePath, asset.sourcePath]).map(normalizeLibraryText);

  if (title === needle || slugTitle === needleSlug || slugId === needleSlug) return 0;
  if (title.startsWith(needle) || slugTitle.startsWith(needleSlug)) return 1;
  if (tokens.some((token) => token.startsWith(needle) || slugEquivalent(token).startsWith(needleSlug))) return 2;
  if (tags.some((tag) => tag.text.startsWith(needle) || tag.slug.startsWith(needleSlug))) return 3;
  if (categories.some((category) => category.startsWith(needle))) return 4;
  if (content.some((value) => value.includes(needle))) return 5;
  if ([title, slugTitle, ...tags.map((tag) => tag.text), ...categories, ...content, ...fallback].some((value) => value.includes(needle) || slugEquivalent(value).includes(needleSlug))) return 6;
  return undefined;
}

export function matchesPrefixFirstBlockSearch(item: ShelfAsset, query: string) {
  return !normalizeLibraryText(query) || getPrefixFirstBlockSearchTier(item, query) !== undefined;
}

export function sortPrefixFirstBlockSearchItems(items: ShelfAsset[], query: string) {
  const normalizedQuery = normalizeLibraryText(query);
  return items
    .map((item, index) => ({ item, index, tier: getPrefixFirstBlockSearchTier(item, normalizedQuery) ?? Number.MAX_SAFE_INTEGER, title: normalizeLibraryText(item.title) }))
    .sort((a, b) => {
      if (normalizedQuery && a.tier !== b.tier) return a.tier - b.tier;
      if (normalizedQuery) return a.title.localeCompare(b.title) || a.index - b.index;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export function tagEquivalentMatches(candidateTag: string, selectedTag: string) {
  const candidate = normalizeLibraryText(candidateTag);
  const selected = normalizeLibraryText(selectedTag);
  return candidate === selected || slugEquivalent(candidateTag) === slugEquivalent(selectedTag);
}

export function itemMatchesSelectedTags(item: ShelfAsset, selectedTags: string[]) {
  return selectedTags.every((tag) => item.tags.some((itemTag) => tagEquivalentMatches(itemTag, tag)));
}

export function itemMatchesLiveTagQuery(item: ShelfAsset, query: string) {
  const needle = normalizeLibraryText(query);
  const needleSlug = slugEquivalent(query);
  if (!needle && !needleSlug) return true;
  return item.tags.some((tag) => normalizeLibraryText(tag).startsWith(needle) || slugEquivalent(tag).startsWith(needleSlug));
}

export function sortMatchingTags(tags: string[], query: string, selectedTags: string[] = []) {
  const needle = normalizeLibraryText(query);
  const needleSlug = slugEquivalent(query);
  const selected = new Set(selectedTags.map(slugEquivalent));
  return Array.from(new Set(tags))
    .filter((tag) => !selected.has(slugEquivalent(tag)))
    .filter((tag) => !needle || normalizeLibraryText(tag).includes(needle) || slugEquivalent(tag).includes(needleSlug))
    .sort((a, b) => {
      const aText = normalizeLibraryText(a); const bText = normalizeLibraryText(b);
      const aSlug = slugEquivalent(a); const bSlug = slugEquivalent(b);
      const aPrefix = aText.startsWith(needle) || aSlug.startsWith(needleSlug) ? 0 : 1;
      const bPrefix = bText.startsWith(needle) || bSlug.startsWith(needleSlug) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return aText.localeCompare(bText);
    });
}

export function createMetadataMoltBlock(candidate: UmgLibraryCandidateBase): UMGBlock {
  const role = (candidate.role ?? 'meta') as UMGBlock['role'];
  return {
    id: candidate.id,
    title: candidate.title,
    type: 'molt_block',
    role,
    displayType: role,
    content: candidate.description || `Source-library metadata card for ${candidate.title}. Full source content remains read-only at ${candidate.sourcePath ?? 'unknown source path'}.`,
    description: candidate.description || `Generated metadata index entry for ${candidate.blockType} ${candidate.role ?? 'unknown role'}.`,
    category: candidate.category ?? candidate.domain ?? 'source-library metadata index',
    tags: candidate.tags ?? [],
    defaultState: 'off',
    visibility: 'visible',
    sourcePath: candidate.sourcePath,
    sourceLayer: 'AI',
    status: 'runnable',
    presentationStatus: 'runnable',
    source: { origin: 'library', sourceId: candidate.id, version: 'metadata-index' },
    legacy: { original: candidate, sourcePath: candidate.sourcePath, migrationWarnings: [] }
  } as UMGBlock;
}

export function summarizeUploadedText(name: string, text: string) {
  const compact = text.replace(/\s+/g, ' ').trim();
  return `${name}: ${compact.slice(0, 700)}${compact.length > 700 ? '…' : ''}`;
}

export function extractKeywordsFromText(text: string, limit = 24) {
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you', 'are', 'will', 'can', 'should', 'have', 'has', 'was', 'were', 'file', 'content']);
  const counts = new Map<string, number>();
  for (const token of normalizeLibraryText(text).split(/\s+/).filter((token) => token.length > 3 && !stop.has(token))) counts.set(token, (counts.get(token) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([token]) => token);
}

export function buildUploadedContextText(contexts: UploadedIntakeContext[]) {
  return contexts.filter((context) => context.status === 'parsed_text' && context.summary).map((context) => context.summary).join('\n');
}
