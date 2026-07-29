import { strToU8, zipSync } from 'fflate';
import type { NormalizedTemplateSleeve } from './templateSleeveStructures';

export const UMG_WORKSPACE_SLEEVES_STORAGE_KEY = 'umg.workspace.sleeves.v1';

export type WorkspaceSleeveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type ActiveSleevePersistenceStatus = {
  runtimeSessionOnly: boolean;
  savedToWorkspace: boolean;
  exportAvailable: boolean;
  sourceLibraryState: 'read-only, unchanged';
};

export type ActiveSleeveExportPackage = {
  filename: string;
  entries: Record<string, unknown>;
  zipBytes: Uint8Array;
  counts: {
    neoStacks: number;
    neoBlocks: number;
    moltBlocks: number;
    gates: number;
    capabilities: number;
    missingOptionalTools: number;
  };
};

function resolveStorage(storage?: WorkspaceSleeveStorage): WorkspaceSleeveStorage | undefined {
  if (storage) return storage;
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function safeJsonValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null) return null;
  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return value;
  if (valueType === 'bigint') return String(value);
  if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => safeJsonValue(entry, seen)).filter((entry) => entry !== undefined);
  if (value && valueType === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const safeEntry = safeJsonValue(entry, seen);
      if (safeEntry !== undefined) output[key] = safeEntry;
    }
    seen.delete(value);
    return output;
  }
  return undefined;
}

function safeJsonClone<T>(value: T): T {
  return safeJsonValue(value) as T;
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? safeJsonClone(value) as T[] : [];
}

function safeMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? safeJsonClone(value as Record<string, unknown>) : {};
}

export function normalizeActiveSleeveForPersistence(sleeve: NormalizedTemplateSleeve): NormalizedTemplateSleeve {
  const safeSleeve = safeJsonClone(sleeve) as Partial<NormalizedTemplateSleeve>;
  return {
    ...safeSleeve,
    id: String(safeSleeve.id || 'active_session_sleeve'),
    title: String(safeSleeve.title || 'Active Sleeve'),
    version: String(safeSleeve.version || '1.0.0'),
    description: String(safeSleeve.description || ''),
    tags: safeArray<string>(safeSleeve.tags),
    neoStacks: safeArray(safeSleeve.neoStacks),
    neoBlocks: safeArray(safeSleeve.neoBlocks),
    moltBlocks: safeArray(safeSleeve.moltBlocks),
    gates: safeArray(safeSleeve.gates),
    governanceBlockIds: safeArray<string>(safeSleeve.governanceBlockIds),
    metadata: {
      ...safeMetadata(safeSleeve.metadata),
      capabilities: getActiveSleeveCapabilities(safeSleeve as NormalizedTemplateSleeve),
      missingOptionalTools: getActiveSleeveMissingOptionalTools(safeSleeve as NormalizedTemplateSleeve),
      protectedSourceLibraryWrite: false,
      sourceLibraryWrite: false,
      sourceLibrarySaved: false
    }
  } as NormalizedTemplateSleeve;
}

function isSleeveLike(entry: unknown): entry is NormalizedTemplateSleeve {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as Partial<NormalizedTemplateSleeve>;
  return Boolean(candidate.id && candidate.title && Array.isArray(candidate.neoStacks) && Array.isArray(candidate.neoBlocks) && Array.isArray(candidate.moltBlocks) && Array.isArray(candidate.gates));
}

function readSleeves(storage?: WorkspaceSleeveStorage): NormalizedTemplateSleeve[] {
  const resolved = resolveStorage(storage);
  if (!resolved) return [];
  try {
    const raw = resolved.getItem(UMG_WORKSPACE_SLEEVES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSleeveLike).map((sleeve) => ({
      ...normalizeActiveSleeveForPersistence(sleeve),
      metadata: {
        ...(sleeve.metadata ?? {}),
        workspaceSaved: true,
        protectedSourceLibraryWrite: false,
        sourceLibraryWrite: false
      }
    }));
  } catch {
    return [];
  }
}

function writeSleeves(sleeves: NormalizedTemplateSleeve[], storage?: WorkspaceSleeveStorage) {
  const resolved = resolveStorage(storage);
  if (!resolved) return false;
  try {
    resolved.setItem(UMG_WORKSPACE_SLEEVES_STORAGE_KEY, JSON.stringify(sleeves.map(normalizeActiveSleeveForPersistence), null, 2));
    return true;
  } catch {
    return false;
  }
}

export function listWorkspaceSleeves(storage?: WorkspaceSleeveStorage): NormalizedTemplateSleeve[] {
  return readSleeves(storage);
}

export function getWorkspaceSleeveById(id: string, storage?: WorkspaceSleeveStorage): NormalizedTemplateSleeve | undefined {
  return readSleeves(storage).find((sleeve) => sleeve.id === id);
}

export function isActiveSleeveSavedToWorkspace(sleeve: NormalizedTemplateSleeve | undefined, storage?: WorkspaceSleeveStorage) {
  if (!sleeve) return false;
  return Boolean(getWorkspaceSleeveById(sleeve.id, storage));
}

export function deriveActiveSleevePersistenceStatus(sleeve: NormalizedTemplateSleeve | undefined, storage?: WorkspaceSleeveStorage): ActiveSleevePersistenceStatus {
  const savedToWorkspace = isActiveSleeveSavedToWorkspace(sleeve, storage);
  return {
    runtimeSessionOnly: Boolean(sleeve && !savedToWorkspace),
    savedToWorkspace,
    exportAvailable: Boolean(sleeve),
    sourceLibraryState: 'read-only, unchanged'
  };
}

export function saveActiveSleeveToWorkspace(sleeve: NormalizedTemplateSleeve, storage?: WorkspaceSleeveStorage) {
  try {
    const current = readSleeves(storage);
    const persistedSleeve = normalizeActiveSleeveForPersistence(sleeve);
    const savedSleeve: NormalizedTemplateSleeve = {
      ...persistedSleeve,
      metadata: {
        ...(persistedSleeve.metadata ?? {}),
        workspaceSaved: true,
        workspaceSavedAt: new Date().toISOString(),
        workspacePersistence: 'localStorage',
        protectedSourceLibraryWrite: false,
        sourceLibraryWrite: false,
        sourceLibrarySaved: false
      }
    };
    const existingIndex = current.findIndex((entry) => entry.id === savedSleeve.id);
    const next = existingIndex >= 0 ? current.map((entry, index) => index === existingIndex ? savedSleeve : entry) : [savedSleeve, ...current];
    if (!writeSleeves(next, storage)) {
      return { ok: false as const, saved: false, sourceLibraryWrite: false, error: 'localStorage write failed or storage is unavailable', count: current.length };
    }
    return { ok: true as const, saved: true, sourceLibraryWrite: false, sleeve: savedSleeve, count: next.length };
  } catch (error) {
    return { ok: false as const, saved: false, sourceLibraryWrite: false, error: error instanceof Error ? error.message : String(error), count: 0 };
  }
}

function safeSlug(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'ACTIVE_SLEEVE';
}

export function getActiveSleeveCapabilities(sleeve: NormalizedTemplateSleeve): unknown[] {
  const metadataCapabilities = (sleeve.metadata as Record<string, unknown> | undefined)?.capabilities;
  if (Array.isArray(metadataCapabilities)) return safeArray(metadataCapabilities);
  const blockCapabilities = safeArray<Record<string, unknown>>(sleeve.neoBlocks).flatMap((block) => {
    const values = block.capabilities ?? block.capabilityIds;
    return Array.isArray(values) ? values : [];
  });
  return safeJsonClone(blockCapabilities);
}

export function getActiveSleeveMissingOptionalTools(sleeve: NormalizedTemplateSleeve): unknown[] {
  const metadata = sleeve.metadata as Record<string, unknown> | undefined;
  const direct = metadata?.missingOptionalTools ?? metadata?.missing_optional_tools;
  if (Array.isArray(direct)) return safeArray(direct);
  return safeArray<Record<string, unknown>>(sleeve.moltBlocks).filter((block) => block.sourceKind === 'metamolt tool' || String(block.id ?? '').startsWith('TOOL.'));
}

export function buildActiveSleeveExportPackage(sleeve: NormalizedTemplateSleeve): ActiveSleeveExportPackage {
  const persistedSleeve = normalizeActiveSleeveForPersistence(sleeve);
  const capabilities = getActiveSleeveCapabilities(persistedSleeve);
  const missingOptionalTools = getActiveSleeveMissingOptionalTools(persistedSleeve);
  const now = new Date().toISOString();
  const filename = `${safeSlug(persistedSleeve.title)}_v${String(persistedSleeve.version || '1').replace(/[^A-Za-z0-9._-]+/g, '_')}_UMG_STUDIO_EXPORT.zip`;
  const manifest = {
    packageFormat: 'UMG_STUDIO_READY_EXPORT',
    packageType: 'current_active_session_sleeve',
    exportedAt: now,
    entrypoint: 'sleeve/active_session_sleeve.json',
    title: persistedSleeve.title,
    sleeveId: persistedSleeve.id,
    version: persistedSleeve.version,
    sourceLibraryWrite: false,
    protectedSourceLibraryWrite: false,
    contents: [
      'UMG_PACKAGE_MANIFEST.json',
      'HERMES_IMPORT_BRIEF.md',
      'VALIDATION_REPORT.json',
      'sleeve/active_session_sleeve.json',
      'sleeve/normalized_sleeve_candidate.json',
      'library/neostacks.json',
      'library/neoblocks.json',
      'library/molt_blocks.json',
      'library/gates.json',
      'library/capabilities.json',
      'library/missing_optional_tools.json'
    ]
  };
  const counts = {
    neoStacks: persistedSleeve.neoStacks.length,
    neoBlocks: persistedSleeve.neoBlocks.length,
    moltBlocks: persistedSleeve.moltBlocks.length,
    gates: persistedSleeve.gates.length,
    capabilities: capabilities.length,
    missingOptionalTools: missingOptionalTools.length
  };
  const validationReport = {
    ok: true,
    noFakeExportSuccess: true,
    sourceLibraryWrite: false,
    protectedSourceLibraryWrite: false,
    counts,
    generationRoute: persistedSleeve.metadata?.generationRoute,
    metadata: persistedSleeve.metadata
  };
  const importBrief = `# ${persistedSleeve.title}\n\nExported by UMG Studio from the active runtime/session Sleeve.\n\n- Source library write: false\n- Protected source library write: false\n- NeoStacks: ${counts.neoStacks}\n- NeoBlocks: ${counts.neoBlocks}\n- MOLT Blocks: ${counts.moltBlocks}\n- Gates: ${counts.gates}\n- Capabilities: ${counts.capabilities}\n- Missing optional tools: ${counts.missingOptionalTools}\n`;
  const activeSessionSleeve = {
    ...persistedSleeve,
    metadata: {
      ...(persistedSleeve.metadata ?? {}),
      exportedFromActiveSession: true,
      exportedAt: now,
      sourceLibraryWrite: false,
      protectedSourceLibraryWrite: false,
      capabilities,
      missingOptionalTools
    }
  };
  const entries: Record<string, unknown> = {
    'UMG_PACKAGE_MANIFEST.json': manifest,
    'HERMES_IMPORT_BRIEF.md': importBrief,
    'VALIDATION_REPORT.json': validationReport,
    'sleeve/active_session_sleeve.json': activeSessionSleeve,
    'sleeve/normalized_sleeve_candidate.json': activeSessionSleeve,
    'library/neostacks.json': persistedSleeve.neoStacks,
    'library/neoblocks.json': persistedSleeve.neoBlocks,
    'library/molt_blocks.json': persistedSleeve.moltBlocks,
    'library/gates.json': persistedSleeve.gates,
    'library/capabilities.json': capabilities,
    'library/missing_optional_tools.json': missingOptionalTools
  };
  const zipEntries = Object.fromEntries(Object.entries(entries).map(([path, value]) => [path, strToU8(typeof value === 'string' ? value : JSON.stringify(value, null, 2))]));
  return { filename, entries, zipBytes: zipSync(zipEntries), counts };
}
