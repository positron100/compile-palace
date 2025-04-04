
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, X } from 'lucide-react';
import OutputSection from './OutputSection';

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
  const [fullScreen, setFullScreen] = useState(false);

  const toggleFullScreen = () => {
    setFullScreen(!fullScreen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${fullScreen ? 'w-[90vw] h-[90vh]' : 'max-w-4xl'} p-0 overflow-hidden`}
      >
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-purple-50 to-white">
          <div className="flex justify-between items-center">
            <DialogTitle>Execution Results</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullScreen}
                className="h-8 w-8"
              >
                {fullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </Button>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X size={16} />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>
        
        <div className={`p-4 overflow-auto ${fullScreen ? 'h-[calc(90vh-64px)]' : 'max-h-[70vh]'}`}>
          <OutputSection outputDetails={outputDetails} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutputDialog;
