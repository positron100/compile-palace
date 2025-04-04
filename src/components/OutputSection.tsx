
import React from 'react';

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
    <div className="output-section p-4 bg-white rounded-md">
      {outputDetails ? (
        <div className="space-y-4">
          <div className="output-item">
            <h5 className="text-sm font-semibold text-gray-700 mb-1">Standard Output:</h5>
            <pre className="p-3 bg-gray-50 rounded border border-gray-200 text-sm text-gray-800 overflow-auto max-h-40">
              {outputDetails.stdout || "No standard output"}
            </pre>
          </div>
          
          {outputDetails.stderr && (
            <div className="output-item">
              <h5 className="text-sm font-semibold text-gray-700 mb-1">Standard Error:</h5>
              <pre className="p-3 bg-red-50 rounded border border-red-100 text-sm text-red-800 overflow-auto max-h-40">
                {outputDetails.stderr}
              </pre>
            </div>
          )}
          
          {outputDetails.compile_output && (
            <div className="output-item">
              <h5 className="text-sm font-semibold text-gray-700 mb-1">Compilation Output:</h5>
              <pre className="p-3 bg-amber-50 rounded border border-amber-100 text-sm text-amber-800 overflow-auto max-h-40">
                {outputDetails.compile_output}
              </pre>
            </div>
          )}
          
          <div className="flex items-center gap-4 mt-4">
            <div className="status-badge px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: outputDetails.status?.id === 3 ? '#e6f7e6' : '#fff3e6',
                  color: outputDetails.status?.id === 3 ? '#348134' : '#be7c19',
                  border: `1px solid ${outputDetails.status?.id === 3 ? '#c9e9c9' : '#ffdfb3'}`
                }}>
              {outputDetails.status?.description || "Unknown"}
            </div>
            
            {outputDetails.time && (
              <div className="metrics flex items-center gap-4 text-xs text-gray-600">
                <div className="metric">
                  <span className="font-medium">Time:</span> {outputDetails.time}s
                </div>
                <div className="metric">
                  <span className="font-medium">Memory:</span> {outputDetails.memory} KB
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-gray-400 italic">
          Run your code to see output
        </div>
      )}
    </div>
  );
};

export default OutputSection;
