import { UMGBlock } from './types';

export type AIPrimaryLibraryEntry = {
  id: string;
  type?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  domain?: string;
  status?: string;
  version?: string;
  tags?: string[];
  source?: unknown;
  content?: {
    summary?: string | null;
    details?: string | null;
    structure?: unknown;
  } | string | null;
  essence?: string | null;
  core_concern?: string | null;
  action?: string | null;
  expected_output?: string | null;
  notes?: string | null;
};

export type AIPrimaryLibrary = {
  library?: {
    name?: string;
    version?: string;
    block_type?: string;
    category?: string;
    description?: string;
    entry_count?: number;
  };
  entries?: AIPrimaryLibraryEntry[];
};

const rolePriority = 40;
const sourceRepo = 'UMG-Block-Library';
export const aiPrimaryLibrarySourcePath = 'AI/MOLT-BLOCKS/primary/library.v1.0.0.json';

export function stableAIPrimaryId(entry: Pick<AIPrimaryLibraryEntry, 'id'>) {
  return String(entry.id ?? '')
    .trim()
    .toLowerCase()
    .replace(/^prim\.(\d{3})$/, 'prim_$1')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanTags(tags: unknown) {
  return Array.isArray(tags) ? [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))] : [];
}

function contentSummary(content: AIPrimaryLibraryEntry['content']) {
  if (typeof content === 'string') return content.trim();
  return content?.summary?.trim() || '';
}

function contentDetails(content: AIPrimaryLibraryEntry['content']) {
  if (!content || typeof content === 'string') return '';
  return content.details?.trim() || '';
}

export function primaryEntrySourcePath(entry: AIPrimaryLibraryEntry, librarySourcePath = aiPrimaryLibrarySourcePath) {
  return `${librarySourcePath}#${entry.id}`;
}

export function normalizeAIPrimaryEntry(entry: AIPrimaryLibraryEntry, librarySourcePath = aiPrimaryLibrarySourcePath): UMGBlock {
  const id = stableAIPrimaryId(entry);
  const title = entry.name?.trim() || entry.id;
  const summary = contentSummary(entry.content) || entry.essence?.trim() || '';
  const details = contentDetails(entry.content);
  const coreConcern = entry.core_concern?.trim() || '';
  const action = entry.action?.trim() || '';
  const expectedOutput = entry.expected_output?.trim() || '';
  const contentParts = [
    summary && `Primary: ${summary}`,
    coreConcern && `Core Concern: ${coreConcern}`,
    details && `Details: ${details}`,
    action && `Action: ${action}`,
    expectedOutput && `Expected Output: ${expectedOutput}`
  ].filter(Boolean);
  const sourcePath = primaryEntrySourcePath(entry, librarySourcePath);
  const tags = [...new Set(['primary', 'molt', 'ai', 'source-ai', ...cleanTags(entry.tags)])];

  return {
    id,
    title,
    type: 'molt_block',
    role: 'primary',
    displayType: 'primary',
    content: contentParts.join('\n'),
    description: summary || details || coreConcern || undefined,
    category: entry.category || 'general',
    tags,
    priorityOrder: rolePriority,
    hierarchy: { orderIndex: rolePriority, orderSource: 'priorityOrder', priorityMeaning: 'hierarchy_order' },
    defaultState: 'on',
    visibility: 'visible',
    activation: { mode: 'always' },
    action: action || undefined,
    expectedOutput: expectedOutput || undefined,
    sourcePath,
    sourceLayer: 'AI',
    status: 'runnable',
    presentationStatus: 'runnable',
    source: { origin: 'imported', sourceId: sourcePath, version: entry.version || '1.0.0' },
    legacy: {
      sourceRepo,
      sourcePath,
      original: entry,
      parentSourcePath: librarySourcePath,
      libraryEntryId: entry.id
    }
  };
}

export function normalizeAIPrimaryLibrary(library: AIPrimaryLibrary, librarySourcePath = aiPrimaryLibrarySourcePath) {
  const entries = library.entries ?? [];
  return entries.map((entry) => normalizeAIPrimaryEntry(entry, librarySourcePath));
}
