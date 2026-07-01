import React from 'react';

type AppErrorBoundaryState = {
  error?: Error;
  componentStack?: string;
  showDetails: boolean;
};

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { showDetails: false };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error, showDetails: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, componentStack: info.componentStack ?? undefined });
  }

  private clearImportSession = () => {
    try {
      window.sessionStorage.removeItem('umg-current-import-session');
      window.localStorage.removeItem('umg-current-import-session');
    } catch {
      // Recovery must not throw.
    }
    this.setState({ error: undefined, componentStack: undefined, showDetails: false });
  };

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message || 'Unknown UI crash';
    return <main className="appErrorBoundary" role="alert" aria-live="assertive">
      <section className="appErrorCard">
        <p className="eyebrow">UMG Studio recovered from a UI crash.</p>
        <h1>UMG Studio recovered from a UI crash.</h1>
        <p>No uploaded file, import report, or Intake Generate action is allowed to blank the whole app. The current screen was isolated so you can recover safely.</p>
        <div className="analysisWarnings"><b>Error message</b><span>{message}</span></div>
        <div className="templateActionRow">
          <button type="button" className="publicPrimaryCta" onClick={() => this.setState({ error: undefined, componentStack: undefined, showDetails: false })}>Back to Sleeve Builder</button>
          <button type="button" className="publicSecondaryCta" onClick={this.clearImportSession}>Clear current import session</button>
          <button type="button" className="publicSecondaryCta" onClick={() => window.location.reload()}>Reload app</button>
        </div>
        <details onToggle={(event) => this.setState({ showDetails: (event.currentTarget as HTMLDetailsElement).open })}>
          <summary>Show error details</summary>
          {this.state.showDetails && <pre>{JSON.stringify({ message, stack: this.state.error.stack, componentStack: this.state.componentStack }, null, 2)}</pre>}
        </details>
      </section>
    </main>;
  }
}
