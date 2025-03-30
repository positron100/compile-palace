
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

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

interface OutputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outputDetails: OutputDetails | null;
}

const OutputDialog: React.FC<OutputDialogProps> = ({
  open,
  onOpenChange,
  outputDetails,
}) => {
  const isMobile = useIsMobile();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`
        ${isMobile ? 'w-[95vw] p-3' : 'sm:max-w-[600px] px-6 py-5'} 
        max-h-[85vh] overflow-auto rounded-xl shadow-lg border border-purple-100
      `}>
        <DialogHeader className="flex-row justify-between items-center space-y-0 gap-2">
          <div>
            <DialogTitle className="text-lg">Execution Results</DialogTitle>
            <DialogDescription>
              {outputDetails?.status && (
                <div className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                  outputDetails.status.id === 3 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {outputDetails.status.description || "Unknown"}
                </div>
              )}
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 mt-1">
          {outputDetails ? (
            <>
              {outputDetails.stdout && (
                <div>
                  <h3 className="text-sm font-medium mb-1">Standard Output:</h3>
                  <pre className={`bg-slate-50 p-3 rounded-lg text-sm overflow-auto ${isMobile ? 'max-h-[120px]' : 'max-h-[200px]'}`}>
                    {outputDetails.stdout}
                  </pre>
                </div>
              )}
              
              {outputDetails.stderr && (
                <div>
                  <h3 className="text-sm font-medium mb-1">Standard Error:</h3>
                  <pre className={`bg-red-50 p-3 rounded-lg text-sm text-red-700 overflow-auto ${isMobile ? 'max-h-[120px]' : 'max-h-[200px]'}`}>
                    {outputDetails.stderr}
                  </pre>
                </div>
              )}
              
              {outputDetails.compile_output && (
                <div>
                  <h3 className="text-sm font-medium mb-1">Compilation Output:</h3>
                  <pre className={`bg-amber-50 p-3 rounded-lg text-sm text-amber-700 overflow-auto ${isMobile ? 'max-h-[120px]' : 'max-h-[200px]'}`}>
                    {outputDetails.compile_output}
                  </pre>
                </div>
              )}
              
              {(outputDetails.time || outputDetails.memory) && (
                <div className="flex flex-wrap gap-3 sm:gap-6 text-sm text-slate-600">
                  {outputDetails.time && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Time:</span> {outputDetails.time}s
                    </div>
                  )}
                  {outputDetails.memory && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Memory:</span> {outputDetails.memory} KB
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No output data available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutputDialog;
