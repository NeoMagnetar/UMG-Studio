import { MOLTRole, NeoBlock, NeoStack, Sleeve, UMGBlock, UMGControllerBlock, UMGControllerKind, UMGDirectiveBundle, UMGScopeKind } from './types';

// Phase3C Option B compatibility helpers.
// Virtual controllers adapt old data, are not persisted unless a later save/migration pass explicitly does so,
// and rootController is never treated as an ordinary child.

type ScopeControllerArgs = {
  scopeKind: UMGScopeKind;
  scopeId: string;
  scopeTitle: string;
};

type SupportedScope = Sleeve | NeoStack;

const recommendedControllerRoles: MOLTRole[] = ['subject', 'primary', 'instruction', 'directive', 'blueprint'];

const controllerKindByScopeKind: Record<UMGScopeKind, UMGControllerKind> = {
  sleeve: 'sleeve_root',
  neostack: 'neostack_root',
  neoblock_subgraph: 'neoblock_subgraph_root'
};

const controllerRoleOrder: Record<MOLTRole, number> = {
  subject: 10,
  primary: 20,
  instruction: 30,
  directive: 40,
  blueprint: 50,
  philosophy: 60,
  trigger: 70
};

function getScopeKind(scope: SupportedScope): UMGScopeKind {
  return scope.type === 'sleeve' ? 'sleeve' : 'neostack';
}

function buildVirtualControllerBlock(args: {
  controllerId: string;
  scopeKind: UMGScopeKind;
  scopeTitle: string;
  role: MOLTRole;
}): UMGBlock {
  const roleTitle = `${args.scopeTitle} ${args.role.charAt(0).toUpperCase()}${args.role.slice(1)}`;
  const orderIndex = controllerRoleOrder[args.role] ?? 999;

  return {
    id: `${args.controllerId}__${args.role}`,
    title: roleTitle,
    type: 'molt_block',
    role: args.role,
    displayType: args.role,
    content: `Virtual ${args.role} block for ${args.scopeTitle} ${args.scopeKind} controller compatibility.`,
    description: `Virtual ${args.role} block for Phase3C Option B scope compatibility.`,
    category: 'controller',
    tags: ['controller', 'virtual', 'scope', args.scopeKind, args.role],
    priorityOrder: orderIndex,
    hierarchy: { orderIndex, orderSource: 'priorityOrder', priorityMeaning: 'hierarchy_order' },
    defaultState: 'on',
    visibility: 'visible',
    activation: { mode: 'always' },
    sourcePath: `virtual://scope-controller/${args.controllerId}#${args.role}`,
    sourceLayer: 'AI',
    status: 'reference-only',
    presentationStatus: 'reference-only',
    source: { origin: 'generated', sourceId: `${args.controllerId}#${args.role}`, version: 'phase3c3.virtual-controller.v1' }
  };
}

function buildVirtualDirectiveBundle(ownerBlockId: string, directiveBlockId: string): UMGDirectiveBundle {
  return {
    ownerBlockId,
    directives: [
      {
        moltId: directiveBlockId,
        priority: 1,
        label: 'Virtual Default Directive',
        defaultState: 'active'
      }
    ],
    defaultDirectiveId: directiveBlockId,
    activeDirectiveId: directiveBlockId,
    activationPolicy: 'priority_order'
  };
}

function cloneMoltBlock(block: UMGBlock): UMGBlock {
  return {
    ...block,
    tags: [...block.tags],
    hierarchy: block.hierarchy ? { ...block.hierarchy } : undefined,
    activation: block.activation ? { ...block.activation, tags: block.activation.tags ? [...block.activation.tags] : undefined } : undefined,
    dependencies: block.dependencies ? [...block.dependencies] : undefined,
    conflicts: block.conflicts ? [...block.conflicts] : undefined,
    compatibleSleeves: block.compatibleSleeves ? [...block.compatibleSleeves] : undefined,
    compatibleStacks: block.compatibleStacks ? [...block.compatibleStacks] : undefined,
    source: block.source ? { ...block.source } : undefined,
    legacy: block.legacy
      ? {
          ...block.legacy,
          migrationWarnings: block.legacy.migrationWarnings ? [...block.legacy.migrationWarnings] : undefined,
          parseWarnings: block.legacy.parseWarnings ? [...block.legacy.parseWarnings] : undefined
        }
      : undefined
  };
}

function cloneDirectiveBundle(rootController: UMGControllerBlock): UMGDirectiveBundle | undefined {
  if (!rootController.directiveBundle) return undefined;

  return {
    ...rootController.directiveBundle,
    directives: rootController.directiveBundle.directives.map((directive) => ({
      ...directive,
      compatibleWith: directive.compatibleWith ? [...directive.compatibleWith] : undefined,
      conflictsWith: directive.conflictsWith ? [...directive.conflictsWith] : undefined
    }))
  };
}

function cloneRootController(rootController: UMGControllerBlock): UMGControllerBlock {
  return {
    ...rootController,
    molts: rootController.molts.map((block) => cloneMoltBlock(block)),
    directiveBundle: cloneDirectiveBundle(rootController),
    metadata: rootController.metadata ? { ...rootController.metadata } : undefined
  };
}

export function hasMoltRole(blocks: readonly UMGBlock[], role: MOLTRole): boolean {
  return blocks.some((block) => block.role === role);
}

export function createVirtualRootController(args: ScopeControllerArgs): UMGControllerBlock {
  const controllerId = `${args.scopeId}__virtual_root_controller`;
  const title = `${args.scopeTitle} Controller`;
  const molts = recommendedControllerRoles.map((role) => buildVirtualControllerBlock({ controllerId, scopeKind: args.scopeKind, scopeTitle: args.scopeTitle, role }));
  const directiveBlock = molts.find((block) => block.role === 'directive');

  return {
    id: controllerId,
    title,
    controllerKind: controllerKindByScopeKind[args.scopeKind],
    ownerScopeKind: args.scopeKind,
    ownerScopeId: args.scopeId,
    molts,
    directiveBundle: directiveBlock ? buildVirtualDirectiveBundle(controllerId, directiveBlock.id) : undefined,
    metadata: {
      createdBy: 'virtual',
      scopePurpose: `Fallback root controller for ${args.scopeTitle} ${args.scopeKind} scope compatibility.`,
      version: 'phase3c3.virtual-controller.v1'
    }
  };
}

export function normalizeNeoStack(neoStack: NeoStack): NeoStack {
  return {
    ...neoStack,
    tags: [...neoStack.tags],
    neoblocks: [...neoStack.neoblocks],
    directBlocks: neoStack.directBlocks ? [...neoStack.directBlocks] : undefined,
    rootController: neoStack.rootController
      ? cloneRootController(neoStack.rootController)
      : createVirtualRootController({
          scopeKind: 'neostack',
          scopeId: neoStack.id,
          scopeTitle: neoStack.title
        })
  };
}

export function normalizeSleeve(sleeve: Sleeve): Sleeve {
  return {
    ...sleeve,
    tags: [...sleeve.tags],
    stacks: sleeve.stacks.map((stack) => normalizeNeoStack(stack)),
    runtimeConfig: { ...sleeve.runtimeConfig },
    metadata: sleeve.metadata ? { ...sleeve.metadata } : undefined,
    rootController: sleeve.rootController
      ? cloneRootController(sleeve.rootController)
      : createVirtualRootController({
          scopeKind: 'sleeve',
          scopeId: sleeve.id,
          scopeTitle: sleeve.title
        })
  };
}

export function getScopeChildren(scope: SupportedScope): Array<NeoStack | NeoBlock> {
  return scope.type === 'sleeve' ? [...scope.stacks] : [...scope.neoblocks];
}

export function validateScopeController(scope: SupportedScope): string[] {
  const warnings: string[] = [];
  const scopeKind = getScopeKind(scope);
  const rootController = scope.rootController;

  if (!rootController) {
    warnings.push(`Missing rootController for ${scope.type} ${scope.id}.`);
    return warnings;
  }

  if (rootController.ownerScopeId !== scope.id) {
    warnings.push(`rootController ownerScopeId mismatch for ${scope.type} ${scope.id}.`);
  }

  if (rootController.ownerScopeKind !== scopeKind) {
    warnings.push(`rootController ownerScopeKind mismatch for ${scope.type} ${scope.id}.`);
  }

  const ordinaryChildren = scope.type === 'sleeve' ? scope.stacks : scope.neoblocks;
  if (ordinaryChildren.some((child) => child.id === rootController.id)) {
    warnings.push(`rootController appears in ordinary children for ${scope.type} ${scope.id}.`);
  }

  if (!rootController.molts.length) {
    warnings.push(`rootController has no MOLT blocks for ${scope.type} ${scope.id}.`);
  }

  for (const role of recommendedControllerRoles) {
    if (!hasMoltRole(rootController.molts, role)) {
      warnings.push(`rootController missing recommended ${role} role for ${scope.type} ${scope.id}.`);
    }
  }

  return warnings;
}
