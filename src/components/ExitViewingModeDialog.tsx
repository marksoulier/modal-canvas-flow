import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

interface ExitViewingModeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
}

const ExitViewingModeDialog: React.FC<ExitViewingModeDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false,
}) => {
    const handleConfirm = () => {
        // Commented out for future implementation
        // onConfirm();

        // Open UX testing calendar in new tab
        window.open('https://cal.com/lever-ai/financial-planner-ux-tester', '_blank');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                {/* UX Testing Promotion Section */}
                <div className="bg-primary/5 border-b border-primary/10 p-6 -mt-6 -mx-6 mb-6">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                            🔒 <strong>Early Access Available</strong> - Tool currently in development
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">
                            Get exclusive access by joining our UX testing program
                        </p>
                    </div>
                </div>

                <DialogHeader>
                    <DialogTitle>Want to Create Your Own Plan?</DialogTitle>
                    <DialogDescription className="space-y-2">
                        <p>
                            Our financial planning tool is currently in active development and is exclusively available to UX testers.
                        </p>
                        <p>
                            Share just 1 hour of feedback with our financial coach and get lifetime premium access as one of our first users!
                        </p>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
                        Maybe Later
                    </Button>
                    <Button onClick={handleConfirm} disabled={isLoading} className="flex-1">
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                            </>
                        ) : (
                            'Schedule UX Session →'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ExitViewingModeDialog; 