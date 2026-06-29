import type { ReactNode } from 'react';
import './HackathonLandingPage.css';

const pipelineStages = [
  'Intake',
  'Analyze',
  'Match',
  'Draft',
  'Assemble',
  'Compile',
  'Hermes',
  'Trace'
];

type HackathonLandingPageProps = {
  goal: string;
  context: string;
  selectedChip?: string;
  selectedFileName: string;
  intakeSubmitted: boolean;
  businessMapReady: boolean;
  templateSelected: boolean;
  sleeveInstantiated: boolean;
  blockMatched: boolean;
  missingGenerated: boolean;
  assemblyReady: boolean;
  compilerComplete?: boolean;
  hermesEndpointConfigured: boolean;
  quickChips: string[];
  onGoalChange: (value: string) => void;
  onContextChange: (value: string) => void;
  onChipSelect: (value: string) => void;
  onFileSelect: (value: string) => void;
  onSubmit: () => void;
  onOpenStudio: () => void;
  onOpenRuntime: () => void;
  onOpenDebug: () => void;
  children?: ReactNode;
};

export function HackathonLandingPage({
  goal,
  context,
  selectedChip,
  selectedFileName,
  intakeSubmitted,
  businessMapReady,
  templateSelected,
  sleeveInstantiated,
  blockMatched,
  missingGenerated,
  assemblyReady,
  compilerComplete = false,
  hermesEndpointConfigured,
  quickChips,
  onGoalChange,
  onContextChange,
  onChipSelect,
  onFileSelect,
  onSubmit,
  onOpenStudio,
  onOpenRuntime,
  onOpenDebug,
  children
}: HackathonLandingPageProps) {
  return <div className={`hackathonLanding${children ? ' hasResults' : ''}`}>
    <header className="hackathonHeader">
      <div className="hackathonBrand"><span>UMG</span><b>UNIVERSAL MODULAR GENERATION</b></div>
      <nav className="hackathonNav" aria-label="Studio access">
        <button type="button" onClick={onOpenStudio}>Open Studio</button>
        <button type="button" onClick={onOpenRuntime}>Enter Builder</button>
        <button type="button" onClick={onOpenDebug}>Debug Studio</button>
      </nav>
    </header>

    <main className="hackathonMain">
      <section className="hackathonHero" aria-label="UMG hackathon landing">
        <p className="hackathonEyebrow">Agentic Modular Cognition</p>
        <h1>UNIVERSAL MODULAR GENERATION</h1>
        <h2>Agentic Modular Cognition</h2>
        <p>Upload a workflow, business process, chatbot plan, or operating document. UMG maps it into a modular cognitive Sleeve for Hermes-ready execution and traceability.</p>
      </section>

      <section className="hackathonIntake" aria-label="Cognition intake">
        <div className="hackathonSectionHeading"><b>Intake</b><span>Local analysis shell. No compiler connection, Hermes call, runtime replay, or source library mutation.</span></div>
        <label className="hackathonField">
          <span>Main prompt</span>
          <textarea id="hackathon-intake-goal" value={goal} onChange={(event) => onGoalChange(event.target.value)} placeholder="Describe your workflow, business, chatbot, agent, or cognitive system..." />
        </label>
        <label className="hackathonField">
          <span>Document / context</span>
          <textarea value={context} onChange={(event) => onContextChange(event.target.value)} placeholder="Paste an operating doc, workflow notes, SOP, business process, or project plan." />
        </label>
        <div className="hackathonChips" aria-label="Quick workflow types">
          {quickChips.map((chip) => <button type="button" key={chip} className={selectedChip === chip ? 'selected' : ''} onClick={() => onChipSelect(chip)}>{chip}</button>)}
        </div>
        <label className="hackathonFile">
          <span>Optional local file</span>
          <input type="file" onChange={(event) => onFileSelect(event.target.files?.[0]?.name ?? '')} />
          <small>{selectedFileName ? `Selected: ${selectedFileName}` : 'File is selected locally only. No external upload or parsing yet.'}</small>
        </label>
        <button type="button" className="hackathonPrimary" onClick={onSubmit}>Start Cognition Upload</button>
        {intakeSubmitted && <div className="hackathonNotice" role="status">Intake analyzed. Template Sleeve selected; Business Automation Core can be instantiated locally without Hermes execution.</div>}
      </section>

      <PipelineStrip intakeSubmitted={intakeSubmitted} businessMapReady={businessMapReady} templateSelected={templateSelected} sleeveInstantiated={sleeveInstantiated} blockMatched={blockMatched} missingGenerated={missingGenerated} assemblyReady={assemblyReady} compilerComplete={compilerComplete} />
      <StatusRow hermesEndpointConfigured={hermesEndpointConfigured} compilerComplete={compilerComplete} />
      {children && <section className="hackathonResults" aria-label="Analysis and assembly results">{children}</section>}
    </main>
  </div>;
}

function PipelineStrip({ intakeSubmitted, businessMapReady, templateSelected, sleeveInstantiated, blockMatched, missingGenerated, assemblyReady, compilerComplete }: { intakeSubmitted: boolean; businessMapReady: boolean; templateSelected: boolean; sleeveInstantiated: boolean; blockMatched: boolean; missingGenerated: boolean; assemblyReady: boolean; compilerComplete: boolean }) {
  const isActive = (stage: string, index: number) => {
    if (index === 0) return intakeSubmitted;
    if (stage === 'Analyze') return businessMapReady;
    if (stage === 'Match') return blockMatched;
    if (stage === 'Draft') return missingGenerated;
    if (stage === 'Assemble') return assemblyReady || sleeveInstantiated;
    if (stage === 'Compile') return compilerComplete;
    return false;
  };

  return <section className="hackathonPipeline" aria-label="Pipeline status">
    {pipelineStages.map((stage, index) => <div key={stage} className={isActive(stage, index) ? 'active' : templateSelected && stage === 'Match Blocks' ? 'pending' : ''}>
      <span>{String(index + 1).padStart(2, '0')}</span>
      <b>{stage}</b>
    </div>)}
  </section>;
}

function StatusRow({ hermesEndpointConfigured, compilerComplete }: { hermesEndpointConfigured: boolean; compilerComplete: boolean }) {
  return <section className="hackathonStatus" aria-label="Runtime and compiler status">
    <div><span>Runtime</span><b>Ready</b></div>
    <div><span>Compiler</span><b>{compilerComplete ? 'Compiled' : 'Bridge Needed'}</b></div>
    <div><span>Hermes</span><b>{hermesEndpointConfigured ? 'Configured' : 'Not Connected'}</b></div>
    <div><span>Trace</span><b>Pending</b></div>
  </section>;
}
