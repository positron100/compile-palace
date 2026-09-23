/**
 * Common execution-result model both providers normalize into. Nothing
 * outside src/services/execution/ should know Judge0 or JDoodle exist —
 * compileService.ts (the existing public API EditorPage.tsx already calls)
 * adapts this back into the legacy Judge0-shaped object the Output UI was
 * built around, so no UI changes were needed for this task.
 */
export type ExecutionStatus =
  | "RUNNING"
  | "SUCCESS"
  | "COMPILATION_ERROR"
  | "RUNTIME_ERROR"
  | "TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "ERROR";

export interface ExecutionResult {
  status: ExecutionStatus;
  /** Human-readable status text, e.g. Judge0's own "Accepted"/"Runtime Error (NZEC)". */
  statusDescription: string;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  /** Seconds, as a string — matches Judge0's own field shape (existing UI expects this). */
  time: string | null;
  /** KB, as a string. */
  memory: string | null;
  provider: "judge0" | "jdoodle";
}

export interface ExecutionRequest {
  /** Compile Palace's own Judge0-based language id (languageOptions in compileService.ts) — the one stable id the rest of the app already keys everything off. */
  languageId: number;
  sourceCode: string;
  stdin: string;
}

export class ProviderUnavailableError extends Error {
  constructor(provider: string, cause?: unknown) {
    super(`${provider} unavailable: ${cause instanceof Error ? cause.message : String(cause ?? "unknown error")}`);
    this.name = "ProviderUnavailableError";
  }
}

/** A provider that can't run the requested language at all (section 3 — never guess a wrong language string). */
export class UnsupportedLanguageError extends Error {
  constructor(provider: string, languageId: number) {
    super(`${provider} has no mapping for language id ${languageId}`);
    this.name = "UnsupportedLanguageError";
  }
}

export interface ExecutionProvider {
  name: "judge0" | "jdoodle";
  supportsLanguage(languageId: number): boolean;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
