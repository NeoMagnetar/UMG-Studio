import { UMGBlock } from './types';

export type AIPhilosophyLibraryEntry = {
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
  core_principles?: string | null;
  application?: string | null;
  key_values?: string[] | string | null;
  action?: string | null;
  expected_output?: string | null;
  notes?: string | null;
};

export type AIPhilosophyLibrary = {
  library?: {
    name?: string;
    version?: string;
    block_type?: string;
    category?: string;
    description?: string;
    entry_count?: number;
  };
  entries?: AIPhilosophyLibraryEntry[];
};

const rolePriority = 50;
const sourceRepo = 'UMG-Block-Library';
export const aiPhilosophyLibrarySourcePath = 'AI/MOLT-BLOCKS/philosophy/library.v1.0.0.json';

export function stableAIPhilosophyId(entry: Pick<AIPhilosophyLibraryEntry, 'id'>) {
  return String(entry.id ?? '')
    .trim()
    .toLowerCase()
    .replace(/^phil\.(\d{3})$/, 'phil_$1')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanTags(tags: unknown) {
  return Array.isArray(tags) ? [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))] : [];
}

function contentSummary(content: AIPhilosophyLibraryEntry['content']) {
  if (typeof content === 'string') return content.trim();
  return content?.summary?.trim() || '';
}

function contentDetails(content: AIPhilosophyLibraryEntry['content']) {
  if (!content || typeof content === 'string') return '';
  return content.details?.trim() || '';
}

function listText(value: AIPhilosophyLibraryEntry['key_values']) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join('; ');
  return value?.trim() || '';
}

export function philosophyEntrySourcePath(entry: AIPhilosophyLibraryEntry, librarySourcePath = aiPhilosophyLibrarySourcePath) {
  return `${librarySourcePath}#${entry.id}`;
}

export function normalizeAIPhilosophyEntry(entry: AIPhilosophyLibraryEntry, librarySourcePath = aiPhilosophyLibrarySourcePath): UMGBlock {
  const id = stableAIPhilosophyId(entry);
  const title = entry.name?.trim() || entry.id;
  const summary = contentSummary(entry.content) || entry.core_principles?.trim() || '';
  const details = contentDetails(entry.content);
  const application = entry.application?.trim() || '';
  const keyValues = listText(entry.key_values);
  const action = entry.action?.trim() || '';
  const expectedOutput = entry.expected_output?.trim() || '';
  const contentParts = [
    summary && `Philosophy: ${summary}`,
    details && `Details: ${details}`,
    application && `Application: ${application}`,
    keyValues && `Key Values: ${keyValues}`,
    action && `Action: ${action}`,
    expectedOutput && `Expected Output: ${expectedOutput}`
  ].filter(Boolean);
  const sourcePath = philosophyEntrySourcePath(entry, librarySourcePath);
  const tags = [...new Set(['philosophy', 'molt', 'ai', 'source-ai', ...cleanTags(entry.tags)])];

  return {
    id,
    title,
    type: 'molt_block',
    role: 'philosophy',
    displayType: 'philosophy',
    content: contentParts.join('\n'),
    description: summary || details || application || undefined,
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

export function normalizeAIPhilosophyLibrary(library: AIPhilosophyLibrary, librarySourcePath = aiPhilosophyLibrarySourcePath) {
  const entries = library.entries ?? [];
  return entries.map((entry) => normalizeAIPhilosophyEntry(entry, librarySourcePath));
}
