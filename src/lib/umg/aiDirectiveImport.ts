import { UMGBlock } from './types';

export type AIDirectiveLibraryEntry = {
  id: string;
  type?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  scope?: string | null;
  status?: string;
  version?: string;
  tags?: string[];
  source?: unknown;
  content?: {
    summary?: string | null;
    details?: string | null;
    structure?: unknown;
  } | string | null;
  constraints?: string[] | string | null;
  action?: string | null;
  expected_output?: string | null;
  notes?: string | null;
};

export type AIDirectiveLibrary = {
  library?: {
    name?: string;
    version?: string;
    block_type?: string;
    category?: string;
    description?: string;
    entry_count?: number;
  };
  entries?: AIDirectiveLibraryEntry[];
};

const rolePriority = 10;
const sourceRepo = 'UMG-Block-Library';
export const aiDirectiveLibrarySourcePath = 'AI/MOLT-BLOCKS/directives/library.v1.0.0.json';

export function stableAIDirectiveId(entry: Pick<AIDirectiveLibraryEntry, 'id'>) {
  return String(entry.id ?? '')
    .trim()
    .toLowerCase()
    .replace(/^dir\.(\d{3})$/, 'dir_$1')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanTags(tags: unknown) {
  return Array.isArray(tags) ? [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))] : [];
}

function contentSummary(content: AIDirectiveLibraryEntry['content']) {
  if (typeof content === 'string') return content.trim();
  return content?.summary?.trim() || '';
}

function contentDetails(content: AIDirectiveLibraryEntry['content']) {
  if (!content || typeof content === 'string') return '';
  return content.details?.trim() || '';
}

function constraintText(constraints: AIDirectiveLibraryEntry['constraints']) {
  if (Array.isArray(constraints)) return constraints.map((constraint) => String(constraint).trim()).filter(Boolean).join('; ');
  return constraints?.trim() || '';
}

export function directiveEntrySourcePath(entry: AIDirectiveLibraryEntry, librarySourcePath = aiDirectiveLibrarySourcePath) {
  return `${librarySourcePath}#${entry.id}`;
}

export function normalizeAIDirectiveEntry(entry: AIDirectiveLibraryEntry, librarySourcePath = aiDirectiveLibrarySourcePath): UMGBlock {
  const id = stableAIDirectiveId(entry);
  const title = entry.name?.trim() || entry.id;
  const summary = contentSummary(entry.content);
  const details = contentDetails(entry.content);
  const scope = entry.scope?.trim() || '';
  const constraints = constraintText(entry.constraints);
  const action = entry.action?.trim() || '';
  const expectedOutput = entry.expected_output?.trim() || '';
  const contentParts = [
    summary && `Directive: ${summary}`,
    scope && `Scope: ${scope}`,
    details && `Details: ${details}`,
    constraints && `Constraints: ${constraints}`,
    action && `Action: ${action}`,
    expectedOutput && `Expected Output: ${expectedOutput}`
  ].filter(Boolean);
  const sourcePath = directiveEntrySourcePath(entry, librarySourcePath);
  const tags = [...new Set(['directive', 'molt', 'ai', 'source-ai', ...cleanTags(entry.tags)])];

  return {
    id,
    title,
    type: 'molt_block',
    role: 'directive',
    displayType: 'directive',
    content: contentParts.join('\n'),
    description: summary || details || scope || undefined,
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

export function normalizeAIDirectiveLibrary(library: AIDirectiveLibrary, librarySourcePath = aiDirectiveLibrarySourcePath) {
  const entries = library.entries ?? [];
  return entries.map((entry) => normalizeAIDirectiveEntry(entry, librarySourcePath));
}
