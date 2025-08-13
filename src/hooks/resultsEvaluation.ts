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
export const COMPUTE_MODE: ComputeMode = 'gpu';
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

        // Compare results and log consolidated performance
        if (ENABLE_TIMING) {
            const gpuTotalWithTheta = totalGpuTime + thetaTime;
            const speedup = totalCpuTime / gpuTotalWithTheta;
            console.info('📊 Performance Comparison:', {
                'CPU Time': `${totalCpuTime.toFixed(2)}ms`,
                'GPU Time': `${totalGpuTime.toFixed(2)}ms`,
                'GPU Prep (Theta)': `${thetaTime.toFixed(2)}ms`,
                'GPU Total (with prep)': `${gpuTotalWithTheta.toFixed(2)}ms`,
                'Speedup': `${speedup.toFixed(2)}x`,
                'Points Evaluated': timePoints.length,
                'Envelopes': Object.keys(results).length
            });
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
                // console.warn('[GPU DEBUG] Envelope mismatch detected', {
                //     key,
                //     maxDiff: +maxDiff.toFixed(6),
                //     atTime: timePoints[maxIdx],
                //     cpu: cpuResults[maxIdx],
                //     gpu: gpuResults[maxIdx],
                //     numCPUFuncs: env.functions?.length || 0,
                //     numGPUDescs: gpuDescs?.length || 0
                // });

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
                // console.warn('[GPU DEBUG] Contribution breakdown at mismatch', {
                //     key,
                //     time: t,
                //     cpuParts: cpuParts.slice(0, 8), // cap for readability
                //     gpuParts: gpuParts.slice(0, 8)
                // });
            }
        }
    }

    // Resolve deferred peek operations (phase after base evaluation, before inflation adjustment)
    // Generalized peek kinds:
    // - 'reset_to_zero' { envelope, day }
    // - 'impulse_from_envelope' { sourceEnvelope, targetEnvelope, coeff, direction, thetaParamKey, days, filter? }
    // - 'tax_delta_on_401k' { taxableIncomeKey, addKey, taxesTargetEnvelope, filingStatus, dependents, days }
    const peekOps: Array<any> = (envelopes as any).__peekQueries || [];
    if (peekOps.length > 0) {
        const t0 = performance.now();
        const indexOfDay = new Map<number, number>();
        for (let i = 0; i < timePoints.length; i++) indexOfDay.set(timePoints[i], i);

        // Apply resets as GPU T-descriptors per op
        for (const op of peekOps) {
            if (op.kind === 'reset_to_zero' && op.envelope && typeof op.day === 'number') {
                const envKey = op.envelope as string;
                const idx = indexOfDay.get(op.day);
                if (idx == null) continue;
                const currentVal = (results[envKey] && results[envKey][idx]) ?? 0;
                if (currentVal !== 0) {
                    // growth params based on envelope
                    const env = (envelopes as any)[envKey];
                    const growth = {
                        type: env?.growth_type || 'None',
                        r: env?.growth_rate || 0,
                        days_of_usefulness: env?.days_of_usefulness
                    };
                    // Add GPU descriptor to cancel value at that day
                    const theta = currentVal > 0 ? { a: Math.abs(currentVal) } : { b: Math.abs(currentVal) };
                    const direction = currentVal > 0 ? 'out' : 'in';
                    const thetaParamKey = currentVal > 0 ? 'b' : 'a';
                    // store on envelopes to be picked up by GPU evaluator
                    const add = (envelopes as any)[envKey]?.gpuDescriptors?.push
                        ? (envelopes as any)[envKey].gpuDescriptors.push.bind((envelopes as any)[envKey].gpuDescriptors)
                        : null;
                    if (add) {
                        add({
                            type: 'T',
                            direction,
                            t_k: op.day,
                            thetaParamKey,
                            theta: (t: number) => theta,
                            growth
                        });
                    } else {
                        // fallback: attach structure
                        (envelopes as any)[envKey] = (envelopes as any)[envKey] || {};
                        (envelopes as any)[envKey].gpuDescriptors = ((envelopes as any)[envKey].gpuDescriptors || []).concat([{
                            type: 'T', direction, t_k: op.day, thetaParamKey, theta: (t: number) => theta, growth
                        }]);
                    }
                }
            } else if (op.kind === 'impulse_from_envelope') {
                const src = op.sourceEnvelope as string;
                const dst = op.targetEnvelope as string;
                const coeff = Number(op.coeff) || 0;
                const direction = (op.direction === 'in' ? 'in' : 'out') as 'in' | 'out';
                const thetaParamKey = op.thetaParamKey || (direction === 'in' ? 'a' : 'b');
                const days: number[] = op.days || [];
                const filter = op.filter as { op: 'lt' | 'le' | 'gt' | 'ge' | 'eq', day: number } | undefined;
                if (!src || !dst || !isFinite(coeff)) continue;
                const srcSeries = results[src] || [];
                const add = (envelopes as any)[dst]?.gpuDescriptors?.push
                    ? (envelopes as any)[dst].gpuDescriptors.push.bind((envelopes as any)[dst].gpuDescriptors)
                    : null;
                for (const d of days) {
                    if (filter) {
                        if (filter.op === 'lt' && !(d < filter.day)) continue;
                        if (filter.op === 'le' && !(d <= filter.day)) continue;
                        if (filter.op === 'gt' && !(d > filter.day)) continue;
                        if (filter.op === 'ge' && !(d >= filter.day)) continue;
                        if (filter.op === 'eq' && !(d === filter.day)) continue;
                    }
                    const idx = indexOfDay.get(d);
                    if (idx == null) continue;
                    const val = srcSeries[idx] || 0;
                    const amount = val * coeff;
                    if (amount === 0) continue;
                    const desc = {
                        type: 'Impulse',
                        direction,
                        t_k: d,
                        thetaParamKey,
                        theta: (t: number) => ({ [thetaParamKey]: Math.abs(amount) }),
                        growth: { type: 'None', r: 0 }
                    } as any;
                    if (add) add(desc); else {
                        (envelopes as any)[dst] = (envelopes as any)[dst] || {};
                        (envelopes as any)[dst].gpuDescriptors = ((envelopes as any)[dst].gpuDescriptors || []).concat([desc]);
                    }
                }
            } else if (op.kind === 'tax_delta_on_401k') {
                // Compute Δ tax = tax(taxable + add) - tax(taxable) per requested day, emit Impulse out to taxesTargetEnvelope
                const taxableKey = op.taxableIncomeKey as string;
                const addKey = op.addKey as string;
                const taxesTarget = op.taxesTargetEnvelope as string;
                const filingStatus = op.filingStatus as string;
                const dependents = Number(op.dependents) || 0;
                const days: number[] = op.days || [];
                if (!taxableKey || !addKey || !taxesTarget) continue;
                const taxableSeries = results[taxableKey] || [];
                const addSeries = results[addKey] || [];
                const env = (envelopes as any)[taxesTarget];
                const addDesc = (desc: any) => {
                    if ((envelopes as any)[taxesTarget]?.gpuDescriptors?.push) {
                        (envelopes as any)[taxesTarget].gpuDescriptors.push(desc);
                    } else {
                        (envelopes as any)[taxesTarget] = (envelopes as any)[taxesTarget] || {};
                        (envelopes as any)[taxesTarget].gpuDescriptors = ((envelopes as any)[taxesTarget].gpuDescriptors || []).concat([desc]);
                    }
                };
                for (const d of days) {
                    const idx = indexOfDay.get(d);
                    if (idx == null) continue;
                    const taxable = taxableSeries[idx] || 0;
                    const addVal = addSeries[idx] || 0;
                    // Simple bracket approximation consistent with calculateTaxes signature subset
                    const estimateTax = (income: number) => {
                        const brackets = filingStatus === 'Married Filing Jointly'
                            ? [11000 * 2, 44725 * 2, 95375 * 2, 182050 * 2, 231250 * 2, 578125 * 2]
                            : [11000, 44725, 95375, 182050, 231250, 578125];
                        const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
                        let remaining = Math.max(0, income);
                        let prev = 0, tax = 0;
                        for (let i = 0; i < rates.length; i++) {
                            const cap = i < brackets.length ? brackets[i] : Infinity;
                            const span = Math.max(0, Math.min(remaining, cap - prev));
                            tax += span * rates[i];
                            remaining -= span;
                            prev = cap;
                            if (remaining <= 0) break;
                        }
                        // rough dependent credit
                        tax -= dependents * 2000;
                        return Math.max(0, tax);
                    };
                    const taxBase = estimateTax(taxable);
                    const taxWithAdd = estimateTax(taxable + addVal);
                    const delta = taxWithAdd - taxBase;
                    if (delta <= 0) continue;
                    addDesc({
                        type: 'Impulse', direction: 'out', t_k: d, thetaParamKey: 'b',
                        theta: (t: number) => ({ b: delta }), growth: { type: 'None', r: 0 }
                    });
                }
            }
        }

        // Recompute GPU occurrences for any newly added raw descriptors from peek ops
        precomputeThetasForGPU(envelopes as any, timePoints);

        // Re-evaluate GPU after applying peek-induced corrections (only GPU path)
        for (const key in envelopes) {
            gpuResults[key] = evaluateGPUDescriptors((envelopes as any)[key].gpuDescriptors, timePoints);
        }
        results = (COMPUTE_MODE === 'cpu') ? results : gpuResults;
        if (ENABLE_TIMING) {
            console.info(`[Performance] Peek resolution + re-eval: ${(performance.now() - t0).toFixed(2)}ms (ops=${peekOps.length})`);
        }
        // Clear peek queue to avoid reuse across runs
        (envelopes as any).__peekQueries = [];
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
