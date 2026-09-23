
import React from 'react';
import { AlertCircle, AlertTriangle, Terminal, ChevronRight } from 'lucide-react';

interface OutputStatus {
  id?: number;
  description?: string;
}

interface OutputDetails {
  status?: OutputStatus;
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string;
  memory?: string;
}

interface OutputSectionProps {
  outputDetails: OutputDetails | null;
  stdin?: string;
}

// Pulls a file/line(/col) location out of real diagnostic text — gcc/clang/js
// style ("main.cpp:4:12: error: ...") or Python's ("File "script.py", line 4").
// Returns null (no chip rendered) rather than guessing when neither pattern
// matches — never fabricates a location the diagnostic didn't actually contain.
function extractLocation(text?: string): { file: string; line: string; col?: string } | null {
  if (!text) return null;
  const gcc = text.match(/([^\s:"']+):(\d+):(\d+)/);
  if (gcc) return { file: gcc[1], line: gcc[2], col: gcc[3] };
  const py = text.match(/File "([^"]+)", line (\d+)/);
  if (py) return { file: py[1], line: py[2] };
  return null;
}

function LocationChip({ loc }: { loc: { file: string; line: string; col?: string } }) {
  return (
    <div className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded-md bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-600 dark:text-slate-300">
      <span className="truncate max-w-[10rem]">{loc.file}</span>
      <span className="opacity-50">:</span>
      <span>{loc.line}</span>
      {loc.col && (
        <>
          <span className="opacity-50">:</span>
          <span>{loc.col}</span>
        </>
      )}
    </div>
  );
}

const OutputSection: React.FC<OutputSectionProps> = ({ outputDetails, stdin }) => {
  if (!outputDetails) {
    return (
      <div className="output-section py-5">
        <div className="min-h-[200px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-5">
          <Terminal size={40} className="opacity-30 mb-3" />
          <p className="text-center">
            Run your code to see output results here
          </p>
        </div>
      </div>
    );
  }

  const compileLoc = extractLocation(outputDetails.compile_output);
  const stderrLoc = extractLocation(outputDetails.stderr);

  return (
    <div className="output-section py-4 space-y-5">
      {/* Program Output — always shown, exactly as received, never altered. */}
      <div className="output-item">
        <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Terminal size={15} className="opacity-80" />
          Program Output
        </div>
        {outputDetails.stdout ? (
          <pre className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 font-mono whitespace-pre-wrap">
            {outputDetails.stdout}
          </pre>
        ) : (
          <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 text-sm flex items-center justify-center italic">
            No output generated
          </div>
        )}
      </div>

      {/* Compiler diagnostics — Judge0's compile_output field, kept visually
          distinct (amber) from plain stdout/stderr since it's a different
          kind of information (build-time, not run-time). */}
      {outputDetails.compile_output && (
        <div className="output-item">
          <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle size={15} className="opacity-80" />
            Compilation Error
          </div>
          {compileLoc && <LocationChip loc={compileLoc} />}
          <pre className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-100 dark:border-amber-500/20 text-sm text-amber-800 dark:text-amber-200 font-mono whitespace-pre-wrap">
            {outputDetails.compile_output}
          </pre>
        </div>
      )}

      {/* stderr — only rendered when Judge0's response actually has content
          here, never manufactured. */}
      {outputDetails.stderr && (
        <div className="output-item">
          <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-red-600 dark:text-red-400">
            <AlertCircle size={15} className="opacity-80" />
            stderr
          </div>
          {stderrLoc && <LocationChip loc={stderrLoc} />}
          <pre className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-100 dark:border-red-500/20 text-sm text-red-800 dark:text-red-200 font-mono whitespace-pre-wrap">
            {outputDetails.stderr}
          </pre>
        </div>
      )}

      {/* Input — collapsible, native <details> (no new state/animation
          needed). Only renders when stdin actually has content; the app has
          no stdin-entry UI yet, so this stays dormant until one exists,
          rather than showing an empty/fake input box. */}
      {stdin && stdin.trim() && (
        <details className="output-item group">
          <summary className="flex items-center gap-1.5 mb-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none list-none">
            <ChevronRight size={15} className="opacity-70 transition-transform group-open:rotate-90" />
            Input
          </summary>
          <pre className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-slate-800 dark:text-slate-100 font-mono whitespace-pre-wrap">
            {stdin}
          </pre>
        </details>
      )}
    </div>
  );
};

export default OutputSection;
