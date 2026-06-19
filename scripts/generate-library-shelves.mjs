import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const writeJson = (rel, data) => fs.writeFileSync(path.join(root, rel), `${JSON.stringify(data, null, 2)}\n`);
const uniqBy = (items, keyFn) => [...new Map(items.map((item) => [keyFn(item), item])).values()];

const importedAssets = readJson('data/imports/umg-block-library/imported-assets.json');
const blocks = readJson('data/library/normalized-blocks.json');
const normalizedSleeves = readJson('data/library/normalized-sleeves.json');
const existingReport = readJson('data/library/migration-report.json');

const neostacks = uniqBy(normalizedSleeves.flatMap((sleeve) => (sleeve.stacks ?? []).map((stack) => ({
  ...stack,
  legacy: { sourceRepo: 'UMG-Block-Library', sourcePath: `${sleeve.legacy?.sourcePath ?? sleeve.id}#${stack.id}`, original: stack }
}))), (stack) => stack.id);

const neoblocks = uniqBy(neostacks.flatMap((stack) => (stack.neoblocks ?? []).map((neoblock) => ({
  ...neoblock,
  legacy: { sourceRepo: 'UMG-Block-Library', sourcePath: `${stack.legacy?.sourcePath ?? stack.id}#${neoblock.id}`, original: neoblock }
}))), (neoblock) => neoblock.id);

const statusOf = (block) => block.presentationStatus ?? 'unknown';
const metaBlocks = blocks;
const skippedAssets = (existingReport.warnings ?? []).map((warning) => {
  const [sourcePath, ...reasonParts] = String(warning).split(': ');
  return { sourcePath, reason: reasonParts.join(': ') || 'warning' };
});
const scannedPaths = new Set(importedAssets.map((asset) => asset.sourcePath));
const skippedByPath = new Map(skippedAssets.filter((asset) => scannedPaths.has(asset.sourcePath)).map((asset) => [asset.sourcePath, asset.reason]));
const duplicateAssets = [];
const duplicateByPath = new Map(duplicateAssets.map((asset) => [asset.sourcePath, asset.reason]));
const unsupportedFromWarnings = (warnings = []) => warnings.map((warning) => /unsupported role preserved: ([a-z0-9_-]+)/i.exec(String(warning))?.[1]).find(Boolean);
const titleFromPath = (sourcePath) => (sourcePath.split('/').pop() ?? sourcePath).replace(/\.json$/i, '').replace(/[-_]+/g, ' ');
const sourcePathOf = (asset) => asset?.legacy?.sourcePath ?? asset?.sourcePath;
const firstBySourcePath = (items) => new Map(items.map((item) => [sourcePathOf(item), item]).filter(([sourcePath]) => Boolean(sourcePath)));
const blockBySourcePath = firstBySourcePath(blocks);
const neoblockBySourcePath = firstBySourcePath(neoblocks);
const neostackBySourcePath = firstBySourcePath(neostacks);
const sleeveBySourcePath = firstBySourcePath(normalizedSleeves);
const emptyOutcomeCounts = () => ({ runnable_molt: 0, meta: 0, neoblock: 0, neostack: 0, sleeve: 0, skipped: 0, duplicate: 0, unsupported: 0, reference_only: 0, warning: 0 });
const outcomeCounts = emptyOutcomeCounts();
const reasonSummary = {};
const sourceAudit = importedAssets.map((source, index) => {
  const sourcePath = source.sourcePath;
  const block = blockBySourcePath.get(sourcePath);
  const neoblock = neoblockBySourcePath.get(sourcePath);
  const neostack = neostackBySourcePath.get(sourcePath);
  const sleeve = sleeveBySourcePath.get(sourcePath);
  const duplicateReason = duplicateByPath.get(sourcePath);
  const skippedReason = skippedByPath.get(sourcePath);
  let title = titleFromPath(sourcePath);
  let detectedType = source.lane;
  let normalizedRole;
  let tags = [];
  let reason = duplicateReason ?? skippedReason;
  let outcome = duplicateReason ? 'duplicate' : skippedReason ? 'skipped' : 'skipped';
  if (!duplicateReason && skippedReason && /unsupported role/i.test(skippedReason)) outcome = 'unsupported';
  if (!duplicateReason && skippedReason && /no runnable block fields detected/i.test(skippedReason)) outcome = 'meta';
  if (!duplicateReason && block) {
    title = block.title;
    detectedType = 'molt_block';
    normalizedRole = block.role;
    tags = block.tags ?? [];
    const unsupported = unsupportedFromWarnings(block.legacy?.migrationWarnings ?? []);
    if (unsupported || statusOf(block) === 'unsupported') { outcome = 'unsupported'; reason = `unsupported role preserved: ${unsupported ?? block.role}`; }
    else if (statusOf(block) === 'reference-only' || !String(block.content ?? '').trim() || /(^|\/)(schemas?|manifests?|catalog)(\/|\.|$)/i.test(sourcePath)) { outcome = 'reference_only'; reason = 'reference-only / non-runtime source'; }
    else if (statusOf(block) === 'warning-bearing') { outcome = 'warning'; reason = (block.legacy?.migrationWarnings ?? []).join('; ') || 'missing-field/warning asset'; }
    else if (block.displayType === 'meta' || statusOf(block) === 'meta') { outcome = 'meta'; reason = (block.legacy?.migrationWarnings ?? []).join('; ') || 'Meta / non-compiler asset'; }
    else outcome = 'runnable_molt';
  } else if (!duplicateReason && neoblock) {
    title = neoblock.title; detectedType = 'neoblock'; tags = neoblock.tags ?? []; outcome = 'neoblock';
  } else if (!duplicateReason && neostack) {
    title = neostack.title; detectedType = 'neostack'; tags = neostack.tags ?? []; outcome = 'neostack';
  } else if (!duplicateReason && sleeve) {
    title = sleeve.title; detectedType = 'sleeve'; tags = sleeve.tags ?? []; outcome = 'sleeve';
  } else if (!duplicateReason && source.lane === 'sleeves' && !skippedReason) {
    detectedType = 'sleeve'; outcome = 'sleeve';
  }
  outcomeCounts[outcome] += 1;
  if (reason) reasonSummary[reason] = (reasonSummary[reason] ?? 0) + 1;
  return { id: `src_${index}_${sourcePath.replace(/[^a-z0-9]+/gi, '_')}`, title, detectedType, normalizedRole, outcome, tags, sourcePath, reason, legacySource: source.data };
});
const accountedTotal = Object.values(outcomeCounts).reduce((sum, count) => sum + count, 0);
const sourceAssetSummary = { totalScanned: importedAssets.length, accountedTotal, unaccountedCount: importedAssets.length - accountedTotal, outcomeCounts, reasonSummary };
const missingFieldsDetected = blocks.flatMap((block) => (block.legacy?.migrationWarnings ?? [])
  .filter((warning) => /defaulted|inferred|missing|no runnable/i.test(warning))
  .map((warning) => ({ id: block.id, title: block.title, sourcePath: block.legacy?.sourcePath, warning })));

const nextReport = {
  ...existingReport,
  totalSourceAssetsScanned: importedAssets.length,
  totalMoltBlocksImported: blocks.length,
  totalNeoBlocksImported: neoblocks.length,
  totalNeoStacksImported: neostacks.length,
  totalSleevesImported: normalizedSleeves.length,
  totalMetaUnmappedPreserved: metaBlocks.length,
  sourceAssetSummary,
  outcomeCounts,
  visibleOrAccountedAssets: accountedTotal,
  unaccountedCount: sourceAssetSummary.unaccountedCount,
  skippedAssets: skippedAssets.filter((asset) => scannedPaths.has(asset.sourcePath)),
  duplicateAssets,
  reasonSummary,
  unsupportedRolesPreserved: existingReport.unsupportedRoles ?? [],
  missingFieldsDetected,
  shelfCounts: {
    moltBlocks: blocks.length,
    neoBlocks: neoblocks.length,
    neoStacks: neostacks.length,
    sleeves: normalizedSleeves.length
  }
};

writeJson('data/library/neoblocks.json', neoblocks);
writeJson('data/library/neostacks.json', neostacks);
writeJson('data/library/sleeves.json', normalizedSleeves);
writeJson('data/library/source-assets.json', sourceAudit);
writeJson('data/library/migration-report.json', nextReport);
console.log(JSON.stringify({ ...nextReport.shelfCounts, sourceAudit: sourceAudit.length, unaccountedCount: sourceAssetSummary.unaccountedCount }));
