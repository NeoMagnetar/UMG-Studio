export type UMGBlockType =
  | "sleeve"
  | "neostack"
  | "neoblock"
  | "molt"
  | "gate"
  | "tool"
  | "capability"
  | "artifact";

export type MoltRole =
  | "trigger"
  | "directive"
  | "instruction"
  | "subject"
  | "primary"
  | "philosophy"
  | "blueprint"
  | "gate"
  | "metaTool"
  | "unknown";

export type OverlayActivationState =
  | "active"
  | "inactive"
  | "available"
  | "missing"
  | "blocked"
  | "draftSuggested";

export type LayoutDependencyType = "explicit" | "inferred" | "layout-only";

export type RouteRole =
  | "controller"
  | "selector"
  | "constraint"
  | "reader"
  | "planner"
  | "worker"
  | "validator"
  | "executor"
  | "output"
  | "auditor";

export type SiblingSemantics =
  | "single_select"
  | "multi_select"
  | "parallel"
  | "convergent"
  | "sequential"
  | "informational";

export type OverlayConfidenceBand = "none" | "weak" | "moderate" | "strong" | "dominant";

export interface UMGOverlayRow {
  rowId: string;
  rowIndex: number;
  rowLabel: string;
  rowPurpose: string;
  allowedBlockTypes: UMGBlockType[];
  preferredRoles?: MoltRole[];
  routeRoles?: RouteRole[];
  siblingSemantics: SiblingSemantics;
  activationPolicy:
    | "controller_always_on_when_overlay_selected"
    | "activate_on_prompt_match"
    | "activate_on_package_match"
    | "activate_on_capability_available"
    | "activate_on_capability_required"
    | "activate_on_validation_required"
    | "activate_on_output_required"
    | "layout_only_until_route";
  triggerTerms?: string[];
  boostedTags?: string[];
  negativeTerms?: string[];
  layoutOrder?: number;
}

export interface UMGOverlayDefinition {
  overlayId: string;
  title: string;
  description: string;
  domain: string;
  extendsOverlayIds?: string[];
  triggerTerms: string[];
  negativeTerms?: string[];
  boostedTags: string[];
  boostedBlockIds?: string[];
  rows: UMGOverlayRow[];
  evidenceRules?: string[];
}

export interface UMGOverlayInferenceContext {
  prompt?: string;
  uploadedText?: string;
  uploadedPackage?: {
    detected?: boolean;
    packageType?: string;
    sleeveId?: string;
    title?: string;
    fileName?: string;
    keywords?: string[];
    neoStackTitles?: string[];
    neoBlockTitles?: string[];
    moltTitles?: string[];
  };
  candidateBlocks?: UMGIndexedBlock[];
}

export interface UMGIndexedBlock {
  id: string;
  title?: string;
  blockType?: UMGBlockType | string;
  role?: MoltRole | string;
  tags?: string[];
  category?: string;
  domain?: string;
  description?: string;
  sourcePath?: string;
  sourceKind?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface OverlayTriggerEvidence {
  source:
    | "prompt"
    | "uploaded_text"
    | "package_id"
    | "package_title"
    | "package_filename"
    | "package_neostack"
    | "package_neoblock"
    | "candidate_block"
    | "negative";
  term: string;
  weight: number;
  matchedText?: string;
}

export interface InferredOverlay {
  overlayId: string;
  title: string;
  score: number;
  confidence: OverlayConfidenceBand;
  selected: boolean;
  evidence: OverlayTriggerEvidence[];
  rejectedReason?: string;
}

export interface OverlayInferenceResult {
  selectedOverlays: InferredOverlay[];
  rejectedOverlays: InferredOverlay[];
  allOverlays: InferredOverlay[];
  dominantOverlayId?: string;
  explanation: string;
}

export interface NeoBlockPlacementInput {
  id: string;
  title: string;
  parentNeoStackId?: string;
  parentNeoStackTitle?: string;
  description?: string;
  tags?: string[];
  roles?: MoltRole[];
  blockType?: "neoblock";
  explicitDependsOn?: string[];
  sourceKind?: string;
  metadata?: Record<string, unknown>;
}

export interface NeoBlockLatticePlacement {
  neoBlockId: string;
  title: string;
  overlayId: string;
  rowId: string;
  rowLabel: string;
  rowIndex: number;
  columnIndex: number;
  siblingGroup: string;
  activationState: OverlayActivationState;
  activationReason: string;
  dependencyType: LayoutDependencyType;
  explicitDependsOn: string[];
  routeRole: RouteRole;
  evidence: string[];
  x: number;
  y: number;
}

export interface OverlayPlacementResult {
  placements: NeoBlockLatticePlacement[];
  rowsUsed: string[];
  unplacedNeoBlocks: NeoBlockPlacementInput[];
  explanation: string;
}

export interface RouteActivationContext {
  prompt?: string;
  selectedOverlayIds: string[];
  requiredCapabilities?: string[];
  availableCapabilities?: string[];
  unavailableCapabilities?: string[];
  actionMode?: "observe" | "approval" | "direct";
}

export interface RouteActivationResult {
  placements: NeoBlockLatticePlacement[];
  activeNeoBlockIds: string[];
  inactiveNeoBlockIds: string[];
  missingCapabilityIds: string[];
  blockedNeoBlockIds: string[];
  explanation: string;
}
