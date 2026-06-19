import { UMGBlock } from './types';

export type AIBlueprintLibraryEntry = {
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
  structure?: string | null;
  conventions?: string | null;
  output_characteristics?: string | null;
  action?: string | null;
  expected_output?: string | null;
  notes?: string | null;
};

export type AIBlueprintLibrary = {
  library?: {
    name?: string;
    version?: string;
    block_type?: string;
    category?: string;
    description?: string;
    entry_count?: number;
  };
  entries?: AIBlueprintLibraryEntry[];
};

const rolePriority = 60;
const sourceRepo = 'UMG-Block-Library';
export const aiBlueprintLibrarySourcePath = 'AI/MOLT-BLOCKS/blueprints/library.v1.0.0.json';

export function stableAIBlueprintId(entry: Pick<AIBlueprintLibraryEntry, 'id'>) {
  return String(entry.id ?? '')
    .trim()
    .toLowerCase()
    .replace(/^bp\.(\d{3})$/, 'bp_$1')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanTags(tags: unknown) {
  return Array.isArray(tags) ? [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))] : [];
}

function contentSummary(content: AIBlueprintLibraryEntry['content']) {
  if (typeof content === 'string') return content.trim();
  return content?.summary?.trim() || '';
}

function contentDetails(content: AIBlueprintLibraryEntry['content']) {
  if (!content || typeof content === 'string') return '';
  return content.details?.trim() || '';
}

export function blueprintEntrySourcePath(entry: AIBlueprintLibraryEntry, librarySourcePath = aiBlueprintLibrarySourcePath) {
  return `${librarySourcePath}#${entry.id}`;
}

export function normalizeAIBlueprintEntry(entry: AIBlueprintLibraryEntry, librarySourcePath = aiBlueprintLibrarySourcePath): UMGBlock {
  const id = stableAIBlueprintId(entry);
  const title = entry.name?.trim() || entry.id;
  const summary = contentSummary(entry.content) || entry.structure?.trim() || '';
  const details = contentDetails(entry.content);
  const structure = entry.structure?.trim() || '';
  const conventions = entry.conventions?.trim() || '';
  const outputCharacteristics = entry.output_characteristics?.trim() || '';
  const action = entry.action?.trim() || '';
  const expectedOutput = entry.expected_output?.trim() || '';
  const contentParts = [
    summary && `Blueprint: ${summary}`,
    details && `Details: ${details}`,
    structure && structure !== summary && `Structure: ${structure}`,
    conventions && `Conventions: ${conventions}`,
    outputCharacteristics && `Output Characteristics: ${outputCharacteristics}`,
    action && `Action: ${action}`,
    expectedOutput && `Expected Output: ${expectedOutput}`
  ].filter(Boolean);
  const sourcePath = blueprintEntrySourcePath(entry, librarySourcePath);
  const tags = [...new Set(['blueprint', 'molt', 'ai', 'source-ai', ...cleanTags(entry.tags)])];

  return {
    id,
    title,
    type: 'molt_block',
    role: 'blueprint',
    displayType: 'blueprint',
    content: contentParts.join('\n'),
    description: summary || details || structure || undefined,
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

export function normalizeAIBlueprintLibrary(library: AIBlueprintLibrary, librarySourcePath = aiBlueprintLibrarySourcePath) {
  const entries = library.entries ?? [];
  return entries.map((entry) => normalizeAIBlueprintEntry(entry, librarySourcePath));
}
