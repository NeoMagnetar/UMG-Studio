import type { NormalizedImportedSleeve, UMGImportReport } from './umgFileClassifier';

export function buildImportReviewWorkspace(report: UMGImportReport, candidate?: NormalizedImportedSleeve) {
  return {
    workspaceKind: 'import-review' as const,
    safeWriteTargets: ['workspace-draft', 'imported-legacy-package', 'normalized-import-glue'],
    protectedSourceLibraryWrite: false,
    packageDetected: report.packageDetection.detected,
    packageType: report.packageDetection.packageType,
    sleeveId: report.packageDetection.sleeveId ?? candidate?.id,
    title: report.packageDetection.title ?? candidate?.title,
    filesParsed: report.filesParsed,
    filesSkipped: report.filesSkipped,
    extractedCounts: report.extractedCounts,
    duplicates: report.duplicates,
    schemaIssues: report.schemaIssues,
    normalizationAdjustments: report.normalizationAdjustments,
    compileEligibility: report.compileEligibility,
    candidatePreview: candidate ? { id: candidate.id, title: candidate.title, neoStacks: candidate.neoStacks.length, neoBlocks: candidate.neoBlocks.length, moltBlocks: candidate.moltBlocks.length } : undefined
  };
}
