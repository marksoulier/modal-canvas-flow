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
import { toast } from 'sonner';
import OverwriteConfirmDialog from './OverwriteConfirmDialog';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowAuth?: () => void;
}

const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose, onShowAuth }) => {
  const [selectedOption, setSelectedOption] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [conflictPlanName, setConflictPlanName] = useState('');
  const { savePlanToFile, plan } = usePlan();
  const { user, savePlanToCloud, confirmOverwritePlan } = useAuth();

  const saveToCloud = async () => {
    if (!plan) {
      toast.error('No plan data to save');
      return;
    }

    setIsSaving(true);
    try {
      const result = await savePlanToCloud(plan);

      if (result.success) {
        onClose();
      } else if (result.requiresConfirmation && result.existingPlanName) {
        setConflictPlanName(result.existingPlanName);
        setShowOverwriteDialog(true);
      }
    } catch (error: any) {
      console.error('Error saving to cloud:', error);
      toast.error('Failed to save plan to cloud. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverwriteConfirm = async () => {
    if (!plan || !conflictPlanName) return;

    setShowOverwriteDialog(false);
    setIsSaving(true);

    try {
      const success = await confirmOverwritePlan(plan, conflictPlanName);
      if (success) {
        onClose();
      }
    } catch (error: any) {
      console.error('Error overwriting plan:', error);
      toast.error('Failed to overwrite plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverwriteCancel = () => {
    setShowOverwriteDialog(false);
    setConflictPlanName('');
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
    <>
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

      {/* Overwrite Confirmation Dialog */}
      <OverwriteConfirmDialog
        isOpen={showOverwriteDialog}
        onClose={handleOverwriteCancel}
        onConfirm={handleOverwriteConfirm}
        planName={conflictPlanName}
      />
    </>
  );
};

export default SaveModal;
