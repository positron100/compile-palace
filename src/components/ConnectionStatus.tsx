
import React from 'react';
import { WifiOff } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  isError: boolean;
  statusMessage: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  isConnected, 
  isError, 
  statusMessage 
}) => {
  return (
    <div 
      className={`flex items-center gap-1 mt-2 text-xs ${
        isError ? 'text-red-500' : isConnected ? 'text-green-600' : 'text-amber-500'
      }`}
    >
      {isError ? (
        <>
          <WifiOff size={14} />
          <span>Using local mode</span>
        </>
      ) : (
        <>
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-amber-500'
          }`}></div>
          <span>{statusMessage}</span>
        </>
      )}
    </div>
  );
};

export default ConnectionStatus;
