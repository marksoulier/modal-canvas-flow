// resultsEvaluation.ts

export function inflationAdjust(
    results: Record<string, number[]>,
    tRange: number[],
    currentDay: number,
    inflationRate: number
): Record<string, number[]> {
    const dailyRate = Math.pow(1 + inflationRate, 1 / 365) - 1;
    const adjustmentFactors = tRange.map(t => Math.exp(-dailyRate * (currentDay - t)));

    const adjustedResults: Record<string, number[]> = {};
    for (const key in results) {
        adjustedResults[key] = results[key].map((v, i) => v * adjustmentFactors[i]);
    }

    return adjustedResults;
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
