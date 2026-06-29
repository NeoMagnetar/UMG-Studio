import { BusinessInput, BusinessMap, IntakeDocument, RequestedAgentType, ToolDeclaration, WorkflowSummary } from './businessIntakeTypes';

const businessKeywords = ['business', 'customer', 'client', 'invoice', 'payment', 'appointment', 'scheduling', 'calendar', 'social media', 'inventory', 'order', 'follow-up', 'lead', 'report', 'expense', 'bookkeeping', 'etsy', 'shopify', 'hvac', 'plumbing', 'cleaning', 'restaurant', 'food truck', 'coach', 'consultant', 'creator', 'content'];
const projectKeywords = ['project', 'github', 'git', 'repo', 'commit', 'push', 'code', 'typescript', 'python', 'readme', 'docs', 'package.json', 'dependencies', 'environment', 'deploy', 'organize files', 'build', 'test', 'ship'];
const websiteKeywords = ['website', 'landing page', 'pages', 'seo', 'portfolio', 'web design', 'homepage', 'contact form', 'ecommerce site'];
const chatbotKeywords = ['chatbot', 'faq', 'support bot', 'assistant', 'customer support', 'knowledge base', 'live chat'];
const researchKeywords = ['research', 'summarize', 'sources', 'report', 'literature', 'analyze documents', 'findings'];
const channelKeywords = ['email', 'sms', 'phone', 'slack', 'discord', 'website', 'instagram', 'facebook', 'x/twitter', 'twitter', 'linkedin', 'tiktok', 'shopify', 'etsy'];
const dataSourceKeywords = ['spreadsheet', 'csv', 'database', 'docs', 'documents', 'pdf', 'crm', 'calendar', 'inventory', 'orders', 'invoices', 'github', 'repo'];
const approvalKeywords = ['approve', 'approval', 'review', 'sign off', 'permission', 'confirm', 'manual', 'before sending', 'before posting', 'before payment'];
const safetyKeywords = ['privacy', 'pii', 'hipaa', 'gdpr', 'compliance', 'secret', 'password', 'token', 'risk', 'legal', 'destructive', 'delete'];
const outputKeywords = ['summary', 'report', 'dashboard', 'email', 'proposal', 'invoice', 'documentation', 'readme', 'plan', 'schedule', 'calendar', 'ticket'];
const toolKeywords = ['github', 'git', 'shopify', 'etsy', 'stripe', 'quickbooks', 'calendar', 'google docs', 'gmail', 'slack', 'discord', 'notion', 'airtable', 'excel', 'sheets', 'openclaw'];

export type PublicIntakeArgs = {
  goal: string;
  context: string;
  selectedChip?: string;
  selectedFileName?: string;
};

const uniq = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
const includes = (text: string, keyword: string) => text.toLowerCase().includes(keyword.toLowerCase());
const matches = (text: string, keywords: string[]) => keywords.filter((keyword) => includes(text, keyword));
const sentenceFragments = (text: string) => text.split(/[.\n;]+/).map((part) => part.trim()).filter((part) => part.length > 8);

function chipToAgentType(chip?: string): RequestedAgentType | undefined {
  switch (chip) {
    case 'Business Automation': return 'business_automation';
    case 'Website Builder': return 'website_builder';
    case 'Chatbot': return 'chatbot';
    case 'Research Agent': return 'research_agent';
    case 'DevOps / Project Launcher': return 'devops_project_launcher';
    case 'Custom Workflow': return 'custom_workflow';
    default: return undefined;
  }
}

function inferIndustry(text: string, chip?: string): string | undefined {
  const lower = text.toLowerCase();
  if (chip === 'DevOps / Project Launcher' || matches(text, projectKeywords).length >= 2) return 'software / developer operations';
  if (chip === 'Website Builder') return 'web presence / digital marketing';
  if (chip === 'Chatbot') return 'customer support / conversational automation';
  if (chip === 'Research Agent') return 'research / knowledge work';
  if (/etsy|shopify|ecommerce|store|orders/.test(lower)) return 'ecommerce';
  if (/hvac|plumbing|cleaning|service business|appointments?/.test(lower)) return 'local service business';
  if (/restaurant|food truck|menu|reservation/.test(lower)) return 'food service';
  if (/coach|consultant|professional services/.test(lower)) return 'professional services';
  if (/creator|content|influencer|social media/.test(lower)) return 'creator / content business';
  return undefined;
}

function inferBusinessName(text: string): string | undefined {
  const patterns = [/business(?: is|:)?\s+([A-Z][A-Za-z0-9 &'\-]{2,40})/, /company(?: is|:)?\s+([A-Z][A-Za-z0-9 &'\-]{2,40})/, /for\s+([A-Z][A-Za-z0-9 &'\-]{2,40})/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[.,;:]$/, '');
  }
  return undefined;
}

function extractLinks(text: string): string[] {
  return uniq(text.match(/https?:\/\/\S+/g) ?? []);
}

function extractGoals(text: string, chip?: string): string[] {
  const fragments = sentenceFragments(text).filter((part) => /need|want|goal|build|create|automate|generate|ship|set up|help|convert/i.test(part));
  const chipGoal = chip ? `${chip} workflow` : '';
  return uniq([chipGoal, ...fragments.slice(0, 5)]).slice(0, 6);
}

function extractConstraints(text: string): string[] {
  return uniq(sentenceFragments(text).filter((part) => /must|cannot|can't|avoid|without|constraint|budget|deadline|privacy|compliance|approval|manual/i.test(part))).slice(0, 6);
}

function extractTools(text: string): ToolDeclaration[] {
  return matches(text, toolKeywords).map((name, index) => ({
    id: `tool_decl_${index + 1}`,
    name,
    capability: `${name} capability mentioned by user`,
    userDeclared: true
  }));
}

function workflowFromSignals(id: string, title: string, description: string, signalText: string, priority: WorkflowSummary['priority'] = 'medium'): WorkflowSummary {
  const painPoints = sentenceFragments(signalText).filter((part) => /pain|manual|slow|miss|problem|hard|too much|repetitive|bottleneck|follow-up/i.test(part)).slice(0, 4);
  const tools = matches(signalText, [...toolKeywords, ...channelKeywords]).slice(0, 6);
  return {
    id,
    title,
    description,
    painPoints: painPoints.length ? painPoints : matches(signalText, ['manual', 'follow-up', 'inventory', 'invoice', 'scheduling']).map((keyword) => `${keyword} friction mentioned`),
    automationCandidates: matches(signalText, [...businessKeywords, ...projectKeywords, ...websiteKeywords, ...chatbotKeywords, ...researchKeywords]).slice(0, 8),
    likelyTools: tools,
    priority
  };
}

export function createBusinessInputFromPublicIntake(args: PublicIntakeArgs): BusinessInput {
  const now = new Date().toISOString();
  const documents: IntakeDocument[] = [];
  if (args.context.trim()) {
    documents.push({
      id: 'doc.paste.1',
      filename: args.selectedFileName || undefined,
      text: args.context.trim(),
      source: args.selectedFileName ? 'file' : 'paste',
      sizeBytes: new Blob([args.context]).size,
      createdAt: now
    });
  } else if (args.selectedFileName) {
    documents.push({ id: 'doc.file_shell.1', filename: args.selectedFileName, text: '', source: 'file', createdAt: now });
  }
  const combined = [args.goal, args.context, args.selectedChip].filter(Boolean).join('\n');
  return {
    text: args.goal.trim(),
    documents,
    links: extractLinks(combined),
    businessName: inferBusinessName(combined),
    industry: inferIndustry(combined, args.selectedChip),
    goals: extractGoals(combined, args.selectedChip),
    constraints: extractConstraints(combined),
    toolsAvailable: extractTools(combined),
    requestedAgentType: chipToAgentType(args.selectedChip),
    riskLevel: matches(combined, safetyKeywords).length ? 'medium' : 'low',
    approvalRequirements: uniq(matches(combined, approvalKeywords)),
    rawQuickChip: args.selectedChip,
    createdAt: now
  };
}

export function analyzeBusinessInput(input: BusinessInput): BusinessMap {
  const combined = [input.text, ...input.documents.map((doc) => doc.text), input.rawQuickChip].filter(Boolean).join('\n');
  const textLength = combined.trim().length;
  const businessSignals = matches(combined, businessKeywords);
  const projectSignals = matches(combined, projectKeywords);
  const websiteSignals = matches(combined, websiteKeywords);
  const chatbotSignals = matches(combined, chatbotKeywords);
  const researchSignals = matches(combined, researchKeywords);
  const allSignals = uniq([...businessSignals, ...projectSignals, ...websiteSignals, ...chatbotSignals, ...researchSignals]);
  const coreOperations = uniq([
    ...businessSignals.filter((signal) => ['invoice', 'payment', 'appointment', 'scheduling', 'calendar', 'social media', 'inventory', 'order', 'follow-up', 'lead', 'report', 'expense', 'bookkeeping'].includes(signal)),
    ...projectSignals.filter((signal) => ['github', 'git', 'repo', 'commit', 'code', 'typescript', 'python', 'docs', 'dependencies', 'environment', 'deploy', 'build', 'test', 'ship'].includes(signal)),
    ...websiteSignals,
    ...chatbotSignals,
    ...researchSignals
  ]).slice(0, 12);
  const workflows: WorkflowSummary[] = [];
  if (businessSignals.length) workflows.push(workflowFromSignals('workflow.business_operations', 'Business operations automation', 'Detected business operations or customer workflow signals from the intake.', combined, businessSignals.length > 4 ? 'high' : 'medium'));
  if (projectSignals.length) workflows.push(workflowFromSignals('workflow.project_launcher', 'Project shipping workflow', 'Detected developer/project launcher signals from the intake.', combined, projectSignals.length > 4 ? 'high' : 'medium'));
  if (websiteSignals.length) workflows.push(workflowFromSignals('workflow.website', 'Website planning workflow', 'Detected website or landing-page planning signals from the intake.', combined));
  if (chatbotSignals.length) workflows.push(workflowFromSignals('workflow.chatbot', 'Chatbot/support workflow', 'Detected chatbot, FAQ, assistant, or support workflow signals from the intake.', combined));
  if (researchSignals.length) workflows.push(workflowFromSignals('workflow.research', 'Research synthesis workflow', 'Detected research, source, report, or document-analysis signals from the intake.', combined));
  if (!workflows.length && textLength > 30) workflows.push(workflowFromSignals('workflow.custom', 'Custom workflow intake', 'User provided enough text to begin custom workflow mapping, but no strong template family dominated.', combined, 'low'));

  const confidence = textLength < 20
    ? 0.2
    : input.rawQuickChip && textLength < 60
      ? 0.4
      : allSignals.length >= 8 && workflows.length >= 2
        ? 0.8
        : allSignals.length >= 4
          ? 0.68
          : 0.6;
  const industry = input.industry ?? inferIndustry(combined, input.rawQuickChip);
  const notes = [
    ...(textLength < 40 ? ['More detail is needed before reliable block matching or Sleeve assembly.'] : []),
    ...(input.documents.some((doc) => doc.filename && !doc.text) ? ['A filename was captured locally, but file parsing is not connected in this phase.'] : []),
    'Analysis is deterministic/local heuristic extraction; Hermes was not called.',
    'Template selection is metadata-only and does not generate a Sleeve.'
  ];

  return {
    businessSummary: textLength
      ? `${industry ? `${industry} workflow` : 'Workflow'} intake with ${allSignals.length || 'limited'} detected signal${allSignals.length === 1 ? '' : 's'}.`
      : 'No workflow text provided yet.',
    coreOperations,
    customerTypes: uniq(matches(combined, ['customer', 'client', 'lead', 'subscriber', 'patient', 'student'])),
    productsOrServices: uniq(matches(combined, ['service', 'product', 'consulting', 'coaching', 'restaurant', 'food truck', 'website', 'software', 'content'])),
    recurringWorkflows: workflows,
    dataSources: uniq(matches(combined, dataSourceKeywords)),
    externalTools: input.toolsAvailable.map((tool) => tool.name),
    communicationChannels: uniq(matches(combined, channelKeywords)),
    approvalPoints: input.approvalRequirements,
    automationCandidates: allSignals.slice(0, 14),
    complianceOrSafetyConstraints: uniq(matches(combined, safetyKeywords)),
    outputsNeeded: uniq(matches(combined, outputKeywords)),
    inferredIndustry: industry,
    confidence,
    notes
  };
}
