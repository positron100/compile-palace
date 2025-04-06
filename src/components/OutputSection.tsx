
import React from 'react';
import { AlertCircle, CheckCircle, Terminal, Info } from 'lucide-react';

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
}

const OutputSection: React.FC<OutputSectionProps> = ({ outputDetails }) => {
  return (
    <div className="output-section py-5">
      {outputDetails ? (
        <div className="space-y-5">
          <div className="output-header mb-4">
            <div className="status-badge inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mb-1"
              style={{
                backgroundColor: outputDetails.status?.id === 3 ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                color: outputDetails.status?.id === 3 ? 'rgb(4, 120, 87)' : 'rgb(146, 64, 14)',
                border: `1px solid ${outputDetails.status?.id === 3 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(251, 191, 36, 0.2)'}`
              }}>
              {outputDetails.status?.id === 3 ? (
                <CheckCircle size={14} className="stroke-[2.5px]" />
              ) : (
                <Info size={14} className="stroke-[2.5px]" />
              )}
              {outputDetails.status?.description || "Unknown"}
            </div>
          </div>
          
          {outputDetails.stdout && (
            <div className="output-item">
              <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-slate-700">
                <Terminal size={15} className="opacity-80" />
                Standard Output
              </div>
              <pre className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 overflow-auto max-h-44 font-mono whitespace-pre-wrap">
                {outputDetails.stdout}
              </pre>
            </div>
          )}
          
          {!outputDetails.stdout && (
            <div className="output-item">
              <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-slate-700">
                <Terminal size={15} className="opacity-80" />
                Standard Output
              </div>
              <div className="p-5 bg-slate-50 rounded-lg border border-slate-200 text-slate-400 text-sm flex items-center justify-center italic">
                No output generated
              </div>
            </div>
          )}
          
          {outputDetails.stderr && (
            <div className="output-item">
              <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-red-600">
                <AlertCircle size={15} className="opacity-80" />
                Standard Error
              </div>
              <pre className="p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-red-800 overflow-auto max-h-44 font-mono whitespace-pre-wrap">
                {outputDetails.stderr}
              </pre>
            </div>
          )}
          
          {outputDetails.compile_output && (
            <div className="output-item">
              <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-amber-700">
                <Info size={15} className="opacity-80" />
                Compilation Output
              </div>
              <pre className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-800 overflow-auto max-h-44 font-mono whitespace-pre-wrap">
                {outputDetails.compile_output}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-[200px] flex flex-col items-center justify-center text-slate-400 p-5">
          <Terminal size={40} className="opacity-30 mb-3" />
          <p className="text-center">
            Run your code to see output results here
          </p>
        </div>
      )}
    </div>
  );
};

export default OutputSection;
