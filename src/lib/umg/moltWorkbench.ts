import { HermesConfig, MOLTRole, NeoBlock, UMGBlock } from './types';
import { displayTypeOrder } from './migrateLibrary';

export const MOLT_ROLE_ORDER: MOLTRole[] = ['trigger', 'directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];
export const DISPLAY_TYPE_ORDER = displayTypeOrder;

export const MOLT_ROLE_COLORS: Record<MOLTRole, string> = {
  trigger: '#fb7185',
  directive: '#f97316',
  instruction: '#facc15',
  subject: '#22c55e',
  primary: '#38bdf8',
  philosophy: '#a78bfa',
  blueprint: '#f472b6'
};

const rolePriority: Record<MOLTRole, number> = {
  trigger: 0,
  directive: 10,
  instruction: 20,
  subject: 30,
  primary: 40,
  philosophy: 50,
  blueprint: 60
};

export function addWorkbenchBlockByRole(neoblock: NeoBlock, role: MOLTRole): NeoBlock {
  const stamp = Date.now();
  const block: UMGBlock = {
    id: `wrk_${role}_${stamp}`,
    title: `New ${titleRole(role)} Block`,
    type: 'molt_block',
    role,
    content: '',
    category: 'workspace',
    tags: [role],
    priorityOrder: rolePriority[role],
    defaultState: 'on',
    visibility: 'visible',
    activation: { mode: 'always' },
    dependencies: [],
    conflicts: [],
    compatibleSleeves: [],
    compatibleStacks: [],
    source: { origin: 'workspace', version: '0.1' }
  };
  return { ...neoblock, blocks: [...neoblock.blocks, block] };
}

export function updateWorkbenchBlockContent(neoblock: NeoBlock, blockId: string, content: string, title?: string): NeoBlock {
  return {
    ...neoblock,
    blocks: neoblock.blocks.map((block) => block.id === blockId ? { ...block, content, title: title ?? block.title, updatedAt: new Date().toISOString() } : block)
  };
}

export function toggleWorkbenchBlock(neoblock: NeoBlock, blockId: string): NeoBlock {
  return {
    ...neoblock,
    blocks: neoblock.blocks.map((block) => block.id === blockId ? { ...block, defaultState: block.defaultState === 'off' ? 'on' : 'off' } : block)
  };
}

export function saveWorkbenchBlockToLibrary(block: UMGBlock, name?: string): UMGBlock {
  return {
    ...block,
    id: `lib_${block.id}_${Date.now()}`,
    title: name?.trim() || block.title,
    defaultState: 'on',
    source: { origin: 'library', sourceId: block.id, version: block.source?.version ?? '0.1' },
    updatedAt: new Date().toISOString()
  };
}

export function validateHermesWorkbenchGeneration(config: HermesConfig): { ok: boolean; message: string; safeSettings?: Omit<HermesConfig, 'apiKey'> } {
  if (!config.endpoint) return { ok: false, message: 'Hermes endpoint not configured. Compile/export remains available without Hermes.' };
  return {
    ok: true,
    message: 'Hermes generation may run through the configured Hermes client path.',
    safeSettings: { endpoint: config.endpoint, model: config.model, temperature: config.temperature, maxTokens: config.maxTokens }
  };
}

function titleRole(role: MOLTRole) {
  return role.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}
