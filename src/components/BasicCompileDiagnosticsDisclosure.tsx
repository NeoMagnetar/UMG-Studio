import { useState } from 'react';

type BasicCompileDiagnosticsDisclosureProps = {
  compileDiagnostics?: Record<string, unknown>;
  compilerRaw?: unknown;
};

export function hasBasicCompileDiagnostics(compileDiagnostics?: Record<string, unknown>, compilerRaw?: unknown) {
  return Boolean(
    compilerRaw
    || compileDiagnostics?.compileRequestBodyPreview
    || compileDiagnostics?.compileResponseStatus
    || compileDiagnostics?.compileResponseBody
  );
}

export function BasicCompileDiagnosticsDisclosure({ compileDiagnostics, compilerRaw }: BasicCompileDiagnosticsDisclosureProps) {
  const [open, setOpen] = useState(false);
  if (!hasBasicCompileDiagnostics(compileDiagnostics, compilerRaw)) return null;
  const payload = {
    compileEndpoint: compileDiagnostics?.compileEndpoint,
    compileRequestBytes: compileDiagnostics?.compileRequestBytes,
    compileRequestBodyPreview: compileDiagnostics?.compileRequestBodyPreview,
    compileResponseStatus: compileDiagnostics?.compileResponseStatus,
    compileResponseBody: compileDiagnostics?.compileResponseBody,
    compilerValidationErrors: compileDiagnostics?.compilerValidationErrors,
    failingFieldPath: compileDiagnostics?.failingFieldPath,
    compilerRaw
  };
  return <div className="basicCompileDiagnosticsDisclosure">
    <button type="button" className="publicSecondaryCta" onClick={() => setOpen((current) => !current)}>{open ? 'Hide compile diagnostics' : 'Show compile diagnostics'}</button>
    {open && <details className="compilerJsonPreview" open><summary>Compile diagnostics: response body / failing field</summary><pre>{JSON.stringify(payload, null, 2)}</pre></details>}
  </div>;
}
