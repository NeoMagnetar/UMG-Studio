import type { NormalizedTemplateSleeve } from './templateSleeveStructures';

export type NeoBlockMoltRoleCount = {
  directive: number;
  instruction: number;
  subject: number;
  primary: number;
  philosophy: number;
  blueprint: number;
  otherMeta: number;
};

export type NeoBlockCompositionWarningCode =
  | 'NEOBLOCK_MISSING_PRIMARY'
  | 'NEOBLOCK_MISSING_DIRECTIVE'
  | 'NEOBLOCK_MISSING_INSTRUCTION'
  | 'NEOBLOCK_MISSING_SUBJECT'
  | 'NEOBLOCK_MULTIPLE_ACTIVE_DIRECTIVES'
  | 'NEOBLOCK_MULTIPLE_ACTIVE_INSTRUCTIONS'
  | 'NEOBLOCK_REUSED_MOLT_WITHOUT_CONTEXTUAL_BINDING'
  | 'NEOBLOCK_NO_UNIQUE_OUTPUT_SIGNAL'
  | 'GATE_WITHOUT_CONTROLLED_NEOBLOCK'
  | 'MOLT_ROLE_CONFLICTS_WITH_PARENT_STACK_PURPOSE';

export type NeoBlockCompositionWarning = {
  code: NeoBlockCompositionWarningCode;
  severity: 'info' | 'warning';
  neoBlockId?: string;
  moltBlockId?: string;
  gateId?: string;
  message: string;
};

export type NeoBlockCompositionAuditRow = {
  neoBlockId: string;
  neoBlockTitle: string;
  neoStackId: string;
  roleCounts: NeoBlockMoltRoleCount;
  attachedMoltBlockIds: string[];
  inheritedPrimaryBlockIds: string[];
  duplicateRoles: string[];
  missingRoles: Array<'primary' | 'directive' | 'instruction' | 'subject'>;
  missingBlueprint: boolean;
};

export type ReusedMoltAuditRow = {
  moltBlockId: string;
  role: string;
  parentNeoBlockIds: string[];
  parentNeoStackIds: string[];
  usageCount: number;
  reuseAssessment: 'safe' | 'too_broad' | 'needs_local_binding_metadata';
  bindingFieldsPresent: string[];
  bindingFieldsMissing: Array<'reusedBlockId' | 'localSlotRole' | 'parentNeoBlockId' | 'bindingReason' | 'inheritedFrom' | 'localOverride'>;
};

export type NeoBlockCompositionAudit = {
  sleeveId: string;
  counts: {
    neoStacks: number;
    neoBlocks: number;
    moltBlocks: number;
    gates: number;
  };
  rows: NeoBlockCompositionAuditRow[];
  reusedMoltBlocks: ReusedMoltAuditRow[];
  warnings: NeoBlockCompositionWarning[];
  summary: {
    missingPrimary: number;
    missingLocalPrimary: number;
    missingDirective: number;
    missingInstruction: number;
    missingSubject: number;
    missingBlueprint: number;
    duplicateRoleNeoBlocks: number;
    reusedMoltBlocks: number;
  };
};

const EXECUTABLE_REQUIRED_ROLES = ['directive', 'instruction', 'subject'] as const;
const REUSE_BINDING_FIELDS = ['reusedBlockId', 'localSlotRole', 'parentNeoBlockId', 'bindingReason', 'inheritedFrom', 'localOverride'] as const;

type RequiredRole = typeof EXECUTABLE_REQUIRED_ROLES[number] | 'primary';

type MoltBlock = NormalizedTemplateSleeve['moltBlocks'][number];

function emptyRoleCounts(): NeoBlockMoltRoleCount {
  return { directive: 0, instruction: 0, subject: 0, primary: 0, philosophy: 0, blueprint: 0, otherMeta: 0 };
}

function addRole(counts: NeoBlockMoltRoleCount, role?: string) {
  switch (role) {
    case 'directive':
    case 'instruction':
    case 'subject':
    case 'primary':
    case 'philosophy':
    case 'blueprint':
      counts[role] += 1;
      break;
    default:
      counts.otherMeta += 1;
  }
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function hasBindingField(block: MoltBlock, field: string) {
  const value = (block as unknown as Record<string, unknown>)[field];
  return value !== undefined && value !== null && value !== '';
}

function assessReuse(block: MoltBlock, parentNeoBlockIds: string[], parentNeoStackIds: string[]): ReusedMoltAuditRow['reuseAssessment'] {
  if (block.role === 'primary' && parentNeoBlockIds.length === 0) return 'safe';
  if (parentNeoStackIds.length > 1) return 'too_broad';
  return 'needs_local_binding_metadata';
}

export function validateNeoBlockComposition(sleeve: NormalizedTemplateSleeve): NeoBlockCompositionAudit {
  const blocksById = new Map(sleeve.moltBlocks.map((block) => [block.id, block]));
  const governancePrimaryBlockIds = sleeve.governanceBlockIds.filter((id) => blocksById.get(id)?.role === 'primary');
  const usageByMoltId = new Map<string, string[]>();
  const warnings: NeoBlockCompositionWarning[] = [];

  const rows = sleeve.neoBlocks.map((neoBlock) => {
    const roleCounts = emptyRoleCounts();
    const roleToIds = new Map<string, string[]>();
    const attachedMoltBlocks = neoBlock.moltBlockIds.map((id) => blocksById.get(id)).filter((block): block is MoltBlock => Boolean(block));

    for (const block of attachedMoltBlocks) {
      addRole(roleCounts, block.role);
      roleToIds.set(block.role, [...(roleToIds.get(block.role) ?? []), block.id]);
      usageByMoltId.set(block.id, [...(usageByMoltId.get(block.id) ?? []), neoBlock.id]);
    }

    const effectivePrimaryCount = roleCounts.primary + governancePrimaryBlockIds.length;
    const missingRoles: RequiredRole[] = [];
    if (effectivePrimaryCount < 1) missingRoles.push('primary');
    for (const role of EXECUTABLE_REQUIRED_ROLES) {
      if (roleCounts[role] < 1) missingRoles.push(role);
    }

    const duplicateRoles = Array.from(roleToIds.entries()).filter(([, ids]) => ids.length > 1).map(([role]) => role);
    if (roleCounts.directive > 1) warnings.push({ code: 'NEOBLOCK_MULTIPLE_ACTIVE_DIRECTIVES', severity: 'warning', neoBlockId: neoBlock.id, message: `${neoBlock.id} has ${roleCounts.directive} directive MOLT blocks.` });
    if (roleCounts.instruction > 1) warnings.push({ code: 'NEOBLOCK_MULTIPLE_ACTIVE_INSTRUCTIONS', severity: 'warning', neoBlockId: neoBlock.id, message: `${neoBlock.id} has ${roleCounts.instruction} instruction MOLT blocks.` });
    if (missingRoles.includes('primary')) warnings.push({ code: 'NEOBLOCK_MISSING_PRIMARY', severity: 'warning', neoBlockId: neoBlock.id, message: `${neoBlock.id} has no local or inherited Primary MOLT source.` });
    if (missingRoles.includes('directive')) warnings.push({ code: 'NEOBLOCK_MISSING_DIRECTIVE', severity: 'warning', neoBlockId: neoBlock.id, message: `${neoBlock.id} has no Directive MOLT source.` });
    if (missingRoles.includes('instruction')) warnings.push({ code: 'NEOBLOCK_MISSING_INSTRUCTION', severity: 'warning', neoBlockId: neoBlock.id, message: `${neoBlock.id} has no Instruction MOLT source.` });
    if (missingRoles.includes('subject')) warnings.push({ code: 'NEOBLOCK_MISSING_SUBJECT', severity: 'warning', neoBlockId: neoBlock.id, message: `${neoBlock.id} has no Subject MOLT source.` });
    if (roleCounts.blueprint < 1) warnings.push({ code: 'NEOBLOCK_NO_UNIQUE_OUTPUT_SIGNAL', severity: 'info', neoBlockId: neoBlock.id, message: `${neoBlock.id} has no local Blueprint; output-shape semantics may be inherited or implicit.` });

    return {
      neoBlockId: neoBlock.id,
      neoBlockTitle: neoBlock.title,
      neoStackId: neoBlock.neoStackId,
      roleCounts,
      attachedMoltBlockIds: neoBlock.moltBlockIds,
      inheritedPrimaryBlockIds: governancePrimaryBlockIds,
      duplicateRoles,
      missingRoles,
      missingBlueprint: roleCounts.blueprint < 1
    };
  });

  for (const gate of sleeve.gates) {
    const controlledNeoBlockId = gate.attachesTo.kind === 'neoblock' ? gate.attachesTo.id : undefined;
    if (controlledNeoBlockId && !sleeve.neoBlocks.some((block) => block.id === controlledNeoBlockId)) {
      warnings.push({ code: 'GATE_WITHOUT_CONTROLLED_NEOBLOCK', severity: 'warning', gateId: gate.id, message: `${gate.id} controls missing NeoBlock ${controlledNeoBlockId}.` });
    }
  }

  const reusedMoltBlocks = Array.from(usageByMoltId.entries())
    .filter(([, neoBlockIds]) => neoBlockIds.length > 1)
    .map(([moltBlockId, neoBlockIds]) => {
      const block = blocksById.get(moltBlockId);
      const parentNeoStackIds = uniqueStrings(neoBlockIds.map((neoBlockId) => sleeve.neoBlocks.find((neoBlock) => neoBlock.id === neoBlockId)?.neoStackId));
      const bindingFieldsPresent = REUSE_BINDING_FIELDS.filter((field) => block ? hasBindingField(block, field) : false);
      const bindingFieldsMissing = REUSE_BINDING_FIELDS.filter((field) => !bindingFieldsPresent.includes(field));
      const row: ReusedMoltAuditRow = {
        moltBlockId,
        role: block?.role ?? 'unknown',
        parentNeoBlockIds: neoBlockIds,
        parentNeoStackIds,
        usageCount: neoBlockIds.length,
        reuseAssessment: block ? assessReuse(block, neoBlockIds, parentNeoStackIds) : 'needs_local_binding_metadata',
        bindingFieldsPresent,
        bindingFieldsMissing
      };
      if (row.reuseAssessment !== 'safe') {
        warnings.push({ code: 'NEOBLOCK_REUSED_MOLT_WITHOUT_CONTEXTUAL_BINDING', severity: 'warning', moltBlockId, message: `${moltBlockId} is reused by ${neoBlockIds.length} NeoBlocks without the full local binding metadata contract.` });
      }
      return row;
    });

  return {
    sleeveId: sleeve.id,
    counts: {
      neoStacks: sleeve.neoStacks.length,
      neoBlocks: sleeve.neoBlocks.length,
      moltBlocks: sleeve.moltBlocks.length,
      gates: sleeve.gates.length
    },
    rows,
    reusedMoltBlocks,
    warnings,
    summary: {
      missingPrimary: rows.filter((row) => row.missingRoles.includes('primary')).length,
      missingLocalPrimary: rows.filter((row) => row.roleCounts.primary < 1).length,
      missingDirective: rows.filter((row) => row.missingRoles.includes('directive')).length,
      missingInstruction: rows.filter((row) => row.missingRoles.includes('instruction')).length,
      missingSubject: rows.filter((row) => row.missingRoles.includes('subject')).length,
      missingBlueprint: rows.filter((row) => row.missingBlueprint).length,
      duplicateRoleNeoBlocks: rows.filter((row) => row.duplicateRoles.length > 0).length,
      reusedMoltBlocks: reusedMoltBlocks.length
    }
  };
}
