import { UMG_LIBRARY_METADATA_INDEX, UMG_LIBRARY_METADATA_INDEX_INFO } from './generated/umgLibraryMetadataIndex';

export type UmgLibraryCandidateBlockType = 'molt' | 'neoblock' | 'neostack' | 'gate' | 'capability' | 'unknown';

export type UmgLibraryCandidateBase = {
  id: string;
  title: string;
  blockType: UmgLibraryCandidateBlockType;
  role?: string;
  tags: string[];
  description?: string;
  domain?: string;
  category?: string;
  sourcePath?: string;
  sourceKind: 'source-library';
  compatibility?: string[];
};

export type UmgLibraryCandidate = UmgLibraryCandidateBase & {
  score: number;
  matchReasons: string[];
};

export const umgLibraryIndexInfo = UMG_LIBRARY_METADATA_INDEX_INFO;
export { UMG_LIBRARY_METADATA_INDEX_INFO };

const STOP_WORDS = new Set(['a', 'an', 'and', 'any', 'are', 'for', 'into', 'that', 'the', 'this', 'with', 'always', 'creating', 'create', 'workflow', 'prompted', 'incorporating']);

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
}

function tokenize(value: string) {
  return Array.from(new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2 && !STOP_WORDS.has(token))));
}

function includesToken(haystack: string, token: string) {
  return haystack.includes(token) || (token.endsWith('s') && haystack.includes(token.slice(0, -1))) || haystack.includes(`${token}s`);
}

const HINTS: Record<string, string[]> = {
  note: ['instruction', 'directive', 'subject', 'blueprint', 'content', 'document', 'message', 'summary', 'writing', 'write'],
  notes: ['instruction', 'directive', 'subject', 'blueprint', 'content', 'document', 'message', 'summary', 'writing', 'write'],
  desktop: ['desktop', 'local', 'runtime', 'artifact', 'file', 'tool', 'output'],
  greek: ['greek', 'ancient-greek-roman', 'platonism', 'stoicism', 'aristotelianism', 'philosophy'],
  philosophy: ['philosophy', 'philosophical', 'platonism', 'stoicism', 'aristotelianism', 'ethics'],
  apples: ['subject', 'content', 'composition']
};

export function retrieveUmgLibraryCandidates(prompt: string, options: { limit?: number; index?: UmgLibraryCandidateBase[] } = {}): UmgLibraryCandidate[] {
  const tokens = tokenize(prompt);
  const expandedTokens = Array.from(new Set([...tokens, ...tokens.flatMap((token) => HINTS[token] ?? [])]));
  const index = options.index ?? UMG_LIBRARY_METADATA_INDEX;
  const scored = index.map((candidate) => {
    const title = normalize(candidate.title);
    const tags = (candidate.tags ?? []).map(normalize);
    const role = normalize(candidate.role ?? '');
    const domain = normalize(candidate.domain ?? '');
    const category = normalize(candidate.category ?? '');
    const description = normalize(candidate.description ?? '');
    const compatibility = (candidate.compatibility ?? []).map(normalize);
    let score = 0;
    const reasons: string[] = [];
    for (const token of expandedTokens) {
      if (includesToken(title, token)) { score += 8; reasons.push(`title:${token}`); }
      if (tags.some((tag) => includesToken(tag, token))) { score += 6; reasons.push(`tag:${token}`); }
      if (includesToken(role, token)) { score += 5; reasons.push(`role:${token}`); }
      if (includesToken(domain, token)) { score += 4; reasons.push(`domain:${token}`); }
      if (includesToken(category, token)) { score += 4; reasons.push(`category:${token}`); }
      if (compatibility.some((hint) => includesToken(hint, token))) { score += 3; reasons.push(`compatibility:${token}`); }
      if (includesToken(description, token)) { score += 2; reasons.push(`description:${token}`); }
    }
    if (tokens.includes('philosophy') || tokens.includes('greek')) {
      if (candidate.role === 'philosophy') { score += 12; reasons.push('molt-role:philosophy'); }
      if (candidate.blockType === 'molt') { score += 1; reasons.push('molt-candidate'); }
    }
    if (tokens.includes('note') || tokens.includes('notes')) {
      if (candidate.role === 'instruction' || candidate.role === 'blueprint' || candidate.role === 'subject' || candidate.role === 'directive') { score += 4; reasons.push('note-compatible-role'); }
    }
    return { ...candidate, score, matchReasons: Array.from(new Set(reasons)).slice(0, 12) };
  }).filter((candidate) => candidate.score > 0);
  return scored.sort((a, b) => b.score - a.score || a.blockType.localeCompare(b.blockType) || a.title.localeCompare(b.title)).slice(0, options.limit ?? 24);
}

export function summarizeUmgLibraryCandidates(candidates: UmgLibraryCandidate[]) {
  const counts = candidates.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.blockType] = (acc[candidate.blockType] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: candidates.length,
    counts,
    topTitles: candidates.slice(0, 8).map((candidate) => candidate.title),
    topTypes: candidates.slice(0, 8).map((candidate) => candidate.blockType),
    topMatchReasons: candidates.slice(0, 8).map((candidate) => ({ id: candidate.id, reasons: candidate.matchReasons }))
  };
}
