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

interface CancelSubscriptionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    subscriptionEndsAt?: string | null;
}

const CancelSubscriptionDialog: React.FC<CancelSubscriptionDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    subscriptionEndsAt
}) => {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-orange-500" />
                        <DialogTitle>Cancel Subscription</DialogTitle>
                    </div>
                    <DialogDescription className="pt-2">
                        Are you sure you want to cancel your Premium subscription?
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <h4 className="font-medium text-orange-800 mb-2">What happens next:</h4>
                        <ul className="text-sm text-orange-700 space-y-1">
                            <li>• Your subscription will be canceled</li>
                            <li>• You'll keep Premium access until {subscriptionEndsAt ? formatDate(subscriptionEndsAt) : 'the end of your billing period'}</li>
                            <li>• After that, you'll switch to the Free plan</li>
                            <li>• You can resubscribe anytime</li>
                        </ul>
                    </div>
                </div>

                <div className="flex gap-3 pt-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1"
                    >
                        Keep Subscription
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        className="flex-1"
                    >
                        Cancel Subscription
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CancelSubscriptionDialog; 