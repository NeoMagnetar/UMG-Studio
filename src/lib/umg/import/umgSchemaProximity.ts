import type { UMGNormalizationAdjustment, UMGSchemaIssue } from './umgFileClassifier';

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function idOf(value: unknown, fallback: string) { const record = asRecord(value); return String(record.id ?? record.objectId ?? fallback); }

function pushIssue(issues: UMGSchemaIssue[], objectKind: UMGSchemaIssue['objectKind'], objectId: string | undefined, path: string, message: string, suggestedFix: string, autoFixable = true) {
  issues.push({ severity: autoFixable ? 'warning' : 'error', objectKind, objectId, path, message, suggestedFix, autoFixable });
}

export function makeNlCard(title: string, kind: string, description = '') { return { title, kind, summary: description || title, readableLabel: `${kind}: ${title}` }; }
export function makeMinimalSchema(kind: string, title: string) { return { type: 'object', title, properties: { id: { type: 'string' }, title: { type: 'string' }, kind: { const: kind } }, required: ['id', 'title'] }; }

export function analyzeSchemaProximity(candidate: unknown): { targetSchema: 'active_session_sleeve_v1'; confidence: number; issues: UMGSchemaIssue[]; adjustments: UMGNormalizationAdjustment[] } {
  const issues: UMGSchemaIssue[] = [];
  const adjustments: UMGNormalizationAdjustment[] = [];
  const sleeve = asRecord(candidate);
  const sleeveId = idOf(candidate, 'candidate.sleeve');
  const requiredScalars: Array<[string, unknown, string]> = [
    ['id', sleeve.id, 'Use detected Sleeve ID or imported.legacy.sleeve.'],
    ['title', sleeve.title, 'Synthesize title from package heading or filename.'],
    ['version', sleeve.version, 'Use detected version or 1.0.0.'],
    ['description', sleeve.description, 'Synthesize description from source summary.'],
    ['metadata', sleeve.metadata, 'Create metadata with import report and source files.']
  ];
  for (const [field, value, fix] of requiredScalars) {
    if (value === undefined || value === null || value === '') pushIssue(issues, 'sleeve', sleeveId, field, `Sleeve ${field} missing.`, fix, true);
  }
  for (const field of ['neoStacks','neoBlocks','moltBlocks','gates','governanceBlockIds']) {
    if (!Array.isArray(sleeve[field])) pushIssue(issues, 'sleeve', sleeveId, field, `Sleeve ${field} must be an array.`, `Set ${field} to [] if no records were extracted.`, true);
  }
  const arrays: Array<[string, string, UMGSchemaIssue['objectKind']]> = [['neoStacks','neoStack','neostack'], ['neoBlocks','neoBlock','neoblock'], ['moltBlocks','moltBlock','molt']];
  for (const [arrayField, singular, objectKind] of arrays) {
    const entries = Array.isArray(sleeve[arrayField]) ? sleeve[arrayField] as unknown[] : [];
    entries.forEach((entry, index) => {
      const record = asRecord(entry); const objectId = idOf(entry, `${singular}.${index + 1}`);
      for (const field of ['id','title','description']) if (!record[field]) pushIssue(issues, objectKind, objectId, `${arrayField}.${index}.${field}`, `${singular} ${field} missing.`, `Synthesize ${field} from import evidence.`, true);
      if (!record.sourceKind) pushIssue(issues, objectKind, objectId, `${arrayField}.${index}.sourceKind`, `${singular} sourceKind missing.`, 'Set sourceKind to imported-legacy-package or normalized-import-glue.', true);
      if (!record.generationReason) pushIssue(issues, objectKind, objectId, `${arrayField}.${index}.generationReason`, `${singular} generationReason missing.`, 'Record source file/heading/bullet provenance.', true);
      if (!record.nlCard) pushIssue(issues, objectKind, objectId, `${arrayField}.${index}.nlCard`, `${singular} nlCard missing.`, 'Synthesize readable NL card from title/description/tags.', true);
      if (!record.jsonSchema) pushIssue(issues, objectKind, objectId, `${arrayField}.${index}.jsonSchema`, `${singular} jsonSchema missing.`, 'Synthesize minimal object schema.', true);
      if (objectKind === 'neostack' && typeof record.stackOrder !== 'number') pushIssue(issues, objectKind, objectId, `${arrayField}.${index}.stackOrder`, 'NeoStack stackOrder missing.', 'Infer from heading order.', true);
      if (objectKind === 'neoblock') {
        if (typeof record.blockOrder !== 'number') pushIssue(issues, objectKind, objectId, `${arrayField}.${index}.blockOrder`, 'NeoBlock blockOrder missing.', 'Infer from bullet order.', true);
        if (!Array.isArray(record.gates) && !Array.isArray(record.gateIds)) pushIssue(issues, objectKind, objectId, `${arrayField}.${index}.gates`, 'NeoBlock gates missing.', 'Set gates/gateIds to [].', true);
        if (!Array.isArray(record.capabilities)) pushIssue(issues, objectKind, objectId, `${arrayField}.${index}.capabilities`, 'NeoBlock capabilities missing.', 'Set capabilities to [].', true);
      }
    });
  }
  const nonAutoFixable = issues.filter((i) => !i.autoFixable).length;
  const confidence = Math.max(0, Math.min(1, 1 - nonAutoFixable / Math.max(1, issues.length)));
  return { targetSchema: 'active_session_sleeve_v1', confidence, issues, adjustments };
}
