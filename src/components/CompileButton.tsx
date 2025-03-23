
import React from 'react';

interface CompileButtonProps {
  onClick: () => void;
  isCompiling: boolean;
}

const CompileButton: React.FC<CompileButtonProps> = ({ onClick, isCompiling }) => {
  return (
    <button
      className={`btn compileBtn ${isCompiling ? 'loading' : ''}`}
      onClick={onClick}
      disabled={isCompiling}
    >
      {isCompiling ? 'Compiling...' : 'Run Code'}
    </button>
  );
};

export default CompileButton;
