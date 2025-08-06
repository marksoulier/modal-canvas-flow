import { useAuth } from '../contexts/AuthContext';

// Define what features are available at each onboarding stage
const STAGE_FEATURES = {
  user_info: {
    canViewPlan: false,
    canEditEnvelopes: false,
    canAddEvents: false,
    canManageAccounts: false,
    canViewAssets: false,
    canConfigureTax: false,
    showOnboardingProgress: false
  },
  basics: {
    canViewPlan: true,
    canEditEnvelopes: false,
    canAddEvents: false,
    canManageAccounts: false,
    canViewAssets: false,
    canConfigureTax: false,
    showOnboardingProgress: false
  },
  envelopes: {
    canViewPlan: true,
    canEditEnvelopes: true,
    canAddEvents: false,
    canManageAccounts: false,
    canViewAssets: false,
    canConfigureTax: false,
    showOnboardingProgress: true
  },
  updating_events: {
    canViewPlan: true,
    canEditEnvelopes: true,
    canAddEvents: true,
    canManageAccounts: false,
    canViewAssets: false,
    canConfigureTax: false,
    showOnboardingProgress: true
  },
  declare_accounts: {
    canViewPlan: true,
    canEditEnvelopes: true,
    canAddEvents: true,
    canManageAccounts: true,
    canViewAssets: false,
    canConfigureTax: false,
    showOnboardingProgress: true
  },
  assets: {
    canViewPlan: true,
    canEditEnvelopes: true,
    canAddEvents: true,
    canManageAccounts: true,
    canViewAssets: true,
    canConfigureTax: false,
    showOnboardingProgress: true
  },
  tax_system: {
    canViewPlan: true,
    canEditEnvelopes: true,
    canAddEvents: true,
    canManageAccounts: true,
    canViewAssets: true,
    canConfigureTax: true,
    showOnboardingProgress: true
  },
  full: {
    canViewPlan: true,
    canEditEnvelopes: true,
    canAddEvents: true,
    canManageAccounts: true,
    canViewAssets: true,
    canConfigureTax: true,
    showOnboardingProgress: false
  }
} as const;

export const useOnboardingStage = () => {
  const { onboarding_state, updateOnboardingState, getOnboardingStateNumber } = useAuth();
  
  const currentStage = onboarding_state;
  const currentStageIndex = getOnboardingStateNumber(currentStage);
  const features = STAGE_FEATURES[currentStage] || STAGE_FEATURES.user_info;
  
  const isStageUnlocked = (stage: keyof typeof STAGE_FEATURES) => {
    const stageIndex = getOnboardingStateNumber(stage);
    return stageIndex <= currentStageIndex;
  };
  
  const canAccessFeature = (feature: keyof typeof STAGE_FEATURES.full) => {
    return features[feature];
  };
  
  const progressToNextStage = async () => {
    const stages = Object.keys(STAGE_FEATURES) as Array<keyof typeof STAGE_FEATURES>;
    const nextStageIndex = currentStageIndex + 1;
    
    if (nextStageIndex < stages.length) {
      const nextStage = stages[nextStageIndex];
      await updateOnboardingState(nextStage);
      return nextStage;
    }
    
    return null;
  };
  
  const getStageProgress = () => {
    const totalStages = Object.keys(STAGE_FEATURES).length;
    return {
      current: currentStageIndex + 1,
      total: totalStages,
      percentage: Math.round(((currentStageIndex + 1) / totalStages) * 100)
    };
  };
  
  return {
    currentStage,
    currentStageIndex,
    features,
    isStageUnlocked,
    canAccessFeature,
    progressToNextStage,
    getStageProgress,
    isCompleted: currentStage === 'full'
  };
};

export default useOnboardingStage;
