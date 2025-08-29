import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Mail, Play, ChevronLeft, ChevronRight, Video, BookOpen, Wrench, RefreshCw } from 'lucide-react';
import BaseVideoModal from './BaseVideoModal';
import { getAllVideos, getVideosByCategory, videoCategories } from '../data/videoLibrary';
import type { VideoItem, VideoCategory } from '../data/videoLibrary';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestartOnboarding?: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, onRestartOnboarding }) => {
  const [showVideo, setShowVideo] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('getting-started');
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showOnboardingConfirm, setShowOnboardingConfirm] = useState(false);

  const categoryVideos = getVideosByCategory(selectedCategory);
  const allVideos = getAllVideos();

  // Handle keyboard navigation when in video view
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showVideo || !isOpen) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateToPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateToNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showVideo, isOpen, currentVideoIndex]);

  const navigateToPrevious = () => {
    setCurrentVideoIndex(prev => prev > 0 ? prev - 1 : allVideos.length - 1);
    setSelectedVideo(allVideos[currentVideoIndex > 0 ? currentVideoIndex - 1 : allVideos.length - 1]);
  };

  const navigateToNext = () => {
    setCurrentVideoIndex(prev => prev < allVideos.length - 1 ? prev + 1 : 0);
    setSelectedVideo(allVideos[currentVideoIndex < allVideos.length - 1 ? currentVideoIndex + 1 : 0]);
  };

  const handleVideoSelect = (video: VideoItem) => {
    setSelectedVideo(video);
    setCurrentVideoIndex(allVideos.findIndex(v => v.id === video.id));
    setShowVideo(true);
  };

  const handleBackToHelp = () => {
    setShowVideo(false);
    setSelectedVideo(null);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowContact(false);
  };

  const handleContactSelect = () => {
    setShowContact(true);
    setSelectedCategory('');
  };

  const handleRestartOnboarding = () => {
    if (onRestartOnboarding) {
      onRestartOnboarding();
      onClose(); // Close the help modal after starting onboarding
    }
  };

  const handleOnboardingConfirm = () => {
    setShowOnboardingConfirm(false);
    handleRestartOnboarding();
  };

  // Sidebar items matching UserAccountModal pattern
  const sidebarItems = [
    { id: 'getting-started', label: 'Getting Started', icon: BookOpen },
    { id: 'advanced', label: 'Advanced Features', icon: Video },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: Wrench },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-5xl h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle>Help & Support</DialogTitle>
          </DialogHeader>

          {!showVideo ? (
            <div className="flex-1 flex min-h-0">
              {/* Sidebar */}
              <div className="w-64 bg-muted/30 border-r border-border p-6 overflow-y-auto">
                <nav className="space-y-2">
                  {sidebarItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleCategorySelect(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${selectedCategory === item.id
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
                  <button
                    onClick={handleContactSelect}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${showContact
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>Contact Support</span>
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 p-8 overflow-y-auto">
                {showContact ? (
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold mb-4 text-foreground">Contact & Support</h3>

                    {/* Contact Information */}
                    <div className="bg-muted/30 rounded-lg p-6">
                      <div className="text-center space-y-4">
                        <div className="text-lg font-medium">Need Help?</div>
                        <div className="text-muted-foreground">Email our support team</div>
                        <div className="text-xl font-semibold text-primary">
                            contact@lever-ai.com
                        </div>
                      </div>
                    </div>

                    {/* Onboarding Restart Section */}
                    {onRestartOnboarding && (
                      <div className="bg-muted/30 rounded-lg p-6">
                        <div className="space-y-4">
                          <div className="text-center">
                            <div className="text-lg font-medium mb-2">Start Over</div>
                            <div className="text-muted-foreground text-sm mb-4">
                              Need to restart the setup process? This will guide you through the initial configuration again.
                            </div>
                          </div>

                          {!showOnboardingConfirm ? (
                            <button
                              onClick={() => setShowOnboardingConfirm(true)}
                              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                              <span>Restart Onboarding</span>
                            </button>
                          ) : (
                            <div className="space-y-3">
                              <div className="text-center text-sm text-muted-foreground">
                                Are you sure you want to restart the onboarding process?
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={handleOnboardingConfirm}
                                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                >
                                  Yes, Restart
                                </button>
                                <button
                                  onClick={() => setShowOnboardingConfirm(false)}
                                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold mb-4 text-foreground">
                      {sidebarItems.find(item => item.id === selectedCategory)?.label || 'Videos'}
                    </h3>
                    <div className="grid gap-4">
                      {categoryVideos.map((video) => (
                        <button
                          key={video.id}
                          onClick={() => handleVideoSelect(video)}
                          className="flex items-start gap-4 p-4 text-left border rounded-lg hover:bg-accent transition-colors bg-card"
                        >
                          <Play size={20} className="text-primary mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-medium text-foreground">{video.title}</div>
                            <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {video.description.split('\n')[0].replace(/^# /, '')}
                            </div>
                            {video.duration && (
                              <div className="text-xs text-muted-foreground mt-2 bg-muted px-2 py-1 rounded inline-block">
                                {video.duration}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Video Navigation Header */}
              <div className="flex justify-between items-center p-4 border-b bg-background">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleBackToHelp}
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    ← Back to Help
                  </button>
                  <div className="text-sm text-muted-foreground">
                    {currentVideoIndex + 1} of {allVideos.length}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={navigateToPrevious}
                    className="p-2 rounded-lg border hover:bg-accent transition-colors"
                    title="Previous video (←)"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={navigateToNext}
                    className="p-2 rounded-lg border hover:bg-accent transition-colors"
                    title="Next video (→)"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Navigation Hint */}
              <div className="text-center pt-6 border-t">
                <div className="text-xs text-muted-foreground">
                  Use ← → arrow keys or buttons above to navigate between videos
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Video Modal using BaseVideoModal */}
      <BaseVideoModal
        isOpen={showVideo}
        onClose={handleBackToHelp}
        videos={allVideos}
        title={selectedVideo?.title}
        description="Help & Support Videos"
        showSkipButton={false}
        showFinishButton={false}
        showProgressDots={false}
      />
    </>
  );
};

export default HelpModal;
