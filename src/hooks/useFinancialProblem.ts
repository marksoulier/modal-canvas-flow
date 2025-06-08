import { useState, useEffect, useCallback } from 'react';
import type { FinancialProblem, FunctionParameter, EventParameter, FinancialFunction, FinancialEvent } from '../types/financial-types.ts.ts';

/**
 * Custom hook to load and manage financial data
 * @param initialData Optional initial data to load
 * @returns The financial data state and mutation functions
 */
export const useFinancialProblem = (initialData?: FinancialProblem | string) => {
  // Initialize with empty state
  const [financialProblem, setFinancialProblem] = useState<FinancialProblem>({
    envelopes: [],
    functions: [],
    events: []
  });

  // Effect to load the initial data
  useEffect(() => {
    if (initialData) {
      try {
        // Parse the JSON if it's a string
        const parsedData = typeof initialData === 'string' 
          ? JSON.parse(initialData) 
          : initialData;
        
        // Type checking and validation
        if (!Array.isArray(parsedData.envelopes)) {
          console.error('Invalid financial data: envelopes must be an array');
          return;
        }
        
        if (!Array.isArray(parsedData.functions)) {
          console.error('Invalid financial data: functions must be an array');
          return;
        }
        
        if (!Array.isArray(parsedData.events)) {
          console.error('Invalid financial data: events must be an array');
          return;
        }

        // Validate functions have time parameters
        const hasValidFunctions = parsedData.functions.every((func: FinancialFunction) => {
          return func.parameters.some((param: FunctionParameter) => param.type === 'time');
        });

        if (!hasValidFunctions) {
          console.error('Invalid financial data: all functions must have a time parameter');
          return;
        }

        // Validate events have time_start parameters
        const hasValidEvents = parsedData.events.every((event: FinancialEvent) => {
          return event.parameters.some((param: EventParameter) => param.type === 'time');
        });

        if (!hasValidEvents) {
          console.error('Invalid financial data: all events must have a time parameter');
          return;
        }
        
        // Set the validated data
        setFinancialProblem(parsedData);
      } catch (error) {
        console.error('Error parsing financial data:', error);
      }
    }
  }, [initialData]);

  // Mutation functions
  const updateEventTime = useCallback((eventId: number, newTime: number) => {
    setFinancialProblem(prev => {
      const updatedEvents = prev.events.map(event => {
        if (event.id === eventId) {
          // Update all time parameters in the event
          const updatedParameters = event.parameters.map(param => {
            if (param.type === 'time') {
              return { ...param, value: newTime };
            }
            return param;
          });
          return { ...event, parameters: updatedParameters };
        }
        return event;
      });

      // Also update corresponding function parameters
      const updatedFunctions = prev.functions.map(func => {
        const event = prev.events.find(e => e.id === eventId);
        if (event) {
          const updatedParameters = func.parameters.map(param => {
            const eventParam = event.parameters.find(ep => ep.id_parameter === param.id);
            if (eventParam && eventParam.type === 'time') {
              return { ...param, value: newTime };
            }
            return param;
          });
          return { ...func, parameters: updatedParameters };
        }
        return func;
      });

      return {
        ...prev,
        events: updatedEvents,
        functions: updatedFunctions
      };
    });
  }, []);

  const updateEventAmount = useCallback((eventId: number, newAmount: number) => {
    setFinancialProblem(prev => {
      const updatedEvents = prev.events.map(event => {
        if (event.id === eventId) {
          // Update all money parameters in the event
          const updatedParameters = event.parameters.map(param => {
            if (param.type === 'money') {
              return { ...param, value: newAmount };
            }
            return param;
          });
          return { ...event, parameters: updatedParameters };
        }
        return event;
      });

      // Also update corresponding function parameters
      const updatedFunctions = prev.functions.map(func => {
        const event = prev.events.find(e => e.id === eventId);
        if (event) {
          const updatedParameters = func.parameters.map(param => {
            const eventParam = event.parameters.find(ep => ep.id_parameter === param.id);
            if (eventParam && eventParam.type === 'money') {
              return { ...param, value: newAmount };
            }
            return param;
          });
          return { ...func, parameters: updatedParameters };
        }
        return func;
      });

      return {
        ...prev,
        events: updatedEvents,
        functions: updatedFunctions
      };
    });
  }, []);

  const updateEventRate = useCallback((eventId: number, newRate: number) => {
    setFinancialProblem(prev => {
      const updatedEvents = prev.events.map(event => {
        if (event.id === eventId) {
          // Update all rate parameters in the event
          const updatedParameters = event.parameters.map(param => {
            if (param.type === 'rate') {
              return { ...param, value: newRate };
            }
            return param;
          });
          return { ...event, parameters: updatedParameters };
        }
        return event;
      });

      // Also update corresponding function parameters
      const updatedFunctions = prev.functions.map(func => {
        const event = prev.events.find(e => e.id === eventId);
        if (event) {
          const updatedParameters = func.parameters.map(param => {
            const eventParam = event.parameters.find(ep => ep.id_parameter === param.id);
            if (eventParam && eventParam.type === 'rate') {
              return { ...param, value: newRate };
            }
            return param;
          });
          return { ...func, parameters: updatedParameters };
        }
        return func;
      });

      return {
        ...prev,
        events: updatedEvents,
        functions: updatedFunctions
      };
    });
  }, []);

  return { 
    financialProblem, 
    setFinancialProblem,
    updateEventTime,
    updateEventAmount,
    updateEventRate
  };
};

/**
 * Utility function to load financial data from a JSON file
 * @param filePath Path to the JSON file
 * @returns Promise that resolves to the parsed financial data
 */
export const loadFinancialProblemFromFile = async (filePath: string): Promise<FinancialProblem> => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load financial data: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as FinancialProblem;
  } catch (error) {
    console.error('Error loading financial data from file:', error);
    // Return empty data structure on error
    return {
      envelopes: [],
      functions: [],
      events: []
    };
  }
};