export type IntakeDocument = {
  id: string;
  filename?: string;
  mediaType?: string;
  text: string;
  source: 'paste' | 'file' | 'manual';
  sizeBytes?: number;
  createdAt?: string;
};

export type ToolDeclaration = {
  id: string;
  name: string;
  provider?: string;
  capability: string;
  userDeclared: boolean;
  notes?: string;
};

export type RequestedAgentType =
  | 'business_automation'
  | 'website_builder'
  | 'chatbot'
  | 'research_agent'
  | 'devops_project_launcher'
  | 'custom_workflow';

export type BusinessInput = {
  text: string;
  documents: IntakeDocument[];
  links: string[];
  businessName?: string;
  industry?: string;
  goals: string[];
  constraints: string[];
  toolsAvailable: ToolDeclaration[];
  requestedAgentType?: RequestedAgentType;
  riskLevel?: 'low' | 'medium' | 'high';
  approvalRequirements: string[];
  rawQuickChip?: string;
  createdAt: string;
};

export type WorkflowSummary = {
  id: string;
  title: string;
  description: string;
  painPoints: string[];
  automationCandidates: string[];
  likelyTools: string[];
  priority: 'low' | 'medium' | 'high';
};

export type BusinessMap = {
  businessSummary: string;
  coreOperations: string[];
  customerTypes: string[];
  productsOrServices: string[];
  recurringWorkflows: WorkflowSummary[];
  dataSources: string[];
  externalTools: string[];
  communicationChannels: string[];
  approvalPoints: string[];
  automationCandidates: string[];
  complianceOrSafetyConstraints: string[];
  outputsNeeded: string[];
  inferredIndustry?: string;
  confidence: number;
  notes: string[];
};

export type TemplateKind = 'business' | 'website' | 'chatbot' | 'research' | 'developer' | 'custom';

export type TemplateNeoStackSummary = {
  id: string;
  title: string;
  description: string;
  neoBlockCount?: number;
  moltBlockCount?: number;
  tags: string[];
};

export type TemplateSleeveSummary = {
  id: string;
  title: string;
  description: string;
  templateKind: TemplateKind;
  isTemplate: true;
  available: boolean;
  status: 'available' | 'planned' | 'partial';
  source: 'built_in_seed' | 'library' | 'session' | 'planned';
  tags: string[];
  neoStackSummaries: TemplateNeoStackSummary[];
  capabilities: string[];
  suggestedUseCases: string[];
  defaultExecutionMode?: 'dryRun' | 'approvalRequired' | 'liveAllowed';
  notes?: string[];
};

export type TemplateSelectionResult = {
  selectedTemplateId: string;
  selectedTemplateTitle: string;
  confidence: number;
  reason: string;
  matchedSignals: string[];
  alternateTemplateIds: string[];
  unavailableButRelevantTemplateIds: string[];
  nextRecommendedPhase: 'block_matching' | 'missing_block_generation' | 'sleeve_assembly';
  warnings: string[];
};

export type AnalysisPipelineState = {
  intakeReady: boolean;
  businessMapReady: boolean;
  templateSelected: boolean;
  blockMatchingReady: boolean;
  missingGenerationReady: boolean;
  sleeveAssemblyReady: boolean;
  compileReady: boolean;
  hermesReady: boolean;
  traceReady: boolean;
};
