import type {
  NeoBlockLatticePlacement,
  RouteActivationContext,
  RouteActivationResult,
} from "./umgOverlayTypes";

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_/\\.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function promptMatchesPlacement(prompt: string, placement: NeoBlockLatticePlacement): boolean {
  const haystack = normalizeText([
    placement.title,
    placement.rowLabel,
    placement.routeRole,
  ].join(" "));
  const haystackTokens = new Set(haystack.split(" ").filter(Boolean));

  return prompt
    .split(" ")
    .filter((token) => token.length > 2)
    .some((token) => haystackTokens.has(token));
}

export function activateOverlayRoute(args: {
  placements: NeoBlockLatticePlacement[];
  context: RouteActivationContext;
}): RouteActivationResult {
  const prompt = normalizeText(args.context.prompt);
  const requiredCapabilities = new Set(args.context.requiredCapabilities ?? []);
  const availableCapabilities = new Set(args.context.availableCapabilities ?? []);
  const unavailableCapabilities = new Set(args.context.unavailableCapabilities ?? []);
  const missingCapabilityIds: string[] = [];
  const blockedNeoBlockIds: string[] = [];

  const placements = args.placements.map((placement) => {
    let activationState = placement.activationState;
    let activationReason = placement.activationReason;

    if (placement.routeRole === "controller") {
      activationState = "active";
      activationReason = "Controller block is active for selected overlay.";
    } else if (promptMatchesPlacement(prompt, placement)) {
      activationState = "active";
      activationReason = "Prompt matched this block/row evidence.";
    } else {
      activationState = "inactive";
      activationReason = "Available sibling block, but not active for this route.";
    }

    if (placement.rowId === "capability_binding") {
      const capabilityId = placement.neoBlockId;
      if (requiredCapabilities.has(capabilityId) && unavailableCapabilities.has(capabilityId)) {
        activationState = "missing";
        activationReason = "Capability is required by route but unavailable.";
        missingCapabilityIds.push(capabilityId);
      } else if (requiredCapabilities.has(capabilityId) && availableCapabilities.has(capabilityId)) {
        activationState = "active";
        activationReason = "Capability is required and available.";
      }
    }

    if (placement.rowId === "execution" && args.context.actionMode === "observe") {
      activationState = "blocked";
      activationReason = "Observe mode prepares routes only and does not execute external tools.";
      blockedNeoBlockIds.push(placement.neoBlockId);
    }

    return { ...placement, activationState, activationReason };
  });

  return {
    placements,
    activeNeoBlockIds: placements.filter((placement) => placement.activationState === "active").map((placement) => placement.neoBlockId),
    inactiveNeoBlockIds: placements.filter((placement) => placement.activationState === "inactive").map((placement) => placement.neoBlockId),
    missingCapabilityIds,
    blockedNeoBlockIds,
    explanation:
      "Applied route activation. Active blocks glow, inactive siblings remain visible, and Observe-mode execution remains blocked.",
  };
}
