// resultsEvaluation.ts
import { precomputeThetasForGPU, evaluateGPUDescriptors } from "./baseFunctionsGPU";
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

export function computeTimePoints(
    startDate: number,
    endDate: number,
    frequency: number,
    visibleRange?: { startDate: number, endDate: number },
    currentDay?: number
): number[] {
    const points: number[] = [];
    if (frequency === 365 || frequency === 182.5) {
        for (let t = startDate; t <= endDate; t += frequency) points.push(t);
        if (points.length === 0 || points[points.length - 1] !== endDate) points.push(endDate);
    } else {
        points.push(startDate);
        if (visibleRange) {
            for (let t = visibleRange.startDate; t <= visibleRange.endDate; t += frequency) {
                points.push(t);
            }
        }
        if (points[points.length - 1] !== endDate) points.push(endDate);
    }
    if (currentDay) {
        const idx = points.findIndex(t => t === currentDay);
        if (idx !== -1) points.splice(idx, 0, currentDay);
    }
    return points;
}

export function evaluateResults(
    envelopes: Record<string, EnvelopeGPU>,
    startDate: number,
    endDate: number,
    frequency: number,
    currentDay: number | undefined,
    inflationRate: number | undefined,
    timePoints: number[],
    visibleRange?: { startDate: number, endDate: number }
): { results: Record<string, number[]>, timePoints: number[] } {
    // Initialize results
    let results: Record<string, number[]> = {};

    // Prevent unused param lints for now (kept for API compatibility)
    void startDate; void endDate; void frequency; void visibleRange;

    let thetaTime = 0;
    let totalGpuTime = 0;

    // Precompute GPU theta series using provided timePoints only
    const thetaStart = performance.now();
    precomputeThetasForGPU(envelopes as any, timePoints);
    thetaTime = performance.now() - thetaStart;
    if (ENABLE_TIMING) {
        console.info(`[Performance] Theta precomputation: ${thetaTime.toFixed(2)}ms`);
    }

    // Compute all results using GPU in two phases to support cross-envelope lazy targets
    const gpuStart = performance.now();
    const baseResults: Record<string, number[]> = {};
    const lazyOverlay: Record<string, number[]> = {};
    // Phase A: evaluate without LazyFromEnvelopes (treats them as no-ops)
    for (const key in envelopes) {
        const descs = ((envelopes as any)[key].gpuDescriptors || []).filter((d: any) => d?.type !== 'LazyFromEnvelopes');
        baseResults[key] = evaluateGPUDescriptors(descs, timePoints);
    }
    // Phase B: evaluate only LazyFromEnvelopes using Phase A values as context
    for (const key in envelopes) {
        const lazyDescs = ((envelopes as any)[key].gpuDescriptors || []).filter((d: any) => d?.type === 'LazyFromEnvelopes');
        if (lazyDescs.length === 0) {
            lazyOverlay[key] = new Array(timePoints.length).fill(0);
            continue;
        }
        lazyOverlay[key] = evaluateGPUDescriptors(
            lazyDescs,
            timePoints,
            (k: string, idx: number) => baseResults[k]?.[idx] ?? 0
        );
    }
    // Sum base + overlay
    const gpuResults: Record<string, number[]> = {};
    for (const key in envelopes) {
        const a = baseResults[key] || new Array(timePoints.length).fill(0);
        const b = lazyOverlay[key] || new Array(timePoints.length).fill(0);
        const summed = new Array(timePoints.length);
        for (let i = 0; i < timePoints.length; i++) summed[i] = (a[i] || 0) + (b[i] || 0);
        gpuResults[key] = summed;
    }
    totalGpuTime = performance.now() - gpuStart;
    if (ENABLE_TIMING) {
        console.info(`[Performance] GPU evaluation: ${totalGpuTime.toFixed(2)}ms`);
    }

    // Use GPU results only (single-pass evaluation)
    results = gpuResults;


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
