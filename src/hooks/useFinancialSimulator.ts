import { useMemo } from 'react';
import type { FinancialProblem } from '../types/financial-types';

interface Datum {
  x: number;
  y: number;
}

/**
 * Custom hook to perform basic financial simulation
 * @param financialProblem The financial data structure
 * @param timeRange Number of months to simulate
 * @returns Array of data points representing total value over time
 */
export const useFinancialSimulation = (financialProblem: FinancialProblem, timeRange: number = 1200) => {
  // Basic inflow/outflow functions
  const unitStep = (startTime: number, currentTime: number): number => {
    return currentTime >= startTime ? 1 : 0;
  };

  const inflow = (amount: number, startTime: number, currentTime: number): number => {
    return amount * unitStep(startTime, currentTime);
  };

  const outflow = (amount: number, startTime: number, currentTime: number): number => {
    return -amount * unitStep(startTime, currentTime);
  };

  // Recurring functions
  const recurringInflow = (amount: number, startTime: number, endTime: number, currentTime: number, interval: number = 1): number => {
    let total = 0;
    for (let t = startTime; t <= endTime; t += interval) {
      total += inflow(amount, t, currentTime);
    }
    return total;
  };

  const recurringOutflow = (amount: number, startTime: number, endTime: number, currentTime: number, interval: number = 1): number => {
    let total = 0;
    for (let t = startTime; t <= endTime; t += interval) {
      total += outflow(amount, t, currentTime);
    }
    return total;
  };

  // Compound interest functions
  const compoundInvestInflow = (amount: number, startTime: number, currentTime: number, rate: number): number => {
    return amount * ((1 + rate) ** (currentTime - startTime)) * unitStep(startTime, currentTime);
  };

  const compoundInvestOutflow = (amount: number, startTime: number, currentTime: number, rate: number): number => {
    return -amount * ((1 + rate) ** (currentTime - startTime)) * unitStep(startTime, currentTime);
  };

  // Calculate function effect at a given time
  const calculateFunctionEffect = (functionId: number, time: number): number => {
    // have no effect if the function is not found
    const targetFunction = financialProblem.functions.find(f => f.id === functionId);
    if (!targetFunction) return 0;

    // do case statment to apply the correct function.
    switch (targetFunction.type) {
        case "inflow": {
            // Find time_start and amount parameters
            const timeStartParam = targetFunction.parameters.find(p => p.type === "time");
            const amountParam = targetFunction.parameters.find(p => p.type === "money");
            if (!timeStartParam || !amountParam) return 0;
            return inflow(amountParam.value, timeStartParam.value, time);
        }
        case "outflow": {
            // Find time_start and amount parameters
            const timeStartParam = targetFunction.parameters.find(p => p.type === "time");
            const amountParam = targetFunction.parameters.find(p => p.type === "money");
            if (!timeStartParam || !amountParam) return 0;
            return outflow(amountParam.value, timeStartParam.value, time);
        }
        case "recurring_inflow": {
            // Find time_start, end_time, amount, and interval parameters
            const timeStartParam = targetFunction.parameters.find(p => p.type === "time");
            const endTimeParam = targetFunction.parameters.find(p => p.type === "end_time");
            const amountParam = targetFunction.parameters.find(p => p.type === "money");
            const intervalParam = targetFunction.parameters.find(p => p.type === "interval");
            if (!timeStartParam || !endTimeParam || !amountParam) return 0;
            const interval = intervalParam?.value || 1;
            return recurringInflow(amountParam.value, timeStartParam.value, endTimeParam.value, time, interval);
        }
        case "recurring_outflow": {
            // Find time_start, end_time, amount, and interval parameters
            const timeStartParam = targetFunction.parameters.find(p => p.type === "time");
            const endTimeParam = targetFunction.parameters.find(p => p.type === "end_time");
            const amountParam = targetFunction.parameters.find(p => p.type === "money");
            const intervalParam = targetFunction.parameters.find(p => p.type === "interval");
            if (!timeStartParam || !endTimeParam || !amountParam) return 0;
            const interval = intervalParam?.value || 1;
            return recurringOutflow(amountParam.value, timeStartParam.value, endTimeParam.value, time, interval);
        }
        case "compound_invest_inflow": {
            // Find time_start, amount, and rate parameters
            const timeStartParam = targetFunction.parameters.find(p => p.type === "time");
            const amountParam = targetFunction.parameters.find(p => p.type === "money");
            const rateParam = targetFunction.parameters.find(p => p.type === "rate");
            if (!timeStartParam || !amountParam || !rateParam) return 0;
            return compoundInvestInflow(amountParam.value, timeStartParam.value, time, rateParam.value);
        }
        case "compound_invest_outflow": {
            // Find time_start, amount, and rate parameters
            const timeStartParam = targetFunction.parameters.find(p => p.type === "time");
            const amountParam = targetFunction.parameters.find(p => p.type === "money");
            const rateParam = targetFunction.parameters.find(p => p.type === "rate");
            if (!timeStartParam || !amountParam || !rateParam) return 0;
            return compoundInvestOutflow(amountParam.value, timeStartParam.value, time, rateParam.value);
        }
        default:
            return 0;
    }
  };

  // Generate data points for visualization
  const simulationData = useMemo(() => {
    const data: Datum[] = [];
    const envelopeValues: Record<number, number[]> = {};
    
    // Initialize envelope values
    for (const envelope of financialProblem.envelopes) {
      envelopeValues[envelope.id] = Array(timeRange).fill(0);
    }
    
    // Calculate values for each time point
    for (let t = 0; t < timeRange; t++) {
      let totalValue = 0;
      
      // Calculate effect for each envelope
      for (const envelope of financialProblem.envelopes) {
        let envelopeValue = 0;
        
        // Calculate effect of each function
        for (const functionId of envelope.function_ids) {
          const effect = calculateFunctionEffect(functionId, t);
          envelopeValue += effect;
        }
        
        // Store envelope value
        envelopeValues[envelope.id][t] = envelopeValue;
        totalValue = Object.values(envelopeValues).reduce((sum, values) => sum + values[t], 0);
      }
      
      // Add data point for this time
      data.push({
        x: t,
        y: totalValue
      });
    }
    
    return data;
  }, [financialProblem, timeRange, calculateFunctionEffect]);

  return {
    simulationData,
  };
};