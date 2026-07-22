export type UmgWorkflowIntent = {
  workflowType: 'desktop_note_generation' | 'assistant_model_emulation' | 'unknown';
  outputStyle: 'haiku' | 'plain_text' | 'assistant_workflow' | 'unknown';
  domains: string[];
  requiresTools: string[];
  producesArtifacts: string[];
  requiresGates: string[];
  sourcePrompt: string;
};

export function parseWorkflowIntent(prompt: string): UmgWorkflowIntent {
  const text = prompt.toLowerCase();
  const isDesktopNote = /desktop/.test(text) && /note|notes|text|file/.test(text) && /create|creates|write|writes|save|saves/.test(text);
  const isAssistantModelEmulation = /\b(gpt|gpt4|gpt4\.0|gpt-4|gpt-4o|chatgpt|llm)\b|language model|reasoning assistant|general assistant|assistant workflow|model emulator|model emulation|coding help|instruction following|natural-language chat/.test(text);
  const outputStyle = isAssistantModelEmulation ? 'assistant_workflow' : /haiku|5-7-5|poem|poetry|verse/.test(text) ? 'haiku' : /text|note|write/.test(text) ? 'plain_text' : 'unknown';
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
