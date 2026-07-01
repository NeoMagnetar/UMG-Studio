import type { UMGCompilerResult } from './compilerIntegrationTypes';
import type { UMGCompiledRuntimeManifest } from './cognitiveRuntimeTypes';

export type CompilerUiStatus = 'connected_not_compiled' | 'connected_compiled' | 'disconnected' | 'unknown';

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
  if (status === 'connected_not_compiled') return 'Compiler connected. Compile Sleeve.';
  if (status === 'disconnected') return 'Compiler bridge not connected. Start it with: npm run umg:compiler-bridge';
  return 'Compiler status unknown. Check bridge health.';
}

export function getCompileButtonLabel(args: { status: CompilerUiStatus; hasSourceBoundSleeve: boolean; isHermesRunning: boolean }) {
  if (args.isHermesRunning) return 'Generating…';
  if (!args.hasSourceBoundSleeve) return 'Generate a source-bound Sleeve first';
  if (args.status === 'connected_compiled') return 'Recompile Sleeve';
  if (args.status === 'connected_not_compiled') return 'Compile Sleeve';
  if (args.status === 'disconnected') return 'Start compiler bridge, then Compile Sleeve';
  return 'Check compiler bridge, then Compile Sleeve';
}
