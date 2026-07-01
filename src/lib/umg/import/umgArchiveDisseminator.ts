import { strFromU8, unzipSync } from 'fflate';
import { analyzeSchemaProximity } from './umgSchemaProximity';
import { importLegacySleevePackage } from './umgLegacySleevePackageImporter';
import { basename, classifyFilePath, extname, guessMime, hashBytes, parseTextLikeFile, textLikeKind } from './umgFileClassifier';
import type { NormalizedImportedSleeve, UMGDisseminatedFile, UMGImportReport, UMGImportSourceKind, UMGPackageDetection } from './umgFileClassifier';

export function extractSleeveIdFromText(text: string) { return text.match(/Sleeve ID\s*[:=-]\s*`?([A-Za-z0-9_.:-]+)/i)?.[1]?.replace(/`$/, '') ?? text.match(/\b(SLV\.[A-Za-z0-9_.:-]+)/i)?.[1]; }
export function extractVersionFromText(text: string) { return text.match(/(?:version|v)\s*[:=-]?\s*`?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i)?.[1]; }
export function extractLikelyTitle(files: UMGDisseminatedFile[]) { return files.map((f) => f.text?.match(/^#\s+(.+)$/m)?.[1]).find(Boolean) ?? files.find((f) => /sleeve/i.test(f.name))?.name; }

export function detectUmgPackage(files: UMGDisseminatedFile[]): UMGPackageDetection {
  const paths = files.map((f) => f.path.toLowerCase());
  const allText = files.map((f) => f.text ?? '').join('\n');
  const lowerText = allText.toLowerCase();
  const evidence: string[] = [];
  if (paths.some((p) => p.includes('complete') && p.includes('sleeve') && p.endsWith('.md'))) evidence.push('complete sleeve structure markdown found');
  if (paths.some((p) => p.includes('system-prompt'))) evidence.push('system prompt file found');
  if (paths.some((p) => p.includes('openclaw-config.json'))) evidence.push('openclaw config found');
  if (/sleeve id\s*:/i.test(allText)) evidence.push('Sleeve ID marker found');
  if (/neostacks?/i.test(allText)) evidence.push('NeoStack marker found');
  if (/neoblocks?/i.test(allText)) evidence.push('NeoBlock marker found');
  if (/\bmolt\b|\b(PRIM|DIR|INST|SUBJ|PHIL|BP)\.UO\./i.test(allText)) evidence.push('MOLT marker found');
  const jsonObjects = files.map((f) => f.json).filter(Boolean) as Record<string, unknown>[];
  if (jsonObjects.some((j) => Array.isArray(j.neoStacks) && Array.isArray(j.neoBlocks) && Array.isArray(j.moltBlocks))) return { detected: true, packageType: 'current_active_session_sleeve', confidence: 0.95, evidence: [...evidence, 'current active-session sleeve JSON arrays found'], sleeveId: extractSleeveIdFromText(allText), title: extractLikelyTitle(files), version: extractVersionFromText(allText) };
  if (jsonObjects.some((j) => Array.isArray(j.moltBlocks) || Array.isArray(j.blocks))) return { detected: true, packageType: 'molt_block_library', confidence: 0.72, evidence: [...evidence, 'MOLT/library JSON arrays found'] };
  if (jsonObjects.some((j) => Array.isArray(j.neoBlocks))) return { detected: true, packageType: 'neoblock_library', confidence: 0.72, evidence: [...evidence, 'NeoBlock JSON array found'] };
  if (jsonObjects.some((j) => Array.isArray(j.neoStacks))) return { detected: true, packageType: 'neostack_library', confidence: 0.72, evidence: [...evidence, 'NeoStack JSON array found'] };
  const legacyScore = evidence.length / 7;
  if (legacyScore >= 0.5 || (/uo|servuo|modernuo|ultima online|c#/i.test(allText) && evidence.length >= 3)) return { detected: true, packageType: 'legacy_umg_sleeve_package', confidence: Math.max(0.55, Math.min(0.95, legacyScore)), evidence, sleeveId: extractSleeveIdFromText(allText), title: extractLikelyTitle(files), version: extractVersionFromText(allText) };
  const codeFiles = files.filter((f) => f.kind === 'code').length;
  if (codeFiles >= Math.max(3, files.length / 2)) return { detected: true, packageType: 'code_project_bundle', confidence: 0.65, evidence: [`${codeFiles} code files found`] };
  return { detected: false, packageType: 'unknown', confidence: 0, evidence };
}

export async function disseminateUploadedFile(file: File): Promise<{ files: UMGDisseminatedFile[]; report: UMGImportReport; normalizedSleeveCandidate?: NormalizedImportedSleeve }> {
  try {
    if (file.name.toLowerCase().endsWith('.zip')) return disseminateZip(file);
    return disseminateSingleFile(file);
  } catch (error) {
    return buildSafeFailedDisseminationResult(file, error, file.name.toLowerCase().endsWith('.zip') ? 'uploaded-zip' : 'uploaded-file');
  }
}

export async function disseminateZip(file: File): Promise<{ files: UMGDisseminatedFile[]; report: UMGImportReport; normalizedSleeveCandidate?: NormalizedImportedSleeve }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (error) {
    return buildSafeFailedDisseminationResult(file, error, 'uploaded-zip', bytes);
  }
  const files: UMGDisseminatedFile[] = [];
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith('/')) continue;
    const kind = classifyFilePath(path);
    if (!textLikeKind(kind) || kind === 'binary' || kind === 'image') {
      files.push({ path, name: basename(path), extension: extname(path), sizeBytes: data.length, mimeGuess: guessMime(path, kind), kind, parseStatus: 'skipped_binary', hash: hashBytes(data) });
      continue;
    }
    try { files.push(parseTextLikeFile(path, strFromU8(data), data.length, hashBytes(data))); }
    catch (error) { files.push({ path, name: basename(path), extension: extname(path), sizeBytes: data.length, mimeGuess: guessMime(path, kind), kind, parseStatus: 'failed', parseError: error instanceof Error ? error.message : String(error), hash: hashBytes(data) }); }
  }
  return buildDisseminationResult(files, 'uploaded-zip');
}

export async function disseminateSingleFile(file: File): Promise<{ files: UMGDisseminatedFile[]; report: UMGImportReport; normalizedSleeveCandidate?: NormalizedImportedSleeve }> {
  const kind = classifyFilePath(file.name);
  if (!textLikeKind(kind) || kind === 'binary' || kind === 'image') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return buildDisseminationResult([{ path: file.name, name: basename(file.name), extension: extname(file.name), sizeBytes: file.size, mimeGuess: file.type || guessMime(file.name, kind), kind, parseStatus: 'skipped_binary', hash: hashBytes(bytes) }], 'uploaded-file');
  }
  const text = await file.text();
  return buildDisseminationResult([parseTextLikeFile(file.name, text, file.size)], 'uploaded-file');
}

export function buildSafeFailedDisseminationResult(file: File, error: unknown, sourceKind: UMGImportSourceKind, bytes?: Uint8Array): { files: UMGDisseminatedFile[]; report: UMGImportReport } {
  const kind = classifyFilePath(file.name);
  const message = error instanceof Error ? error.message : String(error);
  const failedFile: UMGDisseminatedFile = {
    path: file.name,
    name: basename(file.name),
    extension: extname(file.name),
    sizeBytes: file.size,
    mimeGuess: file.type || guessMime(file.name, kind),
    kind,
    parseStatus: 'failed',
    parseError: message,
    hash: bytes ? hashBytes(bytes) : hashBytes(new Uint8Array())
  };
  return {
    files: [failedFile],
    report: baseReport(
      [failedFile],
      sourceKind,
      { detected: false, packageType: 'unknown', confidence: 0, evidence: [`Import failed safely: ${message}`] },
      [{ severity: 'error', objectKind: 'unknown', path: file.name, message: `Import failed safely: ${message}`, suggestedFix: 'Upload a valid zip/text/JSON/markdown/code file or review the archive structure.', autoFixable: false }],
      [],
      undefined,
      message
    )
  };
}

export function buildDisseminationResult(files: UMGDisseminatedFile[], sourceKind: UMGImportSourceKind): { files: UMGDisseminatedFile[]; report: UMGImportReport; normalizedSleeveCandidate?: NormalizedImportedSleeve } {
  const detection = detectUmgPackage(files);
  if (detection.packageType === 'legacy_umg_sleeve_package') {
    const imported = importLegacySleevePackage(files);
    if (imported.ok) return { files, report: { ...imported.report, sourceKind, packageDetection: { ...imported.report.packageDetection, ...detection } }, normalizedSleeveCandidate: imported.sleeve };
    return { files, report: baseReport(files, sourceKind, detection, [], [], undefined, imported.error) };
  }
  const proximity = analyzeSchemaProximity(files.find((f) => f.json)?.json ?? {});
  return { files, report: baseReport(files, sourceKind, detection, proximity.issues, proximity.adjustments) };
}

export function baseReport(files: UMGDisseminatedFile[], sourceKind: UMGImportSourceKind, detection: UMGPackageDetection, schemaIssues: UMGImportReport['schemaIssues'] = [], adjustments: UMGImportReport['normalizationAdjustments'] = [], duplicates?: UMGImportReport['duplicates'], reason?: string): UMGImportReport {
  const text = files.map((f) => f.text ?? '').join('\n');
  return { sourceKind, filesTotal: files.length, filesParsed: files.filter((f) => f.parseStatus === 'parsed').length, filesSkipped: files.filter((f) => f.parseStatus !== 'parsed').length, packageDetection: detection, schemaIssues, normalizationAdjustments: adjustments, extractedCounts: { neoStacks: [...text.matchAll(/^###\s+S\.\d+/gim)].length, neoBlocks: [...text.matchAll(/^\s*[-*+]\s+/gim)].length, moltBlocks: [...text.matchAll(/\b(PRIM|DIR|INST|SUBJ|PHIL|BP)\.UO\.\d+/gim)].length, gates: [...text.matchAll(/\bgate\b/gim)].length, tools: [...text.matchAll(/\btool\b/gim)].length }, duplicates: duplicates ?? { duplicateIds: 0, duplicateTitleRoleParent: 0, duplicateContentHash: 0, merged: 0 }, compileEligibility: detection.detected && !reason ? 'needs_review' : 'no', reasonIfNotEligible: reason ?? (detection.detected ? 'Detected package requires importer/review before compile.' : 'No supported UMG package detected.') };
}
