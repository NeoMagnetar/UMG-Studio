import type {
  UMGOverlayInferenceContext,
  OverlayInferenceResult,
  InferredOverlay,
  OverlayTriggerEvidence,
} from "./umgOverlayTypes";
import { UMG_OVERLAY_REGISTRY } from "./umgOverlayRegistry";

const GENERIC_LOW_PRIORITY_TERMS = new Set([
  "summary",
  "report",
  "documentation",
  "technical",
  "support",
  "customer",
  "draft",
  "reply",
  "content",
]);

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_/\\.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesTerm(text: string, term: string): boolean {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  return text.includes(normalizedTerm);
}

function scoreTerm(term: string, baseWeight: number, strongDomainPresent: boolean): number {
  const normalized = normalizeText(term);
  if (strongDomainPresent && GENERIC_LOW_PRIORITY_TERMS.has(normalized)) {
    return Math.max(1, Math.floor(baseWeight * 0.25));
  }
  return baseWeight;
}

function confidenceForScore(score: number): InferredOverlay["confidence"] {
  if (score >= 18) return "dominant";
  if (score >= 11) return "strong";
  if (score >= 6) return "moderate";
  if (score >= 2) return "weak";
  return "none";
}

function collectContextTexts(context: UMGOverlayInferenceContext) {
  const prompt = normalizeText(context.prompt);
  const uploadedText = normalizeText(context.uploadedText);
  const packageId = normalizeText(context.uploadedPackage?.sleeveId);
  const packageTitle = normalizeText(context.uploadedPackage?.title);
  const packageFileName = normalizeText(context.uploadedPackage?.fileName);

  const packageStacks = (context.uploadedPackage?.neoStackTitles ?? []).map(normalizeText);
  const packageBlocks = (context.uploadedPackage?.neoBlockTitles ?? []).map(normalizeText);
  const packageKeywords = (context.uploadedPackage?.keywords ?? []).map(normalizeText);

  const candidateText = (context.candidateBlocks ?? [])
    .map((block) =>
      normalizeText([
        block.id,
        block.title,
        block.blockType,
        block.role,
        block.tags?.join(" "),
        block.category,
        block.domain,
        block.description,
        block.sourcePath,
      ].join(" "))
    )
    .join(" ");

  return {
    prompt,
    uploadedText,
    packageId,
    packageTitle,
    packageFileName,
    packageStacks,
    packageBlocks,
    packageKeywords,
    candidateText,
    allStrongDomainText: [
      prompt,
      packageId,
      packageTitle,
      packageFileName,
      packageStacks.join(" "),
      packageBlocks.join(" "),
      packageKeywords.join(" "),
    ].join(" "),
  };
}

export function inferRoutingOverlaysFromContext(
  context: UMGOverlayInferenceContext
): OverlayInferenceResult {
  const texts = collectContextTexts(context);

  const strongDomainPresent =
    /\b(vrchat|blender|unity|udonsharp|c#|csharp|python|javascript|typescript|sales|crm|website|compliance|audit)\b/.test(
      texts.allStrongDomainText
    );

  const allOverlays: InferredOverlay[] = UMG_OVERLAY_REGISTRY.map((overlay) => {
    const evidence: OverlayTriggerEvidence[] = [];
    let score = 0;

    for (const term of overlay.triggerTerms) {
      if (includesTerm(texts.prompt, term)) {
        const weight = scoreTerm(term, 5, strongDomainPresent);
        score += weight;
        evidence.push({ source: "prompt", term, weight, matchedText: term });
      }

      if (includesTerm(texts.packageId, term)) {
        const weight = scoreTerm(term, 10, strongDomainPresent);
        score += weight;
        evidence.push({ source: "package_id", term, weight, matchedText: term });
      }

      if (includesTerm(texts.packageTitle, term)) {
        const weight = scoreTerm(term, 9, strongDomainPresent);
        score += weight;
        evidence.push({ source: "package_title", term, weight, matchedText: term });
      }

      if (includesTerm(texts.packageFileName, term)) {
        const weight = scoreTerm(term, 7, strongDomainPresent);
        score += weight;
        evidence.push({ source: "package_filename", term, weight, matchedText: term });
      }

      for (const stackText of texts.packageStacks) {
        if (includesTerm(stackText, term)) {
          const weight = scoreTerm(term, 6, strongDomainPresent);
          score += weight;
          evidence.push({ source: "package_neostack", term, weight, matchedText: stackText });
        }
      }

      for (const blockText of texts.packageBlocks) {
        if (includesTerm(blockText, term)) {
          const weight = scoreTerm(term, 5, strongDomainPresent);
          score += weight;
          evidence.push({ source: "package_neoblock", term, weight, matchedText: blockText });
        }
      }

      if (includesTerm(texts.uploadedText, term)) {
        const weight = scoreTerm(term, 3, strongDomainPresent);
        score += weight;
        evidence.push({ source: "uploaded_text", term, weight, matchedText: term });
      }

      if (includesTerm(texts.candidateText, term)) {
        const weight = scoreTerm(term, 1, strongDomainPresent);
        score += weight;
        evidence.push({ source: "candidate_block", term, weight, matchedText: term });
      }
    }

    for (const negativeTerm of overlay.negativeTerms ?? []) {
      if (includesTerm(texts.allStrongDomainText, negativeTerm)) {
        score -= 6;
        evidence.push({ source: "negative", term: negativeTerm, weight: -6, matchedText: negativeTerm });
      }
    }

    const confidence = confidenceForScore(score);
    const selected = score >= 6;

    return {
      overlayId: overlay.overlayId,
      title: overlay.title,
      score,
      confidence,
      selected,
      evidence,
      rejectedReason: selected ? undefined : "Score below selection threshold.",
    };
  }).sort((a, b) => b.score - a.score);

  const selectedOverlays = allOverlays.filter((overlay) => overlay.selected);
  const rejectedOverlays = allOverlays.filter((overlay) => !overlay.selected);
  const dominantOverlayId = selectedOverlays[0]?.overlayId;

  return {
    selectedOverlays,
    rejectedOverlays,
    allOverlays,
    dominantOverlayId,
    explanation:
      selectedOverlays.length > 0
        ? `Selected overlays: ${selectedOverlays.map((o) => o.overlayId).join(", ")}.`
        : "No overlay crossed the deterministic selection threshold.",
  };
}
