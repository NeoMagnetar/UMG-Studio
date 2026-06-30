import { describe, expect, it } from 'vitest';
import {
  buildUploadedContextText,
  createMetadataMoltBlock,
  extractKeywordsFromText,
  itemMatchesLiveTagQuery,
  itemMatchesSelectedTags,
  matchesPrefixFirstBlockSearch,
  sortMatchingTags,
  sortPrefixFirstBlockSearchItems,
  summarizeUploadedText
} from '../lib/umg/libraryBrowserSemantics';
import { UMG_LIBRARY_METADATA_INDEX, UMG_LIBRARY_METADATA_INDEX_INFO } from '../lib/umg/generated/umgLibraryMetadataIndex';
import { buildHermesCustomSleeveGenerationRequest } from '../lib/umg/hermesCustomSleeveGeneration';

function shelfItem({ id, title, tags = [], role = 'directive', category = 'test', description = '' }) {
  const block = {
    id,
    title,
    type: 'molt_block',
    role,
    displayType: role,
    category,
    tags,
    description,
    content: description,
    defaultState: 'off',
    visibility: 'visible'
  };
  return { id, kind: 'molt_block', title, tags, displayType: role, containedRoles: [role], containedTitles: [title], asset: block };
}

describe('Phase 13I-J library browser semantics', () => {
  it('creates metadata MOLT cards for every matching MOLT type from the generated index', () => {
    const roles = ['directive', 'instruction', 'subject', 'primary', 'philosophy', 'blueprint'];
    const moltCandidates = UMG_LIBRARY_METADATA_INDEX.filter((candidate) => candidate.blockType === 'molt');
    expect(moltCandidates.length).toBe(UMG_LIBRARY_METADATA_INDEX_INFO.counts.molt);
    for (const role of roles) {
      const candidates = moltCandidates.filter((candidate) => candidate.role === role);
      expect(candidates.length).toBeGreaterThan(0);
      const cards = candidates.map(createMetadataMoltBlock);
      expect(cards.every((card) => card.displayType === role && card.presentationStatus === 'runnable')).toBe(true);
    }
  });

  it('uses prefix-first block search ranking by title, tokens, tags, category, then content', () => {
    const items = [
      shelfItem({ id: 'contains-u', title: 'Customer Intake', description: 'contains the letter u' }),
      shelfItem({ id: 'u-title', title: 'Unified Routing', tags: ['workflow'] }),
      shelfItem({ id: 'token', title: 'Workflow Analysis', tags: ['universal'] }),
      shelfItem({ id: 'ability', title: 'Ability Mapping' }),
      shelfItem({ id: 'abstract', title: 'Abstract Reasoning' }),
      shelfItem({ id: 'animal', title: 'Animal Care' })
    ];
    expect(sortPrefixFirstBlockSearchItems(items, 'u').map((item) => item.id).slice(0, 2)).toEqual(['u-title', 'token']);
    expect(sortPrefixFirstBlockSearchItems(items, 'ab').map((item) => item.id).slice(0, 2)).toEqual(['ability', 'abstract']);
    expect(sortPrefixFirstBlockSearchItems(items, 'an').map((item) => item.id)[0]).toBe('animal');
    expect(matchesPrefixFirstBlockSearch(items[0], 'zz')).toBe(false);
  });

  it('supports tag prefix suggestions and exact selected tag filtering with slug/display equivalence', () => {
    const rationalism = shelfItem({ id: 'rationalism', title: 'Reason Card', tags: ['rationalism', 'radical-transparency'] });
    const radical = shelfItem({ id: 'radical', title: 'Transparency Card', tags: ['Radical Transparency'] });
    expect(sortMatchingTags(['animal', 'rationalism', 'radical-transparency', 'Radical Transparency'], 'r').slice(0, 3)).toEqual(['radical-transparency', 'Radical Transparency', 'rationalism']);
    expect(itemMatchesLiveTagQuery(rationalism, 'rad')).toBe(true);
    expect(itemMatchesSelectedTags(rationalism, ['rationalism'])).toBe(true);
    expect(itemMatchesSelectedTags(radical, ['radical-transparency'])).toBe(true);
    expect(itemMatchesSelectedTags(radical, ['rationalism'])).toBe(false);
  });

  it('reports generated metadata index counts for MOLT, NeoBlock, and NeoStack library tabs', () => {
    expect(UMG_LIBRARY_METADATA_INDEX_INFO.counts.molt).toBe(1379);
    expect(UMG_LIBRARY_METADATA_INDEX_INFO.counts.neoblock).toBe(119);
    expect(UMG_LIBRARY_METADATA_INDEX_INFO.counts.neostack).toBe(42);
  });

  it('summarizes uploaded text context and feeds upload-derived keywords into candidate retrieval', () => {
    const text = 'Rationalism workflow for animal analysis and abstract ability mapping. Rationalism requires philosophy context.';
    const keywords = extractKeywordsFromText(text);
    expect(keywords).toEqual(expect.arrayContaining(['rationalism', 'workflow', 'animal', 'analysis']));
    const summary = summarizeUploadedText('intake.md', text);
    const uploadedContext = buildUploadedContextText([{ fileName: 'intake.md', name: 'intake.md', sizeBytes: text.length, size: text.length, lastModified: 1, status: 'parsed_text', text, summary, keywords, syntaxSignals: [], semanticSignals: [], domainSignals: [], suggestedMoltRoles: [] }]);
    expect(uploadedContext).toContain('Rationalism workflow');
    const request = buildHermesCustomSleeveGenerationRequest({ userPrompt: 'Build a context-aware workflow', userContext: `Uploaded file intake context:\n${uploadedContext}`, requestId: 'phase13ij.upload.test' });
    expect(request.userContext).toContain('Uploaded file intake context');
    expect(request.libraryCandidates.length).toBeGreaterThan(0);
    expect(request.sourceLibraryPolicy).toMatch(/uploaded content/);
    expect(request.outputContract).toMatch(/NL card fields/);
  });
});

describe('Phase 13I-K upload intake intelligence', () => {
  const supportSop = `Customer support SOP:
Classify incoming issues as billing, technical, account access, urgent safety, or general feedback.
Draft a friendly customer reply.
Escalate urgent safety issues to a human reviewer.
Summarize the outcome after each case.
Use a calm, professional tone.
Do not send emails automatically without approval.`;

  it('extracts deterministic keywords, syntax, semantic, domain, and MOLT role hints from uploaded text', async () => {
    const {
      extractIntakeKeywords,
      extractSyntaxSignals,
      extractSemanticSignals,
      extractDomainSignals,
      inferMoltRoleHints,
      createUploadedIntakeContext
    } = await import('../lib/umg/intakeSemanticExtraction');
    expect(extractIntakeKeywords(supportSop)).toEqual(expect.arrayContaining(['customer support', 'classify', 'billing', 'technical', 'urgent safety', 'draft reply', 'escalation', 'summary', 'approval']));
    expect(extractSyntaxSignals(supportSop)).toEqual(expect.arrayContaining(['SOP', 'classification', 'escalation', 'summarization', 'approval']));
    expect(extractSemanticSignals(supportSop)).toEqual(expect.arrayContaining(['customer reply drafting', 'urgent safety escalation', 'outcome summarization', 'human approval required']));
    expect(extractDomainSignals(supportSop)).toEqual(expect.arrayContaining(['customer support', 'billing support', 'technical support', 'safety escalation']));
    expect(inferMoltRoleHints(supportSop)).toEqual(expect.arrayContaining(['Directive', 'Instruction', 'Subject', 'Philosophy', 'Blueprint', 'Trigger/Gate']));
    const record = createUploadedIntakeContext({ fileName: 'support-sop.txt', mimeType: 'text/plain', sizeBytes: supportSop.length, text: supportSop });
    expect(record).toMatchObject({ fileName: 'support-sop.txt', status: 'parsed_text' });
    expect(record.summary).toContain('Customer support SOP');
    expect(record.syntaxSignals).toContain('SOP');
    expect(record.semanticSignals).toContain('customer reply drafting');
  });

  it('marks unsupported files as extractor pending without pretending to parse PDF/DOCX/images/OCR', async () => {
    const { createUnsupportedUploadedIntakeContext } = await import('../lib/umg/intakeSemanticExtraction');
    const record = createUnsupportedUploadedIntakeContext({ fileName: 'contract.pdf', mimeType: 'application/pdf', sizeBytes: 42 });
    expect(record.status).toBe('unsupported_type');
    expect(record.summary).toMatch(/Unsupported extractor pending/);
    expect(record.text).toBeUndefined();
    expect(record.keywords).toEqual([]);
  });

  it('builds expanded retrieval query from prompt, pasted context, and uploaded signals', async () => {
    const { createUploadedIntakeContext, buildExpandedRetrievalQuery } = await import('../lib/umg/intakeSemanticExtraction');
    const uploaded = createUploadedIntakeContext({ fileName: 'support-sop.txt', sizeBytes: supportSop.length, text: supportSop });
    const expanded = buildExpandedRetrievalQuery({ prompt: 'Build a UMG sleeve from this uploaded customer support SOP.', pastedContext: 'approval before sending customer email', uploadedContexts: [uploaded] });
    expect(expanded).toContain('Build a UMG sleeve');
    expect(expanded).toContain('approval before sending customer email');
    expect(expanded).toContain('urgent safety');
    expect(expanded).toContain('Trigger/Gate');
    expect(expanded).toContain('customer reply drafting');
  });

  it('changes retrieval candidates when uploaded support SOP context is included', async () => {
    const { createUploadedIntakeContext } = await import('../lib/umg/intakeSemanticExtraction');
    const baseRequest = buildHermesCustomSleeveGenerationRequest({ userPrompt: 'Build a workflow from the uploaded SOP.', requestId: 'phase13ik.base' });
    const uploaded = createUploadedIntakeContext({ fileName: 'support-sop.txt', sizeBytes: supportSop.length, text: supportSop });
    const uploadRequest = buildHermesCustomSleeveGenerationRequest({ userPrompt: 'Build a workflow from the uploaded SOP.', uploadedContexts: [uploaded], requestId: 'phase13ik.upload' });
    expect(uploadRequest.uploadedIntakeContexts).toHaveLength(1);
    expect(uploadRequest.expandedRetrievalQuery).toContain('urgent safety');
    expect(uploadRequest.intakeDiagnostics.uploadedFilesAnalyzed).toBe(1);
    expect(uploadRequest.intakeDiagnostics.uploadedContextQueryAdditions).toEqual(expect.arrayContaining(['customer support', 'classification', 'approval']));
    expect(uploadRequest.libraryCandidates.map((candidate) => candidate.id).join('|')).not.toBe(baseRequest.libraryCandidates.map((candidate) => candidate.id).join('|'));
    expect(uploadRequest.libraryCandidates.flatMap((candidate) => candidate.matchReasons).join(' ')).toMatch(/classification|approval|customer|support|escalation|summary|routing/);
  });

  it('Hermes request contract requires uploaded context, NL cards, JSON schema fields, and runtime-session drafts', async () => {
    const { createUploadedIntakeContext } = await import('../lib/umg/intakeSemanticExtraction');
    const uploaded = createUploadedIntakeContext({ fileName: 'support-sop.txt', sizeBytes: supportSop.length, text: supportSop });
    const request = buildHermesCustomSleeveGenerationRequest({ userPrompt: 'Build a UMG sleeve from this uploaded customer support SOP.', uploadedContexts: [uploaded], requestId: 'phase13ik.contract' });
    expect(request.userContext).toContain('Uploaded intake context');
    expect(request.outputContract).toMatch(/Every generated MOLT draft/);
    expect(request.outputContract).toMatch(/nlCard/);
    expect(request.outputContract).toMatch(/jsonSchema/);
    expect(request.outputContract).toMatch(/Every NeoBlock must contain meaningful MOLT layers/);
    expect(request.outputContract).toMatch(/Every NeoStack must contain meaningful NeoBlocks/);
  });
});
