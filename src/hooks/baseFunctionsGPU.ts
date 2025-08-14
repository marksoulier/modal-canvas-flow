import type { Theta } from "./types";

// GPU descriptor types
export type GrowthParams = {
    type: string;
    r: number;
    days_of_usefulness?: number;
};

export type GPUDescriptorRaw = {
    type: "T" | "R" | "Impulse" | "LazyCorrection" | "ScaleFromEnvelope";
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
    // For LazyCorrection only
    target?: number;
    // For ScaleFromEnvelope only
    sourceKey?: string;
    coeff?: number;
    untilDay?: number; // if provided with applyBefore=true, applies when t < untilDay; if applyBefore=false, when t >= untilDay
    applyBefore?: boolean;
};

export type GPUOccurrence = {
    t_k: number;
    startIndex: number; // index into timePoints where u(t - t_k) turns on
    baseValue: number; // theta(key) evaluated at t_k (for T/R/Impulse). For LazyCorrection, this can be 0 and `target` is used.
    target?: number; // for LazyCorrection
};

// T is an occurence of an event at a time t_k
// R is a reocurring of events at a time t0, dt, tf
// Impulse is an event like stock market that uses a vector of daily values 
// LazyCorrection is a correction event that takes the envelopes value at time of occurance and evlauates it and applys a T of the difference between evaluated value and amount
// ScaleFromEnvelope pretty much make sthe equation of a envelope w(t) = coeff * w_source(t)

export type GPUDescriptorPrecomputed = {
    type: "T" | "R" | "Impulse" | "LazyCorrection" | "ScaleFromEnvelope";
    direction: "in" | "out";
    occurrences: GPUOccurrence[];
    growth: any;
    // Metadata for special descriptors
    target?: number; // LazyCorrection
    sourceKey?: string; // ScaleFromEnvelope
    coeff?: number; // ScaleFromEnvelope
    untilDay?: number; // ScaleFromEnvelope
    applyBefore?: boolean; // ScaleFromEnvelope
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
            } else if (raw.type === "LazyCorrection" && typeof raw.t_k === "number") {
                const t_k = raw.t_k;
                const startIndex = findStartIndex(timePoints, t_k);
                // baseValue not known yet; store target for runtime resolution
                occurrences.push({ t_k, startIndex, baseValue: 0, target: Number(raw.target ?? 0) });
            } else if (raw.type === "ScaleFromEnvelope") {
                // Expand by copying the source envelope's descriptors into this envelope,
                // scaled by coeff and signed by this descriptor's direction.
                const sourceKey = raw.sourceKey;
                const coeff = Number(raw.coeff ?? 0);
                if (!sourceKey || coeff === 0) {
                    continue;
                }
                const sourceEnv = envelopes[sourceKey];
                if (!sourceEnv || !Array.isArray(sourceEnv.gpuDescriptors)) {
                    continue;
                }
                const signScale = raw.direction === "in" ? 1 : -1;
                const untilDay = raw.untilDay;
                const applyBefore = raw.applyBefore;

                // Guard against cycles across envelopes
                const visited = new Set<string>([key]);

                const copyFromSource = (srcEnvKey: string, coeffAcc: number, signAcc: number) => {
                    if (visited.has(srcEnvKey)) return;
                    visited.add(srcEnvKey);
                    const srcEnv = envelopes[srcEnvKey];
                    if (!srcEnv || !Array.isArray(srcEnv.gpuDescriptors)) return;
                    for (const sDesc of srcEnv.gpuDescriptors as AnyGPUDescriptor[]) {
                        const isPre = (sDesc as GPUDescriptorPrecomputed).occurrences;
                        const sRaw = sDesc as GPUDescriptorRaw;
                        let preSrc: GPUDescriptorPrecomputed | null = null;
                        if (isPre) {
                            preSrc = sDesc as GPUDescriptorPrecomputed;
                        } else {
                            // Compute occurrences for the source raw descriptor
                            const tmpOcc: GPUOccurrence[] = [];
                            if ((sRaw.type === "T" || sRaw.type === "Impulse") && typeof sRaw.t_k === "number") {
                                const t_k = sRaw.t_k;
                                const baseTheta = sRaw.theta(t_k);
                                const tRel = 0;
                                const baseValue = typeof sRaw.computeValue === 'function'
                                    ? Number(sRaw.computeValue(baseTheta, tRel))
                                    : Number(baseTheta[sRaw.thetaParamKey] ?? 0);
                                const startIndex = findStartIndex(timePoints, t_k);
                                tmpOcc.push({ t_k, startIndex, baseValue });
                            } else if (sRaw.type === "LazyCorrection" && typeof sRaw.t_k === "number") {
                                const t_k = sRaw.t_k;
                                const startIndex = findStartIndex(timePoints, t_k);
                                tmpOcc.push({ t_k, startIndex, baseValue: 0, target: Number(sRaw.target ?? 0) });
                            } else if (sRaw.type === "R" && typeof sRaw.t0 === "number" && typeof sRaw.dt === "number" && typeof sRaw.tf === "number") {
                                let i = 0;
                                const lastTime = timePoints.length > 0 ? timePoints[timePoints.length - 1] : sRaw.tf;
                                const endTf = Math.min(sRaw.tf, lastTime);
                                while (true) {
                                    const t_k = sRaw.t0 + i * sRaw.dt;
                                    if (t_k > endTf) break;
                                    const baseTheta = sRaw.theta(t_k);
                                    const tRel = t_k - sRaw.t0;
                                    const baseValue = typeof sRaw.computeValue === 'function'
                                        ? Number(sRaw.computeValue(baseTheta, tRel))
                                        : Number(baseTheta[sRaw.thetaParamKey] ?? 0);
                                    const startIndex = findStartIndex(timePoints, t_k);
                                    tmpOcc.push({ t_k, startIndex, baseValue });
                                    i++;
                                }
                            } else if (sRaw.type === "ScaleFromEnvelope") {
                                // Recursively expand nested scale relationships
                                const nestedSource = sRaw.sourceKey;
                                if (nestedSource && Number(sRaw.coeff ?? 0) !== 0) {
                                    const nestedCoeff = coeffAcc * Number(sRaw.coeff ?? 0);
                                    const nestedSignAcc = signAcc * (sRaw.direction === "in" ? 1 : -1);
                                    copyFromSource(nestedSource, nestedCoeff, nestedSignAcc);
                                }
                                preSrc = null;
                            }
                            if (!preSrc) {
                                preSrc = {
                                    type: sRaw.type,
                                    direction: sRaw.direction,
                                    occurrences: tmpOcc,
                                    growth: sRaw.growth,
                                } as GPUDescriptorPrecomputed;
                            }
                        }

                        if (!preSrc) continue;

                        // Scale and copy the precomputed descriptor from the source
                        const srcSign = preSrc.direction === "in" ? 1 : -1;
                        if (preSrc.type === "LazyCorrection") {
                            // Scale the ABSOLUTE target value by coeff only (sign is irrelevant for lazy target)
                            const scaledOcc: GPUOccurrence[] = preSrc.occurrences.map(o => ({
                                t_k: o.t_k,
                                startIndex: o.startIndex,
                                baseValue: 0,
                                target: Number(o.target ?? 0) * coeffAcc,
                            }));
                            const copied: GPUDescriptorPrecomputed = {
                                type: "LazyCorrection",
                                direction: "in",
                                occurrences: scaledOcc,
                                growth: preSrc.growth,
                                // carry gating from the scale descriptor
                                untilDay,
                                applyBefore,
                            } as any;
                            newDescriptors.push(copied);
                        } else if (preSrc.type === "T" || preSrc.type === "R" || preSrc.type === "Impulse") {
                            const scaledOcc: GPUOccurrence[] = preSrc.occurrences.map(o => ({
                                t_k: o.t_k,
                                startIndex: o.startIndex,
                                baseValue: o.baseValue * coeffAcc * signAcc * srcSign,
                            }));
                            const copied: GPUDescriptorPrecomputed = {
                                type: preSrc.type,
                                direction: "in",
                                occurrences: scaledOcc,
                                growth: preSrc.growth,
                                // carry gating from the scale descriptor
                                untilDay,
                                applyBefore,
                            } as any;
                            newDescriptors.push(copied);
                        }
                    }
                };

                copyFromSource(sourceKey, coeff, signScale);
                continue;
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

    // Flatten occurrences and sort by time; non-lazy first when equal time
    type FlatOcc = {
        t_k: number;
        startIndex: number;
        type: GPUDescriptorPrecomputed["type"];
        growth: any;
        sign: number; // +1 in, -1 out (ignored for LazyCorrection at runtime)
        baseValue: number;
        target?: number;
        // ScaleFromEnvelope metadata
        sourceKey?: string;
        coeff?: number;
        untilDay?: number;
        applyBefore?: boolean;
    };
    const flat: FlatOcc[] = [];
    for (const desc of gpuDescriptors) {
        if (!desc || !Array.isArray(desc.occurrences)) continue;
        const sign = desc.direction === "in" ? 1 : -1;
        for (const occ of desc.occurrences) {
            flat.push({
                t_k: occ.t_k,
                startIndex: occ.startIndex,
                type: desc.type,
                growth: desc.growth,
                sign,
                baseValue: occ.baseValue,
                target: (desc as any).target ?? occ.target,
                sourceKey: (desc as any).sourceKey,
                coeff: (desc as any).coeff,
                untilDay: (desc as any).untilDay,
                applyBefore: (desc as any).applyBefore,
            });
        }
        // ScaleFromEnvelope is expanded during precompute; no runtime meta row needed
    }
    flat.sort((a, b) => a.t_k - b.t_k || ((a.type === "LazyCorrection") ? 1 : 0) - ((b.type === "LazyCorrection") ? 1 : 0));

    for (const occ of flat) {
        const t_k = occ.t_k;
        const j0 = occ.startIndex;
        const untilDay = occ.untilDay;
        const applyBefore = !!occ.applyBefore;
        const isAllowedAt = (t: number): boolean => {
            if (untilDay === undefined) return true;
            return applyBefore ? t < untilDay : t >= untilDay;
        };
        if (occ.type === "Impulse") {
            if (j0 >= 0 && j0 < timePoints.length && timePoints[j0] === t_k) {
                if (isAllowedAt(timePoints[j0])) {
                    result[j0] += occ.sign * occ.baseValue;
                }
            }
            continue;
        }
        if (occ.type === "ScaleFromEnvelope") {
            // No-op at runtime; handled by precompute expansion
            continue;
        }
        if (occ.type === "LazyCorrection") {
            // Always evaluate the correction by snapping to the first evaluation point >= t_k
            if (j0 < 0 || j0 >= timePoints.length) continue;
            const target = Number(occ.target ?? 0);
            const currentAtSnap = result[j0];
            const diff = target - currentAtSnap;
            if (Math.abs(diff) < 1e-9) continue;
            const base = Math.abs(diff);
            const sign = diff >= 0 ? 1 : -1;
            for (let j = j0; j < timePoints.length; j++) {
                const delta = timePoints[j] - t_k;
                const growth = f_growth_gpu(occ.growth, delta);
                if (isAllowedAt(timePoints[j])) {
                    result[j] += sign * base * growth;
                }
            }
            continue;
        }
        // Regular T/R growth contribution
        const base = occ.baseValue;
        if (base === 0) continue;
        for (let j = j0; j < timePoints.length; j++) {
            const delta = timePoints[j] - t_k;
            const growth = f_growth_gpu(occ.growth, delta);
            if (isAllowedAt(timePoints[j])) {
                result[j] += occ.sign * base * growth;
            }
        }
    }

    return result;
};


