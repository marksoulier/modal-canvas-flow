// Type-safe event system wrapper
// This file provides type-safe interfaces that work with your existing system

import type { Event, UpdatingEvent, Parameter } from '../contexts/PlanContext';
import type * as GeneratedTypes from './generated-event-types';

// Re-export all generated types
export * from './generated-event-types';

// Type-safe event interface that works with your existing Parameter[] structure
export interface TypedEvent<T extends Record<string, any> = Record<string, any>> extends Omit<Event, 'parameters'> {
    parameters: Parameter[];
    // Add a type-safe getter for parameters
    getTypedParameters(): T;
}

// Type-safe updating event interface
export interface TypedUpdatingEvent<T extends Record<string, any> = Record<string, any>> extends Omit<UpdatingEvent, 'parameters'> {
    parameters: Parameter[];
    // Add a type-safe getter for parameters
    getTypedParameters(): T;
}

// Function signature for event handlers that works with your existing system
export type EventHandler<T extends Record<string, any> = Record<string, any>> = (
    event: Event,
    envelopes: Record<string, any>,
    onUpdate?: (updates: Array<{ eventId: number, paramType: string, value: number }>) => void,
    event_functions?: Array<{ title: string; enabled: boolean }>
) => void;

// Type-safe event handler map
export interface EventHandlerMap {
    invest_money: EventHandler<GeneratedTypes.Invest_moneyParameters>;
    inflow: EventHandler<GeneratedTypes.InflowParameters>;
    outflow: EventHandler<GeneratedTypes.OutflowParameters>;
    transfer_money: EventHandler<GeneratedTypes.Transfer_moneyParameters>;
    declare_accounts: EventHandler<GeneratedTypes.Declare_accountsParameters>;
    manual_correction: EventHandler<GeneratedTypes.Manual_correctionParameters>;
    get_job: EventHandler<GeneratedTypes.Get_jobParameters>;
    buy_house: EventHandler<GeneratedTypes.Buy_houseParameters>;
    buy_car: EventHandler<GeneratedTypes.Buy_carParameters>;
    have_kid: EventHandler<GeneratedTypes.Have_kidParameters>;
    marriage: EventHandler<GeneratedTypes.MarriageParameters>;
    divorce: EventHandler<GeneratedTypes.DivorceParameters>;
    pass_away: EventHandler<GeneratedTypes.Pass_awayParameters>;
    buy_health_insurance: EventHandler<GeneratedTypes.Buy_health_insuranceParameters>;
    buy_life_insurance: EventHandler<GeneratedTypes.Buy_life_insuranceParameters>;
    receive_government_aid: EventHandler<GeneratedTypes.Receive_government_aidParameters>;
    high_yield_savings_account: EventHandler<GeneratedTypes.High_yield_savings_accountParameters>;
    buy_groceries: EventHandler<GeneratedTypes.Buy_groceriesParameters>;
    roth_ira_contribution: EventHandler<GeneratedTypes.Roth_ira_contributionParameters>;
    tax_payment_estimated: EventHandler<GeneratedTypes.Tax_payment_estimatedParameters>;
    federal_subsidized_loan: EventHandler<GeneratedTypes.Federal_subsidized_loanParameters>;
    federal_unsubsidized_loan: EventHandler<GeneratedTypes.Federal_unsubsidized_loanParameters>;
    private_student_loan: EventHandler<GeneratedTypes.Private_student_loanParameters>;
    usa_tax_system: EventHandler<GeneratedTypes.Usa_tax_systemParameters>;
    retirement: EventHandler<GeneratedTypes.RetirementParameters>;
}

// Helper function to convert Parameter[] to typed object
export function parametersToObject<T extends Record<string, any>>(parameters: Parameter[]): T {
    const result: Record<string, any> = {};
    parameters.forEach(param => {
        result[param.type] = param.value;
    });
    return result as T;
}

// Helper function to convert typed object to Parameter[]
export function objectToParameters<T extends Record<string, any>>(obj: T): Parameter[] {
    return Object.entries(obj).map(([type, value], id) => ({
        id,
        type,
        value
    }));
}

// Type guard to check if an event has specific parameters
export function hasParameters<T extends Record<string, any>>(
    event: Event,
    parameterCheck: (params: Record<string, any>) => params is T
): event is TypedEvent<T> {
    const params = parametersToObject(event.parameters);
    return parameterCheck(params);
}

// Type-safe wrapper for your existing event functions
export function createTypedEventHandler<T extends keyof EventHandlerMap>(
    handler: EventHandlerMap[T]
): EventHandlerMap[T] {
    return handler;
}

// Utility type for creating type-safe event handlers
export type CreateEventHandler<T extends keyof EventHandlerMap> = EventHandlerMap[T];

// Type-safe envelope interface
export interface TypedEnvelope {
    name: string;
    category: string;
    growth: string;
    rate: number;
    account_type: string;
    days_of_usefulness?: number;
}

// Type-safe envelope map
export type EnvelopeMap = Record<string, TypedEnvelope>;
