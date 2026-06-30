import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = process.env.UMG_BLOCK_LIBRARY_ROOT ?? '/home/neomagnetar/umg-block-library';
const outPath = path.resolve('src/lib/umg/generated/umgLibraryMetadataIndex.json');
const tsPath = path.resolve('src/lib/umg/generated/umgLibraryMetadataIndex.ts');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : value ? [String(value)] : [];
}

function wordsFrom(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(wordsFrom).join(' ');
  if (typeof value === 'object') return Object.values(value).map(wordsFrom).join(' ');
  return String(value);
}

function compactDescription(entry) {
  return wordsFrom([
    entry.description,
    entry.core_principles,
    entry.application,
    entry.action,
    entry.expected_output,
    entry.content?.summary,
    entry.content?.details,
    entry.neoblock?.description,
    entry.neostack?.description,
    entry.notes
  ]).replace(/\s+/g, ' ').trim().slice(0, 600);
}

function walk(dir) {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory() && name !== '.git') entries.push(...walk(full));
    else if (stat.isFile() && name.endsWith('.json')) entries.push(full);
  }
  return entries;
}

const candidates = [];
let filesScanned = 0;
let libraryEntryFiles = 0;
let unsupportedSchemas = 0;

function pushCandidate(candidate) {
  if (!candidate.id || !candidate.title) return;
  candidates.push({
    id: candidate.id,
    title: candidate.title,
    blockType: candidate.blockType ?? 'unknown',
    role: candidate.role,
    tags: Array.from(new Set(asArray(candidate.tags).map((tag) => tag.toLowerCase().replace(/\s+/g, '-')))).slice(0, 20),
    description: candidate.description || undefined,
    domain: candidate.domain || undefined,
    category: candidate.category || undefined,
    sourcePath: candidate.sourcePath,
    sourceKind: 'source-library',
    compatibility: Array.from(new Set(asArray(candidate.compatibility))).slice(0, 20)
  });
}

for (const filePath of walk(sourceRoot)) {
  filesScanned += 1;
  const rel = path.relative(sourceRoot, filePath).replaceAll(path.sep, '/');
  let data;
  try { data = readJson(filePath); } catch { unsupportedSchemas += 1; continue; }
  if (Array.isArray(data.entries) && data.library?.block_type) {
    libraryEntryFiles += 1;
    const role = String(data.library.block_type).toLowerCase();
    for (const entry of data.entries) {
      pushCandidate({
        id: entry.id,
        title: entry.name ?? entry.title ?? entry.id,
        blockType: 'molt',
        role,
        tags: [...asArray(entry.tags), role, entry.category, entry.subcategory, entry.domain],
        description: compactDescription(entry),
        domain: entry.domain,
        category: entry.category ?? data.library.category,
        sourcePath: `${rel}#${entry.id}`,
        compatibility: [role, entry.category, entry.subcategory, entry.domain]
      });
    }
    continue;
  }
  const identity = data.identity ?? {};
  const type = String(identity.artifact_type ?? '').toLowerCase();
  if (type === 'molt_block') {
    const role = String(identity.molt_type ?? data.molt_type ?? '').toLowerCase();
    pushCandidate({
      id: identity.artifact_id,
      title: data.metadata?.title ?? identity.artifact_id,
      blockType: 'molt',
      role,
      tags: [...asArray(data.metadata?.tags), ...asArray(data.tags), role, data.metadata?.category],
      description: compactDescription(data),
      domain: data.metadata?.domain,
      category: data.metadata?.category,
      sourcePath: rel,
      compatibility: [role, data.metadata?.category]
    });
  } else if (type === 'neoblock' || data.neoblock) {
    const nb = data.neoblock ?? {};
    pushCandidate({
      id: identity.artifact_id ?? data.id,
      title: nb.name ?? data.metadata?.title ?? data.title ?? identity.artifact_id,
      blockType: 'neoblock',
      tags: [...asArray(nb.tags), nb.category, ...(nb.composition?.molt_block_ids ?? [])],
      description: compactDescription(data),
      domain: nb.domain,
      category: nb.category,
      sourcePath: rel,
      compatibility: [...asArray(nb.composition?.molt_block_ids), ...Object.values(nb.molt_roles ?? {}).flat().map(String)]
    });
  } else if (type === 'neostack' || data.neostack || Array.isArray(data.stacks)) {
    if (Array.isArray(data.stacks)) {
      data.stacks.forEach((stack) => pushCandidate({
        id: `${data.sleeve_folder ?? rel}:${stack.id ?? stack.name}`,
        title: stack.name ?? stack.title ?? stack.id,
        blockType: 'neostack',
        tags: [data.category, data.title, ...(stack.bullet_neoblocks ?? [])],
        description: compactDescription(stack),
        domain: data.category,
        category: data.category,
        sourcePath: `${rel}#${stack.id ?? stack.name}`,
        compatibility: stack.bullet_neoblocks ?? []
      }));
    } else {
      const ns = data.neostack ?? {};
      pushCandidate({
        id: identity.artifact_id ?? data.id,
        title: ns.name ?? data.metadata?.title ?? data.title ?? identity.artifact_id,
        blockType: 'neostack',
        tags: [...asArray(ns.tags), ns.category, ...(ns.composition?.neoblock_ids ?? [])],
        description: compactDescription(data),
        domain: ns.domain,
        category: ns.category,
        sourcePath: rel,
        compatibility: [...asArray(ns.composition?.neoblock_ids)]
      });
    }
  } else if (Array.isArray(data.neoblocks)) {
    data.neoblocks.forEach((block) => pushCandidate({
      id: `${data.sleeve_folder ?? rel}:${block.id ?? block.name}`,
      title: block.name ?? block.title ?? block.id,
      blockType: 'neoblock',
      tags: [data.category, data.title],
      description: compactDescription(block),
      domain: data.category,
      category: data.category,
      sourcePath: `${rel}#${block.id ?? block.name}`,
      compatibility: []
    }));
  }
}

candidates.sort((a, b) => `${a.blockType}:${a.id}`.localeCompare(`${b.blockType}:${b.id}`));
const counts = candidates.reduce((acc, candidate) => ({ ...acc, [candidate.blockType]: (acc[candidate.blockType] ?? 0) + 1 }), {});
const metadata = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  filesScanned,
  candidateCount: candidates.length,
  counts,
  libraryEntryFiles,
  unsupportedSchemas,
  fieldsExtracted: ['id', 'title', 'blockType', 'role', 'tags', 'description', 'domain', 'category', 'sourcePath', 'sourceKind', 'compatibility']
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ info: metadata, candidates }, null, 2));
fs.writeFileSync(tsPath, `// GENERATED READ-ONLY METADATA INDEX. Source: ${sourceRoot}\n// Do not edit by hand. Regenerate with scripts/buildUmgLibraryMetadataIndex.mjs.\nimport rawIndex from './umgLibraryMetadataIndex.json';\nimport type { UmgLibraryCandidateBase } from '../umgLibraryCandidateRetrieval';\n\nconst typedIndex = rawIndex as { info: { generatedAt: string; sourceRoot: string; filesScanned: number; candidateCount: number; counts: Record<string, number>; libraryEntryFiles: number; unsupportedSchemas: number; fieldsExtracted: string[] }; candidates: UmgLibraryCandidateBase[] };\n\nexport const UMG_LIBRARY_METADATA_INDEX_INFO = typedIndex.info;\nexport const UMG_LIBRARY_METADATA_INDEX = typedIndex.candidates;\n`);
console.log(JSON.stringify(metadata, null, 2));
