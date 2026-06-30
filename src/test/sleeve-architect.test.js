import { describe, expect, it } from 'vitest';
import { createBusinessInputFromPublicIntake, analyzeBusinessInput } from '../lib/umg/businessAnalyzer';
import { getBusinessAutomationCoreSleeve } from '../lib/umg/businessAutomationCoreSleeve';
import { buildSleeveArchitectPlan } from '../lib/umg/sleeveArchitectPlanner';
import { architectureModeLabels } from '../lib/umg/sleeveArchitectTypes';
import { normalizeLegacyMoltRole, parseLegacyMarkdownSleeve } from '../lib/umg/legacySleeveImport';

const ecommercePrompt = 'E-Commerce: Customer Return & Refund Orchestration — automate the customer return and refund workflow for an online retail business. The agent should validate purchase records, check eligibility, draft customer replies, route approvals, and prepare refund actions.';

function sampleBlocks() {
  return getBusinessAutomationCoreSleeve().moltBlocks.map((block) => ({
    id: block.id,
    title: block.title,
    type: 'molt_block',
    role: block.role,
    content: block.summary,
    description: block.summary,
    category: 'business automation',
    tags: [block.role, 'business', 'workflow', block.id.toLowerCase()],
    defaultState: 'off',
    visibility: 'visible'
  }));
}

describe('Phase 13A Sleeve Architect Mode foundation', () => {
  it('keeps Business Automation available as Seed Template Mode for terse demo prompts', () => {
    const input = createBusinessInputFromPublicIntake({ goal: 'customer lead follow-up', context: '', selectedChip: 'Business Automation' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    expect(plan.mode).toBe('demo_template_mode');
    expect(architectureModeLabels[plan.mode]).toBe('Seed Template Mode');
    expect(plan.warnings.join(' ')).toMatch(/Seed Template Mode/);
  });

  it('creates an Architect Mode plan for e-commerce return/refund orchestration', () => {
    const input = createBusinessInputFromPublicIntake({ goal: ecommercePrompt, context: '', selectedChip: 'Custom Workflow' });
    const map = analyzeBusinessInput(input);
    const plan = buildSleeveArchitectPlan({ businessInput: input, businessMap: map, availableBlocks: sampleBlocks() });
    expect(plan.mode).toBe('architect_mode');
    expect(plan.proposedSleeveTitle).toBe('Customer Return & Refund Orchestration Sleeve');
    expect(plan.proposedNeoStacks.map((stack) => stack.title)).toEqual(expect.arrayContaining([
      'Return Intake & Eligibility Stack',
      'Purchase Validation Stack',
      'Refund Decision & Approval Stack'
    ]));
    expect(plan.toolCapabilityNeeds.map((tool) => tool.capability)).toEqual(expect.arrayContaining([
      'order_lookup',
      'customer_message_draft',
      'refund_prepare_or_request'
    ]));
    expect(plan.toolCapabilityNeeds.every((tool) => tool.executionEnabled === false)).toBe(true);
    expect(plan.generatedDrafts.length).toBeGreaterThan(0);
    expect(plan.generatedDrafts.every((draft) => draft.saveState === 'draft' && draft.needsUserReview && draft.defaultState === 'off' && draft.metadata?.draftOnly === true)).toBe(true);
  });

  it('normalizes legacy Sleeve roles without treating triggers as MOLT prompt blocks', () => {
    const expected = {
      TRG: ['gate_control', 'gate'],
      STRAT: ['strategy', 'metadata'],
      AIM: ['aim', 'metadata'],
      NEED: ['need', 'constraint'],
      USE: ['use_case', 'metadata'],
      DIR: ['directive', 'molt'],
      INST: ['instruction', 'molt'],
      SUBJ: ['subject', 'molt'],
      PHIL: ['philosophy', 'molt'],
      BP: ['blueprint', 'molt'],
      PRIM: ['primary', 'molt']
    };
    for (const [legacy, [normalizedRole, target]] of Object.entries(expected)) {
      const mapping = normalizeLegacyMoltRole(legacy);
      expect(mapping.normalizedRole).toBe(normalizedRole);
      expect(mapping.target).toBe(target);
    }
  });

  it('audits legacy markdown Sleeves read-only', () => {
    const markdown = `# Nonprofit Financing Sleeve\nSleeve ID: SLV.NONPROFIT.FINANCING.V1\nTotal components: 248\n## Governance / Primary\n- PRIM.GOV.001 Mission-aligned capital\n## NeoStack NST.INTAKE Financing Intake\n### NeoBlock NB.INTAKE.001 Grant opportunity capture\n- TRG.INTAKE.001 Incoming funder request\n- DIR.INTAKE.001 Capture financing need\n## Workflow Examples\nWhen the user needs bridge financing, activate intake and risk stacks.\n## Output Format\nDecision memo and funder packet.`;
    const audit = parseLegacyMarkdownSleeve(markdown);
    expect(audit.sleeveId).toBe('SLV.NONPROFIT.FINANCING.V1');
    expect(audit.declaredTotalComponents).toBe(248);
    expect(audit.neoStacks.length).toBeGreaterThan(0);
    expect(audit.neoBlocks.length).toBeGreaterThan(0);
    expect(audit.moltRecords.some((record) => record.role === 'TRG' && record.normalizedRole.target === 'gate')).toBe(true);
    expect(audit.outputSections.length).toBeGreaterThan(0);
  });
});
