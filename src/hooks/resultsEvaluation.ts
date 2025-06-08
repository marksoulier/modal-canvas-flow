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
    envelopes: Record<string, ((t: number) => number)[]>,
    startDay: number,
    endDay: number,
    frequency: number,
    currentDay?: number,
    inflationRate?: number
): Record<string, number[]> {
    const tRange = Array.from({ length: Math.ceil((endDay - startDay) / frequency) }, (_, i) => startDay + i * frequency);
    const results: Record<string, number[]> = {};

    for (const key in envelopes) {
        results[key] = tRange.map(t => envelopes[key].reduce((sum, fn) => sum + fn(t), 0));
    }

    if (currentDay !== undefined && inflationRate !== undefined) {
        return inflationAdjust(results, tRange, currentDay, inflationRate);
    }

    return results;
}
