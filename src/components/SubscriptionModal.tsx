
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Check } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import CancelSubscriptionDialog from './CancelSubscriptionDialog';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [income, setIncome] = useState([65000]);
  const { userData, isPremium, user, refreshUserData, logAnonymousButtonClick } = useAuth();

  // Handle success/cancel from Stripe checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const sessionId = urlParams.get('session_id');

    if (success === 'true' && sessionId) {
      toast.success('🎉 Welcome to Premium! Your subscription is now active.');
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      onClose();
    } else if (canceled === 'true') {
      toast.error('Subscription canceled. You can upgrade anytime!');
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [onClose]);

  const currentPlan = userData?.profile?.plan_type || 'free';
  const subscriptionStatus = userData?.profile?.subscription_status || 'ended';
  const subscriptionEndsAt = userData?.profile?.subscription_ends_at;
  const incomeValue = income[0];
  const isHighIncome = incomeValue > 80000;

  // Check if user has premium but subscription is canceled
  const isPremiumCanceled = currentPlan === 'premium' && subscriptionStatus === 'canceled';

  const handleSelectPlan = async (planType: 'free' | 'premium') => {
    if (logAnonymousButtonClick) {
      if (planType === 'free') {
        await logAnonymousButtonClick('select_free_plan');
      } else if (planType === 'premium') {
        await logAnonymousButtonClick('select_premium_plan');
      }
    }

    if (planType === 'free') {
      console.log('Selected free plan');
      onClose();
      return;
    }

    if (!user) {
      toast.error('Please sign in to upgrade to premium');
      return;
    }

    // Handle premium plan - redirect to Stripe checkout
    setLoading(true);
    try {
      // Get the current session to pass auth token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Please sign in to upgrade to premium');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error creating checkout session:', error);
        toast.error('Error creating checkout session. Please try again.');
        return;
      }

      // Redirect to Stripe checkout in the same tab for better UX
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('No checkout URL received. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (logAnonymousButtonClick) {
      await logAnonymousButtonClick('cancel_subscription');
    }

    if (!user) {
      toast.error('Please sign in to cancel subscription');
      return;
    }
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    setShowCancelDialog(false);
    setCanceling(true);

    try {
      // Get the current session to pass auth token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Please sign in to cancel subscription');
        setCanceling(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error canceling subscription:', error);
        toast.error('Error canceling subscription. Please try again.');
        return;
      }

      if (data?.success) {
        toast.success(data.message || '✅ Subscription canceled successfully.');

        // Refresh user data to show updated subscription status
        await refreshUserData();

        // Keep modal open to show updated status
      } else {
        toast.error('Failed to cancel subscription. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while canceling subscription.');
    } finally {
      setCanceling(false);
    }
  };

  return (
    <>
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
                {currentPlan === 'premium' && !isPremiumCanceled && (
                  <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded-full mt-2">
                    Current Plan
                  </span>
                )}
                {isPremiumCanceled && subscriptionEndsAt && (
                  <div className="mt-2 space-y-1">
                    <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                      Canceling Soon
                    </span>
                    <p className="text-xs text-orange-600">
                      Ends {new Date(subscriptionEndsAt).toLocaleDateString()}
                    </p>
                  </div>
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

              {currentPlan === 'premium' && !isPremiumCanceled ? (
                // Active Premium - show cancel option
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={true}
                  >
                    Current Plan
                  </Button>
                  <Button
                    onClick={handleCancelSubscription}
                    variant="destructive"
                    className="w-full"
                    disabled={canceling}
                  >
                    {canceling ? 'Canceling...' : 'Cancel Subscription'}
                  </Button>
                </div>
              ) : isPremiumCanceled ? (
                // Premium but canceled - show status
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={true}
                  >
                    Subscription Canceled
                  </Button>
                  <p className="text-sm text-gray-600 text-center">
                    You'll keep premium access until {subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString() : 'the end of your billing period'}
                  </p>
                </div>
              ) : (
                // Free plan - show upgrade option
                <Button
                  onClick={() => handleSelectPlan('premium')}
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Upgrade to Premium'}
                </Button>
              )}
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

      {/* Cancel Subscription Confirmation Dialog */}
      <CancelSubscriptionDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleConfirmCancel}
        subscriptionEndsAt={subscriptionEndsAt}
      />
    </>
  );
};

export default SubscriptionModal;
