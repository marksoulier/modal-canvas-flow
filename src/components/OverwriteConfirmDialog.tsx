import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';

interface OverwriteConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    planName: string;
}

const OverwriteConfirmDialog: React.FC<OverwriteConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    planName,
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-amber-500" />
                        <DialogTitle>Overwrite Existing Plan?</DialogTitle>
                    </div>
                    <DialogDescription className="pt-2">
                        A plan named <strong>"{planName}"</strong> already exists.
                        Do you want to overwrite it with your current plan?
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="flex-1 bg-amber-600 hover:bg-amber-700"
                    >
                        Overwrite Plan
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default OverwriteConfirmDialog; 