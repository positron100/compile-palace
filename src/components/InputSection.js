
import React from 'react';

const InputSection = ({ stdin, setStdin }) => {
  return (
    <div className="input-section">
      <div className="input-label">
        <h4>Standard Input</h4>
      </div>
      <textarea
        className="stdin-textarea"
        value={stdin}
        onChange={(e) => setStdin(e.target.value)}
        placeholder="Enter input here..."
      />
    </div>
  );
};

export default InputSection;
