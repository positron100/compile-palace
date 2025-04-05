
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl p-0 overflow-hidden"
        hideCloseButton={true}
      >
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-purple-50 to-white">
          <div className="flex justify-between items-center">
            <DialogTitle>Execution Results</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X size={16} />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        
        <div className="p-4 overflow-auto max-h-[70vh]">
          <OutputSection outputDetails={outputDetails} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutputDialog;
