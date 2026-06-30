export type UploadedIntakeStatus = 'parsed_text' | 'unsupported_type' | 'read_error';

export type UploadedIntakeContext = {
  fileName: string;
  mimeType?: string;
  sizeBytes: number;
  status: UploadedIntakeStatus;
  text?: string;
  summary?: string;
  keywords: string[];
  syntaxSignals: string[];
  semanticSignals: string[];
  domainSignals: string[];
  suggestedMoltRoles: string[];
  error?: string;
  // Compatibility with earlier public intake records.
  name?: string;
  size?: number;
  lastModified?: number;
};

type IntakeSource = {
  fileName: string;
  mimeType?: string;
  sizeBytes: number;
  text?: string;
  error?: string;
  lastModified?: number;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function unique(values: string[], limit = 48) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function has(text: string, pattern: RegExp | string) {
  return typeof pattern === 'string' ? normalizeText(text).includes(normalizeText(pattern)) : pattern.test(text);
}

const KEYWORD_RULES: Array<[string, RegExp[]]> = [
  ['customer support', [/customer\s+support/i, /customer/i]],
  ['classify', [/classif/i]],
  ['classification', [/classif/i]],
  ['billing', [/billing/i]],
  ['technical', [/technical/i]],
  ['account access', [/account\s+access/i]],
  ['urgent safety', [/urgent\s+safety/i, /safety/i]],
  ['draft reply', [/draft/i, /reply/i]],
  ['customer reply', [/customer\s+reply/i, /reply/i]],
  ['escalation', [/escalat/i]],
  ['routing', [/rout/i, /escalat/i]],
  ['summary', [/summar/i]],
  ['approval', [/approval/i, /without\s+approval/i, /human\s+review/i]],
  ['human reviewer', [/human\s+review/i]],
  ['calm professional tone', [/calm/i, /professional\s+tone/i]],
  ['email approval', [/email/i, /approval/i]]
];

const STOP_WORDS = new Set(['that', 'this', 'with', 'from', 'into', 'your', 'have', 'will', 'should', 'each', 'after', 'before', 'without', 'automatically', 'incoming', 'issues', 'general']);

export function extractIntakeKeywords(text: string): string[] {
  const ruleKeywords = KEYWORD_RULES.filter(([, patterns]) => patterns.some((pattern) => has(text, pattern))).map(([label]) => label);
  const normalized = normalizeText(text);
  const counts = new Map<string, number>();
  for (const token of normalized.split(/\s+/)) {
    if (token.length < 4 || STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const counted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([token]) => token);
  return unique([...ruleKeywords, ...counted], 40);
}

export function extractSyntaxSignals(text: string): string[] {
  const signals: string[] = [];
  if (has(text, /\bSOP\b|standard operating procedure/i)) signals.push('SOP');
  if (has(text, /workflow|process|step|after each|incoming/i)) signals.push('workflow');
  if (has(text, /policy|do not|must|required|without approval/i)) signals.push('policy');
  if (has(text, /checklist|classify|draft|escalate|summarize/i)) signals.push('checklist');
  if (has(text, /email|reply|message/i)) signals.push('email');
  if (has(text, /report|outcome|summary|summar/i)) signals.push('report');
  if (has(text, /draft|reply|compose|write/i)) signals.push('draft');
  if (has(text, /approval|reviewer|human reviewer/i)) signals.push('approval');
  if (has(text, /classif/i)) signals.push('classification');
  if (has(text, /escalat/i)) signals.push('escalation');
  if (has(text, /routing|route|escalat/i)) signals.push('routing');
  if (has(text, /summar/i)) signals.push('summarization');
  if (has(text, /generation|generate|draft/i)) signals.push('generation');
  if (has(text, /analysis|analyze|classif/i)) signals.push('analysis');
  return unique(signals, 32);
}

export function extractSemanticSignals(text: string): string[] {
  const signals: string[] = [];
  if (has(text, /classif.*billing|billing.*technical|issue/i)) signals.push('issue classification');
  if (has(text, /draft.*customer.*reply|customer.*reply|friendly.*reply/i)) signals.push('customer reply drafting');
  if (has(text, /urgent\s+safety.*escalat|escalat.*urgent\s+safety/i)) signals.push('urgent safety escalation');
  if (has(text, /summar.*outcome|outcome.*case/i)) signals.push('outcome summarization');
  if (has(text, /without\s+approval|human\s+reviewer|approval/i)) signals.push('human approval required');
  if (has(text, /calm.*professional|professional\s+tone/i)) signals.push('tone governance');
  if (has(text, /do not send emails|email.*approval/i)) signals.push('no automatic email send');
  return unique(signals, 32);
}

export function extractDomainSignals(text: string): string[] {
  const signals: string[] = [];
  if (has(text, /customer|support|reply/i)) signals.push('customer support');
  if (has(text, /billing/i)) signals.push('billing support');
  if (has(text, /technical/i)) signals.push('technical support');
  if (has(text, /account\s+access/i)) signals.push('account access');
  if (has(text, /urgent\s+safety|safety/i)) signals.push('safety escalation');
  if (has(text, /feedback/i)) signals.push('customer feedback');
  return unique(signals, 32);
}

export function inferMoltRoleHints(text: string): string[] {
  const roles: string[] = [];
  if (has(text, /do not|must|required|approval|policy|goal|build/i)) roles.push('Directive');
  if (has(text, /classify|draft|escalate|summarize|step|process/i)) roles.push('Instruction');
  if (has(text, /customer|billing|technical|account access|urgent safety|feedback|audience|topic/i)) roles.push('Subject');
  if (has(text, /success|outcome|reply|summary|core output/i)) roles.push('Primary');
  if (has(text, /calm|professional|tone|ethics|principles/i)) roles.push('Philosophy');
  if (has(text, /SOP|workflow|structure|schema|format|plan/i)) roles.push('Blueprint');
  if (has(text, /if|urgent|approval|without|escalate|reviewer|condition|gate|route/i)) roles.push('Trigger/Gate');
  return unique(roles, 16);
}

export function summarizeIntakeText(fileName: string, text: string) {
  const compact = text.replace(/\s+/g, ' ').trim();
  return `${fileName}: ${compact.slice(0, 700)}${compact.length > 700 ? '…' : ''}`;
}

export function createUploadedIntakeContext(source: IntakeSource): UploadedIntakeContext {
  const text = source.text ?? '';
  return {
    fileName: source.fileName,
    name: source.fileName,
    mimeType: source.mimeType,
    sizeBytes: source.sizeBytes,
    size: source.sizeBytes,
    lastModified: source.lastModified,
    status: 'parsed_text',
    text,
    summary: summarizeIntakeText(source.fileName, text),
    keywords: extractIntakeKeywords(text),
    syntaxSignals: extractSyntaxSignals(text),
    semanticSignals: extractSemanticSignals(text),
    domainSignals: extractDomainSignals(text),
    suggestedMoltRoles: inferMoltRoleHints(text)
  };
}

export function createUnsupportedUploadedIntakeContext(source: Omit<IntakeSource, 'text'>): UploadedIntakeContext {
  return {
    fileName: source.fileName,
    name: source.fileName,
    mimeType: source.mimeType,
    sizeBytes: source.sizeBytes,
    size: source.sizeBytes,
    lastModified: source.lastModified,
    status: 'unsupported_type',
    summary: `${source.fileName}: Unsupported extractor pending for ${source.mimeType || 'unknown type'}. Browser-readable text/markdown/json/csv only.`,
    keywords: [],
    syntaxSignals: [],
    semanticSignals: [],
    domainSignals: [],
    suggestedMoltRoles: []
  };
}

export function createReadErrorUploadedIntakeContext(source: Omit<IntakeSource, 'text'>): UploadedIntakeContext {
  return {
    fileName: source.fileName,
    name: source.fileName,
    mimeType: source.mimeType,
    sizeBytes: source.sizeBytes,
    size: source.sizeBytes,
    lastModified: source.lastModified,
    status: 'read_error',
    summary: `${source.fileName}: local browser text read failed.`,
    keywords: [],
    syntaxSignals: [],
    semanticSignals: [],
    domainSignals: [],
    suggestedMoltRoles: [],
    error: source.error
  };
}

export function buildExpandedRetrievalQuery(input: { prompt: string; pastedContext?: string; uploadedContexts?: UploadedIntakeContext[]; capabilityHints?: string[] }) {
  const parsedUploads = (input.uploadedContexts ?? []).filter((context) => context.status === 'parsed_text');
  const uploadAdditions = parsedUploads.flatMap((context) => [
    context.summary,
    ...context.keywords,
    ...context.syntaxSignals,
    ...context.semanticSignals,
    ...context.domainSignals,
    ...context.suggestedMoltRoles
  ]);
  return unique([
    input.prompt,
    ...(input.pastedContext ? [input.pastedContext] : []),
    ...uploadAdditions.filter((value): value is string => Boolean(value)),
    ...(input.capabilityHints ?? [])
  ], 96).join('\n');
}

export function buildUploadedContextNarrative(contexts: UploadedIntakeContext[]) {
  return contexts.map((context) => [
    `Uploaded intake context: ${context.fileName}`,
    `status: ${context.status}`,
    `mimeType: ${context.mimeType || 'unknown'}`,
    `sizeBytes: ${context.sizeBytes}`,
    context.summary ? `summary: ${context.summary}` : undefined,
    context.keywords.length ? `keywords: ${context.keywords.join(', ')}` : undefined,
    context.syntaxSignals.length ? `syntaxSignals: ${context.syntaxSignals.join(', ')}` : undefined,
    context.semanticSignals.length ? `semanticSignals: ${context.semanticSignals.join(', ')}` : undefined,
    context.domainSignals.length ? `domainSignals: ${context.domainSignals.join(', ')}` : undefined,
    context.suggestedMoltRoles.length ? `suggestedMoltRoles: ${context.suggestedMoltRoles.join(', ')}` : undefined,
    context.status !== 'parsed_text' ? 'Unsupported extractor pending if not parsed; do not invent file contents.' : undefined
  ].filter(Boolean).join('\n')).join('\n\n');
}

export function buildIntakeDiagnostics(input: { prompt: string; pastedContext?: string; uploadedContexts?: UploadedIntakeContext[]; expandedRetrievalQuery: string; candidateCount?: number; topCandidates?: Array<{ id: string; title: string; role?: string; domain?: string; blockType?: string; matchReasons?: string[] }> }) {
  const uploaded = input.uploadedContexts ?? [];
  const parsed = uploaded.filter((context) => context.status === 'parsed_text');
  const unsupported = uploaded.filter((context) => context.status === 'unsupported_type');
  const keywords = unique(parsed.flatMap((context) => context.keywords), 64);
  const syntaxSignals = unique(parsed.flatMap((context) => context.syntaxSignals), 64);
  const semanticSignals = unique(parsed.flatMap((context) => context.semanticSignals), 64);
  const domainSignals = unique(parsed.flatMap((context) => context.domainSignals), 64);
  const moltRoleHints = unique(parsed.flatMap((context) => context.suggestedMoltRoles), 32);
  return {
    promptAnalyzed: Boolean(input.prompt.trim()),
    pastedContextAnalyzed: Boolean((input.pastedContext ?? '').trim()),
    uploadedFilesAnalyzed: uploaded.length,
    parsedUploadedFiles: parsed.length,
    unsupportedFiles: unsupported.length,
    extractedKeywords: keywords,
    syntaxSignals,
    semanticSignals,
    domainSignals,
    moltRoleHints,
    uploadedContextQueryAdditions: unique([...keywords, ...syntaxSignals, ...semanticSignals, ...domainSignals, ...moltRoleHints], 96),
    expandedRetrievalQuery: input.expandedRetrievalQuery,
    candidateCount: input.candidateCount ?? 0,
    topCandidates: input.topCandidates ?? [],
    includedInRetrievalQuery: parsed.length > 0,
    includedInHermesRequest: parsed.length > 0,
    sourceStatusSummary: uploaded.reduce<Record<string, number>>((acc, context) => {
      acc[context.status] = (acc[context.status] ?? 0) + 1;
      return acc;
    }, {})
  };
}
