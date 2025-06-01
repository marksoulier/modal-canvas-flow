
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Download, Cloud, FileText } from 'lucide-react';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose }) => {
  const [selectedOption, setSelectedOption] = useState('');

  const saveOptions = [
    {
      id: 'local',
      icon: Download,
      title: 'Save Locally',
      description: 'Download to your device',
      color: 'text-blue-500'
    },
    {
      id: 'cloud',
      icon: Cloud,
      title: 'Save to Cloud',
      description: 'Sync across all devices',
      color: 'text-green-500'
    },
    {
      id: 'export',
      icon: FileText,
      title: 'Export as File',
      description: 'Export in various formats',
      color: 'text-purple-500'
    }
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
              onClick={() => setSelectedOption(option.id)}
              className={`w-full flex items-center gap-3 p-4 text-left border rounded-lg transition-colors ${
                selectedOption === option.id
                  ? 'border-primary bg-accent'
                  : 'hover:bg-accent'
              }`}
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
          <Button
            disabled={!selectedOption}
            className="flex-1"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveModal;
