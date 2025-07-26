import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import chroma from 'chroma-js';

interface PremiumConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PremiumConfirmationModal = ({ isOpen, onClose }: PremiumConfirmationModalProps) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center mb-2 text-[#335966]">
                        🎉 Welcome to Premium!
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center space-y-6 py-4">
                    <div className="text-center space-y-4">
                        <p className="text-lg" style={{ color: '#444' }}>
                            Thank you for your interest in our premium features!
                        </p>

                        <div className="p-4 rounded-lg" style={{
                            backgroundColor: chroma('#03c6fc').brighten(2).alpha(0.18).hex(),
                            border: `1px solid ${chroma('#03c6fc').brighten(1).alpha(0.3).hex()}`
                        }}>
                            <p className="text-sm" style={{ color: '#335966' }}>
                                As we're currently in development, <strong>you won't be charged</strong> for this purchase.
                            </p>
                        </div>

                        <p style={{ color: '#666' }}>
                            Would you like to help shape the future of our app? Join our UX testing program!
                        </p>

                        <div className="space-y-3 pt-2">
                            <Button
                                className="w-full text-white"
                                style={{
                                    background: `linear-gradient(to right, ${chroma('#03c6fc').brighten(0.2).hex()}, ${chroma('#03c6fc').darken(0.2).hex()})`,
                                    border: 'none',
                                    boxShadow: '0 2px 4px rgba(3, 198, 252, 0.1)'
                                }}
                                onClick={() => window.open('https://cal.com/lever-ai/financial-planner-ux-tester', '_blank')}
                            >
                                Become a UX Tester
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

export default PremiumConfirmationModal; 