import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import type { OnboardingState } from '../contexts/AuthContext';

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
    key: 'envelopes',
    title: 'Budgeting',
    description: 'Create monthly budget envelopes',
    icon: '💰',
    action: 'Set Up Budget'
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

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({ className = '', onAuthRequired }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const { onboarding_state, advanceOnboardingStage, getOnboardingStateNumber} = useAuth();
  
  const currentStageIndex = getOnboardingStateNumber(onboarding_state);

  const handleStageClick = async (stageKey: string) => {
      console.log('handleStageClick', stageKey);
      const stageIndex = getOnboardingStateNumber(stageKey as OnboardingState);
    if (stageIndex === currentStageIndex) {
        const nextStage = await advanceOnboardingStage();
        if (nextStage === 'full' && onAuthRequired) {
            onAuthRequired();
        }
    }
  };

  const getStageStatus = (stageIndex: number) => {
    if (stageIndex < currentStageIndex) return 'completed';
    if (stageIndex === currentStageIndex) return 'current';
    if (stageIndex === currentStageIndex + 1) return 'next';
    return 'locked';
  };
  
  const progress = Math.round((currentStageIndex / (ONBOARDING_STAGES.length - 1)) * 100);
  const currentStage = ONBOARDING_STAGES[currentStageIndex];
  return (
    <div className={cn(
      'fixed bottom-4 left-4 z-50 transition-all duration-300 ease-in-out',
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
            'bg-gradient-to-r from-blue-50 to-blue-100',
            isExpanded ? 'border-b border-blue-200' : 'rounded-lg'
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
              <span className="text-lg">{currentStage.icon || '✨'}</span>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900">
                {isExpanded ? 'Your Progress' : currentStage.title}
              </h3>
              <p className="text-xs text-gray-600">
                {currentStageIndex} of {ONBOARDING_STAGES.length} steps complete
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 rounded-full bg-white/80 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? 
              <ChevronLeft className="h-4 w-4" /> : 
              <ChevronRight className="h-4 w-4" />
            }
          </Button>
        </div>
        
        {/* Progress Bar - Always visible */}
        <div className="px-3 pt-2 pb-1">
          <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span className="font-medium text-blue-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
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
              const isClickable = status === 'current' || status === 'next';
              const isCurrent = status === 'current';
              
              return (
                <div
                  key={stage.key}
                  className={cn(
                    'group flex items-center gap-3 transition-all duration-200',
                    isCurrent 
                      ? 'bg-blue-50 border border-blue-200' 
                      : status === 'completed'
                      ? 'bg-green-50 hover:bg-green-100 border border-green-100'
                      : status === 'next'
                      ? 'bg-white hover:bg-blue-50 border border-blue-100 cursor-pointer'
                      : 'bg-gray-50 border border-gray-100',
                    isClickable ? 'cursor-pointer' : 'cursor-default',
                    'py-2 px-3'
                  )}
                  onClick={() => isClickable && handleStageClick(stage.key)}
                >
                  <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg',
                    isCurrent 
                      ? 'bg-blue-100 text-blue-600' 
                      : status === 'completed'
                      ? 'bg-green-100 text-green-600'
                      : status === 'next'
                      ? 'bg-blue-50 text-blue-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                      : 'bg-gray-100 text-gray-400'
                  )}>
                    {stage.icon || (status === 'completed' ? '✓' : String(index + 1))}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-sm font-medium',
                      isCurrent 
                        ? 'text-blue-900' 
                        : status === 'completed'
                        ? 'text-green-800'
                        : status === 'next'
                        ? 'text-gray-900 group-hover:text-blue-800'
                        : 'text-gray-500'
                    )}>
                      {stage.title}
                    </div>
                    <div className={cn(
                      'text-xs',
                      isCurrent 
                        ? 'text-blue-700' 
                        : status === 'completed'
                        ? 'text-green-600'
                        : status === 'next'
                        ? 'text-gray-600 group-hover:text-blue-600'
                        : 'text-gray-400'
                    )}>
                      {stage.description}
                    </div>
                  </div>
                  
                  {isCurrent && (
                    <Button
                      size="sm"
                      variant="default"
                      className={cn('h-7 px-3 text-xs whitespace-nowrap bg-blue-600 hover:bg-blue-700')}
                      onClick={async (e: React.MouseEvent) => {
                        e.stopPropagation();
                        // If this is the last stage, trigger onAuthRequired
                        if (index === ONBOARDING_STAGES.length - 2 && onAuthRequired) {
                          await handleStageClick(stage.key, index);
                          onAuthRequired();
                        } else {
                          handleStageClick(stage.key, index);
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
  );
};

export default OnboardingProgress;
