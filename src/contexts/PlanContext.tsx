import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import eventSchemaData from '@/data/event_schema.json';
import defaultPlanData from '@/data/plan.json';
import defaultLockedPlanData from '@/data/plan_locked.json';
import { useAuth } from './AuthContext';

// Example plan mapping
interface ExamplePlanConfig {
    regularPlan: string;
    lockedPlan: string;
}

const EXAMPLE_PLAN_MAPPING: Record<string, ExamplePlanConfig> = {
    'apr-vs-apy-example': {
        regularPlan: 'APR vs APY',
        lockedPlan: 'APR vs APY'
    },
    'retirement-example': {
        regularPlan: 'Mikes Retirement Plan',
        lockedPlan: 'Mikes Retirement Plan'
    },
    'journey-20-example': {
        regularPlan: 'Journey of $20',
        lockedPlan: 'Journey of $20'
    },
    'save-for-house': {
        regularPlan: 'Saving for a House',
        lockedPlan: 'Saving for a House'
    }
};

// Utility functions for date conversion
export const dateStringToDaysSinceBirth = (dateString: string, birthDate: string): number => {
    const birth = new Date(birthDate + 'T00:00:00'); // Use UTC midnight
    const targetDate = new Date(dateString + 'T00:00:00'); // Use UTC midnight
    // Add 1 to account for inclusive counting of days (both start and end date count)
    return Math.round((targetDate.getTime() - birth.getTime()) / (24 * 60 * 60 * 1000));
};

export const daysSinceBirthToDateString = (days: number, birthDate: string): string => {
    const birth = new Date(birthDate + 'T00:00:00');
    const targetDate = new Date(birth.getTime() + days * 24 * 60 * 60 * 1000);
    // Format as YYYY-MM-DD using local time
    return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
};

// Helper to calculate age in years from days since birth
export const getAgeFromDays = (daysSinceBirth: number, birthDateString: string): number => {
    const birthDate = new Date(birthDateString + 'T00:00:00');
    const targetDate = new Date(birthDate.getTime() + daysSinceBirth * 24 * 60 * 60 * 1000);

    let years = targetDate.getFullYear() - birthDate.getFullYear();

    // Adjust for cases where we haven't reached the birthday in the target year
    if (targetDate.getMonth() < birthDate.getMonth() ||
        (targetDate.getMonth() === birthDate.getMonth() &&
            targetDate.getDate() < birthDate.getDate())) {
        years--;
    }

    return years;
};

// Helper to calculate days since birth from age in years
export const getDaysFromAge = (age: number, birthDateString: string): number => {
    const birthDate = new Date(birthDateString + 'T00:00:00');
    const targetDate = new Date(birthDate.getTime());

    // Set to same day/month but years ahead
    targetDate.setFullYear(birthDate.getFullYear() + age);

    // Calculate exact days between dates
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((targetDate.getTime() - birthDate.getTime()) / millisecondsPerDay);
};

// Calculate age from birth date string and target date string
export const getAgeFromDateStrings = (birthDateString: string, targetDateString: string): number => {
    const birthDate = new Date(birthDateString + 'T00:00:00');
    const targetDate = new Date(targetDateString + 'T00:00:00');

    let years = targetDate.getFullYear() - birthDate.getFullYear();

    // Adjust for cases where we haven't reached the birthday in the target year
    const birthMonth = birthDate.getMonth();
    const targetMonth = targetDate.getMonth();
    if (targetMonth < birthMonth || (targetMonth === birthMonth && targetDate.getDate() < birthDate.getDate())) {
        years--;
    }

    return years;
};

// Calculate age from birth date to a specific target date (for DatePicker context)
export const getAgeFromBirthToDate = getAgeFromDateStrings; // Same exact calculation

// Calculate target date from birth date and age
export const getTargetDateFromBirthAndAge = (birthDateString: string, age: number): string => {
    const birthDate = new Date(birthDateString + 'T00:00:00');
    const targetDate = new Date(birthDate.getTime());
    targetDate.setFullYear(birthDate.getFullYear() + age);
    return targetDate.toISOString().split('T')[0];
};


// Map of Lucide icon names to schema icon names
export const iconMap: Record<string, string> = {
    'shopping-cart': 'ShoppingCart',
    'gift': 'Gift',
    'briefcase': 'Briefcase',
    'factory': 'Factory',
    'moon': 'Moon',
    'home': 'Home',
    'car': 'Car',
    'baby': 'Baby',
    'ring': 'Ring',
    'split': 'Split',
    'skull': 'Skull',
    'stethoscope': 'Stethoscope',
    'heart-pulse': 'HeartPulse',
    'hand-coins': 'HandCoins',
    'trending-up': 'TrendingUp',
    'banknote': 'Banknote',
    'file-text': 'FileText',
    'edit': 'Edit',
    'arrow-up': 'ArrowUp',
    'dollar-sign': 'DollarSign',
    'sliders-horizontal': 'SlidersHorizontal',
    'bar-chart': 'BarChart',
    'x-octagon': 'XOctagon',
    'clipboard-check': 'ClipboardCheck',
    'plus': 'Plus',
    'clock': 'Clock',
    'shield-check': 'ShieldCheck',
    'wind': 'Wind',
    'flame': 'Flame',
    'waves': 'Waves',
    'wrench': 'Wrench',
    'graduation-cap': 'GraduationCap',
    'plus-circle': 'PlusCircle',
    'badge-dollar-sign': 'BadgeDollarSign',
    'dollar-bill': 'DollarBill',
    'wallet': 'Wallet',
    'pencil': 'Pencil',
    'repeat': 'Repeat', // Lucide has 'Repeat'
    'repeat-2': 'Repeat2', // Use 'Repeat2' if available, else fallback to 'Repeat'
    'repeat-3': 'Repeat3', // Use 'Repeat3' if available, else fallback to 'Repeat'
    'arrow-right-arrow-left': 'ArrowUpDown', // Use up-down arrow for transfer money
    'list': 'List', // Lucide: List
    'arrow-up-down': 'ArrowUpDown', // Lucide: ArrowUpDown
    'arrow-down': 'ArrowDown', // Lucide: ArrowDown
    'arrow-right': 'ArrowRight', // Lucide: ArrowRight
    'arrow-left': 'ArrowLeft', // Lucide: ArrowLeft
    'arrow-right-left': 'ArrowRightLeft', // Lucide: ArrowRightLeft
    'credit-card': 'CreditCard', // Lucide: CreditCard
};

// Types for the plan data structure
export interface Parameter {
    id: number;
    type: string;
    value: number | string;
}

// New interface for event functions in schema
export interface SchemaEventFunctionParts {
    title: string;
    description: string;
    icon: string;
    default_state: boolean;
}

// New interface for event functions in plan events
export interface EventFunctionParts {
    title: string;
    enabled: boolean;
}

export interface UpdatingEvent {
    id: number;
    type: string;
    title: string; // User-defined title for the event
    description: string;
    is_recurring: boolean;
    parameters: Parameter[];
    event_functions?: EventFunctionParts[]; // New field for event functions
}

export interface Event {
    id: number;
    type: string;
    title: string; // User-defined title for the event
    description: string;
    is_recurring: boolean;
    parameters: Parameter[];
    updating_events?: UpdatingEvent[];
    event_functions?: EventFunctionParts[]; // New field for event functions
}

export interface Envelope {
    name: string;
    category: string;
    growth: string;
    rate?: number;
    days_of_usefulness?: number;
    account_type: string;
}

export interface Plan {
    title: string;
    birth_date: string;
    inflation_rate: number;
    adjust_for_inflation: boolean;
    events: Event[];
    envelopes: Envelope[];
    retirement_goal: number; // New field for retirement goal
    view_start_date?: string; // Date when the view starts (ISO string)
    view_end_date?: string; // Date when the view ends (ISO string)
}

export interface SchemaParameter {
    type: string;
    display_name: string;
    parameter_units: string;
    description: string;
    default: number | string;
    options?: string[];
    editable?: boolean;
}

export interface SchemaUpdatingEvent {
    type: string;
    display_type: string;
    icon: string;
    description: string;
    default_title: string; // Default title for the updating event
    parameters: SchemaParameter[];
    display_event?: boolean;
    is_recurring?: boolean; // defualt to what reoccuring nature should start as when added to the plan.
    can_be_reocurring?: boolean; // Schema parameter seeing if this event can be reoccuring or not
    event_functions_parts?: SchemaEventFunctionParts[]; // New field for event functions
    onboarding_stage?: string; // New field for onboarding stage
}

export interface SchemaEvent {
    type: string;
    display_type: string;
    category: string;
    weight: number;
    description: string;
    icon: string;
    default_title: string; // Default title for the event
    parameters: SchemaParameter[];
    updating_events?: SchemaUpdatingEvent[];
    disclaimer?: string;
    display_event?: boolean;
    is_recurring?: boolean;
    can_be_reocurring?: boolean; // Added this property
    event_functions_parts?: SchemaEventFunctionParts[]; // New field for event functions
    onboarding_stage?: string; // New field for onboarding stage
}

export interface Schema {
    inflation_rate: number;
    adjust_for_inflation: boolean;
    birth_date: string;
    categories: string[];
    parameter_units_list: string[];
    events: SchemaEvent[];
    default_envelopes?: Envelope[];
}

interface PlanContextType {
    plan: Plan | null;
    plan_locked: Plan | null; // <-- add this
    schema: Schema | null;
    isCompareMode: boolean;
    setCompareMode: (enabled: boolean) => void;
    loadPlan: (planData: Plan) => void;
    savePlan: () => string;
    loadPlanFromFile: (file: File) => Promise<void>;
    savePlanToFile: () => void;
    updateParameter: (eventId: number, parameterType: string, newValue: number | string) => void;
    deleteEvent: (eventId: number) => void;
    addEvent: (eventType: string, parameterOverrides?: { [type: string]: any }, replaceExisting?: boolean) => number;
    addUpdatingEvent: (mainEventId: number, updatingEventType: string) => number;
    getEventIcon: (eventType: string, event?: Event | UpdatingEvent) => React.ReactNode;
    getEventDisplayType: (eventType: string) => string;
    getParameterDisplayName: (eventType: string, parameterType: string) => string;
    getParameterUnits: (eventType: string, parameterType: string) => string;
    getParameterDescription: (eventType: string, parameterType: string) => string;
    updateEventDescription: (eventId: number, newDescription: string) => void;
    updateEventTitle: (eventId: number, newTitle: string) => void;
    updatePlanTitle: (newTitle: string) => void;
    updateBirthDate: (birthDateString: string) => void;
    getEventDisclaimer: (eventType: string) => string;
    getParameterOptions: (eventType: string, parameterType: string) => string[];
    setAdjustForInflation: (value: boolean) => void;
    currentDay: number;
    updatePlanInflationRate: (newRate: number) => void; // <-- add this
    lockPlan: () => void; // <-- add this
    copyPlanToLock: () => void; // <-- add this new function
    updateRetirementGoal: (newGoal: number) => void; // <-- add this
    canEventBeRecurring: (eventId: number) => boolean; // <-- add this
    updateEventRecurring: (eventId: number, isRecurring: boolean) => void; // <--
    hasEventType: (eventType: string) => boolean; // <-- add this
    deleteEventsByType: (eventType: string) => void; // <-- add this
    getEnvelopeDisplayName: (envelopeName: string) => string;
    captureVisualizationAsSVG: () => string | null; // <-- add this
    setVisualizationDateRange: (planData: Plan) => void; // <-- add this
    setZoomToDateRange: (startDay: number, endDay: number) => void; // <-- add this
    registerSetZoomToDateRange: (fn: (startDay: number, endDay: number) => void) => void; // <-- add this
    getCurrentVisualizationRange: () => { startDay: number; endDay: number } | null; // <-- add this
    registerCurrentVisualizationRange: (range: { startDay: number; endDay: number } | null) => void; // <-- add this
    setVisualizationReady: (ready: boolean) => void; // <-- add this new method
    convertDateParametersToDays: (events: any[]) => any[]; // <-- add this new method
    triggerSimulation: () => void; // <-- add this new method
    registerTriggerSimulation: (fn: () => void) => void; // <-- add this new method
    handleZoomToWindow: (options: { years?: number; months?: number; days?: number }) => void; // <-- add this new method
    registerHandleZoomToWindow: (fn: (options: { years?: number; months?: number; days?: number }) => void) => void; // <-- add this new method
    updatePlanDirectly: (planData: Plan) => void; // <-- add this new method for direct plan updates without viewing window reset
    updateLockedPlanDirectly: (planData: Plan) => void; // <-- add this new method for direct locked plan updates without viewing window reset
    isExampleViewing: boolean; // Add this new property
    isUxTester: boolean; // Flag for UX tester mode
    daysSinceBirthToDateString: (days: number, birthDate: string) => string; // Add this for date conversion
    undo: () => void; // <-- add this
    redo: () => void; // <-- add this
    addToStack: (planData: Plan) => void; // <-- add this
    // Event functions methods
    getEventFunctionsParts: (eventType: string) => SchemaEventFunctionParts[];
    getEventFunctionPartsIcon: (eventType: string, functionTitle: string) => React.ReactNode;
    getEventFunctionPartsDescription: (eventType: string, functionTitle: string) => string;
    updateEventFunctionParts: (eventId: number, functionTitle: string, enabled: boolean) => void;
    getEventFunctionPartsState: (eventId: number, functionTitle: string) => boolean;
    // Onboarding stage methods
    getEventOnboardingStage: (eventType: string) => string | undefined;
    restartPlan: () => void; // restart to blank plan for both current and locked
}

// Schema and default data are now imported directly

// --- AUTO-PERSISTENCE FLAG ---
// Set this to true to enable automatic saving/loading of the plan to/from localStorage
const ENABLE_AUTO_PERSIST_PLAN = true;
const LOCALSTORAGE_PLAN_KEY = 'user_plan_v1';
const LOCALSTORAGE_PLAN_LOCKED_KEY = 'user_plan_locked_v1';

const PlanContext = createContext<PlanContextType | null>(null);

export function usePlan() {
    const context = useContext(PlanContext);
    if (!context) {
        throw new Error('usePlan must be used within a PlanProvider');
    }
    return context;
}

// Helper: get weight for an event type from schema (defaults to 100 if not found)
export function getEventWeightFromSchema(
    schema: Schema | null,
    eventType: string,
    parentEventType?: string
): number {
    if (!schema) return 100;
    // Try main event type first
    const main = schema.events.find(e => e.type === eventType);
    if (main && typeof main.weight === 'number') return main.weight;

    // If not found or not a main event, try parent event type
    if (parentEventType) {
        const parent = schema.events.find(e => e.type === parentEventType);
        if (parent && typeof parent.weight === 'number') return parent.weight;
    }

    // Default
    return 100;
}

interface PlanProviderProps {
    children: React.ReactNode;
}

// Helper to sanitize plan title for file name
function getPlanFileName(title: string | undefined): string {
    if (!title || !title.trim()) return 'plan.json';
    // Remove invalid filename characters and trim
    let safe = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_').substring(0, 40);
    if (!safe) safe = 'plan';
    return safe + '.json';
}

// Helper to get the next unique event or updating event id
function getNextEventId(plan: Plan): number {
    const mainIds = plan.events.map(e => e.id);
    const updatingIds = plan.events.flatMap(e => e.updating_events?.map(ue => ue.id) || []);
    const allIds = [...mainIds, ...updatingIds];
    return allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
}

// Helper: deep clone a plan to avoid shared references between `plan` and `plan_locked`
function deepClonePlan(plan: Plan): Plan {
    return JSON.parse(JSON.stringify(plan));
}

export function PlanProvider({ children }: PlanProviderProps) {
    const [plan, setPlan] = useState<Plan | null>(null);
    const [plan_locked, setPlanLocked] = useState<Plan | null>(null); // <-- add this
    const [schema, setSchema] = useState<Schema | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isVisualizationReady, setIsVisualizationReady] = useState(false); // <-- add this new state
    const [shouldTriggerSimulation, setShouldTriggerSimulation] = useState(false);
    const [isExampleViewing, setIsExampleViewing] = useState(false); // Add this new state
    const [isUxTester, setIsUxTester] = useState(false); // Add this new state
    // Add compare mode state with enhanced setter
    const [isCompareMode, setCompareModeRaw] = useState(false);

    // Enhanced setCompareMode that handles copying plan when enabled
    const setCompareMode = useCallback((enabled: boolean) => {
        if (enabled && plan) {
            // When enabling compare mode, copy current plan to locked (deep clone to avoid shared refs)
            setPlanLocked(deepClonePlan(plan));
            // Trigger simulation to update visualization
            setShouldTriggerSimulation(true);
        }
        setCompareModeRaw(enabled);
    }, [plan]);

    // Add undo history management
    const [history, setHistory] = useState<Plan[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const MAX_HISTORY_SIZE = 50; // Limit history to prevent memory issues

    // Get auth context for onboarding state management
    const { updateOnboardingState } = useAuth();

    // Ref to store the setZoomToDateRange function from Visualization
    const setZoomToDateRangeRef = useRef<((startDay: number, endDay: number) => void) | null>(null);

    // Ref to store the current visualization range from Visualization
    const currentVisualizationRangeRef = useRef<{ startDay: number; endDay: number } | null>(null);

    // Ref to store the triggerSimulation function from Visualization
    const triggerSimulationRef = useRef<(() => void) | null>(null);

    // Ref to store the handleZoomToWindow function from Visualization
    const handleZoomToWindowRef = useRef<((options: { years?: number; months?: number; days?: number }) => void) | null>(null);

    const { upsertAnonymousPlan, fetchDefaultPlans } = useAuth();

    // Add to history stack function
    const addToStack = useCallback((planData: Plan) => {
        setHistory(prevHistory => {
            // Remove any history after current index (if we're not at the end)
            const newHistory = prevHistory.slice(0, historyIndex + 1);

            // Add the new plan to history
            const updatedHistory = [...newHistory, planData];

            // Limit history size
            if (updatedHistory.length > MAX_HISTORY_SIZE) {
                return updatedHistory.slice(-MAX_HISTORY_SIZE);
            }

            return updatedHistory;
        });

        // Update history index to point to the new entry
        setHistoryIndex(prevIndex => {
            const newIndex = Math.min(prevIndex + 1, MAX_HISTORY_SIZE - 1);
            return newIndex;
        });
    }, [historyIndex]);

    // Undo function
    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const previousPlan = history[newIndex];

            if (previousPlan) {
                setPlan(previousPlan);
                setHistoryIndex(newIndex);
                setShouldTriggerSimulation(true);
                console.log('Undo: Restored plan from history');
            }
        }
    }, [history, historyIndex]);

    // Redo function (bonus feature)
    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const nextPlan = history[newIndex];

            if (nextPlan) {
                setPlan(nextPlan);
                setHistoryIndex(newIndex);
                setShouldTriggerSimulation(true);
                console.log('Redo: Restored plan from history');
            }
        }
    }, [history, historyIndex]);

    // Helper function to set visualization date range
    const setVisualizationDateRange = useCallback((planData: Plan) => {
        if (planData.view_start_date && planData.view_end_date) {
            // Convert ISO dates to day numbers
            const birthDate = new Date(planData.birth_date + 'T00:00:00');
            const startDate = new Date(planData.view_start_date + 'T00:00:00');
            const endDate = new Date(planData.view_end_date + 'T00:00:00');

            const startDay = Math.floor((startDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
            const endDay = Math.floor((endDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

            console.log('📅 Setting visualization date range:', {
                startDate: planData.view_start_date,
                endDate: planData.view_end_date,
                startDay,
                endDay
            });

            // Set zoom to the specified range (this will be called after the visualization is ready)
            setTimeout(() => {
                // Use the ref directly
                if (setZoomToDateRangeRef.current) {
                    setZoomToDateRangeRef.current(startDay, endDay);
                } else {
                    console.warn('setZoomToDateRange not ready yet, will retry in 500ms');
                    // Retry after a longer delay
                    setTimeout(() => {
                        if (setZoomToDateRangeRef.current) {
                            setZoomToDateRangeRef.current(startDay, endDay);
                        }
                    }, 500);
                }
            }, 100);
        }
    }, []);

    // Helper function to load plan data and set visualization range
    const loadPlanData = useCallback((planData: Plan, lockedPlanData?: Plan) => {
        // Reset visualization ready state when loading new plan
        setIsVisualizationReady(false);
        setShouldTriggerSimulation(true);
        setPlan(planData);
        // Add to history stack when loading a new plan
        addToStack(planData);
        if (lockedPlanData) {
            // Always deep clone to avoid shared references between plan and plan_locked
            setPlanLocked(deepClonePlan(lockedPlanData));
        } else {
            setPlanLocked(deepClonePlan(planData));
        }
        console.log("planData.view_start_date: ", planData.view_start_date);
        console.log("planData.view_end_date: ", planData.view_end_date);
        setVisualizationDateRange(planData);
    }, [setVisualizationDateRange, addToStack]);

    // Load schema on mount
    useEffect(() => {
        try {
            setSchema(eventSchemaData);
        } catch (error) {
            console.error('Error loading schema:', error);
            throw error;
        }
    }, []);

    // --- Clean startup: check URL parameters, then load from localStorage if available, else load default plan ---
    useEffect(() => {
        if (isInitialized) return; // Prevent double init

        const tryLoadPlan = async () => {
            try {
                // Check URL parameters first
                const urlParams = new URLSearchParams(window.location.search);
                const planId = urlParams.get('plan_id');
                const isUxTester = urlParams.get('ux_tester') === 'true';
                setIsUxTester(isUxTester);

                console.log('🔍 Checking URL parameters:', { planId });

                // If we have a mapped example plan
                if (planId && planId in EXAMPLE_PLAN_MAPPING) {
                    console.log('📍 Found matching example plan config:', EXAMPLE_PLAN_MAPPING[planId]);
                    const planConfig = EXAMPLE_PLAN_MAPPING[planId];

                    // Get default plans
                    console.log('🔄 Fetching default plans...');
                    const defaultPlans = await fetchDefaultPlans();
                    console.log('📋 Default plans fetched:', defaultPlans.map(p => p.plan_name));

                    // Find the matching plans
                    const regularPlan = defaultPlans.find(p => p.plan_name === planConfig.regularPlan);
                    const lockedPlan = defaultPlans.find(p => p.plan_name === planConfig.lockedPlan);

                    console.log('🎯 Found plans:', {
                        regularPlan: regularPlan?.plan_name,
                        lockedPlan: lockedPlan?.plan_name
                    });

                    if (regularPlan && lockedPlan) {
                        // Load both plans using the new parameter
                        console.log('📥 Loading example plans...');
                        loadPlanData(regularPlan.plan_data, lockedPlan.plan_data);
                        setIsExampleViewing(true); // Set example viewing mode
                        // When loading an example plan, set anonymous onboarding to full (do not persist)
                        try {
                            await updateOnboardingState('full', false);
                            console.log('✅ Anonymous onboarding set to full for example viewing (non-persistent)');
                        } catch (e) {
                            console.warn('Failed to set onboarding state to full (non-persistent):', e);
                        }
                        setIsInitialized(true);
                        console.log('✅ Example plans loaded successfully');
                        return;
                    } else {
                        console.warn('⚠️ Could not find both regular and locked plans:', {
                            regularPlanFound: !!regularPlan,
                            lockedPlanFound: !!lockedPlan
                        });
                    }
                }

                // Continue with normal initialization if no example plan found
                console.log('➡️ Continuing with normal initialization...');
                let loaded = false;
                let lockedLoaded = false;
                let mainPlan = null;
                let lockedPlan = null;

                if (ENABLE_AUTO_PERSIST_PLAN) {
                    const stored = localStorage.getItem(LOCALSTORAGE_PLAN_KEY);
                    const storedLocked = localStorage.getItem(LOCALSTORAGE_PLAN_LOCKED_KEY);

                    if (stored) {
                        try {
                            mainPlan = JSON.parse(stored);
                            loaded = true;
                        } catch (e) {
                            console.warn('Failed to parse plan from localStorage:', e);
                        }
                    }

                    if (storedLocked) {
                        try {
                            lockedPlan = JSON.parse(storedLocked);
                            lockedLoaded = true;
                        } catch (e) {
                            console.warn('Failed to parse locked plan from localStorage:', e);
                        }
                    }
                }

                // If no stored plans, use defaults
                if (!loaded) {
                    mainPlan = defaultPlanData;
                }
                if (!lockedLoaded) {
                    lockedPlan = defaultLockedPlanData;
                }

                // Load the plans
                loadPlanData(mainPlan, lockedPlan);
                setIsInitialized(true);

            } catch (error) {
                console.error('Loading Default Plans:', error);
                // Load default plans as fallback
                loadPlanData(defaultPlanData, defaultLockedPlanData);
                setIsInitialized(true);
            }
        };

        tryLoadPlan();
    }, [isInitialized, fetchDefaultPlans, loadPlanData]);

    // Effect to handle simulation triggering after plan updates
    useEffect(() => {
        if (shouldTriggerSimulation && isVisualizationReady && plan) {
            // Reset the flag first to avoid infinite loops
            setShouldTriggerSimulation(false);
            // Trigger simulation after a short delay to ensure plan is fully updated
            setTimeout(() => {
                if (triggerSimulationRef.current) {
                    triggerSimulationRef.current();
                }
            }, 100);
        }
    }, [shouldTriggerSimulation, isVisualizationReady, plan]);

    // Helper function to add current view range to plan
    const addViewRangeToPlan = useCallback((planToUpdate: Plan): Plan => {
        const currentRange = currentVisualizationRangeRef.current;
        if (!currentRange || !planToUpdate.birth_date) {
            return planToUpdate;
        }

        const birthDate = new Date(planToUpdate.birth_date + 'T00:00:00');
        const startDate = new Date(birthDate.getTime() + currentRange.startDay * 24 * 60 * 60 * 1000);
        const endDate = new Date(birthDate.getTime() + currentRange.endDay * 24 * 60 * 60 * 1000);

        console.log("startDate: ", startDate);
        console.log("endDate: ", endDate);

        return {
            ...planToUpdate,
            view_start_date: startDate.toISOString().split('T')[0],
            view_end_date: endDate.toISOString().split('T')[0]
        };
    }, []);

    // --- Auto-save plan to localStorage on every change ---
    useEffect(() => {
        if (!ENABLE_AUTO_PERSIST_PLAN) return;
        if (!plan) return;
        if (!isVisualizationReady) {
            console.warn('Visualization not ready, skipping auto-save.');
            return;
        }
        try {
            const planToSave = addViewRangeToPlan(plan);
            localStorage.setItem(LOCALSTORAGE_PLAN_KEY, JSON.stringify(planToSave));

            // --- Upsert anonymous plan if anon key exists ---
            const anonId = localStorage.getItem('anon_id');
            if (anonId && typeof upsertAnonymousPlan === 'function') {
                const planName = planToSave.title || 'Anonymous Plan';
                upsertAnonymousPlan(planName, planToSave);
            }
        } catch (e) {
            console.warn('Failed to save plan to localStorage:', e);
        }
    }, [plan, addViewRangeToPlan, isVisualizationReady]);

    // --- Auto-save plan_locked to localStorage on every change ---
    useEffect(() => {
        if (!ENABLE_AUTO_PERSIST_PLAN) return;
        if (!plan_locked) return;
        try {
            localStorage.setItem(LOCALSTORAGE_PLAN_LOCKED_KEY, JSON.stringify(plan_locked));
        } catch (e) {
            console.warn('Failed to save locked plan to localStorage:', e);
        }
    }, [plan_locked]);

    // Check for onboarding completion and set highest onboarding state
    useEffect(() => {
        const hasCompletedOnboarding = Boolean(localStorage.getItem('onboarding-completed'));
        if (hasCompletedOnboarding) {
            updateOnboardingState('full');
        }
    }, [updateOnboardingState]);

    // --- Perform a save when visualization becomes ready (to handle delayed saves) ---
    useEffect(() => {
        if (!ENABLE_AUTO_PERSIST_PLAN) return;
        if (!plan) return;
        if (!isVisualizationReady) return;

        // Only save if we have a current range to avoid overwriting with null
        if (currentVisualizationRangeRef.current) {
            try {
                const planToSave = addViewRangeToPlan(plan);
                localStorage.setItem(LOCALSTORAGE_PLAN_KEY, JSON.stringify(planToSave));
                console.log('📅Saving plan with anon key to the supabase');

                // --- Upsert anonymous plan if anon key exists ---
                const anonId = localStorage.getItem('anon_id');
                if (anonId && typeof upsertAnonymousPlan === 'function') {
                    const planName = planToSave.title || 'Anonymous Plan';
                    upsertAnonymousPlan(planName, planToSave);
                }
            } catch (e) {
                console.warn('Failed to save plan to localStorage during delayed save:', e);
            }
        }
    }, [isVisualizationReady, plan, addViewRangeToPlan, upsertAnonymousPlan]);

    const loadPlan = useCallback((planData: Plan) => {
        loadPlanData(planData);
    }, [loadPlanData]);

    const savePlan = useCallback(() => {
        if (!plan) {
            throw new Error('No plan data to save');
        }
        const planToSave = addViewRangeToPlan(plan);
        return JSON.stringify(planToSave, null, 2);
    }, [plan, addViewRangeToPlan]);

    const loadPlanFromFile = useCallback(async (file: File) => {
        try {
            const text = await file.text();
            const planData = JSON.parse(text) as Plan;
            loadPlanData(planData);
        } catch (error) {
            console.error('Error loading plan from file:', error);
            throw error;
        }
    }, [loadPlanData]);

    const savePlanToFile = useCallback(() => {
        if (!plan) {
            throw new Error('No plan data to save');
        }
        const planToSave = addViewRangeToPlan(plan);
        const fileName = getPlanFileName(planToSave.title);
        const blob = new Blob([JSON.stringify(planToSave, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [plan, addViewRangeToPlan]);

    const updateParameter = useCallback((eventId: number, parameterType: string, newValue: number | string) => {
        if (!plan) {
            throw new Error('No plan data available');
        }

        setPlan(prevPlan => {
            if (!prevPlan) return null;

            const updatedEvents = prevPlan.events.map(event => {
                // Check if this is the main event we're looking for
                if (event.id === eventId) {
                    const updatedParameters = event.parameters.map(param => {
                        if (param.type === parameterType) {
                            return { ...param, value: newValue };
                        }
                        return param;
                    });
                    return { ...event, parameters: updatedParameters };
                }

                // Check updating_events if they exist
                if (event.updating_events) {
                    const updatedUpdatingEvents = event.updating_events.map(updatingEvent => {
                        if (updatingEvent.id === eventId) {
                            const updatedParameters = updatingEvent.parameters.map(param => {
                                if (param.type === parameterType) {
                                    return { ...param, value: newValue };
                                }
                                return param;
                            });
                            return { ...updatingEvent, parameters: updatedParameters };
                        }
                        return updatingEvent;
                    });
                    return { ...event, updating_events: updatedUpdatingEvents };
                }

                return event;
            });

            const updatedPlan = { ...prevPlan, events: updatedEvents };

            // Add to history stack after updating
            addToStack(updatedPlan);

            return updatedPlan;
        });

        // Set flag to trigger simulation after parameter update
        setShouldTriggerSimulation(true);
    }, [plan, addToStack]);

    const deleteEvent = useCallback((eventId: number) => {
        if (!plan) {
            throw new Error('No plan data available');
        }

        setPlan(prevPlan => {
            if (!prevPlan) return null;

            // First check if it's a main event
            const mainEventIndex = prevPlan.events.findIndex(event => event.id === eventId);
            if (mainEventIndex !== -1) {
                // Remove the main event
                const updatedEvents = [...prevPlan.events];
                updatedEvents.splice(mainEventIndex, 1);
                const updatedPlan = { ...prevPlan, events: updatedEvents };

                // Add to history stack after deleting
                addToStack(updatedPlan);

                return updatedPlan;
            }

            // If not a main event, check updating_events
            const updatedEvents = prevPlan.events.map(event => {
                if (event.updating_events) {
                    const updatedUpdatingEvents = event.updating_events.filter(
                        updatingEvent => updatingEvent.id !== eventId
                    );
                    return { ...event, updating_events: updatedUpdatingEvents };
                }
                return event;
            });

            const updatedPlan = { ...prevPlan, events: updatedEvents };

            // Add to history stack after deleting
            addToStack(updatedPlan);

            return updatedPlan;
        });

        // Set flag to trigger simulation after state update
        setShouldTriggerSimulation(true);
    }, [plan, addToStack]);

    const addEvent = useCallback((
        eventType: string,
        parameterOverrides?: { [type: string]: any },
        replaceExisting?: boolean
    ) => {
        if (!plan || !schema) {
            throw new Error('No plan or schema data available');
        }

        // Find the event type in the schema
        const eventSchema = schema.events.find(e => e.type === eventType);
        if (!eventSchema) {
            throw new Error(`Event type ${eventType} not found in schema`);
        }

        // If replaceExisting is true, delete existing events of this type
        if (replaceExisting) {
            deleteEventsByType(eventType);
        }

        // --- NEW: Check for envelope parameters and add missing envelopes ---
        let newEnvelopes = [...plan.envelopes];
        const planEnvelopeNames = newEnvelopes.map(e => e.name);
        eventSchema.parameters.forEach(param => {
            if (
                param.parameter_units === 'envelope' &&
                typeof param.default === 'string' &&
                !planEnvelopeNames.includes(param.default)
            ) {
                const defaultEnvelope = schema.default_envelopes?.find(env => env.name === param.default);
                if (defaultEnvelope) {
                    newEnvelopes.push({ ...defaultEnvelope });
                    planEnvelopeNames.push(defaultEnvelope.name);
                }
            }
        });

        // Generate a new unique ID
        const newId = getNextEventId(plan);

        // Create parameters with default values from schema, overridden by parameterOverrides
        const parameters = eventSchema.parameters.map((param, index) => {
            let value = param.default;
            const wasOverridden = parameterOverrides && parameterOverrides.hasOwnProperty(param.type);

            if (wasOverridden) {
                value = parameterOverrides[param.type];
            } else if (
                param.parameter_units === 'date' &&
                typeof value === 'number'
            ) {
                // Calculate total days since birth and convert to date string
                const totalDays = value + currentDay;
                value = daysSinceBirthToDateString(totalDays, plan.birth_date);
            }

            console.log("param.type: ", param.type, "value: ", value, "wasOverridden:", wasOverridden);
            return {
                id: index,
                type: param.type,
                value
            };
        });

        // Create event functions from schema if they exist
        const eventFunctions = eventSchema.event_functions_parts?.map(func => ({
            title: func.title,
            enabled: func.default_state
        })) || [];

        // Create the new event
        const newEvent: Event = {
            id: newId,
            type: eventType,
            title: eventSchema.default_title || '', // Use default title from schema or blank string
            description: eventSchema.description,
            is_recurring: eventSchema.is_recurring || false,
            parameters: parameters,
            updating_events: [],
            event_functions: eventFunctions
        };

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const updatedPlan = {
                ...prevPlan,
                events: [...prevPlan.events, newEvent],
                envelopes: newEnvelopes
            };

            // Add to history stack after adding event
            addToStack(updatedPlan);

            return updatedPlan;
        });

        // Set flag to trigger simulation after state update
        setShouldTriggerSimulation(true);

        return newId;
    }, [plan, schema, addToStack]);

    const addUpdatingEvent = useCallback((mainEventId: number, updatingEventType: string) => {
        if (!plan || !schema) {
            throw new Error('No plan or schema data available');
        }

        // Find the main event
        const mainEvent = plan.events.find(e => e.id === mainEventId);
        if (!mainEvent) {
            throw new Error(`Main event with ID ${mainEventId} not found`);
        }

        // Find the main event type in schema
        const mainEventSchema = schema.events.find(e => e.type === mainEvent.type);
        if (!mainEventSchema) {
            throw new Error(`Main event type ${mainEvent.type} not found in schema`);
        }

        // Find the updating event type in the main event's updating_events
        const updatingEventSchema = mainEventSchema.updating_events?.find(
            e => e.type === updatingEventType
        );
        if (!updatingEventSchema) {
            throw new Error(`Updating event type ${updatingEventType} not found in schema for ${mainEvent.type}`);
        }

        // Generate a new unique ID for the updating event
        const newId = getNextEventId(plan);

        // Create parameters with default values from schema
        const parameters = updatingEventSchema.parameters.map((param, index) => ({
            id: index,
            type: param.type,
            value: param.default
        }));

        // For date parameters, add the main event's start_time
        parameters.forEach(param => {
            // Get the parameter schema to check parameter_units
            const paramSchema = updatingEventSchema.parameters.find(p => p.type === param.type);
            if (paramSchema && paramSchema.parameter_units === 'date') {
                const mainEventStartTime = mainEvent.parameters.find(p => p.type === 'start_time')?.value;
                if (typeof mainEventStartTime === 'string') {
                    // Convert main event's date string to days since birth, add offset, then convert back to date string
                    const mainEventDays = dateStringToDaysSinceBirth(mainEventStartTime, plan.birth_date);
                    const totalDays = mainEventDays + Number(param.value);
                    param.value = daysSinceBirthToDateString(totalDays, plan.birth_date);
                }
            }
        });

        // Create event functions from schema if they exist
        const updatingEventFunctions = updatingEventSchema.event_functions_parts?.map(func => ({
            title: func.title,
            enabled: func.default_state
        })) || [];

        // Create the new updating event
        const newUpdatingEvent: UpdatingEvent = {
            id: newId,
            type: updatingEventType,
            title: updatingEventSchema.default_title || '', // Use default title from schema or blank string
            description: updatingEventSchema.description,
            is_recurring: updatingEventSchema.is_recurring || false,
            parameters: parameters,
            event_functions: updatingEventFunctions
        };

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const updatedPlan = {
                ...prevPlan,
                events: prevPlan.events.map(event => {
                    if (event.id === mainEventId) {
                        return {
                            ...event,
                            updating_events: [...(event.updating_events || []), newUpdatingEvent]
                        };
                    }
                    return event;
                })
            };

            // Add to history stack after adding updating event
            addToStack(updatedPlan);

            return updatedPlan;
        });

        return newId;
    }, [plan, schema, addToStack]);

    const getEventIcon = useCallback((eventType: string, event?: Event | UpdatingEvent) => {
        if (!schema) return null;

        // For life events, use the icon from the event parameter if available
        if (eventType === 'life_event' && event) {
            const iconParam = event.parameters?.find(p => p.type === 'icon');
            if (iconParam && typeof iconParam.value === 'string') {
                const lucideIconName = iconMap[iconParam.value] || 'Circle';
                const IconComponent = (LucideIcons as any)[lucideIconName] || LucideIcons.Circle;
                return <IconComponent size={20} />;
            }
        }

        // Default behavior for non-life events or when no icon parameter is found
        let eventSchema = schema.events.find(e => e.type === eventType);
        let iconName = eventSchema?.icon;
        // If not found, try updating events
        if (!iconName) {
            for (const evt of schema.events) {
                const updating = evt.updating_events?.find(ue => ue.type === eventType);
                if (updating) {
                    iconName = updating.icon;
                    break;
                }
            }
        }
        if (!iconName) iconName = 'Circle';
        const lucideIconName = iconMap[iconName] || 'Circle';
        const IconComponent = (LucideIcons as any)[lucideIconName] || LucideIcons.Circle;
        return <IconComponent size={20} />;
    }, [schema]);

    const getEventDisplayType = useCallback((eventType: string) => {
        if (!schema) return eventType;
        const eventSchema = schema.events.find(e => e.type === eventType);
        if (eventSchema?.display_type) return eventSchema.display_type;
        // Look for updating_events
        for (const evt of schema.events) {
            const updating = evt.updating_events?.find(ue => ue.type === eventType);
            if (updating && updating.display_type) {
                return updating.display_type;
            }
        }
        return eventType;
    }, [schema]);

    const getParameterDisplayName = useCallback((eventType: string, parameterType: string) => {
        if (!schema) return parameterType;
        // Try main events first
        let eventSchema = schema.events.find(e => e.type === eventType);
        let parameter;
        if (eventSchema) {
            parameter = eventSchema.parameters.find(p => p.type === parameterType);
        }
        // If not found, try updating events
        if (!parameter) {
            for (const evt of schema.events) {
                const updating = evt.updating_events?.find(ue => ue.type === eventType);
                if (updating) {
                    parameter = updating.parameters.find(p => p.type === parameterType);
                    if (parameter) break;
                }
            }
        }
        return parameter?.display_name || parameterType;
    }, [schema]);

    const getParameterUnits = useCallback((eventType: string, parameterType: string) => {
        if (!schema) return '';
        // Try main events first
        let eventSchema = schema.events.find(e => e.type === eventType);
        let parameter;
        if (eventSchema) {
            parameter = eventSchema.parameters.find(p => p.type === parameterType);
        }
        // If not found, try updating events
        if (!parameter) {
            for (const evt of schema.events) {
                const updating = evt.updating_events?.find(ue => ue.type === eventType);
                if (updating) {
                    parameter = updating.parameters.find(p => p.type === parameterType);
                    if (parameter) break;
                }
            }
        }
        return parameter?.parameter_units || '';
    }, [schema]);

    const getParameterDescription = useCallback((eventType: string, parameterType: string) => {
        if (!schema) return '';
        // Try main events first
        let eventSchema = schema.events.find(e => e.type === eventType);
        let parameter;
        if (eventSchema) {
            parameter = eventSchema.parameters.find(p => p.type === parameterType);
        }
        // If not found, try updating events
        if (!parameter) {
            for (const evt of schema.events) {
                const updating = evt.updating_events?.find(ue => ue.type === eventType);
                if (updating) {
                    parameter = updating.parameters.find(p => p.type === parameterType);
                    if (parameter) break;
                }
            }
        }
        return parameter?.description || '';
    }, [schema]);

    const updateEventDescription = useCallback((eventId: number, newDescription: string) => {
        if (!plan) {
            throw new Error('No plan data available');
        }
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            // Try to update main event first
            const updatedEvents = prevPlan.events.map(event => {
                if (event.id === eventId) {
                    return { ...event, description: newDescription };
                }
                // Try updating events
                if (event.updating_events) {
                    const updatedUpdatingEvents = event.updating_events.map(updatingEvent => {
                        if (updatingEvent.id === eventId) {
                            return { ...updatingEvent, description: newDescription };
                        }
                        return updatingEvent;
                    });
                    return { ...event, updating_events: updatedUpdatingEvents };
                }
                return event;
            });
            const updatedPlan = { ...prevPlan, events: updatedEvents };

            // Add to history stack after updating description
            addToStack(updatedPlan);

            return updatedPlan;
        });
    }, [plan, addToStack]);

    const updateEventTitle = useCallback((eventId: number, newTitle: string) => {
        if (!plan) {
            throw new Error('No plan data available');
        }
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            // Try to update main event first
            const updatedEvents = prevPlan.events.map(event => {
                if (event.id === eventId) {
                    return { ...event, title: newTitle };
                }
                // Try updating events
                if (event.updating_events) {
                    const updatedUpdatingEvents = event.updating_events.map(updatingEvent => {
                        if (updatingEvent.id === eventId) {
                            return { ...updatingEvent, title: newTitle };
                        }
                        return updatingEvent;
                    });
                    return { ...event, updating_events: updatedUpdatingEvents };
                }
                return event;
            });
            const updatedPlan = { ...prevPlan, events: updatedEvents };

            // Add to history stack after updating title
            addToStack(updatedPlan);

            return updatedPlan;
        });
    }, [plan, addToStack]);

    const updatePlanTitle = useCallback((newTitle: string) => {
        if (!plan) {
            throw new Error('No plan data available');
        }
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const updatedPlan = { ...prevPlan, title: newTitle };

            // Add to history stack after updating plan title
            addToStack(updatedPlan);

            return updatedPlan;
        });
    }, [plan, addToStack]);

    const updateBirthDate = useCallback((birthDateString: string) => {
        if (!plan) {
            throw new Error('No plan data available');
        }
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            return { ...prevPlan, birth_date: birthDateString };
        });
    }, [plan]);

    // Set adjust_for_inflation flag
    const setAdjustForInflation = useCallback((value: boolean) => {
        if (!plan) {
            throw new Error('No plan data available');
        }
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const updatedPlan = { ...prevPlan, adjust_for_inflation: value };

            // Add to history stack after updating inflation setting
            addToStack(updatedPlan);

            return updatedPlan;
        });
        setShouldTriggerSimulation(true);
    }, [plan, addToStack]);

    // Calculate currentDay from plan.birth_date and today
    let currentDay = 0;
    if (plan && plan.birth_date) {
        const birthDate = new Date(plan.birth_date);
        const today = new Date();
        currentDay = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    const updatePlanInflationRate = useCallback((newRate: number) => {
        if (!plan) {
            throw new Error('No plan data available');
        }
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            return { ...prevPlan, inflation_rate: newRate };
        });
    }, [plan]);

    // Add updateRetirementGoal method
    const updateRetirementGoal = useCallback((newGoal: number) => {
        if (!plan) {
            throw new Error('No plan data available');
        }
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            return { ...prevPlan, retirement_goal: newGoal };
        });
    }, [plan]);

    // --- Add lockPlan method ---
    const lockPlan = useCallback(() => {
        // Ensure no shared references by deep cloning when swapping
        const temp = plan_locked ? deepClonePlan(plan_locked) : null;
        setPlanLocked(plan ? deepClonePlan(plan) : null);
        setPlan(temp as any);
        setShouldTriggerSimulation(true);
        console.log("plan_locked", plan_locked);
        console.log("plan", plan);
    }, [plan, plan_locked]);

    const copyPlanToLock = useCallback(() => {
        if (!plan) return;
        // Deep clone to avoid mutating original when locked plan changes
        setPlanLocked(deepClonePlan(plan));
        // Ensure simulation is triggered after plan is locked
        setTimeout(() => {
            setShouldTriggerSimulation(true);
        }, 0);
    }, [plan]);

    const getEventDisclaimer = useCallback((eventType: string) => {
        if (!schema) return '';
        const eventSchema = schema.events.find(e => e.type === eventType);
        return eventSchema?.disclaimer || '';
    }, [schema]);

    const getParameterOptions = useCallback((eventType: string, parameterType: string) => {
        if (!schema) return [];
        // Try main events first
        let eventSchema = schema.events.find(e => e.type === eventType);
        let parameter;
        if (eventSchema) {
            parameter = eventSchema.parameters.find(p => p.type === parameterType);
        }
        // If not found, try updating events
        if (!parameter) {
            for (const evt of schema.events) {
                const updating = evt.updating_events?.find(ue => ue.type === eventType);
                if (updating) {
                    parameter = updating.parameters.find(p => p.type === parameterType);
                    if (parameter) break;
                }
            }
        }
        return parameter?.options || [];
    }, [schema]);

    // Helper to check if the current event can be recurring based on schema
    const canEventBeRecurring = useCallback((eventId: number): boolean => {
        if (!schema || !plan) return false;
        const { event, parentEvent } = findEventOrUpdatingEventById(plan, eventId);
        if (!event) return false;

        if (parentEvent) {
            // This is an updating event, check in updating_events schema
            const mainSchemaEvent = schema.events.find(e => e.type === (parentEvent as any).type);
            const updatingSchemaEvent = mainSchemaEvent?.updating_events?.find(ue => ue.type === (event as any).type);
            return (updatingSchemaEvent as any)?.can_be_reocurring === true;
        } else {
            // This is a main event
            const schemaEvent = schema.events.find(e => e.type === (event as any).type);
            return (schemaEvent as any)?.can_be_reocurring === true;
        }
    }, [schema, plan]);

    // Function to update event recurring status
    const updateEventRecurring = useCallback((eventId: number, isRecurring: boolean) => {
        if (!plan) {
            throw new Error('No plan data available');
        }

        setPlan(prevPlan => {
            if (!prevPlan) return null;

            const updatedEvents = prevPlan.events.map(event => {
                // Check if this is the main event we're looking for
                if (event.id === eventId) {
                    return { ...event, is_recurring: isRecurring };
                }

                // Check updating_events if they exist
                if (event.updating_events) {
                    const updatedUpdatingEvents = event.updating_events.map(updatingEvent => {
                        if (updatingEvent.id === eventId) {
                            return { ...updatingEvent, is_recurring: isRecurring };
                        }
                        return updatingEvent;
                    });
                    return { ...event, updating_events: updatedUpdatingEvents };
                }

                return event;
            });

            const updatedPlan = { ...prevPlan, events: updatedEvents };

            // Add to history stack after updating recurring status
            addToStack(updatedPlan);

            return updatedPlan;
        });

        // Set flag to trigger simulation after recurring status update
        setShouldTriggerSimulation(true);
    }, [plan, addToStack]);

    // Check if plan has events of a specific type
    const hasEventType = useCallback((eventType: string): boolean => {
        if (!plan) return false;
        return plan.events.some(event => event.type === eventType);
    }, [plan]);

    // Delete all events of a specific type
    const deleteEventsByType = useCallback((eventType: string) => {
        if (!plan) {
            throw new Error('No plan data available');
        }

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const updatedPlan = {
                ...prevPlan,
                events: prevPlan.events.filter(event => event.type !== eventType)
            };

            // Add to history stack after deleting events by type
            addToStack(updatedPlan);

            return updatedPlan;
        });
    }, [plan, addToStack]);

    const getEnvelopeDisplayName = useCallback((envelopeName: string): string => {
        const otherMatch = envelopeName.match(/^Other \((.+)\)$/);
        return otherMatch ? otherMatch[1] : envelopeName;
    }, []);

    const captureVisualizationAsSVG = useCallback(() => {
        if (!plan) return null;

        // Find the visualization SVG element - look for the main visualization SVG
        const svgElement = document.querySelector('.visualization-container svg') as SVGSVGElement;

        if (!svgElement) {
            console.warn('Visualization SVG element not found');
            return null;
        }

        // Serialize the SVG element to a string directly
        try {
            const svgData = new XMLSerializer().serializeToString(svgElement);
            return svgData;
        } catch (error) {
            console.error('Error capturing SVG as string:', error);
            return null;
        }
    }, [plan]);

    const getCurrentVisualizationRange = useCallback(() => {
        // First try to get the actual visualization range
        if (currentVisualizationRangeRef.current) {
            //console.log("PlanContext - getCurrentVisualizationRange: using actual visualization range:", currentVisualizationRangeRef.current);
            return currentVisualizationRangeRef.current;
        }

        // Fallback to plan's stored view dates
        if (!plan || !plan.view_start_date || !plan.view_end_date) {
            console.log("PlanContext - getCurrentVisualizationRange: no plan or view dates, returning null");
            return null;
        }
        const birthDate = new Date(plan.birth_date + 'T00:00:00');
        const startDate = new Date(plan.view_start_date + 'T00:00:00');
        const endDate = new Date(plan.view_end_date + 'T00:00:00');

        const startDay = Math.floor((startDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
        const endDay = Math.floor((endDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

        const result = { startDay, endDay };
        //console.log("PlanContext - getCurrentVisualizationRange: using plan view dates:", result);
        return result;
    }, [plan]);

    const convertDateParametersToDays = useCallback((events: any[]) => {
        if (!schema || !plan) return events;

        return events.map(event => {
            const convertedEvent = { ...event };

            if (convertedEvent.parameters) {
                convertedEvent.parameters = convertedEvent.parameters.map((param: any) => {
                    const convertedParam = { ...param };

                    // Find the event schema to get parameter definitions
                    const eventSchema = schema.events.find((e: any) => e.type === event.type);
                    if (eventSchema) {
                        const paramSchema = eventSchema.parameters.find((p: any) => p.type === param.type);
                        if (paramSchema && paramSchema.parameter_units === 'date') {
                            // Convert date string parameters to days since birth
                            if (typeof param.value === 'string') {
                                convertedParam.value = dateStringToDaysSinceBirth(param.value, plan.birth_date);
                            }
                        }
                    }

                    return convertedParam;
                });
            }

            // Handle updating events
            if (convertedEvent.updating_events) {
                convertedEvent.updating_events = convertedEvent.updating_events.map((updatingEvent: any) => {
                    const convertedUpdatingEvent = { ...updatingEvent };

                    if (convertedUpdatingEvent.parameters) {
                        convertedUpdatingEvent.parameters = convertedUpdatingEvent.parameters.map((param: any) => {
                            const convertedParam = { ...param };

                            // Find the updating event schema to get parameter definitions
                            const mainEventSchema = schema.events.find((e: any) => e.type === event.type);
                            if (mainEventSchema?.updating_events) {
                                const updatingEventSchema = mainEventSchema.updating_events.find((ue: any) => ue.type === updatingEvent.type);
                                if (updatingEventSchema) {
                                    const paramSchema = updatingEventSchema.parameters.find((p: any) => p.type === param.type);
                                    if (paramSchema && paramSchema.parameter_units === 'date') {
                                        // Convert date string parameters to days since birth
                                        if (typeof param.value === 'string') {
                                            convertedParam.value = dateStringToDaysSinceBirth(param.value, plan.birth_date);
                                        }
                                    }
                                }
                            }

                            return convertedParam;
                        });
                    }

                    return convertedUpdatingEvent;
                });
            }

            return convertedEvent;
        });
    }, [schema, plan]);

    // Event functions methods
    const getEventFunctionsParts = useCallback((eventType: string): SchemaEventFunctionParts[] => {
        if (!schema) return [];
        const eventSchema = schema.events.find(e => e.type === eventType);
        return eventSchema?.event_functions_parts || [];
    }, [schema]);

    const getEventFunctionPartsIcon = useCallback((eventType: string, functionTitle: string): React.ReactNode => {
        if (!schema) return null;
        const eventSchema = schema.events.find(e => e.type === eventType);
        const eventFunction = eventSchema?.event_functions_parts?.find(f => f.title === functionTitle);
        if (!eventFunction) return null;

        const lucideIconName = iconMap[eventFunction.icon] || 'Circle';
        const IconComponent = (LucideIcons as any)[lucideIconName] || LucideIcons.Circle;
        return <IconComponent size={20} />;
    }, [schema]);

    const getEventFunctionPartsDescription = useCallback((eventType: string, functionTitle: string): string => {
        if (!schema) return '';
        const eventSchema = schema.events.find(e => e.type === eventType);
        const eventFunction = eventSchema?.event_functions_parts?.find(f => f.title === functionTitle);
        return eventFunction?.description || '';
    }, [schema]);

    const updateEventFunctionParts = useCallback((eventId: number, functionTitle: string, enabled: boolean) => {
        if (!plan) {
            throw new Error('No plan data available');
        }

        setPlan(prevPlan => {
            if (!prevPlan) return null;

            const updatedEvents = prevPlan.events.map(event => {
                // Check if this is the main event we're looking for
                if (event.id === eventId) {
                    const updatedEventFunctions = event.event_functions?.map(func =>
                        func.title === functionTitle ? { ...func, enabled } : func
                    ) || [];

                    // If no event functions exist yet, create them from schema
                    if (updatedEventFunctions.length === 0 && schema) {
                        const eventSchema = schema.events.find(e => e.type === event.type);
                        if (eventSchema?.event_functions_parts) {
                            updatedEventFunctions.push(...eventSchema.event_functions_parts.map(func => ({
                                title: func.title,
                                enabled: func.title === functionTitle ? enabled : func.default_state
                            })));
                        }
                    }

                    return { ...event, event_functions: updatedEventFunctions };
                }

                // Check updating_events if they exist
                if (event.updating_events) {
                    const updatedUpdatingEvents = event.updating_events.map(updatingEvent => {
                        if (updatingEvent.id === eventId) {
                            const updatedEventFunctions = updatingEvent.event_functions?.map(func =>
                                func.title === functionTitle ? { ...func, enabled } : func
                            ) || [];

                            // If no event functions exist yet, create them from schema
                            if (updatedEventFunctions.length === 0 && schema) {
                                const mainEventSchema = schema.events.find(e => e.type === event.type);
                                const updatingEventSchema = mainEventSchema?.updating_events?.find(ue => ue.type === updatingEvent.type);
                                if (updatingEventSchema?.event_functions_parts) {
                                    updatedEventFunctions.push(...updatingEventSchema.event_functions_parts.map(func => ({
                                        title: func.title,
                                        enabled: func.title === functionTitle ? enabled : func.default_state
                                    })));
                                }
                            }

                            return { ...updatingEvent, event_functions: updatedEventFunctions };
                        }
                        return updatingEvent;
                    });
                    return { ...event, updating_events: updatedUpdatingEvents };
                }

                return event;
            });

            const updatedPlan = { ...prevPlan, events: updatedEvents };

            // Add to history stack after updating event function
            addToStack(updatedPlan);

            return updatedPlan;
        });

        // Set flag to trigger simulation after event function update
        setShouldTriggerSimulation(true);
    }, [plan, schema, addToStack]);

    const getEventFunctionPartsState = useCallback((eventId: number, functionTitle: string): boolean => {
        if (!plan) return false;

        const { event } = findEventOrUpdatingEventById(plan, eventId);
        if (!event) return false;

        // Check if the event has event functions
        if (event.event_functions) {
            const eventFunction = event.event_functions.find(f => f.title === functionTitle);
            if (eventFunction) {
                return eventFunction.enabled;
            }
        }

        // If no event functions found, check schema for default state
        if (schema) {
            const eventSchema = schema.events.find(e => e.type === event.type);
            const eventFunction = eventSchema?.event_functions_parts?.find(f => f.title === functionTitle);
            return eventFunction?.default_state || false;
        }

        return false;
    }, [plan, schema]);

    // Get onboarding stage for an event type
    const getEventOnboardingStage = useCallback((eventType: string): string | undefined => {
        if (!schema) return undefined;

        // Try main events first
        const eventSchema = schema.events.find(e => e.type === eventType);
        if (eventSchema?.onboarding_stage) {
            return eventSchema.onboarding_stage;
        }

        // If not found, try updating events
        for (const evt of schema.events) {
            const updating = evt.updating_events?.find(ue => ue.type === eventType);
            if (updating?.onboarding_stage) {
                return updating.onboarding_stage;
            }
        }

        return undefined;
    }, [schema]);

    const value = {
        plan,
        plan_locked, // <-- add to context value
        schema,
        loadPlan,
        savePlan,
        loadPlanFromFile,
        savePlanToFile,
        updateParameter,
        deleteEvent,
        addEvent,
        addUpdatingEvent,
        getEventIcon,
        getEventDisplayType,
        getParameterDisplayName,
        getParameterUnits,
        getParameterDescription,
        updateEventDescription,
        updateEventTitle,
        updatePlanTitle,
        updateBirthDate,
        getEventDisclaimer,
        getParameterOptions,
        setAdjustForInflation,
        currentDay,
        updatePlanInflationRate, // <-- add to context value
        lockPlan, // <-- add to context value
        copyPlanToLock, // <-- add this
        updateRetirementGoal, // <-- add to context value
        canEventBeRecurring, // <-- add to context value
        updateEventRecurring, // <-- add to context value
        hasEventType, // <-- add to context value
        deleteEventsByType, // <-- add to context value
        getEnvelopeDisplayName, // <-- add to context value
        captureVisualizationAsSVG, // <-- add to context value
        setVisualizationDateRange, // <-- add to context value
        setZoomToDateRange: (startDay: number, endDay: number) => {
            // Use the ref if available, otherwise log a warning
            if (setZoomToDateRangeRef.current) {
                setZoomToDateRangeRef.current(startDay, endDay);
            } else {
                console.warn('setZoomToDateRange called but Visualization component not ready yet');
            }
        }, // <-- add to context value
        registerSetZoomToDateRange: (fn: (startDay: number, endDay: number) => void) => {
            setZoomToDateRangeRef.current = fn;
        }, // <-- add to context value
        registerCurrentVisualizationRange: (range: { startDay: number; endDay: number } | null) => {
            currentVisualizationRangeRef.current = range;
        }, // <-- add to context value
        getCurrentVisualizationRange, // <-- add to context value
        setVisualizationReady: (ready: boolean) => {
            setIsVisualizationReady(ready);
        },
        convertDateParametersToDays, // <-- add to context value
        triggerSimulation: () => {
            // Use the ref if available, otherwise log a warning
            if (triggerSimulationRef.current) {
                triggerSimulationRef.current();
            } else {
                console.warn('triggerSimulation called but Visualization component not ready yet');
            }
        },
        registerTriggerSimulation: (fn: () => void) => {
            triggerSimulationRef.current = fn;
        },
        handleZoomToWindow: (options: { years?: number; months?: number; days?: number }) => {
            // Use the ref if available, otherwise log a warning
            if (handleZoomToWindowRef.current) {
                handleZoomToWindowRef.current(options);
            } else {
                console.warn('handleZoomToWindow called but Visualization component not ready yet');
            }
        },
        registerHandleZoomToWindow: (fn: (options: { years?: number; months?: number; days?: number }) => void) => {
            handleZoomToWindowRef.current = fn;
        },
        updatePlanDirectly: (planData: Plan) => {
            // Direct plan update without triggering viewing window reset
            setPlan(planData);
        },
        updateLockedPlanDirectly: (planData: Plan) => {
            // Direct locked plan update without triggering viewing window reset
            setPlanLocked(deepClonePlan(planData));
        },
        isExampleViewing, // Add this to the context value
        isUxTester, // Expose UX tester flag in context
        daysSinceBirthToDateString, // Add this for date conversion
        isCompareMode,
        setCompareMode,
        undo, // <-- add to context value
        redo, // <-- add to context value
        addToStack, // <-- add to context value
        // Event functions methods
        getEventFunctionsParts,
        getEventFunctionPartsIcon,
        getEventFunctionPartsDescription,
        updateEventFunctionParts,
        getEventFunctionPartsState,
        // Onboarding stage methods
        getEventOnboardingStage,
        restartPlan: () => {
            try {
                // Load the imported blank/default plans into both states (deep cloned)
                const freshPlan = deepClonePlan(defaultPlanData as Plan);
                const freshLocked = deepClonePlan(defaultLockedPlanData as Plan);
                setPlan(freshPlan);
                setPlanLocked(freshLocked);
                // Reset related states so we recompute with the fresh plan
                setIsVisualizationReady(false);
                setShouldTriggerSimulation(true);
                // Reset history stack to the fresh plan
                setHistory([freshPlan]);
                setHistoryIndex(0);
            } catch (e) {
                console.warn('Failed to restart plan:', e);
            }
        },
    };

    // Don't render children until we've attempted to load the default plan and schema
    if (!isInitialized || !schema) {
        return null; // Or a loading spinner
    }

    return (
        <PlanContext.Provider value={value}>
            {children}
        </PlanContext.Provider>
    );
}

// Helper to find event or updating event by id
export function findEventOrUpdatingEventById(
    plan: Plan | null,
    id: number
): { event: Event | UpdatingEvent | null; parentEvent: Event | null } {
    if (!plan) return { event: null, parentEvent: null };
    for (const event of plan.events) {
        if (event.id === id) return { event, parentEvent: null };
        if (event.updating_events) {
            for (const updatingEvent of event.updating_events) {
                if (updatingEvent.id === id) return { event: updatingEvent, parentEvent: event };
            }
        }
    }
    return { event: null, parentEvent: null };
}

// Helper to get the schema definition for an event or updating event by id
export function getEventDefinition(
    plan: Plan | null,
    schema: Schema | null,
    eventId: number
): SchemaEvent | SchemaUpdatingEvent | undefined {
    if (!plan || !schema) return undefined;
    const { event, parentEvent } = findEventOrUpdatingEventById(plan, eventId);
    if (!event) return undefined;
    if (!parentEvent) {
        // Main event
        return schema.events.find(e => e.type === (event as any).type);
    } else {
        // Updating event
        const parentSchema = schema.events.find(e => e.type === parentEvent.type);
        return parentSchema?.updating_events?.find(ue => ue.type === (event as any).type);
    }
}

// Helper to get the category of an envelope by name
export function getEnvelopeCategory(plan: Plan | null, envelopeName: string): string | undefined {
    if (!plan) return undefined;
    const env = plan.envelopes.find(e => e.name === envelopeName);
    return env?.category;
}

// Helper to get the display name for an envelope (handles "Other (category)" format)
export function getEnvelopeDisplayName(envelopeName: string): string {
    const otherMatch = envelopeName.match(/^Other \((.+)\)$/);
    return otherMatch ? otherMatch[1] : envelopeName;
}

// Helper to get the effective ID for an event (parent ID for updating events, own ID for main events)
export function getEffectiveEventId(plan: Plan | null, eventId: number): number {
    if (!plan) return eventId;
    const { event, parentEvent } = findEventOrUpdatingEventById(plan, eventId);
    return parentEvent?.id ?? eventId;
}