#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';

const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
const outIndex = args.indexOf('--out');
const input = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
const out = outIndex >= 0 ? args[outIndex + 1] : '.umg-import/latest';

if (!input) {
  console.error('Missing --input');
  process.exit(1);
}

fs.mkdirSync(out, { recursive: true });
const bytes = fs.readFileSync(input);
const files = [];

function hash(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function basename(filePath) { return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath; }
function extname(filePath) { return path.extname(filePath).toLowerCase(); }
function classify(filePath) {
  const lower = filePath.toLowerCase();
  if (/\.md|\.markdown$/.test(lower)) return 'markdown';
  if (lower.endsWith('.txt')) return 'text';
  if (lower.endsWith('.json')) return 'json';
  if (/\.(yaml|yml)$/.test(lower)) return 'yaml';
  if (lower.endsWith('.csv')) return 'csv';
  if (/\.(cs|ts|tsx|js|jsx|py|java|cpp|c|h|go|rs|mjs|cjs)$/.test(lower)) return 'code';
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/.test(lower)) return 'image';
  if (/\.(zip|pdf|exe|dll|bin|mp3|mp4|mov|wav)$/.test(lower)) return 'binary';
  return 'unknown';
}
function parseTextFile(entryPath, text, sizeBytes, rawHash) {
  const kind = classify(entryPath);
  const file = { path: entryPath, name: basename(entryPath), extension: extname(entryPath), kind, sizeBytes, mimeGuess: kind === 'json' ? 'application/json' : 'text/plain', hash: rawHash, text, parseStatus: 'parsed' };
  if (kind === 'json') {
    try { file.json = JSON.parse(text); } catch (error) { file.parseStatus = 'failed'; file.parseError = error.message; }
  }
  return file;
}
function textLike(kind) { return ['markdown','text','json','yaml','csv','code','unknown'].includes(kind); }

if (input.toLowerCase().endsWith('.zip')) {
  const entries = unzipSync(new Uint8Array(bytes));
  for (const [entryPath, data] of Object.entries(entries)) {
    if (entryPath.endsWith('/')) continue;
    const kind = classify(entryPath);
    const rawHash = hash(Buffer.from(data));
    if (!textLike(kind) || kind === 'binary' || kind === 'image') {
      files.push({ path: entryPath, name: basename(entryPath), extension: extname(entryPath), kind, sizeBytes: data.length, mimeGuess: 'application/octet-stream', hash: rawHash, parseStatus: 'skipped_binary' });
      continue;
    }
    try { files.push(parseTextFile(entryPath, strFromU8(data), data.length, rawHash)); }
    catch (error) { files.push({ path: entryPath, name: basename(entryPath), extension: extname(entryPath), kind, sizeBytes: data.length, mimeGuess: 'text/plain', hash: rawHash, parseStatus: 'failed', parseError: error.message }); }
  }
} else {
  const kind = classify(input);
  if (!textLike(kind) || kind === 'binary' || kind === 'image') files.push({ path: basename(input), name: basename(input), extension: extname(input), kind, sizeBytes: bytes.length, mimeGuess: 'application/octet-stream', hash: hash(bytes), parseStatus: 'skipped_binary' });
  else files.push(parseTextFile(basename(input), fs.readFileSync(input, 'utf8'), bytes.length, hash(bytes)));
}

const allText = files.map((f) => f.text || '').join('\n');
function countMatches(text, regex) { return [...text.matchAll(regex)].length; }
function extractSleeveId(text) { return text.match(/Sleeve ID\s*[:=-]\s*`?([A-Za-z0-9_.:-]+)/i)?.[1]?.replace(/`$/, '') || text.match(/\b(SLV\.[A-Za-z0-9_.:-]+)/i)?.[1]; }
function extractTitle() { return files.map((f) => f.text?.match(/^#\s+(.+)$/m)?.[1]).find(Boolean) || files.find((f) => /sleeve/i.test(f.name))?.name; }
function extractVersion(text) { return text.match(/(?:version|v)\s*[:=-]?\s*`?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i)?.[1]; }

const evidence = [];
const lowerPaths = files.map((f) => f.path.toLowerCase());
if (lowerPaths.some((p) => p.includes('complete') && p.includes('sleeve') && p.endsWith('.md'))) evidence.push('complete sleeve structure markdown found');
if (lowerPaths.some((p) => p.includes('system-prompt'))) evidence.push('system prompt file found');
if (lowerPaths.some((p) => p.includes('openclaw-config.json'))) evidence.push('openclaw config found');
if (/sleeve id\s*:/i.test(allText)) evidence.push('Sleeve ID marker found');
if (/neostacks?/i.test(allText)) evidence.push('NeoStack marker found');
if (/neoblocks?/i.test(allText)) evidence.push('NeoBlock marker found');
if (/\bmolt\b|\b(PRIM|DIR|INST|SUBJ|PHIL|BP)\.UO\./i.test(allText)) evidence.push('MOLT marker found');

const detection = evidence.length >= 4 ? { detected: true, packageType: 'legacy_umg_sleeve_package', confidence: Math.min(0.95, evidence.length / 7), evidence, sleeveId: extractSleeveId(allText), title: extractTitle(), version: extractVersion(allText) } : { detected: false, packageType: 'unknown', confidence: 0, evidence };
const structure = files.find((f) => /complete.*sleeve.*structure.*\.md/i.test(f.path)) || files.find((f) => f.kind === 'markdown' && /Sleeve ID|NeoStacks?|NeoBlocks?/i.test(f.text || ''));
const neoStackCount = countMatches(allText, /^###\s+S\.\d+/gim);
const neoBlockCount = countMatches(allText, /^\s*[-*+]\s+/gim);
const explicitMoltCount = countMatches(allText, /\b(PRIM|DIR|INST|SUBJ|PHIL|BP)\.UO\.\d+/gim);
const syntheticGlueCount = detection.detected ? neoBlockCount * 3 : 0;
const normalizedCandidate = detection.detected ? {
  id: detection.sleeveId || 'imported.legacy.sleeve',
  title: detection.title || 'Imported Legacy UMG Sleeve',
  version: detection.version || '1.0.0',
  source: 'session',
  metadata: {
    generationRoute: 'imported_legacy_sleeve_package',
    importedPackage: true,
    liveHermesGenerated: false,
    generatedByHermes: false,
    compileEligible: true,
    sourceKind: 'imported-legacy-package',
    importWorkspace: 'workspace-draft',
    protectedSourceLibraryWrite: false,
    sourceFiles: files.map((f) => f.path)
  },
  previewCounts: { neoStacks: neoStackCount, neoBlocks: neoBlockCount, explicitMoltBlocks: explicitMoltCount, synthesizedGlueMolts: syntheticGlueCount }
} : undefined;
const schemaIssues = detection.detected ? [] : [{ severity: 'warning', objectKind: 'unknown', path: 'package', message: 'No UMG package schema detected.', autoFixable: false }];
const adjustments = detection.detected ? [
  { objectKind: 'sleeve', objectId: normalizedCandidate.id, field: 'source', after: 'session', reason: 'Imported package remains workspace draft.' },
  { objectKind: 'sleeve', objectId: normalizedCandidate.id, field: 'metadata.protectedSourceLibraryWrite', after: false, reason: 'Protected source library is never mutated by importer.' },
  { objectKind: 'molt', objectId: 'normalized-import-glue', field: 'sourceKind', after: 'normalized-import-glue', reason: 'Missing NeoBlock child MOLT fields may be synthesized for review.' }
] : [];
const report = {
  sourceKind: input.toLowerCase().endsWith('.zip') ? 'uploaded-zip' : 'uploaded-file',
  filesTotal: files.length,
  filesParsed: files.filter((f) => f.parseStatus === 'parsed').length,
  filesSkipped: files.filter((f) => f.parseStatus !== 'parsed').length,
  packageDetection: detection,
  schemaIssues,
  normalizationAdjustments: adjustments,
  extractedCounts: { neoStacks: neoStackCount, neoBlocks: neoBlockCount, moltBlocks: explicitMoltCount + syntheticGlueCount, gates: countMatches(allText, /\bgate\b/gim), tools: countMatches(allText, /\btool\b/gim) },
  duplicates: { duplicateIds: 0, duplicateTitleRoleParent: 0, duplicateContentHash: 0, merged: 0 },
  compileEligibility: detection.detected ? 'yes' : 'no',
  reasonIfNotEligible: detection.detected ? undefined : 'No UMG package detected.'
};

fs.writeFileSync(path.join(out, 'file-inventory.json'), JSON.stringify(files.map(({ text, json, ...rest }) => rest), null, 2));
fs.writeFileSync(path.join(out, 'import-report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(out, 'schema-adjustments.json'), JSON.stringify({ schemaIssues, normalizationAdjustments: adjustments }, null, 2));
if (normalizedCandidate) fs.writeFileSync(path.join(out, 'normalized-sleeve-candidate.json'), JSON.stringify(normalizedCandidate, null, 2));
fs.writeFileSync(path.join(out, 'hermes-import-brief.json'), JSON.stringify({ instruction: 'Reason over this extracted evidence only. Do not invent parsed files or source-library IDs.', packageDetection: report.packageDetection, extractedCounts: report.extractedCounts, schemaIssues: schemaIssues.slice(0, 30), normalizationAdjustments: adjustments.slice(0, 30), normalizedCandidatePreview: normalizedCandidate, fileSummaries: files.filter((f) => f.text).map((f) => ({ path: f.path, kind: f.kind, chars: f.text.length, preview: f.text.slice(0, 1200) })).slice(0, 20) }, null, 2));
console.log(JSON.stringify(report, null, 2));
