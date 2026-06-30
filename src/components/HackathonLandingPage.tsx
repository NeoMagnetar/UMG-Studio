import type { ReactNode } from 'react';
import './HackathonLandingPage.css';

const pipelineStages = [
  'Intake',
  'Sleeve',
  'Compile',
  'Runtime'
];

type SelectedLocalFile = {
  name: string;
  size: number;
  lastModified: number;
};

type HackathonLandingPageProps = {
  goal: string;
  context: string;
  selectedChip?: string;
  selectedFiles: SelectedLocalFile[];
  intakeSubmitted: boolean;
  businessMapReady: boolean;
  templateSelected: boolean;
  sleeveInstantiated: boolean;
  blockMatched: boolean;
  missingGenerated: boolean;
  assemblyReady: boolean;
  compilerComplete?: boolean;
  hermesRunComplete?: boolean;
  traceComplete?: boolean;
  hermesEndpointConfigured: boolean;
  quickChips: string[];
  onGoalChange: (value: string) => void;
  onContextChange: (value: string) => void;
  onChipSelect: (value: string) => void;
  onFilesAdd: (files: SelectedLocalFile[]) => void;
  onFileRemove: (file: SelectedLocalFile) => void;
  onFilesClear: () => void;
  onSubmit: () => void;
  onOpenStudio: () => void;
  onOpenRuntime: () => void;
  onOpenDebug: () => void;
  children?: ReactNode;
};

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'size unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function HackathonLandingPage({
  goal,
  context,
  selectedChip,
  selectedFiles,
  intakeSubmitted,
  businessMapReady,
  templateSelected,
  sleeveInstantiated,
  blockMatched,
  missingGenerated,
  assemblyReady,
  compilerComplete = false,
  hermesRunComplete = false,
  traceComplete = false,
  hermesEndpointConfigured,
  quickChips,
  onGoalChange,
  onContextChange,
  onChipSelect,
  onFilesAdd,
  onFileRemove,
  onFilesClear,
  onSubmit,
  onOpenStudio,
  children
}: HackathonLandingPageProps) {
  const handleFileChange = (files: FileList | null, input: HTMLInputElement) => {
    const selected = Array.from(files ?? []).map((file) => ({ name: file.name, size: file.size, lastModified: file.lastModified }));
    if (selected.length) onFilesAdd(selected);
    input.value = '';
  };

  const hasResults = Boolean(children);
  const stageClass = hasResults ? sleeveInstantiated ? ' hasResults hasSleeve' : ' hasResults isProcessing' : '';
  const promptSummary = goal.trim() || 'No prompt entered yet.';
  const intakeStatus = sleeveInstantiated ? 'Sleeve preview ready' : templateSelected ? 'Sleeve plan ready' : businessMapReady ? 'Intake understood' : intakeSubmitted ? 'Creating Sleeve' : 'Awaiting intake';

  return <div className={`hackathonLanding${stageClass}`}>
    <header className="hackathonHeader">
      <div className="hackathonBrand" aria-label="UMG">
        <img src="/assets/umg-logo.svg" alt="UMG" />
        <span aria-hidden="true">UMG</span>
      </div>
      <nav className="hackathonNav" aria-label="Studio access">
        <button type="button" onClick={onOpenStudio}>Open Studio Editor (general canvas)</button>
      </nav>
    </header>

    <main className="hackathonMain">
      <section className="hackathonHero" aria-label="UMG hackathon landing">
        <h1>UNIVERSAL MODULAR GENERATION</h1>
        <h2>Agentic Modular Cognition</h2>
        <p>Upload a workflow, business process, or agent plan. UMG maps it into modular cognitive architecture for Hermes-ready execution and runtime traceability.</p>
      </section>

      <section className="hackathonIntake" aria-label="Cognition intake">
        {!hasResults ? <>
          <div className="hackathonSectionHeading"><b>Intake</b><span>Local analysis shell. No compiler connection, Hermes call, runtime replay, or source library mutation.</span></div>
          <label className="hackathonField">
            <span>Main Prompt</span>
            <small>Describe the system, workflow, agent, or task.</small>
            <textarea id="hackathon-intake-goal" value={goal} onChange={(event) => onGoalChange(event.target.value)} placeholder="Describe your workflow, business process, agent plan, or cognitive system..." />
          </label>
          <label className="hackathonField">
            <span>Paste Context</span>
            <small>Paste SOPs, workflows, requirements, policies, or notes.</small>
            <textarea value={context} onChange={(event) => onContextChange(event.target.value)} placeholder="Paste context, requirements, policies, workflows, SOPs, or notes." />
          </label>
          <div className="hackathonChips" aria-label="Quick workflow types">
            {quickChips.map((chip) => {
              const enabled = chip === 'Custom Workflow';
              return <button type="button" key={chip} className={selectedChip === chip ? 'selected' : ''} disabled={!enabled} title={enabled ? 'Enabled Basic path' : 'Coming soon / advanced template pack'} onClick={() => enabled && onChipSelect(chip)}>{chip}{enabled ? '' : ' · coming soon'}</button>;
            })}
            <small>Basic currently enables Custom Workflow only. Other template packs come later.</small>
          </div>
          <div className="hackathonFile">
            <div className="hackathonFileControl">
              <span>Attach Files</span>
              <input type="file" multiple onChange={(event) => handleFileChange(event.target.files, event.currentTarget)} />
            </div>
            <small>Select local files for later parsing/intake context. Selected locally; not parsed yet. No upload.</small>
            {selectedFiles.length > 0 && <div className="hackathonFileList" aria-label="Selected local files">
              {selectedFiles.map((file) => <span className="hackathonFileChip" key={`${file.name}:${file.size}:${file.lastModified}`}>
                <b>{file.name}</b>
                <em>{formatFileSize(file.size)} · selected locally · not parsed yet</em>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onFileRemove(file); }}>×</button>
              </span>)}
              {selectedFiles.length > 1 && <button type="button" className="hackathonClearFiles" onClick={onFilesClear}>Clear All</button>}
            </div>}
          </div>
          <button type="button" className="hackathonPrimary" onClick={onSubmit}>Build UMG Sleeve</button>
        </> : <>
          <div className="hackathonCompactSource">
            <span>Source Prompt</span>
            <b>{promptSummary}</b>
          </div>
          <div className="hackathonCompactMeta" aria-label="Compact intake status">
            <span>{selectedChip ?? 'Custom Workflow'}</span>
            <span>{selectedFiles.length} local file{selectedFiles.length === 1 ? '' : 's'}</span>
            <span>{intakeStatus}</span>
          </div>
        </>}
      </section>

      <PipelineStrip intakeSubmitted={intakeSubmitted} businessMapReady={businessMapReady} templateSelected={templateSelected} sleeveInstantiated={sleeveInstantiated} blockMatched={blockMatched} missingGenerated={missingGenerated} assemblyReady={assemblyReady} compilerComplete={compilerComplete} hermesRunComplete={hermesRunComplete} traceComplete={traceComplete} />
      <StatusRow hermesEndpointConfigured={hermesEndpointConfigured} compilerComplete={compilerComplete} hermesRunComplete={hermesRunComplete} traceComplete={traceComplete} />
      {children && <section className="hackathonResults" aria-label="Analysis and assembly results">{children}</section>}
    </main>
  </div>;
}

function PipelineStrip({ intakeSubmitted, businessMapReady, templateSelected, sleeveInstantiated, blockMatched, missingGenerated, assemblyReady, compilerComplete, hermesRunComplete, traceComplete }: { intakeSubmitted: boolean; businessMapReady: boolean; templateSelected: boolean; sleeveInstantiated: boolean; blockMatched: boolean; missingGenerated: boolean; assemblyReady: boolean; compilerComplete: boolean; hermesRunComplete: boolean; traceComplete: boolean }) {
  const isActive = (stage: string, index: number) => {
    if (index === 0) return intakeSubmitted;
    if (stage === 'Sleeve') return businessMapReady || templateSelected || sleeveInstantiated || assemblyReady;
    if (stage === 'Compile') return compilerComplete;
    if (stage === 'Runtime') return hermesRunComplete || traceComplete;
    return false;
  };

  return <section className="hackathonPipeline" aria-label="Pipeline status">
    {pipelineStages.map((stage, index) => <div key={stage} className={isActive(stage, index) ? 'active' : templateSelected && stage === 'Match' ? 'pending' : ''}>
      <span>{String(index + 1).padStart(2, '0')}</span>
      <b>{stage}</b>
    </div>)}
  </section>;
}

function StatusRow({ hermesEndpointConfigured, compilerComplete, hermesRunComplete, traceComplete }: { hermesEndpointConfigured: boolean; compilerComplete: boolean; hermesRunComplete: boolean; traceComplete: boolean }) {
  return <section className="hackathonStatus" aria-label="Runtime and compiler status">
    <div><span>Runtime</span><b>Ready</b></div>
    <div><span>Compiler</span><b>{compilerComplete ? 'Compiled' : 'Bridge Needed'}</b></div>
    <div><span>Hermes</span><b>{hermesRunComplete ? 'Response Received' : hermesEndpointConfigured ? 'Configured' : 'Not Connected'}</b></div>
    <div><span>Trace</span><b>{traceComplete ? 'Ingested' : 'Pending'}</b></div>
  </section>;
}
