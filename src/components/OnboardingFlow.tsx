import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
// import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent } from './ui/card';
import { DollarSign, Target, Home, Plane, TrendingUp, PiggyBank, Building, Wallet, Shield, Sparkles } from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import DatePicker from './DatePicker';

interface OnboardingFlowProps {
  isOpen: boolean;
  onComplete: () => void;
  onAuthRequired: () => void;
  onAddEventAndEditParams: (eventType: string) => void;
}

interface OnboardingData {
  goals: string[];
  financialGoals: string[];
  name: string;
  birthDate: string;
  location: string;
  education: string;
  educationField: string;
  onboarding_state?: string;
}

//

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ isOpen, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData & { _currentStep?: number }>({
    goals: [],
    financialGoals: [],
    name: '',
    birthDate: '',
    location: '',
    education: '',
    educationField: '',
    onboarding_state: 'user_info',
    _currentStep: 0,
  });
  const [loading, setLoading] = useState(true);
  const { upsertAnonymousOnboarding, fetchAnonymousOnboarding, logAnonymousButtonClick } = useAuth();
  const { updateBirthDate, updateLocation, updateDegree, updateOccupation, updateGoals } = usePlan();

  // Fetch onboarding data on mount
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const anonData = await fetchAnonymousOnboarding();
      if (anonData && mounted && anonData.onboarding_data) {
        setData((prev) => ({ ...prev, ...anonData.onboarding_data }));
        // If the fetched data has a _currentStep, set the step
        if (typeof anonData.onboarding_data._currentStep === 'number') {
          setCurrentStep(anonData.onboarding_data._currentStep);
        }
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [fetchAnonymousOnboarding]);

  // Save onboarding data on every change, including currentStep
  React.useEffect(() => {
    if (!loading) {
      upsertAnonymousOnboarding({ ...data, _currentStep: currentStep });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentStep]);

  const totalSteps = 4;  // Reduced to only the first 4 steps

  const handleNext = async () => {

    // After step 3 (personal info), save all user data to plan
    if (currentStep === 3) {
      // Check for invalid birth date or today or in the future
      if (data.birthDate === '' || data.birthDate === new Date().toISOString().split('T')[0] || data.birthDate > new Date().toISOString().split('T')[0]) {
        toast.error('Please enter a valid birth date');
        return;
      }

      const newBirthDate = new Date(data.birthDate);
      const birthDateString = newBirthDate.toISOString().split('T')[0];
      console.log("birthDateString", birthDateString);

      // Update birth date
      updateBirthDate(birthDateString);

      // Update location
      if (data.location) {
        updateLocation(data.location);
      }

      // Combine education level and field for degree
      const degreeString = data.education && data.educationField
        ? `${data.education} in ${data.educationField}`
        : data.education || data.educationField || '';
      if (degreeString) {
        updateDegree(degreeString);
      }

      // Use education field as occupation
      if (data.educationField) {
        updateOccupation(data.educationField);
      }

      // Combine all goals into a single string
      const allGoals = [
        ...data.goals.map(goal => {
          switch (goal) {
            case 'understanding': return 'Better understanding of current finances';
            case 'management': return 'Better asset management';
            case 'budgeting': return 'Budgeting';
            case 'peace': return 'Peace of mind';
            default: return goal;
          }
        }),
        ...data.financialGoals.map(goal => {
          switch (goal) {
            case 'house': return 'Buying a house';
            case 'retirement': return 'Comfortable retirement';
            case 'vacation': return 'Dream vacation';
            case 'aspirations': return 'Other financial aspirations';
            default: return goal;
          }
        })
      ].join(', ');

      if (allGoals) {
        updateGoals(allGoals);
      }
    }

    // Move to next step or finish
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // When completing the modal, transition from 'user_info' to 'basics' to start progressive access
      console.log('🎯 MODAL COMPLETED - Transitioning from user_info to basics');
      if (logAnonymousButtonClick) {
        await logAnonymousButtonClick('modal_completed');
      }
      // Close the modal and let the user continue with progressive onboarding
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGoalToggle = (goal: string) => {
    setData(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal]
    }));
  };

  const handleFinancialGoalToggle = (goal: string) => {
    setData(prev => ({
      ...prev,
      financialGoals: prev.financialGoals.includes(goal)
        ? prev.financialGoals.filter(g => g !== goal)
        : [...prev.financialGoals, goal]
    }));
  };



  const steps = [
    // Step 1: Welcome
    {
      title: "Welcome to Lever Financial Planner",
      content: (
        <div className="relative">
          <div className="text-center space-y-8 relative z-10">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center backdrop-blur-sm border border-primary/10">
              <TrendingUp className="w-12 h-12 text-primary" />
            </div>

            <div className="space-y-6">
              <p className="text-lg text-muted-foreground font-light leading-relaxed max-w-2xl mx-auto">
                A sophisticated tool designed for individuals to model and visualize their financial future with confidence and clarity.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                <div className="bg-gradient-to-br from-background to-muted/30 p-6 rounded-xl border border-border/50 hover:border-[#03c6fc]/20 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-[#03c6fc]/10 rounded-lg">
                      <Target className="w-6 h-6 text-[#03c6fc]" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-foreground mb-2">Scenario Planning</h4>
                      <p className="text-sm text-muted-foreground">Test "what if" situations and explore different financial paths</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-background to-muted/30 p-6 rounded-xl border border-border/50 hover:border-[#03c6fc]/20 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-[#03c6fc]/10 rounded-lg">
                      <Sparkles className="w-6 h-6 text-[#03c6fc]" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-foreground mb-2">Retirement Planning</h4>
                      <p className="text-sm text-muted-foreground">Find the optimal path to retirement and financial freedom</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-background to-muted/30 p-6 rounded-xl border border-border/50 hover:border-[#03c6fc]/20 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-[#03c6fc]/10 rounded-lg">
                      <Shield className="w-6 h-6 text-[#03c6fc]" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-foreground mb-2">Peace of Mind</h4>
                      <p className="text-sm text-muted-foreground">Stay informed about changes that may affect your financial plan</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-background to-muted/30 p-6 rounded-xl border border-border/50 hover:border-[#03c6fc]/20 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-[#03c6fc]/10 rounded-lg">
                      <Building className="w-6 h-6 text-[#03c6fc]" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-foreground mb-2">Market Simulation</h4>
                      <p className="text-sm text-muted-foreground">Simulate thousands of future market conditions and stress-test your plan</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Step 2: What they hope to gain
    {
      title: "What do you hope to gain from this tool?",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground text-center mb-6">
            Select all that apply to your goals:
          </p>
          <div className="grid grid-cols-1 gap-3">
            {[
              { id: 'understanding', label: 'Better understanding of my current finances', icon: DollarSign },
              { id: 'management', label: 'Explore opportunities for better asset management', icon: TrendingUp },
              { id: 'budgeting', label: 'Budgeting Tool', icon: Wallet },
              { id: 'peace', label: 'Peace of mind', icon: Shield }
            ].map(({ id, label, icon: Icon }) => (
              <Card key={id} className={`cursor-pointer transition-all ${data.goals.includes(id) ? 'ring-2 ring-[#03c6fc] bg-[#03c6fc]/5' : 'hover:bg-muted/50'}`} onClick={() => handleGoalToggle(id)}>
                <CardContent className="flex items-center p-4">
                  <Icon className="w-5 h-5 mr-3 text-[#03c6fc]" />
                  <span className="flex-1">{label}</span>
                  <Checkbox checked={data.goals.includes(id)} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )
    },
    // Step 3: Financial Goals
    {
      title: "What are your financial goals?",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground text-center mb-6">
            What are you working towards?
          </p>
          <div className="grid grid-cols-1 gap-3">
            {[
              { id: 'house', label: 'Buying a House', icon: Home },
              { id: 'retirement', label: 'Retiring Comfortably', icon: PiggyBank },
              { id: 'vacation', label: 'Dream Vacation', icon: Plane },
              { id: 'aspirations', label: 'Other Financial Aspirations', icon: Target }
            ].map(({ id, label, icon: Icon }) => (
              <Card key={id} className={`cursor-pointer transition-all ${data.financialGoals.includes(id) ? 'ring-2 ring-[#03c6fc] bg-[#03c6fc]/5' : 'hover:bg-muted/50'}`} onClick={() => handleFinancialGoalToggle(id)}>
                <CardContent className="flex items-center p-4">
                  <Icon className="w-5 h-5 mr-3 text-[#03c6fc]" />
                  <span className="flex-1">{label}</span>
                  <Checkbox checked={data.financialGoals.includes(id)} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )
    },
    // Step 4: Personal Information
    {
      title: "Create Your Financial Plan",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground text-center mb-6">
            Help us personalize your experience
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={data.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter your name"
              />
            </div>
            <div>
              <Label htmlFor="birthDate">Birth Date</Label>
              <DatePicker
                value={data.birthDate}
                onChange={(date) => setData(prev => ({ ...prev, birthDate: date || '' }))}
                showAgeInput={false}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used to calculate changes in net worth at age 59½ due to tax advantage accounts
              </p>
            </div>
            <div>
              <Label htmlFor="location">City Location</Label>
              <Input
                id="location"
                value={data.location}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., San Francisco, CA"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used for finding local financial metrics (cost of living, mortgage rates, etc.)
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="education">Education Level</Label>
                <select
                  id="education"
                  value={data.education}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setData(prev => ({ ...prev, education: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 mt-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select education level</option>
                  <option value="High School">High School</option>
                  <option value="Associate's">Associate's Degree</option>
                  <option value="Bachelor's">Bachelor's Degree</option>
                  <option value="Master's">Master's Degree</option>
                  <option value="Doctorate">Doctorate (PhD, MD, etc.)</option>
                  <option value="Other">Other</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Used to get estimates on salary and job reports.
                </p>
              </div>
              <div>
                <Label htmlFor="educationField">Degree or Field of Study</Label>
                <Input
                  id="educationField"
                  value={data.educationField}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData(prev => ({ ...prev, educationField: e.target.value }))}
                  placeholder="e.g., Computer Science, Business, Engineering"
                  className="w-full mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used to personalize job and salary estimates.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentStepData = steps[currentStep];

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-2xl max-w-4xl mx-8">
          <DialogHeader>
            <DialogTitle className="sr-only">Loading Onboarding</DialogTitle>
          </DialogHeader>
          <div className="py-16 text-center text-lg">Loading your onboarding progress...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => { }}>
      <DialogContent className="sm:max-w-2xl max-w-4xl mx-8">
        <DialogHeader className="space-y-6">
          <DialogTitle className="text-center text-2xl font-light">
            {currentStepData.title}
          </DialogTitle>
          <div className="flex justify-center">
            <div className="flex space-x-3">
              {Array.from({ length: totalSteps }).map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${index <= currentStep ? 'bg-[#03c6fc] shadow-lg' : 'bg-muted'
                    }`}
                />
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="py-8 px-2">
          {currentStepData.content}
        </div>

        <div className="flex justify-between pt-6">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="px-8"
            >
              Back
            </Button>
          )}
          {currentStep === 0 && <div></div>}
          <Button onClick={handleNext} className="px-8">
            {currentStep === totalSteps - 1 ? 'Lets Go!' : currentStep === 0 ? 'Begin Journey' : 'Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingFlow;