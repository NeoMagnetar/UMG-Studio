import type { UMGCompilerResult } from './compilerIntegrationTypes';
import type { UMGCompiledRuntimeManifest } from './cognitiveRuntimeTypes';

export type CompilerUiStatus = 'connected_not_compiled' | 'connected_compiled' | 'disconnected' | 'unknown';
export type CompileRunStatus = 'idle' | 'compiling' | 'compiled' | 'failed';

export type CompileReadiness = {
  canCompile: boolean;
  label: string;
  helper: string;
  disabled: boolean;
  reason: string;
};

export function deriveCompilerUiStatus(args: { compilerBridgeAvailable?: boolean; compiledRuntimeManifest?: UMGCompiledRuntimeManifest; result?: UMGCompilerResult }): CompilerUiStatus {
  if (args.compiledRuntimeManifest) return 'connected_compiled';
  if (args.compilerBridgeAvailable === true) return 'connected_not_compiled';
  if (args.result?.status === 'not_configured' || args.result?.status === 'error') return 'disconnected';
  if (args.compilerBridgeAvailable === false) return 'disconnected';
  return 'unknown';
}

export function getCompilerTopCopy(status: CompilerUiStatus) {
  if (status === 'connected_compiled') return 'Compiled';
  if (status === 'connected_not_compiled') return 'Compiler connected · not compiled';
  if (status === 'disconnected') return 'Compiler bridge not connected';
  return 'Compiler status unknown';
}

export function getCompilerCardCopy(status: CompilerUiStatus) {
  if (status === 'connected_compiled') return 'Compile succeeded';
  if (status === 'connected_not_compiled') return 'Compiler connected. Ready to compile.';
  if (status === 'disconnected') return 'Compiler bridge not connected. Start it with: npm run umg:compiler-bridge';
  return 'Compiler status unknown. Check bridge health.';
}

export function getCompileReadiness(args: {
  activeSessionSleeve?: unknown;
  compilerHealth: CompilerUiStatus | { connected?: boolean; status?: CompilerUiStatus };
  isCompilingSleeve: boolean;
  compileStatus?: CompileRunStatus;
  compileError?: string | null;
}): CompileReadiness {
  const hasSleeve = Boolean(args.activeSessionSleeve);
  const status = typeof args.compilerHealth === 'string'
    ? args.compilerHealth
    : args.compilerHealth.status ?? (args.compilerHealth.connected ? 'connected_not_compiled' : 'disconnected');
  if (!hasSleeve) {
    return { canCompile: false, label: 'Compile Sleeve', helper: 'Generate a Sleeve before compiling.', disabled: true, reason: 'no_sleeve' };
  }
  if (args.isCompilingSleeve || args.compileStatus === 'compiling') {
    return { canCompile: false, label: 'Compiling…', helper: 'Compiling Sleeve…', disabled: true, reason: 'compiling' };
  }
  if (status === 'disconnected') {
    return { canCompile: false, label: 'Compile Sleeve', helper: 'Compiler bridge not connected.', disabled: true, reason: 'compiler_disconnected' };
  }
  if (args.compileStatus === 'compiled' || status === 'connected_compiled') {
    return { canCompile: true, label: 'Recompile Sleeve', helper: 'Compile succeeded. Runtime Graph ready.', disabled: false, reason: 'compiled' };
  }
  if (args.compileStatus === 'failed' || args.compileError) {
    return { canCompile: true, label: 'Retry Compile', helper: 'Previous compile failed. Retry compile.', disabled: false, reason: 'previous_compile_failed' };
  }
  if (status === 'connected_not_compiled') {
    return { canCompile: true, label: 'Compile Sleeve', helper: 'Compiler connected. Ready to compile.', disabled: false, reason: 'ready' };
  }
  return { canCompile: false, label: 'Compile Sleeve', helper: 'Compiler status unknown. Check bridge health.', disabled: true, reason: 'compiler_unknown' };
}

export function getCompileButtonLabel(args: { status: CompilerUiStatus; hasSourceBoundSleeve: boolean; isHermesRunning: boolean; isCompiling?: boolean; compileStatus?: CompileRunStatus; compileError?: string | null }) {
  return getCompileReadiness({
    activeSessionSleeve: args.hasSourceBoundSleeve ? {} : undefined,
    compilerHealth: args.status,
    isCompilingSleeve: Boolean(args.isCompiling),
    compileStatus: args.compileStatus,
    compileError: args.compileError
  }).label;
}
