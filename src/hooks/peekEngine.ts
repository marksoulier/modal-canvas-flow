// peekEngine.ts
export type PeekContext = {
    envelopes: Record<string, any>;
    results: Record<string, number[]>;
    timePoints: number[];
    indexOfDay: Map<number, number>;
};

export type PeekOp = {
    apply: (ctx: PeekContext) => void;
};

type StagedPeek = { stage: number; op: PeekOp };

export function enqueuePeek(envelopes: any, stage: number, op: PeekOp): void {
    (envelopes as any).__peeks = ((envelopes as any).__peeks || []) as StagedPeek[];
    (envelopes as any).__peeks.push({ stage, op });
}

export function clearPeeks(envelopes: any): void {
    (envelopes as any).__peeks = [];
}

export function resolveStage(
    envelopes: any,
    results: Record<string, number[]>,
    timePoints: number[],
    stage: number
): boolean {
    const peeks: StagedPeek[] = (envelopes as any).__peeks || [];
    if (!peeks.length) return false;

    const indexOfDay = new Map<number, number>();
    for (let i = 0; i < timePoints.length; i++) indexOfDay.set(timePoints[i], i);

    let applied = false;
    for (const { stage: s, op } of peeks) {
        if (s !== stage) continue;
        applied = true;
        op.apply({ envelopes, results, timePoints, indexOfDay });
    }
    // Remove applied peeks
    if (applied) {
        (envelopes as any).__peeks = peeks.filter(p => p.stage !== stage);
    }
    return applied;
}

// ---------- Generic peek helpers ----------

// Inject a descriptor per provided day using a factory
export function peekDescriptorAtDays(params: {
    targetKey: string;
    days: number[];
    make: (day: number, ctx: PeekContext) => any | null;
}): PeekOp {
    return {
        apply: (ctx: PeekContext) => {
            const { envelopes } = ctx;
            const add = envelopes[params.targetKey]?.gpuDescriptors?.push
                ? envelopes[params.targetKey].gpuDescriptors.push.bind(envelopes[params.targetKey].gpuDescriptors)
                : null;
            for (const d of params.days) {
                const desc = params.make(d, ctx);
                if (!desc) continue;
                if (add) add(desc); else {
                    envelopes[params.targetKey] = envelopes[params.targetKey] || {};
                    envelopes[params.targetKey].gpuDescriptors = ((envelopes[params.targetKey].gpuDescriptors || [])).concat([desc]);
                }
            }
        }
    };
}

// Reset an envelope to zero at a specific day by emitting a compensating T descriptor
export function peekResetToZero(envelopeKey: string, day: number): PeekOp {
    return {
        apply: ({ envelopes, results, indexOfDay }: PeekContext) => {
            const idx = indexOfDay.get(day);
            if (idx == null) return;
            const currentVal = (results[envelopeKey] && results[envelopeKey][idx]) ?? 0;
            if (currentVal === 0) return;
            const env = envelopes[envelopeKey] || {};
            const growth = {
                type: env?.growth_type || 'None',
                r: env?.growth_rate || 0,
                days_of_usefulness: env?.days_of_usefulness
            };
            const direction = currentVal > 0 ? 'out' : 'in';
            const thetaParamKey = currentVal > 0 ? 'b' : 'a';
            const theta = (_t: number) => (currentVal > 0 ? { b: Math.abs(currentVal) } : { a: Math.abs(currentVal) });
            envelopes[envelopeKey] = env;
            env.gpuDescriptors = (env.gpuDescriptors || []).concat([{
                type: 'T', direction, t_k: day, thetaParamKey, theta, growth
            }]);
        }
    };
}

// Reset an envelope to a specific target value at a given day
export function peekResetToValue(envelopeKey: string, day: number, targetValue: number): PeekOp {
    return {
        apply: ({ envelopes, results, indexOfDay }: PeekContext) => {
            const idx = indexOfDay.get(day);
            if (idx == null) return;
            const currentVal = (results[envelopeKey] && results[envelopeKey][idx]) ?? 0;
            const diff = targetValue - currentVal;
            if (diff === 0) return;
            const env = envelopes[envelopeKey] || {};
            const growth = {
                type: env?.growth_type || 'None',
                r: env?.growth_rate || 0,
                days_of_usefulness: env?.days_of_usefulness
            };
            const direction = diff > 0 ? 'in' : 'out';
            const thetaParamKey = diff > 0 ? 'a' : 'b';
            const theta = (_t: number) => (diff > 0 ? { a: Math.abs(diff) } : { b: Math.abs(diff) });
            envelopes[envelopeKey] = env;
            env.gpuDescriptors = (env.gpuDescriptors || []).concat([{
                type: 'T', direction, t_k: day, thetaParamKey, theta, growth
            }]);
        }
    };
}

// Emit impulses proportional to a source series at specified days (optional filter)
export function peekImpulseFromSeries(params: {
    sourceKey: string;
    targetKey: string;
    coeff: number;
    direction?: 'in' | 'out';
    thetaParamKey?: 'a' | 'b';
    days: number[];
    filter?: (day: number) => boolean;
}): PeekOp {
    const direction = params.direction ?? 'out';
    const thetaKey = params.thetaParamKey ?? (direction === 'in' ? 'a' : 'b');
    return {
        apply: ({ envelopes, results, indexOfDay }: PeekContext) => {
            const srcSeries = results[params.sourceKey] || [];
            const add = envelopes[params.targetKey]?.gpuDescriptors?.push
                ? envelopes[params.targetKey].gpuDescriptors.push.bind(envelopes[params.targetKey].gpuDescriptors)
                : null;
            for (const d of params.days) {
                if (params.filter && !params.filter(d)) continue;
                const idx = indexOfDay.get(d);
                if (idx == null) continue;
                const val = srcSeries[idx] || 0;
                const amount = val * params.coeff;
                if (amount === 0) continue;
                const desc = {
                    type: 'Impulse',
                    direction,
                    t_k: d,
                    thetaParamKey: thetaKey,
                    theta: (_t: number) => ({ [thetaKey]: Math.abs(amount) }),
                    growth: { type: 'None', r: 0 }
                } as any;
                if (add) add(desc); else {
                    envelopes[params.targetKey] = envelopes[params.targetKey] || {};
                    envelopes[params.targetKey].gpuDescriptors = ((envelopes[params.targetKey].gpuDescriptors || [])).concat([desc]);
                }
            }
        }
    };
}

// Incremental tax delta: tax(taxable + add) - tax(taxable) → Impulse out at days
export function peekTaxDeltaOnAdd(params: {
    taxableKey: string;
    addKey: string;
    taxesTargetKey: string;
    filingStatus: string;
    dependents: number;
    days: number[];
}): PeekOp {
    return {
        apply: ({ envelopes, results, indexOfDay }: PeekContext) => {
            const taxableSeries = results[params.taxableKey] || [];
            const addSeries = results[params.addKey] || [];
            const addDesc = (desc: any) => {
                if ((envelopes as any)[params.taxesTargetKey]?.gpuDescriptors?.push) {
                    (envelopes as any)[params.taxesTargetKey].gpuDescriptors.push(desc);
                } else {
                    (envelopes as any)[params.taxesTargetKey] = (envelopes as any)[params.taxesTargetKey] || {};
                    (envelopes as any)[params.taxesTargetKey].gpuDescriptors = (((envelopes as any)[params.taxesTargetKey].gpuDescriptors || [])).concat([desc]);
                }
            };
            const estimateTax = (income: number) => {
                const brackets = params.filingStatus === 'Married Filing Jointly'
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
                tax -= params.dependents * 2000;
                return Math.max(0, tax);
            };
            for (const d of params.days) {
                const idx = indexOfDay.get(d);
                if (idx == null) continue;
                const taxable = taxableSeries[idx] || 0;
                const addVal = addSeries[idx] || 0;
                const delta = estimateTax(taxable + addVal) - estimateTax(taxable);
                if (delta <= 0) continue;
                addDesc({
                    type: 'Impulse', direction: 'out', t_k: d, thetaParamKey: 'b',
                    theta: (_t: number) => ({ b: delta }), growth: { type: 'None', r: 0 }
                });
            }
        }
    };
}


