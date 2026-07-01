import { analyzeSchemaProximity } from './umgSchemaProximity';
import { dedupeImportedBlocks } from './umgImportDedupe';
import { createMinimalMoltChildrenForNeoBlock, extractSleeveId, extractSystemPromptMolts, extractTitle, extractVersion, parseGovernanceMolts, parseLegacyNeoBlocks, parseLegacyNeoStacks } from './umgUniversalBlockExtractor';
import type { NormalizedImportedSleeve, UMGDisseminatedFile, UMGImportReport, UMGNormalizationAdjustment } from './umgFileClassifier';

export function findFile(files: UMGDisseminatedFile[], pattern: RegExp) { return files.find((file) => pattern.test(file.path)); }

export function normalizeImportedSleeve(args: { sleeveId: string; title: string; version?: string; neoStacks: NormalizedImportedSleeve['neoStacks']; neoBlocks: NormalizedImportedSleeve['neoBlocks']; moltBlocks: NormalizedImportedSleeve['moltBlocks']; sourceFiles: string[]; duplicates?: { duplicateIds: number; duplicateTitleRoleParent: number; duplicateContentHash: number; merged: number } }) {
  const sleeve: NormalizedImportedSleeve = {
    id: args.sleeveId,
    title: args.title,
    version: args.version ?? '1.0.0',
    description: `Imported legacy UMG Sleeve package ${args.title}.`,
    isTemplate: true,
    templateKind: /developer|server|c#|uo|ultima/i.test(args.title) ? 'developer' : 'custom',
    source: 'session',
    tags: ['imported','legacy','workspace-draft'],
    neoStacks: args.neoStacks,
    neoBlocks: args.neoBlocks,
    moltBlocks: args.moltBlocks,
    gates: [],
    governanceBlockIds: args.moltBlocks.filter((m) => m.role === 'primary').map((m) => m.id),
    defaultExecutionMode: 'dryRun',
    metadata: {
      generationRoute: 'imported_legacy_sleeve_package',
      importedPackage: true,
      liveHermesGenerated: false,
      generatedByHermes: false,
      compileEligible: true,
      mode: 'runtime_session_draft',
      sourceKind: 'imported-legacy-package',
      sourceFiles: args.sourceFiles,
      protectedSourceLibraryWrite: false,
      sourceLibraryBacked: false,
      sourceLibraryMatches: 'not resolved yet / optional',
      importWorkspace: 'workspace-draft',
      duplicateDiagnostics: args.duplicates
    }
  };
  return sleeve;
}

export function importLegacySleevePackage(files: UMGDisseminatedFile[]) {
  const structure = findFile(files, /complete.*sleeve.*structure.*\.md/i) ?? findFile(files, /sleeve.*structure.*\.md/i) ?? files.find((file) => file.kind === 'markdown' && /Sleeve ID|NeoStacks?|NeoBlocks?/i.test(file.text ?? ''));
  const systemPrompt = findFile(files, /system-prompt\.txt/i) ?? findFile(files, /system.*prompt/i);
  const config = findFile(files, /openclaw-config\.json/i);
  if (!structure?.text) return { ok: false as const, error: 'COMPLETE sleeve structure file not found.' };
  const sleeveId = extractSleeveId(structure.text) ?? 'imported.legacy.sleeve';
  const neoStacks = parseLegacyNeoStacks(structure.text, sleeveId);
  const neoBlocks = parseLegacyNeoBlocks(structure.text, neoStacks);
  const governanceMolts = parseGovernanceMolts(structure.text, sleeveId);
  const systemPromptMolts = systemPrompt?.text ? extractSystemPromptMolts(systemPrompt.text, sleeveId) : [];
  const glueMolts = neoBlocks.flatMap((block) => createMinimalMoltChildrenForNeoBlock(block));
  for (const block of neoBlocks) block.moltBlockIds = glueMolts.filter((m) => m.parentNeoBlockId === block.id).map((m) => m.id);
  const deduped = dedupeImportedBlocks({ neoStacks, neoBlocks, moltBlocks: [...governanceMolts, ...systemPromptMolts, ...glueMolts] });
  const sleeve = normalizeImportedSleeve({ sleeveId, title: extractTitle(structure.text) || 'Imported Legacy UMG Sleeve', version: extractVersion(structure.text), neoStacks: deduped.neoStacks, neoBlocks: deduped.neoBlocks, moltBlocks: deduped.moltBlocks, sourceFiles: files.map((f) => f.path), duplicates: deduped.diagnostics });
  const proximity = analyzeSchemaProximity(sleeve);
  const adjustments: UMGNormalizationAdjustment[] = [
    { objectKind: 'sleeve', objectId: sleeve.id, field: 'source', after: 'session', reason: 'Imported packages remain runtime-session/workspace draft until user promotes blocks.' },
    { objectKind: 'sleeve', objectId: sleeve.id, field: 'metadata.protectedSourceLibraryWrite', after: false, reason: 'Critical import rule: do not mutate protected source library.' },
    ...sleeve.neoStacks.map((stack) => ({ objectKind: 'neostack' as const, objectId: stack.id, field: 'sourceKind', after: 'imported-legacy-package', reason: 'Normalized from legacy markdown heading.', sourceEvidence: stack.legacyId })),
    ...glueMolts.map((molt) => ({ objectKind: 'molt' as const, objectId: molt.id, field: 'sourceKind', after: 'normalized-import-glue', reason: molt.generationReason, sourceEvidence: molt.parentNeoBlockId }))
  ];
  return { ok: true as const, sleeve, report: buildImportReport(files, sleeve, proximity.issues, adjustments, deduped.diagnostics), configJson: config?.json };
}

export function buildImportReport(files: UMGDisseminatedFile[], sleeve: NormalizedImportedSleeve | undefined, schemaIssues: UMGImportReport['schemaIssues'], adjustments: UMGImportReport['normalizationAdjustments'], duplicates: UMGImportReport['duplicates']): UMGImportReport {
  return {
    sourceKind: 'legacy-umg-package',
    filesTotal: files.length,
    filesParsed: files.filter((f) => f.parseStatus === 'parsed').length,
    filesSkipped: files.filter((f) => f.parseStatus !== 'parsed').length,
    packageDetection: { detected: true, packageType: 'legacy_umg_sleeve_package', confidence: 0.85, evidence: ['Legacy importer completed.'], sleeveId: sleeve?.id, title: sleeve?.title, version: sleeve?.version },
    schemaIssues,
    normalizationAdjustments: adjustments,
    extractedCounts: { neoStacks: sleeve?.neoStacks.length ?? 0, neoBlocks: sleeve?.neoBlocks.length ?? 0, moltBlocks: sleeve?.moltBlocks.length ?? 0, gates: 0, tools: 0 },
    duplicates,
    compileEligibility: schemaIssues.some((issue) => issue.severity === 'error' && !issue.autoFixable) ? 'needs_review' : 'yes',
    reasonIfNotEligible: schemaIssues.some((issue) => issue.severity === 'error' && !issue.autoFixable) ? 'Non-auto-fixable schema issue remains.' : undefined
  };
}
