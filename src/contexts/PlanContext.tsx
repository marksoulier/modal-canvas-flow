import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';

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
    // Added for schema support:
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
};

// Types for the plan data structure
export interface Parameter {
    id: number;
    type: string;
    value: number | string;
}

export interface UpdatingEvent {
    id: number;
    type: string;
    description: string;
    parameters: Parameter[];
}

export interface Event {
    id: number;
    type: string;
    description: string;
    parameters: Parameter[];
    updating_events?: UpdatingEvent[];
}

export interface Envelope {
    name: string;
    category: string;
    growth: string;
    rate?: number;
    days_of_usefulness?: number;
}

export interface Plan {
    title: string;
    birth_date: string;
    inflation_rate: number;
    adjust_for_inflation: boolean;
    events: Event[];
    envelopes: Envelope[];
    retirement_goal: number; // New field for retirement goal
}

export interface SchemaParameter {
    type: string;
    display_name: string;
    parameter_units: string;
    description: string;
    default: number | string;
    options?: string[];
}

export interface SchemaUpdatingEvent {
    type: string;
    display_type: string;
    icon: string;
    description: string;
    parameters: SchemaParameter[];
}

export interface SchemaEvent {
    type: string;
    display_type: string;
    category: string;
    weight: number;
    description: string;
    icon: string;
    parameters: SchemaParameter[];
    updating_events?: SchemaUpdatingEvent[];
    disclaimer?: string;
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
    loadPlan: (planData: Plan) => void;
    savePlan: () => string;
    loadPlanFromFile: (file: File) => Promise<void>;
    savePlanToFile: () => void;
    updateParameter: (eventId: number, parameterType: string, newValue: number | string) => void;
    deleteEvent: (eventId: number) => void;
    addEvent: (eventType: string) => number;
    addUpdatingEvent: (mainEventId: number, updatingEventType: string) => number;
    getEventIcon: (eventType: string) => React.ReactNode;
    getEventDisplayType: (eventType: string) => string;
    getParameterDisplayName: (eventType: string, parameterType: string) => string;
    getParameterUnits: (eventType: string, parameterType: string) => string;
    getParameterDescription: (eventType: string, parameterType: string) => string;
    updateEventDescription: (eventId: number, newDescription: string) => void;
    updatePlanTitle: (newTitle: string) => void;
    updateBirthDate: (daysFromCurrent: number) => void;
    getEventDisclaimer: (eventType: string) => string;
    getParameterOptions: (eventType: string, parameterType: string) => string[];
    setAdjustForInflation: (value: boolean) => void;
    currentDay: number;
    updatePlanInflationRate: (newRate: number) => void; // <-- add this
    lockPlan: () => void; // <-- add this
    updateRetirementGoal: (newGoal: number) => void; // <-- add this
}

const SCHEMA_PATH = '/assets/event_schema.json';

// --- AUTO-PERSISTENCE FLAG ---
// Set this to true to enable automatic saving/loading of the plan to/from localStorage
const ENABLE_AUTO_PERSIST_PLAN = false;
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

export function PlanProvider({ children }: PlanProviderProps) {
    const [plan, setPlan] = useState<Plan | null>(null);
    const [plan_locked, setPlanLocked] = useState<Plan | null>(null); // <-- add this
    const [schema, setSchema] = useState<Schema | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load schema on mount
    useEffect(() => {
        const loadSchema = async () => {
            try {
                const response = await fetch(SCHEMA_PATH);
                if (!response.ok) {
                    throw new Error('Failed to load schema');
                }
                const schemaData = await response.json();
                setSchema(schemaData);
            } catch (error) {
                console.error('Error loading schema:', error);
                throw error;
            }
        };
        loadSchema();
    }, []);

    // --- Clean startup: load from localStorage if available, else load default plan ---
    useEffect(() => {
        if (isInitialized) return; // Prevent double init
        const tryLoadPlan = async () => {
            let loaded = false;
            let lockedLoaded = false;
            if (ENABLE_AUTO_PERSIST_PLAN) {
                const stored = localStorage.getItem(LOCALSTORAGE_PLAN_KEY);
                const storedLocked = localStorage.getItem(LOCALSTORAGE_PLAN_LOCKED_KEY);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        setPlan(parsed);
                        loaded = true;
                    } catch (e) {
                        console.warn('Failed to parse plan from localStorage:', e);
                    }
                }
                if (storedLocked) {
                    try {
                        const parsedLocked = JSON.parse(storedLocked);
                        setPlanLocked(parsedLocked);
                        lockedLoaded = true;
                    } catch (e) {
                        console.warn('Failed to parse locked plan from localStorage:', e);
                    }
                }
            }
            if (!loaded) {
                // Fallback to default plan
                try {
                    const response = await fetch('/assets/plan.json');
                    if (!response.ok) throw new Error('Failed to load default plan');
                    const defaultPlan = await response.json();
                    setPlan(defaultPlan);
                } catch (error) {
                    console.error('Error loading default plan:', error);
                }
            }
            if (!lockedLoaded) {
                // Fallback to default locked plan
                try {
                    const response = await fetch('/assets/plan_locked.json');
                    if (!response.ok) throw new Error('Failed to load default locked plan');
                    const defaultLockedPlan = await response.json();
                    setPlanLocked(defaultLockedPlan);
                } catch (error) {
                    console.error('Error loading default locked plan:', error);
                }
            }
            setIsInitialized(true);
        };
        tryLoadPlan();
    }, [isInitialized]);

    // --- Auto-save plan to localStorage on every change ---
    useEffect(() => {
        if (!ENABLE_AUTO_PERSIST_PLAN) return;
        if (!plan) return;
        try {
            localStorage.setItem(LOCALSTORAGE_PLAN_KEY, JSON.stringify(plan));
        } catch (e) {
            console.warn('Failed to save plan to localStorage:', e);
        }
    }, [plan]);

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
        const fileName = getPlanFileName(plan.title);
        const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [plan]);

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

            return { ...prevPlan, events: updatedEvents };
        });
    }, [plan]);

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
                return { ...prevPlan, events: updatedEvents };
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

            return { ...prevPlan, events: updatedEvents };
        });
    }, [plan]);

    const addEvent = useCallback((eventType: string) => {
        if (!plan || !schema) {
            throw new Error('No plan or schema data available');
        }

        // Find the event type in the schema
        const eventSchema = schema.events.find(e => e.type === eventType);
        if (!eventSchema) {
            throw new Error(`Event type ${eventType} not found in schema`);
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

        // Create parameters with default values from schema
        const parameters = eventSchema.parameters.map((param, index) => ({
            id: index,
            type: param.type,
            value: param.default
        }));

        // For the start_time and end_time parameters add the current day value
        parameters.forEach(param => {
            if (param.type === 'start_time' || param.type === 'end_time') {
                param.value = Number(param.value) + currentDay;
            }
        });

        // Create the new event
        const newEvent: Event = {
            id: newId,
            type: eventType,
            description: eventSchema.description,
            parameters: parameters,
            updating_events: []
        };

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            return {
                ...prevPlan,
                events: [...prevPlan.events, newEvent],
                envelopes: newEnvelopes
            };
        });

        return newId;
    }, [plan, schema]);

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

        // For start_time and end_time parameters add the main event's start_time
        parameters.forEach(param => {
            if (param.type === 'start_time' || param.type === 'end_time') {
                param.value = Number(param.value) + Number(mainEvent.parameters.find(p => p.type === 'start_time')?.value);
            }
        });

        // Create the new updating event
        const newUpdatingEvent: UpdatingEvent = {
            id: newId,
            type: updatingEventType,
            description: updatingEventSchema.description,
            parameters: parameters
        };

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            return {
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
        });

        return newId;
    }, [plan, schema]);

    const getEventIcon = useCallback((eventType: string) => {
        if (!schema) return null;
        // Try main events first
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
            return { ...prevPlan, events: updatedEvents };
        });
    }, [plan]);

    const updatePlanTitle = useCallback((newTitle: string) => {
        if (!plan) {
            throw new Error('No plan data available');
        }
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            return { ...prevPlan, title: newTitle };
        });
    }, [plan]);

    const updateBirthDate = useCallback((daysFromCurrent: number) => {
        if (!plan) {
            throw new Error('No plan data available');
        }
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const currentBirthDate = new Date(prevPlan.birth_date);
            const newBirthDate = new Date(currentBirthDate.getTime() + daysFromCurrent * 24 * 60 * 60 * 1000);
            const newBirthDateStr = newBirthDate.toISOString().split('T')[0];
            return { ...prevPlan, birth_date: newBirthDateStr };
        });
    }, [plan]);

    // Set adjust_for_inflation flag
    const setAdjustForInflation = useCallback((value: boolean) => {
        if (!plan) {
            throw new Error('No plan data available');
        }
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            return { ...prevPlan, adjust_for_inflation: value };
        });
    }, [plan]);

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
        const temp = plan_locked;
        setPlanLocked(plan);
        setPlan(temp);
        console.log("plan_locked", plan_locked);
        console.log("plan", plan);
    }, [plan, plan_locked]);

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
        updatePlanTitle,
        updateBirthDate,
        getEventDisclaimer,
        getParameterOptions,
        setAdjustForInflation,
        currentDay,
        updatePlanInflationRate, // <-- add to context value
        lockPlan, // <-- add to context value
        updateRetirementGoal, // <-- add to context value
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