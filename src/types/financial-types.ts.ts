// Types for financial simulation

// Parameter types
export type ParameterType = 'time' | 'money' | 'rate' | 'interval' | 'end_time';

// Function types
export type FunctionType = 
  | 'inflow' 
  | 'outflow' 
  | 'compound_invest_inflow' 
  | 'compound_invest_outflow' 
  | 'recurring_inflow'
  | 'recurring_outflow'
  | '';

// Event types
export type EventType = 'purchase' | 'pay_check' | 'compound_investment' | 'having_a_baby' | 'getting_a_job' | 'ending_a_job' | 'groceries';

// Parameter inside a function
export interface FunctionParameter {
  id: number; // unique identifier for the parameter
  type: ParameterType; // the parameter type or category
  value: number; // the value of the parameter
}

// Function definitions (inflow/outflow)
export interface FinancialFunction {
  id: number; // unique identifier for the function
  type: FunctionType; // the function type or category
  parameters: FunctionParameter[]; // the parameters of the function, should be set for a specific type of function, should have a time parameter.
}

// Event parameter (reference to a function parameter)
export interface EventParameter {
  id: number; // unique identifier for the event parameter
  type: ParameterType; // the type of the event parameter
  value: number; // the value of the event parameter
  id_parameter: number; // the id of the parameter that is being referenced
  id_function: number; // the id of the function that is being referenced
}

// Events (income/spending)
export interface FinancialEvent {
  id: number; // unique identifier for the event
  type: EventType; // the type of the event
  description: string; // a description of the event
  parameters: EventParameter[]; // the parameters of the event, these should have a time_start parameter
}

// Envelope (container for functions)
export interface Envelope {
  id: number; // unique identifier for the envelope
  name: string; // the name of the envelope
  function_ids: number[]; // the ids of the functions that are in the envelope
}

// Complete financial data structure
export interface FinancialProblem {
  envelopes: Envelope[];
  functions: FinancialFunction[];
  events: FinancialEvent[];
}
