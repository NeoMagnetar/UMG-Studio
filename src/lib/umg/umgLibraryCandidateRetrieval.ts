import { UMG_LIBRARY_METADATA_INDEX, UMG_LIBRARY_METADATA_INDEX_INFO } from './generated/umgLibraryMetadataIndex';

export type UmgLibraryCandidateBlockType = 'molt' | 'neoblock' | 'neostack' | 'gate' | 'capability' | 'unknown';

export type UmgLibraryCandidateBase = {
  id: string;
  title: string;
  blockType: UmgLibraryCandidateBlockType;
  role?: string;
  tags: string[];
  description?: string;
  content?: string;
  domain?: string;
  category?: string;
  sourcePath?: string;
  sourceKind: 'source-library';
  compatibility?: string[];
  nlCard?: Record<string, unknown>;
  jsonSchema?: Record<string, unknown>;
  schema?: Record<string, unknown>;
};

export type UmgLibraryCandidate = UmgLibraryCandidateBase & {
  score: number;
  matchReasons: string[];
};

export type UmgLibraryCandidateRoleBucket = 'directive' | 'instruction' | 'subject' | 'primary' | 'philosophy' | 'blueprint' | 'metaTool' | 'gate' | 'domainStyle';

export type UmgLibraryCandidatesByRole = Record<UmgLibraryCandidateRoleBucket, UmgLibraryCandidate[]>;

export type RoleTargetedRetrievalResult = {
  candidates: UmgLibraryCandidate[];
  candidatesByRole: UmgLibraryCandidatesByRole;
  missingRoles: UmgLibraryCandidateRoleBucket[];
  rejectedCandidateIds: string[];
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

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function candidateHaystack(candidate: UmgLibraryCandidateBase) {
  return [candidate.id, candidate.title, candidate.role, candidate.blockType, candidate.domain, candidate.category, candidate.sourcePath, candidate.description, candidate.content, ...(candidate.tags ?? []), ...(candidate.compatibility ?? [])].filter(Boolean).join(' ').toLowerCase();
}

const HINTS: Record<string, string[]> = {
  note: ['instruction', 'directive', 'subject', 'blueprint', 'content', 'document', 'message', 'summary', 'writing', 'write', 'artifact'],
  notes: ['instruction', 'directive', 'subject', 'blueprint', 'content', 'document', 'message', 'summary', 'writing', 'write', 'artifact'],
  desktop: ['desktop', 'local', 'runtime', 'artifact', 'file', 'tool', 'output'],
  haiku: ['haiku', 'poetry', 'verse', 'poetic', 'poetic form', 'blueprint', 'form'],
  poem: ['poetry', 'verse', 'poetic', 'blueprint', 'form'],
  verse: ['poetry', 'verse', 'poetic', 'blueprint', 'form'],
  greek: ['greek', 'ancient-greek-roman', 'platonism', 'stoicism', 'aristotelianism', 'philosophy'],
  philosophy: ['philosophy', 'philosophical', 'platonism', 'stoicism', 'aristotelianism', 'ethics'],
  apples: ['subject', 'content', 'composition']
};

const ROLE_TARGETS: Record<UmgLibraryCandidateRoleBucket, { terms: string[]; roles?: string[]; blockTypes?: UmgLibraryCandidateBlockType[]; boost: RegExp }> = {
  directive: { terms: ['directive', 'rule', 'trigger', 'policy', 'must', 'require'], roles: ['directive'], blockTypes: ['molt'], boost: /directive|rule|trigger|policy|require|must/ },
  instruction: { terms: ['write', 'compose', 'generate', 'create', 'save', 'content', 'instruction'], roles: ['instruction'], blockTypes: ['molt'], boost: /write|compose|generate|create|save|content|instruction|draft|document/ },
  subject: { terms: ['text', 'document', 'note', 'artifact', 'desktop note', 'documentation'], roles: ['subject'], blockTypes: ['molt'], boost: /text|document|note|artifact|documentation|content|output/ },
  primary: { terms: ['final note', 'created file', 'output artifact', 'primary', 'result'], roles: ['primary'], blockTypes: ['molt'], boost: /final|created|file|output|artifact|primary|result|note/ },
  philosophy: { terms: ['philosophy', 'principle', 'ethics', 'style'], roles: ['philosophy'], blockTypes: ['molt'], boost: /philosophy|principle|ethic|style|persona/ },
  blueprint: { terms: ['haiku', 'poem', 'poetic form', 'output format', 'document process', 'blueprint'], roles: ['blueprint'], blockTypes: ['molt'], boost: /haiku|poetry|verse|poetic|form|output|format|document|process|blueprint/ },
  metaTool: { terms: ['Hermes note create', 'Hermes file write', 'native tool', 'runtime task', 'tool', 'metamolt'], blockTypes: ['capability', 'molt'], boost: /hermes|note create|file write|native tool|runtime task|tool|metamolt/ },
  gate: { terms: ['approval', 'write action', 'file output', 'validation', 'gate', 'control'], blockTypes: ['gate', 'molt', 'neoblock'], boost: /approval|write action|file output|validation|gate|control|policy/ },
  domainStyle: { terms: ['haiku', 'poem', 'poetic form', 'poetry', 'verse', '5-7-5'], blockTypes: ['molt'], boost: /haiku|poetry|verse|poetic|5.7.5|syllable|form/ }
};

function emptyRoleBuckets(): UmgLibraryCandidatesByRole {
  return { directive: [], instruction: [], subject: [], primary: [], philosophy: [], blueprint: [], metaTool: [], gate: [], domainStyle: [] };
}

export function hydrateUmgLibraryCandidate(candidate: UmgLibraryCandidateBase | UmgLibraryCandidate): UmgLibraryCandidateBase {
  const content = candidate.content || candidate.description || candidate.title;
  const category = candidate.category || candidate.domain || candidate.blockType;
  const tags = unique([...(candidate.tags ?? []), candidate.role ?? '', candidate.blockType, category].map(String));
  const nlCard = candidate.nlCard ?? {
    title: candidate.title,
    role: candidate.role ?? candidate.blockType,
    category,
    tags,
    description: candidate.description || content,
    content
  };
  const jsonSchema = candidate.jsonSchema ?? candidate.schema ?? {
    type: 'object',
    required: ['id', 'title', 'role', 'content', 'sourcePath'],
    properties: {
      id: { type: 'string', const: candidate.id },
      title: { type: 'string' },
      role: { type: 'string', const: candidate.role ?? candidate.blockType },
      content: { type: 'string' },
      sourceKind: { type: 'string', const: 'source-library reused' },
      sourcePath: { type: 'string' },
      matchedCandidateId: { type: 'string', const: candidate.id }
    }
  };
  return { ...candidate, content, category, tags, nlCard, jsonSchema };
}

function scoreCandidate(candidate: UmgLibraryCandidateBase, expandedTokens: string[], tokens: string[]) {
  const title = normalize(candidate.title);
  const tags = (candidate.tags ?? []).map(normalize);
  const role = normalize(candidate.role ?? '');
  const domain = normalize(candidate.domain ?? '');
  const category = normalize(candidate.category ?? '');
  const description = normalize(candidate.description ?? '');
  const content = normalize(candidate.content ?? '');
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
    if (includesToken(content, token)) { score += 2; reasons.push(`content:${token}`); }
  }
  if (tokens.includes('philosophy') || tokens.includes('greek')) {
    if (candidate.role === 'philosophy') { score += 12; reasons.push('molt-role:philosophy'); }
    if (candidate.blockType === 'molt') { score += 1; reasons.push('molt-candidate'); }
  }
  if (tokens.includes('note') || tokens.includes('notes')) {
    if (candidate.role === 'instruction' || candidate.role === 'blueprint' || candidate.role === 'subject' || candidate.role === 'directive') { score += 4; reasons.push('note-compatible-role'); }
  }
  if (tokens.some((token) => /haiku|poem|poetic|verse|5.7.5/.test(token))) {
    const haystack = candidateHaystack(candidate);
    if (/haiku|poetry|verse|poetic|5.7.5|syllable/.test(haystack)) { score += 30; reasons.push('haiku-poetry-form-priority'); }
    if (candidate.role === 'blueprint') { score += 8; reasons.push('haiku-compatible-blueprint'); }
  }
  return { score, reasons };
}

export function retrieveUmgLibraryCandidates(prompt: string, options: { limit?: number; index?: UmgLibraryCandidateBase[] } = {}): UmgLibraryCandidate[] {
  const tokens = tokenize(prompt);
  const expandedTokens = Array.from(new Set([...tokens, ...tokens.flatMap((token) => HINTS[token] ?? [])]));
  const index = options.index ?? UMG_LIBRARY_METADATA_INDEX;
  const scored = index.map((candidate) => {
    const hydrated = hydrateUmgLibraryCandidate(candidate);
    const { score, reasons } = scoreCandidate(hydrated, expandedTokens, tokens);
    return { ...hydrated, score, matchReasons: Array.from(new Set(reasons)).slice(0, 16) };
  }).filter((candidate) => candidate.score > 0);
  return scored.sort((a, b) => b.score - a.score || a.blockType.localeCompare(b.blockType) || a.title.localeCompare(b.title)).slice(0, options.limit ?? 24);
}

function rankForRole(bucket: UmgLibraryCandidateRoleBucket, prompt: string, options: { limit?: number; index?: UmgLibraryCandidateBase[] } = {}) {
  const target = ROLE_TARGETS[bucket];
  const tokens = tokenize(`${prompt} ${target.terms.join(' ')}`);
  const expandedTokens = Array.from(new Set([...tokens, ...tokens.flatMap((token) => HINTS[token] ?? [])]));
  const index = options.index ?? UMG_LIBRARY_METADATA_INDEX;
  const scored = index.map((candidate) => {
    const hydrated = hydrateUmgLibraryCandidate(candidate);
    const { score: baseScore, reasons } = scoreCandidate(hydrated, expandedTokens, tokens);
    const haystack = candidateHaystack(hydrated);
    let score = baseScore;
    if (target.roles?.includes(String(hydrated.role ?? '').toLowerCase())) { score += 20; reasons.push(`bucket-role:${bucket}`); }
    if (target.blockTypes?.includes(hydrated.blockType)) { score += 6; reasons.push(`bucket-type:${bucket}`); }
    if (target.boost.test(haystack)) { score += 14; reasons.push(`bucket-term:${bucket}`); }
    if (bucket === 'domainStyle' && /haiku/i.test(prompt) && /haiku|poetry|verse|poetic|5.7.5/.test(haystack)) { score += 40; reasons.push('forced-haiku-domain-style'); }
    return { ...hydrated, score, matchReasons: Array.from(new Set(reasons)).slice(0, 18) };
  }).filter((candidate) => candidate.score > 0);
  return scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, options.limit ?? 8);
}

export function retrieveRoleTargetedUmgLibraryCandidates(prompt: string, options: { perRoleLimit?: number; combinedLimit?: number; index?: UmgLibraryCandidateBase[] } = {}): RoleTargetedRetrievalResult {
  const candidatesByRole = emptyRoleBuckets();
  (Object.keys(candidatesByRole) as UmgLibraryCandidateRoleBucket[]).forEach((bucket) => {
    candidatesByRole[bucket] = rankForRole(bucket, prompt, { limit: options.perRoleLimit ?? 8, index: options.index });
  });
  const merged = new Map<string, UmgLibraryCandidate>();
  const push = (candidate: UmgLibraryCandidate) => {
    const existing = merged.get(candidate.id);
    if (!existing || candidate.score > existing.score) merged.set(candidate.id, candidate);
  };
  retrieveUmgLibraryCandidates(prompt, { limit: options.combinedLimit ?? 32, index: options.index }).forEach(push);
  Object.values(candidatesByRole).flat().forEach(push);
  const candidates = Array.from(merged.values()).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, options.combinedLimit ?? 48);
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const missingRoles = (Object.keys(candidatesByRole) as UmgLibraryCandidateRoleBucket[]).filter((bucket) => candidatesByRole[bucket].length === 0);
  const rejectedCandidateIds = Object.values(candidatesByRole).flat().filter((candidate) => !candidateIds.has(candidate.id)).map((candidate) => candidate.id);
  return { candidates, candidatesByRole, missingRoles, rejectedCandidateIds };
}

export function summarizeUmgLibraryCandidates(candidates: UmgLibraryCandidate[], candidatesByRole?: UmgLibraryCandidatesByRole) {
  const counts = candidates.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.blockType] = (acc[candidate.blockType] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: candidates.length,
    counts,
    roleBuckets: candidatesByRole ? Object.fromEntries(Object.entries(candidatesByRole).map(([role, roleCandidates]) => [role, roleCandidates.length])) : undefined,
    topTitles: candidates.slice(0, 8).map((candidate) => candidate.title),
    topTypes: candidates.slice(0, 8).map((candidate) => candidate.blockType),
    topMatchReasons: candidates.slice(0, 8).map((candidate) => ({ id: candidate.id, reasons: candidate.matchReasons }))
  };
}
