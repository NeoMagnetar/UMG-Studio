import { describe, expect, it } from 'vitest';
import { composeNeoBlockFromMoltBlocks, retrieveNeoBlockMoltCandidates, summarizeSourceLibraryMoltInventory, analyzeImportedSleeveNeoBlockComposition } from '../lib/umg/moltNeoBlockComposer';
import { buildRuntimeGeometryManifest } from '../lib/umg/runtimeGeometryProjection';

const sourceIndex = [
  { id: 'DIR.SERVUO', title: 'Protect shard source edits', blockType: 'molt', role: 'directive', tags: ['servuo', 'uo', 'policy'], description: 'Require safe reviewed ServUO shard script edits.', content: 'ServUO shard script edits must be reviewed.', category: 'coders', sourceKind: 'source-library', sourcePath: 'AI/MOLT-BLOCKS/directives/library.json#DIR.SERVUO' },
  { id: 'INST.ITEM', title: 'Implement C# item script', blockType: 'molt', role: 'instruction', tags: ['servuo', 'csharp', 'item'], description: 'Steps for creating a ServUO C# item script.', content: 'Create C# item script with constructors and serialization.', category: 'coders', sourceKind: 'source-library', sourcePath: 'AI/MOLT-BLOCKS/instructions/library.json#INST.ITEM' },
  { id: 'SUBJ.POISON', title: 'Deadly poison charge item', blockType: 'molt', role: 'subject', tags: ['uo', 'poison', 'dagger'], description: 'Dagger with deadly poison charge behavior.', content: 'Deadly poison charges attached to a dagger item.', category: 'uo', sourceKind: 'source-library', sourcePath: 'AI/MOLT-BLOCKS/subjects/library.json#SUBJ.POISON' },
  { id: 'PRIM.ARTIFACT', title: 'Compiled shard script artifact', blockType: 'molt', role: 'primary', tags: ['artifact', 'script'], description: 'Final C# script artifact.', content: 'A validated C# script file is the output artifact.', category: 'output', sourceKind: 'source-library', sourcePath: 'AI/MOLT-BLOCKS/primary/library.json#PRIM.ARTIFACT' },
  { id: 'PHIL.SAFE', title: 'Server-safe changes', blockType: 'molt', role: 'philosophy', tags: ['safety', 'review'], description: 'Favor source-safe server changes.', content: 'Preserve server stability and auditability.', category: 'philosophy', sourceKind: 'source-library', sourcePath: 'AI/MOLT-BLOCKS/philosophy/library.json#PHIL.SAFE' },
  { id: 'BP.SCRIPT', title: 'ServUO item blueprint', blockType: 'molt', role: 'blueprint', tags: ['servuo', 'item', 'blueprint'], description: 'Blueprint for ServUO item script creation.', content: 'Define item class, properties, serialization, and validation.', category: 'blueprint', sourceKind: 'source-library', sourcePath: 'AI/MOLT-BLOCKS/blueprints/library.json#BP.SCRIPT' },
  { id: 'NB.PACKAGE', title: 'Imported package NeoBlock', blockType: 'neoblock', tags: ['servuo'], description: 'Not a MOLT candidate.', category: 'uo', sourceKind: 'source-library', sourcePath: 'AI/NEOBLOCKS/package.json#NB.PACKAGE' }
];

const workspaceBlocks = [
  { id: 'workspace.molt.instruction.servuo-poison-charge.v0.1', title: 'Workspace ServUO Poison Charge Instruction', role: 'instruction', tags: ['servuo', 'poison', 'workspace-draft'], category: 'uo', description: 'Draft workspace instruction for poison charges.', content: 'Add charge decrement and poison application handling.', sourceKind: 'workspace-draft', generationReason: 'test draft', nlCard: {}, jsonSchema: {}, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', status: 'validated' }
];

describe('source-library MOLT to NeoBlock composition', () => {
  it('summarizes source-library MOLT inventory without mutating the library', () => {
    const inventory = summarizeSourceLibraryMoltInventory(sourceIndex);
    expect(inventory.totalEntries).toBe(7);
    expect(inventory.moltLikeEntries).toBe(6);
    expect(inventory.roleCounts.directive).toBe(1);
    expect(inventory.roleCounts.instruction).toBe(1);
    expect(inventory.roleCounts.subject).toBe(1);
    expect(inventory.roleCounts.primary).toBe(1);
    expect(inventory.roleCounts.philosophy).toBe(1);
    expect(inventory.roleCounts.blueprint).toBe(1);
    expect(inventory.mutationOccurred).toBe(false);
  });

  it('retrieves ranked source, workspace, and imported MOLT candidates with why-selected evidence', () => {
    const result = retrieveNeoBlockMoltCandidates({
      userPrompt: 'Make me a dagger with 1000 deadly poison charges',
      sleeveDomain: 'Ultima Online ServUO C# shard scripting',
      neoStackTitle: 'UO Item Scripting',
      neoBlockPurpose: 'Create a ServUO item scripting NeoBlock',
      tags: ['servuo', 'poison', 'dagger'],
      sourceIndex,
      workspaceBlocks,
      importedMoltBlocks: [{ id: 'PKG.MOLT.POISON', title: 'Package poison note', role: 'subject', tags: ['poison'], content: 'Imported sleeve note about poison.', sourceKind: 'runtime-session draft' }]
    });
    expect(result.rankedCandidates.length).toBeGreaterThan(4);
    expect(result.selectedMoltBlocks.some((entry) => entry.id === 'SUBJ.POISON')).toBe(true);
    expect(result.selectedMoltBlocks.some((entry) => entry.sourceKind === 'workspace-draft')).toBe(true);
    expect(result.selectedMoltBlocks.every((entry) => entry.whySelected.length > 0)).toBe(true);
    expect(result.rejectedCandidates.some((entry) => entry.id === 'NB.PACKAGE')).toBe(false);
  });

  it('composes a valid NeoBlock from selected MOLT Blocks and reports role coverage', () => {
    const result = composeNeoBlockFromMoltBlocks({
      userPrompt: 'Create a ServUO item scripting NeoBlock for a deadly poison dagger',
      sleeveDomain: 'Ultima Online ServUO C# shard scripting',
      parentNeoStackId: 'STACK.UO.ITEMS',
      parentNeoStackTitle: 'UO Item Scripting',
      neoBlockPurpose: 'Create a ServUO item scripting NeoBlock',
      tags: ['servuo', 'poison', 'dagger'],
      sourceIndex,
      workspaceBlocks
    });
    expect(result.validationStatus).toBe('valid');
    expect(result.neoBlock.title).toContain('ServUO item scripting');
    expect(result.neoBlock.neoStackId).toBe('STACK.UO.ITEMS');
    expect(result.moltBlocks.length).toBeGreaterThanOrEqual(6);
    expect(result.roleCoverage.directive.covered).toBe(true);
    expect(result.roleCoverage.instruction.covered).toBe(true);
    expect(result.roleCoverage.subject.covered).toBe(true);
    expect(result.roleCoverage.primary.covered).toBe(true);
    expect(result.roleCoverage.philosophy.covered).toBe(true);
    expect(result.roleCoverage.blueprint.covered).toBe(true);
    expect(result.evidence.selectedMoltBlocks[0].whySelected.length).toBeGreaterThan(0);
    expect(result.evidence.sourceBoundCount).toBeGreaterThan(0);
    expect(result.evidence.workspaceDraftCount).toBeGreaterThan(0);
  });

  it('reports missing roles honestly and never marks imported package data as source-library matched', () => {
    const result = composeNeoBlockFromMoltBlocks({
      userPrompt: 'Create a small UO poison note module',
      sleeveDomain: 'UO',
      parentNeoStackId: 'STACK.UO.ITEMS',
      parentNeoStackTitle: 'UO Item Scripting',
      neoBlockPurpose: 'Poison note module',
      requiredRoles: ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'],
      sourceIndex: sourceIndex.filter((entry) => entry.role !== 'blueprint'),
      importedMoltBlocks: [{ id: 'PKG.BLUEPRINT', title: 'Imported blueprint', role: 'blueprint', tags: ['uo'], content: 'Package-only blueprint.', sourceKind: 'runtime-session draft' }]
    });
    expect(result.validationStatus).toBe('needs_role_review');
    expect(result.missingRoleWarnings).toContain('blueprint');
    const imported = result.moltBlocks.find((block) => block.id.includes('PKG.BLUEPRINT'));
    expect(imported?.sourceKind).toBe('runtime-session draft');
    expect(imported?.matchedCandidateId).toBeUndefined();
  });

  it('projects composition evidence into Runtime Inspector metadata', () => {
    const composed = composeNeoBlockFromMoltBlocks({
      userPrompt: 'Create a ServUO item scripting NeoBlock for a deadly poison dagger',
      sleeveDomain: 'Ultima Online ServUO C# shard scripting',
      parentNeoStackId: 'STACK.UO.ITEMS',
      parentNeoStackTitle: 'UO Item Scripting',
      neoBlockPurpose: 'Create a ServUO item scripting NeoBlock',
      tags: ['servuo', 'poison', 'dagger'],
      sourceIndex,
      workspaceBlocks
    });
    const manifest = buildRuntimeGeometryManifest({
      templateSleeve: {
        id: 'SLV.TEST', title: 'Test Sleeve', version: '0.1', description: 'test', isTemplate: true, templateKind: 'custom', source: 'session', tags: [],
        neoStacks: [{ id: 'STACK.UO.ITEMS', title: 'UO Item Scripting', description: 'stack', stackOrder: 1, tags: [], neoBlockIds: [composed.neoBlock.id] }],
        neoBlocks: [composed.neoBlock],
        moltBlocks: composed.moltBlocks,
        gates: [], governanceBlockIds: [], defaultExecutionMode: 'approvalRequired', metadata: {}
      }
    });
    const node = manifest.nodes.find((entry) => entry.kind === 'neoblock');
    expect(node?.metadata?.compositionEvidence).toBeTruthy();
    expect(node?.metadata?.compositionEvidence.sourceBoundCount).toBeGreaterThan(0);
    expect(node?.metadata?.compositionEvidence.selectedMoltBlocks[0].whySelected.length).toBeGreaterThan(0);
  });

  it('analyzes imported UO sleeve NeoBlock composition as package-only unless source matches are explicit', () => {
    const analysis = analyzeImportedSleeveNeoBlockComposition({
      neoBlocks: [{ id: 'NB.UO.POISON', title: 'Poison Dagger Item', description: 'ServUO poison dagger behavior', moltBlockIds: ['PKG.MOLT.POISON'] }],
      moltBlocks: [{ id: 'PKG.MOLT.POISON', title: 'Package poison note', role: 'subject', tags: ['poison'], content: 'Imported package MOLT.', sourceKind: 'runtime-session draft' }],
      sourceIndex
    });
    expect(analysis.packageProvidedNeoBlocks).toBe(1);
    expect(analysis.sourceLibraryMatchedMoltBlocks).toBeGreaterThan(0);
    expect(analysis.neoBlocks[0].compositionMode).toBe('package-plus-source-suggestions');
    expect(analysis.neoBlocks[0].matchedSourceMoltIds).toContain('SUBJ.POISON');
    expect(analysis.neoBlocks[0].packageMoltIds).toContain('PKG.MOLT.POISON');
  });
});
