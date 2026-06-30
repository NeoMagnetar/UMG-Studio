export const UMG_SUPPORTED_PROMPT_MOLT_ROLES = [
  'directive',
  'instruction',
  'subject',
  'primary',
  'philosophy',
  'blueprint'
] as const;

export type UmgSupportedPromptMoltRole = typeof UMG_SUPPORTED_PROMPT_MOLT_ROLES[number];

export type HermesUmgAppLocalSkillBundle = {
  id: 'umg_app_local_skill_bundle.phase13i_b';
  title: string;
  version: '13I-B';
  hierarchyCardSkill: string;
  sleeveDecompositionSkill: string;
  runtimeTraceSkill: string;
  compilerAlignmentRules: string;
  sourceLibraryBoundaryRules: string;
  capabilityBoundaryRules: string;
  supportedPromptMoltRoles: UmgSupportedPromptMoltRole[];
  websiteBuilderBoundary: string;
};

export const UMG_HIERARCHY_BLOCK_CARD_SKILL_TEXT = [
  'UMG hierarchy: MOLT -> NeoBlock -> NeoStack -> Sleeve. Templates instantiate reusable Sleeve patterns. Domain Packs are walled packages of templates, NeoStacks, NeoBlocks, and scoped internal MOLT cards.',
  'MOLT block: smallest focused prompt/cognition card. Current compiler-supported prompt roles are directive, instruction, subject, primary, philosophy, and blueprint.',
  'NeoBlock: discrete operational cognition unit. It should bind only load-bearing MOLT roles and should not be created for a mere variable, field, tone, or parameter inside an existing block.',
  'NeoStack: independent functional lane inside a Sleeve. It groups related NeoBlocks and constrains purpose, ordering, activation, route, and handoff.',
  'Sleeve: runtime-session operating package for a user goal, containing NeoStacks, NeoBlocks, MOLT bindings, gates/control records, capabilities, compile metadata, runtime metadata, and outputs.',
  'Natural-language block cards are human-facing projections; JSON cards are authoring/import records. Uploaded bundle schemas are authoring schemas, not direct compiler input.',
  'Visible cards differ from scoped/internal children: internal Domain Pack MOLT cards stay lazy/scoped and expand only for inspector, compile, export, or explicit review.',
  'Evidence labels: verified means inspected from current app/compiler/runtime/source; generated means created by this runtime/session; claimed means unverified prompt/document/model statement; runtime-session means active only in this UMG Studio session unless saved/promoted.',
  'Domain Pack walls: do not globally flood MOLT libraries with internal Domain Pack cards; allow cross-library mixing only when explicit and app-validated.',
  'Website Builder/Web Creation remains a future scoped Domain Pack: templates/NeoStacks/NeoBlocks may become visible after import, internal MOLT stays scoped/lazy, and no Website Builder import starts from generic Custom Workflow.'
].join('\n');

export const UMG_SLEEVE_DECOMPOSITION_SKILL_TEXT = [
  'UMG Sleeve Decomposition Skill: convert a Custom Workflow prompt into app-aligned Sleeve structure without mutating source libraries.',
  '1. Identify what the Sleeve is for: user goal, domain, outputs, constraints, and blocked/approval-gated external actions.',
  '2. Decide whether a controller, governance, routing, approval, or audit layer is needed. Controller/gate/governance concepts are controls, not automatic prompt MOLT blocks.',
  '3. Identify independent functional lanes and map them to NeoStacks.',
  '4. Within each lane, identify discrete operational units and map them to NeoBlocks.',
  '5. Before creating a NeoBlock, ask whether the need is a distinct operation or only a variable/input/tone/format inside an existing block.',
  '6. Use only load-bearing MOLT roles. Do not fill every MOLT role by default.',
  `7. Supported prompt MOLT roles for current compiler handoff: ${UMG_SUPPORTED_PROMPT_MOLT_ROLES.join(', ')}.`,
  '8. Library-first, generate-second: search loaded/local blocks first, reuse or modify matches, and generate only real gaps.',
  '9. Generated MOLT/NeoBlocks/NeoStacks must be runtime-session draft state with sourceLibraryWrite false unless the user explicitly saves/promotes.',
  '10. Check authority/governance consistency: decision authority, approval boundaries, blocked actions, draft-vs-final outputs, app-local safe tools vs external connectors.',
  '11. Gates are control/routing/approval records, not prompt MOLT blocks.',
  '12. Trigger/gate/governance/meta roles require careful mapping to current app/compiler reality; unsupported prompt roles become warnings or validation failures.',
  '13. Output must map to current app types: NormalizedTemplateSleeve, NormalizedTemplateNeoStack, NormalizedTemplateNeoBlock, NormalizedTemplateMoltBlock, UMGGateRecord, and capability declarations.',
  '14. Current compiler contract wins; do not feed uploaded bundle JSON card schemas directly into the compiler.'
].join('\n');

export const UMG_RUNTIME_TRACE_SKILL_TEXT = [
  'Runtime trace skill: execute only a supplied compiled Sleeve manifest. Use supplied Sleeve, NeoStack, NeoBlock, MOLT, Gate, source, tool, and approval IDs only.',
  'Unknown or unmapped runtime events stay timeline-only and must not activate visual geometry.',
  'Emit structured trace events for run, sleeve, neostack, neoblock, MOLT role, gate, tool, approval, route, completion, blocked, and error transitions when supported.',
  'Compiler trace is not Hermes runtime trace; activation/glow comes only from real returned Hermes runtime trace.'
].join('\n');

export const UMG_COMPILER_ALIGNMENT_RULES = [
  'Current app/compiler/runtime schemas are authoritative.',
  'Hermes generation must map into app-aligned structures before compile.',
  'NormalizedTemplateSleeve shape: id, title, version, description, isTemplate, templateKind, source, tags, neoStacks, neoBlocks, moltBlocks, gates, governanceBlockIds, defaultExecutionMode, metadata.',
  'NeoStack shape: id, title, description, stackOrder, tags, neoBlockIds.',
  'NeoBlock shape: id, title, description, neoStackId, blockOrder, tags, moltBlockIds, gateIds, defaultState, optional runtimeState.',
  'MOLT shape: id, optional sourceId, title, role, content, tags, optional parentNeoBlockId, optional parentNeoStackId, optional sourceNotes, defaultState.',
  `Supported prompt MOLT roles: ${UMG_SUPPORTED_PROMPT_MOLT_ROLES.join(', ')}.`,
  'Gates are UMGGateRecord/control records, not prompt MOLT records.',
  'Bundle block-card JSON schemas are authoring/import schemas and must not be sent directly to the compiler.'
].join('\n');

export const UMG_SOURCE_LIBRARY_BOUNDARY_RULES = [
  'No source-library mutation from Custom Workflow generation by default.',
  'Generated content persistence is runtime-session only unless the user explicitly saves/promotes.',
  'Generated records must not be presented as verified source-library records.',
  'No global Hermes skill install or ~/.hermes config writes are required for app-local skill use.',
  'Source evidence must distinguish verified, generated, claimed, and runtime-session state.'
].join('\n');

export const UMG_CAPABILITY_BOUNDARY_RULES = [
  'Capabilities are declarations until resolved by the app-local capability registry.',
  'Unknown or unavailable capabilities must not be treated as available tools.',
  'Safe app-local capabilities may create non-destructive artifacts only.',
  'External Gmail/browser/refund/inventory/API actions are not executed by this path.',
  'Irreversible or high-risk actions require explicit confirmation and connector setup before execution.'
].join('\n');

export const UMG_WEBSITE_BUILDER_BOUNDARY = [
  'Website Builder / Web Creation is a future scoped Domain Pack, not the default Custom Workflow path.',
  'Keep Website Builder greyed/scoped until explicitly imported.',
  'After import, templates, NeoStacks, and NeoBlocks may be visible; internal MOLT remains scoped/lazy.',
  'No global MOLT flooding and no implicit cross-library mixing.'
].join('\n');

export function getHermesUmgAppLocalSkillBundle(): HermesUmgAppLocalSkillBundle {
  return {
    id: 'umg_app_local_skill_bundle.phase13i_b',
    title: 'UMG App-Local Hierarchy, Decomposition, Runtime, and Boundary Skill Bundle',
    version: '13I-B',
    hierarchyCardSkill: UMG_HIERARCHY_BLOCK_CARD_SKILL_TEXT,
    sleeveDecompositionSkill: UMG_SLEEVE_DECOMPOSITION_SKILL_TEXT,
    runtimeTraceSkill: UMG_RUNTIME_TRACE_SKILL_TEXT,
    compilerAlignmentRules: UMG_COMPILER_ALIGNMENT_RULES,
    sourceLibraryBoundaryRules: UMG_SOURCE_LIBRARY_BOUNDARY_RULES,
    capabilityBoundaryRules: UMG_CAPABILITY_BOUNDARY_RULES,
    supportedPromptMoltRoles: [...UMG_SUPPORTED_PROMPT_MOLT_ROLES],
    websiteBuilderBoundary: UMG_WEBSITE_BUILDER_BOUNDARY
  };
}
