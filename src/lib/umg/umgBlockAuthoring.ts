export type UMGCreatedBlockKind = 'molt';

export type UMGCreatedMoltBlockRole = 'directive' | 'instruction' | 'subject' | 'primary' | 'philosophy' | 'blueprint' | 'meta';

export type UMGCreatedMoltBlock = {
  id: string;
  title: string;
  role: UMGCreatedMoltBlockRole;
  category: string;
  tags: string[];
  description: string;
  content: string;
  sourceKind: 'workspace-draft';
  generationReason: string;
  nlCard: Record<string, unknown>;
  jsonSchema: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'validated' | 'needs_review';
};

export type UMGCreatedMoltBlockValidation = {
  passed: boolean;
  errors: string[];
  warnings: string[];
};

const ROLE_PATTERNS: Array<{ role: UMGCreatedMoltBlockRole; pattern: RegExp }> = [
  { role: 'blueprint', pattern: /\b(style|form|poem|haiku|limerick|blueprint)\b/i },
  { role: 'directive', pattern: /\b(rule|policy|must|should|gate)\b/i },
  { role: 'instruction', pattern: /\b(how to|steps|process|instruction)\b/i },
  { role: 'subject', pattern: /\b(topic|domain|entity|object)\b/i },
  { role: 'primary', pattern: /\b(final|output|result|artifact)\b/i },
  { role: 'philosophy', pattern: /\b(philosophy|lens|principle|ethics)\b/i }
];

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'from', 'make', 'molt', 'block', 'create', 'the', 'with', 'into', 'about', 'request']);
const SUPPORTED_ROLES: UMGCreatedMoltBlockRole[] = ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint', 'meta'];

function normalizeWords(prompt: string) {
  return prompt.toLowerCase().replace(/[^a-z0-9\s-]+/g, ' ').split(/\s+/).filter(Boolean);
}

function toTitleCase(value: string) {
  const words = normalizeWords(value).filter((word) => !['make', 'create', 'a', 'an', 'for', 'molt', 'block'].includes(word));
  return (words.length ? words : ['workspace', 'molt', 'block']).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'workspace-molt-block';
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function inferRole(prompt: string): UMGCreatedMoltBlockRole {
  return ROLE_PATTERNS.find((entry) => entry.pattern.test(prompt))?.role ?? 'instruction';
}

function inferCategory(role: UMGCreatedMoltBlockRole, tags: string[]) {
  if (tags.some((tag) => /poem|haiku|limerick|verse|style/.test(tag))) return 'creative-writing';
  if (tags.some((tag) => /viking|battle|war|saga/.test(tag))) return 'narrative-style';
  if (role === 'directive') return 'governance';
  if (role === 'philosophy') return 'philosophy';
  if (role === 'primary') return 'output-artifact';
  if (role === 'subject') return 'subject-domain';
  if (role === 'blueprint') return 'composition-blueprint';
  return 'workflow-instruction';
}

function extractTags(prompt: string, role: UMGCreatedMoltBlockRole) {
  const words = normalizeWords(prompt).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  return unique([...words, role, 'workspace-draft']).slice(0, 12);
}

export function inferMoltBlockDraftFromPrompt(prompt: string): UMGCreatedMoltBlock {
  const cleanPrompt = prompt.trim() || 'Create a workspace MOLT block';
  const role = inferRole(cleanPrompt);
  const title = toTitleCase(cleanPrompt);
  const tags = extractTags(cleanPrompt, role);
  const category = inferCategory(role, tags);
  const now = new Date().toISOString();
  const id = `workspace.molt.${role}.${slug(title)}.v0.1`;
  const description = `Workspace draft ${role} MOLT block inferred deterministically from: ${cleanPrompt}`;
  const content = [
    `Use this ${role} MOLT block when the composition needs ${title}.`,
    `Original request: ${cleanPrompt}`,
    role === 'blueprint' ? 'Shape the generated artifact around the requested style, form, and constraints without pretending it came from the source library.' : 'Apply the requested behavior locally as draft MOLT guidance.',
    'Keep this block workspace-local until an explicit review promotes it elsewhere.'
  ].join('\n');
  const nlCard = {
    kind: 'molt',
    sourceKind: 'workspace-draft',
    title,
    role,
    category,
    tags,
    summary: description,
    request: cleanPrompt,
    usage: `Draft-only ${role} block available for current Sleeve composition.`
  };
  const jsonSchema = {
    type: 'object',
    required: ['id', 'title', 'role', 'category', 'tags', 'description', 'content', 'sourceKind', 'generationReason', 'nlCard', 'jsonSchema'],
    properties: {
      id: { type: 'string', const: id },
      title: { type: 'string' },
      role: { type: 'string', enum: SUPPORTED_ROLES },
      category: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
      description: { type: 'string' },
      content: { type: 'string' },
      sourceKind: { type: 'string', const: 'workspace-draft' },
      generationReason: { type: 'string' },
      nlCard: { type: 'object' },
      jsonSchema: { type: 'object' }
    }
  };
  const draft: UMGCreatedMoltBlock = {
    id,
    title,
    role,
    category,
    tags,
    description,
    content,
    sourceKind: 'workspace-draft',
    generationReason: `Deterministic Block Forge draft from prompt: ${cleanPrompt}`,
    nlCard,
    jsonSchema,
    createdAt: now,
    updatedAt: now,
    status: 'draft'
  };
  const validation = validateCreatedMoltBlock(draft);
  return { ...draft, status: validation.passed ? 'validated' : 'needs_review' };
}

export function validateCreatedMoltBlock(block: Partial<UMGCreatedMoltBlock>): UMGCreatedMoltBlockValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requireText = (key: keyof UMGCreatedMoltBlock, label: string) => {
    if (typeof block[key] !== 'string' || !String(block[key]).trim()) errors.push(`${label} is required`);
  };
  requireText('id', 'id');
  requireText('title', 'title');
  if (!block.role || !SUPPORTED_ROLES.includes(block.role)) errors.push('role is unsupported');
  requireText('category', 'category');
  if (!Array.isArray(block.tags) || block.tags.length === 0) errors.push('tags array is required');
  requireText('description', 'description');
  requireText('content', 'content');
  if (block.sourceKind !== 'workspace-draft') errors.push('sourceKind must be workspace-draft');
  requireText('generationReason', 'generationReason');
  if (!block.nlCard || typeof block.nlCard !== 'object' || Array.isArray(block.nlCard)) errors.push('nlCard is required');
  if (!block.jsonSchema || typeof block.jsonSchema !== 'object' || Array.isArray(block.jsonSchema)) errors.push('jsonSchema is required');
  if (block.status === 'draft') warnings.push('block remains draft until validation is acknowledged');
  return { passed: errors.length === 0, errors, warnings };
}
