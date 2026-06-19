import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const aiInstructionLibraryPath = '/home/neomagnetar/umg-block-library/AI/MOLT-BLOCKS/instructions/library.v1.0.0.json';
const aiInstructionLibrarySourcePath = 'AI/MOLT-BLOCKS/instructions/library.v1.0.0.json';
const aiSubjectLibraryPath = '/home/neomagnetar/umg-block-library/AI/MOLT-BLOCKS/subjects/library.v1.0.0.json';
const aiSubjectLibrarySourcePath = 'AI/MOLT-BLOCKS/subjects/library.v1.0.0.json';
const aiPrimaryLibraryPath = '/home/neomagnetar/umg-block-library/AI/MOLT-BLOCKS/primary/library.v1.0.0.json';
const aiPrimaryLibrarySourcePath = 'AI/MOLT-BLOCKS/primary/library.v1.0.0.json';
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const writeJson = (rel, data) => fs.writeFileSync(path.join(root, rel), `${JSON.stringify(data, null, 2)}\n`);
const uniqBy = (items, keyFn) => [...new Map(items.map((item) => [keyFn(item), item])).values()];
const stableAIInstructionId = (entry) => String(entry.id ?? '').trim().toLowerCase().replace(/^inst\.(\d{3})$/, 'inst_$1').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const stableAISubjectId = (entry) => String(entry.id ?? '').trim().toLowerCase().replace(/^subj\.(\d{3})$/, 'subj_$1').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const stableAIPrimaryId = (entry) => String(entry.id ?? '').trim().toLowerCase().replace(/^prim\.(\d{3})$/, 'prim_$1').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const cleanTags = (tags) => Array.isArray(tags) ? [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))] : [];
const contentSummary = (content) => typeof content === 'string' ? content.trim() : content?.summary?.trim() || '';
const contentDetails = (content) => !content || typeof content === 'string' ? '' : content.details?.trim() || '';
const instructionEntrySourcePath = (entry) => `${aiInstructionLibrarySourcePath}#${entry.id}`;
const subjectEntrySourcePath = (entry) => `${aiSubjectLibrarySourcePath}#${entry.id}`;
const primaryEntrySourcePath = (entry) => `${aiPrimaryLibrarySourcePath}#${entry.id}`;
const normalizeAIInstructionEntry = (entry) => {
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
  const sourcePath = instructionEntrySourcePath(entry);
  return {
    id: stableAIInstructionId(entry),
    title: entry.name?.trim() || entry.id,
    type: 'molt_block',
    role: 'instruction',
    displayType: 'instruction',
    content: contentParts.join('\n'),
    description: summary || details || undefined,
    category: entry.category || 'general',
    tags: [...new Set(['instruction', 'molt', 'ai', 'source-ai', ...cleanTags(entry.tags)])],
    priorityOrder: 20,
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
      sourceRepo: 'UMG-Block-Library',
      sourcePath,
      parentSourcePath: aiInstructionLibrarySourcePath,
      libraryEntryId: entry.id,
      original: entry
    }
  };
};
const normalizeAISubjectEntry = (entry) => {
  const summary = contentSummary(entry.content) || entry.definition?.trim() || '';
  const details = contentDetails(entry.content);
  const action = entry.action?.trim() || '';
  const expectedOutput = entry.expected_output?.trim() || '';
  const examples = Array.isArray(entry.examples) ? entry.examples.map((example) => String(example).trim()).filter(Boolean) : [];
  const contentParts = [
    summary && `Subject: ${summary}`,
    details && `Details: ${details}`,
    examples.length > 0 && `Examples: ${examples.join(', ')}`,
    action && `Action: ${action}`,
    expectedOutput && `Expected Output: ${expectedOutput}`
  ].filter(Boolean);
  const sourcePath = subjectEntrySourcePath(entry);
  return {
    id: stableAISubjectId(entry),
    title: entry.name?.trim() || entry.id,
    type: 'molt_block',
    role: 'subject',
    displayType: 'subject',
    content: contentParts.join('\n'),
    description: summary || details || undefined,
    category: entry.category || 'general',
    tags: [...new Set(['subject', 'molt', 'ai', 'source-ai', ...cleanTags(entry.tags)])],
    priorityOrder: 30,
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
      sourceRepo: 'UMG-Block-Library',
      sourcePath,
      parentSourcePath: aiSubjectLibrarySourcePath,
      libraryEntryId: entry.id,
      original: entry
    }
  };
};
const normalizeAIPrimaryEntry = (entry) => {
  const summary = contentSummary(entry.content) || entry.essence?.trim() || '';
  const details = contentDetails(entry.content);
  const coreConcern = entry.core_concern?.trim() || '';
  const action = entry.action?.trim() || '';
  const expectedOutput = entry.expected_output?.trim() || '';
  const contentParts = [
    summary && `Primary: ${summary}`,
    coreConcern && `Core Concern: ${coreConcern}`,
    details && `Details: ${details}`,
    action && `Action: ${action}`,
    expectedOutput && `Expected Output: ${expectedOutput}`
  ].filter(Boolean);
  const sourcePath = primaryEntrySourcePath(entry);
  return {
    id: stableAIPrimaryId(entry),
    title: entry.name?.trim() || entry.id,
    type: 'molt_block',
    role: 'primary',
    displayType: 'primary',
    content: contentParts.join('\n'),
    description: summary || details || coreConcern || undefined,
    category: entry.category || 'general',
    tags: [...new Set(['primary', 'molt', 'ai', 'source-ai', ...cleanTags(entry.tags)])],
    priorityOrder: 40,
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
      sourceRepo: 'UMG-Block-Library',
      sourcePath,
      parentSourcePath: aiPrimaryLibrarySourcePath,
      libraryEntryId: entry.id,
      original: entry
    }
  };
};

const importedAssets = readJson('data/imports/umg-block-library/imported-assets.json');
const baseBlocks = readJson('data/library/normalized-blocks.json').filter((block) => block.sourceLayer !== 'HUMAN' && !String(block.legacy?.sourcePath ?? '').startsWith('HUMAN/MOLT-BLOCKS/instructions/') && String(block.legacy?.parentSourcePath ?? '') !== aiInstructionLibrarySourcePath && !String(block.legacy?.sourcePath ?? '').startsWith(`${aiInstructionLibrarySourcePath}#`) && String(block.legacy?.parentSourcePath ?? '') !== aiSubjectLibrarySourcePath && !String(block.legacy?.sourcePath ?? '').startsWith(`${aiSubjectLibrarySourcePath}#`) && String(block.legacy?.parentSourcePath ?? '') !== aiPrimaryLibrarySourcePath && !String(block.legacy?.sourcePath ?? '').startsWith(`${aiPrimaryLibrarySourcePath}#`));
const normalizedSleeves = readJson('data/library/normalized-sleeves.json');
const existingReportRaw = readJson('data/library/migration-report.json');
const { humanInstructionImport: _discardedHumanInstructionImport, ...existingReport } = existingReportRaw;
const aiInstructionLibrary = JSON.parse(fs.readFileSync(aiInstructionLibraryPath, 'utf8'));
const aiInstructionEntries = aiInstructionLibrary.entries ?? [];
const aiInstructionBlocks = aiInstructionEntries.map((entry) => normalizeAIInstructionEntry(entry));
const aiSubjectLibrary = JSON.parse(fs.readFileSync(aiSubjectLibraryPath, 'utf8'));
const aiSubjectEntries = aiSubjectLibrary.entries ?? [];
const aiSubjectBlocks = aiSubjectEntries.map((entry) => normalizeAISubjectEntry(entry));
const aiPrimaryLibrary = JSON.parse(fs.readFileSync(aiPrimaryLibraryPath, 'utf8'));
const aiPrimaryEntries = aiPrimaryLibrary.entries ?? [];
const aiPrimaryBlocks = aiPrimaryEntries.map((entry) => normalizeAIPrimaryEntry(entry));
const blocks = uniqBy([...baseBlocks, ...aiInstructionBlocks, ...aiSubjectBlocks, ...aiPrimaryBlocks], (block) => block.id);
const aiInstructionSourceAssets = aiInstructionEntries.map((entry) => ({ lane: 'AI', sourcePath: instructionEntrySourcePath(entry), data: entry }));
const aiSubjectSourceAssets = aiSubjectEntries.map((entry) => ({ lane: 'AI', sourcePath: subjectEntrySourcePath(entry), data: entry }));
const aiPrimarySourceAssets = aiPrimaryEntries.map((entry) => ({ lane: 'AI', sourcePath: primaryEntrySourcePath(entry), data: entry }));
const allSourceAssets = uniqBy([...importedAssets, ...aiInstructionSourceAssets, ...aiSubjectSourceAssets, ...aiPrimarySourceAssets], (asset) => asset.sourcePath);

const neostacks = uniqBy(normalizedSleeves.flatMap((sleeve) => (sleeve.stacks ?? []).map((stack) => ({
  ...stack,
  legacy: { sourceRepo: 'UMG-Block-Library', sourcePath: `${sleeve.legacy?.sourcePath ?? sleeve.id}#${stack.id}`, original: stack }
}))), (stack) => stack.id);

const neoblocks = uniqBy(neostacks.flatMap((stack) => (stack.neoblocks ?? []).map((neoblock) => ({
  ...neoblock,
  legacy: { sourceRepo: 'UMG-Block-Library', sourcePath: `${stack.legacy?.sourcePath ?? stack.id}#${neoblock.id}`, original: neoblock }
}))), (neoblock) => neoblock.id);

const statusOf = (block) => block.presentationStatus ?? block.status ?? 'unknown';
const metaBlocks = blocks;
const skippedAssets = (existingReport.warnings ?? []).map((warning) => {
  const [sourcePath, ...reasonParts] = String(warning).split(': ');
  return { sourcePath, reason: reasonParts.join(': ') || 'warning' };
});
const scannedPaths = new Set(allSourceAssets.map((asset) => asset.sourcePath));
const skippedByPath = new Map(skippedAssets.filter((asset) => scannedPaths.has(asset.sourcePath)).map((asset) => [asset.sourcePath, asset.reason]));
const duplicateAssets = [];
const duplicateByPath = new Map(duplicateAssets.map((asset) => [asset.sourcePath, asset.reason]));
const unsupportedFromWarnings = (warnings = []) => warnings.map((warning) => /unsupported role preserved: ([a-z0-9_-]+)/i.exec(String(warning))?.[1]).find(Boolean);
const titleFromPath = (sourcePath) => (sourcePath.split('/').pop() ?? sourcePath).replace(/\.json$/i, '').replace(/\.md$/i, '').replace(/[-_]+/g, ' ');
const sourcePathOf = (asset) => asset?.legacy?.sourcePath ?? asset?.sourcePath;
const firstBySourcePath = (items) => new Map(items.map((item) => [sourcePathOf(item), item]).filter(([sourcePath]) => Boolean(sourcePath)));
const blockBySourcePath = firstBySourcePath(blocks);
const neoblockBySourcePath = firstBySourcePath(neoblocks);
const neostackBySourcePath = firstBySourcePath(neostacks);
const sleeveBySourcePath = firstBySourcePath(normalizedSleeves);
const emptyOutcomeCounts = () => ({ runnable_molt: 0, meta: 0, neoblock: 0, neostack: 0, sleeve: 0, skipped: 0, duplicate: 0, unsupported: 0, reference_only: 0, warning: 0 });
const outcomeCounts = emptyOutcomeCounts();
const reasonSummary = {};
const sourceAudit = allSourceAssets.map((source, index) => {
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
  } else if (!duplicateReason && !skippedReason) {
    outcome = 'meta'; reason = 'no runnable block fields detected';
  }
  outcomeCounts[outcome] += 1;
  if (reason) reasonSummary[reason] = (reasonSummary[reason] ?? 0) + 1;
  return { id: `src_${index}_${sourcePath.replace(/[^a-z0-9]+/gi, '_')}`, title, detectedType, normalizedRole, outcome, tags, sourcePath, reason, legacySource: source.data };
});
const accountedTotal = Object.values(outcomeCounts).reduce((sum, count) => sum + count, 0);
const sourceAssetSummary = { totalScanned: allSourceAssets.length, accountedTotal, unaccountedCount: allSourceAssets.length - accountedTotal, outcomeCounts, reasonSummary };
const missingFieldsDetected = blocks.flatMap((block) => (block.legacy?.migrationWarnings ?? [])
  .filter((warning) => /defaulted|inferred|missing|no runnable|weak content|fallback paragraph/i.test(warning))
  .map((warning) => ({ id: block.id, title: block.title, sourcePath: block.legacy?.sourcePath, warning })));
const warningBearingAIInstructions = aiInstructionBlocks.filter((block) => block.presentationStatus === 'warning-bearing');
const warningBearingAISubjects = aiSubjectBlocks.filter((block) => block.presentationStatus === 'warning-bearing');
const warningBearingAIPrimaries = aiPrimaryBlocks.filter((block) => block.presentationStatus === 'warning-bearing');

const nextReport = {
  ...existingReport,
  totalSourceAssetsScanned: allSourceAssets.length,
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
  aiInstructionImport: {
    sourcePath: aiInstructionLibraryPath,
    sourceAssetPath: aiInstructionLibrarySourcePath,
    authoritativeSource: true,
    sourceFormat: 'json',
    libraryName: aiInstructionLibrary.library?.name,
    declaredEntryCount: aiInstructionLibrary.library?.entry_count,
    entriesScanned: aiInstructionEntries.length,
    instructionBlocksImported: aiInstructionBlocks.length,
    skippedHumanMarkdown: true,
    warningBearingImports: warningBearingAIInstructions.length,
    parseWarnings: warningBearingAIInstructions.map((block) => ({ id: block.id, sourcePath: block.sourcePath, warnings: block.legacy?.parseWarnings ?? [] }))
  },
  aiSubjectImport: {
    sourcePath: aiSubjectLibraryPath,
    sourceAssetPath: aiSubjectLibrarySourcePath,
    authoritativeSource: true,
    sourceFormat: 'json',
    libraryName: aiSubjectLibrary.library?.name,
    declaredEntryCount: aiSubjectLibrary.library?.entry_count,
    entriesScanned: aiSubjectEntries.length,
    subjectBlocksImported: aiSubjectBlocks.length,
    skippedEntries: aiSubjectEntries.length - aiSubjectBlocks.length,
    skippedHumanMarkdown: true,
    warningBearingImports: warningBearingAISubjects.length,
    parseWarnings: warningBearingAISubjects.map((block) => ({ id: block.id, sourcePath: block.sourcePath, warnings: block.legacy?.parseWarnings ?? [] }))
  },
  aiPrimaryImport: {
    sourcePath: aiPrimaryLibraryPath,
    sourceAssetPath: aiPrimaryLibrarySourcePath,
    authoritativeSource: true,
    sourceFormat: 'json',
    libraryName: aiPrimaryLibrary.library?.name,
    declaredEntryCount: aiPrimaryLibrary.library?.entry_count,
    entriesScanned: aiPrimaryEntries.length,
    primaryBlocksImported: aiPrimaryBlocks.length,
    skippedEntries: aiPrimaryEntries.length - aiPrimaryBlocks.length,
    skippedHumanMarkdown: true,
    warningBearingImports: warningBearingAIPrimaries.length,
    parseWarnings: warningBearingAIPrimaries.map((block) => ({ id: block.id, sourcePath: block.sourcePath, warnings: block.legacy?.parseWarnings ?? [] }))
  },
  shelfCounts: {
    moltBlocks: blocks.length,
    neoBlocks: neoblocks.length,
    neoStacks: neostacks.length,
    sleeves: normalizedSleeves.length
  }
};

writeJson('data/library/normalized-blocks.json', blocks);
writeJson('data/library/neoblocks.json', neoblocks);
writeJson('data/library/neostacks.json', neostacks);
writeJson('data/library/sleeves.json', normalizedSleeves);
writeJson('data/library/source-assets.json', sourceAudit);
writeJson('data/library/migration-report.json', nextReport);
console.log(JSON.stringify({ ...nextReport.shelfCounts, sourceAudit: sourceAudit.length, unaccountedCount: sourceAssetSummary.unaccountedCount, aiInstructionsImported: aiInstructionBlocks.length, aiInstructionWarnings: warningBearingAIInstructions.length, aiSubjectsImported: aiSubjectBlocks.length, aiSubjectWarnings: warningBearingAISubjects.length, aiPrimariesImported: aiPrimaryBlocks.length, aiPrimaryWarnings: warningBearingAIPrimaries.length }));
