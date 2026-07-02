import type { UMGOverlayDefinition, UMGOverlayRow } from "./umgOverlayTypes";
import { UNIVERSAL_LATTICE_ROWS } from "./umgUniversalLattice";

function row(baseRowId: string, patch: Partial<UMGOverlayRow>): UMGOverlayRow {
  const base = UNIVERSAL_LATTICE_ROWS.find((r) => r.rowId === baseRowId);
  if (!base) {
    throw new Error(`Unknown universal lattice row: ${baseRowId}`);
  }
  return { ...base, ...patch };
}

export const SOFTWARE_ENGINEER_OVERLAY: UMGOverlayDefinition = {
  overlayId: "software_engineer.core",
  title: "Software / Code Engineer",
  domain: "software_engineering",
  description:
    "Routes coding, scripting, debugging, integration, build, repo, and tool-execution tasks through a code-engineering lattice.",
  triggerTerms: [
    "code", "coding", "software", "developer", "engineer", "program", "programming", "script", "scripting",
    "debug", "refactor", "repo", "repository", "build", "compile", "terminal", "api", "sdk", "python",
    "javascript", "typescript", "c#", "csharp", "c++", "java", "sql", "html", "css", "react", "node",
  ],
  boostedTags: ["software", "code", "developer", "programming", "script", "debugging", "repo", "build", "compile", "tool", "file", "terminal"],
  rows: [
    row("controller", { rowLabel: "Code Engineer Controller", triggerTerms: ["code engineer", "software engineer", "developer sleeve"] }),
    row("intent", { rowLabel: "Engineering Intent", triggerTerms: ["create", "debug", "refactor", "explain", "integrate", "build", "compile"] }),
    row("context_intake", { rowLabel: "Code Context Intake", triggerTerms: ["repo", "file", "log", "error", "package", "dependency", "uploaded"] }),
    row("specialization", { rowLabel: "Language / Platform", triggerTerms: ["python", "javascript", "typescript", "c#", "csharp", "c++", "java", "sql", "html", "css", "react", "node", "blender", "unity", "vrchat"] }),
    row("planning_composition", { rowLabel: "Engineering Task Type", triggerTerms: ["generate code", "debug code", "refactor", "api integration", "ui component", "automation", "test", "patch"] }),
    row("capability_binding", { rowLabel: "Code Tool Capability", triggerTerms: ["file edit", "terminal", "compile", "repo inspection", "artifact", "project edit"] }),
    row("validation", { rowLabel: "Code Validation", triggerTerms: ["syntax", "compile check", "test", "lint", "dependency", "permission"] }),
    row("execution", { rowLabel: "Engineering Execution" }),
    row("output", { rowLabel: "Code Output", triggerTerms: ["code file", "patch", "artifact", "report", "diff", "command plan"] }),
    row("audit_iteration", { rowLabel: "Engineering Audit", triggerTerms: ["explain changes", "files touched", "next fix", "trace"] }),
  ],
  evidenceRules: [
    "Explicit programming language terms dominate generic report/support terms.",
    "Repo/package/file/error-log evidence strongly activates this overlay.",
    "Tool execution must remain capability-gated.",
  ],
};

export const VRCHAT_BLENDER_OVERLAY: UMGOverlayDefinition = {
  overlayId: "vrchat_blender.developer",
  title: "VRChat / Blender / Unity Developer",
  domain: "vrchat_blender_unity",
  extendsOverlayIds: ["software_engineer.core"],
  description:
    "Specializes software engineering routes for Blender, Unity, VRChat, UdonSharp, avatars, worlds, shaders, rigs, animation, optimization, and publishing.",
  triggerTerms: [
    "vrchat", "blender", "unity", "udon", "udonsharp", "avatar", "world", "shader", "prefab", "rig",
    "rigging", "animation", "material", "mesh", "model", "fbx", "sdk", "vrcsdk", "physbones",
    "performance rank", "optimization", "upload", "publishing",
  ],
  boostedTags: ["vrchat", "blender", "unity", "udonsharp", "avatar", "world", "shader", "prefab", "rigging", "animation", "modeling", "optimization", "publishing"],
  rows: [
    row("controller", { rowLabel: "VR / Game Developer Controller", triggerTerms: ["vrchat developer", "blender developer", "game developer"] }),
    row("intent", { rowLabel: "VR / Game Development Intent", triggerTerms: ["avatar", "world", "asset", "shader", "optimize", "upload", "publish"] }),
    row("context_intake", { rowLabel: "Asset / Project Context Intake", triggerTerms: ["blend file", "unity project", "avatar package", "sdk", "prefab", "scene"] }),
    row("specialization", { rowLabel: "Platform / Engine", triggerTerms: ["blender", "unity", "vrchat", "udonsharp", "vrcsdk"], siblingSemantics: "multi_select" }),
    row("planning_composition", { rowLabel: "Asset / Build Task", triggerTerms: ["avatar", "world", "shader", "material", "rigging", "animation", "optimization", "prefab", "mesh"], siblingSemantics: "multi_select" }),
    row("capability_binding", { rowLabel: "VR Tool Binding", triggerTerms: ["blender python", "unity editor", "file edit", "terminal", "export", "import", "sdk"] }),
    row("validation", { rowLabel: "VR Validation", triggerTerms: ["polygon budget", "shader safety", "sdk compatibility", "performance", "upload readiness"] }),
    row("execution", { rowLabel: "VR Build / Export Execution" }),
    row("output", { rowLabel: "VR / Blender Output", triggerTerms: ["model script", "unity patch", "avatar setup", "optimization report", "export checklist"] }),
    row("audit_iteration", { rowLabel: "VR Iteration / Publishing Notes" }),
  ],
  evidenceRules: [
    "Sleeve ID or package title containing VRChat strongly activates this overlay.",
    "Blender and VRChat may both activate in the same route.",
    "Unity/C#/UdonSharp blocks are siblings, not automatic hard dependencies.",
  ],
};

export const SALES_OVERLAY: UMGOverlayDefinition = {
  overlayId: "sales.operator",
  title: "Sales / CRM / Outreach Operator",
  domain: "sales",
  description: "Routes lead generation, outreach, follow-up, objection handling, CRM, proposals, and sales reporting tasks.",
  triggerTerms: ["sales", "lead", "leads", "prospect", "prospecting", "outreach", "follow up", "follow-up", "crm", "pipeline", "deal", "proposal", "quote", "objection", "close", "conversion", "customer", "retention"],
  boostedTags: ["sales", "crm", "outreach", "lead-generation", "proposal", "pipeline", "conversion"],
  rows: [
    row("controller", { rowLabel: "Sales Controller" }),
    row("intent", { rowLabel: "Sales Intent", triggerTerms: ["lead generation", "outreach", "follow-up", "objection", "close", "retention"] }),
    row("context_intake", { rowLabel: "Customer / Product Context", triggerTerms: ["customer profile", "product", "service", "market", "prior message", "crm notes"] }),
    row("specialization", { rowLabel: "Sales Channel", triggerTerms: ["email", "sms", "phone", "linkedin", "crm", "proposal"] }),
    row("planning_composition", { rowLabel: "Sales Strategy", triggerTerms: ["pain point", "value proposition", "urgency", "qualification", "pricing"] }),
    row("capability_binding", { rowLabel: "Sales Tool Binding", triggerTerms: ["crm update", "draft message", "calendar booking", "report generation"] }),
    row("validation", { rowLabel: "Sales Approval", triggerTerms: ["send approval", "pricing check", "sensitive claim", "compliance"] }),
    row("execution", { rowLabel: "Sales Action" }),
    row("output", { rowLabel: "Sales Output", triggerTerms: ["message", "call script", "proposal", "crm summary"] }),
    row("audit_iteration", { rowLabel: "Sales Follow-Up Audit", triggerTerms: ["next action", "tracking", "conversion notes"] }),
  ],
};

export const WEBSITE_BUILDER_OVERLAY: UMGOverlayDefinition = {
  overlayId: "website_builder.design",
  title: "Website Design / Builder",
  domain: "website_design",
  description: "Routes landing page, business website, portfolio, app UI, ecommerce, copy, design system, and deployment tasks.",
  triggerTerms: ["website", "web site", "webpage", "landing page", "portfolio", "business site", "ecommerce", "shopify", "wordpress", "web design", "ui", "ux", "react", "tailwind", "html", "css", "seo", "responsive", "wireframe"],
  boostedTags: ["website", "web-design", "ui", "ux", "landing-page", "html", "css", "react", "seo", "responsive"],
  rows: [
    row("controller", { rowLabel: "Website Builder Controller" }),
    row("intent", { rowLabel: "Website Intent", triggerTerms: ["landing page", "portfolio", "business site", "ecommerce", "app ui", "blog"] }),
    row("context_intake", { rowLabel: "Brand / Audience Context", triggerTerms: ["brand", "audience", "offer", "copy", "images", "existing site"] }),
    row("specialization", { rowLabel: "Site Architecture", triggerTerms: ["sitemap", "navigation", "page sections", "user journey"] }),
    row("planning_composition", { rowLabel: "Design System / Content Blocks", triggerTerms: ["colors", "typography", "layout", "components", "hero", "features", "about", "services", "cta"] }),
    row("capability_binding", { rowLabel: "Website Tool Binding", triggerTerms: ["html", "css", "react", "tailwind", "figma", "deploy"] }),
    row("validation", { rowLabel: "Website Validation", triggerTerms: ["accessibility", "mobile", "seo", "performance", "layout check"] }),
    row("execution", { rowLabel: "Website Build Execution" }),
    row("output", { rowLabel: "Website Output", triggerTerms: ["page code", "design brief", "wireframe", "component list", "deployment plan"] }),
    row("audit_iteration", { rowLabel: "Website Revision Loop" }),
  ],
};

export const BUSINESS_PLANNING_OVERLAY: UMGOverlayDefinition = {
  overlayId: "business_planning.operations",
  title: "Business Planning / Operations",
  domain: "business_operations",
  description: "Routes planning, operations, automation, process mapping, KPIs, SOPs, business model, and execution planning.",
  triggerTerms: ["business", "operations", "workflow", "process", "automation", "sop", "kpi", "strategy", "planning", "roadmap", "budget", "team", "operations plan", "business plan"],
  boostedTags: ["business", "operations", "workflow", "automation", "strategy", "planning"],
  rows: ["controller", "intent", "context_intake", "specialization", "planning_composition", "capability_binding", "validation", "execution", "output", "audit_iteration"].map((id) => row(id, { rowLabel: ({ controller: "Business Operations Controller", intent: "Business Intent", context_intake: "Business Context Intake", specialization: "Business Function", planning_composition: "Process / Strategy Design", capability_binding: "Operations Tool Binding", validation: "Business Risk / Feasibility Check", execution: "Operations Execution", output: "Business Output", audit_iteration: "Business Review / Iteration" } as Record<string, string>)[id] })),
};

export const RESEARCH_REPORT_OVERLAY: UMGOverlayDefinition = {
  overlayId: "research_report.analysis",
  title: "Research / Report / Analysis",
  domain: "research_analysis",
  description: "Routes research, evidence gathering, synthesis, citations, analysis, summaries, and report outputs.",
  triggerTerms: ["research", "analyze", "analysis", "report", "summary", "synthesis", "evidence", "cite", "citation", "sources", "whitepaper", "market research", "competitive analysis"],
  boostedTags: ["research", "analysis", "report", "summary", "evidence", "synthesis"],
  rows: ["controller", "intent", "context_intake", "specialization", "planning_composition", "capability_binding", "validation", "execution", "output", "audit_iteration"].map((id) => row(id, { rowLabel: ({ controller: "Research Controller", intent: "Research Intent", context_intake: "Source Intake", specialization: "Research Frame", planning_composition: "Synthesis Plan", capability_binding: "Research Tool Binding", validation: "Evidence / Citation Validation", execution: "Research Execution", output: "Report Output", audit_iteration: "Research Audit" } as Record<string, string>)[id] })),
};

export const CUSTOMER_SUPPORT_OVERLAY: UMGOverlayDefinition = {
  overlayId: "customer_support.chatbot",
  title: "Customer Support / Chatbot",
  domain: "customer_support",
  description: "Routes support tickets, replies, issue classification, triage, escalation, knowledge-base use, and customer response drafting.",
  triggerTerms: ["support", "customer support", "ticket", "chatbot", "reply", "draft reply", "issue", "triage", "escalate", "refund", "complaint", "knowledge base"],
  boostedTags: ["support", "customer", "ticket", "reply", "triage", "chatbot"],
  rows: ["controller", "intent", "context_intake", "specialization", "planning_composition", "capability_binding", "validation", "execution", "output", "audit_iteration"].map((id) => row(id, { rowLabel: ({ controller: "Support Controller", intent: "Support Intent", context_intake: "Customer Issue Intake", specialization: "Issue Type / Channel", planning_composition: "Resolution Plan", capability_binding: "Support Tool Binding", validation: "Escalation / Policy Check", execution: "Support Action", output: "Customer Response", audit_iteration: "Support Follow-Up" } as Record<string, string>)[id] })),
};

export const COMPLIANCE_AUDIT_OVERLAY: UMGOverlayDefinition = {
  overlayId: "compliance_audit.operator",
  title: "Compliance / Audit Operator",
  domain: "compliance_audit",
  description: "Routes policy checks, compliance analysis, audits, evidence review, risk flags, exceptions, and audit reports.",
  triggerTerms: ["compliance", "audit", "policy", "regulation", "risk", "control", "exception", "evidence", "bank", "financial audit", "legal", "review"],
  boostedTags: ["compliance", "audit", "risk", "policy", "legal", "evidence"],
  rows: ["controller", "intent", "context_intake", "specialization", "planning_composition", "capability_binding", "validation", "execution", "output", "audit_iteration"].map((id) => row(id, { rowLabel: ({ controller: "Compliance Controller", intent: "Audit Intent", context_intake: "Evidence Intake", specialization: "Policy / Control Area", planning_composition: "Audit Plan", capability_binding: "Audit Tool Binding", validation: "Risk / Control Validation", execution: "Audit Action", output: "Audit Output", audit_iteration: "Audit Trail" } as Record<string, string>)[id] })),
};

export const UMG_OVERLAY_REGISTRY: UMGOverlayDefinition[] = [
  SOFTWARE_ENGINEER_OVERLAY,
  VRCHAT_BLENDER_OVERLAY,
  SALES_OVERLAY,
  WEBSITE_BUILDER_OVERLAY,
  BUSINESS_PLANNING_OVERLAY,
  RESEARCH_REPORT_OVERLAY,
  CUSTOMER_SUPPORT_OVERLAY,
  COMPLIANCE_AUDIT_OVERLAY,
];

export function getOverlayById(id: string): UMGOverlayDefinition | undefined {
  return UMG_OVERLAY_REGISTRY.find((overlay) => overlay.overlayId === id);
}
