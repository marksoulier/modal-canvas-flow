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

// Computation mode flags
export type ComputeMode = 'cpu' | 'gpu' | 'both';
export const COMPUTE_MODE: ComputeMode = 'cpu';
export const ENABLE_TIMING = true;

export function evaluateResults(
    envelopes: Record<string, { functions: ((t: number) => number)[], growth_type: string, growth_rate: number }>,
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
    let totalCpuTime = 0;
    let totalGpuTime = 0;

    // Precompute GPU theta series if using GPU
    if (COMPUTE_MODE === 'gpu' || COMPUTE_MODE === 'both') {
        const thetaStart = performance.now();
        precomputeThetasForGPU(envelopes as any, timePoints);
        thetaTime = performance.now() - thetaStart;
        if (ENABLE_TIMING) {
            console.info(`[Performance] Theta precomputation: ${thetaTime.toFixed(2)}ms`);
        }
    }

    // Compute all results using selected mode
    const cpuStart = performance.now();
    const cpuResults: Record<string, number[]> = {};
    if (COMPUTE_MODE === 'cpu' || COMPUTE_MODE === 'both') {
        for (const key in envelopes) {
            cpuResults[key] = timePoints.map(t =>
                envelopes[key].functions.reduce((sum, func) => sum + func(t), 0)
            );
        }
        totalCpuTime = performance.now() - cpuStart;
    }

    const gpuStart = performance.now();
    const gpuResults: Record<string, number[]> = {};
    if (COMPUTE_MODE === 'gpu' || COMPUTE_MODE === 'both') {
        for (const key in envelopes) {
            gpuResults[key] = evaluateGPUDescriptors((envelopes as any)[key].gpuDescriptors, timePoints);
        }
        totalGpuTime = performance.now() - gpuStart;
    }

    // Use results based on selected mode
    if (COMPUTE_MODE === 'cpu') {
        results = cpuResults;
    } else if (COMPUTE_MODE === 'gpu') {
        results = gpuResults;
    } else {
        // In 'both' mode, use GPU results but validate against CPU
        results = gpuResults;

        // Compare results and log performance
        if (ENABLE_TIMING) {
            console.info(`[Performance] Total times - CPU: ${totalCpuTime.toFixed(2)}ms, GPU: ${totalGpuTime.toFixed(2)}ms (including ${thetaTime.toFixed(2)}ms theta), Speedup: ${(totalCpuTime / (totalGpuTime + thetaTime)).toFixed(2)}x`);
        }

        // Check for discrepancies
        for (const key in results) {
            let maxDiff = 0;
            let maxIdx = -1;
            for (let i = 0; i < timePoints.length; i++) {
                const d = Math.abs(cpuResults[key][i] - gpuResults[key][i]);
                if (d > maxDiff) {
                    maxDiff = d;
                    maxIdx = i;
                }
            }

            if (maxDiff > 0.01) {
                const env: any = (envelopes as any)[key];
                const gpuDescs: any[] = env.gpuDescriptors || [];
                // eslint-disable-next-line no-console
                console.warn('[GPU DEBUG] Envelope mismatch detected', {
                    key,
                    maxDiff: +maxDiff.toFixed(6),
                    atTime: timePoints[maxIdx],
                    cpu: cpuResults[maxIdx],
                    gpu: gpuResults[maxIdx],
                    numCPUFuncs: env.functions?.length || 0,
                    numGPUDescs: gpuDescs?.length || 0
                });

                // If no GPU descriptors but CPU functions present, that's likely the cause
                if ((!gpuDescs || gpuDescs.length === 0) && (env.functions?.length || 0) > 0) {
                    // eslint-disable-next-line no-console
                    console.warn('[GPU DEBUG] No GPU descriptors present for envelope with CPU functions. This will cause mismatch.', {
                        key
                    });
                }

                // Detail: per-descriptor GPU contribution and per-function CPU contribution at mismatch index
                const t = timePoints[maxIdx];
                const cpuParts = (env.functions || []).map((fn: (t: number) => number, idx: number) => ({ idx, v: fn(t) }));
                const gpuParts = (gpuDescs || []).flatMap((d: any, di: number) => {
                    // sum contribution from this descriptor at time index
                    const sign = d.direction === 'in' ? 1 : -1;
                    const partsForDesc = (d.occurrences || []).map((occ: any) => {
                        if (t < occ.t_k) return 0;
                        const delta = t - occ.t_k;
                        // approximate same growth as evaluateGPUDescriptors uses
                        const growth_type = d.growth?.type || 'None';
                        const r = d.growth?.r || 0;
                        let growth = 1;
                        if (growth_type === 'Simple Interest' || growth_type === 'Appreciation') {
                            growth = 1 + r * (delta / 365.25);
                        } else if (growth_type === 'Daily Compound') {
                            growth = Math.pow(1 + r / 365.25, delta);
                        } else if (growth_type === 'Monthly Compound') {
                            growth = Math.pow(1 + r / 12, (12 * delta) / 365);
                        } else if (growth_type === 'Yearly Compound') {
                            growth = Math.pow(1 + r, delta / 365.25);
                        } else if (growth_type === 'Depreciation') {
                            growth = Math.max(0, Math.pow(1 - r, delta / 365.25));
                        } else if (growth_type === 'Depreciation (Days)') {
                            const days = d.growth?.days_of_usefulness;
                            growth = days && days > 0 ? Math.max(0, 1 - delta / days) : 0;
                        } else {
                            growth = 1;
                        }
                        return sign * occ.baseValue * growth;
                    });
                    const v = partsForDesc.reduce((a: number, b: number) => a + b, 0);
                    return [{ di, v }];
                });

                // eslint-disable-next-line no-console
                console.warn('[GPU DEBUG] Contribution breakdown at mismatch', {
                    key,
                    time: t,
                    cpuParts: cpuParts.slice(0, 8), // cap for readability
                    gpuParts: gpuParts.slice(0, 8)
                });
            }
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
