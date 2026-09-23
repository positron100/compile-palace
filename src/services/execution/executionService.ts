import { judge0Provider } from "./judge0Provider";
import { jdoodleProvider } from "./jdoodleProvider";
import { ExecutionRequest, ExecutionResult, ProviderUnavailableError, UnsupportedLanguageError } from "./types";

/**
 * CodeExecutionService — the one thing the rest of Compile Palace talks to.
 * Judge0 stays PRIMARY; JDoodle only runs when Judge0 itself throws
 * ProviderUnavailableError (network failure, no token, or the bounded poll
 * in judge0Provider.ts timing out) — never for a legitimate compile/runtime
 * error in the user's own code, which is a normal successful response from
 * Judge0's point of view and returned as-is.
 */
export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  try {
    return await judge0Provider.execute(request);
  } catch (err) {
    if (!(err instanceof ProviderUnavailableError)) {
      throw err; // Unexpected error shape — don't mask it by silently falling back.
    }

    if (!jdoodleProvider.supportsLanguage(request.languageId)) {
      // Primary is down AND fallback has no mapping for this language
      // (section 3) — report PROVIDER_UNAVAILABLE rather than guessing.
      return {
        status: "PROVIDER_UNAVAILABLE",
        statusDescription: "Judge0 is unavailable and the fallback provider does not support this language.",
        stdout: null,
        stderr: null,
        compileOutput: null,
        time: null,
        memory: null,
        provider: "judge0",
      };
    }

    try {
      return await jdoodleProvider.execute(request);
    } catch (fallbackErr) {
      const message =
        fallbackErr instanceof UnsupportedLanguageError
          ? fallbackErr.message
          : fallbackErr instanceof ProviderUnavailableError
          ? fallbackErr.message
          : "Fallback provider failed.";
      return {
        status: "PROVIDER_UNAVAILABLE",
        statusDescription: message,
        stdout: null,
        stderr: null,
        compileOutput: null,
        time: null,
        memory: null,
        provider: "jdoodle",
      };
    }
  }
}
