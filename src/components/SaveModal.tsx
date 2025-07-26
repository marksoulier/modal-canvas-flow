import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Download, Cloud, Camera, Loader2 } from 'lucide-react';
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
  const [isCapturing, setIsCapturing] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [conflictPlanName, setConflictPlanName] = useState('');
  const [capturedPlanImage, setCapturedPlanImage] = useState<string | undefined>(undefined);
  const { savePlanToFile, plan, captureVisualizationAsSVG } = usePlan();
  const { user, savePlanToCloud, confirmOverwritePlan } = useAuth();

  const saveToCloudWithImage = async () => {
    console.log('saveToCloudWithImage');
    if (!plan) {
      toast.error('No plan to save');
      return;
    }

    if (!plan.title || !plan.title.trim()) {
      toast.error('Please set a plan title before saving');
      return;
    }

    setIsCapturing(true);
    try {
      // Capture the visualization as SVG
      const planSVG = captureVisualizationAsSVG();

      if (!planSVG) {
        toast.error('Failed to capture visualization SVG');
        return;
      }

      console.log('planSVG', planSVG);
      setCapturedPlanImage(planSVG);

      setIsCapturing(false);
      setIsSaving(true);

      // Save the plan with the SVG
      const result = await savePlanToCloud(plan, planSVG);

      if (result.success) {
        toast.success('Plan saved successfully with image!');
        onClose();
      } else if (result.requiresConfirmation && result.existingPlanName) {
        setConflictPlanName(result.existingPlanName);
        setShowOverwriteDialog(true);
      } else {
        toast.error('Failed to save plan');
      }
    } catch (error: any) {
      console.error('Error saving plan with image:', error);
      toast.error('Failed to save plan with image');
    } finally {
      setIsCapturing(false);
      setIsSaving(false);
    }
  };

  const handleOverwriteConfirm = async () => {
    if (!plan || !conflictPlanName) return;

    setShowOverwriteDialog(false);
    setIsSaving(true);

    try {
      const success = await confirmOverwritePlan(plan, conflictPlanName, capturedPlanImage);
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
    setCapturedPlanImage(undefined);
  };

  const handleCloudSaveClick = () => {
    if (!user && onShowAuth) {
      onShowAuth();
      onClose();
    } else {
      saveToCloudWithImage();
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
                disabled={isSaving || isCapturing}
                className={`w-full flex items-center gap-3 p-4 text-left border rounded-lg transition-colors hover:bg-accent
                ${!user && (option.id === 'cloud' || option.id === 'cloud-with-image') ? 'opacity-75' : ''}`}
              >
                {isCapturing && option.id === 'cloud-with-image' ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <option.icon size={20} className={option.color} />
                )}
                <div>
                  <div className="font-medium">
                    {isCapturing && option.id === 'cloud-with-image' ? 'Capturing...' : option.title}
                  </div>
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
