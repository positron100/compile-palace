import { supabase } from "@/integrations/supabase/client";
import { getJDoodleMapping } from "./languageMap";
import { ExecutionProvider, ExecutionRequest, ExecutionResult, ProviderUnavailableError, UnsupportedLanguageError } from "./types";

// clientId/clientSecret never touch this file, the browser bundle, or any
// Vite env var — the frontend only ever calls the "execute-jdoodle"
// Supabase Edge Function, which holds them as server-side secrets
// (JDOODLE_CLIENT_ID / JDOODLE_CLIENT_SECRET, set via `supabase secrets set`,
// see supabase/functions/execute-jdoodle/index.ts).
interface JDoodleEdgeResponse {
  output?: string;
  statusCode?: number;
  memory?: string;
  cpuTime?: string;
  error?: string;
}

export const jdoodleProvider: ExecutionProvider = {
  name: "jdoodle",
  supportsLanguage: (languageId: number) => getJDoodleMapping(languageId) !== null,

  async execute({ languageId, sourceCode, stdin }: ExecutionRequest): Promise<ExecutionResult> {
    const mapping = getJDoodleMapping(languageId);
    if (!mapping) {
      throw new UnsupportedLanguageError("jdoodle", languageId);
    }

    let data: JDoodleEdgeResponse | null;
    let error: unknown;
    try {
      const invokeResult = await supabase.functions.invoke<JDoodleEdgeResponse>("execute-jdoodle", {
        body: {
          script: sourceCode,
          language: mapping.language,
          versionIndex: mapping.versionIndex,
          stdin,
        },
      });
      data = invokeResult.data;
      error = invokeResult.error;
    } catch (err) {
      throw new ProviderUnavailableError("jdoodle", err);
    }

    if (error || !data) {
      throw new ProviderUnavailableError("jdoodle", error ?? "empty response from execute-jdoodle");
    }
    if (data.error) {
      // Edge function itself reported a JDoodle-side failure (bad
      // credentials, quota exceeded, etc.) — that's "provider unavailable,"
      // not a compile/runtime error in the user's own code.
      throw new ProviderUnavailableError("jdoodle", data.error);
    }

    // JDoodle's /execute response mixes stdout, stderr and compiler
    // diagnostics into one `output` string — unlike Judge0, it doesn't
    // expose them as separate fields, so this can't be split without
    // guessing. Surfaced as stdout (Program Output); compileOutput/stderr
    // stay null rather than fabricating a distinction JDoodle didn't give.
    const succeeded = data.statusCode === 200;
    return {
      status: succeeded ? "SUCCESS" : "RUNTIME_ERROR",
      statusDescription: succeeded ? "Accepted" : `JDoodle status ${data.statusCode ?? "unknown"}`,
      stdout: data.output ?? null,
      stderr: null,
      compileOutput: null,
      time: data.cpuTime ?? null,
      memory: data.memory ?? null,
      provider: "jdoodle",
    };
  },
};
