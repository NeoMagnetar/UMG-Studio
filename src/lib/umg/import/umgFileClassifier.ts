export type UMGImportSourceKind =
  | 'uploaded-file'
  | 'uploaded-zip'
  | 'legacy-umg-package'
  | 'current-umg-json'
  | 'markdown-structure'
  | 'code-project'
  | 'unknown-archive';

export type UMGDisseminatedFile = {
  path: string;
  name: string;
  extension: string;
  sizeBytes: number;
  mimeGuess: string;
  kind: 'markdown' | 'text' | 'json' | 'yaml' | 'csv' | 'code' | 'image' | 'binary' | 'unknown';
  text?: string;
  json?: unknown;
  parseStatus: 'parsed' | 'skipped_binary' | 'failed';
  parseError?: string;
  hash: string;
};

export type UMGPackageDetection = {
  detected: boolean;
  packageType: 'legacy_umg_sleeve_package' | 'current_active_session_sleeve' | 'molt_block_library' | 'neoblock_library' | 'neostack_library' | 'code_project_bundle' | 'unknown';
  confidence: number;
  evidence: string[];
  sleeveId?: string;
  title?: string;
  version?: string;
};

export type UMGSchemaIssue = {
  severity: 'info' | 'warning' | 'error';
  objectKind: 'sleeve' | 'neostack' | 'neoblock' | 'molt' | 'gate' | 'tool' | 'unknown';
  objectId?: string;
  path: string;
  message: string;
  suggestedFix?: string;
  autoFixable: boolean;
};

export type UMGNormalizationAdjustment = {
  objectKind: 'sleeve' | 'neostack' | 'neoblock' | 'molt' | 'gate' | 'tool';
  objectId: string;
  field: string;
  before?: unknown;
  after: unknown;
  reason: string;
  sourceEvidence?: string;
};

export type UMGImportReport = {
  sourceKind: UMGImportSourceKind;
  filesTotal: number;
  filesParsed: number;
  filesSkipped: number;
  packageDetection: UMGPackageDetection;
  schemaIssues: UMGSchemaIssue[];
  normalizationAdjustments: UMGNormalizationAdjustment[];
  extractedCounts: { neoStacks: number; neoBlocks: number; moltBlocks: number; gates: number; tools: number };
  duplicates: { duplicateIds: number; duplicateTitleRoleParent: number; duplicateContentHash: number; merged: number };
  compileEligibility: 'yes' | 'no' | 'needs_review';
  reasonIfNotEligible?: string;
};

export type ImportedNeoStack = {
  id: string; legacyId?: string; title: string; description: string; expectedNeoBlockCount?: number; stackOrder: number; sourceKind: 'imported-legacy-package' | 'workspace-draft' | 'normalized-import-glue'; generationReason: string; nlCard: Record<string, unknown>; jsonSchema: Record<string, unknown>; neoBlockIds: string[]; tags: string[];
};

export type ImportedNeoBlock = {
  id: string; title: string; description: string; neoStackId: string; blockOrder: number; sourceKind: 'imported-legacy-package' | 'workspace-draft' | 'normalized-import-glue'; generationReason: string; gates: string[]; gateIds: string[]; capabilities: string[]; moltBlockIds: string[]; nlCard: Record<string, unknown>; jsonSchema: Record<string, unknown>; tags: string[]; defaultState: 'off' | 'on';
};

export type ImportedMoltBlock = {
  id: string; sourceId?: string; title: string; role: 'primary' | 'directive' | 'instruction' | 'subject' | 'philosophy' | 'blueprint' | 'meta'; content: string; description: string; tags: string[]; sourceKind: 'imported-legacy-package' | 'workspace-draft' | 'normalized-import-glue'; generationReason: string; parentNeoBlockId?: string; parentNeoStackId?: string; stackOrder?: number; sourcePath?: string; nlCard: Record<string, unknown>; jsonSchema: Record<string, unknown>; blockType: 'molt'; references?: Array<{ reusedBlockId?: string; sourcePath?: string; parentNeoBlockId?: string }>; defaultState: 'off' | 'on';
};

export type NormalizedImportedSleeve = {
  id: string; title: string; version: string; description: string; isTemplate: true; templateKind: 'custom' | 'developer'; source: 'session'; tags: string[]; neoStacks: ImportedNeoStack[]; neoBlocks: ImportedNeoBlock[]; moltBlocks: ImportedMoltBlock[]; gates: unknown[]; governanceBlockIds: string[]; defaultExecutionMode: 'dryRun' | 'approvalRequired' | 'liveAllowed'; metadata: Record<string, unknown>;
};

export function basename(filePath: string) { return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath; }
export function extname(filePath: string) { const base = basename(filePath); const idx = base.lastIndexOf('.'); return idx >= 0 ? base.slice(idx).toLowerCase() : ''; }

export function classifyFilePath(path: string): UMGDisseminatedFile['kind'] {
  const lower = path.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.txt')) return 'text';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.csv')) return 'csv';
  if (/\.(ts|tsx|js|jsx|py|cs|java|cpp|c|h|hpp|go|rs|rb|php|mjs|cjs)$/i.test(lower)) return 'code';
  if (/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(lower)) return 'image';
  if (/\.(zip|pdf|exe|dll|so|dylib|bin|dat|mp3|mp4|mov|wav|ttf|woff2?)$/i.test(lower)) return 'binary';
  return 'unknown';
}

export function guessMime(path: string, kind: UMGDisseminatedFile['kind']) {
  if (kind === 'json') return 'application/json';
  if (kind === 'markdown') return 'text/markdown';
  if (kind === 'yaml') return 'application/yaml';
  if (kind === 'csv') return 'text/csv';
  if (kind === 'code' || kind === 'text') return 'text/plain';
  if (kind === 'image') return `image/${extname(path).slice(1) || 'unknown'}`;
  return 'application/octet-stream';
}

export function textLikeKind(kind: UMGDisseminatedFile['kind']) { return ['markdown','text','json','yaml','csv','code','unknown'].includes(kind); }

export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function hashBytes(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (const byte of bytes) { h ^= byte; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function parseTextLikeFile(path: string, text: string, sizeBytes = text.length, hash = hashText(text)): UMGDisseminatedFile {
  const kind = classifyFilePath(path);
  const file: UMGDisseminatedFile = { path, name: basename(path), extension: extname(path), sizeBytes, mimeGuess: guessMime(path, kind), kind, text, parseStatus: 'parsed', hash };
  if (kind === 'json') {
    try { file.json = JSON.parse(text); } catch (error) { file.parseStatus = 'failed'; file.parseError = error instanceof Error ? error.message : String(error); }
  }
  return file;
}
