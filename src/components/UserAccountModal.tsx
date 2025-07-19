import React from 'react';
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
import { Switch } from './ui/switch';
import { toast } from 'sonner';

interface UserAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

const UserAccountModal: React.FC<UserAccountModalProps> = ({ isOpen, onClose, onSignOut }) => {
  const { user, userData, isLoading, isPremium, togglePremium } = useAuth();

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

  const handleLoadPlan = (planId: string) => {
    // TODO: Implement plan loading functionality
    console.log('Loading plan:', planId);
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
                  <Badge variant={isPremium ? "default" : "secondary"} className="ml-2">
                    {userData?.profile?.plan_type || 'free'}
                  </Badge>
                </p>
                <div className="flex items-center space-x-2">
                  <label htmlFor="premium-toggle" className="text-sm">Premium</label>
                  <Switch
                    id="premium-toggle"
                    checked={isPremium}
                    onCheckedChange={handleTogglePremium}
                  />
                </div>
              </div>
              {userData?.profile?.subscription_date && (
                <p><strong>Member since:</strong> {new Date(userData.profile.subscription_date).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {userData?.plans && userData.plans.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Saved Plans ({userData.plans.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {userData.plans.map((plan) => (
                  <Card key={plan.id} className="cursor-pointer hover:bg-accent" onClick={() => handleLoadPlan(plan.id)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{plan.plan_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">Created: {new Date(plan.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">Updated: {new Date(plan.updated_at).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {(!userData?.plans || userData.plans.length === 0) && (
            <div className="text-center p-4 text-muted-foreground">
              <p>No saved plans yet.</p>
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