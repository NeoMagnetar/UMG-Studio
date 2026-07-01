import type { NormalizedImportedSleeve, UMGDisseminatedFile, UMGImportReport } from './umgFileClassifier';

export function buildHermesImportBrief(report: UMGImportReport, files: UMGDisseminatedFile[], candidate?: NormalizedImportedSleeve) {
  return {
    instruction: 'Use this extracted evidence to reason about semantic block roles. Do not claim parsing success beyond this report. Do not invent source-library IDs.',
    packageDetection: report.packageDetection,
    extractedCounts: report.extractedCounts,
    schemaIssues: report.schemaIssues.slice(0, 30),
    normalizationAdjustments: report.normalizationAdjustments.slice(0, 30),
    normalizedCandidatePreview: candidate ? { sleeveId: candidate.id, title: candidate.title, neoStacks: candidate.neoStacks.length, neoBlocks: candidate.neoBlocks.length, moltBlocks: candidate.moltBlocks.length, sourceLibraryWrite: false } : undefined,
    fileSummaries: files.filter((f) => f.text).map((f) => ({ path: f.path, kind: f.kind, chars: f.text?.length ?? 0, preview: f.text?.slice(0, 800) })).slice(0, 20)
  };
}
