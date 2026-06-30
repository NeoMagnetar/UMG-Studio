import type { NormalizedTemplateSleeve } from './templateSleeveStructures';

const compilerSupportedRoles = new Set(['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint']);
const maxFocusedMoltRolesPerNeoBlock = 6;

export type ArchitectSleeveCompilerValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  primaryRolePresent: boolean;
  gatesAreControlRecords: boolean;
  oversaturatedNeoBlockIds: string[];
};

export function validateGeneratedMoltForCompiler(molt: { id: string; role?: string; content?: string; parentNeoBlockId?: string }) {
  const errors: string[] = [];
  if (!molt.id) errors.push('MOLT id is required.');
  if (!molt.role || !compilerSupportedRoles.has(molt.role)) errors.push(`MOLT ${molt.id || '(unknown)'} role must be compiler-supported.`);
  if (!molt.parentNeoBlockId) errors.push(`MOLT ${molt.id || '(unknown)'} must be bound to a NeoBlock.`);
  if (typeof molt.content !== 'string') errors.push(`MOLT ${molt.id || '(unknown)'} content must be a string.`);
  return { valid: errors.length === 0, errors };
}

export function validateGeneratedNeoBlockForCompiler(args: {
  neoBlock: { id: string; moltBlockIds?: string[] };
  moltBlocks: Array<{ id: string; role?: string }>;
}) {
  const roles = args.moltBlocks.filter((molt) => args.neoBlock.moltBlockIds?.includes(molt.id)).map((molt) => molt.role);
  const errors: string[] = [];
  if (!args.neoBlock.id) errors.push('NeoBlock id is required.');
  if (!roles.includes('primary')) errors.push(`NeoBlock ${args.neoBlock.id || '(unknown)'} must include a Primary MOLT role for compiler/runtime governance.`);
  return {
    valid: errors.length === 0,
    errors,
    roleCount: roles.length,
    oversaturated: roles.length > maxFocusedMoltRolesPerNeoBlock
  };
}

export function validateArchitectSleeveForCompiler(sleeve: NormalizedTemplateSleeve): ArchitectSleeveCompilerValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const molt of sleeve.moltBlocks) {
    const validation = validateGeneratedMoltForCompiler(molt);
    errors.push(...validation.errors);
  }
  const neoBlockValidations = sleeve.neoBlocks.map((neoBlock) => ({ neoBlock, validation: validateGeneratedNeoBlockForCompiler({ neoBlock, moltBlocks: sleeve.moltBlocks }) }));
  for (const { validation } of neoBlockValidations) errors.push(...validation.errors);
  const primaryRolePresent = sleeve.moltBlocks.some((molt) => molt.role === 'primary');
  const gatesAreControlRecords = sleeve.gates.every((gate) => gate.metadata?.promptContent === false && !sleeve.moltBlocks.some((molt) => molt.id === gate.id));
  if (!primaryRolePresent) errors.push('At least one Primary MOLT role is required.');
  if (!gatesAreControlRecords) errors.push('Gates must remain control records and must not be emitted as prompt MOLT blocks.');
  const oversaturatedNeoBlockIds = neoBlockValidations.filter(({ validation }) => validation.oversaturated).map(({ neoBlock }) => neoBlock.id);
  if (oversaturatedNeoBlockIds.length) warnings.push('One or more NeoBlocks has more MOLT roles than the focused compiler guidance threshold.');
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    primaryRolePresent,
    gatesAreControlRecords,
    oversaturatedNeoBlockIds
  };
}
