import { UMG_LIBRARY_METADATA_INDEX } from './generated/umgLibraryMetadataIndex';
import type { UmgLibraryCandidate, UmgLibraryCandidateBase, UmgLibraryCandidateRoleBucket } from './umgLibraryCandidateRetrieval';
import { hydrateUmgLibraryCandidate, retrieveRoleTargetedUmgLibraryCandidates, retrieveUmgLibraryCandidates } from './umgLibraryCandidateRetrieval';

function scoreless(candidate: UmgLibraryCandidateBase): UmgLibraryCandidate {
  const hydrated = hydrateUmgLibraryCandidate(candidate);
  return { ...hydrated, score: 'score' in candidate ? Number((candidate as UmgLibraryCandidate).score) : 100, matchReasons: 'matchReasons' in candidate ? (candidate as UmgLibraryCandidate).matchReasons : ['registry-exact-match'] };
}

export function getBlockById(id: string): UmgLibraryCandidate | undefined {
  const exact = UMG_LIBRARY_METADATA_INDEX.find((candidate) => candidate.id === id);
  return exact ? scoreless(exact) : undefined;
}

export function searchBlocks(query: string, options: { limit?: number } = {}): UmgLibraryCandidate[] {
  return retrieveUmgLibraryCandidates(query, { limit: options.limit ?? 24 });
}

export function searchByRole(role: UmgLibraryCandidateRoleBucket | string, options: { prompt?: string; limit?: number } = {}): UmgLibraryCandidate[] {
  const prompt = options.prompt ?? String(role);
  const targeted = retrieveRoleTargetedUmgLibraryCandidates(prompt, { perRoleLimit: options.limit ?? 8, combinedLimit: Math.max(options.limit ?? 8, 16) });
  if (role in targeted.candidatesByRole) return targeted.candidatesByRole[role as UmgLibraryCandidateRoleBucket].slice(0, options.limit ?? 8);
  return targeted.candidates.filter((candidate) => String(candidate.role ?? '').toLowerCase() === String(role).toLowerCase()).slice(0, options.limit ?? 8);
}

export function searchByTags(tags: string[], options: { limit?: number } = {}): UmgLibraryCandidate[] {
  const normalized = tags.map((tag) => tag.toLowerCase());
  return UMG_LIBRARY_METADATA_INDEX
    .filter((candidate) => normalized.some((tag) => [candidate.title, candidate.description, candidate.category, candidate.domain, ...(candidate.tags ?? [])].filter(Boolean).join(' ').toLowerCase().includes(tag)))
    .map(scoreless)
    .slice(0, options.limit ?? 24);
}

export function hydrateCandidate(candidate: UmgLibraryCandidateBase | UmgLibraryCandidate): UmgLibraryCandidateBase {
  return hydrateUmgLibraryCandidate(candidate);
}
