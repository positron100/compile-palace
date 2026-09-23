import { ExecutionProvider, ExecutionRequest, ExecutionResult, ExecutionStatus, ProviderUnavailableError } from "./types";

// Unchanged from the pre-existing compileService.ts — same URL, same key,
// same request shape. Judge0 stays PRIMARY and its network behavior/UX is
// untouched by this refactor; this file only relocates+wraps it.
const JUDGE0_API_URL = "https://judge0-ce.p.rapidapi.com";
const API_KEY = "8f596800e4msh08195884220a91fp175c80jsnab3c93d55017";

interface Judge0Result {
  token?: string;
  status?: { id: number; description: string };
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string;
  memory?: string;
}

// The original implementation polled `while status.id is 1 or 2` with no
// upper bound at all — a real latent bug (Judge0 hanging would hang Compile
// Palace's Run button forever). A provider-abstraction fallback needs SOME
// signal to know "primary is unavailable, try the fallback," so a bounded
// poll is the one piece of pre-existing behavior this task's own instructions
// (section: only redesign what's necessary for a clean abstraction) required
// touching. 30 attempts * 1s poll interval (unchanged) = 30s ceiling.
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 1000;

function mapJudge0Status(statusId: number | undefined): ExecutionStatus {
  switch (statusId) {
    case 3: return "SUCCESS"; // Accepted
    case 5: return "TIMEOUT"; // Time Limit Exceeded
    case 6: return "COMPILATION_ERROR";
    default: return "RUNTIME_ERROR"; // Wrong Answer / Runtime Error variants / etc.
  }
}

async function pollForResult(token: string): Promise<Judge0Result> {
  const options = {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": API_KEY,
      "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
    },
  };

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const response = await fetch(`${JUDGE0_API_URL}/submissions/${token}`, options);
    const result: Judge0Result = await response.json();
    if (result.status?.id !== 1 && result.status?.id !== 2) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new ProviderUnavailableError("judge0", "polling exceeded 30s without a final status");
}

export const judge0Provider: ExecutionProvider = {
  name: "judge0",
  // Judge0 is the original, general-purpose provider — every language
  // Compile Palace currently ships already came from Judge0's own catalog.
  supportsLanguage: () => true,

  async execute({ languageId, sourceCode, stdin }: ExecutionRequest): Promise<ExecutionResult> {
    // Dev-only fallback test switch. `import.meta.env.DEV` is Vite's own
    // build-time flag — false (and this whole branch dead-code-eliminated)
    // in any production build, so there is no code path for this to affect
    // prod regardless of the localStorage key. No UI control anywhere sets
    // this key; it's a manual devtools-console toggle, consumed once and
    // cleared automatically so a forgotten flag can't silently keep
    // Judge0 disabled. Touches nothing about the real API key/request.
    if (import.meta.env.DEV && localStorage.getItem("cp_force_judge0_unavailable") === "1") {
      localStorage.removeItem("cp_force_judge0_unavailable");
      throw new ProviderUnavailableError("judge0", "forced unavailable (dev test flag: cp_force_judge0_unavailable)");
    }

    let token: string | undefined;
    try {
      const response = await fetch(`${JUDGE0_API_URL}/submissions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
        body: JSON.stringify({ language_id: languageId, source_code: sourceCode, stdin }),
      });
      const submitResult: Judge0Result = await response.json();
      token = submitResult.token;
    } catch (err) {
      throw new ProviderUnavailableError("judge0", err);
    }

    if (!token) {
      throw new ProviderUnavailableError("judge0", "no token received from submission");
    }

    const result = await pollForResult(token); // throws ProviderUnavailableError on its own timeout

    return {
      status: mapJudge0Status(result.status?.id),
      statusDescription: result.status?.description ?? "Unknown",
      stdout: result.stdout ?? null,
      stderr: result.stderr ?? null,
      compileOutput: result.compile_output ?? null,
      time: result.time ?? null,
      memory: result.memory ?? null,
      provider: "judge0",
    };
  },
};
