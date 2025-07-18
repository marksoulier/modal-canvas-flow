
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';

interface UserAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

const UserAccountModal: React.FC<UserAccountModalProps> = ({ isOpen, onClose, onSignOut }) => {
  const { user, userData, isPremium, isLoading } = useAuth();

  const handleLoadPlan = (planId: string) => {
    console.log(`Loading plan ${planId}`);
    // TODO: Implement plan loading logic
    onClose();
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>User Account</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-sm text-gray-500">Loading account data...</div>
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
            <DialogTitle>User Account</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-sm text-gray-500">Please sign in to view account information.</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>User Account</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* User Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Account Information</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{user?.email || 'Not available'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Plan:</span>
                <span className={`font-medium ${isPremium ? 'text-primary' : 'text-green-600'}`}>
                  {userData?.plan_type === 'premium' ? 'Premium' : 'Free'}
                </span>
              </div>
              {userData?.subscription_date && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Member since:</span>
                  <span className="font-medium">
                    {new Date(userData.subscription_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Saved Plans */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Saved Financial Plans ({userData?.plans?.length || 0})
            </h3>
            {userData?.plans && userData.plans.length > 0 ? (
              <div className="space-y-2">
                {userData.plans.map((plan) => {
                  let planData;
                  try {
                    planData = JSON.parse(plan.plan_data);
                  } catch {
                    planData = { title: 'Untitled Plan' };
                  }

                  return (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleLoadPlan(plan.id)}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{planData.title || 'Untitled Plan'}</p>
                        <p className="text-sm text-gray-500">Plan ID: {plan.id.slice(0, 8)}...</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Load
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No saved plans yet. Create and save your first financial plan!</p>
            )}
          </div>
          
          <div className="border-t pt-4">
            <Button 
              onClick={onSignOut}
              variant="outline" 
              className="w-full"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserAccountModal;
