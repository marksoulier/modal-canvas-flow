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
        <DialogContent className="sm:max-w-5xl h-[85vh] flex flex-col p-0">
          {/* Fixed Header Section */}
          <div className="bg-primary/5 border-b border-primary/10 p-6 flex-shrink-0">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                ✨ <strong>Become a UX Tester</strong> - Share 1 hour of feedback with our financial coach
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Get lifetime access to premium features in exchange for helping us improve the tool
              </p>
              <a
                href="https://cal.com/lever-ai/financial-planner-ux-tester"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors"
              >
                Schedule UX Session →
              </a>
            </div>
          </div>

          {/* Scrollable Content Section */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-8">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-center text-2xl">Choose Your Plan</DialogTitle>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Free Plan - existing JSX */}
                <div className={`border rounded-xl p-8 hover:shadow-lg transition-all duration-300 ${currentPlan === 'free' ? 'bg-muted/30 border-primary/20' : 'hover:border-primary/30'}`}>
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-semibold text-foreground">Free Plan</h3>
                    <p className="text-4xl font-bold text-primary mt-4">$0</p>
                    <p className="text-muted-foreground mt-1">Forever</p>
                    {currentPlan === 'free' && (
                      <span className="inline-block bg-primary/10 text-primary text-xs px-3 py-1 rounded-full mt-4">
                        Current Plan
                      </span>
                    )}
                  </div>

                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                      <span className="text-foreground">Financial planning events</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                      <span className="text-foreground">Comparison of plans</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                      <span className="text-foreground">Download plans for sharing</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                      <span className="text-foreground">Calculators for taxes, employment, retirement</span>
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

                {/* Premium Plan - existing JSX */}
                <div className={`border border-primary/30 rounded-xl p-8 hover:shadow-xl transition-all duration-300 relative ${currentPlan === 'premium' ? 'bg-primary/5' : 'hover:bg-primary/5'}`}>
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                      Popular
                    </span>
                  </div>

                  <div className="text-center mb-8">
                    <h3 className="text-xl font-semibold text-foreground">Premium Plan</h3>
                    <p className="text-4xl font-bold text-primary mt-4">$20</p>
                    <p className="text-muted-foreground mt-1">per month</p>
                    {currentPlan === 'premium' && !isPremiumCanceled && (
                      <span className="inline-block bg-primary/10 text-primary text-xs px-3 py-1 rounded-full mt-4">
                        Current Plan
                      </span>
                    )}
                    {isPremiumCanceled && subscriptionEndsAt && (
                      <div className="mt-4 space-y-2">
                        <span className="inline-block bg-orange-100 text-orange-800 text-xs px-3 py-1 rounded-full">
                          Canceling Soon
                        </span>
                        <p className="text-xs text-orange-600">
                          Ends {new Date(subscriptionEndsAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                      <span className="text-foreground">Everything in Free Plan</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                      <span className="text-foreground">Live market data (NASDAQ, interest rates)</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                      <span className="text-foreground">Unlimited Monte Carlo simulations</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                      <span className="text-foreground">Real-time AI monitoring & alerts</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                      <span className="text-foreground">News, housing & living reports</span>
                    </li>
                  </ul>

                  {currentPlan === 'premium' && !isPremiumCanceled ? (
                    <div className="space-y-3">
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
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={true}
                      >
                        Subscription Canceled
                      </Button>
                      <p className="text-sm text-muted-foreground text-center">
                        You'll keep premium access until {subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString() : 'the end of your billing period'}
                      </p>
                    </div>
                  ) : (
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

              {/* Income Slider Section */}
              <div className="mt-12 bg-muted/20 p-8 rounded-xl">
                <div className="text-center max-w-md mx-auto">
                  <div className="text-lg font-medium text-primary mb-6">
                    ${incomeValue.toLocaleString()}
                  </div>
                  <div className="px-4">
                    <Slider
                      value={income}
                      onValueChange={setIncome}
                      max={120000}
                      min={30000}
                      step={5000}
                      className="w-full [&>span:first-child]:h-1 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-3">
                      <span>$30K</span>
                      <span>$120K+</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="text-sm text-muted-foreground">
                      {isHighIncome ? 'Premium features provide more value then they cost at your income level' : 'Start with our free plan to build your financial foundation'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Money-back Guarantee */}
              <div className="text-center mt-8 mb-4 text-sm text-muted-foreground">
                <p>30-day money-back guarantee</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
