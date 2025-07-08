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
    'pencil': 'Pencil'
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

export interface Plan {
    title: string;
    birth_date: string;
    inflation_rate: number;
    adjust_for_inflation: boolean;
    events: Event[];
    envelopes: {
        name: string;
        category: string;
        growth: string;
        rate: number;
    }[];
}

export interface SchemaParameter {
    type: string;
    display_name: string;
    parameter_units: string;
    description: string;
    default: number | string;
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
    envelopes: string[];
    parameter_units_list: string[];
    events: SchemaEvent[];
}

interface PlanContextType {
    plan: Plan | null;
    schema: Schema | null;
    loadPlan: (planData: Plan) => void;
    savePlan: () => string;
    loadPlanFromFile: (file: File) => Promise<void>;
    savePlanToFile: () => void;
    loadDefaultPlan: () => Promise<void>;
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
}

const SCHEMA_PATH = '/assets/event_schema.json';

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

        // Generate a new unique ID
        const newId = Math.max(
            ...plan.events.map(e => e.id),
            ...plan.events.flatMap(e => e.updating_events?.map(ue => ue.id) || []),
            0
        ) + 1;

        // Create parameters with default values from schema
        const parameters = eventSchema.parameters.map((param, index) => ({
            id: index,
            type: param.type,
            value: param.default
        }));

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
                events: [...prevPlan.events, newEvent]
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
        const newId = Math.max(
            ...(mainEvent.updating_events?.map(e => e.id) || [0]),
            0
        ) + 1;

        // Create parameters with default values from schema
        const parameters = updatingEventSchema.parameters.map((param, index) => ({
            id: index,
            type: param.type,
            value: param.default
        }));

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

    const getEventDisclaimer = useCallback((eventType: string) => {
        if (!schema) return '';
        const eventSchema = schema.events.find(e => e.type === eventType);
        return eventSchema?.disclaimer || '';
    }, [schema]);

    const value = {
        plan,
        schema,
        loadPlan,
        savePlan,
        loadPlanFromFile,
        savePlanToFile,
        loadDefaultPlan,
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