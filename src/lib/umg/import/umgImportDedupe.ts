import { hashText } from './umgFileClassifier';
import type { ImportedMoltBlock, ImportedNeoBlock, ImportedNeoStack } from './umgFileClassifier';

export function normalizeKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

export function dedupeImportedBlocks(input: { neoStacks: ImportedNeoStack[]; neoBlocks: ImportedNeoBlock[]; moltBlocks: ImportedMoltBlock[] }) {
  const byId = new Map<string, ImportedMoltBlock>();
  const byTitleRoleParent = new Map<string, ImportedMoltBlock>();
  const byHash = new Map<string, ImportedMoltBlock>();
  const diagnostics = { duplicateIds: 0, duplicateTitleRoleParent: 0, duplicateContentHash: 0, merged: 0 };
  const moltBlocks: ImportedMoltBlock[] = [];
  for (const molt of input.moltBlocks) {
    const idKey = molt.id;
    const titleRoleParentKey = [normalizeKey(molt.title), molt.role, molt.parentNeoBlockId ?? 'global'].join('|');
    const hashKey = hashText(`${molt.role}|${molt.content}`);
    const existingById = byId.get(idKey);
    const existingByTitleRoleParent = byTitleRoleParent.get(titleRoleParentKey);
    const existingByHash = byHash.get(hashKey);
    const existing = existingById || existingByTitleRoleParent || existingByHash;
    if (existing) {
      diagnostics.duplicateIds += existingById ? 1 : 0;
      diagnostics.duplicateTitleRoleParent += existingByTitleRoleParent ? 1 : 0;
      diagnostics.duplicateContentHash += existingByHash ? 1 : 0;
      diagnostics.merged += 1;
      existing.references = [...(existing.references ?? []), { reusedBlockId: molt.id, sourcePath: molt.sourcePath, parentNeoBlockId: molt.parentNeoBlockId }];
      continue;
    }
    byId.set(idKey, molt); byTitleRoleParent.set(titleRoleParentKey, molt); byHash.set(hashKey, molt); moltBlocks.push(molt);
  }
  return { ...input, moltBlocks, diagnostics };
}
