
import React from 'react';

const CompileButton = ({ onClick, isCompiling }) => {
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
