
import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const dialogRef = useRef(null);

  const toggleFullScreen = () => {
    setFullScreen(!fullScreen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-4xl p-0 gap-0 ${fullScreen ? 'w-[90vw] h-[90vh]' : ''}`}
        ref={dialogRef}
        aria-describedby="output-dialog-description"
      >
        <DialogTitle className="p-4 text-lg font-semibold border-b">
          Output
        </DialogTitle>
        <DialogDescription id="output-dialog-description" className="sr-only">
          Code execution results including output, errors and metrics
        </DialogDescription>
        
        <div className={`p-0 relative overflow-auto ${fullScreen ? 'h-full' : 'max-h-[70vh]'}`}>
          <OutputSection outputDetails={outputDetails} />
          
          <div className="absolute top-2 right-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullScreen}
              className="text-xs"
            >
              {fullScreen ? 'Exit Full Screen' : 'Full Screen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutputDialog;
