import { analyzeSchemaProximity } from './umgSchemaProximity';
import { dedupeImportedBlocks } from './umgImportDedupe';
import { createMinimalMoltChildrenForNeoBlock, extractSleeveId, extractSystemPromptMolts, extractTitle, extractVersion, parseGovernanceMolts, parseLegacyNeoBlocks, parseLegacyNeoStacks } from './umgUniversalBlockExtractor';
import type { NormalizedImportedSleeve, UMGDisseminatedFile, UMGImportReport, UMGNormalizationAdjustment } from './umgFileClassifier';

export function findFile(files: UMGDisseminatedFile[], pattern: RegExp) { return files.find((file) => pattern.test(file.path)); }


function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.map(String).filter(Boolean) : []; }
function asNumber(value: unknown, fallback: number) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function normalizeSourceKind(value: unknown, fallback: 'imported-legacy-package' | 'workspace-draft' | 'normalized-import-glue' = 'workspace-draft') {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('legacy')) return 'imported-legacy-package' as const;
  if (raw.includes('glue')) return 'normalized-import-glue' as const;
  return fallback;
}
function normalizeMoltRole(value: unknown): NormalizedImportedSleeve['moltBlocks'][number]['role'] {
  const raw = String(value ?? '').toLowerCase();
  return ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint', 'meta'].includes(raw) ? raw as NormalizedImportedSleeve['moltBlocks'][number]['role'] : 'instruction';
}

export function findCurrentActiveSessionSleeveEntrypoint(files: UMGDisseminatedFile[]) {
  return files.find((file) => {
    const normalized = file.path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').toLowerCase();
    return normalized === 'sleeve/active_session_sleeve.json' || normalized.endsWith('/sleeve/active_session_sleeve.json');
  });
}

export function importCurrentActiveSessionSleevePackage(files: UMGDisseminatedFile[]) {
  const entry = findCurrentActiveSessionSleeveEntrypoint(files);
  const rawSleeve = asRecord(entry?.json ?? files.find((file) => {
    const json = asRecord(file.json);
    return Array.isArray(json.neoStacks) && Array.isArray(json.neoBlocks) && Array.isArray(json.moltBlocks);
  })?.json);
  if (!Object.keys(rawSleeve).length) return { ok: false as const, error: 'active_session_sleeve.json entrypoint not found or not parseable.' };
  const sleeveId = String(rawSleeve.id ?? rawSleeve.sleeveId ?? 'SLV.IMPORTED.CURRENT_ACTIVE_SESSION.v1.0.0');
  const title = String(rawSleeve.title ?? rawSleeve.name ?? 'Imported Active Session Sleeve');
  const neoStacks = (Array.isArray(rawSleeve.neoStacks) ? rawSleeve.neoStacks : []).map((value, index) => {
    const stack = asRecord(value);
    return {
      id: String(stack.id ?? `IMPORTED.STACK.${index + 1}`),
      legacyId: typeof stack.legacyId === 'string' ? stack.legacyId : undefined,
      title: String(stack.title ?? stack.name ?? `Imported Stack ${index + 1}`),
      description: String(stack.description ?? stack.purpose ?? stack.summary ?? `Imported active-session stack ${index + 1}.`),
      expectedNeoBlockCount: Array.isArray(stack.neoBlockIds) ? stack.neoBlockIds.length : undefined,
      stackOrder: asNumber(stack.stackOrder ?? stack.order, index + 1),
      sourceKind: normalizeSourceKind(stack.sourceKind),
      generationReason: String(stack.generationReason ?? 'Imported from current active-session Sleeve package.'),
      nlCard: asRecord(stack.nlCard),
      jsonSchema: asRecord(stack.jsonSchema),
      neoBlockIds: stringArray(stack.neoBlockIds),
      tags: stringArray(stack.tags).length ? stringArray(stack.tags) : ['imported', 'current-active-session']
    };
  });
  const stackIdSet = new Set(neoStacks.map((stack) => stack.id));
  const neoBlocks = (Array.isArray(rawSleeve.neoBlocks) ? rawSleeve.neoBlocks : []).map((value, index) => {
    const block = asRecord(value);
    const parentStack = String(block.neoStackId ?? block.parentNeoStackId ?? block.stackId ?? neoStacks[0]?.id ?? `IMPORTED.STACK.1`);
    return {
      id: String(block.id ?? `IMPORTED.NEOBLOCK.${index + 1}`),
      title: String(block.title ?? block.name ?? `Imported NeoBlock ${index + 1}`),
      description: String(block.description ?? block.purpose ?? block.summary ?? `Imported active-session NeoBlock ${index + 1}.`),
      neoStackId: stackIdSet.has(parentStack) ? parentStack : neoStacks[0]?.id ?? parentStack,
      blockOrder: asNumber(block.blockOrder ?? block.order, index + 1),
      sourceKind: normalizeSourceKind(block.sourceKind),
      generationReason: String(block.generationReason ?? 'Imported from current active-session Sleeve package.'),
      gates: stringArray(block.gates ?? block.gateIds),
      gateIds: stringArray(block.gateIds ?? block.gates),
      capabilities: stringArray(block.capabilities ?? block.capabilityIds),
      moltBlockIds: stringArray(block.moltBlockIds),
      nlCard: asRecord(block.nlCard),
      jsonSchema: asRecord(block.jsonSchema),
      tags: stringArray(block.tags).length ? stringArray(block.tags) : ['imported', 'current-active-session'],
      defaultState: block.defaultState === 'off' ? 'off' as const : 'on' as const
    };
  });
  const neoBlockById = new Map(neoBlocks.map((block) => [block.id, block]));
  for (const stack of neoStacks) if (!stack.neoBlockIds.length) stack.neoBlockIds = neoBlocks.filter((block) => block.neoStackId === stack.id).map((block) => block.id);
  const moltBlocks = (Array.isArray(rawSleeve.moltBlocks) ? rawSleeve.moltBlocks : []).map((value, index) => {
    const molt = asRecord(value);
    const parentNeoBlockId = typeof molt.parentNeoBlockId === 'string' ? molt.parentNeoBlockId : undefined;
    const parentNeoStackId = typeof molt.parentNeoStackId === 'string' ? molt.parentNeoStackId : parentNeoBlockId ? neoBlockById.get(parentNeoBlockId)?.neoStackId : undefined;
    return {
      id: String(molt.id ?? `IMPORTED.MOLT.${index + 1}`),
      sourceId: typeof molt.sourceId === 'string' ? molt.sourceId : undefined,
      title: String(molt.title ?? molt.name ?? `Imported MOLT ${index + 1}`),
      role: normalizeMoltRole(molt.role),
      content: String(molt.content ?? molt.text ?? molt.directive ?? `Imported active-session MOLT ${index + 1}.`),
      description: String(molt.description ?? molt.purpose ?? `Imported active-session MOLT ${index + 1}.`),
      tags: stringArray(molt.tags).length ? stringArray(molt.tags) : ['imported', 'current-active-session'],
      sourceKind: normalizeSourceKind(molt.sourceKind, 'workspace-draft'),
      generationReason: String(molt.generationReason ?? 'Imported from current active-session Sleeve package.'),
      parentNeoBlockId,
      parentNeoStackId,
      stackOrder: asNumber(molt.stackOrder ?? molt.order, index + 1),
      sourcePath: typeof molt.sourcePath === 'string' ? molt.sourcePath : entry?.path,
      nlCard: asRecord(molt.nlCard),
      jsonSchema: asRecord(molt.jsonSchema),
      blockType: 'molt' as const,
      references: Array.isArray(molt.references) ? molt.references as Array<{ reusedBlockId?: string; sourcePath?: string; parentNeoBlockId?: string }> : undefined,
      defaultState: molt.defaultState === 'off' ? 'off' as const : 'on' as const
    };
  });
  for (const block of neoBlocks) if (!block.moltBlockIds.length) block.moltBlockIds = moltBlocks.filter((molt) => molt.parentNeoBlockId === block.id).map((molt) => molt.id);
  const normalizedPath = entry?.path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
  const folderPrefixNormalized = Boolean(normalizedPath && normalizedPath.toLowerCase() !== 'sleeve/active_session_sleeve.json');
  const rawMetadata = asRecord(rawSleeve.metadata);
  const rawCapabilities = Array.isArray(rawSleeve.capabilities) ? rawSleeve.capabilities.filter((capability) => capability && typeof capability === 'object') : [];
  const normalizedGates = (Array.isArray(rawSleeve.gates) ? rawSleeve.gates : []).map((value, index) => {
    const gate = asRecord(value);
    const attach = asRecord(gate.attachesTo);
    const fallbackTargetId = neoBlocks[index]?.id ?? neoBlocks[0]?.id ?? sleeveId;
    const targetId = String(attach.id ?? gate.targetId ?? gate.neoBlockId ?? fallbackTargetId);
    return {
      id: String(gate.id ?? `IMPORTED.GATE.${index + 1}`),
      title: String(gate.title ?? gate.name ?? `Imported Gate ${index + 1}`),
      attachesTo: { kind: String(attach.kind ?? 'neoblock'), id: targetId },
      triggerType: String(gate.triggerType ?? 'runtime_condition'),
      conditionText: String(gate.conditionText ?? gate.condition ?? 'Open when imported runtime conditions are satisfied.'),
      action: String(gate.action ?? 'activate'),
      targetIds: stringArray(gate.targetIds).length ? stringArray(gate.targetIds) : [targetId],
      defaultState: String(gate.defaultState ?? 'closed'),
      runtimeState: String(gate.runtimeState ?? 'inactive'),
      tags: stringArray(gate.tags).length ? stringArray(gate.tags) : ['imported', 'current-active-session', 'gate'],
      metadata: asRecord(gate.metadata)
    };
  });
  const sleeve: NormalizedImportedSleeve = {
    id: sleeveId,
    title,
    version: String(rawSleeve.version ?? rawMetadata.version ?? '1.0.0'),
    description: String(rawSleeve.description ?? rawSleeve.purpose ?? rawSleeve.mission ?? `Imported current active-session UMG Sleeve package ${title}.`),
    isTemplate: true,
    templateKind: 'custom',
    source: 'session',
    tags: stringArray(rawSleeve.tags).length ? stringArray(rawSleeve.tags) : ['imported','current-active-session','workspace-draft'],
    neoStacks,
    neoBlocks,
    moltBlocks,
    gates: normalizedGates,
    governanceBlockIds: stringArray(rawSleeve.governanceBlockIds).length ? stringArray(rawSleeve.governanceBlockIds) : moltBlocks.filter((m) => m.role === 'primary').map((m) => m.id),
    defaultExecutionMode: rawSleeve.defaultExecutionMode === 'liveAllowed' ? 'liveAllowed' : rawSleeve.defaultExecutionMode === 'approvalRequired' ? 'approvalRequired' : 'dryRun',
    metadata: {
      ...rawMetadata,
      generationRoute: 'imported_current_active_session_sleeve',
      importedPackage: true,
      packageType: 'CURRENT_ACTIVE_SESSION_SLEEVE',
      entrypointUsed: entry?.path,
      normalizedEntrypoint: normalizedPath,
      folderPrefixNormalized,
      liveHermesGenerated: false,
      generatedByHermes: false,
      liveHermesGenerationSkipped: true,
      compileEligible: true,
      mode: 'runtime_session_draft',
      sourceKind: 'imported-current-active-session-package',
      sourceFiles: files.map((f) => f.path),
      ...(rawCapabilities.length ? { capabilities: rawCapabilities } : {}),
      protectedSourceLibraryWrite: false,
      sourceLibraryBacked: false,
      sourceLibraryMatches: 'not resolved yet / optional',
      importWorkspace: 'workspace-draft'
    }
  };
  const proximity = analyzeSchemaProximity(sleeve);
  const report = buildImportReport(files, sleeve, proximity.issues.filter((issue) => issue.severity !== 'error'), [
    { objectKind: 'sleeve', objectId: sleeve.id, field: 'metadata.generationRoute', after: 'imported_current_active_session_sleeve', reason: 'Current active-session package activates directly without live Hermes generation.', sourceEvidence: entry?.path },
    { objectKind: 'sleeve', objectId: sleeve.id, field: 'entrypoint', after: entry?.path, reason: folderPrefixNormalized ? 'Folder-prefixed package entrypoint was normalized.' : 'Root sleeve entrypoint was used.', sourceEvidence: entry?.path },
    { objectKind: 'sleeve', objectId: sleeve.id, field: 'metadata.protectedSourceLibraryWrite', after: false, reason: 'Critical import rule: do not mutate protected source library.' }
  ], { duplicateIds: 0, duplicateTitleRoleParent: 0, duplicateContentHash: 0, merged: 0 });
  return { ok: true as const, sleeve, report: { ...report, sourceKind: 'current-umg-json' as const, packageDetection: { detected: true, packageType: 'current_active_session_sleeve' as const, confidence: 0.95, evidence: ['Current active-session sleeve import completed.'], sleeveId: sleeve.id, title: sleeve.title, version: sleeve.version }, extractedCounts: { neoStacks: neoStacks.length, neoBlocks: neoBlocks.length, moltBlocks: moltBlocks.length, gates: sleeve.gates.length, tools: Array.isArray(rawSleeve.toolBlocks) ? rawSleeve.toolBlocks.length : 0 }, compileEligibility: 'yes' as const, reasonIfNotEligible: undefined } };
}

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
