import { type ReactNode, useMemo, useState } from 'react';
import type { GeneratedBlockDraft } from '../lib/umg/blockMatchingTypes';
import { architectureModeDescriptions, architectureModeLabels, type ArchitectBlockMatch, type SleeveArchitectPlan } from '../lib/umg/sleeveArchitectTypes';
import './SleeveArchitectReviewPanel.css';

type ReviewDecision = 'keep_draft' | 'accept_for_this_sleeve' | 'needs_edit' | 'reject';

type ReviewState = Record<string, ReviewDecision>;

export type ArchitectReviewSummary = {
  generatedCount: number;
  reviewedCount: number;
  acceptedForSleeveCount: number;
  rejectedCount: number;
  needsEditCount: number;
  keepDraftCount: number;
  compileGateLabel: string;
};

const decisionLabels: Record<ReviewDecision, string> = {
  keep_draft: 'Keep Draft',
  accept_for_this_sleeve: 'Accept for this Sleeve',
  needs_edit: 'Needs Edit',
  reject: 'Reject'
};

const decisionOrder: ReviewDecision[] = ['accept_for_this_sleeve', 'keep_draft', 'needs_edit', 'reject'];

export function summarizeArchitectReview(plan: SleeveArchitectPlan, reviewState: ReviewState = {}): ArchitectReviewSummary {
  const ids = plan.generatedDrafts.map((draft) => draft.id);
  const decisions = ids.map((id) => reviewState[id]).filter(Boolean) as ReviewDecision[];
  const count = (decision: ReviewDecision) => decisions.filter((value) => value === decision).length;
  return {
    generatedCount: ids.length,
    reviewedCount: decisions.length,
    acceptedForSleeveCount: count('accept_for_this_sleeve'),
    rejectedCount: count('reject'),
    needsEditCount: count('needs_edit'),
    keepDraftCount: count('keep_draft'),
    compileGateLabel: decisions.length ? 'Review state exists · compile remains a separate Seed/Assembly action' : 'Review required before any future Architect CompileCandidate action'
  };
}

function StatusBadge({ children, tone = 'draft' }: { children: ReactNode; tone?: 'draft' | 'existing' | 'warning' | 'review' }) {
  return <span className={`architectReviewBadge architectReviewBadge-${tone}`}>{children}</span>;
}

function ChipList({ values, empty = 'none' }: { values: string[]; empty?: string }) {
  if (!values.length) return <span className="architectReviewMuted">{empty}</span>;
  return <div className="architectReviewChips">{values.slice(0, 18).map((value) => <span key={value}>{value}</span>)}</div>;
}

function DraftStatus({ draft }: { draft: GeneratedBlockDraft }) {
  const draftOnly = draft.metadata?.draftOnly === true;
  return <div className="architectReviewDraftFlags" aria-label={`Draft status for ${draft.title}`}>
    <StatusBadge tone="draft">draftOnly: {String(draftOnly)}</StatusBadge>
    <StatusBadge tone="draft">saveState: {draft.saveState}</StatusBadge>
    <StatusBadge tone="draft">needsUserReview: {String(draft.needsUserReview)}</StatusBadge>
    <StatusBadge tone="draft">defaultState: {draft.defaultState}</StatusBadge>
  </div>;
}

function ReviewButtons({ value, onChange }: { value?: ReviewDecision; onChange: (decision: ReviewDecision) => void }) {
  return <div className="architectReviewActions" aria-label="Local review actions">
    {decisionOrder.map((decision) => <button key={decision} type="button" className={value === decision ? 'isSelected' : ''} onClick={() => onChange(decision)}>{decisionLabels[decision]}</button>)}
  </div>;
}

function ExistingBlockCard({ match }: { match: ArchitectBlockMatch }) {
  return <article className="architectReviewCard architectReviewExistingCard">
    <div className="architectReviewCardTop"><b>{match.title}</b><StatusBadge tone="existing">reusable existing block</StatusBadge></div>
    <small>{match.blockId}</small>
    <p>{match.role} · score {Math.round(match.score * 100)}% · {match.reason}</p>
    <div className="architectReviewDraftFlags">
      <StatusBadge tone="existing">source: {match.source}</StatusBadge>
      <StatusBadge tone="existing">not generated</StatusBadge>
    </div>
    <ChipList values={match.matchedTags.slice(0, 8)} empty="no matched tags" />
  </article>;
}

export function SleeveArchitectReviewPanel({ plan }: { plan: SleeveArchitectPlan }) {
  const [reviewState, setReviewState] = useState<ReviewState>({});
  const summary = useMemo(() => summarizeArchitectReview(plan, reviewState), [plan, reviewState]);
  const roleCounts = useMemo(() => plan.proposedMoltBlocks.reduce((acc, block) => {
    acc[block.role] = (acc[block.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>), [plan.proposedMoltBlocks]);
  const updateDecision = (draftId: string, decision: ReviewDecision) => {
    setReviewState((current) => ({ ...current, [draftId]: decision }));
  };

  return <section className="architectReview" aria-label="Architect Plan Review Workspace">
    <header className="architectReviewHeader">
      <div>
        <span className="architectReviewEyebrow">Architect Plan Review Workspace</span>
        <h3>{plan.proposedSleeveTitle}</h3>
        <p>{plan.proposedSleeveId}</p>
      </div>
      <div className="architectReviewMode">
        <StatusBadge tone={plan.mode === 'architect_mode' ? 'review' : 'warning'}>{architectureModeLabels[plan.mode]}</StatusBadge>
        <small>{architectureModeDescriptions[plan.mode]}</small>
      </div>
    </header>

    <div className="architectReviewNotice">
      <b>Generated content status: draft-only / review-only.</b>
      <span>No source library write, no auto-compile, no trusted reusable content promotion, no Hermes call, and no tool execution occur in this workspace.</span>
    </div>

    <div className="architectReviewSummaryGrid">
      <div><b>{plan.proposedNeoStacks.length}</b><span>NeoStacks</span></div>
      <div><b>{plan.proposedNeoBlocks.length}</b><span>NeoBlocks</span></div>
      <div><b>{plan.proposedMoltBlocks.length}</b><span>MOLT proposals</span></div>
      <div><b>{plan.proposedGates.length}</b><span>Gates</span></div>
      <div><b>{plan.generatedDrafts.length}</b><span>generated drafts</span></div>
      <div><b>{summary.reviewedCount}</b><span>locally reviewed</span></div>
    </div>

    <div className="architectReviewTwoCol">
      <section className="architectReviewPanelBlock">
        <h4>User goal / domain</h4>
        <p>{plan.userGoal}</p>
        <small>{plan.domainSummary} · confidence {Math.round(plan.confidence * 100)}%</small>
        <h5>Semantic tags</h5>
        <ChipList values={plan.semanticTags} />
        {plan.warnings.some((warning) => warning.toLowerCase().includes('limited to loaded/local blocks')) && <div className="architectReviewInlineWarning">Semantic search is currently limited to loaded/local blocks.</div>}
      </section>
      <section className="architectReviewPanelBlock">
        <h4>Review gate</h4>
        <p>{summary.compileGateLabel}</p>
        <div className="architectReviewDraftFlags">
          <StatusBadge tone="review">accepted: {summary.acceptedForSleeveCount}</StatusBadge>
          <StatusBadge tone="warning">needs edit: {summary.needsEditCount}</StatusBadge>
          <StatusBadge tone="draft">keep draft: {summary.keepDraftCount}</StatusBadge>
          <StatusBadge tone="warning">rejected: {summary.rejectedCount}</StatusBadge>
        </div>
        <small>These controls are local UI state only. They do not save generated blocks, create a CompileCandidate, or mutate JSON.</small>
      </section>
    </div>

    <section className="architectReviewPanelBlock">
      <h4>Proposed NeoStacks</h4>
      <div className="architectReviewGridList">
        {plan.proposedNeoStacks.map((stack) => <article key={stack.id} className="architectReviewCard">
          <div className="architectReviewCardTop"><b>{stack.title}</b><StatusBadge>draftOnly: {String(stack.draftOnly)}</StatusBadge></div>
          <small>{stack.id}</small>
          <p>{stack.reason}</p>
          <ChipList values={stack.semanticTags.slice(0, 8)} empty="no semantic tags" />
        </article>)}
      </div>
    </section>

    <section className="architectReviewPanelBlock">
      <h4>Proposed NeoBlocks</h4>
      <div className="architectReviewGridList">
        {plan.proposedNeoBlocks.map((block) => <article key={block.id} className="architectReviewCard">
          <div className="architectReviewCardTop"><b>{block.title}</b><StatusBadge>draftOnly: {String(block.draftOnly)}</StatusBadge></div>
          <small>{block.id}</small>
          <p>{block.purpose}</p>
          <ChipList values={block.requiredMoltRoles} />
        </article>)}
      </div>
    </section>

    <section className="architectReviewPanelBlock">
      <h4>Proposed MOLT roles</h4>
      <div className="architectReviewRoleCounts">{Object.entries(roleCounts).map(([role, count]) => <span key={role}><b>{role}</b>{count}</span>)}</div>
      <div className="architectReviewGridList architectReviewCompactList">
        {plan.proposedMoltBlocks.slice(0, 18).map((block) => <article key={block.id} className="architectReviewCard">
          <div className="architectReviewCardTop"><b>{block.title}</b><StatusBadge>draftOnly: {String(block.draftOnly)}</StatusBadge></div>
          <small>{block.role} · parent {block.parentNeoBlockId}</small>
          <p>{block.summary}</p>
        </article>)}
      </div>
    </section>

    <section className="architectReviewPanelBlock">
      <h4>Proposed Gates</h4>
      <div className="architectReviewGridList">
        {plan.proposedGates.map((gate) => <article key={gate.id} className="architectReviewCard architectReviewGateCard">
          <div className="architectReviewCardTop"><b>{gate.title}</b><StatusBadge>draftOnly: {String(gate.draftOnly)}</StatusBadge></div>
          <small>{gate.id}</small>
          <p>{gate.reason}</p>
          <span>controls: {gate.controlledNeoBlockId ?? 'review required'}</span>
        </article>)}
      </div>
    </section>

    <section className="architectReviewPanelBlock">
      <h4>Matched existing blocks</h4>
      <div className="architectReviewGridList">
        {plan.matchedExistingBlocks.length ? plan.matchedExistingBlocks.map((match) => <ExistingBlockCard key={match.blockId} match={match} />) : <p className="architectReviewMuted">No reusable existing/local/seed matches found yet.</p>}
      </div>
    </section>

    <section className="architectReviewPanelBlock">
      <h4>Generated draft blocks</h4>
      <div className="architectReviewGridList">
        {plan.generatedDrafts.map((draft) => <article key={draft.id} className="architectReviewCard architectReviewDraftCard">
          <div className="architectReviewCardTop"><b>{draft.title}</b><StatusBadge>{draft.blockType}</StatusBadge></div>
          <small>{draft.id} · parent {draft.proposedParent}</small>
          <p>{draft.summary}</p>
          <DraftStatus draft={draft} />
          <ReviewButtons value={reviewState[draft.id]} onChange={(decision) => updateDecision(draft.id, decision)} />
        </article>)}
      </div>
    </section>

    <div className="architectReviewTwoCol">
      <section className="architectReviewPanelBlock">
        <h4>Tool capability declarations</h4>
        <div className="architectReviewGridList architectReviewCompactList">
          {plan.toolCapabilityNeeds.length ? plan.toolCapabilityNeeds.map((tool) => <article key={tool.id} className="architectReviewCard">
            <div className="architectReviewCardTop"><b>{tool.capability}</b><StatusBadge tone="review">declaration only</StatusBadge></div>
            <p>{tool.whyDeclared}</p>
            <small>executionEnabled: {String(tool.executionEnabled)}</small>
          </article>) : <p className="architectReviewMuted">No tool capabilities declared.</p>}
        </div>
      </section>
      <section className="architectReviewPanelBlock">
        <h4>Approvals / warnings</h4>
        <ChipList values={plan.approvalPoints} empty="no approval points detected" />
        <div className="architectReviewWarningList">{plan.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>
      </section>
    </div>
  </section>;
}
