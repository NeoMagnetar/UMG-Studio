import type { LegacyRoleMapping } from './sleeveArchitectTypes';

export type LegacyMarkdownSleeveAudit = {
  sleeveId?: string;
  declaredTotalComponents?: number;
  governancePrimaries: string[];
  neoStacks: Array<{ id?: string; title: string; line: number }>;
  neoBlocks: Array<{ id?: string; title: string; line: number }>;
  moltRecords: Array<{ id?: string; role?: string; normalizedRole: LegacyRoleMapping; title: string; line: number }>;
  workflows: string[];
  outputSections: string[];
  warnings: string[];
};

const mapping: Record<string, LegacyRoleMapping> = {
  TRG: { legacyRole: 'TRG', normalizedRole: 'gate_control', target: 'gate', reason: 'Trigger records control activation and remain Gate/control records.' },
  STRAT: { legacyRole: 'STRAT', normalizedRole: 'strategy', target: 'metadata', reason: 'Strategy guidance becomes Philosophy, Blueprint, or Directive metadata by context.' },
  AIM: { legacyRole: 'AIM', normalizedRole: 'aim', target: 'metadata', reason: 'Aims become objective metadata on Directive or Primary records.' },
  NEED: { legacyRole: 'NEED', normalizedRole: 'need', target: 'constraint', reason: 'Needs are prerequisites, approval points, gates, or Subject constraints.' },
  USE: { legacyRole: 'USE', normalizedRole: 'use_case', target: 'metadata', reason: 'Use-case records become Blueprint or scenario metadata.' },
  DIR: { legacyRole: 'DIR', normalizedRole: 'directive', target: 'molt', reason: 'Directive maps directly to current MOLT Directive.' },
  INST: { legacyRole: 'INST', normalizedRole: 'instruction', target: 'molt', reason: 'Instruction maps directly to current MOLT Instruction.' },
  SUBJ: { legacyRole: 'SUBJ', normalizedRole: 'subject', target: 'molt', reason: 'Subject maps directly to current MOLT Subject.' },
  PHIL: { legacyRole: 'PHIL', normalizedRole: 'philosophy', target: 'molt', reason: 'Philosophy maps directly to current MOLT Philosophy.' },
  BP: { legacyRole: 'BP', normalizedRole: 'blueprint', target: 'molt', reason: 'Blueprint maps directly to current MOLT Blueprint.' },
  PRIM: { legacyRole: 'PRIM', normalizedRole: 'primary', target: 'molt', reason: 'Primary maps to governance Primary MOLT role.' }
};

export function detectLegacyMoltRole(value: string): string | undefined {
  const text = value.trim();
  const match = text.match(/\b(TRG|STRAT|AIM|NEED|USE|DIR|INST|SUBJ|PHIL|BP|PRIM)(?:\.|\b|_)/i);
  return match?.[1]?.toUpperCase();
}

export function normalizeLegacyMoltRole(value: string): LegacyRoleMapping {
  const role = detectLegacyMoltRole(value) ?? value.trim().toUpperCase();
  return mapping[role] ?? { legacyRole: role, normalizedRole: 'subject', target: 'metadata', reason: 'Unknown legacy role retained as metadata until reviewed.' };
}

export function parseLegacyMarkdownSleeve(markdown: string): LegacyMarkdownSleeveAudit {
  const lines = markdown.split(/\r?\n/);
  const audit: LegacyMarkdownSleeveAudit = { governancePrimaries: [], neoStacks: [], neoBlocks: [], moltRecords: [], workflows: [], outputSections: [], warnings: [] };
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    const sleeveMatch = trimmed.match(/(?:Sleeve ID|sleeveId|id)\s*[:=-]\s*`?([A-Za-z0-9_.:-]+)/i) ?? trimmed.match(/\b(SLV\.[A-Za-z0-9_.:-]+)/i);
    if (!audit.sleeveId && sleeveMatch?.[1]) audit.sleeveId = sleeveMatch[1].replace(/`$/, '');
    const totalMatch = trimmed.match(/(?:total components|components)\s*[:=-]\s*(\d+)/i);
    if (!audit.declaredTotalComponents && totalMatch?.[1]) audit.declaredTotalComponents = Number(totalMatch[1]);
    if (/governance|primary|primaries/i.test(trimmed) && trimmed.length > 6) audit.governancePrimaries.push(trimmed.replace(/^#+\s*/, ''));
    const stackMatch = trimmed.match(/(?:NeoStack|Stack)\s*(?:ID)?\s*[:#-]?\s*`?([A-Za-z0-9_.:-]+)?`?\s*(?:[-–:]\s*)?(.+)?/i);
    if (stackMatch && /neostack|stack/i.test(trimmed) && !/workflow/i.test(trimmed)) audit.neoStacks.push({ id: stackMatch[1], title: (stackMatch[2] ?? stackMatch[1] ?? trimmed).replace(/^#+\s*/, '').trim(), line: lineNumber });
    const blockMatch = trimmed.match(/(?:NeoBlock|Block)\s*(?:ID)?\s*[:#-]?\s*`?([A-Za-z0-9_.:-]+)?`?\s*(?:[-–:]\s*)?(.+)?/i);
    if (blockMatch && /neoblock/i.test(trimmed)) audit.neoBlocks.push({ id: blockMatch[1], title: (blockMatch[2] ?? blockMatch[1] ?? trimmed).replace(/^#+\s*/, '').trim(), line: lineNumber });
    const legacyRole = detectLegacyMoltRole(trimmed);
    if (legacyRole) audit.moltRecords.push({ id: trimmed.match(/\b[A-Z]{2,6}\.[A-Za-z0-9_.:-]+/)?.[0], role: legacyRole, normalizedRole: normalizeLegacyMoltRole(legacyRole), title: trimmed.replace(/^[-*#\s]+/, ''), line: lineNumber });
    if (/workflow example|when the user|agent activates|activation path/i.test(trimmed)) audit.workflows.push(trimmed.replace(/^#+\s*/, ''));
    if (/output format|expected output|deliverable/i.test(trimmed)) audit.outputSections.push(trimmed.replace(/^#+\s*/, ''));
  });
  if (!audit.sleeveId) audit.warnings.push('No explicit Sleeve ID detected.');
  if (!audit.neoStacks.length) audit.warnings.push('No NeoStack sections detected.');
  return audit;
}

export function summarizeImportedSleeve(audit: LegacyMarkdownSleeveAudit) {
  return {
    sleeveId: audit.sleeveId,
    declaredTotalComponents: audit.declaredTotalComponents,
    neoStacks: audit.neoStacks.length,
    neoBlocks: audit.neoBlocks.length,
    moltRecords: audit.moltRecords.length,
    workflows: audit.workflows.length,
    outputSections: audit.outputSections.length,
    warnings: audit.warnings
  };
}

export function buildImportedSleeveDraftPlan(markdown: string) {
  const audit = parseLegacyMarkdownSleeve(markdown);
  return { mode: 'imported_sleeve_mode' as const, audit, summary: summarizeImportedSleeve(audit), draftOnly: true, sourceLibraryWrite: false };
}
