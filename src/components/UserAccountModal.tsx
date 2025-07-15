
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
  const { user, userData, isPremium } = useAuth();

  // Mock saved financial plans
  const savedPlans = [
    { id: 1, name: 'Retirement Plan 2024', lastModified: '2024-01-15' },
    { id: 2, name: 'House Purchase Strategy', lastModified: '2024-01-10' },
    { id: 3, name: 'Emergency Fund Plan', lastModified: '2024-01-05' },
  ];

  const handleLoadPlan = (planId: number) => {
    console.log(`Loading plan ${planId}`);
    onClose();
  };

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
            <h3 className="text-lg font-medium text-gray-900 mb-3">Saved Financial Plans</h3>
            {savedPlans.length > 0 ? (
              <div className="space-y-2">
                {savedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleLoadPlan(plan.id)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{plan.name}</p>
                      <p className="text-sm text-gray-500">Last modified: {plan.lastModified}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Load
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No saved plans yet</p>
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
