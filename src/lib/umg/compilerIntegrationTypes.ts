import type { CompileCandidate, SleeveAssemblyPlan } from './blockMatchingTypes';
import type { UMGCompiledRuntimeManifest } from './cognitiveRuntimeTypes';

export type UMGCompilerInput = {
  id: string;
  compileCandidateId: string;
  assemblyPlanId: string;
  sleeveId: string;
  sleeveTitle: string;
  normalizedStructure: unknown;
  gates: unknown[];
  activeStates: Record<string, boolean>;
  disabledStates: Record<string, boolean>;
  executionOrder: string[];
  requiredTools: string[];
  approvalPoints: string[];
  runtimeInstructions: string[];
  sourceBlocks: string[];
  traceMetadata: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type UMGCompilerRequest = {
  input: UMGCompilerInput;
  mode: 'compile';
  requestedAt: string;
  source: 'umg-studio';
  schemaVersion: string;
};

export type UMGCompilerStatus = 'not_configured' | 'ready' | 'compiling' | 'compiled' | 'error';

export type UMGCompilerAdapterConfig = {
  enabled: boolean;
  endpoint?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export type UMGCompilerError = {
  code: string;
  message: string;
  details?: string;
  raw?: unknown;
};

export type UMGCompilerWarning = {
  code: string;
  message: string;
  details?: string;
};

export type UMGCompilerResult = {
  status: 'ok' | 'not_configured' | 'error';
  manifest?: UMGCompiledRuntimeManifest;
  errors: UMGCompilerError[];
  warnings: UMGCompilerWarning[];
  raw?: unknown;
  compiledAt?: string;
};

export type CompilerConnectionSummary = {
  configured: boolean;
  endpoint?: string;
  source: 'env' | 'local_bridge' | 'not_configured';
  message: string;
};

export type CreateCompilerInputArgs = {
  compileCandidate: CompileCandidate;
  assemblyPlan: SleeveAssemblyPlan;
  blockMatchPlan: import('./blockMatchingTypes').BlockMatchPlan;
  businessMap: import('./businessIntakeTypes').BusinessMap;
  businessInput?: import('./businessIntakeTypes').BusinessInput;
};
