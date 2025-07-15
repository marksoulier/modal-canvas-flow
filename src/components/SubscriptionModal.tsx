
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [income, setIncome] = useState([65000]);
  const { userData, isPremium } = useAuth();

  const currentPlan = userData?.plan_type || 'free';
  const incomeValue = income[0];
  const isHighIncome = incomeValue > 80000;

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
          <div className={`border rounded-lg p-6 hover:shadow-lg transition-shadow ${currentPlan === 'free' ? 'bg-gray-50 border-gray-300' : ''}`}>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Free Plan</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">$0</p>
              <p className="text-muted-foreground">Forever</p>
              {currentPlan === 'free' && (
                <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mt-2">
                  Current Plan
                </span>
              )}
            </div>
            
            <ul className="space-y-3 mb-6">
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>Financial planning events</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>Comparison of plans</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>Download plans for sharing</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-green-500 mr-3" />
                <span>Calculators for taxes, employment, retirement</span>
              </li>
            </ul>
            
            <Button 
              onClick={() => handleSelectPlan('free')}
              className="w-full"
              variant="outline"
              disabled={loading || currentPlan === 'free'}
            >
              {currentPlan === 'free' ? 'Current Plan' : 'Get Started Free'}
            </Button>
          </div>
          
          {/* Premium Plan */}
          <div className={`border border-primary rounded-lg p-6 hover:shadow-lg transition-shadow relative ${currentPlan === 'premium' ? 'bg-primary/5' : ''}`}>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                Popular
              </span>
            </div>
            
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Premium Plan</h3>
              <p className="text-3xl font-bold text-primary mt-2">$20</p>
              <p className="text-muted-foreground">per month</p>
              {currentPlan === 'premium' && (
                <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded-full mt-2">
                  Current Plan
                </span>
              )}
            </div>
            
            <ul className="space-y-3 mb-6">
              <li className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3" />
                <span>Everything in Free Plan</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3" />
                <span>Live market data (NASDAQ, interest rates)</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3" />
                <span>Unlimited Monte Carlo simulations</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3" />
                <span>Real-time AI monitoring & alerts</span>
              </li>
              <li className="flex items-center">
                <Check className="h-5 w-5 text-primary mr-3" />
                <span>News, housing & living reports</span>
              </li>
            </ul>
            
            <Button 
              onClick={() => handleSelectPlan('premium')}
              className="w-full"
              disabled={loading || currentPlan === 'premium'}
            >
              {loading ? 'Processing...' : currentPlan === 'premium' ? 'Current Plan' : 'Upgrade to Premium'}
            </Button>
          </div>
        </div>

        {/* Income Slider */}
        <div className="mt-8 bg-gray-50 p-6 rounded-lg">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold mb-2">Annual Income Assessment</h3>
            <div className="text-2xl font-bold text-primary mb-4">
              ${incomeValue.toLocaleString()}
            </div>
            <Slider
              value={income}
              onValueChange={setIncome}
              max={200000}
              min={20000}
              step={5000}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-2">
              <span>$20K</span>
              <span>$200K+</span>
            </div>
          </div>
          
          <div className="text-center mt-4">
            {isHighIncome ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">
                  💰 Premium features will generate more value than they cost at your income level
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium">
                  📊 Free plan features are sufficient to build a solid financial baseline
                </p>
              </div>
            )}
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
