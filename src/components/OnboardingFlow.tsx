import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Target, Home, Plane, Users, Coffee, TrendingUp, PiggyBank, Building, CreditCard, Wallet, Shield, Leaf, Mountain, Sparkles } from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getDaysFromAge, getAgeFromDays } from '../visualization/viz_utils';

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
  budgetCategories: Record<string, number>;
  accounts: Record<string, number>;
  retirementAge?: number;
  retirementGoal?: number;
  monthlyRetirementIncome?: number;
  retirementStartDay?: number;
  writtenFinancialGoal?: string;
}

const CATEGORY_BASE_COLORS: Record<string, string> = {
  'Savings': '#FFC107', // Yellow
  'Investments': '#00BCD4', // Cyan
  'Income': '#FF9800', // Orange
  'Retirement': '#9C27B0', // Purple
  'Debt': '#F44336', // Red
  'Cash': '#4CAF50', // Green
  'Assets': '#888888', // Grey
};

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ isOpen, onComplete, onAuthRequired, onAddEventAndEditParams }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData & { _currentStep?: number }>({
    goals: [],
    financialGoals: [],
    name: '',
    birthDate: '',
    location: '',
    education: '',
    educationField: '',
    budgetCategories: {
      housing: 0,
      food: 0,
      transportation: 0,
      utilities: 0,
      entertainment: 0,
      healthcare: 0,
      other: 0
    },
    accounts: {
      cash: 0,
      debt: 0,
      assets: 0,
      savings: 0,
      investments: 0,
      retirement: 0
    },
    _currentStep: 0,
  });
  const [loading, setLoading] = useState(true);
  const { upsertAnonymousOnboarding, fetchAnonymousOnboarding, logAnonymousButtonClick } = useAuth();
  const { addEvent, hasEventType, plan, getEventDisplayType, getEventIcon, updateBirthDate, updateRetirementGoal } = usePlan();

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
      const { onboarding_data, extra_data, ...flatData } = data;
      upsertAnonymousOnboarding({ ...flatData, _currentStep: currentStep });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentStep]);

  const handleAddInitialEvent = (eventType: string) => {
    onAddEventAndEditParams(eventType);
  };

  const totalSteps = 9;  // Updated from 8 to 9

  const handleNext = async () => {

    // After modal 3 I want to save their birthdate to the plan and then save their location to usa_tax_

    if (currentStep === 3) {

      // Update birth date in plan
      //Calculate days from current birth date to the new birth date

      // Check for invalid birth date or today or in the future
      if (data.birthDate === '' || data.birthDate === new Date().toISOString().split('T')[0] || data.birthDate > new Date().toISOString().split('T')[0]) {
        toast.error('Please enter a valid birth date');
        return;
      }

      const currentBirthDate = new Date(plan?.birth_date || new Date());
      const newBirthDate = new Date(data.birthDate);
      const daysFromCurrentBirthDate = Math.floor((newBirthDate.getTime() - currentBirthDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log("daysFromCurrentBirthDate", daysFromCurrentBirthDate);


      updateBirthDate(daysFromCurrentBirthDate);

      // Add usa_tax_system event
      addEvent("usa_tax_system", {
        start_time: 0,
        location: data.location
      }, true);
    }
    // After monthly budget step (step 5, index 4)
    if (currentStep === 4) {
      const monthlyBudgetingParams = {
        end_time: 29200,
        frequency_days: 30,
        from_key: "Other (Cash)",
        groceries: data.budgetCategories.food,
        utilities: data.budgetCategories.utilities,
        rent: data.budgetCategories.housing,
        transportation: data.budgetCategories.transportation,
        insurance: 0,
        healthcare: data.budgetCategories.healthcare,
        dining_out: 0,
        entertainment: data.budgetCategories.entertainment,
        personal_care: 0,
        miscellaneous: data.budgetCategories.other
      };
      // Check if monthly_budgeting event already exists and replace it
      // The third parameter (true) tells addEvent to delete existing events of this type first
      addEvent("monthly_budgeting", monthlyBudgetingParams, true);
    }

    // After account balances step (step 6, index 5)
    if (currentStep === 5) {
      const declareAccountsParams = {
        end_time: 36500,
        frequency_days: 365,
        amount1: data.accounts.cash,
        envelope1: "Other (Cash)",
        amount2: data.accounts.savings,
        envelope2: "Other (Savings)",
        amount3: data.accounts.investments,
        envelope3: "Other (Investments)",
        amount4: data.accounts.retirement,
        envelope4: "Other (Retirement)",
        amount5: -Math.abs(data.accounts.debt), // Convert debt to negative
        envelope5: "Other (Debt)"
      };
      // Check if declare_accounts event already exists and replace it
      // The third parameter (true) tells addEvent to delete existing events of this type first
      addEvent("declare_accounts", declareAccountsParams, true);
    }

    // After retirement planning step (step 8, index 7)
    if (currentStep === 7) {
      // Add retirement event
      const retirementParams = {
        start_time: data.retirementStartDay || 0,
        end_time: 36500,
        amount: data.monthlyRetirementIncome || 3000,
        amount_roth_ira: 0,
      };

      // Update retirement goal in plan
      if (data.retirementGoal) {
        updateRetirementGoal(data.retirementGoal);
      }

      // Add retirement event if retirement age is set
      if (data.retirementAge) {
        addEvent("retirement", retirementParams, true);
      }
    }

    // Move to next step or finish
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      if (logAnonymousButtonClick) {
        await logAnonymousButtonClick('create_account');
      }
      onAuthRequired();
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

  const updateBudgetCategory = (category: string, value: number) => {
    setData(prev => ({
      ...prev,
      budgetCategories: {
        ...prev.budgetCategories,
        [category]: value
      }
    }));
  };

  const updateAccount = (account: string, value: number) => {
    // Ensure all input values are positive
    const positiveValue = Math.abs(value);
    setData(prev => ({
      ...prev,
      accounts: {
        ...prev.accounts,
        [account]: positiveValue
      }
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
                <div className="bg-gradient-to-br from-background to-muted/30 p-6 rounded-xl border border-border/50 hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Target className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-foreground mb-2">Scenario Planning</h4>
                      <p className="text-sm text-muted-foreground">Test "what if" situations and explore different financial paths</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-background to-muted/30 p-6 rounded-xl border border-border/50 hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Sparkles className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-foreground mb-2">Retirement Planning</h4>
                      <p className="text-sm text-muted-foreground">Find the optimal path to retirement and financial freedom</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-background to-muted/30 p-6 rounded-xl border border-border/50 hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-foreground mb-2">Peace of Mind</h4>
                      <p className="text-sm text-muted-foreground">Stay informed about changes that may affect your financial plan</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-background to-muted/30 p-6 rounded-xl border border-border/50 hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building className="w-6 h-6 text-primary" />
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
              <Card key={id} className={`cursor-pointer transition-all ${data.goals.includes(id) ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`} onClick={() => handleGoalToggle(id)}>
                <CardContent className="flex items-center p-4">
                  <Icon className="w-5 h-5 mr-3 text-primary" />
                  <span className="flex-1">{label}</span>
                  <Checkbox checked={data.goals.includes(id)} readOnly />
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
              <Card key={id} className={`cursor-pointer transition-all ${data.financialGoals.includes(id) ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`} onClick={() => handleFinancialGoalToggle(id)}>
                <CardContent className="flex items-center p-4">
                  <Icon className="w-5 h-5 mr-3 text-primary" />
                  <span className="flex-1">{label}</span>
                  <Checkbox checked={data.financialGoals.includes(id)} readOnly />
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
                onChange={(e) => setData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter your name"
              />
            </div>
            <div>
              <Label htmlFor="birthDate">Birth Date</Label>
              <Input
                id="birthDate"
                type="date"
                value={data.birthDate}
                onChange={(e) => setData(prev => ({ ...prev, birthDate: e.target.value }))}
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
                onChange={(e) => setData(prev => ({ ...prev, location: e.target.value }))}
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
                  onChange={e => setData(prev => ({ ...prev, education: e.target.value }))}
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
                  onChange={e => setData(prev => ({ ...prev, educationField: e.target.value }))}
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
    },
    // Step 5: Monthly Budget
    {
      title: "Monthly Budgeting",
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground text-center mb-6">
            How much do you spend monthly in these categories?
          </p>
          <div className="flex flex-col" style={{ minHeight: '24rem', maxHeight: '32rem' }}>
            <div className="flex-grow overflow-y-auto space-y-4 pr-2">
              {[
                { key: 'housing', label: 'Housing (Rent/Mortgage)', icon: Home, category: 'Assets' },
                { key: 'food', label: 'Food & Groceries', icon: Coffee, category: 'Cash' },
                { key: 'transportation', label: 'Transportation', icon: Users, category: 'Savings' },
                { key: 'utilities', label: 'Utilities', icon: Building, category: 'Debt' },
                { key: 'entertainment', label: 'Entertainment', icon: Plane, category: 'Investments' },
                { key: 'healthcare', label: 'Healthcare', icon: Shield, category: 'Retirement' },
                { key: 'other', label: 'Other Expenses', icon: DollarSign, category: 'Cash' }
              ].map(({ key, label, icon: Icon, category }) => (
                <div key={key} className="flex items-center space-x-4 p-3 rounded-lg border border-border/30 hover:border-primary/20 transition-all">
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: CATEGORY_BASE_COLORS[category] + '22', // light background (add alpha if you want)
                      border: `2px solid ${CATEGORY_BASE_COLORS[category]}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '2rem',
                      height: '2rem',
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <Label className="flex-1 font-medium">{label}</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      value={data.budgetCategories[key] || ''}
                      onChange={(e) => updateBudgetCategory(key, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-28 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/50 pt-4 bg-white">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground">Total Monthly Expenses</span>
                </div>
                <span className="text-xl font-bold text-primary">
                  ${Object.values(data.budgetCategories).reduce((sum, val) => sum + (val || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Step 6: Account Balances
    {
      title: "Account Balances",
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground text-center mb-6">
            Enter your current account balances for each category
          </p>
          <div className="flex flex-col" style={{ minHeight: '24rem', maxHeight: '32rem' }}>
            <div className="flex-grow overflow-y-auto space-y-4 pr-2">
              {[
                {
                  key: 'cash',
                  label: 'Cash',
                  icon: DollarSign,
                  description: 'Checking accounts, savings accounts, and physical cash',
                  category: 'Cash'
                },
                {
                  key: 'debt',
                  label: 'Debt',
                  icon: CreditCard,
                  description: 'Credit cards, loans, and other outstanding debts (enter as positive amount)',
                  category: 'Debt'
                },
                {
                  key: 'assets',
                  label: 'Assets',
                  icon: Home,
                  description: 'Real estate, vehicles, and other valuable possessions',
                  category: 'Assets'
                },
                {
                  key: 'savings',
                  label: 'Savings',
                  icon: PiggyBank,
                  description: 'Emergency funds and short-term savings goals',
                  category: 'Savings'
                },
                {
                  key: 'investments',
                  label: 'Investments',
                  icon: TrendingUp,
                  description: 'Stocks, bonds, mutual funds, and other investments',
                  category: 'Investments'
                },
                {
                  key: 'retirement',
                  label: 'Retirement',
                  icon: Shield,
                  description: '401(k), IRA, and other retirement accounts',
                  category: 'Retirement'
                }
              ].map(({ key, label, icon: Icon, description, category }) => (
                <Card key={key} className="border border-border/30 hover:border-primary/20 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: CATEGORY_BASE_COLORS[category] + '22',
                          border: `2px solid ${CATEGORY_BASE_COLORS[category]}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '2rem',
                          height: '2rem',
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <Label className="font-medium">{label}</Label>
                        <p className="text-xs text-muted-foreground mb-2">{description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={data.accounts[key] || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            updateAccount(key, value);
                          }}
                          placeholder="0"
                          className={`w-32 text-right ${key === 'debt' && data.accounts[key] < 0 ? 'border-orange-200 focus:border-orange-400' : ''}`}
                        />
                        {key === 'debt' && data.accounts[key] < 0 && (
                          <div className="text-xs text-orange-600 mt-1 text-right">
                            💡 Enter debt as positive
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="border-t border-border/50 pt-4 bg-white">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground">Total Net Worth</span>
                </div>
                <span className="text-xl font-bold text-primary">
                  ${(Object.entries(data.accounts).reduce((sum, [key, val]) => {
                    // Debt is negative, everything else is positive
                    return sum + (key === 'debt' ? -(val || 0) : (val || 0));
                  }, 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Step 7: Add Initial Events (UPDATED)
    {
      title: "Add Initial Events",
      content: (
        <div className="space-y-8">
          <div>
            <p className="text-muted-foreground text-center mb-6">
              Add your first events to get started. You can edit their details after adding.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[{
                type: 'get_job',
                label: 'Add Salary Employment',
                sub: 'Add a salaried job'
              }, {
                type: 'get_wage_job',
                label: 'Add Wage Employment',
                sub: 'Add an hourly job'
              }, {
                type: 'buy_house',
                label: 'Add House',
                sub: 'Add a home purchase'
              }].map(({ type, label, sub }) => (
                <Card key={type} className="cursor-pointer hover:ring-2 hover:ring-primary transition-all flex flex-col items-center p-6">
                  <CardContent className="flex flex-col items-center p-0 w-full">
                    <div className="flex flex-col items-center gap-2 w-full">
                      <span className="font-semibold">{label}</span>
                      <span className="text-xs text-muted-foreground">{sub}</span>
                      <Button className="mt-4 w-full" onClick={() => handleAddInitialEvent(type)}>
                        Add Event
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          {/* Display current events in the plan */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4 text-center">Current Events in Your Plan</h3>
            {plan && plan.events.length > 0 ? (
              <div className="max-h-64 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.events.map(event => (
                    <Card key={event.id} className="border border-border/30">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div>{getEventIcon(event.type)}</div>
                        <div>
                          <div className="font-medium">{getEventDisplayType(event.type)}</div>
                          <div className="text-xs text-muted-foreground">{event.description}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">No events added yet.</div>
            )}
          </div>
        </div>
      )
    },
    // Step 8: Retirement Planning (NEW)
    {
      title: "Plan Your Retirement",
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground text-center mb-6">
            Let's plan for your retirement. This will help us calculate your retirement needs and timeline.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="retirementAge">At what age would you like to retire?</Label>
              <Input
                id="retirementAge"
                type="number"
                min="35"
                max="90"
                value={data.retirementAge || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setData(prev => ({
                      ...prev,
                      retirementAge: undefined
                    }));
                  } else {
                    const age = parseInt(value);
                    if (!isNaN(age)) {
                      setData(prev => ({
                        ...prev,
                        retirementAge: age
                      }));
                    }
                  }
                }}
                onBlur={(e) => {
                  const age = parseInt(e.target.value);
                  if (!isNaN(age) && age >= 35 && age <= 90 && data.birthDate) {
                    // Calculate current age from birth date
                    const birthDate = new Date(data.birthDate);
                    const today = new Date();
                    const currentAgeInDays = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
                    const currentAge = getAgeFromDays(currentAgeInDays);
                    
                    // Calculate days until retirement
                    const retirementAgeInDays = getDaysFromAge(age);
                    const daysUntilRetirement = retirementAgeInDays;

                    setData(prev => ({
                      ...prev,
                      retirementStartDay: Math.max(0, daysUntilRetirement)
                    }));
                  }
                }}
                placeholder="65"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Most people retire between ages 62 and 70
              </p>
            </div>

            <div>
              <Label htmlFor="retirementGoal">What's your retirement savings goal?</Label>
              <Input
                id="retirementGoal"
                type="number"
                min="0"
                step="10000"
                value={data.retirementGoal || ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 0) {
                    setData(prev => ({ ...prev, retirementGoal: value }));
                  }
                }}
                placeholder="1000000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A common goal is 10-12 times your annual salary
              </p>
            </div>

            <div>
              <Label htmlFor="monthlyRetirementIncome">Desired monthly retirement income (in today's dollars)</Label>
              <Input
                id="monthlyRetirementIncome"
                type="number"
                min="0"
                step="100"
                value={data.monthlyRetirementIncome || ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 0) {
                    setData(prev => ({ ...prev, monthlyRetirementIncome: value }));
                  }
                }}
                placeholder="5000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Consider your current monthly expenses as a starting point
              </p>
            </div>
          </div>
        </div>
      )
    },
    // Step 9: Explore Your Financial Future (ORIGINAL)
    {
      title: "Explore Your Financial Future",
      content: (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              You're ready to start planning! Here's what you can do:
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-center gap-3 p-3 bg-muted/50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span>View your net worth timeline</span>
              </div>
              <div className="flex items-center justify-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Target className="w-5 h-5 text-primary" />
                <span>Add financial events and goals</span>
              </div>
              <div className="flex items-center justify-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Building className="w-5 h-5 text-primary" />
                <span>Run market simulations</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Create an account to save your plan and access advanced features.
            </p>
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
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${index <= currentStep ? 'bg-primary shadow-lg' : 'bg-muted'
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
            {currentStep === totalSteps - 1 ? 'Create Account' : currentStep === 0 ? 'Begin Journey' : 'Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingFlow;