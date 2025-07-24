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

interface OnboardingFlowProps {
  isOpen: boolean;
  onComplete: () => void;
  onAuthRequired: () => void;
}

interface OnboardingData {
  goals: string[];
  financialGoals: string[];
  name: string;
  birthDate: string;
  location: string;
  budgetCategories: Record<string, number>;
  accounts: Record<string, number>;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ isOpen, onComplete, onAuthRequired }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    goals: [],
    financialGoals: [],
    name: '',
    birthDate: '',
    location: '',
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
    }
  });

  const totalSteps = 7;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
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
    setData(prev => ({
      ...prev,
      accounts: {
        ...prev.accounts,
        [account]: value
      }
    }));
  };

  const steps = [
    // Step 1: Welcome
    {
      title: "Welcome to Lever Financial Planner",
      content: (
        <div className="relative">
          {/* Elegant decorative elements */}
          <div className="absolute top-0 right-8 opacity-20">
            <Mountain className="w-24 h-24 text-primary" />
          </div>
          <div className="absolute bottom-0 left-8 opacity-10">
            <Leaf className="w-16 h-16 text-primary" />
          </div>
          
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
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={data.name}
                onChange={(e) => setData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter your full name"
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
                Used to calculate changes in net worth at age 59½
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
                Used for finding local financial metrics
              </p>
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
          <div className="space-y-4">
            {[
              { key: 'housing', label: 'Housing (Rent/Mortgage)', icon: Home },
              { key: 'food', label: 'Food & Groceries', icon: Coffee },
              { key: 'transportation', label: 'Transportation', icon: Users },
              { key: 'utilities', label: 'Utilities', icon: Building },
              { key: 'entertainment', label: 'Entertainment', icon: Plane },
              { key: 'healthcare', label: 'Healthcare', icon: Shield },
              { key: 'other', label: 'Other Expenses', icon: DollarSign }
            ].map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center space-x-4 p-3 rounded-lg border border-border/30 hover:border-primary/20 transition-all">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon className="w-4 h-4 text-primary" />
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
          <div className="border-t border-border/50 pt-4">
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
          <div className="space-y-4">
            {[
              { 
                key: 'cash', 
                label: 'Cash', 
                icon: DollarSign,
                description: 'Checking accounts, savings accounts, and physical cash'
              },
              { 
                key: 'debt', 
                label: 'Debt', 
                icon: CreditCard,
                description: 'Credit cards, loans, and other outstanding debts'
              },
              { 
                key: 'assets', 
                label: 'Assets', 
                icon: Home,
                description: 'Real estate, vehicles, and other valuable possessions'
              },
              { 
                key: 'savings', 
                label: 'Savings', 
                icon: PiggyBank,
                description: 'Emergency funds and short-term savings goals'
              },
              { 
                key: 'investments', 
                label: 'Investments', 
                icon: TrendingUp,
                description: 'Stocks, bonds, mutual funds, and other investments'
              },
              { 
                key: 'retirement', 
                label: 'Retirement', 
                icon: Shield,
                description: '401(k), IRA, and other retirement accounts'
              }
            ].map(({ key, label, icon: Icon, description }) => (
              <Card key={key} className="border border-border/30 hover:border-primary/20 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <Label className="font-medium">{label}</Label>
                      <p className="text-xs text-muted-foreground mb-2">{description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        value={data.accounts[key] || ''}
                        onChange={(e) => updateAccount(key, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-32 text-right"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="border-t border-border/50 pt-4">
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
      )
    },
    // Step 7: Features Overview
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

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
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
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index <= currentStep ? 'bg-primary shadow-lg' : 'bg-muted'
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