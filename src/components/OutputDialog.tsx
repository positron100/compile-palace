
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Terminal, Clock, HardDrive } from 'lucide-react';
import OutputSection from './OutputSection';
import { useIsMobile } from '@/hooks/use-mobile';

interface OutputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outputDetails: any;
}

const OutputDialog: React.FC<OutputDialogProps> = ({
  open,
  onOpenChange,
  outputDetails
}) => {
  const isMobile = useIsMobile();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${isMobile ? 'w-[90vw] max-w-[95vw] p-0' : 'max-w-4xl p-0'} overflow-hidden border-none rounded-xl shadow-2xl`}
        hideCloseButton={true}
      >
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-purple-600 to-indigo-700 rounded-t-xl">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-white flex items-center gap-2">
              <Terminal size={18} className="opacity-90 text-white" />
              Execution Results
            </DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10">
                <X size={16} />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        
        <div className={`p-0 overflow-auto ${isMobile ? 'max-h-[60vh]' : 'max-h-[70vh]'} bg-gradient-to-b from-slate-50 to-white rounded-b-xl`}>
          <div className={`${isMobile ? 'px-3' : 'px-4'}`}>
            <OutputSection outputDetails={outputDetails} />
          </div>
          
          {outputDetails && (
            <div className={`${isMobile ? 'px-3' : 'px-5'} py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 rounded-b-xl`}>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Clock size={12} className="opacity-70" />
                  {outputDetails.time ? `${outputDetails.time}s` : 'N/A'}
                </div>
                <div className="flex items-center gap-1">
                  <HardDrive size={12} className="opacity-70" />
                  {outputDetails.memory ? `${outputDetails.memory} KB` : 'N/A'}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs opacity-70">Judge0 API</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutputDialog;
