import type { UMGCompiledRuntimeManifest, UMGTraceEventType } from './cognitiveRuntimeTypes';
import type { HermesToolCapabilityRegistryEntry } from './hermesToolCapabilityRegistry';
import { getHermesUmgAppLocalSkillBundle, type HermesUmgAppLocalSkillBundle } from './hermesUmgSkillBundle';

export const UMG_RUNTIME_TRACE_EVENT_TYPES: UMGTraceEventType[] = [
  'run_started',
  'sleeve_loaded',
  'neostack_started',
  'neostack_completed',
  'neoblock_started',
  'neoblock_completed',
  'molt_role_used',
  'gate_evaluated',
  'gate_opened',
  'gate_blocked',
  'tool_call_prepared',
  'tool_call_requires_approval',
  'approval_granted',
  'approval_denied',
  'tool_call_executed',
  'tool_call_blocked',
  'tool_result_received',
  'neoblock_rerouted',
  'run_completed',
  'run_error'
];

export type HermesUmgRuntimeSkillPack = {
  id: 'umg_runtime_skill_pack.v1';
  title: string;
  instructions: string;
  appLocalSkillBundle: HermesUmgAppLocalSkillBundle;
  traceEventTypes: UMGTraceEventType[];
  outputEnvelopeSchema: {
    required: string[];
    eventRequired: string[];
  };
};

export type GeometryTraceMappingIds = {
  sleeveId?: string;
  neoStackIds: string[];
  neoBlockIds: string[];
  moltBlockIds: string[];
  gateIds: string[];
  sourceIds: string[];
};

export type HermesUmgRuntimeSkillPacket = {
  skillPack: HermesUmgRuntimeSkillPack;
  compiledRuntimeManifest: UMGCompiledRuntimeManifest;
  geometryTraceMappingIds: GeometryTraceMappingIds;
  toolCapabilityRegistry: HermesToolCapabilityRegistryEntry[];
  expectedTraceSchema: {
    eventTypes: UMGTraceEventType[];
    rule: string;
  };
};

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

export function getHermesUmgRuntimeSkillPack(): HermesUmgRuntimeSkillPack {
  const appLocalSkillBundle = getHermesUmgAppLocalSkillBundle();
  return {
    id: 'umg_runtime_skill_pack.v1',
    title: 'UMG Runtime Skill Pack',
    appLocalSkillBundle,
    traceEventTypes: UMG_RUNTIME_TRACE_EVENT_TYPES,
    outputEnvelopeSchema: {
      required: ['traceId', 'status', 'finalOutput', 'events', 'toolCalls', 'blockedCalls', 'approvalRequests', 'errors', 'artifacts', 'unmappedEvents'],
      eventRequired: ['eventId', 'timestamp', 'eventType', 'message', 'scopeKind', 'status']
    },
    instructions: [
      'UMG Runtime Skill Pack: execute the supplied compiled Sleeve as the cognitive operating structure.',
      'App-local UMG Skill Bundle is attached: hierarchy/card skill, Sleeve decomposition skill, compiler alignment rules, source-library boundaries, capability boundaries, and Website Builder Domain Pack walling rules.',
      appLocalSkillBundle.hierarchyCardSkill,
      appLocalSkillBundle.sleeveDecompositionSkill,
      appLocalSkillBundle.compilerAlignmentRules,
      appLocalSkillBundle.sourceLibraryBoundaryRules,
      appLocalSkillBundle.capabilityBoundaryRules,
      appLocalSkillBundle.websiteBuilderBoundary,
      appLocalSkillBundle.runtimeTraceSkill,
      'Hierarchy: Sleeve contains NeoStacks; NeoStacks contain NeoBlocks; NeoBlocks use focused MOLT roles; Gate/control record entries are controls, not prompt MOLT blocks; Tool capabilities are declarations until resolved.',
      'Runtime behavior: select active NeoStacks/NeoBlocks from the user goal, current route, and runtime context; use MOLT roles as local cognitive guidance; evaluate Gates before tool/capability execution; keep unused blocks inactive/off; route dynamically from real trace/results.',
      'ID rule: do not invent IDs. Use supplied Sleeve, NeoStack, NeoBlock, MOLT, Gate, source, tool, and approval IDs only. If relevant ID is unknown, return the attempted event in unmappedEvents without visual IDs.',
      `Trace contract: emit structured events when possible: ${UMG_RUNTIME_TRACE_EVENT_TYPES.join(', ')}.`,
      'Capability behavior: capabilities are not assumed tools. Resolve through the supplied toolCapabilityRegistry. Unknown/unavailable capabilities must be blocked/unavailable, not silently treated as successful external tool execution. Safe configured customer_message_draft/report_generate capabilities may create app-local non-destructive artifacts only; customer_message_draft returns draft text and never sends email. If customer_message_draft completes and report_generate is safe/available, a second routed report artifact may be generated without external side effects.',
      'Approval behavior: approval-required capabilities emit tool_call_requires_approval. Approved safe configured capabilities may emit tool_call_executed/tool_result_received. Irreversible actions require explicit confirmation and must not execute from this proof path.',
      'Output format: return only the exact JSON envelope: traceId, status, finalOutput, events, toolCalls, blockedCalls, approvalRequests, errors, artifacts, unmappedEvents.'
    ].join('\n')
  };
}

export function collectGeometryTraceMappingIds(manifest: UMGCompiledRuntimeManifest): GeometryTraceMappingIds {
  return {
    sleeveId: manifest.sleeveId,
    neoStackIds: manifest.sourceBlocks.filter((block) => block.scopeKind === 'neostack').map((block) => block.id),
    neoBlockIds: manifest.sourceBlocks.filter((block) => block.scopeKind === 'neoblock').map((block) => block.id),
    moltBlockIds: manifest.sourceBlocks.filter((block) => block.scopeKind === 'molt').map((block) => block.id),
    gateIds: unique([
      ...manifest.gates.map((gate) => gate.id),
      ...manifest.sourceBlocks.filter((block) => block.scopeKind === 'gate').map((block) => block.id)
    ]),
    sourceIds: unique(manifest.sourceBlocks.map((block) => block.sourcePath ?? (typeof block.metadata?.sourceId === 'string' ? block.metadata.sourceId : undefined)))
  };
}

export function buildHermesUmgRuntimeSkillPacket(args: {
  manifest: UMGCompiledRuntimeManifest;
  toolCapabilityRegistry: HermesToolCapabilityRegistryEntry[];
}): HermesUmgRuntimeSkillPacket {
  return {
    skillPack: getHermesUmgRuntimeSkillPack(),
    compiledRuntimeManifest: args.manifest,
    geometryTraceMappingIds: collectGeometryTraceMappingIds(args.manifest),
    toolCapabilityRegistry: args.toolCapabilityRegistry,
    expectedTraceSchema: {
      eventTypes: UMG_RUNTIME_TRACE_EVENT_TYPES,
      rule: 'Only supplied IDs may activate UMG visual state; unknown IDs go to unmappedEvents.'
    }
  };
}
