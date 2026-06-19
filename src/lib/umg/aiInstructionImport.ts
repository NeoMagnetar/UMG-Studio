import { UMGBlock } from './types';

export type AIInstructionLibraryEntry = {
  id: string;
  type?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  status?: string;
  version?: string;
  tags?: string[];
  source?: unknown;
  content?: {
    summary?: string | null;
    details?: string | null;
    structure?: unknown;
  } | string | null;
  action?: string | null;
  expected_output?: string | null;
  notes?: string | null;
};

export type AIInstructionLibrary = {
  library?: {
    name?: string;
    version?: string;
    block_type?: string;
    category?: string;
    description?: string;
    entry_count?: number;
  };
  entries?: AIInstructionLibraryEntry[];
};

const rolePriority = 20;
const sourceRepo = 'UMG-Block-Library';
export const aiInstructionLibrarySourcePath = 'AI/MOLT-BLOCKS/instructions/library.v1.0.0.json';

export function stableAIInstructionId(entry: Pick<AIInstructionLibraryEntry, 'id'>) {
  return String(entry.id ?? '')
    .trim()
    .toLowerCase()
    .replace(/^inst\.(\d{3})$/, 'inst_$1')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanTags(tags: unknown) {
  return Array.isArray(tags) ? [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))] : [];
}

function contentSummary(content: AIInstructionLibraryEntry['content']) {
  if (typeof content === 'string') return content.trim();
  return content?.summary?.trim() || '';
}

function contentDetails(content: AIInstructionLibraryEntry['content']) {
  if (!content || typeof content === 'string') return '';
  return content.details?.trim() || '';
}

export function instructionEntrySourcePath(entry: AIInstructionLibraryEntry, librarySourcePath = aiInstructionLibrarySourcePath) {
  return `${librarySourcePath}#${entry.id}`;
}

export function normalizeAIInstructionEntry(entry: AIInstructionLibraryEntry, librarySourcePath = aiInstructionLibrarySourcePath): UMGBlock {
  const id = stableAIInstructionId(entry);
  const title = entry.name?.trim() || entry.id;
  const summary = contentSummary(entry.content);
  const details = contentDetails(entry.content);
  const action = entry.action?.trim() || '';
  const expectedOutput = entry.expected_output?.trim() || '';
  const contentParts = [
    action && `Action: ${action}`,
    expectedOutput && `Expected Output: ${expectedOutput}`,
    details && `Details: ${details}`,
    !action && !expectedOutput && summary && `Summary: ${summary}`
  ].filter(Boolean);
  const sourcePath = instructionEntrySourcePath(entry, librarySourcePath);
  const tags = [...new Set(['instruction', 'molt', 'ai', 'source-ai', ...cleanTags(entry.tags)])];

  return {
    id,
    title,
    type: 'molt_block',
    role: 'instruction',
    displayType: 'instruction',
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

export function normalizeAIInstructionLibrary(library: AIInstructionLibrary, librarySourcePath = aiInstructionLibrarySourcePath) {
  const entries = library.entries ?? [];
  return entries.map((entry) => normalizeAIInstructionEntry(entry, librarySourcePath));
}
