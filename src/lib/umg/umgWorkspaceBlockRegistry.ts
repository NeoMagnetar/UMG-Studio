import { UMGCreatedMoltBlock, validateCreatedMoltBlock } from './umgBlockAuthoring';

export const UMG_WORKSPACE_BLOCKS_STORAGE_KEY = 'umg.workspace.blocks.v1';

type WorkspaceBlockStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function resolveStorage(storage?: WorkspaceBlockStorage): WorkspaceBlockStorage | undefined {
  if (storage) return storage;
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function readBlocks(storage?: WorkspaceBlockStorage): UMGCreatedMoltBlock[] {
  const resolved = resolveStorage(storage);
  if (!resolved) return [];
  try {
    const raw = resolved.getItem(UMG_WORKSPACE_BLOCKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => validateCreatedMoltBlock(entry).passed);
  } catch {
    return [];
  }
}

function writeBlocks(blocks: UMGCreatedMoltBlock[], storage?: WorkspaceBlockStorage) {
  const resolved = resolveStorage(storage);
  if (!resolved) return false;
  resolved.setItem(UMG_WORKSPACE_BLOCKS_STORAGE_KEY, JSON.stringify(blocks));
  return true;
}

export function listWorkspaceBlocks(storage?: WorkspaceBlockStorage): UMGCreatedMoltBlock[] {
  return readBlocks(storage);
}

export function saveWorkspaceBlock(block: UMGCreatedMoltBlock, storage?: WorkspaceBlockStorage) {
  const validation = validateCreatedMoltBlock(block);
  if (!validation.passed) return validation;
  const current = readBlocks(storage);
  const existingIndex = current.findIndex((entry) => entry.id === block.id);
  const nextBlock = { ...block, sourceKind: 'workspace-draft' as const, updatedAt: new Date().toISOString(), status: 'validated' as const };
  const next = existingIndex >= 0 ? current.map((entry, index) => index === existingIndex ? nextBlock : entry) : [...current, nextBlock];
  if (!writeBlocks(next, storage)) {
    return { passed: false, errors: ['localStorage is unavailable'], warnings: validation.warnings };
  }
  return validation;
}

export function getWorkspaceBlockById(id: string, storage?: WorkspaceBlockStorage): UMGCreatedMoltBlock | undefined {
  return readBlocks(storage).find((block) => block.id === id);
}

export function deleteWorkspaceBlock(id: string, storage?: WorkspaceBlockStorage): boolean {
  const current = readBlocks(storage);
  const next = current.filter((block) => block.id !== id);
  if (next.length === current.length) return false;
  return writeBlocks(next, storage);
}

export function searchWorkspaceBlocks(query: string, storage?: WorkspaceBlockStorage): UMGCreatedMoltBlock[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const blocks = readBlocks(storage);
  if (!terms.length) return blocks;
  return blocks.filter((block) => {
    const haystack = [block.id, block.title, block.role, block.category, block.description, block.content, block.generationReason, ...block.tags].join(' ').toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
