import { describe, expect, it } from "vitest";
import {
  inferRoutingOverlaysFromContext,
  placeNeoBlocksIntoOverlayRows,
  activateOverlayRoute,
} from "../lib/umg/overlayLattice";

describe("UMG Overlay Lattice", () => {
  it("selects software_engineer.core for code prompts", () => {
    const result = inferRoutingOverlaysFromContext({
      prompt: "Build me a Python code engineer sleeve that can inspect repo files and generate patches.",
    });

    expect(result.selectedOverlays.map((o) => o.overlayId)).toContain("software_engineer.core");
  });

  it("selects VRChat/Blender overlay for VRChat package context", () => {
    const result = inferRoutingOverlaysFromContext({
      prompt: "VR/Blender Code Engineer Sleeve",
      uploadedPackage: {
        detected: true,
        sleeveId: "SLV.VRCHAT.DEVELOPER.v1.0",
        title: "VRChat Developer Sleeve",
        fileName: "vrchat-sleeve-v1.0.0.zip",
        neoStackTitles: [
          "Avatar Development Stack",
          "Optimization & Publishing Stack",
          "Unity SDK Integration Stack",
        ],
      },
    });

    const ids = result.selectedOverlays.map((o) => o.overlayId);
    expect(ids).toContain("software_engineer.core");
    expect(ids).toContain("vrchat_blender.developer");
  });

  it("lets package ID SLV.VRCHAT.DEVELOPER.v1.0 strongly select VRChat overlay", () => {
    const result = inferRoutingOverlaysFromContext({
      uploadedPackage: {
        detected: true,
        sleeveId: "SLV.VRCHAT.DEVELOPER.v1.0",
        title: "VRChat Developer Sleeve",
      },
    });

    expect(result.selectedOverlays.map((o) => o.overlayId)).toContain("vrchat_blender.developer");
    expect(result.allOverlays.find((o) => o.overlayId === "vrchat_blender.developer")?.confidence).toMatch(/strong|dominant/);
  });

  it("does not let generic report/support terms override explicit VRChat/Blender evidence", () => {
    const result = inferRoutingOverlaysFromContext({
      prompt:
        "VRChat Blender developer sleeve that can produce technical reports and summaries after optimization.",
      uploadedPackage: {
        detected: true,
        sleeveId: "SLV.VRCHAT.DEVELOPER.v1.0",
        title: "VRChat Developer Sleeve",
      },
    });

    expect(result.dominantOverlayId).toBe("vrchat_blender.developer");
  });

  it("selects sales overlay for sales prompts", () => {
    const result = inferRoutingOverlaysFromContext({
      prompt: "Create a sales outreach sleeve for CRM follow-up and objection handling.",
    });

    expect(result.selectedOverlays.map((o) => o.overlayId)).toContain("sales.operator");
  });

  it("selects website overlay for website builder prompts", () => {
    const result = inferRoutingOverlaysFromContext({
      prompt: "Design a landing page website with SEO, responsive layout, and React components.",
    });

    expect(result.selectedOverlays.map((o) => o.overlayId)).toContain("website_builder.design");
  });

  it("places NeoBlocks into multiple lattice rows and sibling columns", () => {
    const inferred = inferRoutingOverlaysFromContext({
      prompt: "VRChat Blender developer sleeve with Unity, avatar optimization, and export reports.",
      uploadedPackage: {
        detected: true,
        sleeveId: "SLV.VRCHAT.DEVELOPER.v1.0",
      },
    });

    const placement = placeNeoBlocksIntoOverlayRows({
      selectedOverlays: inferred.selectedOverlays,
      neoBlocks: [
        { id: "nb.controller", title: "VRChat Developer Controller" },
        { id: "nb.blender", title: "Blender Platform Specialist" },
        { id: "nb.unity", title: "Unity Platform Specialist" },
        { id: "nb.optimization", title: "Avatar Optimization Worker" },
        { id: "nb.validation", title: "SDK Compatibility Validation" },
        { id: "nb.output", title: "Optimization Report Output" },
      ],
    });

    const rowIndexes = new Set(placement.placements.map((p) => p.rowIndex));
    const xPositions = new Set(placement.placements.map((p) => p.x));

    expect(rowIndexes.size).toBeGreaterThan(2);
    expect(xPositions.size).toBeGreaterThan(2);
  });

  it("does not create fake hard dependencies for inferred layout", () => {
    const inferred = inferRoutingOverlaysFromContext({
      prompt: "Software engineer sleeve",
    });

    const placement = placeNeoBlocksIntoOverlayRows({
      selectedOverlays: inferred.selectedOverlays,
      neoBlocks: [
        { id: "nb.python", title: "Python Specialist" },
        { id: "nb.debug", title: "Debug Code Worker" },
      ],
    });

    expect(placement.placements.every((p) => p.dependencyType !== "explicit")).toBe(true);
  });

  it("activates matching route blocks and greys inactive siblings", () => {
    const inferred = inferRoutingOverlaysFromContext({
      prompt: "Blender Python avatar optimization",
      uploadedPackage: {
        detected: true,
        sleeveId: "SLV.VRCHAT.DEVELOPER.v1.0",
      },
    });

    const placement = placeNeoBlocksIntoOverlayRows({
      selectedOverlays: inferred.selectedOverlays,
      neoBlocks: [
        { id: "nb.controller", title: "VRChat Developer Controller" },
        { id: "nb.blender", title: "Blender Platform Specialist" },
        { id: "nb.unity", title: "Unity Platform Specialist" },
        { id: "nb.avatar", title: "Avatar Optimization Worker" },
      ],
    });

    const activation = activateOverlayRoute({
      placements: placement.placements,
      context: {
        prompt: "Use Blender Python for avatar optimization.",
        selectedOverlayIds: inferred.selectedOverlays.map((overlay) => overlay.overlayId),
        actionMode: "observe",
      },
    });

    expect(activation.activeNeoBlockIds).toContain("nb.controller");
    expect(activation.activeNeoBlockIds).toContain("nb.blender");
    expect(activation.activeNeoBlockIds).toContain("nb.avatar");
    expect(activation.inactiveNeoBlockIds).toContain("nb.unity");
  });

  it("blocks execution row in Observe mode", () => {
    const inferred = inferRoutingOverlaysFromContext({ prompt: "VRChat Blender export execution" });
    const placement = placeNeoBlocksIntoOverlayRows({
      selectedOverlays: inferred.selectedOverlays,
      neoBlocks: [{ id: "nb.export", title: "VR Build Export Execution" }],
    });
    const activation = activateOverlayRoute({
      placements: placement.placements,
      context: {
        prompt: "Prepare export execution.",
        selectedOverlayIds: inferred.selectedOverlays.map((overlay) => overlay.overlayId),
        actionMode: "observe",
      },
    });

    expect(activation.blockedNeoBlockIds).toContain("nb.export");
    expect(activation.placements.find((p) => p.neoBlockId === "nb.export")?.activationState).toBe("blocked");
  });
});
