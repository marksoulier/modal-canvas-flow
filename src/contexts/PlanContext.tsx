import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Types for the plan data structure
interface Parameter {
    id: number;
    type: string;
    value: number | string;
}

interface UpdatingEvent {
    id: number;
    type: string;
    description: string;
    parameters: Parameter[];
}

interface Event {
    id: number;
    type: string;
    description: string;
    parameters: Parameter[];
    updating_events?: UpdatingEvent[];
}

interface Plan {
    current_time_days: number;
    inflation_rate: number;
    adjust_for_inflation: boolean;
    events: Event[];
}

interface PlanContextType {
    plan: Plan | null;
    loadPlan: (planData: Plan) => void;
    savePlan: () => string;
    loadPlanFromFile: (file: File) => Promise<void>;
    savePlanToFile: () => void;
    loadDefaultPlan: () => Promise<void>;
}

const PlanContext = createContext<PlanContextType | null>(null);

export function usePlan() {
    const context = useContext(PlanContext);
    if (!context) {
        throw new Error('usePlan must be used within a PlanProvider');
    }
    return context;
}

interface PlanProviderProps {
    children: React.ReactNode;
}

export function PlanProvider({ children }: PlanProviderProps) {
    const [plan, setPlan] = useState<Plan | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const loadDefaultPlan = useCallback(async () => {
        try {
            const response = await fetch('/assets/plan.json');
            if (!response.ok) {
                throw new Error('Failed to load default plan');
            }
            const defaultPlan = await response.json();
            setPlan(defaultPlan);
        } catch (error) {
            console.error('Error loading default plan:', error);
            throw error;
        }
    }, []);

    // Load default plan on mount
    useEffect(() => {
        const initializePlan = async () => {
            try {
                await loadDefaultPlan();
            } catch (error) {
                console.error('Error during initialization:', error);
            } finally {
                setIsInitialized(true);
            }
        };

        initializePlan();
    }, [loadDefaultPlan]);

    const loadPlan = useCallback((planData: Plan) => {
        setPlan(planData);
    }, []);

    const savePlan = useCallback(() => {
        if (!plan) {
            throw new Error('No plan data to save');
        }
        return JSON.stringify(plan, null, 2);
    }, [plan]);

    const loadPlanFromFile = useCallback(async (file: File) => {
        try {
            const text = await file.text();
            const planData = JSON.parse(text) as Plan;
            setPlan(planData);
        } catch (error) {
            console.error('Error loading plan from file:', error);
            throw error;
        }
    }, []);

    const savePlanToFile = useCallback(() => {
        if (!plan) {
            throw new Error('No plan data to save');
        }

        const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plan.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [plan]);

    const value = {
        plan,
        loadPlan,
        savePlan,
        loadPlanFromFile,
        savePlanToFile,
        loadDefaultPlan,
    };

    // Don't render children until we've attempted to load the default plan
    if (!isInitialized) {
        return null; // Or a loading spinner
    }

    return (
        <PlanContext.Provider value={value}>
            {children}
        </PlanContext.Provider>
    );
} 