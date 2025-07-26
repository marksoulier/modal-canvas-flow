import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { Trash2, Loader2 } from 'lucide-react';

interface UserAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onOpenSubscription: () => void;
}

interface DefaultPlan {
  plan_name: string | null;
  plan_data: any;
  plan_image: string | null;
}

// Helper function to convert SVG text to data URI
const svgToDataUri = (svgText: string): string => {
  if (!svgText) return '';

  // If it's already a data URI, return as is
  if (svgText.startsWith('data:')) {
    return svgText;
  }

  // If it's an SVG string, convert to data URI
  if (svgText.includes('<svg')) {
    // Encode the SVG content
    const encodedSvg = encodeURIComponent(svgText);
    return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
  }

  return svgText;
};

const UserAccountModal: React.FC<UserAccountModalProps> = ({ isOpen, onClose, onSignOut, onOpenSubscription }) => {
  const { user, userData, isLoading, isPremium, togglePremium, fetchDefaultPlans, deletePlan, loadPlanById } = useAuth();
  const { loadPlan } = usePlan();
  const [defaultPlans, setDefaultPlans] = useState<DefaultPlan[]>([]);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  // Fetch default plans when modal opens
  useEffect(() => {
    if (isOpen && fetchDefaultPlans) {
      setIsLoadingDefaults(true);
      fetchDefaultPlans()
        .then((plans) => {
          setDefaultPlans(plans);
        })
        .catch((error) => {
          console.error('Error fetching default plans:', error);
        })
        .finally(() => {
          setIsLoadingDefaults(false);
        });
    }
  }, [isOpen, fetchDefaultPlans]);

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-sm">Loading user data...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!user) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Not Signed In</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-sm">Please sign in to view your account.</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleLoadPlan = async (planId: string) => {
    setLoadingPlanId(planId);
    try {
      const plan = await loadPlanById(planId);
      if (plan) {
        loadPlan(plan.plan_data);
        toast.success(`Plan "${plan.plan_name}" loaded successfully!`);
        onClose();
      }
    } catch (error) {
      console.error('Error loading plan:', error);
      toast.error('Failed to load plan. Please try again.');
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the card click
    if (!confirm(`Are you sure you want to delete "${planName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingPlanId(planId);
    try {
      const success = await deletePlan(planId);
      if (success) {
        toast.success(`Plan "${planName}" deleted successfully!`);
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Failed to delete plan. Please try again.');
    } finally {
      setDeletingPlanId(null);
    }
  };

  const handleLoadDefaultPlan = async (planData: any, planName: string) => {
    try {
      loadPlan(planData);
      toast.success(`Default plan "${planName}" loaded successfully!`);
      onClose();
    } catch (error) {
      console.error('Error loading default plan:', error);
      toast.error('Failed to load default plan. Please try again.');
    }
  };

  const handleTogglePremium = async () => {
    try {
      await togglePremium();
      toast.success('Plan type updated successfully!');
    } catch (error) {
      toast.error('Failed to update plan type. Please try again.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Account Information</h3>
            <div className="space-y-2">
              <p><strong>Email:</strong> {user.email}</p>
              <div className="flex items-center justify-between">
                <p>
                  <strong>Plan:</strong>
                  <Button
                    variant={isPremium ? "default" : "secondary"}
                    size="sm"
                    onClick={onOpenSubscription}
                    className="ml-2 h-6 px-2 text-xs"
                  >
                    {userData?.profile?.plan_type || 'free'}
                  </Button>
                </p>
                {/* <div className="flex items-center space-x-2">
                  <label htmlFor="premium-toggle" className="text-sm">Premium</label>
                  <Switch
                    id="premium-toggle"
                    checked={isPremium}
                    onCheckedChange={handleTogglePremium}
                  />
                </div> */}
              </div>
              {userData?.profile?.subscription_date && (
                <p><strong>Member since:</strong> {new Date(userData.profile.subscription_date).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {/* Default Plans Section */}
          {(defaultPlans.length > 0 || isLoadingDefaults) && (
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Default Plans
                {isLoadingDefaults && <span className="text-sm text-muted-foreground ml-2">(Loading...)</span>}
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {isLoadingDefaults ? (
                  <div className="text-center p-4 text-muted-foreground">
                    <p className="text-sm">Loading default plans...</p>
                  </div>
                ) : (
                  defaultPlans.map((plan, index) => (
                    <Card key={`default-${index}`} className="cursor-pointer hover:bg-accent border-blue-200" onClick={() => handleLoadDefaultPlan(plan.plan_data, plan.plan_name || '')}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{plan.plan_name || 'Untitled Plan'}</CardTitle>
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {plan.plan_image && (
                          <div className="mb-2">
                            <img
                              src={svgToDataUri(plan.plan_image)}
                              alt={`Preview of ${plan.plan_name || 'Untitled Plan'}`}
                              className="w-full h-20 object-cover rounded border"
                            />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">Available to all users</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* User's Saved Plans Section */}
          {userData?.plans && userData.plans.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Your Saved Plans ({userData.plans.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {userData.plans.map((plan) => (
                  <Card key={plan.id} className="cursor-pointer hover:bg-accent relative" onClick={() => handleLoadPlan(plan.id)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{plan.plan_name}</CardTitle>
                        <div className="flex items-center gap-2">
                          {loadingPlanId === plan.id && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeletePlan(plan.id, plan.plan_name || 'Untitled Plan', e)}
                            disabled={deletingPlanId === plan.id}
                            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          >
                            {deletingPlanId === plan.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {plan.plan_image && (
                        <div className="mb-2">
                          <img
                            src={svgToDataUri(plan.plan_image)}
                            alt={`Preview of ${plan.plan_name || 'Untitled Plan'}`}
                            className="w-full h-20 object-cover rounded border"
                          />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">Created: {new Date(plan.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">Updated: {new Date(plan.updated_at).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* No Plans Message */}
          {(!userData?.plans || userData.plans.length === 0) && defaultPlans.length === 0 && !isLoadingDefaults && (
            <div className="text-center p-4 text-muted-foreground">
              <p>No plans available.</p>
              <p className="text-sm">Save your financial plan to see it here!</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button variant="destructive" onClick={onSignOut} className="flex-1">
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserAccountModal;