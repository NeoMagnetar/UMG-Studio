import { FullGateSourceRecord, TriggerGateSourceCard } from './types';

export const TRIGGER_GATE_SOURCE_CARD_PARSER_VERSION = 'trigger-gate-source-card.v0.1' as const;
export const MISSING_ACTIVATION_FALLBACK = 'Activation not specified; treat as candidate/manual gate until configured.';

type MarkdownSource = { sourcePath: string; markdown: string };

const filenameId = (sourcePath: string) => /(?:^|\/)(TRG\.\d{3})[-\s]/i.exec(sourcePath)?.[1]?.toUpperCase();
const slugTitle = (sourcePath: string) => (sourcePath.split('/').pop() ?? sourcePath).replace(/^TRG\.\d{3}[-_]?/i, '').replace(/\.md$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).trim();
const clean = (value?: string) => (value ?? '').replace(/^\uFEFF/, '').trim();

function parseFields(markdown: string) {
  const fields: Record<string, string> = {};
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^\*\*([^:*]+):\*\*\s*(.*)$/.exec(line.trim());
    if (match) fields[match[1].trim()] = match[2].trim();
  }
  return fields;
}

function parseHeadings(markdown: string) {
  const headings: Record<string, string> = {};
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^##\s+(.+?)\s*$/.exec(lines[index]);
    if (!heading) continue;
    const body: string[] = [];
    for (let cursor = index + 1; cursor < lines.length && !/^##\s+/.test(lines[cursor]); cursor += 1) body.push(lines[cursor]);
    headings[heading[1].trim()] = body.join('\n').trim();
  }
  return headings;
}

function parseH1(markdown: string) {
  const line = markdown.split(/\r?\n/).find((item) => /^#\s+/.test(item));
  if (!line) return {} as { id?: string; title?: string };
  const text = line.replace(/^#\s+/, '').trim();
  const match = /^(TRG\.\d{3})(?:\s*(?:\?|—|-|:)\s*|\s+)(.+)$/i.exec(text);
  if (match) return { id: match[1].toUpperCase(), title: clean(match[2]) };
  const id = /(TRG\.\d{3})/i.exec(text)?.[1]?.toUpperCase();
  return { id, title: clean(text.replace(/TRG\.\d{3}/i, '').replace(/^[?—:\-\s]+/, '')) };
}

export function parseTriggerGateSourceMarkdown(sourcePath: string, markdown: string): TriggerGateSourceCard {
  const fields = parseFields(markdown);
  const headings = parseHeadings(markdown);
  const h1 = parseH1(markdown);
  const parseWarnings: string[] = [];
  const id = h1.id ?? filenameId(sourcePath) ?? 'TRG.UNKNOWN';
  if (id === 'TRG.UNKNOWN') parseWarnings.push('Stable TRG ID missing from filename and H1.');
  const summary = clean(headings.Summary) || clean(h1.title) || slugTitle(sourcePath) || id;
  const title = clean(h1.title) || summary || slugTitle(sourcePath) || id;
  const rawActivation = clean(headings.Activation) || undefined;
  if (!rawActivation) parseWarnings.push(MISSING_ACTIVATION_FALLBACK);
  const tags = (headings.Tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);

  return {
    type: 'TriggerGateSourceCard',
    id,
    title,
    gateKind: 'trigger_gate',
    sourceType: 'HUMAN_GATE_SOURCE',
    sourceLayer: 'HUMAN',
    sourcePath,
    status: clean(fields.Status) || 'unknown',
    category: clean(fields.Category) || 'uncategorized',
    subcategory: clean(fields.Subcategory) || 'uncategorized',
    tags,
    summary,
    activation: {
      mode: rawActivation ? 'source_condition' : 'manual_candidate',
      conditionSummary: rawActivation ?? MISSING_ACTIVATION_FALLBACK,
      rawActivation,
      hasExplicitActivation: Boolean(rawActivation)
    },
    card: {
      displayType: 'trigger_gate_source',
      badge: 'Gt',
      familyLabel: 'TriggerGate Source',
      runnableAsPromptContent: false,
      addActionLabel: 'Attach Gate'
    },
    legacy: { originalMarkdown: markdown, parsedHeadings: { ...fields, ...headings }, parseWarnings }
  };
}

export function normalizeTriggerGateSourceCards(sources: MarkdownSource[]): TriggerGateSourceCard[] {
  return sources.map((source) => parseTriggerGateSourceMarkdown(source.sourcePath, source.markdown)).sort((a, b) => a.id.localeCompare(b.id));
}

export function buildFullGateSourceRecord(card: TriggerGateSourceCard): FullGateSourceRecord {
  return {
    type: 'FullGateSourceRecord',
    sourcePath: card.sourcePath,
    sourceLayer: 'HUMAN',
    sourceFamily: 'HUMAN/GATES',
    legacyOriginal: {
      markdown: card.legacy.originalMarkdown,
      parsedFields: Object.fromEntries(Object.entries(card.legacy.parsedHeadings).filter(([key]) => ['Type', 'Category', 'Subcategory', 'Status'].includes(key))),
      parsedHeadings: card.legacy.parsedHeadings
    },
    normalized: card,
    parserVersion: TRIGGER_GATE_SOURCE_CARD_PARSER_VERSION,
    warnings: card.legacy.parseWarnings
  };
}

export function buildTriggerGateSourceInspectorViews(card: TriggerGateSourceCard) {
  const record = buildFullGateSourceRecord(card);
  return {
    card: {
      type: 'TriggerGateSourceCardView',
      id: card.id,
      title: card.title,
      badge: card.card.badge,
      gateKind: card.gateKind,
      familyLabel: card.card.familyLabel,
      category: card.category,
      subcategory: card.subcategory,
      status: card.status,
      tags: card.tags,
      activationSummary: card.activation.conditionSummary,
      sourcePath: card.sourcePath,
      runnableAsPromptContent: false
    },
    runtimePreview: {
      wouldBecome: 'RuntimeGate',
      defaultState: 'inactive/candidate',
      promptContent: false,
      liveExecution: false,
      note: 'Attach Gate / RuntimeGate insertion is future work and is disabled in this read-only lane.'
    },
    nl: `TriggerGate Source ${card.id}: ${card.title}\nGate kind: TriggerGate\nCategory: ${card.category} / ${card.subcategory}\nCondition: ${card.activation.conditionSummary}\nThis source card is not prompt content and does not execute tools.`,
    json: card,
    legacySource: record,
    attachPlacementPreview: { enabled: false, reason: 'Attach Gate / build insertion is not implemented in this lane.' },
    traceIrPreview: { createsGateIRRowNow: false, reason: 'GateIRRow is created only after a future RuntimeGate insertion lane.' }
  };
}

export function triggerGateSourceCardCount(cards: TriggerGateSourceCard[]) {
  return cards.length;
}
