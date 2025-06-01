
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);

  const handleSelectPlan = async (planType: 'free' | 'premium') => {
    if (planType === 'free') {
      console.log('Selected free plan');
      onClose();
      return;
    }

    // Handle premium plan - redirect to Stripe checkout
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) {
        console.error('Error creating checkout session:', error);
        alert('Error creating checkout session. Please try again.');
        return;
      }

      // Open Stripe checkout in a new tab
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Choose Your Plan</DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Free Plan */}
          <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Free Plan</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">$0</p>
              <p className="text-muted-foreground">Forever</p>
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
              disabled={loading}
            >
              Get Started Free
            </Button>
          </div>
          
          {/* Premium Plan */}
          <div className="border border-primary rounded-lg p-6 hover:shadow-lg transition-shadow relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                Popular
              </span>
            </div>
            
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Premium Plan</h3>
              <p className="text-3xl font-bold text-primary mt-2">$20</p>
              <p className="text-muted-foreground">per month</p>
            </div>
            
            <ul className="space-y-3 mb-6">
              <li className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3" />
                <span>Everything in Free Plan</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3" />
                <span>Save financial plans to cloud</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3" />
                <span>Monte Carlo simulation</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3" />
                <span>Real-time financial data</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3" />
                <span>Priority support</span>
              </li>
            </ul>
            
            <Button 
              onClick={() => handleSelectPlan('premium')}
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Upgrade to Premium'}
            </Button>
          </div>
        </div>
        
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>All plans include a 30-day money-back guarantee</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionModal;
