import {
  NeoBlock,
  NeoStack,
  Sleeve,
  UMGGateAction,
  UMGScopeChildKind,
  UMGScopeKind,
  UMGSegmentGate,
  UMGSegmentLayout,
  UMGSegmentRelation,
  UMGSegmentRelationKind,
  UMGSegmentRow,
  UMGSegmentRowRole,
  UMGSegmentSlot
} from './types';
import { getScopeChildren, normalizeNeoStack, normalizeSleeve } from './scopeModel';

// Phase3C Option B segment-layout helpers.
// Segment layout is pure scope-owned metadata for authority rows/slots/relations.
// These helpers do not execute routes or gates, and rootController is never treated as an ordinary child.

type SupportedScope = Sleeve | NeoStack;
type SupportedChild = NeoStack | NeoBlock;

type SegmentOwnerArgs = {
  ownerScopeKind: UMGScopeKind;
  ownerScopeId: string;
};

type RootControllerSlotArgs = SegmentOwnerArgs & {
  rootControllerId: string;
};

type ChildSlotArgs = SegmentOwnerArgs & {
  childId: string;
  childKind: UMGScopeChildKind;
  rowId: string;
  rowIndex: number;
  columnIndex: number;
  parentSlotId?: string;
  visualWidth?: 'compact' | 'normal' | 'wide';
};

const segmentLayoutVersion: UMGSegmentLayout['version'] = 'segment-slot-root-controller-v1';
const defaultChildRowIndex = 1;
const escalationActions: UMGGateAction[] = ['emit_escalation_signal'];

function cloneRow(row: UMGSegmentRow): UMGSegmentRow {
  return { ...row };
}

function cloneSlot(slot: UMGSegmentSlot): UMGSegmentSlot {
  return { ...slot };
}

function cloneRelation(relation: UMGSegmentRelation): UMGSegmentRelation {
  return { ...relation };
}

function cloneGate(gate: UMGSegmentGate): UMGSegmentGate {
  return { ...gate };
}

function cloneSegment(segment: UMGSegmentLayout): UMGSegmentLayout {
  return {
    ...segment,
    rows: segment.rows.map((row) => cloneRow(row)),
    slots: segment.slots.map((slot) => cloneSlot(slot)),
    relations: segment.relations.map((relation) => cloneRelation(relation)),
    gates: segment.gates.map((gate) => cloneGate(gate)),
    routePreview: segment.routePreview
      ? {
          ...segment.routePreview,
          activeControllerIds: [...segment.routePreview.activeControllerIds],
          activeDirectiveIds: [...segment.routePreview.activeDirectiveIds],
          activeSlotIds: [...segment.routePreview.activeSlotIds],
          dormantSlotIds: [...segment.routePreview.dormantSlotIds],
          suppressedSlotIds: [...segment.routePreview.suppressedSlotIds],
          openGateIds: [...segment.routePreview.openGateIds],
          closedGateIds: [...segment.routePreview.closedGateIds],
          escalationSignals: segment.routePreview.escalationSignals.map((signal) => ({ ...signal })),
          warnings: segment.routePreview.warnings ? [...segment.routePreview.warnings] : undefined
        }
      : undefined,
    layoutWarnings: segment.layoutWarnings ? [...segment.layoutWarnings] : undefined
  };
}

function getRowMap(segment: UMGSegmentLayout): Map<string, UMGSegmentRow> {
  return new Map(segment.rows.map((row) => [row.id, row]));
}

function isLockedRootRow(row: UMGSegmentRow | undefined): boolean {
  return !row || row.index === 0 || row.role === 'root_controller';
}

function makeEmptySlotId(segment: UMGSegmentLayout, rowIdValue: string): string {
  const prefix = `${rowIdValue}:slot:empty:`;
  let nextIndex = 1;
  for (const slot of segment.slots) {
    if (!slot.id.startsWith(prefix)) continue;
    const suffix = Number(slot.id.slice(prefix.length));
    if (Number.isFinite(suffix)) nextIndex = Math.max(nextIndex, suffix + 1);
  }
  return `${prefix}${nextIndex}`;
}

function makeMovedChildSlotId(segment: UMGSegmentLayout, childKind: UMGScopeChildKind, childIdValue: string): string {
  const baseId = childSlotId(segment.ownerScopeKind, segment.ownerScopeId, childKind, childIdValue);
  const exactMatchCount = segment.slots.filter((slot) => slot.id === baseId).length;
  if (exactMatchCount === 0) return baseId;

  let nextIndex = 1;
  while (segment.slots.some((slot) => slot.id === `${baseId}:placed:${nextIndex}`)) {
    nextIndex += 1;
  }
  return `${baseId}:placed:${nextIndex}`;
}

function stripSlotRelations(segment: UMGSegmentLayout, slotIds: string[]): UMGSegmentLayout {
  if (!slotIds.length) return segment;
  const slotIdSet = new Set(slotIds);
  return {
    ...segment,
    relations: segment.relations.filter((relation) => !slotIdSet.has(relation.sourceSlotId) && !slotIdSet.has(relation.targetSlotId))
  };
}

function getScopeKind(scope: SupportedScope): UMGScopeKind {
  return scope.type === 'sleeve' ? 'sleeve' : 'neostack';
}

function getScopeId(scope: SupportedScope): string {
  return scope.id;
}

function segmentId(ownerScopeKind: UMGScopeKind, ownerScopeId: string): string {
  return `${ownerScopeKind}:${ownerScopeId}:segment`;
}

function rowId(ownerScopeKind: UMGScopeKind, ownerScopeId: string, role: UMGSegmentRowRole): string {
  return `${ownerScopeKind}:${ownerScopeId}:row:${role}`;
}

function rootSlotId(ownerScopeKind: UMGScopeKind, ownerScopeId: string): string {
  return `${ownerScopeKind}:${ownerScopeId}:slot:root`;
}

function childSlotId(ownerScopeKind: UMGScopeKind, ownerScopeId: string, childKind: UMGScopeChildKind, childIdValue: string): string {
  return `${ownerScopeKind}:${ownerScopeId}:slot:${childKind}:${childIdValue}`;
}

function relationId(kind: UMGSegmentRelationKind, sourceSlotId: string, targetSlotId: string): string {
  return `rel:${kind}:${sourceSlotId}:${targetSlotId}`;
}

export function createDefaultSegmentRows(args?: SegmentOwnerArgs): UMGSegmentRow[] {
  const ownerScopeKind = args?.ownerScopeKind ?? 'sleeve';
  const ownerScopeId = args?.ownerScopeId ?? 'default';

  return [
    { id: rowId(ownerScopeKind, ownerScopeId, 'root_controller'), index: 0, label: 'Controller', role: 'root_controller' },
    { id: rowId(ownerScopeKind, ownerScopeId, 'strategy'), index: 1, label: 'Strategy', role: 'strategy' },
    { id: rowId(ownerScopeKind, ownerScopeId, 'domain'), index: 2, label: 'Domains', role: 'domain' },
    { id: rowId(ownerScopeKind, ownerScopeId, 'specialization'), index: 3, label: 'Specialization', role: 'specialization' },
    { id: rowId(ownerScopeKind, ownerScopeId, 'detail'), index: 4, label: 'Details', role: 'detail' }
  ];
}

export function getScopeChildKind(scope: SupportedScope): UMGScopeChildKind {
  return scope.type === 'sleeve' ? 'neostack' : 'neoblock';
}

export function createRootControllerSlot(args: RootControllerSlotArgs): UMGSegmentSlot {
  return {
    id: rootSlotId(args.ownerScopeKind, args.ownerScopeId),
    rowId: rowId(args.ownerScopeKind, args.ownerScopeId, 'root_controller'),
    rowIndex: 0,
    columnIndex: 0,
    occupantKind: 'root_controller',
    occupantId: args.rootControllerId,
    visualWidth: 'wide'
  };
}

export function createChildSlot(args: ChildSlotArgs): UMGSegmentSlot {
  return {
    id: childSlotId(args.ownerScopeKind, args.ownerScopeId, args.childKind, args.childId),
    rowId: args.rowId,
    rowIndex: args.rowIndex,
    columnIndex: args.columnIndex,
    occupantKind: 'scope_child',
    occupantId: args.childId,
    occupantScopeChildKind: args.childKind,
    parentSlotId: args.parentSlotId,
    visualWidth: args.visualWidth ?? 'normal'
  };
}

export function createAuthorityRelation(parentSlotId: string, childSlotIdValue: string): UMGSegmentRelation {
  return {
    id: relationId('authority_child', parentSlotId, childSlotIdValue),
    kind: 'authority_child',
    sourceSlotId: parentSlotId,
    targetSlotId: childSlotIdValue,
    enabled: true
  };
}

export function createPeerComplementRelations(slots: UMGSegmentSlot[]): UMGSegmentRelation[] {
  const occupiedSameRow = [...slots]
    .filter((slot) => slot.occupantKind !== 'empty')
    .sort((a, b) => a.rowIndex - b.rowIndex || a.columnIndex - b.columnIndex);

  const relations: UMGSegmentRelation[] = [];
  for (let index = 0; index < occupiedSameRow.length - 1; index += 1) {
    const left = occupiedSameRow[index];
    const right = occupiedSameRow[index + 1];
    if (left.rowIndex !== right.rowIndex) continue;
    relations.push({
      id: relationId('peer_complement', left.id, right.id),
      kind: 'peer_complement',
      sourceSlotId: left.id,
      targetSlotId: right.id,
      enabled: true
    });
  }

  return relations;
}

export function getRootControllerSlot(segment: UMGSegmentLayout): UMGSegmentSlot | undefined {
  return segment.slots.find((slot) => slot.occupantKind === 'root_controller');
}

export function getSlotById(segment: UMGSegmentLayout, slotId: string): UMGSegmentSlot | undefined {
  return segment.slots.find((slot) => slot.id === slotId);
}

export function getSlotsByRow(segment: UMGSegmentLayout, rowIdValue: string): UMGSegmentSlot[] {
  return segment.slots
    .filter((slot) => slot.rowId === rowIdValue)
    .sort((a, b) => a.columnIndex - b.columnIndex)
    .map((slot) => cloneSlot(slot));
}

export function getOccupiedSlots(segment: UMGSegmentLayout): UMGSegmentSlot[] {
  return segment.slots.filter((slot) => slot.occupantKind !== 'empty').map((slot) => cloneSlot(slot));
}

export function cloneSegmentLayout(segment: UMGSegmentLayout): UMGSegmentLayout {
  return cloneSegment(segment);
}

export function getEditableRows(segment: UMGSegmentLayout): UMGSegmentRow[] {
  return segment.rows.filter((row) => !isLockedRootRow(row)).map((row) => cloneRow(row));
}

export function findSlotByOccupantId(segment: UMGSegmentLayout, occupantId: string): UMGSegmentSlot | undefined {
  const slot = segment.slots.find((candidate) => candidate.occupantKind === 'scope_child' && candidate.occupantId === occupantId);
  return slot ? cloneSlot(slot) : undefined;
}

export function reindexRowSlots(segment: UMGSegmentLayout, rowIdValue: string): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const row = nextSegment.rows.find((candidate) => candidate.id === rowIdValue);
  if (!row) return nextSegment;

  const sortedRowSlots = nextSegment.slots
    .filter((slot) => slot.rowId === rowIdValue)
    .sort((a, b) => a.columnIndex - b.columnIndex || a.id.localeCompare(b.id));

  const slotIds = new Set(sortedRowSlots.map((slot) => slot.id));
  const updates = new Map(sortedRowSlots.map((slot, index) => [slot.id, { rowIndex: row.index, columnIndex: index }]));

  nextSegment.slots = nextSegment.slots.map((slot) => {
    if (!slotIds.has(slot.id)) return slot;
    const update = updates.get(slot.id)!;
    return {
      ...slot,
      rowId: row.id,
      rowIndex: update.rowIndex,
      columnIndex: update.columnIndex
    };
  });

  return nextSegment;
}

export function normalizeAuthorityRelationsToController(segment: UMGSegmentLayout): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const rootSlot = getRootControllerSlot(nextSegment);
  if (!rootSlot) return nextSegment;

  nextSegment.slots = nextSegment.slots.map((slot) => {
    if (slot.occupantKind === 'scope_child') {
      return { ...slot, parentSlotId: rootSlot.id };
    }
    if (slot.occupantKind === 'root_controller') {
      return { ...slot, parentSlotId: undefined };
    }
    return { ...slot, parentSlotId: slot.occupantKind === 'empty' ? undefined : slot.parentSlotId };
  });

  const nonAuthorityRelations = nextSegment.relations.filter((relation) => relation.kind !== 'authority_child');
  const controllerRelations = nextSegment.slots
    .filter((slot) => slot.occupantKind === 'scope_child' && slot.rowIndex > 0)
    .map((slot) => createAuthorityRelation(rootSlot.id, slot.id));

  nextSegment.relations = [...nonAuthorityRelations, ...controllerRelations];
  return nextSegment;
}

function normalizeEditableSegment(segment: UMGSegmentLayout, rowIds: string[] = []): UMGSegmentLayout {
  const normalizedRowIds = [...new Set(rowIds)];
  let nextSegment = cloneSegment(segment);
  for (const rowIdValue of normalizedRowIds) {
    nextSegment = reindexRowSlots(nextSegment, rowIdValue);
  }
  nextSegment = normalizeAuthorityRelationsToController(nextSegment);
  nextSegment = normalizePeerRelations(nextSegment);
  return nextSegment;
}

export function createEmptySlot(segment: UMGSegmentLayout, rowIdValue: string, columnIndex?: number): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const row = getRowMap(nextSegment).get(rowIdValue);
  if (!row || isLockedRootRow(row)) return nextSegment;

  const nextColumnIndex = columnIndex ?? nextSegment.slots.filter((slot) => slot.rowId === rowIdValue).length;
  nextSegment.slots.push({
    id: makeEmptySlotId(nextSegment, rowIdValue),
    rowId: row.id,
    rowIndex: row.index,
    columnIndex: nextColumnIndex,
    occupantKind: 'empty',
    visualWidth: 'normal'
  });

  return normalizeEditableSegment(nextSegment, [row.id]);
}

export function removeEmptySlot(segment: UMGSegmentLayout, slotId: string): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const slot = nextSegment.slots.find((candidate) => candidate.id === slotId);
  if (!slot || slot.occupantKind !== 'empty') return nextSegment;

  nextSegment.slots = nextSegment.slots.filter((candidate) => candidate.id !== slotId);
  return normalizeEditableSegment(stripSlotRelations(nextSegment, [slotId]), [slot.rowId]);
}

export function clearChildFromSlot(segment: UMGSegmentLayout, childId: string): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const slot = nextSegment.slots.find((candidate) => candidate.occupantKind === 'scope_child' && candidate.occupantId === childId);
  if (!slot) return nextSegment;

  nextSegment.slots = nextSegment.slots.map((candidate) =>
    candidate.id === slot.id
      ? {
          ...candidate,
          occupantKind: 'empty',
          occupantId: undefined,
          occupantScopeChildKind: undefined,
          parentSlotId: undefined
        }
      : candidate
  );

  return normalizeEditableSegment(nextSegment, [slot.rowId]);
}

export function moveChildToRow(segment: UMGSegmentLayout, childId: string, targetRowId: string): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const rowMap = getRowMap(nextSegment);
  const targetRow = rowMap.get(targetRowId);
  if (!targetRow || isLockedRootRow(targetRow)) return nextSegment;

  const sourceSlot = nextSegment.slots.find((slot) => slot.occupantKind === 'scope_child' && slot.occupantId === childId);
  if (!sourceSlot) return nextSegment;

  const targetRowSlots = nextSegment.slots.filter((slot) => slot.rowId === targetRow!.id);
  const nextColumnIndex = targetRowSlots.length;
  const childKind = sourceSlot.occupantScopeChildKind ?? 'future_child';
  nextSegment.slots = nextSegment.slots.map((slot) =>
    slot.id === sourceSlot.id
      ? {
          ...slot,
          occupantKind: 'empty',
          occupantId: undefined,
          occupantScopeChildKind: undefined,
          parentSlotId: undefined
        }
      : slot
  );

  nextSegment.slots.push({
    id: makeMovedChildSlotId(nextSegment, childKind, childId),
    rowId: targetRow!.id,
    rowIndex: targetRow!.index,
    columnIndex: nextColumnIndex,
    occupantKind: 'scope_child',
    occupantId: childId,
    occupantScopeChildKind: childKind,
    visualWidth: sourceSlot.visualWidth ?? 'normal'
  });

  return normalizeEditableSegment(nextSegment, [sourceSlot.rowId, targetRow!.id]);
}

export function moveSlotOccupant(segment: UMGSegmentLayout, sourceSlotId: string, targetSlotId: string): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const rowMap = getRowMap(nextSegment);
  const sourceSlot = nextSegment.slots.find((slot) => slot.id === sourceSlotId);
  const targetSlot = nextSegment.slots.find((slot) => slot.id === targetSlotId);
  if (!sourceSlot || !targetSlot) return nextSegment;
  if (sourceSlot.occupantKind !== 'scope_child') return nextSegment;
  if (targetSlot.occupantKind !== 'empty') return nextSegment;
  if (isLockedRootRow(rowMap.get(targetSlot.rowId))) return nextSegment;

  nextSegment.slots = nextSegment.slots.map((slot) => {
    if (slot.id === sourceSlot.id) {
      return {
        ...slot,
        occupantKind: 'empty',
        occupantId: undefined,
        occupantScopeChildKind: undefined,
        parentSlotId: undefined
      };
    }
    if (slot.id === targetSlot.id) {
      return {
        ...slot,
        occupantKind: 'scope_child',
        occupantId: sourceSlot.occupantId,
        occupantScopeChildKind: sourceSlot.occupantScopeChildKind,
        visualWidth: sourceSlot.visualWidth ?? slot.visualWidth ?? 'normal'
      };
    }
    return slot;
  });

  return normalizeEditableSegment(nextSegment, [sourceSlot.rowId, targetSlot.rowId]);
}

export function moveSlotLeft(segment: UMGSegmentLayout, slotId: string): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const slot = nextSegment.slots.find((candidate) => candidate.id === slotId);
  if (!slot || slot.occupantKind !== 'scope_child') return nextSegment;

  const rowSlots = nextSegment.slots
    .filter((candidate) => candidate.rowId === slot.rowId)
    .sort((a, b) => a.columnIndex - b.columnIndex || a.id.localeCompare(b.id));
  const index = rowSlots.findIndex((candidate) => candidate.id === slotId);
  if (index <= 0) return nextSegment;

  const left = rowSlots[index - 1];
  nextSegment.slots = nextSegment.slots.map((candidate) => {
    if (candidate.id === slot.id) return { ...candidate, columnIndex: left.columnIndex };
    if (candidate.id === left.id) return { ...candidate, columnIndex: slot.columnIndex };
    return candidate;
  });

  return normalizeEditableSegment(nextSegment, [slot.rowId]);
}

export function moveSlotRight(segment: UMGSegmentLayout, slotId: string): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const slot = nextSegment.slots.find((candidate) => candidate.id === slotId);
  if (!slot || slot.occupantKind !== 'scope_child') return nextSegment;

  const rowSlots = nextSegment.slots
    .filter((candidate) => candidate.rowId === slot.rowId)
    .sort((a, b) => a.columnIndex - b.columnIndex || a.id.localeCompare(b.id));
  const index = rowSlots.findIndex((candidate) => candidate.id === slotId);
  if (index === -1 || index >= rowSlots.length - 1) return nextSegment;

  const right = rowSlots[index + 1];
  nextSegment.slots = nextSegment.slots.map((candidate) => {
    if (candidate.id === slot.id) return { ...candidate, columnIndex: right.columnIndex };
    if (candidate.id === right.id) return { ...candidate, columnIndex: slot.columnIndex };
    return candidate;
  });

  return normalizeEditableSegment(nextSegment, [slot.rowId]);
}

export function summarizeSegmentWarnings(scope: SupportedScope, segment?: UMGSegmentLayout): string[] {
  const warnings = [...validateSegmentLayout(scope, segment), ...(segment?.layoutWarnings ?? [])]
    .map((warning) => warning.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return [...new Set(warnings)];
}

export function buildDefaultSegmentForScope(scope: SupportedScope): UMGSegmentLayout {
  const normalizedScope = scope.type === 'sleeve' ? normalizeSleeve(scope) : normalizeNeoStack(scope);
  const ownerScopeKind = getScopeKind(normalizedScope);
  const ownerScopeId = getScopeId(normalizedScope);
  const rows = createDefaultSegmentRows({ ownerScopeKind, ownerScopeId });
  const rootSlot = createRootControllerSlot({
    ownerScopeKind,
    ownerScopeId,
    rootControllerId: normalizedScope.rootController!.id
  });
  const childKind = getScopeChildKind(normalizedScope);
  const childRow = rows.find((row) => row.index === defaultChildRowIndex) ?? rows[1];
  const ordinaryChildren = getScopeChildren(normalizedScope) as SupportedChild[];
  const childSlots = ordinaryChildren.map((child, columnIndex) =>
    createChildSlot({
      ownerScopeKind,
      ownerScopeId,
      childId: child.id,
      childKind,
      rowId: childRow.id,
      rowIndex: childRow.index,
      columnIndex,
      parentSlotId: rootSlot.id
    })
  );
  const authorityRelations = childSlots.map((slot) => createAuthorityRelation(rootSlot.id, slot.id));
  const peerRelations = createPeerComplementRelations(childSlots);

  return {
    id: segmentId(ownerScopeKind, ownerScopeId),
    ownerScopeKind,
    ownerScopeId,
    version: segmentLayoutVersion,
    rows,
    slots: [rootSlot, ...childSlots],
    relations: [...authorityRelations, ...peerRelations],
    gates: []
  };
}

export function placeChildInSlot(
  segment: UMGSegmentLayout,
  child: SupportedChild,
  targetSlotId: string,
  childKind: UMGScopeChildKind
): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const targetIndex = nextSegment.slots.findIndex((slot) => slot.id === targetSlotId);
  if (targetIndex === -1) return nextSegment;

  const targetSlot = nextSegment.slots[targetIndex];
  if (targetSlot.occupantKind !== 'empty') return nextSegment;
  if (targetSlot.rowIndex <= 0) return nextSegment;

  nextSegment.slots[targetIndex] = {
    ...targetSlot,
    occupantKind: 'scope_child',
    occupantId: child.id,
    occupantScopeChildKind: childKind,
    visualWidth: targetSlot.visualWidth ?? 'normal'
  };

  return nextSegment;
}

export function attachAuthorityChild(segment: UMGSegmentLayout, parentSlotId: string, childSlotIdValue: string): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const parentSlot = getSlotById(nextSegment, parentSlotId);
  const childSlot = getSlotById(nextSegment, childSlotIdValue);
  if (!parentSlot || !childSlot) return nextSegment;
  if (childSlot.rowIndex <= parentSlot.rowIndex) return nextSegment;

  nextSegment.slots = nextSegment.slots.map((slot) =>
    slot.id === childSlotIdValue
      ? {
          ...slot,
          parentSlotId
        }
      : slot
  );

  nextSegment.relations = nextSegment.relations.filter(
    (relation) => !(relation.kind === 'authority_child' && relation.targetSlotId === childSlotIdValue)
  );
  nextSegment.relations.push(createAuthorityRelation(parentSlotId, childSlotIdValue));

  return nextSegment;
}

export function normalizePeerRelations(segment: UMGSegmentLayout): UMGSegmentLayout {
  const nextSegment = cloneSegment(segment);
  const slotMap = new Map(nextSegment.slots.map((slot) => [slot.id, slot]));
  const existingNonPeer = nextSegment.relations.filter((relation) => relation.kind !== 'peer_complement');
  const occupiedByRow = new Map<string, UMGSegmentSlot[]>();

  for (const slot of nextSegment.slots) {
    if (slot.occupantKind === 'empty') continue;
    const key = `${slot.rowId}:${slot.rowIndex}`;
    occupiedByRow.set(key, [...(occupiedByRow.get(key) ?? []), slot]);
  }

  const normalizedPeers: UMGSegmentRelation[] = [];
  for (const rowSlots of occupiedByRow.values()) {
    const validRowSlots = rowSlots
      .filter((slot) => slotMap.has(slot.id))
      .sort((a, b) => a.columnIndex - b.columnIndex);
    normalizedPeers.push(...createPeerComplementRelations(validRowSlots));
  }

  nextSegment.relations = [...existingNonPeer, ...normalizedPeers];
  return nextSegment;
}

export function validateSegmentLayout(scope: SupportedScope, segment?: UMGSegmentLayout): string[] {
  const warnings: string[] = [];
  const expectedScopeKind = getScopeKind(scope);
  const expectedScopeId = scope.id;
  const expectedRootControllerId = scope.rootController?.id;

  if (!segment) {
    warnings.push(`Missing segmentLayout for ${scope.type} ${scope.id}.`);
    return warnings;
  }

  const rowMap = new Map(segment.rows.map((row) => [row.id, row]));
  const slotMap = new Map(segment.slots.map((slot) => [slot.id, slot]));
  const gateMap = new Map(segment.gates.map((gate) => [gate.id, gate]));

  if (segment.ownerScopeKind !== expectedScopeKind) {
    warnings.push(`segment ownerScopeKind mismatch for ${scope.type} ${scope.id}.`);
  }

  if (segment.ownerScopeId !== expectedScopeId) {
    warnings.push(`segment ownerScopeId mismatch for ${scope.type} ${scope.id}.`);
  }

  const rootSlot = getRootControllerSlot(segment);
  if (!rootSlot) {
    warnings.push(`Missing root controller slot for ${scope.type} ${scope.id}.`);
  } else {
    if (rootSlot.rowIndex !== 0) {
      warnings.push(`Root controller slot is not Row 0 for ${scope.type} ${scope.id}.`);
    }
    if (expectedRootControllerId && rootSlot.occupantId !== expectedRootControllerId) {
      warnings.push(`Root controller slot occupant mismatch for ${scope.type} ${scope.id}.`);
    }
  }

  const occupiedSlotByOccupantId = new Map<string, string>();
  for (const slot of segment.slots) {
    if (!rowMap.has(slot.rowId)) {
      warnings.push(`Slot ${slot.id} references missing row ${slot.rowId}.`);
    }

    if (slot.occupantKind === 'scope_child' && slot.rowIndex === 0) {
      warnings.push(`Ordinary child in Row 0 at slot ${slot.id}.`);
    }

    if (slot.occupantKind !== 'empty' && slot.occupantId) {
      const existing = occupiedSlotByOccupantId.get(slot.occupantId);
      if (existing && existing !== slot.id) {
        warnings.push(`Duplicate occupied slot occupant ${slot.occupantId} in ${existing} and ${slot.id}.`);
      }
      occupiedSlotByOccupantId.set(slot.occupantId, slot.id);
    }
  }

  for (const relation of segment.relations) {
    const sourceSlot = slotMap.get(relation.sourceSlotId);
    const targetSlot = slotMap.get(relation.targetSlotId);

    if (!sourceSlot || !targetSlot) {
      warnings.push(`Relation ${relation.id} references missing slot.`);
      continue;
    }

    if (relation.kind === 'authority_child' && targetSlot.rowIndex <= sourceSlot.rowIndex) {
      warnings.push(`authority_child relation ${relation.id} points same-row or upward.`);
    }

    if (relation.kind === 'peer_complement' && sourceSlot.rowIndex !== targetSlot.rowIndex) {
      warnings.push(`peer_complement relation ${relation.id} is not same-row.`);
    }

    if (relation.kind === 'gated_route') {
      if (!relation.gateId || !gateMap.has(relation.gateId)) {
        warnings.push(`gated_route relation ${relation.id} references missing gate.`);
      }
    }
  }

  for (const gate of segment.gates) {
    if (gate.action !== 'activate_target') continue;
    if (!gate.sourceSlotId || !gate.targetSlotId) continue;

    const sourceSlot = slotMap.get(gate.sourceSlotId);
    const targetSlot = slotMap.get(gate.targetSlotId);
    if (!sourceSlot || !targetSlot) continue;

    if (sourceSlot.rowIndex > targetSlot.rowIndex) {
      const hasEscalationSignal = segment.gates.some(
        (candidate) =>
          escalationActions.includes(candidate.action) &&
          candidate.sourceSlotId === gate.sourceSlotId &&
          candidate.targetSlotId === gate.targetSlotId
      );
      if (!hasEscalationSignal) {
        warnings.push(`Gate ${gate.id} enables lower-to-higher direct activation without escalation_signal.`);
      }
    }
  }

  return warnings;
}
