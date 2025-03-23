
import React from 'react';

const OutputSection = ({ outputDetails }) => {
  return (
    <div className="output-section">
      <div className="output-label">
        <h4>Output</h4>
      </div>
      <div className="output-details">
        {outputDetails ? (
          <>
            <div className="stdout-section">
              <h5>Standard Output:</h5>
              <pre className="output-content">{outputDetails.stdout || "No standard output"}</pre>
            </div>
            <div className="stderr-section">
              <h5>Standard Error:</h5>
              <pre className="output-content error">{outputDetails.stderr || "No standard error"}</pre>
            </div>
            {outputDetails.compile_output && (
              <div className="compile-output-section">
                <h5>Compilation Output:</h5>
                <pre className="output-content error">{outputDetails.compile_output}</pre>
              </div>
            )}
            <div className="status-section">
              <h5>Status:</h5>
              <div className={`status-badge status-${outputDetails.status?.id || 0}`}>
                {outputDetails.status?.description || "Unknown"}
              </div>
            </div>
            {outputDetails.time && (
              <div className="metrics-section">
                <div className="metric">
                  <span>Time:</span> {outputDetails.time}s
                </div>
                <div className="metric">
                  <span>Memory:</span> {outputDetails.memory} KB
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="no-output">Run your code to see output</div>
        )}
      </div>
    </div>
  );
};

export default OutputSection;
