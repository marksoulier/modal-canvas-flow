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

export function computeTimePoints(
    startDate: number,
    endDate: number,
    frequency: number,
    visibleRange?: { startDate: number, endDate: number },
    currentDay?: number
): number[] {
    let timePoints: number[];

    // If interval is 365, or 182.5 then do full range of dates
    if (frequency === 365 || frequency === 182.5) {
        timePoints = Array.from(
            { length: Math.ceil((endDate - startDate) / frequency) },
            (_, i) => startDate + i * frequency
        );
        if (timePoints[timePoints.length - 1] !== endDate) {
            timePoints.push(endDate);
        }
    } else {
        timePoints = [startDate];
        if (visibleRange) {
            for (let t = visibleRange.startDate; t <= visibleRange.endDate; t += frequency) {
                timePoints.push(t);
            }
        }
        if (timePoints[timePoints.length - 1] !== endDate) {
            timePoints.push(endDate);
        }
    }

    if (currentDay) {
        const currentDayIndex = timePoints.findIndex(t => t === currentDay);
        if (currentDayIndex !== -1) {
            timePoints.splice(currentDayIndex, 0, currentDay);
        }
    }

    return timePoints;
}

export function evaluateResults(
    envelopes: Record<string, { functions: ((t: number) => number)[], growth_type: string, growth_rate: number }>,
    startDate: number,
    endDate: number,
    frequency: number,
    currentDay?: number,
    inflationRate?: number,
    visibleRange?: { startDate: number, endDate: number },
    timePointsOverride?: number[]
): { results: Record<string, number[]>, timePoints: number[] } {
    // Initialize results
    const results: Record<string, number[]> = {};
    for (const key in envelopes) {
        results[key] = [];
    }

    const timePoints = timePointsOverride ?? computeTimePoints(startDate, endDate, frequency, visibleRange, currentDay);

    // Evaluate functions at all points
    for (const key in envelopes) {
        results[key] = timePoints.map(t =>
            envelopes[key].functions.reduce((sum, func) => sum + func(t), 0)
        );
    }

    // console.log('📊 Evaluation Results:', {
    //     timePointsLength: timePoints.length,
    //     timeRange: {
    //         first: timePoints[0],
    //         last: timePoints[timePoints.length - 1],
    //         span: timePoints[timePoints.length - 1] - timePoints[0]
    //     },
    //     resultKeysCount: Object.keys(results).length
    // });

    // Apply inflation adjustment if needed
    if (currentDay !== undefined && inflationRate !== undefined) {
        return {
            results: inflationAdjust(results, timePoints, currentDay, inflationRate),
            timePoints
        };
    }

    //console.log('📊 Results:', { results, timePoints });

    return { results, timePoints };
}
