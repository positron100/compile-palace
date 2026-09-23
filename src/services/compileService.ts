
import { executeCode } from "./execution/executionService";
import { ExecutionResult } from "./execution/types";

// Available language options — unchanged (still Judge0's own ids/names,
// the one stable id both providers key off via languageMap.ts).
export const languageOptions = [
  { id: 63, name: "JavaScript (Node.js 12.14.0)" },
  { id: 71, name: "Python (3.8.1)" },
  { id: 62, name: "Java (OpenJDK 13.0.1)" },
  { id: 54, name: "C++ (GCC 9.2.0)" },
  { id: 50, name: "C (GCC 9.2.0)" },
  { id: 51, name: "C# (Mono 6.6.0.161)" },
  { id: 68, name: "PHP (7.4.1)" },
  { id: 78, name: "Ruby (2.7.0)" },
  { id: 82, name: "SQL (SQLite 3.27.2)" },
  { id: 83, name: "Swift (5.1.3)" },
];

// Legacy shape the Output UI (OutputDrawer/OutputSection) was already built
// around — status.id 3 = success, 6 = compilation error, anything else =
// generic failure. Kept as-is on purpose so this refactor required zero UI
// changes; the real provider abstraction lives in ./execution/.
interface SubmissionResult {
  status?: { id: number; description: string };
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string;
  memory?: string;
  provider?: "judge0" | "jdoodle";
}

function toLegacyResult(result: ExecutionResult): SubmissionResult {
  const statusId: Record<ExecutionResult["status"], number> = {
    SUCCESS: 3,
    COMPILATION_ERROR: 6,
    TIMEOUT: 5, // Judge0's own real "Time Limit Exceeded" id — kept for semantic consistency, UI doesn't special-case it beyond != 3/6.
    RUNTIME_ERROR: 4,
    PROVIDER_UNAVAILABLE: 13, // Judge0's own real "Internal Error" id — closest existing semantic match.
    ERROR: 13,
    RUNNING: 2,
  };
  return {
    status: { id: statusId[result.status], description: result.statusDescription },
    stdout: result.stdout ?? undefined,
    stderr: result.stderr ?? undefined,
    compile_output: result.compileOutput ?? undefined,
    time: result.time ?? undefined,
    memory: result.memory ?? undefined,
    provider: result.provider,
  };
}

// Public API is unchanged (same name/signature EditorPage.tsx already
// calls) — internally it now goes through the Judge0-primary/JDoodle-
// fallback CodeExecutionService instead of talking to Judge0 directly.
export const submitCode = async (languageId: number, sourceCode: string, stdin: string = ""): Promise<SubmissionResult> => {
  const result = await executeCode({ languageId, sourceCode, stdin });
  return toLegacyResult(result);
};
