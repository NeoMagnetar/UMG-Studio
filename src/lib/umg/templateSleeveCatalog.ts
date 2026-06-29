import { TemplateSleeveSummary } from './businessIntakeTypes';

const businessNeoStacks = [
  ['S.01', 'Business Assessment & Discovery', 'Analyzes business model, current processes, pain points, opportunity scoring, budget, and success metrics.', ['assessment', 'discovery', 'roi']],
  ['S.02', 'Automation Architecture Design', 'Plans OpenClaw configuration, multi-agent architecture, tool/channel selection, skills, integrations, and rollout.', ['architecture', 'openclaw', 'integrations']],
  ['S.03', 'Social Media Automation', 'Plans content calendar, post scheduling, engagement monitoring, hashtag/SEO, analytics, and multi-platform management.', ['social-media', 'content', 'analytics']],
  ['S.04', 'Operations & Process Automation', 'Covers inventory, orders, customer communication, invoices/payments, data entry, and reporting.', ['operations', 'inventory', 'invoicing']],
  ['S.05', 'Scheduling & Calendar Automation', 'Handles appointments, calendar sync, reminders/follow-up, staff/resource scheduling, meeting coordination, and availability.', ['scheduling', 'calendar', 'appointments']],
  ['S.06', 'Financial Automation', 'Supports expenses, invoices, payment reminders, financial reports, tax documents, budgets, and alerts.', ['financial', 'bookkeeping', 'payments']],
  ['S.07', 'Implementation & Training', 'Covers OpenClaw install/setup, custom prompts, workflows, training/docs, testing/validation, handoff, and go-live.', ['implementation', 'training', 'handoff']],
  ['S.08', 'Monitoring & Optimization', 'Tracks metrics, cost analysis, feedback, system health, continuous improvement, and scaling.', ['monitoring', 'optimization', 'metrics']]
] as const;

const projectNeoStacks = [
  ['PL.NS.001', 'File Operations Stack', 'Organizes project files, workspace layout, generated assets, and safe file-operation planning.', ['file-operations', 'workspace']],
  ['PL.NS.002', 'Git & GitHub Stack', 'Plans git branch, commit, push, repository, issue, and GitHub workflow operations.', ['git', 'github']],
  ['PL.NS.003', 'Environment Setup Stack', 'Captures dependency, package, environment variable, and local setup needs.', ['environment', 'dependencies']],
  ['PL.NS.004', 'Documentation Generation Stack', 'Plans README, docs, examples, usage notes, and handoff documentation.', ['documentation', 'readme']],
  ['PL.NS.005', 'Code Organization Stack', 'Organizes TypeScript, Python, package structure, source layout, and project conventions.', ['code-organization', 'typescript', 'python']],
  ['PL.NS.006', 'Self-Modification Stack', 'Captures safe self-modification and iterative agent-code update boundaries.', ['self-modification', 'safety']],
  ['PL.NS.007', 'Project Orchestration Stack', 'Coordinates project sequencing, milestones, validation gates, and shipping flow.', ['orchestration', 'shipping']]
] as const;

const catalog: TemplateSleeveSummary[] = [
  {
    id: 'template.business_automation_consultant.v1',
    title: 'Business Automation Consultant',
    templateKind: 'business',
    isTemplate: true,
    available: true,
    status: 'partial',
    source: 'built_in_seed',
    tags: ['business', 'automation', 'small-business', 'side-hustle', 'openclaw', 'roi', 'scheduling', 'social-media', 'inventory', 'invoicing', 'financial', 'training'],
    description: 'Small business and side-hustle automation consultant Sleeve for assessing workflows, designing OpenClaw/UMG automation, calculating ROI, training clients, and monitoring improvement.',
    suggestedUseCases: ['ecommerce / Etsy / Shopify', 'local service business / HVAC / plumbing / cleaning', 'content creator / influencer', 'professional services / consultant / coach', 'food truck / restaurant'],
    capabilities: ['business assessment', 'automation opportunity scoring', 'ROI calculation', 'social media automation planning', 'operations automation planning', 'scheduling/calendar automation planning', 'financial automation planning', 'implementation/training', 'monitoring/optimization'],
    defaultExecutionMode: 'liveAllowed',
    neoStackSummaries: businessNeoStacks.map(([id, title, description, tags]) => ({ id, title, description, tags: [...tags] })),
    notes: [
      'Full source version contains 8 NeoStacks / 48 NeoBlocks / 192 MOLT blocks.',
      'TRG.BIZ.* should become gate/control records when full import is implemented.',
      'PRIM.BIZ.* governance values should become Primary MOLT/governance blocks.',
      'CON/VER-like future records should become gate-policy or MetaMOLT candidates.',
      'Default liveAllowed does not mean Studio executes tools directly; Hermes remains the user-authorized execution layer.'
    ]
  },
  {
    id: 'template.project_launcher.v1',
    title: 'Project Launcher',
    templateKind: 'developer',
    isTemplate: true,
    available: true,
    status: 'partial',
    source: 'built_in_seed',
    tags: ['devops', 'project-launcher', 'github', 'git', 'file-operations', 'documentation', 'environment', 'code-organization', 'self-modification', 'orchestration'],
    description: 'Autonomous DevOps/project shipping Sleeve for taking scattered work and shipping complete projects with file operations, Git/GitHub, environment setup, documentation, code organization, self-modification, and orchestration.',
    capabilities: ['file operations', 'git/github operations', 'environment setup', 'documentation generation', 'code organization', 'self-modification', 'project orchestration'],
    suggestedUseCases: ['ship a coding project', 'set up GitHub repo', 'organize scattered TypeScript or Python code', 'generate README/docs/examples', 'configure environment'],
    defaultExecutionMode: 'liveAllowed',
    neoStackSummaries: projectNeoStacks.map(([id, title, description, tags]) => ({ id, title, description, tags: [...tags] })),
    notes: [
      'Full source version contains 7 NeoStacks / 26 NeoBlocks / 70 MOLT blocks.',
      'TRG.* should become gates/control records.',
      'Secret-scan and destructive-operation behaviors should become gates/policies or Primary/MOLT governance.'
    ]
  },
  {
    id: 'template.website_builder.v1', title: 'Website Builder', templateKind: 'website', isTemplate: true, available: false, status: 'planned', source: 'planned',
    tags: ['website', 'landing-page', 'seo', 'portfolio', 'homepage', 'contact-form', 'ecommerce-site'],
    description: 'Planned Sleeve for converting website goals into page structure, copy, SEO, design, and launch workflows.',
    neoStackSummaries: [], capabilities: ['website planning', 'page structure', 'SEO planning'], suggestedUseCases: ['landing page', 'portfolio', 'business website']
  },
  {
    id: 'template.chatbot.v1', title: 'Chatbot', templateKind: 'chatbot', isTemplate: true, available: false, status: 'planned', source: 'planned',
    tags: ['chatbot', 'faq', 'assistant', 'customer-support', 'knowledge-base', 'live-chat'],
    description: 'Planned Sleeve for support bots, FAQ assistants, knowledge base routing, and customer intake.',
    neoStackSummaries: [], capabilities: ['chatbot planning', 'FAQ design', 'support workflow mapping'], suggestedUseCases: ['support bot', 'FAQ assistant', 'customer intake chatbot']
  },
  {
    id: 'template.research_agent.v1', title: 'Research Agent', templateKind: 'research', isTemplate: true, available: false, status: 'planned', source: 'planned',
    tags: ['research', 'summarize', 'sources', 'report', 'literature', 'findings'],
    description: 'Planned Sleeve for document research, source synthesis, findings reports, and literature workflows.',
    neoStackSummaries: [], capabilities: ['research planning', 'source synthesis', 'report generation'], suggestedUseCases: ['summarize sources', 'literature review', 'analyze documents']
  },
  {
    id: 'template.custom_workflow.v1', title: 'Custom Workflow', templateKind: 'custom', isTemplate: true, available: false, status: 'planned', source: 'planned',
    tags: ['custom', 'workflow', 'agent', 'cognitive-system'],
    description: 'Planned fallback Sleeve metadata for workflows that do not yet map cleanly to an available seed template.',
    neoStackSummaries: [], capabilities: ['custom workflow mapping'], suggestedUseCases: ['bespoke agent', 'unusual business process', 'hybrid workflow']
  }
];

export function getTemplateSleeveCatalog(): TemplateSleeveSummary[] {
  return catalog.map((template) => ({
    ...template,
    tags: [...template.tags],
    capabilities: [...template.capabilities],
    suggestedUseCases: [...template.suggestedUseCases],
    notes: template.notes ? [...template.notes] : undefined,
    neoStackSummaries: template.neoStackSummaries.map((stack) => ({ ...stack, tags: [...stack.tags] }))
  }));
}

export function getAvailableTemplateSleeves(): TemplateSleeveSummary[] {
  return getTemplateSleeveCatalog().filter((template) => template.available);
}

export function getTemplateById(id: string): TemplateSleeveSummary | undefined {
  return getTemplateSleeveCatalog().find((template) => template.id === id);
}
