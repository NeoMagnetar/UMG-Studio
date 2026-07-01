import { UMG_LIBRARY_METADATA_INDEX, UMG_LIBRARY_METADATA_INDEX_INFO } from './generated/umgLibraryMetadataIndex';
import type { UMGCreatedMoltBlock } from './umgBlockAuthoring';
import type { NormalizedTemplateMoltBlock, NormalizedTemplateNeoBlock } from './templateSleeveStructures';
import type { UmgLibraryCandidateBase } from './umgLibraryCandidateRetrieval';
import { hydrateUmgLibraryCandidate, retrieveUmgLibraryCandidates } from './umgLibraryCandidateRetrieval';

export type NeoBlockCompositionRole = 'directive' | 'instruction' | 'subject' | 'primary' | 'philosophy' | 'blueprint';
export const DEFAULT_NEOBLOCK_COMPOSITION_ROLES: NeoBlockCompositionRole[] = ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];

export type NeoBlockMoltCandidate = Omit<UmgLibraryCandidateBase, 'sourceKind' | 'role'> & {
  role: NeoBlockCompositionRole | string;
  sourceKind: 'source-library' | 'workspace-draft' | 'imported-package';
  score: number;
  whySelected: string[];
  matchReasons: string[];
  rejectedReason?: string;
};

export type ImportedMoltBlockContext = Partial<NormalizedTemplateMoltBlock> & { id: string; title: string; role?: string; tags?: string[]; content?: string; description?: string; sourceKind?: string };

export type NeoBlockMoltRetrievalInput = {
  userPrompt: string;
  sleeveDomain?: string;
  neoStackTitle?: string;
  neoBlockPurpose: string;
  tags?: string[];
  roleRequirements?: NeoBlockCompositionRole[];
  sourceIndex?: UmgLibraryCandidateBase[];
  workspaceBlocks?: UMGCreatedMoltBlock[];
  importedMoltBlocks?: ImportedMoltBlockContext[];
  perRoleLimit?: number;
};

export type NeoBlockMoltRetrievalResult = {
  rankedCandidates: NeoBlockMoltCandidate[];
  selectedMoltBlocks: NeoBlockMoltCandidate[];
  rejectedCandidates: NeoBlockMoltCandidate[];
  unusedRelevantCandidates: NeoBlockMoltCandidate[];
  roleCoverage: Record<NeoBlockCompositionRole, { covered: boolean; candidateIds: string[] }>;
  missingRoles: NeoBlockCompositionRole[];
};

export type NeoBlockCompositionEvidence = {
  selectedMoltBlocks: Array<{ id: string; title: string; role: string; sourceKind: string; sourcePath?: string; whySelected: string[] }>;
  rejectedCandidates: Array<{ id: string; title: string; role?: string; sourceKind: string; reason: string }>;
  unusedCandidateCount: number;
  missingRoleWarnings: NeoBlockCompositionRole[];
  sourceBoundCount: number;
  workspaceDraftCount: number;
  importedPackageCount: number;
};

export type ComposedNeoBlockResult = {
  neoBlock: NormalizedTemplateNeoBlock;
  moltBlocks: NormalizedTemplateMoltBlock[];
  roleCoverage: Record<NeoBlockCompositionRole, { covered: boolean; candidateIds: string[] }>;
  missingRoleWarnings: NeoBlockCompositionRole[];
  sourceLibraryBindings: Array<{ id: string; title: string; sourcePath?: string }>;
  workspaceDraftBindings: Array<{ id: string; title: string; sourcePath?: string }>;
  validationStatus: 'valid' | 'needs_role_review' | 'empty';
  evidence: NeoBlockCompositionEvidence;
};

export type SourceLibraryMoltInventory = {
  generatedAt?: string;
  sourceRoot?: string;
  filesScanned?: number;
  totalEntries: number;
  moltLikeEntries: number;
  roleCounts: Record<NeoBlockCompositionRole | 'trigger', number>;
  blockTypeCounts: Record<string, number>;
  categories: Array<{ category: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
  indexFields: string[];
  retrieval: string[];
  mutationOccurred: false;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
}

function tokenize(value: string) {
  const stop = new Set(['and', 'the', 'with', 'from', 'into', 'that', 'this', 'make', 'create', 'block', 'neoblock', 'molt']);
  return Array.from(new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2 && !stop.has(token))));
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function cleanId(value: string) {
  return value.replace(/[^A-Z0-9_.-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'COMPOSED.NEOBLOCK';
}

function titleCase(value: string) {
  const normalized = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Composed NeoBlock';
}

function haystack(candidate: Partial<UmgLibraryCandidateBase> & { matchReasons?: string[] }) {
  return [candidate.id, candidate.title, candidate.role, candidate.blockType, candidate.domain, candidate.category, candidate.sourcePath, candidate.description, candidate.content, ...(candidate.tags ?? []), ...(candidate.compatibility ?? []), ...(candidate.matchReasons ?? [])].filter(Boolean).join(' ').toLowerCase();
}

function roleOf(value?: string): NeoBlockCompositionRole | undefined {
  const role = String(value ?? '').toLowerCase();
  return DEFAULT_NEOBLOCK_COMPOSITION_ROLES.includes(role as NeoBlockCompositionRole) ? role as NeoBlockCompositionRole : undefined;
}

function sourceCandidate(candidate: UmgLibraryCandidateBase, prompt: string, baseReasons: string[] = []): NeoBlockMoltCandidate | undefined {
  const role = roleOf(candidate.role);
  if (candidate.blockType !== 'molt' || !role) return undefined;
  const text = haystack(candidate);
  const tokens = tokenize(prompt);
  const matchedTokens = tokens.filter((token) => text.includes(token) || text.includes(token.replace(/s$/, '')));
  const score = matchedTokens.length * 10 + (candidate.tags ?? []).filter((tag) => tokens.some((token) => tag.toLowerCase().includes(token))).length * 5 + baseReasons.length * 3 + (candidate.sourceKind === 'source-library' ? 2 : 0);
  return { ...candidate, sourceKind: 'source-library', role, score, whySelected: unique([...baseReasons, ...matchedTokens.map((token) => `prompt-token:${token}`), `role:${role}`, 'source-library-index']), matchReasons: unique(baseReasons) };
}

function workspaceCandidate(block: UMGCreatedMoltBlock, prompt: string): NeoBlockMoltCandidate | undefined {
  const role = roleOf(block.role);
  if (!role) return undefined;
  const candidate: UmgLibraryCandidateBase = {
    id: block.id,
    title: block.title,
    blockType: 'molt',
    role,
    tags: block.tags,
    description: block.description,
    content: block.content,
    domain: block.category,
    category: block.category,
    sourceKind: 'workspace-draft',
    sourcePath: `workspace://blocks/${block.id}`,
    nlCard: block.nlCard,
    jsonSchema: block.jsonSchema,
    compatibility: ['workspace-draft', role, block.category, ...block.tags]
  };
  const text = haystack(candidate);
  const tokens = tokenize(prompt);
  const matchedTokens = tokens.filter((token) => text.includes(token));
  return { ...candidate, sourceKind: 'workspace-draft', role, score: 24 + matchedTokens.length * 12, whySelected: unique(['workspace-draft', `role:${role}`, ...matchedTokens.map((token) => `prompt-token:${token}`)]), matchReasons: ['workspace-draft'] };
}

function importedCandidate(block: ImportedMoltBlockContext, prompt: string): NeoBlockMoltCandidate | undefined {
  const role = roleOf(block.role);
  if (!role) return undefined;
  const candidate: UmgLibraryCandidateBase = {
    id: block.id,
    title: block.title,
    blockType: 'molt',
    role,
    tags: block.tags ?? [],
    description: block.description ?? block.content ?? block.title,
    content: block.content ?? block.description ?? block.title,
    category: 'imported-package',
    domain: 'imported-package',
    sourceKind: 'source-library',
    sourcePath: `imported-package://${block.id}`
  };
  const text = haystack(candidate);
  const tokens = tokenize(prompt);
  const matchedTokens = tokens.filter((token) => text.includes(token));
  return { ...candidate, sourceKind: 'imported-package', role, score: 10 + matchedTokens.length * 5, whySelected: unique(['imported-package-context', `role:${role}`, ...matchedTokens.map((token) => `prompt-token:${token}`)]), matchReasons: ['imported-package-context'] };
}

function compareCandidates(a: NeoBlockMoltCandidate, b: NeoBlockMoltCandidate) {
  const sourceRank = (candidate: NeoBlockMoltCandidate) => candidate.sourceKind === 'workspace-draft' ? 3 : candidate.sourceKind === 'source-library' ? 2 : 1;
  return b.score - a.score || sourceRank(b) - sourceRank(a) || a.title.localeCompare(b.title);
}

export function summarizeSourceLibraryMoltInventory(index: UmgLibraryCandidateBase[] = UMG_LIBRARY_METADATA_INDEX): SourceLibraryMoltInventory {
  const roleCounts: SourceLibraryMoltInventory['roleCounts'] = { trigger: 0, directive: 0, instruction: 0, subject: 0, primary: 0, philosophy: 0, blueprint: 0 };
  const blockTypeCounts: Record<string, number> = {};
  const categoryCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  index.forEach((candidate) => {
    const type = candidate.blockType ?? 'unknown';
    blockTypeCounts[type] = (blockTypeCounts[type] ?? 0) + 1;
    const role = String(candidate.role ?? '').toLowerCase();
    if (role in roleCounts) roleCounts[role as keyof typeof roleCounts] += 1;
    if (candidate.category) categoryCounts.set(candidate.category, (categoryCounts.get(candidate.category) ?? 0) + 1);
    (candidate.tags ?? []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1));
  });
  const info = UMG_LIBRARY_METADATA_INDEX_INFO;
  return {
    generatedAt: info.generatedAt,
    sourceRoot: info.sourceRoot,
    filesScanned: info.filesScanned,
    totalEntries: index.length,
    moltLikeEntries: index.filter((candidate) => candidate.blockType === 'molt' && Boolean(roleOf(candidate.role))).length,
    roleCounts,
    blockTypeCounts,
    categories: Array.from(categoryCounts, ([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)).slice(0, 40),
    tags: Array.from(tagCounts, ([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, 60),
    indexFields: info.fieldsExtracted ?? ['id', 'title', 'blockType', 'role', 'tags', 'description', 'domain', 'category', 'sourcePath', 'sourceKind', 'compatibility'],
    retrieval: ['token scoring over id/title/role/tags/domain/category/sourcePath/description/content', 'role-targeted bucket scoring', 'workspace-draft candidates merged after source index', 'imported package MOLT blocks used only as package context unless source-library provenance is explicit'],
    mutationOccurred: false
  };
}

export function retrieveNeoBlockMoltCandidates(input: NeoBlockMoltRetrievalInput): NeoBlockMoltRetrievalResult {
  const requiredRoles = input.roleRequirements ?? DEFAULT_NEOBLOCK_COMPOSITION_ROLES;
  const prompt = [input.userPrompt, input.sleeveDomain, input.neoStackTitle, input.neoBlockPurpose, ...(input.tags ?? [])].filter(Boolean).join(' ');
  const sourceIndex = input.sourceIndex ?? UMG_LIBRARY_METADATA_INDEX;
  const seeded = new Map<string, NeoBlockMoltCandidate>();

  retrieveUmgLibraryCandidates(prompt, { index: sourceIndex, limit: 96 }).forEach((candidate) => {
    const normalized = sourceCandidate(hydrateUmgLibraryCandidate(candidate), prompt, candidate.matchReasons);
    if (normalized && normalized.score > 0) seeded.set(normalized.id, normalized);
  });
  sourceIndex.forEach((candidate) => {
    const normalized = sourceCandidate(candidate, prompt);
    if (normalized && normalized.score > 0 && !seeded.has(normalized.id)) seeded.set(normalized.id, normalized);
  });
  (input.workspaceBlocks ?? []).forEach((block) => {
    const candidate = workspaceCandidate(block, prompt);
    if (candidate) seeded.set(candidate.id, candidate);
  });
  (input.importedMoltBlocks ?? []).forEach((block) => {
    const candidate = importedCandidate(block, prompt);
    if (candidate && !seeded.has(candidate.id)) seeded.set(candidate.id, candidate);
  });

  const rankedCandidates = Array.from(seeded.values()).filter((candidate) => requiredRoles.includes(roleOf(candidate.role) as NeoBlockCompositionRole)).sort(compareCandidates);
  const selected: NeoBlockMoltCandidate[] = [];
  const usedIds = new Set<string>();
  requiredRoles.forEach((role) => {
    const roleCandidates = rankedCandidates.filter((candidate) => candidate.role === role && !usedIds.has(candidate.id)).sort(compareCandidates);
    const workspace = roleCandidates.find((candidate) => candidate.sourceKind === 'workspace-draft');
    const source = roleCandidates.find((candidate) => candidate.sourceKind === 'source-library');
    const chosen = workspace ?? source;
    if (chosen) {
      selected.push(chosen);
      usedIds.add(chosen.id);
    }
    const packageContext = roleCandidates.find((candidate) => candidate.sourceKind === 'imported-package' && !usedIds.has(candidate.id));
    if (!chosen && packageContext) {
      selected.push(packageContext);
      usedIds.add(packageContext.id);
    }
  });
  const roleCoverage = Object.fromEntries(DEFAULT_NEOBLOCK_COMPOSITION_ROLES.map((role) => {
    const provenanceCovered = selected.filter((candidate) => candidate.role === role && candidate.sourceKind !== 'imported-package');
    return [role, { covered: provenanceCovered.length > 0, candidateIds: provenanceCovered.map((candidate) => candidate.id) }];
  })) as NeoBlockMoltRetrievalResult['roleCoverage'];
  const missingRoles = requiredRoles.filter((role) => !roleCoverage[role].covered);
  const unusedRelevantCandidates = rankedCandidates.filter((candidate) => !usedIds.has(candidate.id));
  const rejectedCandidates = unusedRelevantCandidates.map((candidate) => ({ ...candidate, rejectedReason: selected.some((entry) => entry.role === candidate.role) ? `role-covered:${candidate.role}` : 'lower-score' }));
  return { rankedCandidates, selectedMoltBlocks: selected, rejectedCandidates, unusedRelevantCandidates, roleCoverage, missingRoles };
}

function candidateToMolt(candidate: NeoBlockMoltCandidate, parentNeoBlockId: string, parentNeoStackId: string, index: number): NormalizedTemplateMoltBlock {
  const sourceLibrary = candidate.sourceKind === 'source-library';
  const workspace = candidate.sourceKind === 'workspace-draft';
  const id = sourceLibrary ? cleanId(`BOUND.${parentNeoBlockId}.${candidate.id}`) : workspace ? cleanId(`WORKSPACE.${parentNeoBlockId}.${candidate.id}`) : cleanId(`IMPORTED.${parentNeoBlockId}.${candidate.id}`);
  const sourceKind = sourceLibrary ? 'source-library reused' : 'runtime-session draft';
  return {
    id,
    sourceId: candidate.id,
    title: candidate.title,
    role: roleOf(candidate.role) ?? 'instruction',
    content: candidate.content || candidate.description || candidate.title,
    description: candidate.description || candidate.content || candidate.title,
    tags: unique([...(candidate.tags ?? []), String(candidate.role), candidate.sourceKind, 'neoblock-composer']),
    parentNeoBlockId,
    parentNeoStackId,
    stackOrder: index + 1,
    defaultState: 'off',
    sourceKind,
    reusedBlockId: sourceLibrary ? candidate.id : undefined,
    matchedCandidateId: sourceLibrary ? candidate.id : undefined,
    sourcePath: candidate.sourcePath,
    blockType: 'molt',
    generationReason: `Selected for ${parentNeoBlockId}: ${candidate.whySelected.join('; ')}`,
    rejectedCandidateIds: [],
    nlCard: { title: candidate.title, role: candidate.role, sourceKind: candidate.sourceKind, whySelected: candidate.whySelected },
    jsonSchema: { type: 'object', required: ['id', 'title', 'role', 'sourceKind'], properties: { id: { type: 'string' }, title: { type: 'string' }, role: { type: 'string' }, sourceKind: { type: 'string' }, matchedCandidateId: { type: 'string' } } }
  };
}

export function composeNeoBlockFromMoltBlocks(input: NeoBlockMoltRetrievalInput & { parentNeoStackId: string; parentNeoStackTitle?: string; requiredRoles?: NeoBlockCompositionRole[] }): ComposedNeoBlockResult {
  const retrieval = retrieveNeoBlockMoltCandidates({ ...input, roleRequirements: input.requiredRoles });
  const parentNeoBlockId = cleanId(`NB.${input.parentNeoStackId}.${input.neoBlockPurpose}`).toUpperCase();
  const title = titleCase(input.neoBlockPurpose);
  const moltBlocks = retrieval.selectedMoltBlocks.map((candidate, index) => candidateToMolt(candidate, parentNeoBlockId, input.parentNeoStackId, index));
  const sourceLibraryBindings = retrieval.selectedMoltBlocks.filter((candidate) => candidate.sourceKind === 'source-library').map((candidate) => ({ id: candidate.id, title: candidate.title, sourcePath: candidate.sourcePath }));
  const workspaceDraftBindings = retrieval.selectedMoltBlocks.filter((candidate) => candidate.sourceKind === 'workspace-draft').map((candidate) => ({ id: candidate.id, title: candidate.title, sourcePath: candidate.sourcePath }));
  const evidence: NeoBlockCompositionEvidence = {
    selectedMoltBlocks: retrieval.selectedMoltBlocks.map((candidate) => ({ id: candidate.id, title: candidate.title, role: String(candidate.role), sourceKind: candidate.sourceKind, sourcePath: candidate.sourcePath, whySelected: candidate.whySelected })),
    rejectedCandidates: retrieval.rejectedCandidates.slice(0, 24).map((candidate) => ({ id: candidate.id, title: candidate.title, role: candidate.role, sourceKind: candidate.sourceKind, reason: candidate.rejectedReason ?? 'unused-relevant-candidate' })),
    unusedCandidateCount: retrieval.unusedRelevantCandidates.length,
    missingRoleWarnings: retrieval.missingRoles,
    sourceBoundCount: sourceLibraryBindings.length,
    workspaceDraftCount: workspaceDraftBindings.length,
    importedPackageCount: retrieval.selectedMoltBlocks.filter((candidate) => candidate.sourceKind === 'imported-package').length
  };
  const missingRoleWarnings = retrieval.missingRoles;
  const validationStatus: ComposedNeoBlockResult['validationStatus'] = moltBlocks.length === 0 ? 'empty' : missingRoleWarnings.length ? 'needs_role_review' : 'valid';
  const neoBlock: NormalizedTemplateNeoBlock = {
    id: parentNeoBlockId,
    title,
    description: `Studio-composed NeoBlock for ${input.neoBlockPurpose}.`,
    neoStackId: input.parentNeoStackId,
    blockOrder: 1,
    tags: unique([...(input.tags ?? []), 'studio-composed', 'source-library-composed']),
    moltBlockIds: moltBlocks.map((block) => block.id),
    gateIds: [],
    defaultState: 'off',
    runtimeState: 'idle',
    sourceKind: 'runtime-session draft',
    blockType: 'neoblock',
    generationReason: `Deterministic Studio NeoBlock composition from ${evidence.sourceBoundCount} source-library and ${evidence.workspaceDraftCount} workspace MOLT Blocks.`,
    nlCard: { title, parentNeoStack: input.parentNeoStackTitle ?? input.parentNeoStackId, purpose: input.neoBlockPurpose, evidence },
    jsonSchema: { type: 'object', required: ['id', 'title', 'moltBlockIds'], properties: { id: { type: 'string' }, title: { type: 'string' }, moltBlockIds: { type: 'array', items: { type: 'string' } }, evidence: { type: 'object' } } }
  };
  return { neoBlock, moltBlocks, roleCoverage: retrieval.roleCoverage, missingRoleWarnings, sourceLibraryBindings, workspaceDraftBindings, validationStatus, evidence };
}

export function analyzeImportedSleeveNeoBlockComposition(input: { neoBlocks: Array<{ id: string; title: string; description?: string; moltBlockIds?: string[] }>; moltBlocks: Array<Partial<NormalizedTemplateMoltBlock> & { id: string; title: string; role?: string; tags?: string[]; content?: string; description?: string; sourceKind?: string; matchedCandidateId?: string }>; sourceIndex?: UmgLibraryCandidateBase[] }) {
  const sourceIndex = input.sourceIndex ?? UMG_LIBRARY_METADATA_INDEX;
  const sourceMatches = new Map<string, NeoBlockMoltCandidate[]>();
  const neoBlocks = input.neoBlocks.map((block) => {
    const packageMolts = input.moltBlocks.filter((molt) => block.moltBlockIds?.includes(molt.id));
    const prompt = [block.title, block.description, ...packageMolts.map((molt) => `${molt.title} ${molt.role ?? ''} ${(molt.tags ?? []).join(' ')} ${molt.content ?? molt.description ?? ''}`)].join(' ');
    const matches = retrieveNeoBlockMoltCandidates({ userPrompt: prompt, neoBlockPurpose: block.title, sourceIndex, importedMoltBlocks: packageMolts, perRoleLimit: 2 }).selectedMoltBlocks.filter((candidate) => candidate.sourceKind === 'source-library');
    sourceMatches.set(block.id, matches);
    const hasExplicitSource = packageMolts.some((molt) => molt.sourceKind === 'source-library reused' || Boolean(molt.matchedCandidateId));
    return {
      neoBlockId: block.id,
      title: block.title,
      packageMoltIds: packageMolts.map((molt) => molt.id),
      matchedSourceMoltIds: matches.map((candidate) => candidate.id),
      unmatchedMoltNeeds: DEFAULT_NEOBLOCK_COMPOSITION_ROLES.filter((role) => !matches.some((candidate) => candidate.role === role)),
      suggestedNewMoltBlocks: DEFAULT_NEOBLOCK_COMPOSITION_ROLES.filter((role) => !matches.some((candidate) => candidate.role === role)).map((role) => `${role} MOLT for ${block.title}`),
      suggestedNewNeoBlocks: matches.length ? [] : [`Reconstruct ${block.title} with source-library MOLT role coverage`],
      compositionMode: hasExplicitSource ? 'source-library-active' : matches.length ? 'package-plus-source-suggestions' : 'package-only'
    };
  });
  return {
    packageProvidedNeoBlocks: input.neoBlocks.length,
    sourceLibraryMatchedMoltBlocks: unique(Array.from(sourceMatches.values()).flat().map((candidate) => candidate.id)).length,
    unmatchedMoltNeeds: unique(neoBlocks.flatMap((block) => block.unmatchedMoltNeeds)),
    suggestedNewMoltBlocks: unique(neoBlocks.flatMap((block) => block.suggestedNewMoltBlocks)),
    suggestedNewNeoBlocks: unique(neoBlocks.flatMap((block) => block.suggestedNewNeoBlocks)),
    sourceLibraryCompositionActive: neoBlocks.some((block) => block.compositionMode === 'source-library-active'),
    neoBlocks
  };
}
