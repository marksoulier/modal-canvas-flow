import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import chroma from 'chroma-js';
import type { LucideIcon } from 'lucide-react';

interface PremiumFeatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSubscription: () => void;
    onOpenAuth: () => void;
    isLoggedIn: boolean;
    featureName: string;
    featureDescription: string;
    featureIcon?: LucideIcon;
}

const PremiumFeatureModal = ({ 
    isOpen, 
    onClose, 
    onOpenSubscription, 
    onOpenAuth, 
    isLoggedIn, 
    featureName, 
    featureDescription,
    featureIcon: FeatureIcon 
}: PremiumFeatureModalProps) => {
    const handleUpgradeClick = () => {
        onClose();
        if (isLoggedIn) {
            onOpenSubscription();
        } else {
            onOpenAuth();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center mb-2 text-[#335966] flex items-center justify-center gap-2">
                        {FeatureIcon && <FeatureIcon className="text-[#03c6fc]" size={28} />}
                        {featureName}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center space-y-6 py-4">
                    <div className="text-center space-y-4">
                        <p className="text-lg" style={{ color: '#444' }}>
                            {featureDescription}
                        </p>

                        <div className="p-4 rounded-lg" style={{
                            backgroundColor: chroma('#03c6fc').brighten(2).alpha(0.18).hex(),
                            border: `1px solid ${chroma('#03c6fc').brighten(1).alpha(0.3).hex()}`
                        }}>
                            <p className="text-sm" style={{ color: '#335966' }}>
                                <strong>Upgrade to Premium</strong> to unlock this feature and get more out of your financial planning.
                            </p>
                        </div>

                        <div className="space-y-3 pt-2">
                            <Button
                                className="w-full text-white"
                                style={{
                                    background: `linear-gradient(to right, ${chroma('#03c6fc').brighten(0.2).hex()}, ${chroma('#03c6fc').darken(0.2).hex()})`,
                                    border: 'none',
                                    boxShadow: '0 2px 4px rgba(3, 198, 252, 0.1)'
                                }}
                                onClick={handleUpgradeClick}
                            >
                                {isLoggedIn ? 'Upgrade to Premium' : 'Sign In to Upgrade'}
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full"
                                style={{
                                    borderColor: chroma('#03c6fc').brighten(1).alpha(0.3).hex(),
                                    color: '#335966'
                                }}
                                onClick={onClose}
                            >
                                Maybe Later
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PremiumFeatureModal;
