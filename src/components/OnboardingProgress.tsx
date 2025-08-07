import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import { cn } from '../lib/utils';
import type { OnboardingState } from '../contexts/AuthContext';
import VideoOnboardingModal from './VideoOnboardingModal';
import { onboardingVideoSegments } from '../data/videoLibrary';

interface OnboardingStage {
  key: string;
  title: string;
  description: string;
  icon: string;
  action?: string;
  completed?: boolean;
}

interface OnboardingProgressProps {
  className?: string;
  onAuthRequired?: () => void;
  onExitViewingMode?: () => void;
}

const ONBOARDING_STAGES: OnboardingStage[] = [
  {
    key: 'user_info',
    title: 'Welcome',
    description: 'Complete initial setup',
    completed: true,
    icon: '👋'
  },
  {
    key: 'basics',
    title: 'Basics',
    description: 'Set financial goals & personal info',
    completed: true,
    icon: '🎯'
  },
  {
    key: 'updating_events',
    title: 'Life Events',
    description: 'Add financial events & milestones',
    icon: '📅',
    action: 'Add Events'
  },
  {
    key: 'declare_accounts',
    title: 'Accounts',
    description: 'Set up account balances',
    icon: '🏦',
    action: 'Add Accounts'
  },
  {
    key: 'assets',
    title: 'Investments',
    description: 'Add investments & assets',
    icon: '📈',
    action: 'Add Assets'
  },
  {
    key: 'tax_system',
    title: 'Tax Settings',
    description: 'Configure tax settings',
    icon: '🧾',
    action: 'Configure'
  },
  {
    key: 'full',
    title: 'All Set!',
    description: 'Full access unlocked',
    icon: '🎉'
  }
] as const;

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({ className = '', onAuthRequired, onExitViewingMode }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedStageKey, setSelectedStageKey] = useState<string>('');
  const { onboarding_state, advanceOnboardingStage, getOnboardingStateNumber, updateOnboardingState } = useAuth();
  const { handleZoomToWindow } = usePlan();

  const currentStageIndex = getOnboardingStateNumber(onboarding_state);

  const handleStageClick = async (stageKey: string) => {
    console.log('handleStageClick', stageKey);

    // Special handling for tax_system stage - open exit viewing modal instead of advancing
    if (stageKey === 'tax_system') {
      console.log('🧾 Tax system stage clicked - opening exit viewing modal');
      if (onExitViewingMode) {
        onExitViewingMode();
      }
      return; // Don't proceed with normal stage advancement
    }

    // Handle zoom actions for stages that have them defined
    if (stageKey === 'basics') {
      console.log('🎯 Zooming to 1 month for basics stage');
      handleZoomToWindow({ months: 1 });
    }

    // Set the clicked stage as the current stage
    await updateOnboardingState(stageKey as OnboardingState);

    // Collapse the modal after clicking a valid stage
    setIsExpanded(false);

    //wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if this stage has video content
    const hasVideoContent = onboardingVideoSegments.some(segment => segment.stageKey === stageKey);

    if (hasVideoContent) {
      setSelectedStageKey(stageKey);
      setShowVideoModal(true);
      return;
    }
  };

  const handleVideoComplete = async () => {
    // Advance to the next stage after completing video content
    const stageIndex = getOnboardingStateNumber(selectedStageKey as OnboardingState);
    const nextStage = await advanceOnboardingStage();
    if (nextStage === 'full' && onAuthRequired) {
      onAuthRequired();
    }
  };

  const getStageStatus = (stageIndex: number) => {
    if (stageIndex < currentStageIndex) return 'completed';
    if (stageIndex === currentStageIndex) return 'current';
    if (stageIndex === currentStageIndex + 1) return 'next';
    return 'future';
  };

  const progress = Math.round((currentStageIndex / (ONBOARDING_STAGES.length - 1)) * 100);
  const currentStage = ONBOARDING_STAGES[currentStageIndex];
  return (
    <>
      <div className={cn(
        'fixed left-32 bottom-4 z-50 transition-all duration-300 ease-in-out',
        isExpanded ? 'w-80' : 'w-64',
        className
      )}>
        <Card className={cn(
          'w-full border-2 transition-all duration-300 rounded-none',
          isExpanded ? 'h-auto' : 'h-16 overflow-hidden',
        )}>
          <CardContent className={cn('p-0', isExpanded ? 'p-0' : 'p-0')}>
            {/* Header - Always visible */}
            <div
              className={cn(
                'p-3 flex items-center justify-between cursor-pointer',
                'bg-gradient-to-r from-[#03c6fc]/10 to-[#03c6fc]/5',
                isExpanded ? 'border-b border-[#03c6fc]/20' : 'rounded-lg'
              )}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#03c6fc]/20">
                  <span className="text-lg">{currentStage.icon || '✨'}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-900">
                    {isExpanded ? 'Your Progress' : currentStage.title}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {currentStageIndex + 1} of {ONBOARDING_STAGES.length} steps complete
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full bg-white/80 hover:bg-white border border-[#03c6fc]/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
              >
                {isExpanded ?
                  <ChevronLeft className="h-4 w-4 text-[#03c6fc]" /> :
                  <ChevronRight className="h-4 w-4 text-[#03c6fc]" />
                }
              </Button>
            </div>

            {/* Progress Bar - Always visible */}
            <div className="px-3 pt-2 pb-1">
              <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span className="font-medium text-[#03c6fc]">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-[#03c6fc] to-[#03c6fc]/80 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {ONBOARDING_STAGES.map((stage, index) => {
                  if (index > currentStageIndex + 2) return null; // Only show next 2 upcoming stages

                  const status = getStageStatus(index);
                  const isClickable = status === 'next';
                  const isCompleted = status === 'completed';
                  const isCurrent = status === 'current';

                  return (
                    <div
                      key={stage.key}
                      className={cn(
                        'group flex items-center gap-3 transition-all duration-200',
                        isCompleted
                          ? 'bg-green-50 hover:bg-green-100 border border-green-100'
                          : isCurrent
                            ? 'bg-[#03c6fc]/10 hover:bg-[#03c6fc]/20 border border-[#03c6fc]/30'
                            : 'bg-white hover:bg-[#03c6fc]/5 border border-[#03c6fc]/20',
                        isClickable ? 'cursor-pointer' : 'cursor-default',
                        'py-2 px-3'
                      )}
                      onClick={() => isClickable && handleStageClick(stage.key)}
                    >
                      <div className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg',
                        isCompleted
                          ? 'bg-green-100 text-green-600'
                          : isCurrent
                            ? 'bg-[#03c6fc] text-white'
                            : 'bg-[#03c6fc]/20 text-[#03c6fc] group-hover:bg-[#03c6fc] group-hover:text-white'
                      )}>
                        {stage.icon || (isCompleted ? '✓' : isCurrent ? '●' : String(index + 1))}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          'text-sm font-medium',
                          isCompleted
                            ? 'text-green-800'
                            : isCurrent
                              ? 'text-[#03c6fc]'
                              : 'text-gray-900 group-hover:text-[#03c6fc]'
                        )}>
                          {stage.title}
                        </div>
                        <div className={cn(
                          'text-xs',
                          isCompleted
                            ? 'text-green-600'
                            : isCurrent
                              ? 'text-[#03c6fc]/80'
                              : 'text-gray-600 group-hover:text-[#03c6fc]/80'
                        )}>
                          {stage.description}
                        </div>
                      </div>

                      {status === 'next' && (
                        <Button
                          size="sm"
                          variant="default"
                          className={cn('h-7 px-3 text-xs whitespace-nowrap bg-[#03c6fc] hover:bg-[#03c6fc]/90 text-white')}
                          onClick={async (e: React.MouseEvent) => {
                            e.stopPropagation();
                            // If this is the last stage, trigger onAuthRequired
                            if (index === ONBOARDING_STAGES.length - 2 && onAuthRequired) {
                              await handleStageClick(stage.key);
                              onAuthRequired();
                            } else {
                              handleStageClick(stage.key);
                            }
                          }}
                        >
                          Start
                        </Button>
                      )}
                    </div>
                  );
                })}

                {/* Next Steps Preview */}
                {currentStageIndex < ONBOARDING_STAGES.length - 3 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Up next:</p>
                    <div className="flex items-center gap-2">
                      {ONBOARDING_STAGES.slice(currentStageIndex + 2, currentStageIndex + 4).map((stage, i) => (
                        <div key={stage.key} className="flex-1 flex items-center gap-2 p-2 bg-gray-50 rounded-md border border-gray-100">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                            {currentStageIndex + 3 + i}
                          </div>
                          <span className="text-xs text-gray-600 truncate">{stage.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completion CTA */}
                {currentStageIndex >= ONBOARDING_STAGES.length - 3 && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-1">Almost there!</p>
                    <p className="text-xs text-green-700">Complete setup to unlock all features</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Video Onboarding Modal */}
      <VideoOnboardingModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        onComplete={handleVideoComplete}
        stageKey={selectedStageKey}
      />
    </>
  );
};

export default OnboardingProgress;
