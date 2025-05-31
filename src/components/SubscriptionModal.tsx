
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Check } from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  const handleSelectPlan = (planType: 'free' | 'premium') => {
    console.log(`Selected ${planType} plan`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Choose Your Plan</DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Free Plan */}
          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Free Plan</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">$0</p>
              <p className="text-gray-500">Forever</p>
            </div>
            
            <ul className="space-y-3 mb-6">
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>Full application access</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>All life planning capabilities</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>Save & load files</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>Open source code</span>
              </li>
            </ul>
            
            <Button 
              onClick={() => handleSelectPlan('free')}
              className="w-full"
              variant="outline"
            >
              Get Started Free
            </Button>
          </div>
          
          {/* Premium Plan */}
          <div className="border border-blue-500 rounded-lg p-6 hover:shadow-lg transition-shadow relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                Popular
              </span>
            </div>
            
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Premium Plan</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">$20</p>
              <p className="text-gray-500">per month</p>
            </div>
            
            <ul className="space-y-3 mb-6">
              <li className="flex items-center">
                <Check className="h-5 w-5 text-blue-500 mr-3" />
                <span>Everything in Free Plan</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-blue-500 mr-3" />
                <span>Save financial plans to cloud</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-blue-500 mr-3" />
                <span>Monte Carlo simulation</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-blue-500 mr-3" />
                <span>Real-time financial data</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-blue-500 mr-3" />
                <span>Priority support</span>
              </li>
            </ul>
            
            <Button 
              onClick={() => handleSelectPlan('premium')}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Upgrade to Premium
            </Button>
          </div>
        </div>
        
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>All plans include a 30-day money-back guarantee</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionModal;
