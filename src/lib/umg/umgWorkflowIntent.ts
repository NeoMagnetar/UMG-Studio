export type UmgWorkflowIntent = {
  workflowType: 'desktop_note_generation' | 'unknown';
  outputStyle: 'haiku' | 'plain_text' | 'unknown';
  domains: string[];
  requiresTools: string[];
  producesArtifacts: string[];
  requiresGates: string[];
  sourcePrompt: string;
};

export function parseWorkflowIntent(prompt: string): UmgWorkflowIntent {
  const text = prompt.toLowerCase();
  const isDesktopNote = /desktop/.test(text) && /note|notes|text|file/.test(text) && /create|creates|write|writes|save|saves/.test(text);
  const outputStyle = /haiku|5-7-5|poem|poetry|verse/.test(text) ? 'haiku' : /text|note|write/.test(text) ? 'plain_text' : 'unknown';
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
