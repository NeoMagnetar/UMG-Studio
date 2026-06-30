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
    const uploadedContext = buildUploadedContextText([{ name: 'intake.md', size: text.length, lastModified: 1, status: 'parsed_text', text, summary, keywords }]);
    expect(uploadedContext).toContain('Rationalism workflow');
    const request = buildHermesCustomSleeveGenerationRequest({ userPrompt: 'Build a context-aware workflow', userContext: `Uploaded file intake context:\n${uploadedContext}`, requestId: 'phase13ij.upload.test' });
    expect(request.userContext).toContain('Uploaded file intake context');
    expect(request.libraryCandidates.length).toBeGreaterThan(0);
    expect(request.sourceLibraryPolicy).toMatch(/uploaded content/);
    expect(request.outputContract).toMatch(/NL card fields/);
  });
});
