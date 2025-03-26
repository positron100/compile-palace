
import React from 'react';
import { Play } from 'lucide-react';
import { Button } from './ui/button';

interface CompileButtonProps {
  onClick: () => void;
  isCompiling: boolean;
}

const CompileButton: React.FC<CompileButtonProps> = ({ onClick, isCompiling }) => {
  return (
    <Button
      onClick={onClick}
      disabled={isCompiling}
      className="bg-purple-600 hover:bg-purple-700 text-white"
    >
      {isCompiling ? (
        <>
          <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"/>
          Compiling...
        </>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          Run Code
        </>
      )}
    </Button>
  );
};

export default CompileButton;
