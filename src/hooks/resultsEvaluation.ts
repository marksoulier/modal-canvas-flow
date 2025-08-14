// resultsEvaluation.ts

import { precomputeThetasForGPU, evaluateGPUDescriptors } from "./baseFunctionsGPU";
import { resolveStage } from "./peekEngine";
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

// Timing flag
export const ENABLE_TIMING = true;

// Minimal GPU envelope shape for this evaluator
export type EnvelopeGPU = {
    gpuDescriptors?: any[];
    growth_type?: string;
    growth_rate?: number;
    days_of_usefulness?: number;
};

export function evaluateResults(
    envelopes: Record<string, EnvelopeGPU>,
    startDate: number,
    endDate: number,
    frequency: number,
    currentDay?: number,
    inflationRate?: number,
    visibleRange?: { startDate: number, endDate: number }
): { results: Record<string, number[]>, timePoints: number[] } {
    // Initialize results
    let results: Record<string, number[]> = {};

    let timePoints: number[];

    // If interval is 365, or 182.5 then do full range of dates
    if (frequency === 365 || frequency === 182.5) {
        // If no visible range specified, use single interval throughout
        timePoints = Array.from(
            { length: Math.ceil((endDate - startDate) / frequency) },
            (_, i) => startDate + i * frequency
        );

        // Add end point if it's not already included
        if (timePoints[timePoints.length - 1] !== endDate) {
            timePoints.push(endDate);
        }
    } else {
        // Start with first point
        timePoints = [startDate];

        // Add points in visible range at specified interval
        if (visibleRange) {
            // console.log('📊 Adding points in visible range:', {
            //     rangeStart: visibleRange.startDate,
            //     rangeEnd: visibleRange.endDate,
            //     interval: frequency,
            //     expectedPoints: Math.ceil((visibleRange.endDate - visibleRange.startDate) / frequency)
            // });

            for (let t = visibleRange.startDate; t <= visibleRange.endDate; t += frequency) {
                timePoints.push(t);
            }
        }
    }

    // Add end point if it's not already included
    if (timePoints[timePoints.length - 1] !== endDate) {
        timePoints.push(endDate);
    }

    // See where I need to insert the current day point to be in the right order
    if (currentDay) {
        const currentDayIndex = timePoints.findIndex(t => t === currentDay);
        if (currentDayIndex !== -1) {
            timePoints.splice(currentDayIndex, 0, currentDay);
        }
    }

    let thetaTime = 0;
    let totalGpuTime = 0;

    // Precompute GPU theta series
    const thetaStart = performance.now();
    precomputeThetasForGPU(envelopes as any, timePoints);
    thetaTime = performance.now() - thetaStart;
    if (ENABLE_TIMING) {
        console.info(`[Performance] Theta precomputation: ${thetaTime.toFixed(2)}ms`);
    }

    // Compute all results using GPU
    const gpuStart = performance.now();
    const gpuResults: Record<string, number[]> = {};
    for (const key in envelopes) {
        gpuResults[key] = evaluateGPUDescriptors((envelopes as any)[key].gpuDescriptors, timePoints);
    }
    totalGpuTime = performance.now() - gpuStart;
    if (ENABLE_TIMING) {
        console.info(`[Performance] GPU evaluation: ${totalGpuTime.toFixed(2)}ms`);
    }

    // Use GPU results only
    results = gpuResults;

    // Staged peek resolution: 10 (corrections), 20 (policy/reset/penalties), 30 (tax)
    const stages = [10, 20, 30];
    for (const stage of stages) {
        const t0 = performance.now();
        const applied = resolveStage(envelopes as any, results, timePoints, stage);
        if (!applied) continue;
        precomputeThetasForGPU(envelopes as any, timePoints);
        for (const key in envelopes) {
            gpuResults[key] = evaluateGPUDescriptors((envelopes as any)[key].gpuDescriptors, timePoints);
        }
        results = gpuResults;
        if (ENABLE_TIMING) {
            console.info(`[Performance] Stage ${stage} peek resolution + re-eval: ${(performance.now() - t0).toFixed(2)}ms`);
        }
    }

    // Note: CPU vs GPU validation logs are emitted per-envelope above; results only carry GPU

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
