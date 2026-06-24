import { CompileResult, GraphNode, IRMatrixRow, NeoBlock, NeoStack, Sleeve, UMGWorkspace } from './types';

export const LOCAL_GENERATE_COMPILE_FIRST_MESSAGE = 'Compose and Compile first to generate local fallback output.';
export const LOCAL_GENERATE_STATUS = 'Generated locally from compiled RuntimeSpec fallback.';

type LocalGenerateInput = {
  userRequest: string;
  workspace?: UMGWorkspace;
  compiled?: CompileResult;
};

function runtimeSpecSummary(runtimeSpec: unknown) {
  if (!runtimeSpec || typeof runtimeSpec !== 'object') return 'source: unknown';
  const spec = runtimeSpec as Record<string, unknown>;
  return [
    `source: ${String(spec.source ?? 'unknown')}`,
    `compiler: ${String(spec.compiler ?? 'unknown')}`,
    `sleeveId: ${String(spec.sleeveId ?? 'unknown')}`,
    `hasErrors: ${String(spec.hasErrors ?? false)}`
  ].join('; ');
}

function activeMoltRows(rows: IRMatrixRow[]) {
  return rows.filter((row) => row.nodeType === 'molt_block' && Boolean(row.active) && !Boolean(row.off));
}

function formatRows(rows: IRMatrixRow[]) {
  if (!rows.length) return '- none';
  return rows.slice(0, 12).map((row) => `- ${row.title} (${row.role ?? row.nodeType}; active=${String(row.active)}; off=${String(row.off)})`).join('\n');
}

function formatStructure(sleeve?: Sleeve) {
  if (!sleeve) return '- Workspace root: unavailable';
  const lines = [`- Sleeve/root: ${sleeve.title}`];
  for (const stack of sleeve.stacks.slice(0, 4)) lines.push(...formatStack(stack));
  return lines.join('\n');
}

function formatStack(stack: NeoStack) {
  const lines = [`  - NeoStack: ${stack.title}`];
  for (const neoblock of stack.neoblocks.slice(0, 6)) lines.push(...formatNeoBlock(neoblock));
  return lines;
}

function formatNeoBlock(neoblock: NeoBlock) {
  const blockTitles = neoblock.blocks.slice(0, 6).map((block) => `${block.title} [${block.role}]`).join('; ');
  return [`    - NeoBlock: ${neoblock.title}${blockTitles ? ` -> ${blockTitles}` : ''}`];
}

function outputNodeSummary(nodes?: GraphNode[]) {
  const outputNodes = (nodes ?? []).filter((node) => node.nodeType === 'output');
  if (!outputNodes.length) return 'Output/render node: not present in current workspace graph.';
  return `Output/render node: ${outputNodes.map((node) => node.label).join(', ')}`;
}

export function buildLocalGenerateFallback(input: LocalGenerateInput) {
  if (!input.compiled) {
    return { ok: false, output: LOCAL_GENERATE_COMPILE_FIRST_MESSAGE, status: LOCAL_GENERATE_COMPILE_FIRST_MESSAGE };
  }

  const sleeve = input.workspace?.sleeves.find((candidate) => candidate.id === input.workspace?.activeSleeveId) ?? input.workspace?.sleeves[0];
  const selectedRows = activeMoltRows(input.compiled.irMatrix);
  const graphSummary = outputNodeSummary(input.workspace?.graph.nodes);
  const request = input.userRequest.trim() || 'Build a useful customer intake chatbot.';

  const output = [
    'Customer Intake Chatbot Draft',
    '',
    'generated locally from compiled RuntimeSpec fallback.',
    'Safety: no route switching performed; no live tool execution performed; no ActionGate execution performed.',
    '',
    'Purpose',
    `Create a concise mobile-detailing customer intake chatbot from the compiled workspace. User request: ${request}`,
    '',
    'Greeting',
    'Hi! I can help with mobile detailing. I will ask a few quick questions so we can understand your vehicle, location, service need, and budget, then summarize the lead for follow-up.',
    '',
    'Basic Questions',
    '1. What is your name and best phone or email for follow-up?',
    '2. What vehicle do you need detailed? Include year, make, model, and condition if known.',
    '3. Where is the vehicle located, and is mobile service allowed at that location?',
    '4. What service do you need: exterior, interior, full detail, stain/odor removal, ceramic/wax, or something else?',
    '5. What is your preferred date/time window?',
    '6. What budget range are you trying to stay within?',
    '',
    'Required Customer Fields',
    '- Customer name',
    '- Contact method',
    '- Vehicle: year / make / model / condition',
    '- Location: address or service area plus mobile access constraints',
    '- Service need: requested detail package or problem to solve',
    '- Budget collection: stated range or quote-needed flag',
    '- Timing: preferred appointment window',
    '',
    'Vehicle / Location / Service Need / Budget Collection',
    '- Vehicle: collect type, size, current condition, and special concerns.',
    '- Location: confirm service address/area, parking/access, water/power constraints if relevant.',
    '- Service need: identify primary job and any add-ons or urgent issues.',
    '- Budget: ask for a range, then mark whether pricing is fixed, flexible, or requires review.',
    '',
    'Lead Summary Format',
    'Customer: [name + contact]',
    'Vehicle: [year/make/model/condition]',
    'Location: [service area/address + access notes]',
    'Need: [requested service + add-ons/problems]',
    'Budget: [range or quote needed]',
    'Timing: [preferred date/time]',
    'Next Step: [follow-up, quote, schedule, or request missing details]',
    '',
    'Notes / Safety / Follow-up Guidance',
    '- Ask only for practical scheduling and service details.',
    '- Do not guarantee price before reviewing vehicle/service details.',
    '- Flag missing required fields before handoff.',
    '- Recommend human follow-up for unclear vehicle condition, safety concerns, or special surfaces/materials.',
    '',
    'Compiled Workspace Evidence',
    `Workspace title: ${input.workspace?.title ?? 'untitled workspace'}`,
    `RuntimeSpec summary: ${runtimeSpecSummary(input.compiled.runtimeSpec)}`,
    graphSummary,
    '',
    'Composed Sleeve / NeoStack / NeoBlock Structure',
    formatStructure(sleeve),
    '',
    'Selected MOLT Cards / Active IR Rows',
    formatRows(selectedRows),
    '',
    'Boundaries',
    '- Fallback used only local app data: user request, workspace structure, selected MOLT roles/titles, RuntimeSpec summary, IR Matrix rows, and graph output-node state.',
    '- HUMAN/GATES sources are not imported as prompt content.',
    '- Trigger MOLT blocks are not created.',
    '- Route switching, live tool execution, and ActionGate execution remain disabled.'
  ].join('\n');

  return { ok: true, output, status: LOCAL_GENERATE_STATUS };
}
