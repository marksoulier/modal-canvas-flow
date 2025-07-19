import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Download, Cloud } from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowAuth?: () => void;
}

const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose, onShowAuth }) => {
  const [selectedOption, setSelectedOption] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { savePlanToFile, plan } = usePlan();
  const { user } = useAuth();

  const saveToCloud = async () => {
    if (!user || !plan) {
      toast.error('Unable to save: User not logged in or no plan data');
      return;
    }

    setIsSaving(true);
    try {
      // First check if user has a plan already
      const { data: existingPlans } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (existingPlans && existingPlans.length > 0) {
        // Update existing plan
        const { error } = await supabase
          .from('plans')
          .update({
            plan_data: plan,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new plan
        const { error } = await supabase
          .from('plans')
          .insert({
            user_id: user.id,
            plan_data: plan,
          });

        if (error) throw error;
      }
      
      toast.success('Plan saved to cloud successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving to cloud:', error);
      toast.error('Failed to save plan to cloud. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloudSaveClick = () => {
    if (!user && onShowAuth) {
      onShowAuth();
      onClose();
    } else {
      saveToCloud();
    }
  };

  const saveOptions = [
    {
      id: 'local',
      icon: Download,
      title: 'Save Locally',
      description: 'Download to your device',
      color: 'text-blue-500',
      onClick: () => {
        savePlanToFile();
        onClose();
      }
    },
    {
      id: 'cloud',
      icon: Cloud,
      title: 'Save to Cloud',
      description: !user ? 'Sign in to save to cloud' : 'Store your plan in the cloud',
      color: 'text-green-500',
      disabled: false,
      onClick: handleCloudSaveClick
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Options</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {saveOptions.map((option) => (
            <button
              key={option.id}
              onClick={option.onClick}
              disabled={isSaving}
              className={`w-full flex items-center gap-3 p-4 text-left border rounded-lg transition-colors hover:bg-accent
                ${!user && option.id === 'cloud' ? 'opacity-75' : ''}`}
            >
              <option.icon size={20} className={option.color} />
              <div>
                <div className="font-medium">{option.title}</div>
                <div className="text-sm text-muted-foreground">{option.description}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveModal;
