import { makeMinimalSchema, makeNlCard } from './umgSchemaProximity';
import type { ImportedMoltBlock, ImportedNeoBlock, ImportedNeoStack } from './umgFileClassifier';

export function cleanTitle(value: string) { return value.replace(/[`*_#]/g, '').replace(/\s+/g, ' ').trim(); }
export function normalizeBulletToTitle(value: string) { return cleanTitle(value.replace(/^[-*+]\s*/, '').replace(/^\d+[.)]\s*/, '')).slice(0, 96) || 'Imported NeoBlock'; }
export function extractSleeveId(text: string) { return text.match(/Sleeve ID\s*[:=-]\s*`?([A-Za-z0-9_.:-]+)/i)?.[1]?.replace(/`$/, '') ?? text.match(/\b(SLV\.[A-Za-z0-9_.:-]+)/i)?.[1]; }
export function extractVersion(text: string) { return text.match(/(?:version|v)\s*[:=-]?\s*`?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i)?.[1]; }
export function extractTitle(text: string) { return cleanTitle(text.match(/^#\s+(.+)$/m)?.[1] ?? text.match(/Title\s*[:=-]\s*(.+)$/im)?.[1] ?? ''); }

export function extractSectionForHeading(markdown: string, headingId: string) {
  const escaped = headingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = new RegExp(`^###\\s+${escaped}\\b.*$`, 'im').exec(markdown);
  if (!start) return '';
  const rest = markdown.slice(start.index + start[0].length);
  const end = /^###\s+/im.exec(rest);
  return end ? rest.slice(0, end.index) : rest;
}

export function extractBullets(section: string) {
  return section.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^[-*+]\s+\S/.test(line)).map((line) => line.replace(/^[-*+]\s+/, '').trim()).filter((line) => !/^(NeoBlocks?|MOLT|Total)\s*:/i.test(line));
}

export function parseLegacyNeoStacks(markdown: string, sleeveId: string): ImportedNeoStack[] {
  const stackRegex = /^###\s+(S\.\d+)\s*[-–]\s*(.+?)(?:\s*\((\d+)\s+NeoBlocks?\))?\s*$/gim;
  const stacks: ImportedNeoStack[] = [];
  let match: RegExpExecArray | null; let order = 1;
  while ((match = stackRegex.exec(markdown))) {
    const [, stackCode, rawTitle, blockCount] = match;
    const title = cleanTitle(rawTitle);
    stacks.push({ id: `${sleeveId}:${stackCode}`, legacyId: stackCode, title, description: `Imported legacy NeoStack ${stackCode}: ${title}.`, expectedNeoBlockCount: blockCount ? Number(blockCount) : undefined, stackOrder: order++, sourceKind: 'imported-legacy-package', generationReason: `Imported from legacy markdown heading ${stackCode}.`, nlCard: makeNlCard(title, 'neostack'), jsonSchema: makeMinimalSchema('neostack', title), neoBlockIds: [], tags: ['imported','legacy','neostack'] });
  }
  return stacks;
}

export function parseLegacyNeoBlocks(markdown: string, stacks: ImportedNeoStack[]): ImportedNeoBlock[] {
  const blocks: ImportedNeoBlock[] = [];
  for (const stack of stacks) {
    const section = extractSectionForHeading(markdown, stack.legacyId ?? stack.id);
    const bullets = extractBullets(section);
    let blockOrder = 1;
    for (const bullet of bullets.slice(0, stack.expectedNeoBlockCount ?? bullets.length)) {
      const title = normalizeBulletToTitle(bullet);
      const id = `${stack.id}:NB.${String(blockOrder).padStart(2, '0')}`;
      blocks.push({ id, title, description: bullet, neoStackId: stack.id, blockOrder, sourceKind: 'imported-legacy-package', generationReason: `Imported from ${stack.legacyId} bullet ${blockOrder}.`, gates: [], gateIds: [], capabilities: [], moltBlockIds: [], nlCard: makeNlCard(title, 'neoblock', bullet), jsonSchema: makeMinimalSchema('neoblock', title), tags: ['imported','legacy','neoblock'], defaultState: 'off' });
      stack.neoBlockIds.push(id); blockOrder++;
    }
  }
  return blocks;
}

const roleMap: Record<string, ImportedMoltBlock['role']> = { PRIM: 'primary', DIR: 'directive', INST: 'instruction', SUBJ: 'subject', PHIL: 'philosophy', BP: 'blueprint' };

export function parseGovernanceMolts(markdown: string, sleeveId: string): ImportedMoltBlock[] {
  const regex = /^###\s+((PRIM|DIR|INST|SUBJ|PHIL|BP)\.UO\.\d+)\s*[-–]\s*(.+?)\n(?:\*\*Content:\*\*\s*)?([\s\S]*?)(?=\n###\s+(?:PRIM|DIR|INST|SUBJ|PHIL|BP)\.UO\.|\n---|\n##\s+|$)/gim;
  const molts: ImportedMoltBlock[] = []; let match: RegExpExecArray | null; let order = 1;
  while ((match = regex.exec(markdown))) {
    const [, id, prefix, rawTitle, contentRaw] = match;
    const title = cleanTitle(rawTitle); const content = contentRaw.replace(/^\*\*Content:\*\*/i, '').trim();
    molts.push({ id, sourceId: id, title, role: roleMap[prefix.toUpperCase()] ?? 'subject', content: content || title, description: (content || title).slice(0, 280), tags: ['uo','governance','imported', roleMap[prefix.toUpperCase()] ?? 'subject'], sourceKind: 'imported-legacy-package', generationReason: 'Imported from governance/MOLT layer in legacy Sleeve package.', stackOrder: order++, nlCard: makeNlCard(title, roleMap[prefix.toUpperCase()] ?? 'molt', content), jsonSchema: makeMinimalSchema('molt', title), blockType: 'molt', defaultState: 'off' });
  }
  return molts;
}

export function extractSystemPromptMolts(text: string, sleeveId: string): ImportedMoltBlock[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  return [{ id: `${sleeveId}:SYSTEM_PROMPT`, title: 'Imported System Prompt', role: 'directive', content: cleaned, description: cleaned.slice(0, 280), tags: ['imported','system-prompt','directive'], sourceKind: 'imported-legacy-package', generationReason: 'Imported from system-prompt.txt in legacy Sleeve package.', sourcePath: 'system-prompt.txt', nlCard: makeNlCard('Imported System Prompt', 'directive', cleaned), jsonSchema: makeMinimalSchema('molt', 'Imported System Prompt'), blockType: 'molt', defaultState: 'off' }];
}

export function createMinimalMoltChildrenForNeoBlock(block: ImportedNeoBlock): ImportedMoltBlock[] {
  const specs = [
    { role: 'directive' as const, title: `${block.title} Directive`, content: `Activate and govern the ${block.title} workflow step.` },
    { role: 'instruction' as const, title: `${block.title} Instruction`, content: `Perform the ${block.title} workflow step using imported package context.` },
    { role: 'subject' as const, title: `${block.title} Subject`, content: `Domain subject for ${block.title}.` }
  ];
  return specs.map((spec, index) => ({ id: `${block.id}:M.${spec.role.toUpperCase()}.${index + 1}`, title: spec.title, role: spec.role, content: spec.content, description: spec.content, tags: ['imported','normalized-glue',spec.role], sourceKind: 'normalized-import-glue', generationReason: `Synthesized because legacy NeoBlock ${block.id} had no explicit current-schema MOLT child for ${spec.role}.`, parentNeoBlockId: block.id, parentNeoStackId: block.neoStackId, stackOrder: index + 1, nlCard: makeNlCard(spec.title, spec.role, spec.content), jsonSchema: makeMinimalSchema('molt', spec.title), blockType: 'molt', defaultState: 'off' }));
}
