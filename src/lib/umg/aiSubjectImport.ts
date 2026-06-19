import { UMGBlock } from './types';

export type AISubjectLibraryEntry = {
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
  definition?: string | null;
  examples?: string[];
  action?: string | null;
  expected_output?: string | null;
  notes?: string | null;
};

export type AISubjectLibrary = {
  library?: {
    name?: string;
    version?: string;
    block_type?: string;
    category?: string;
    description?: string;
    entry_count?: number;
  };
  entries?: AISubjectLibraryEntry[];
};

const rolePriority = 30;
const sourceRepo = 'UMG-Block-Library';
export const aiSubjectLibrarySourcePath = 'AI/MOLT-BLOCKS/subjects/library.v1.0.0.json';

export function stableAISubjectId(entry: Pick<AISubjectLibraryEntry, 'id'>) {
  return String(entry.id ?? '')
    .trim()
    .toLowerCase()
    .replace(/^subj\.(\d{3})$/, 'subj_$1')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanTags(tags: unknown) {
  return Array.isArray(tags) ? [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))] : [];
}

function contentSummary(content: AISubjectLibraryEntry['content']) {
  if (typeof content === 'string') return content.trim();
  return content?.summary?.trim() || '';
}

function contentDetails(content: AISubjectLibraryEntry['content']) {
  if (!content || typeof content === 'string') return '';
  return content.details?.trim() || '';
}

export function subjectEntrySourcePath(entry: AISubjectLibraryEntry, librarySourcePath = aiSubjectLibrarySourcePath) {
  return `${librarySourcePath}#${entry.id}`;
}

export function normalizeAISubjectEntry(entry: AISubjectLibraryEntry, librarySourcePath = aiSubjectLibrarySourcePath): UMGBlock {
  const id = stableAISubjectId(entry);
  const title = entry.name?.trim() || entry.id;
  const summary = contentSummary(entry.content) || entry.definition?.trim() || '';
  const details = contentDetails(entry.content);
  const action = entry.action?.trim() || '';
  const expectedOutput = entry.expected_output?.trim() || '';
  const examples = Array.isArray(entry.examples) ? entry.examples.map((example) => String(example).trim()).filter(Boolean) : [];
  const contentParts = [
    summary && `Subject: ${summary}`,
    details && `Details: ${details}`,
    examples.length > 0 && `Examples: ${examples.join(', ')}`,
    action && `Action: ${action}`,
    expectedOutput && `Expected Output: ${expectedOutput}`
  ].filter(Boolean);
  const sourcePath = subjectEntrySourcePath(entry, librarySourcePath);
  const tags = [...new Set(['subject', 'molt', 'ai', 'source-ai', ...cleanTags(entry.tags)])];

  return {
    id,
    title,
    type: 'molt_block',
    role: 'subject',
    displayType: 'subject',
    content: contentParts.join('\n'),
    description: summary || details || undefined,
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

export function normalizeAISubjectLibrary(library: AISubjectLibrary, librarySourcePath = aiSubjectLibrarySourcePath) {
  const entries = library.entries ?? [];
  return entries.map((entry) => normalizeAISubjectEntry(entry, librarySourcePath));
}
