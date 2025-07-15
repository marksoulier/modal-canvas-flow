// resultsEvaluation.ts

/**
 * Converts a value at a specific day (future or past) to today's value (present value).
 * This is the inverse of valueToDay.
 * @param valueAtDay - Value at the target day
 * @param targetDay - The day the value is in
 * @param currentDay - The reference day for "today"
 * @param inflationRate - Annual inflation rate (e.g., 0.03 for 3%)
 * @returns Value in today's money
 */
export function valueToToday(
    valueAtDay: number,
    targetDay: number,
    currentDay: number,
    inflationRate: number
): number {
    // d = number of days between target and current
    const d = targetDay - currentDay;
    // Present Value = Future Value / (1 + r)^(d/365)
    return valueAtDay / Math.pow(1 + inflationRate, d / 365);
}

/**
 * Adjusts all simulated results to present value ("today's money") given the current day.
 * This discounts future values to present value using the inflation rate.
 * @param results - Record of arrays of values (per envelope)
 * @param tRange - Array of time points (days)
 * @param currentDay - The day considered as "today"
 * @param inflationRate - Annual inflation rate (e.g., 0.03 for 3%)
 * @returns Adjusted results in today's money
 */
export function inflationAdjust(
    results: Record<string, number[]>,
    tRange: number[],
    currentDay: number,
    inflationRate: number
): Record<string, number[]> {
    // Adjust each value to present value using valueToToday
    const adjustedResults: Record<string, number[]> = {};
    for (const key in results) {
        adjustedResults[key] = results[key].map((v, i) => valueToToday(v, tRange[i], currentDay, inflationRate));
    }
    return adjustedResults;
}

/**
 * Converts a value in today's money to the value at a specific day (future or past) relative to currentDay.
 * For example, to get the equivalent value in year 2050 dollars, use a future day.
 * @param valueToday - Value in today's money
 * @param targetDay - The day to convert to
 * @param currentDay - The reference day for "today"
 * @param inflationRate - Annual inflation rate (e.g., 0.03 for 3%)
 * @returns Value in the money of the target day
 */
export function valueToDay(
    valueToday: number,
    targetDay: number,
    currentDay: number,
    inflationRate: number
): number {
    // d = number of days between target and current
    const d = targetDay - currentDay;
    // Discrete compounding: FV = PV * (1 + r)^(d/365)
    return valueToday * Math.pow(1 + inflationRate, d / 365);
}

export function evaluateResults(
    envelopes: Record<string, { functions: ((t: number) => number)[], growth_type: string, growth_rate: number }>,
    startDay: number,
    endDay: number,
    frequency: number,
    currentDay?: number,
    inflationRate?: number
): Record<string, number[]> {
    const tRange = Array.from({ length: Math.ceil((endDay - startDay) / frequency) }, (_, i) => startDay + i * frequency);
    const results: Record<string, number[]> = {};

    // Initialize results with zeros for each envelope
    for (const key in envelopes) {
        results[key] = new Array(tRange.length).fill(0);
    }

    // Evaluate each function separately and add to results (matching Python logic)
    for (const key in envelopes) {
        for (const func of envelopes[key].functions) {
            const funcResults = tRange.map(t => func(t));
            for (let i = 0; i < tRange.length; i++) {
                results[key][i] += funcResults[i];
            }
        }
    }

    if (currentDay !== undefined && inflationRate !== undefined) {
        return inflationAdjust(results, tRange, currentDay, inflationRate);
    }

    return results;
}
