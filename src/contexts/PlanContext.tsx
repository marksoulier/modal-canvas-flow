import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { iconMap } from '../types/eventSchema';
import * as LucideIcons from 'lucide-react';

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
    icon: string;
    parameters: Parameter[];
}

export interface Event {
    id: number;
    type: string;
    description: string;
    icon: string;
    parameters: Parameter[];
    updating_events?: UpdatingEvent[];
}

export interface Plan {
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
    updateParameter: (eventId: number, parameterId: number, newValue: number | string) => void;
    deleteEvent: (eventId: number) => void;
    addEvent: (eventType: string) => number;
    addUpdatingEvent: (mainEventId: number, updatingEventType: string) => number;
    getEventIcon: (iconName: string) => React.ReactNode;
    getEventDisplayType: (eventType: string) => string;
    getParameterDisplayName: (eventType: string, parameterType: string) => string;
    getParameterUnits: (eventType: string, parameterType: string) => string;
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

    const updateParameter = useCallback((eventId: number, parameterId: number, newValue: number | string) => {
        if (!plan) {
            throw new Error('No plan data available');
        }

        setPlan(prevPlan => {
            if (!prevPlan) return null;

            const updatedEvents = prevPlan.events.map(event => {
                // Check if this is the main event we're looking for
                if (event.id === eventId) {
                    const updatedParameters = event.parameters.map(param => {
                        if (param.id === parameterId) {
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
                                if (param.id === parameterId) {
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
            icon: eventSchema.icon,
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
            icon: updatingEventSchema.icon,
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

    const getEventIcon = useCallback((iconName: string) => {
        const lucideIconName = iconMap[iconName] || 'Circle';
        const IconComponent = (LucideIcons as any)[lucideIconName] || LucideIcons.Circle;
        return <IconComponent size={20} />;
    }, []);

    const getEventDisplayType = useCallback((eventType: string) => {
        if (!schema) return eventType;
        const eventSchema = schema.events.find(e => e.type === eventType);
        return eventSchema?.display_type || eventType;
    }, [schema]);

    const getParameterDisplayName = useCallback((eventType: string, parameterType: string) => {
        if (!schema) return parameterType;
        const eventSchema = schema.events.find(e => e.type === eventType);
        if (!eventSchema) return parameterType;

        const parameter = eventSchema.parameters.find(p => p.type === parameterType);
        return parameter?.display_name || parameterType;
    }, [schema]);

    const getParameterUnits = useCallback((eventType: string, parameterType: string) => {
        if (!schema) return '';
        const eventSchema = schema.events.find(e => e.type === eventType);
        if (!eventSchema) return '';

        const parameter = eventSchema.parameters.find(p => p.type === parameterType);
        return parameter?.parameter_units || '';
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