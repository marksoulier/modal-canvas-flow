
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { BookOpen, MessageCircle, Mail, Play } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import demoVideo from '../data/demo-video.mp4';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Help & Support</DialogTitle>
        </DialogHeader>

        {!showVideo ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowVideo(true)}
              className="w-full flex items-center gap-3 p-4 text-left border rounded-lg hover:bg-accent transition-colors"
            >
              <Play size={20} className="text-red-500" />
              <div>
                <div className="font-medium">Watch Demo Video</div>
                <div className="text-sm text-muted-foreground">See how to use the application</div>
              </div>
            </button>

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
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Application Demo</h3>
              <button
                onClick={() => setShowVideo(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to Help
              </button>
            </div>

            <VideoPlayer
              src={demoVideo}
              title="How to use the application"
              className="w-full aspect-video"
            />

            <div className="text-sm text-gray-600">
              <p className="mb-2">This demo shows the key features of the application:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Adding events to your timeline</li>
                <li>Managing envelopes and budgets</li>
                <li>Navigating the visualization</li>
                <li>Using the planning tools</li>
              </ul>
            </div>
          </div>
        )}

        {!showVideo && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              Need immediate assistance? Check our FAQ section.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HelpModal;
