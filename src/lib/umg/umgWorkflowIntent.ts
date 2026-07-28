export type UmgWorkflowIntent = {
  workflowType: 'desktop_note_generation' | 'assistant_model_emulation' | 'business_sales_agent' | 'architecture_design_agent' | 'unknown';
  subtype?: 'automotive_dealership_sales_agent' | 'modern_architect_sleeve' | string;
  outputStyle: 'haiku' | 'plain_text' | 'assistant_workflow' | 'business_agent_workflow' | 'architecture_design_workflow' | 'unknown';
  domains: string[];
  requiresTools: string[];
  producesArtifacts: string[];
  requiresGates: string[];
  sourcePrompt: string;
};

export function parseWorkflowIntent(prompt: string): UmgWorkflowIntent {
  const text = prompt.toLowerCase();
  const isDesktopNote = /desktop/.test(text) && /note|notes|text|file/.test(text) && /create|creates|write|writes|save|saves/.test(text);
  const isArchitectureDesignAgent = /\b(architect sleeve|modern architect|architecture assistant|architectural design assistant|building design|residential design|concept design|site planning|construction documentation planning)\b/.test(text) || (/\barchitect|architecture|architectural\b/.test(text) && /\bsleeve|assistant|design|building|site|construction|documentation\b/.test(text));
  const isAssistantModelEmulation = /\b(gpt|gpt4|gpt4\.0|gpt-4|gpt-4o|chatgpt|llm)\b|language model|reasoning assistant|general assistant|assistant workflow|model emulator|model emulation|coding help|instruction following|natural-language chat/.test(text);
  const isAutomotiveDealershipSalesAgent = /car dealership|auto dealership|automotive sales|car sales|dealership/.test(text) && /sales bot|sales assistant|sales agent|lead qualification|customer intake|appointment booking|financing inquiry|trade-?in|inventory matching|crm handoff|bot|assistant/.test(text);
  const outputStyle = isArchitectureDesignAgent ? 'architecture_design_workflow' : isAssistantModelEmulation ? 'assistant_workflow' : isAutomotiveDealershipSalesAgent ? 'business_agent_workflow' : /haiku|5-7-5|poem|poetry|verse/.test(text) ? 'haiku' : /text|note|write/.test(text) ? 'plain_text' : 'unknown';
  if (isArchitectureDesignAgent) {
    return {
      workflowType: 'architecture_design_agent',
      subtype: 'modern_architect_sleeve',
      outputStyle: 'architecture_design_workflow',
      domains: ['architecture', 'building design', 'site planning', 'concept design', 'construction documentation'],
      requiresTools: [],
      producesArtifacts: ['client_brief', 'site_context_summary', 'program_matrix', 'concept_design_options', 'documentation_plan'],
      requiresGates: ['client_review', 'code_review', 'coordination_review'],
      sourcePrompt: prompt
    };
  }
  if (isAutomotiveDealershipSalesAgent) {
    return {
      workflowType: 'business_sales_agent',
      subtype: 'automotive_dealership_sales_agent',
      outputStyle: 'business_agent_workflow',
      domains: ['automotive retail', 'car dealership', 'sales', 'lead intake', 'crm', 'appointment scheduling'],
      requiresTools: [],
      producesArtifacts: ['lead_summary', 'vehicle_match_plan', 'appointment_request', 'crm_handoff_summary', 'follow_up_message_draft'],
      requiresGates: ['human_escalation', 'compliance_approval', 'tool_availability'],
      sourcePrompt: prompt
    };
  }
  if (isAssistantModelEmulation) {
    return {
      workflowType: 'assistant_model_emulation',
      outputStyle: 'assistant_workflow',
      domains: ['assistant', 'reasoning', 'coding_help', 'tool_use_planning', 'safety'],
      requiresTools: [],
      producesArtifacts: ['markdown_answer', 'json_answer', 'reasoning_summary', 'tool_plan'],
      requiresGates: ['tool_approval', 'safety_boundary'],
      sourcePrompt: prompt
    };
  }
  if (isDesktopNote && outputStyle === 'haiku') {
    return {
      workflowType: 'desktop_note_generation',
      outputStyle: 'haiku',
      domains: ['writing', 'document', 'local_tool_use'],
      requiresTools: ['note_create', 'file_write'],
      producesArtifacts: ['text_note', 'desktop_file'],
      requiresGates: ['file_write_action', 'output_validation'],
      sourcePrompt: prompt
    };
  }
  return {
    workflowType: isDesktopNote ? 'desktop_note_generation' : 'unknown',
    outputStyle,
    domains: isDesktopNote ? ['document', 'local_tool_use'] : [],
    requiresTools: isDesktopNote ? ['note_create', 'file_write'] : [],
    producesArtifacts: isDesktopNote ? ['text_note', 'desktop_file'] : [],
    requiresGates: isDesktopNote ? ['file_write_action', 'output_validation'] : [],
    sourcePrompt: prompt
  };
}
