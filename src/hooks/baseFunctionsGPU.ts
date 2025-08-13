import type { Theta } from "./types";

// GPU descriptor types
export type GrowthParams = {
    type: string;
    r: number;
    days_of_usefulness?: number;
};

export type GPUDescriptorRaw = {
    type: "T" | "R" | "Impulse";
    direction: "in" | "out";
    t_k?: number;
    t0?: number;
    dt?: number;
    tf?: number;
    thetaParamKey: string; // typically "a" for inflow, "b" for outflow
    theta: Theta; // original theta(t)
    growth: any;
    // Optional: compute base value from multiple theta params (e.g., f_salary)
    computeValue?: (params: Record<string, any>, tRelative: number) => number;
};

export type GPUOccurrence = {
    t_k: number;
    startIndex: number; // index into timePoints where u(t - t_k) turns on
    baseValue: number; // theta(key) evaluated at t_k
};

export type GPUDescriptorPrecomputed = {
    type: "T" | "R" | "Impulse";
    direction: "in" | "out";
    occurrences: GPUOccurrence[];
    growth: any;
};

export type AnyGPUDescriptor = GPUDescriptorRaw | GPUDescriptorPrecomputed;

export const addGPUDescriptor = (
    envelopes: Record<string, any>,
    envelopeKey: string,
    descriptor: GPUDescriptorRaw
): void => {
    if (!envelopes[envelopeKey]) return;
    if (!envelopes[envelopeKey].gpuDescriptors) {
        envelopes[envelopeKey].gpuDescriptors = [] as AnyGPUDescriptor[];
    }
    envelopes[envelopeKey].gpuDescriptors.push(descriptor);
};

const f_growth_gpu = (theta_g: GrowthParams, t: number): number => {
    const growth_type = theta_g.type;
    const r = theta_g.r;
    if (growth_type === "Simple Interest") {
        return 1 + r * (t / 365.25);
    } else if (growth_type === "Daily Compound") {
        return Math.pow(1 + r / 365.25, t);
    } else if (growth_type === "Monthly Compound") {
        return Math.pow(1 + r / 12, (12 * t) / 365);
    } else if (growth_type === "Yearly Compound") {
        return Math.pow(1 + r, t / 365.25);
    } else if (growth_type === "Appreciation") {
        return 1 + r * (t / 365.25);
    } else if (growth_type === "Depreciation") {
        return Math.max(0, Math.pow(1 - r, t / 365.25));
    } else if (growth_type === "Depreciation (Days)") {
        const days = theta_g.days_of_usefulness;
        if (!days || days <= 0) return 0;
        return Math.max(0, 1 - t / days);
    } else if (growth_type === "None") {
        return 1;
    } else {
        return 1;
    }
};

const findStartIndex = (timePoints: number[], target: number): number => {
    // first index j where timePoints[j] >= target
    let lo = 0;
    let hi = timePoints.length - 1;
    let ans = timePoints.length;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (timePoints[mid] >= target) {
            ans = mid;
            hi = mid - 1;
        } else {
            lo = mid + 1;
        }
    }
    return ans === timePoints.length ? timePoints.length : ans;
};

export const precomputeThetasForGPU = (
    envelopes: Record<string, any>,
    timePoints: number[]
): void => {
    for (const key in envelopes) {
        const env = envelopes[key];
        if (!env || !env.gpuDescriptors || !Array.isArray(env.gpuDescriptors)) continue;

        const newDescriptors: AnyGPUDescriptor[] = [];
        for (const desc of env.gpuDescriptors as AnyGPUDescriptor[]) {
            // If already precomputed, keep as-is
            if ((desc as GPUDescriptorPrecomputed).occurrences) {
                newDescriptors.push(desc);
                continue;
            }

            const raw = desc as GPUDescriptorRaw;
            const occurrences: GPUOccurrence[] = [];

            if ((raw.type === "T" || raw.type === "Impulse") && typeof raw.t_k === "number") {
                const t_k = raw.t_k;
                const baseTheta = raw.theta(t_k);
                const tRel = 0; // T occurrences use t_k - t0 where t0 is 0 in our usage
                const baseValue = typeof raw.computeValue === 'function'
                    ? Number(raw.computeValue(baseTheta, tRel))
                    : Number(baseTheta[raw.thetaParamKey] ?? 0);
                const startIndex = findStartIndex(timePoints, t_k);
                occurrences.push({ t_k, startIndex, baseValue });
            } else if (raw.type === "R" && typeof raw.t0 === "number" && typeof raw.dt === "number" && typeof raw.tf === "number") {
                let i = 0;
                const lastTime = timePoints.length > 0 ? timePoints[timePoints.length - 1] : raw.tf;
                const endTf = Math.min(raw.tf, lastTime);
                while (true) {
                    const t_k = raw.t0 + i * raw.dt;
                    if (t_k > endTf) break;
                    const baseTheta = raw.theta(t_k);
                    const tRel = t_k - raw.t0; // match T(params, t_k - t0)
                    const baseValue = typeof raw.computeValue === 'function'
                        ? Number(raw.computeValue(baseTheta, tRel))
                        : Number(baseTheta[raw.thetaParamKey] ?? 0);
                    const startIndex = findStartIndex(timePoints, t_k);
                    occurrences.push({ t_k, startIndex, baseValue });
                    i++;
                }
            }

            const pre: GPUDescriptorPrecomputed = {
                type: raw.type,
                direction: raw.direction,
                occurrences,
                growth: raw.growth
            };
            newDescriptors.push(pre);
        }

        env.gpuDescriptors = newDescriptors;
    }
};

export const evaluateGPUDescriptors = (
    gpuDescriptors: GPUDescriptorPrecomputed[] | undefined,
    timePoints: number[]
): number[] => {
    const result = new Array(timePoints.length).fill(0);
    if (!gpuDescriptors || gpuDescriptors.length === 0) return result;

    for (const desc of gpuDescriptors) {
        // Defensive: skip any descriptors that haven't been precomputed
        if (!desc || !(desc as any).occurrences || !Array.isArray((desc as any).occurrences)) {
            continue;
        }
        const sign = desc.direction === "in" ? 1 : -1;
        for (const occ of desc.occurrences) {
            const t_k = occ.t_k;
            const base = occ.baseValue;
            if (desc.type === "Impulse") {
                const j = occ.startIndex;
                if (j >= 0 && j < timePoints.length && timePoints[j] === t_k) {
                    result[j] += sign * base; // no growth, single index
                }
            } else {
                for (let j = occ.startIndex; j < timePoints.length; j++) {
                    const t = timePoints[j];
                    const delta = t - t_k;
                    const growth = f_growth_gpu(desc.growth, delta);
                    result[j] += sign * base * growth;
                }
            }
        }
    }

    return result;
};


