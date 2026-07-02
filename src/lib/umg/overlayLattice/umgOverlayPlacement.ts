import type {
  NeoBlockPlacementInput,
  NeoBlockLatticePlacement,
  OverlayPlacementResult,
  InferredOverlay,
  LayoutDependencyType,
  RouteRole,
  UMGOverlayDefinition,
} from "./umgOverlayTypes";
import { getOverlayById } from "./umgOverlayRegistry";

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_/\\.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textForNeoBlock(block: NeoBlockPlacementInput): string {
  return normalizeText([
    block.id,
    block.title,
    block.parentNeoStackTitle,
    block.description,
    block.tags?.join(" "),
    block.roles?.join(" "),
    block.sourceKind,
  ].join(" "));
}

function rowScore(blockText: string, rowTerms: string[] = []): number {
  let score = 0;
  for (const term of rowTerms) {
    const normalized = normalizeText(term);
    if (normalized && blockText.includes(normalized)) {
      score += normalized.length > 10 ? 4 : 2;
    }
  }
  return score;
}

function routeRoleForRow(rowId: string): RouteRole {
  switch (rowId) {
    case "controller":
      return "controller";
    case "intent":
    case "specialization":
      return "selector";
    case "context_intake":
      return "reader";
    case "planning_composition":
      return "planner";
    case "capability_binding":
      return "worker";
    case "validation":
      return "validator";
    case "execution":
      return "executor";
    case "output":
      return "output";
    case "audit_iteration":
      return "auditor";
    default:
      return "worker";
  }
}

function dependencyTypeForBlock(block: NeoBlockPlacementInput): LayoutDependencyType {
  if ((block.explicitDependsOn ?? []).length > 0) return "explicit";
  return "layout-only";
}

function pickOverlay(
  selectedOverlays: InferredOverlay[],
  overlayDefinitions: UMGOverlayDefinition[]
): UMGOverlayDefinition | undefined {
  for (const selected of selectedOverlays) {
    const overlay = overlayDefinitions.find((candidate) => candidate.overlayId === selected.overlayId);
    if (overlay) return overlay;
  }
  return overlayDefinitions[0];
}

export function placeNeoBlocksIntoOverlayRows(args: {
  neoBlocks: NeoBlockPlacementInput[];
  selectedOverlays: InferredOverlay[];
  cellWidth?: number;
  rowHeight?: number;
  originX?: number;
  originY?: number;
}): OverlayPlacementResult {
  const cellWidth = args.cellWidth ?? 220;
  const rowHeight = args.rowHeight ?? 160;
  const originX = args.originX ?? 120;
  const originY = args.originY ?? 80;

  const overlayDefinitions = args.selectedOverlays
    .map((overlay) => getOverlayById(overlay.overlayId))
    .filter(Boolean) as UMGOverlayDefinition[];

  const primaryOverlay = pickOverlay(args.selectedOverlays, overlayDefinitions);

  if (!primaryOverlay) {
    return {
      placements: [],
      rowsUsed: [],
      unplacedNeoBlocks: args.neoBlocks,
      explanation: "No overlay definition available for placement.",
    };
  }

  const rowBuckets = new Map<string, NeoBlockPlacementInput[]>();
  const placements: NeoBlockLatticePlacement[] = [];
  const unplacedNeoBlocks: NeoBlockPlacementInput[] = [];

  for (const block of args.neoBlocks) {
    const blockText = textForNeoBlock(block);
    let bestRow = primaryOverlay.rows[0];
    let bestScore = -1;

    for (const row of primaryOverlay.rows) {
      const terms = [
        ...(row.triggerTerms ?? []),
        row.rowLabel,
        row.rowPurpose,
        ...(row.boostedTags ?? []),
      ];

      let score = rowScore(blockText, terms);

      if (row.preferredRoles?.some((role) => block.roles?.includes(role))) {
        score += 3;
      }

      if (row.routeRoles?.some((role) => normalizeText(block.title).includes(role))) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestRow = row;
      }
    }

    if (!bestRow) {
      unplacedNeoBlocks.push(block);
      continue;
    }

    const bucketKey = bestRow.rowId;
    const bucket = rowBuckets.get(bucketKey) ?? [];
    bucket.push(block);
    rowBuckets.set(bucketKey, bucket);
  }

  for (const row of primaryOverlay.rows) {
    const blocks = rowBuckets.get(row.rowId) ?? [];
    const rowWidth = Math.max(1, blocks.length) * cellWidth;

    blocks.forEach((block, index) => {
      const centeredX = originX + index * cellWidth - rowWidth / 2 + cellWidth / 2;
      const y = originY + row.rowIndex * rowHeight;
      const dependencyType = dependencyTypeForBlock(block);
      const routeRole = routeRoleForRow(row.rowId);

      placements.push({
        neoBlockId: block.id,
        title: block.title,
        overlayId: primaryOverlay.overlayId,
        rowId: row.rowId,
        rowLabel: row.rowLabel,
        rowIndex: row.rowIndex,
        columnIndex: index,
        siblingGroup: `${primaryOverlay.overlayId}:${row.rowId}`,
        activationState:
          row.activationPolicy === "controller_always_on_when_overlay_selected" ? "active" : "available",
        activationReason:
          row.activationPolicy === "controller_always_on_when_overlay_selected"
            ? "Controller row activates when overlay is selected."
            : "Placed as an available sibling option; activation depends on route request.",
        dependencyType,
        explicitDependsOn: block.explicitDependsOn ?? [],
        routeRole,
        evidence: [
          `Placed in row "${row.rowLabel}" using overlay "${primaryOverlay.overlayId}".`,
          dependencyType === "explicit"
            ? "Explicit dependency metadata exists."
            : "Placement is layout-only and does not create a hard dependency.",
        ],
        x: centeredX,
        y,
      });
    });
  }

  return {
    placements,
    rowsUsed: Array.from(new Set(placements.map((placement) => placement.rowId))),
    unplacedNeoBlocks,
    explanation: `Placed ${placements.length} NeoBlocks using overlay ${primaryOverlay.overlayId}.`,
  };
}
