
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { BookOpen, MessageCircle, Mail } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help & Support</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <button className="w-full flex items-center gap-3 p-4 text-left border rounded-lg hover:bg-accent transition-colors">
            <BookOpen size={20} className="text-blue-500" />
            <div>
              <div className="font-medium">Documentation</div>
              <div className="text-sm text-muted-foreground">Learn how to use the app</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 p-4 text-left border rounded-lg hover:bg-accent transition-colors">
            <MessageCircle size={20} className="text-green-500" />
            <div>
              <div className="font-medium">Live Chat</div>
              <div className="text-sm text-muted-foreground">Chat with our support team</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 p-4 text-left border rounded-lg hover:bg-accent transition-colors">
            <Mail size={20} className="text-purple-500" />
            <div>
              <div className="font-medium">Email Support</div>
              <div className="text-sm text-muted-foreground">Send us an email</div>
            </div>
          </button>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground text-center">
            Need immediate assistance? Check our FAQ section.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpModal;
