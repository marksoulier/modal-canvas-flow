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
import { Trash2, Loader2, User, CreditCard, FolderOpen, Settings, LogOut } from 'lucide-react';

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

  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'plans'>('profile');

  const sidebarItems = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'subscription' as const, label: 'Subscription', icon: CreditCard },
    { id: 'plans' as const, label: 'Plans', icon: FolderOpen },
  ];

  const renderProfileContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-4 text-foreground">Profile Information</h3>
        <div className="bg-muted/30 rounded-lg p-6 space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email Address</p>
              <p className="font-medium text-foreground">{user.email}</p>
            </div>
          </div>
          {userData?.profile?.subscription_date && (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">Member since</p>
              <p className="font-medium text-foreground">
                {new Date(userData.profile.subscription_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSubscriptionContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-4 text-foreground">Subscription Details</h3>
        <div className="bg-muted/30 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="font-semibold text-lg capitalize text-foreground">
                {userData?.profile?.plan_type || 'Free'}
              </p>
            </div>
            <Badge 
              variant={isPremium ? "default" : "secondary"} 
              className="text-xs px-3 py-1"
            >
              {isPremium ? 'Premium' : 'Free'}
            </Badge>
          </div>
          <div className="border-t border-border pt-4">
            <Button
              onClick={onOpenSubscription}
              className="w-full"
              variant={isPremium ? "outline" : "default"}
            >
              {isPremium ? 'Manage Subscription' : 'Upgrade to Premium'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlansContent = () => (
    <div className="space-y-6">
      {/* Default Plans */}
      {(defaultPlans.length > 0 || isLoadingDefaults) && (
        <div>
          <h3 className="text-xl font-semibold mb-4 text-foreground">
            Default Plans
            {isLoadingDefaults && <span className="text-sm text-muted-foreground ml-2">(Loading...)</span>}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoadingDefaults ? (
              <div className="col-span-full text-center p-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading default plans...</p>
              </div>
            ) : (
              defaultPlans.map((plan, index) => (
                <Card 
                  key={`default-${index}`} 
                  className="cursor-pointer hover:shadow-md transition-all duration-200 hover:bg-accent/50 border-primary/20" 
                  onClick={() => handleLoadDefaultPlan(plan.plan_data, plan.plan_name || '')}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium text-foreground">
                        {plan.plan_name || 'Untitled Plan'}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                        Default
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {plan.plan_image && (
                      <div className="mb-3">
                        <img
                          src={svgToDataUri(plan.plan_image)}
                          alt={`Preview of ${plan.plan_name || 'Untitled Plan'}`}
                          className="w-full h-24 object-cover rounded-md border border-border"
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

      {/* User's Saved Plans */}
      {userData?.plans && userData.plans.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4 text-foreground">
            Your Plans ({userData.plans.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userData.plans.map((plan) => (
              <Card 
                key={plan.id} 
                className="cursor-pointer hover:shadow-md transition-all duration-200 hover:bg-accent/50 relative group" 
                onClick={() => handleLoadPlan(plan.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-foreground pr-8">
                      {plan.plan_name}
                    </CardTitle>
                    <div className="flex items-center gap-2 absolute top-3 right-3">
                      {loadingPlanId === plan.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeletePlan(plan.id, plan.plan_name || 'Untitled Plan', e)}
                        disabled={deletingPlanId === plan.id}
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                      >
                        {deletingPlanId === plan.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {plan.plan_image && (
                    <div className="mb-3">
                      <img
                        src={svgToDataUri(plan.plan_image)}
                        alt={`Preview of ${plan.plan_name || 'Untitled Plan'}`}
                        className="w-full h-24 object-cover rounded-md border border-border"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(plan.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Updated: {new Date(plan.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No Plans Message */}
      {(!userData?.plans || userData.plans.length === 0) && defaultPlans.length === 0 && !isLoadingDefaults && (
        <div className="text-center p-12 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No plans available</p>
          <p className="text-sm">Save your financial plan to see it here!</p>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl h-[85vh] max-h-[85vh] p-0 gap-0 fixed inset-0 m-auto">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-64 bg-muted/30 border-r border-border p-6">
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-foreground">Account Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
            </div>
            
            <nav className="space-y-2">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-8 pt-6 border-t border-border">
              <Button
                variant="ghost"
                onClick={onSignOut}
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-8 overflow-y-auto max-h-full">
            {activeTab === 'profile' && renderProfileContent()}
            {activeTab === 'subscription' && renderSubscriptionContent()}
            {activeTab === 'plans' && renderPlansContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserAccountModal;