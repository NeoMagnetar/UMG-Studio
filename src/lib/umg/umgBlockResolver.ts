import { getHermesNativeToolBlockByCapability } from './nativeHermesToolBlocks';
import type { UmgLibraryCandidate } from './umgLibraryCandidateRetrieval';
import { hydrateUmgLibraryCandidate, retrieveRoleTargetedUmgLibraryCandidates } from './umgLibraryCandidateRetrieval';
import { getBlockById } from './umgLibraryRegistry';
import type { UMGCreatedMoltBlock } from './umgBlockAuthoring';
import type { UmgWorkflowIntent } from './umgWorkflowIntent';
import type { UmgWorkflowSlot } from './umgWorkflowSlots';

export type UmgResolvedWorkflowSlot = {
  slotId: string;
  source: 'source-library' | 'workspace-draft' | 'metamolt-tool' | 'runtime-draft' | 'missing';
  block?: UmgLibraryCandidate;
  confidence: number;
  reason: string;
  rejectedCandidateIds: string[];
  slot: UmgWorkflowSlot;
};

export type ResolveWorkflowSlotsInput = {
  prompt: string;
  intent: UmgWorkflowIntent;
  slots: UmgWorkflowSlot[];
  candidates?: UmgLibraryCandidate[];
  workspaceBlocks?: UMGCreatedMoltBlock[];
};

function haystack(candidate: UmgLibraryCandidate) {
  return [candidate.id, candidate.title, candidate.role, candidate.blockType, candidate.domain, candidate.category, candidate.sourcePath, candidate.description, candidate.content, ...(candidate.tags ?? []), ...(candidate.matchReasons ?? [])].filter(Boolean).join(' ').toLowerCase();
}

function roleMatches(candidate: UmgLibraryCandidate, slot: UmgWorkflowSlot) {
  const role = String(candidate.role ?? '').toLowerCase();
  return slot.acceptedRoles.some((accepted) => accepted.toLowerCase() === role || (accepted === 'capability' && candidate.blockType === 'capability') || (accepted === 'metaTool' && /tool|metamolt|hermes/.test(haystack(candidate))));
}

function termMatches(candidate: UmgLibraryCandidate, slot: UmgWorkflowSlot) {
  const text = haystack(candidate);
  return slot.searchTerms.some((term) => text.includes(term.toLowerCase())) || slot.preferredBlockIds.includes(candidate.id);
}

function allSearchTermsMatch(candidate: UmgLibraryCandidate, slot: UmgWorkflowSlot) {
  const text = haystack(candidate);
  return slot.searchTerms.length > 0 && slot.searchTerms.every((term) => text.includes(term.toLowerCase()));
}

function compareCompatibleCandidates(slot: UmgWorkflowSlot, explicitCandidateIds: Set<string>) {
  return (a: UmgLibraryCandidate, b: UmgLibraryCandidate) => {
    const aWorkspace = a.sourceKind === 'workspace-draft';
    const bWorkspace = b.sourceKind === 'workspace-draft';
    if (aWorkspace || bWorkspace) {
      const aExact = allSearchTermsMatch(a, slot);
      const bExact = allSearchTermsMatch(b, slot);
      if (aExact !== bExact) return aExact ? -1 : 1;
      if (aWorkspace !== bWorkspace) return aWorkspace ? -1 : 1;
    }
    const aExplicit = explicitCandidateIds.has(a.id);
    const bExplicit = explicitCandidateIds.has(b.id);
    if (aExplicit !== bExplicit) return aExplicit ? -1 : 1;
    return (b.score ?? 0) - (a.score ?? 0) || a.title.localeCompare(b.title);
  };
}

function workspaceBlockToCandidate(block: UMGCreatedMoltBlock): UmgLibraryCandidate {
  return hydrateUmgLibraryCandidate({
    id: block.id,
    title: block.title,
    blockType: 'molt',
    role: block.role,
    tags: block.tags,
    description: block.description,
    content: block.content,
    category: block.category,
    domain: block.category,
    sourcePath: `workspace://blocks/${block.id}`,
    sourceKind: 'workspace-draft',
    nlCard: block.nlCard,
    jsonSchema: block.jsonSchema,
    compatibility: ['workspace-draft', block.role, block.category, ...block.tags]
  }) as UmgLibraryCandidate;
}

function asToolCandidate(id: string, capabilityId: string): UmgLibraryCandidate {
  const known = getHermesNativeToolBlockByCapability(capabilityId);
  const title = known?.title ?? (capabilityId.includes('note') ? 'Hermes Native Note Create' : 'Hermes Native File Write');
  const description = known?.description ?? `Use ${id} for local Hermes native action execution.`;
  return hydrateUmgLibraryCandidate({
    id,
    title,
    blockType: 'capability',
    role: 'meta',
    tags: [...(known?.tags ?? []), 'metamolt', 'tool', 'hermes-native'],
    description,
    content: known?.content ?? description,
    sourcePath: known?.sourcePath ?? `runtime-session://metamolt-tools/${id}`,
    sourceKind: 'source-library'
  }) as UmgLibraryCandidate;
}

function runtimeDraft(slot: UmgWorkflowSlot, intent: UmgWorkflowIntent): UmgLibraryCandidate {
  return hydrateUmgLibraryCandidate({
    id: `RUNTIME.DRAFT.${slot.id.toUpperCase()}`,
    title: slot.id.replace(/_/g, ' '),
    blockType: 'molt',
    role: slot.acceptedRoles[0] === 'metaTool' ? 'meta' : slot.acceptedRoles[0],
    tags: ['runtime-session', 'draft', ...slot.searchTerms],
    description: `Runtime-session draft for ${slot.id} in ${intent.workflowType}.`,
    content: `Runtime-session draft for ${slot.id} in ${intent.workflowType}.`,
    sourcePath: `runtime-session://workflow-slots/${slot.id}`,
    sourceKind: 'source-library'
  }) as UmgLibraryCandidate;
}

export function resolveWorkflowSlots(input: ResolveWorkflowSlotsInput): { resolvedSlots: UmgResolvedWorkflowSlot[]; rejectedCandidateIds: string[] } {
  const targeted = retrieveRoleTargetedUmgLibraryCandidates(input.prompt, { combinedLimit: 64, perRoleLimit: 10 });
  const seed = new Map<string, UmgLibraryCandidate>();
  const explicitCandidateIds = new Set((input.candidates ?? []).map((candidate) => candidate.id));
  const workspaceCandidates = (input.workspaceBlocks ?? []).map(workspaceBlockToCandidate);
  [...(input.candidates ?? []), ...targeted.candidates, ...Object.values(targeted.candidatesByRole).flat()].forEach((candidate) => {
    if (!/openclaw|langchain/i.test(haystack(candidate)) && !seed.has(candidate.id)) seed.set(candidate.id, candidate);
  });
  workspaceCandidates.forEach((candidate) => seed.set(candidate.id, candidate));
  const resolvedSlots = input.slots.map((slot): UmgResolvedWorkflowSlot => {
    const rejectedCandidateIds: string[] = [];
    for (const id of slot.preferredBlockIds) {
      const preferred = seed.get(id) ?? getBlockById(id);
      if (preferred && (!slot.acceptedBlockTypes || slot.acceptedBlockTypes.includes(preferred.blockType))) {
        return { slotId: slot.id, source: 'source-library', block: preferred, confidence: 1, reason: `preferredBlockId:${id}`, rejectedCandidateIds, slot };
      }
      rejectedCandidateIds.push(id);
    }

    const compatible = Array.from(seed.values()).filter((candidate) => {
      if (/openclaw|langchain/i.test(haystack(candidate))) { rejectedCandidateIds.push(candidate.id); return false; }
      if (slot.acceptedBlockTypes && !slot.acceptedBlockTypes.includes(candidate.blockType)) return false;
      return roleMatches(candidate, slot) && termMatches(candidate, slot);
    }).sort(compareCompatibleCandidates(slot, explicitCandidateIds));
    if (compatible[0]) {
      const winner = compatible[0];
      return {
        slotId: slot.id,
        source: winner.sourceKind === 'workspace-draft' ? 'workspace-draft' : 'source-library',
        block: winner,
        confidence: winner.sourceKind === 'workspace-draft' ? 0.82 : 0.84,
        reason: winner.sourceKind === 'workspace-draft' ? 'workspace-draft-role-title-tag-search-match' : 'role-title-tag-search-match',
        rejectedCandidateIds,
        slot
      };
    }

    if (slot.id === 'note_create_tool') return { slotId: slot.id, source: 'metamolt-tool', block: asToolCandidate('TOOL.HERMES.NOTE_CREATE.v0.1', 'umg.native.hermes.note_create'), confidence: 0.9, reason: 'metamolt-tool:block', rejectedCandidateIds, slot };
    if (slot.id === 'file_write_tool') return { slotId: slot.id, source: 'metamolt-tool', block: asToolCandidate('TOOL.HERMES.FILE_WRITE.v0.1', 'umg.native.hermes.file_write'), confidence: 0.9, reason: 'metamolt-tool:block', rejectedCandidateIds, slot };

    if (slot.fallbackDraftAllowed) return { slotId: slot.id, source: 'runtime-draft', block: runtimeDraft(slot, input.intent), confidence: 0.45, reason: 'runtime-draft-fallback-allowed', rejectedCandidateIds, slot };
    return { slotId: slot.id, source: 'missing', confidence: 0, reason: 'no-compatible-source-and-no-fallback', rejectedCandidateIds, slot };
  });
  return { resolvedSlots, rejectedCandidateIds: Array.from(new Set(resolvedSlots.flatMap((slot) => slot.rejectedCandidateIds))) };
}
