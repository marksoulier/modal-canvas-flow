// utilities.ts
import type { Theta } from "./types";
import { addGPUDescriptor, evaluateEnvelopeAtTime } from "./baseFunctionsGPU";
import { getTypedParams, getTypedEventFunctions, getTypedUpdatingParams } from "../types/generated-types";
import type * as AllEventTypes from '../types/generated-types';


export const u = (t: number): number => (t >= 0 ? 1.0 : 0.0);

export const impulse = (t: number): number => (t == 0 ? 1.0 : 0.0);

// Update P to support hybrid (constant or function) parameters
export const P = (params: Record<string, number | ((t: number) => number)>): Theta => {
    return (t: number) => {
        const result: Record<string, number> = {};
        for (const key in params) {
            const val = params[key];
            result[key] = typeof val === "function" ? (val as (t: number) => number)(t) : val;
        }
        return result;
    };
};

export const T = (
    theta_event: Record<string, number>,
    f: (params: Record<string, any>, t: number) => number,
    theta: Theta = P({}),
    theta_g: Record<string, any>,
    t0: number = 0 // time used for start of a reoccuring event. Only use in reoccuring events.
): ((t: number) => number) => {
    const t_k = theta_event.t_k;
    const params = theta(t_k); // θ = θ(t_k) - evaluate at t_k

    return (t: number) => f(params, t_k - t0) * u(t - t_k) * f_growth(theta_g, t - t_k);
};

// Growth magnitude function with different compounding types
export const f_growth = (theta_g: Record<string, any>, t: number): number => {
    const growth_type = theta_g.type;
    const r = theta_g.r;
    if (growth_type === "Simple Interest") {
        return 1 + r * (t / 365.25);
    } else if (growth_type === "Daily Compound") {
        return Math.pow(1 + r / 365.25, t);
    } else if (growth_type === "Monthly Compound") {
        return Math.pow(1 + r / 12, 12 * t / 365);
    } else if (growth_type === "Yearly Compound") {
        return Math.pow(1 + r, t / 365.25);
    } else if (growth_type === "Simple Interest") {
        return 1 + r * (t / 365.25);
    } else if (growth_type === "Appreciation") {
        return 1 + r * (t / 365.25);
    } else if (growth_type === "Depreciation") {
        return Math.max(0, Math.pow(1 - r, t / 365.25));
    } else if (growth_type === "Depreciation (Days)") {
        const days = theta_g.days_of_usefulness;
        if (!days || days <= 0) throw new Error("days_of_usefulness must be positive");
        return Math.max(0, 1 - t / days);
    } else if (growth_type === "None") {
        return 1;
    } else {
        throw new Error(`Unknown growth type: ${growth_type}`);
    }
};

export const impulse_T = (
    theta_event: Record<string, number>,
    f: (params: Record<string, any>, t: number) => number,
    theta: Theta = P({}),
    theta_g: Record<string, any>,
    t0: number = 0 // time used for start of a reoccuring event. Only use in reoccuring events.
): ((t: number) => number) => {
    const t_k = theta_event.t_k;
    const params = theta(t_k); // θ = θ(t_k) - evaluate at t_k

    return (t: number) => f(params, t_k - t0) * impulse(t - t_k);
};

// Helper: append a lazy correction to an envelope at a given time to match a target amount
export const appendLazyCorrectionToEnvelope = (
    env: { functions: Array<(t: number) => number> },
    envelopes: Record<string, any>,
    to_key: string,
    correctionTime: number,
    targetAmountAtCorrection: number
) => {
    const priorFunctions = [...env.functions];
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, to_key);

    let cachedCorrection: ((t: number) => number) | null = null;
    const lazyCorrection = (t: number) => {
        if (!cachedCorrection) {
            let simulatedAtCorrection = 0.0;
            for (const f of priorFunctions) {
                simulatedAtCorrection += f(correctionTime);
            }
            const difference = targetAmountAtCorrection - simulatedAtCorrection;
            const correctionTheta = difference >= 0 ? P({ a: Math.abs(difference) }) : P({ b: Math.abs(difference) });
            const correctionBase = difference >= 0 ? f_in : f_out;
            cachedCorrection = T(
                { t_k: correctionTime },
                correctionBase,
                correctionTheta,
                theta_growth_dest
            );
        }
        return cachedCorrection(t);
    };

    env.functions.push(lazyCorrection);
};

// Helper: append a lazy, one-time amount at t_k computed from a callback using prior snapshots
export const appendLazyComputedAmountAt = (
    env: { functions: Array<(t: number) => number> },
    envelopes: Record<string, any>,
    to_key: string,
    eventTime: number,
    computeAmount: () => number
) => {
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, to_key);

    let cachedFunc: ((t: number) => number) | null = null;
    const lazyFunc = (t: number) => {
        if (!cachedFunc) {
            const amount = computeAmount();
            const theta = amount >= 0 ? P({ b: Math.abs(amount) }) : P({ a: Math.abs(amount) });
            const base = amount >= 0 ? f_out : f_in;
            cachedFunc = T(
                { t_k: eventTime },
                base,
                theta,
                theta_growth_dest
            );
        }
        return cachedFunc(t);
    };

    env.functions.push(lazyFunc);
};

// Helper: append a lazy impulse amount computed at evaluation time
export const appendLazyImpulseAmountAt = (
    env: { functions: Array<(t: number) => number> },
    envelopes: Record<string, any>,
    to_key: string,
    eventTime: number,
    computeAmount: () => number
) => {
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, to_key);

    let cachedFunc: ((t: number) => number) | null = null;
    const lazyFunc = (t: number) => {
        if (!cachedFunc) {
            const amount = computeAmount();
            const theta = amount >= 0 ? P({ b: Math.abs(amount) }) : P({ a: Math.abs(amount) });
            const base = amount >= 0 ? f_out : f_in;
            cachedFunc = impulse_T(
                { t_k: eventTime },
                base,
                theta,
                theta_growth_dest,
                0
            );
        }
        return cachedFunc(t);
    };

    env.functions.push(lazyFunc);
};

export const R = (
    theta_re: Record<string, number>,
    f: (params: Record<string, any>, t: number) => number,
    theta: Theta,
    theta_g: Record<string, any>,
): ((t: number) => number) => {
    const t0 = theta_re.t0;
    const dt = theta_re.dt;
    const tf = theta_re.tf;

    return (t: number) => {
        let total = 0.0;
        let i = 0;

        while (true) {
            const ti = t0 + i * dt;
            if (ti > tf) break;

            // Check if there's an override for this index
            let current_t = ti;
            let current_theta = theta;

            // Apply the occurrence function with growth
            const occurrence = T({ t_k: current_t }, f, current_theta, theta_g, t0);
            total += occurrence(t);
            i++;
        }

        return total;
    };
};

export const D = (
    tDelta: number,
    fBefore: (t: number) => number,
    fAfter: (t: number) => number
): ((t: number) => number) => {
    return (t: number) => (t < tDelta ? fBefore(t) : fAfter(t));
};

export const gamma = (
    theta: Theta,
    thetaChange: Record<string, number | ((t: number) => number)>,
    tStar: number
): Theta => {
    return (t: number) => {
        if (t < tStar) return theta(t);

        const baseTheta = theta(t);
        const result: Record<string, number> = { ...baseTheta };

        // Handle both number and function values in thetaChange
        for (const [key, value] of Object.entries(thetaChange)) {
            result[key] = typeof value === 'function' ? value(t) : value;
        }

        return result;
    };
};

export const inflationAdjust = (
    base: number,
    inflation_rate: number,
    start_time: number
) => (t: number) =>
        base * Math.pow(1 + inflation_rate, (t - start_time) / 365);

export const stepAdjust = (
    current_amount: number,
    step_amount: number,
    frequency: number,
    start_time: number,
    end_time?: number
) => (t: number) => {
    if (t < start_time) return current_amount;

    // If end_time is provided and we're past it, use the final step count
    if (end_time !== undefined && t >= end_time) {
        const total_steps = Math.floor((end_time - start_time) / frequency);
        return current_amount + (step_amount * total_steps);
    }

    // During the stepping period
    const steps = Math.floor((t - start_time) / frequency);
    return current_amount + (step_amount * steps);
};

// Helper function to get growth parameters from envelopes for any list of keys
export const get_growth_parameters = (
    envelopes: Record<string, any>,
    ...keys: (string | undefined)[]
): Record<string, any>[] => {
    return keys.map(key => {
        if (key && key in envelopes) {
            const env = envelopes[key];
            return {
                type: env.growth_type || "None",
                r: env.growth_rate || 0.0
            };
        } else {
            return { type: "None", r: 0.0 };
        }
    });
};

// baseFunctions.ts
// f_in: inflow function
export const f_in = (theta_in: Record<string, any>, t: number): number => {
    return theta_in.a;
};

// f_out: outflow function
export const f_out = (theta_out: Record<string, any>, t: number): number => {
    return -theta_out.b;
};


export const f_salary = (theta_s: Record<string, any>, t: number): number => {
    const S = theta_s.S; // Salary
    const p = theta_s.p; // Pay periods per year
    const r_SS = theta_s.r_SS; // Social Security rate
    const r_Med = theta_s.r_Med; // Medicare rate
    const r_Fed = theta_s.r_Fed; // Federal tax rate
    const r_401k = theta_s.r_401k; // 401k contribution rate

    return (S / p) * (1 - r_SS - r_Med - r_Fed - r_401k);
};

// f_wage: wage with deductions
export const f_wage = (theta_w: Record<string, any>, t: number): number => {
    const w = theta_w.w; // Hourly wage
    const h = theta_w.h; // Hours per week
    const p = theta_w.p; // Pay periods per year
    const r_SS = theta_w.r_SS; // Social Security rate
    const r_Fed = theta_w.r_Fed; // Federal tax rate
    const r_Med = theta_w.r_Med; // Medicare rate
    const r_401k = theta_w.r_401k; // 401k contribution rate

    return ((w * h * 52) / p) * (1 - r_SS - r_Fed - r_Med - r_401k);
};

// f_com: compound interest - REMOVED (no longer used)
// f_sal: salary with deductions

// f_wage: wage with deductions

// f_com: compound interest - REMOVED (no longer used)

// f_sal: salary with deductions

// f_wage: wage with deductions

export const f_401 = (theta_401: Record<string, any>, t: number): number => {
    const S = theta_401.S; // Salary
    const p = theta_401.p; // Pay periods per year
    const r_401 = theta_401.r_401; // 401k contribution rate

    return (S / p) * r_401;
};

// Mortgage payment calculation - REMOVED (no longer used)
// No longer needed for creating a closed form amoratization schedule
// export const f_principal_payment = (theta: Record<string, any>, t: number): number => {
//     const months = Math.floor(t / (365.25 / 12));
//     const r = theta.r;
//     const y = theta.y;
//     const Loan = theta.P;
//     // Calculate default mortgage payment if not provided
//     const default_payment = Loan * (r / 12) * Math.pow(1 + r / 12, 12 * y) / (Math.pow(1 + r / 12, 12 * y) - 1);
//     const p_m = theta.p_mortgage ?? default_payment;
//     const payment = Loan * Math.pow(1 + r / 12, months) * (r / 12) / (Math.pow(1 + r / 12, 12 * y) - 1);
//     const mortgage_amt = f_monthly_payment({ P: Loan, r: r, y: y }, t);
//     const principle_payment = payment - Math.max(mortgage_amt - p_m, 0);
//     return principle_payment;
// };

export const f_monthly_payment = (theta: Record<string, any>, t: number): number => {
    if (theta.r === 0) {
        return +(theta.P / (12 * theta.y)).toFixed(2);
    }
    return +(
        -theta.P * (theta.r / 12) * Math.pow(1 + theta.r / 12, 12 * theta.y) /
        (Math.pow(1 + theta.r / 12, 12 * theta.y) - 1)
    ).toFixed(2);
};

// Minimal principal payment function to satisfy references
export const f_principal_payment = (theta: Record<string, any>, t: number): number => {
    // Approximate principal component as full payment; refine later if needed for accuracy
    if (theta.r === 0) {
        return +(theta.P / (12 * theta.y)).toFixed(2);
    }
    return +(
        theta.P * (theta.r / 12) * Math.pow(1 + theta.r / 12, 12 * theta.y) /
        (Math.pow(1 + theta.r / 12, 12 * theta.y) - 1)
    ).toFixed(2);
};

export const f_insurance = (theta: Record<string, any>, t: number): number => {
    return theta.p0 * Math.pow(1 + theta.r_adj, t / 365);
};

export const f_maint = (theta: Record<string, any>, t: number): number => {
    return theta.m0 + theta.alpha * (t - theta.t0);
};

export const f_inflation_adjust = (
    W: (t: number) => number,
    theta: Theta,
    t_i: number
) => {
    const params = theta(t_i); // Evaluate parameters at time of occurrence
    return (t: number) => t >= params.t_today ? W(t) / Math.pow(1 + params.r_inf, (t - params.t_today) / 365) : W(t);
};

export const f_empirical = (theta: Record<string, any> | Theta, t: number): number => {
    const params = typeof theta === 'function' ? theta(t) : theta;
    const V_obs = params.V_obs;
    const t_k = params.t_k;

    // Dirac delta approximation - returns V_obs when t is very close to t_k
    const epsilon = 1e-6;
    if (Math.abs(t - t_k) < epsilon) {
        return V_obs;
    } else {
        return 0.0;
    }
};

export const O_empirical = (theta: Record<string, any>, t: number): number => {
    const V_obs = theta.V_obs;
    const t_k = theta.t_k;

    // Dirac delta approximation - returns V_obs when t is very close to t_k
    const epsilon = 1e-6;
    if (Math.abs(t - t_k) < epsilon) {
        return V_obs;
    } else {
        return 0.0;
    }
};

export const f_get_job = (theta: Record<string, any>, t: number): number => {
    return R({ t0: theta.time_start, dt: 365.25 / theta.p, tf: theta.time_end }, f_salary, P(theta), { type: "None", r: 0.0 })(t);
};

export const outflow = (event: any, envelopes: Record<string, any>, onUpdate: (updates: Array<{ eventId: number, paramType: string, value: number }>) => void, event_functions?: Array<{ title: string; enabled: boolean }>) => {
    //Declare types
    const params = getTypedParams<AllEventTypes.outflowParams>(event);
    const functions = getTypedEventFunctions<AllEventTypes.outflowFunctionState>(event);


    //const params = event.parameters;

    // Get function states with type safety
    const outflowEnabled = functions.outflow ?? true;  // Default to true if not specified

    // Get growth parameters for source envelope
    const [theta_growth_source] = get_growth_parameters(envelopes, params.from_key);

    let theta = P({ b: params.amount });
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};
        if (upd_type === "update_amount") {
            // Just use gamma to set the amount to new value at the start time
            theta = gamma(theta, {
                b: upd_params.amount
            }, upd_params.start_time);
        }
        if (upd_type === "step_amount") {
            // Get the current amount at start time
            const current_amount = theta(upd_params.start_time).b;

            // Apply step increases as a function that will be evaluated when theta is called
            theta = gamma(theta, {
                b: stepAdjust(
                    current_amount,
                    upd_params.amount,
                    upd_params.frequency_days,
                    upd_params.start_time,
                    upd_params.end_time  // Pass end_time to stepAdjust
                )
            }, upd_params.start_time);
        }
    }

    let total_outflow = 0.0;
    let number_of_recurring_outflows = 0;
    let final_recurring_outflow = 0; //the day of final recurring outflow

    //See if event is reoccuring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        if (outflowEnabled) {
            // GPU descriptor (R)
            addGPUDescriptor(envelopes, params.from_key, {
                type: "R",
                direction: "out",
                t0: params.start_time,
                dt: params.frequency_days,
                tf: params.end_time,
                thetaParamKey: "b",
                theta,
                growth: theta_growth_source
            });
        }
        number_of_recurring_outflows = Math.floor((params.end_time - params.start_time) / params.frequency_days) + 1;
        total_outflow = (number_of_recurring_outflows) * params.amount;
        // Calculate the last frequency day interval from the start time before or equal to the end time
        final_recurring_outflow = params.start_time + number_of_recurring_outflows * params.frequency_days;
    } else {
        if (outflowEnabled) {
            // GPU descriptor (T)
            addGPUDescriptor(envelopes, params.from_key, {
                type: "T",
                direction: "out",
                t_k: params.start_time,
                thetaParamKey: "b",
                theta,
                growth: theta_growth_source
            });
        }

        number_of_recurring_outflows = 1;
        final_recurring_outflow = params.start_time;
        total_outflow = params.amount;
    }

    // place in total number of recurring outflows, final recurring outflow, and total outflow
    onUpdate([
        { eventId: event.id, paramType: "number_of_recurring_outflows", value: number_of_recurring_outflows },
        { eventId: event.id, paramType: "final_recurring_outflow", value: final_recurring_outflow },
        { eventId: event.id, paramType: "total_outflow", value: total_outflow }
    ]);
};

export const inflow = (event: any, envelopes: Record<string, any>, onUpdate: (updates: Array<{ eventId: number, paramType: string, value: number }>) => void) => {
    //Declare types
    const params = getTypedParams<AllEventTypes.inflowParams>(event);
    const functions = getTypedEventFunctions<AllEventTypes.inflowFunctionState>(event);

    // Get function states with type safety
    const inflowEnabled = functions.inflow ?? true;  // Default to true if not specified

    // Get growth parameters for source envelope
    const [theta_growth_dest] = get_growth_parameters(envelopes, params.to_key);

    // updating events update amount
    let theta = P({ a: params.amount });
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};
        if (upd_type === "update_amount") {
            // Just use gamma to set the amount to new value at the start time
            theta = gamma(theta, {
                a: upd_params.amount
            }, upd_params.start_time);
        }

        if (upd_type === "step_amount") {
            // Get the current amount at start time
            const current_amount = theta(upd_params.start_time).a;

            // Apply step increases as a function that will be evaluated when theta is called
            theta = gamma(theta, {
                a: stepAdjust(
                    current_amount,
                    upd_params.amount,
                    upd_params.frequency_days,
                    upd_params.start_time,
                    upd_params.end_time  // Pass end_time to stepAdjust
                )
            }, upd_params.start_time);
        }
    }

    let total_inflow = 0.0;
    let number_of_recurring_inflows = 0;
    let final_recurring_inflow = 0; //the day of final recurring inflow

    //See if event is reoccuring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        if (inflowEnabled) {
            // GPU descriptor (R - in)
            addGPUDescriptor(envelopes, params.to_key, {
                type: "R",
                direction: "in",
                t0: params.start_time,
                dt: params.frequency_days,
                tf: params.end_time,
                thetaParamKey: "a",
                theta,
                growth: theta_growth_dest
            });
        }

        number_of_recurring_inflows = Math.floor((params.end_time - params.start_time) / params.frequency_days) + 1;
        total_inflow = (number_of_recurring_inflows) * params.amount;
        // Calculate the last frequency day interval from the start time before or equal to the end time
        final_recurring_inflow = params.start_time + number_of_recurring_inflows * params.frequency_days;
    } else {
        if (inflowEnabled) {
            // GPU descriptor (T - in)
            addGPUDescriptor(envelopes, params.to_key, {
                type: "T",
                direction: "in",
                t_k: params.start_time,
                thetaParamKey: "a",
                theta,
                growth: theta_growth_dest
            });
        }

        number_of_recurring_inflows = 1;
        final_recurring_inflow = params.start_time;
        total_inflow = params.amount;
    }

    // place in total number of recurring inflows, final recurring inflow, and total inflow
    onUpdate([
        { eventId: event.id, paramType: "number_of_recurring_inflows", value: number_of_recurring_inflows },
        { eventId: event.id, paramType: "final_recurring_inflow", value: final_recurring_inflow },
        { eventId: event.id, paramType: "total_inflow", value: total_inflow }
    ]);
}

export const manual_correction = (event: any, envelopes: Record<string, any>) => {
    //Declare types
    const params = getTypedParams<AllEventTypes.manual_correctionParams>(event);
    const functions = getTypedEventFunctions<AllEventTypes.manual_correctionFunctionState>(event);

    //const params = event.parameters;
    // Get function states with type safety
    const manualCorrectionEnabled = functions.alter_account_balance ?? true;  // Default to true if not specified

    const to_key = params.to_key;
    const correctionTime = params.start_time;
    const targetAmountAtCorrection = params.amount;

    // Growth parameters for envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, to_key);
    if (manualCorrectionEnabled) {
        // Push a single-pass LazyCorrection GPU descriptor
        addGPUDescriptor(envelopes, to_key, {
            type: "LazyCorrection",
            direction: "in", // sign resolved at evaluation based on diff
            t_k: correctionTime,
            thetaParamKey: "a",
            theta: P({ a: 0 }), // not used
            growth: theta_growth_dest,
            target: targetAmountAtCorrection
        });
    }
};


// Declare initial balances for up to five envelopes at a specific time
export const declare_accounts = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const functions = getTypedEventFunctions<AllEventTypes.declare_accountsFunctionState>(event);

    // Get function states with type safety
    const declareAccountsEnabled = functions.alter_account_balance ?? true;  // Default to true if not specified

    for (let i = 1; i <= 5; i++) {
        const amountKey = `amount${i}`;
        const envelopeKey = `envelope${i}`;
        if (params[envelopeKey] && envelopes[params[envelopeKey]]) {
            const to_key = params[envelopeKey];
            // Push a LazyCorrection descriptor to drive the envelope to the declared amount at start_time
            const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, to_key);
            if (declareAccountsEnabled) {
                addGPUDescriptor(envelopes, to_key, {
                    type: "LazyCorrection",
                    direction: "in",
                    t_k: params.start_time,
                    thetaParamKey: "a",
                    theta: P({ a: 0 }),
                    growth: theta_growth_dest,
                    target: params[amountKey]
                });
            }
        }
    }
};

export const transfer_money = (event: any, envelopes: Record<string, any>, onUpdate: (updates: Array<{ eventId: number, paramType: string, value: number }>) => void) => {
    const params = getTypedParams<AllEventTypes.transfer_moneyParams>(event);
    const functions = getTypedEventFunctions<AllEventTypes.transfer_moneyFunctionState>(event);

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    let theta_inflow = P({ a: params.amount });
    let theta_outflow = P({ b: params.amount });

    // Get function states with type safety
    const inflowEnabled = functions.inflow ?? true;  // Default to true if not specified
    const outflowEnabled = functions.outflow ?? true;

    //console.log(`Transfer money event ${event.id}: Inflow enabled: ${inflowEnabled}, Outflow enabled: ${outflowEnabled}`);
    //console.log('Event functions:', event_functions);
    //console.log('Event object:', event);

    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};
        if (upd_type === "update_amount") {
            // Just use gamma to set the amount to new value at the start time
            theta_inflow = gamma(theta_inflow, {
                a: upd_params.amount
            }, upd_params.start_time);

            theta_outflow = gamma(theta_outflow, {
                b: upd_params.amount
            }, upd_params.start_time);
        }
        if (upd_type === "step_amount") {
            // For inflow
            // For inflow - apply step increases that will be evaluated when theta is called
            const current_amount_in = theta_inflow(upd_params.start_time).a;
            theta_inflow = gamma(theta_inflow, {
                a: stepAdjust(
                    current_amount_in,
                    upd_params.amount,
                    upd_params.frequency_days,
                    upd_params.start_time,
                    upd_params.end_time
                )
            }, upd_params.start_time);

            // For outflow - apply step increases that will be evaluated when theta is called
            const current_amount_out = theta_outflow(upd_params.start_time).b;
            theta_outflow = gamma(theta_outflow, {
                b: stepAdjust(
                    current_amount_out,
                    upd_params.amount,
                    upd_params.frequency_days,
                    upd_params.start_time,
                    upd_params.end_time
                )
            }, upd_params.start_time);
        }
    }

    let total_transfer = 0.0;
    let number_of_transfers = 0;
    let final_transfer = 0; //the day of final transfer

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create recurring outflow function for source envelope (only if enabled)
        if (outflowEnabled) {
            // GPU descriptor (R - out)
            addGPUDescriptor(envelopes, params.from_key, {
                type: "R",
                direction: "out",
                t0: params.start_time,
                dt: params.frequency_days,
                tf: params.end_time,
                thetaParamKey: "b",
                theta: theta_outflow,
                growth: theta_growth_source
            });
        }

        // Create recurring inflow function for destination envelope (only if enabled)
        if (inflowEnabled) {
            // GPU descriptor (R - in)
            addGPUDescriptor(envelopes, params.to_key, {
                type: "R",
                direction: "in",
                t0: params.start_time,
                dt: params.frequency_days,
                tf: params.end_time,
                thetaParamKey: "a",
                theta: theta_inflow,
                growth: theta_growth_dest
            });
        }

        number_of_transfers = Math.floor((params.end_time - params.start_time) / params.frequency_days) + 1;
        total_transfer = (number_of_transfers) * params.amount;
        final_transfer = params.start_time + number_of_transfers * params.frequency_days;
    } else {
        // Create one-time outflow function for source envelope (only if enabled)
        if (outflowEnabled) {
            // GPU descriptor (T - out)
            addGPUDescriptor(envelopes, params.from_key, {
                type: "T",
                direction: "out",
                t_k: params.start_time,
                thetaParamKey: "b",
                theta: theta_outflow,
                growth: theta_growth_source
            });
        }

        // Create one-time inflow function for destination envelope (only if enabled)
        if (inflowEnabled) {

            // GPU descriptor (T - in)
            addGPUDescriptor(envelopes, params.to_key, {
                type: "T",
                direction: "in",
                t_k: params.start_time,
                thetaParamKey: "a",
                theta: theta_inflow,
                growth: theta_growth_dest
            });
        }

        number_of_transfers = 1;
        total_transfer = params.amount;
        final_transfer = params.start_time;
    }

    onUpdate([
        { eventId: event.id, paramType: "number_of_transfers", value: number_of_transfers },
        { eventId: event.id, paramType: "final_transfer", value: final_transfer },
        { eventId: event.id, paramType: "total_transfer", value: total_transfer }
    ]);
};

export const income_with_changing_parameters = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const functions = getTypedEventFunctions<AllEventTypes.income_with_changing_parametersFunctionState>(event);

    // Get function states with type safety
    const inflowEnabled = functions.inflow ?? true;  // Default to true if not specified

    // Get growth parameters for destination envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, params.to_key);


    //handle updating events
    let theta = P({ a: params.amount });
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};
        if (upd_type === "update_amount") {
            theta = gamma(theta, { a: upd_params.amount }, upd_params.start_time);
        }
    }
    // GPU NOTE: income_with_changing_parameters (R - in)
    if (inflowEnabled) {
        addGPUDescriptor(envelopes, params.to_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: params.frequency_days,
            tf: params.end_time,
            thetaParamKey: "a",
            theta,
            growth: theta_growth_dest
        });
    }
};

export const reoccuring_spending_inflation_adjusted = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for destination envelope
    const [theta_growth_source,] = get_growth_parameters(envelopes, params.from_key);

    // GPU NOTE: reoccuring_spending_inflation_adjusted (R - out)
    addGPUDescriptor(envelopes, params.from_key, {
        type: "R",
        direction: "out",
        t0: params.start_time,
        dt: params.frequency_days,
        tf: params.end_time,
        thetaParamKey: "b",
        theta: P({ b: inflationAdjust(params.amount, envelopes.simulation_settings.inflation_rate, params.start_time) }),
        growth: theta_growth_source
    });
};

// export const loan_amortization = (event: any, envelopes: Record<string, any>) => {
//     const params = event.parameters;

//     // Get growth parameters for source and destination envelopes
//     const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
//         envelopes, params.from_key, params.to_key
//     );

//     // console.log("Loan interest rate: ", params.interest_rate);
//     // console.log("Loan term years: ", params.loan_term_years);
//     // console.log("Principal: ", params.principal);
//     // const monthly_payment = f_monthly_payment({ P: params.principal, r: params.interest_rate, y: params.loan_term_years }, params.start_time);
//     // console.log("Monthly payment: ", monthly_payment);

//     // Take out loan so add the amount recieved to cash and the debit to the debt
//     const recieved_loan = T(
//         { t_k: params.start_time },
//         f_in,
//         P({ a: params.principal }),
//         theta_growth_dest
//     );
//     envelopes[params.to_key].functions.push(recieved_loan);

//     // GPU NOTE: loan_amortization principal to debt (T - out) using f_principal_payment
//     addGPUDescriptor(envelopes, params.to_key, {
//         type: "T",
//         direction: "in",
//         t_k: params.start_time,
//         thetaParamKey: "a",
//         theta: P({ a: params.principal }),
//         growth: theta_growth_dest
//     });

//     const loan_debit = T(
//         { t_k: params.start_time },
//         f_out,
//         P({ b: params.principal }),
//         theta_growth_source
//     );
//     envelopes[params.from_key].functions.push(loan_debit);

//     // GPU NOTE: loan_amortization principal to debt (T - out) using f_principal_payment
//     addGPUDescriptor(envelopes, params.from_key, {
//         type: "T",
//         direction: "out",
//         t_k: params.start_time,
//         thetaParamKey: "b",
//         theta: P({ b: params.principal }),
//         growth: theta_growth_source
//     });

//     // Now pay off the loan in an amortization schedule, aply principle payments to the debt
//     const loan_amortization = R(
//         { t0: params.start_time + 365.25 / 12, dt: 365.25 / 12, tf: params.start_time + params.loan_term_years * 365.25 },
//         f_principal_payment,
//         P({ P: params.principal, r: params.interest_rate, y: params.loan_term_years }),
//         theta_growth_source
//     );
//     envelopes[params.from_key].functions.push(loan_amortization);
//     // GPU NOTE: loan monthly payment to debt (R - in) using f_monthly_payment
//     addGPUDescriptor(envelopes, params.from_key, {
//         type: "R",
//         direction: "in",
//         t0: params.start_time + 365.25 / 12,
//         dt: 365.25 / 12,
//         tf: params.start_time + params.loan_term_years * 365.25,
//         thetaParamKey: "a",
//         theta: P({ P: -params.principal, r: params.interest_rate, y: params.loan_term_years }),
//         growth: theta_growth_source,
//         computeValue: f_monthly_payment
//     });
//     // GPU NOTE: loan_amortization principal to debt (R - in) using f_principal_payment
//     addGPUDescriptor(envelopes, params.from_key, {
//         type: "R",
//         direction: "in",
//         t0: params.start_time + 365.25 / 12,
//         dt: 365.25 / 12,
//         tf: params.start_time + params.loan_term_years * 365.25,
//         thetaParamKey: "a",
//         theta: P({ P: params.principal, r: params.interest_rate, y: params.loan_term_years }),
//         growth: theta_growth_source,
//         computeValue: f_principal_payment
//     });

//     // Pay each monthly payment both the interest and the principle
//     const payments_func = R(
//         { t0: params.start_time + 365.25 / 12, dt: 365.25 / 12, tf: params.start_time + params.loan_term_years * 365.25 },
//         f_monthly_payment,
//         P({ P: params.principal, r: params.interest_rate, y: params.loan_term_years }),
//         theta_growth_dest
//     );

//     envelopes[params.to_key].functions.push(payments_func);
//     // GPU NOTE: loan monthly payment from cash (R - out) using f_monthly_payment
//     addGPUDescriptor(envelopes, params.to_key, {
//         type: "R",
//         direction: "in",
//         t0: params.start_time + 365.25 / 12,
//         dt: 365.25 / 12,
//         tf: params.start_time + params.loan_term_years * 365.25,
//         thetaParamKey: "a",
//         theta: P({ P: params.principal, r: params.interest_rate, y: params.loan_term_years }),
//         growth: theta_growth_dest,
//         computeValue: f_monthly_payment
//     });
//     // GPU NOTE: loan_amortization payment from cash (R - out) using f_monthly_payment
//     addGPUDescriptor(envelopes, params.to_key, {
//         type: "R",
//         direction: "in",
//         t0: params.start_time + 365.25 / 12,
//         dt: 365.25 / 12,
//         tf: params.start_time + params.loan_term_years * 365.25,
//         thetaParamKey: "a",
//         theta: P({ P: params.principal, r: params.interest_rate, y: params.loan_term_years }),
//         growth: theta_growth_dest,
//         computeValue: f_monthly_payment
//     });

//     // --- Loan Envelope Correction at End of Payment Cycle ---
//     const loan_end_time = params.start_time + params.loan_term_years * 365.25;
//     const loanEnvelope = envelopes[params.from_key];
//     let loan_balance = 0.0;
//     for (const func of loanEnvelope.functions) {
//         loan_balance += func(loan_end_time);
//     }
//     if (Math.abs(loan_balance) > 1e-6) {
//         const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
//             envelopes, params.from_key, params.to_key
//         );
//         const correction_inflow = T(
//             { t_k: loan_end_time },
//             f_in,
//             P({ a: Math.abs(loan_balance) }),
//             theta_growth_dest
//         );
//         loanEnvelope.functions.push(correction_inflow);
//         const correction_outflow = T(
//             { t_k: loan_end_time },
//             f_out,
//             P({ b: Math.abs(loan_balance) }),
//             theta_growth_source
//         );
//         envelopes[params.to_key].functions.push(correction_outflow);
//     }
// };

export const loan = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    const functions = getTypedEventFunctions<AllEventTypes.loanFunctionState>(event);

    // Get function states with type safety
    const depositDebtEnabled = functions.deposit_debt ?? true;  // Default to true if not specified
    const payOffLoanEnabled = functions.pay_off_loan ?? true;  // Default to true if not specified
    const debtPaymentsEnabled = functions.debt_payments ?? true;  // Default to true if not specified
    const finalPaymentCorrectionEnabled = functions.final_payment_correction ?? true;  // Default to true if not specified


    // Get growth parameters for source and destination envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    const loan_interest_rate = theta_growth_source.r;
    // console.log("Loan interest rate: ", loan_interest_rate);
    const end_time = params.start_time + params.loan_term_years * 365.25;
    // console.log("Start time: ", params.start_time);
    // console.log("End time: ", end_time);
    // console.log("Loan term years: ", params.loan_term_years);
    // console.log("Principal: ", params.principal);
    // const monthly_payment = f_monthly_payment({ P: params.principal, r: loan_interest_rate, y: params.loan_term_years }, params.start_time);
    // console.log("Monthly payment: ", monthly_payment);

    // Take out loan so add the amount recieved to cash and the debit to the debt
    // GPU NOTE: loan (T - in)
    if (depositDebtEnabled) {
        addGPUDescriptor(envelopes, params.to_key, {
            type: "T",
            direction: "in",
            t_k: params.start_time,
            thetaParamKey: "a",
            theta: P({ a: params.principal }),
            growth: theta_growth_dest
        });
    }
    // GPU NOTE: loan_debit (T - out)
    if (payOffLoanEnabled) {
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "out",
            t_k: params.start_time,
            thetaParamKey: "b",
            theta: P({ b: params.principal }),
            growth: theta_growth_source
        });
    }
    // Now pay off the loan in a reoccuring schedule of monthly payments
    // GPU NOTE: loan_amortization (R - in)
    if (payOffLoanEnabled) {
        addGPUDescriptor(envelopes, params.from_key, {
            type: "R",
            direction: "in",
            t0: params.start_time + 365.25 / 12,
            dt: 365.25 / 12,
            tf: params.start_time + params.loan_term_years * 365.25,
            thetaParamKey: "a",
            theta: P({ P: -params.principal, r: loan_interest_rate, y: params.loan_term_years }),
            growth: theta_growth_source,
            computeValue: f_monthly_payment
        });
    }
    // Pay each monthly payment both the interest and the principle
    // GPU NOTE: loan monthly payment from cash (R - out) using f_monthly_payment
    if (debtPaymentsEnabled) {
        addGPUDescriptor(envelopes, params.to_key, {
            type: "R",
            direction: "in",
            t0: params.start_time + 365.25 / 12,
            dt: 365.25 / 12,
            tf: params.start_time + params.loan_term_years * 365.25,
            thetaParamKey: "a",
            theta: P({ P: params.principal, r: loan_interest_rate, y: params.loan_term_years }),
            growth: theta_growth_dest,
            computeValue: f_monthly_payment
        });
    }


    // --- Loan Envelope Correction at End of Payment Cycle ---
    const loan_end_time = params.start_time + params.loan_term_years * 365.25;
    const loanEnvelope = envelopes[params.from_key];

    // Evaluate the entire loan envelope at the end time
    const loan_balance = evaluateEnvelopeAtTime(loanEnvelope, loan_end_time);
    console.log("Loan balance: ", loan_balance);
    if (Math.abs(loan_balance) && finalPaymentCorrectionEnabled) {
        const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
            envelopes, params.from_key, params.to_key
        );

        // GPU NOTE: loan_correction (T - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "out",
            t_k: loan_end_time,
            thetaParamKey: "b",
            theta: P({ b: loan_balance }),
            growth: theta_growth_source
        });
        // GPU NOTE: loan_correction (T - in)
        addGPUDescriptor(envelopes, params.to_key, {
            type: "T",
            direction: "in",
            t_k: loan_end_time,
            thetaParamKey: "a",
            theta: P({ a: loan_balance }),
            growth: theta_growth_dest
        });
    }
};


export const purchase = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const functions = getTypedEventFunctions<AllEventTypes.purchaseFunctionState>(event);

    // Get function states with type safety
    const outflowEnabled = functions.outflow ?? true;  // Default to true if not specified

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create a recurring outflow function for the purchase
        // GPU NOTE: purchase (R - out)
        if (outflowEnabled) {
            addGPUDescriptor(envelopes, params.from_key, {
                type: "R",
                direction: "out",
                t0: params.start_time,
                dt: params.frequency_days,
                tf: params.end_time,
                thetaParamKey: "b",
                theta: P({ b: params.money }),
                growth: theta_growth_source
            });
        }
    } else {
        // Create a one-time outflow function for the purchase
        // GPU NOTE: purchase (T - out)
        if (outflowEnabled) {
            addGPUDescriptor(envelopes, params.from_key, {
                type: "T",
                direction: "out",
                t_k: params.start_time,
                thetaParamKey: "b",
                theta: P({ b: params.money }),
                growth: theta_growth_source
            });
        }
    }
};


export const gift = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    const functions = getTypedEventFunctions<AllEventTypes.giftFunctionState>(event);

    // Get function states with type safety
    const inflowEnabled = functions.inflow ?? true;  // Default to true if not specified

    // Get growth parameters from destination envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, params.to_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create a recurring gift function
        // GPU NOTE: gift (R - out)
        if (inflowEnabled) {
            addGPUDescriptor(envelopes, params.from_key, {
                type: "R",
                direction: "out",
                t0: params.start_time,
                dt: params.frequency_days,
                tf: params.end_time,
                thetaParamKey: "b",
                theta: P({ b: params.money }),
                growth: theta_growth_dest
            });
        }
    } else {
        // Create a one-time gift function
        // GPU NOTE: gift (T - in)
        if (inflowEnabled) {
            addGPUDescriptor(envelopes, params.to_key, {
                type: "T",
                direction: "in",
                t_k: params.start_time,
                thetaParamKey: "a",
                theta: P({ a: params.money }),
                growth: theta_growth_dest
            });
        }
    }
};


export const monthly_budgeting = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const from_key = params.from_key;
    const start_time = params.start_time;
    const end_time = params.end_time;
    const inflation_rate = envelopes.simulation_settings.inflation_rate; // Default 2% if not provided

    const functions = getTypedEventFunctions<AllEventTypes.monthly_budgetingFunctionState>(event);
    const outflowDiningOutEnabled = functions.outflow_dining_out ?? true;  // Default to true if not specified
    const outflowGroceriesEnabled = functions.outflow_groceries ?? true;  // Default to true if not specified
    const outflowHousingEnabled = functions.outflow_housing ?? true;  // Default to true if not specified
    const outflowTransportationEnabled = functions.outflow_transportation ?? true;  // Default to true if not specified
    const outflowUtilitiesEnabled = functions.outflow_utilities ?? true;  // Default to true if not specified
    const outflowEntertainmentEnabled = functions.outflow_entertainment ?? true;  // Default to true if not specified
    const outflowOtherEnabled = functions.outflow_other ?? true;  // Default to true if not specified
    const useInflation = functions.update_budget_with_inflation ?? true;  // Default to true if not specified

    // Map of budget keys to their enable/disable flags
    const keyToEnabled: Record<string, boolean> = {
        dining_out: outflowDiningOutEnabled,
        groceries: outflowGroceriesEnabled,
        housing: outflowHousingEnabled,
        transportation: outflowTransportationEnabled,
        utilities: outflowUtilitiesEnabled,
        entertainment: outflowEntertainmentEnabled,
        other: outflowOtherEnabled
    };

    // List of parameter keys to skip (not budget categories)
    const skip_keys = new Set(["start_time", "end_time", "from_key", "inflation_rate", "frequency_days"]);

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, from_key);

    // For each budget category, create a recurring outflow if enabled
    Object.keys(params).forEach(key => {
        if (!skip_keys.has(key) && typeof params[key] === "number") {
            // Check if this key is enabled (if present in keyToEnabled), otherwise default to true
            const enabled = keyToEnabled.hasOwnProperty(key) ? keyToEnabled[key] : true;
            if (!enabled) return;

            // Base
            // 1. theta: inflation-adjusted from the event's start time
            let theta;
            if (useInflation) {
                theta = P({
                    b: inflationAdjust(params[key], inflation_rate, start_time)
                });
            } else {
                theta = P({
                    b: params[key]
                });
            }

            // Support updating events to change specific category amounts over time
            for (const upd of event.updating_events || []) {
                const upd_type = upd.type;
                const upd_params = upd.parameters || {};
                // Only apply updates targeted to this category key
                if (upd_params.key === key && (upd_type === "update_monthly_budget")) {
                    // From the update start time, switch b to a new inflation-adjusted base amount
                    let theta_update: Record<string, number | ((t: number) => number)>;
                    if (useInflation) {
                        theta_update = {
                            b: inflationAdjust(upd_params.amount, inflation_rate, upd_params.start_time)
                        };
                    } else {
                        theta_update = {
                            b: upd_params.amount
                        };
                    }
                    theta = gamma(theta, theta_update, upd_params.start_time);
                }
            }
            // GPU descriptor for each budget category (R - out)
            addGPUDescriptor(envelopes, from_key, {
                type: "R",
                direction: "out",
                t0: start_time,
                dt: params.frequency_days,
                tf: end_time,
                thetaParamKey: "b",
                theta,
                growth: theta_growth_source
            });
        }
    });
};

// Add missing exports for event functions
export const get_job = (event: any, envelopes: Record<string, any>) => {

    const functions = getTypedEventFunctions<AllEventTypes.get_jobFunctionState>(event);
    const inflowEnabled = functions.inflow ?? true;
    const p_401k_contributionEnabled = functions.p_401k_contribution ?? true;
    const tax_withholdingsEnabled = functions.tax_withholdings ?? true;
    const salary_in_taxable_incomeEnabled = functions.salary_in_taxable_income ?? true;

    const params = getTypedParams<AllEventTypes.get_jobParams>(event);

    // using typing on parameters

    // Get growth parameters for both envelopes
    // Get growth parameters, only include taxable_income_key if it exists
    const growthParams = [params.to_key];
    if (params.taxable_income_key) {
        growthParams.push(params.taxable_income_key);
    }
    const [theta_growth_dest, theta_growth_taxable_income] = get_growth_parameters(envelopes, ...growthParams);

    // Base job parameters dictionary for P(...)
    const theta_base = {
        S: params.salary,
        p: params.pay_period,
        r_Fed: params.federal_income_tax,
        r_SS: params.social_security_tax,
        r_Med: params.medicare_tax,
        r_401k: params.p_401k_contribution,
        r_state: params.state_income_tax,
    };

    // Compose the base theta(t)
    let theta = P(theta_base);

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "get_a_raise") {
            theta = gamma(theta, { S: upd_params.salary }, upd_params.start_time);
        } else if (upd_type === "change_401k_contribution") {
            theta = gamma(theta, { r_401k: upd_params.p_401k_contribution }, upd_params.start_time);
        } else if (upd_type === "get_a_bonus") {
            // GPU NOTE: get_job bonus (T - in)
            addGPUDescriptor(envelopes, params.to_key, {
                type: "T",
                direction: "in",
                t_k: upd_params.start_time,
                thetaParamKey: "a",
                theta: P({ a: upd_params.bonus }),
                growth: theta_growth_dest
            });
        } else if (upd_type === "reoccurring_raise") {
            //types for updating params
            const upd_params = getTypedUpdatingParams<AllEventTypes.reoccurring_raiseParams>(upd);

            // Create a step adjustment function that increases salary by salary_increase at each frequency_days interval
            const salaryStepFunction = stepAdjust(
                params.salary, // current base salary
                upd_params.salary_increase, // amount to increase by each step
                upd_params.frequency_days, // how often to increase
                upd_params.start_time, // when to start increasing
                upd_params.end_time // when to stop increasing
            );

            // Apply the stepped salary adjustment to theta
            theta = gamma(theta, { S: salaryStepFunction }, upd_params.start_time);
        }
    }

    // Add salary payments to cash envelope
    // GPU NOTE: get_job salary -> cash (R - in) using f_salary via computeValue
    if (inflowEnabled) {
        addGPUDescriptor(envelopes, params.to_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: 365.25 / params.pay_period,
            tf: params.end_time,
            thetaParamKey: "a",
            theta,
            growth: theta_growth_dest,
            computeValue: f_salary
        });
    }
    // Add salary income to taxable income envelope
    // GPU NOTE: get_job taxable income (R - in) S/p via computeValue
    if (salary_in_taxable_incomeEnabled) {
        addGPUDescriptor(envelopes, params.taxable_income_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: 365.25 / params.pay_period,
            tf: params.end_time,
            thetaParamKey: "a",
            theta,
            growth: theta_growth_taxable_income,
            computeValue: (p: any) => (p.S / p.p)
        });
    }

    // Get growth parameters from 401k envelope
    const [_, theta_growth_401k] = get_growth_parameters(envelopes, undefined, params.p_401k_key);
    if (p_401k_contributionEnabled) {
        // GPU NOTE: get_job 401k contribution (R - in) via computeValue
        addGPUDescriptor(envelopes, params.p_401k_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: 365.25 / params.pay_period,
            tf: params.end_time,
            thetaParamKey: "a",
            theta,
            growth: theta_growth_401k,
            computeValue: (p: any) => (p.S / p.p) * (p.r_401k + (params.p_401k_match || 0))
        });
    }


    // Add withholdings to their respective envelopes
    const withholdingConfigs = [
        {
            key: params.federal_withholdings_key,
            rate: params.federal_income_tax,
        },
        {
            key: params.state_withholdings_key,
            rate: params.state_income_tax,
        },
        {
            key: params.local_withholdings_key,
            rate: params.local_income_tax || 0,
        }
    ];
    for (const config of withholdingConfigs) {
        if (config.key && envelopes[config.key]) {
            const [_, theta_growth_withholding] = get_growth_parameters(envelopes, undefined, config.key);
            // GPU NOTE: get_job withholdings (R - in) via computeValue
            if (tax_withholdingsEnabled) {
                addGPUDescriptor(envelopes, config.key, {
                    type: "R",
                    direction: "in",
                    t0: params.start_time,
                    dt: 365.25 / params.pay_period,
                    tf: params.end_time,
                    thetaParamKey: "a",
                    theta,
                    growth: theta_growth_withholding,
                    computeValue: (p: any) => (p.S / p.p) * config.rate
                });
            }
        }
    }
};

export const get_wage_job = (event: any, envelopes: Record<string, any>) => {
    const params = getTypedParams<AllEventTypes.get_wage_jobParams>(event);

    const functions = getTypedEventFunctions<AllEventTypes.get_wage_jobFunctionState>(event);
    const inflowEnabled = functions.inflow ?? true; //getting paid
    const p_401k_contributionEnabled = functions.p_401k_contribution ?? true;
    const tax_withholdingsEnabled = functions.tax_withholdings ?? true;
    const salary_in_taxable_incomeEnabled = functions.salary_in_taxable_income ?? true;

    // Get growth parameters, only include taxable_income_key if it exists
    const growthParams = [params.to_key];
    if (params.taxable_income_key) {
        growthParams.push(params.taxable_income_key);
    }
    const [theta_growth_dest, theta_growth_taxable_income] = get_growth_parameters(envelopes, ...growthParams);

    // Base wage parameters dictionary for P(...)
    const theta_base = {
        w: params.hourly_wage,
        h: params.hours_per_week,
        p: params.pay_period,
        r_Fed: params.federal_income_tax,
        r_SS: params.social_security_tax,
        r_Med: params.medicare_tax,
        r_401k: params.p_401k_contribution,
        r_match: params.employer_match,
    };

    // Compose the base theta(t)
    let theta = P(theta_base);

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "get_a_raise") {
            theta = gamma(theta, { w: upd_params.new_hourly_wage }, upd_params.start_time);
        } else if (upd_type === "change_hours") {
            theta = gamma(theta, { h: upd_params.new_hours }, upd_params.start_time);
        } else if (upd_type === "change_401k_contribution") {
            theta = gamma(theta, { r_401k: upd_params.p_401k_contribution }, upd_params.start_time);
        } else if (upd_type === "change_employer_match") {
            theta = gamma(theta, { r_match: upd_params.new_match_rate }, upd_params.start_time);
        }
    }

    // Add wage payments to cash envelope
    // GPU NOTE: get_wage_job wage -> cash (R - in) using f_wage via computeValue
    if (inflowEnabled) {
        addGPUDescriptor(envelopes, params.to_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: 365.25 / params.pay_period,
            tf: params.end_time,
            thetaParamKey: "a",
            theta,
            growth: theta_growth_dest,
            computeValue: f_wage
        });
    }

    // Add wage income to taxable income envelope
    // GPU NOTE: get_wage_job taxable income (R - in) via computeValue
    if (salary_in_taxable_incomeEnabled && params.taxable_income_key) {
        addGPUDescriptor(envelopes, params.taxable_income_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: 365.25 / params.pay_period,
            tf: params.end_time,
            thetaParamKey: "a",
            theta,
            growth: theta_growth_taxable_income,
            computeValue: (p: any) => (p.w * p.h * 52) / p.p
        });
    }

    // Get growth parameters from 401k envelope
    const [_, theta_growth_401k] = get_growth_parameters(envelopes, undefined, params.p_401k_key);

    // Add 401(k) contributions
    // GPU NOTE: get_wage_job 401k contribution (R - in) via computeValue
    if (p_401k_contributionEnabled) {
        addGPUDescriptor(envelopes, params.p_401k_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: 365.25 / params.pay_period,
            tf: params.end_time,
            thetaParamKey: "a",
            theta,
            growth: theta_growth_401k,
            computeValue: (p: any) => ((p.w * p.h * 52) / p.p) * (p.r_401k + (p.r_match || 0))
        });
    }

    // Add withholdings to their respective envelopes
    const withholdingConfigs = [
        {
            key: params.federal_withholdings_key,
            rate: params.federal_income_tax,
        },
        {
            key: params.state_withholdings_key,
            rate: params.state_income_tax,
        },
        {
            key: params.local_withholdings_key,
            rate: params.local_income_tax || 0,
        }
    ];
    for (const config of withholdingConfigs) {
        if (config.key && envelopes[config.key]) {
            const [_, theta_growth_withholding] = get_growth_parameters(envelopes, undefined, config.key);
            // GPU NOTE: get_job withholdings (R - in) via computeValue
            if (tax_withholdingsEnabled) {
                addGPUDescriptor(envelopes, config.key, {
                    type: "R",
                    direction: "in",
                    t0: params.start_time,
                    dt: 365.25 / params.pay_period,
                    tf: params.end_time,
                    thetaParamKey: "a",
                    theta,
                    growth: theta_growth_withholding,
                    computeValue: (p: any) => (p.S / p.p) * config.rate
                });
            }
        }
    }
};


export const buy_house = (event: any, envelopes: Record<string, any>, updatePlan?: (updates: Array<{ eventId: number, paramType: string, value: number }>) => void) => {
    const params = event.parameters;

    const functions = getTypedEventFunctions<AllEventTypes.buy_houseFunctionState>(event);
    const downpaymentEnabled = functions.downpayment ?? true;  // Default to true if not specified
    const homeAssetEnabled = functions.home_asset ?? true;  // Default to true if not specified
    const mortgageEnabled = functions.morgage_loan ?? true;  // Default to true if not specified
    const propertyTaxEnabled = functions.property_tax ?? true;  // Default to true if not specified
    const mortgageCorrectionEnabled = functions.final_home_payment_correction ?? true;  // Default to true if not specified
    const mortgagePaymentEnabled = functions.mortgage_payment ?? true;  // Default to true if not specified


    // Get growth parameters for from_key, to_key, and mortgage_envelope
    const [theta_growth_source, theta_growth_dest, theta_growth_mortgage] = get_growth_parameters(
        envelopes, params.from_key, params.to_key, params.mortgage_envelope
    );

    if (downpaymentEnabled) {
        // // Handle downpayment (outflow)
        // GPU NOTE: buy_house downpayment (T - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "out",
            t_k: params.start_time,
            thetaParamKey: "b",
            theta: P({ b: params.downpayment }),
            growth: theta_growth_source
        });
    }

    //console.log("to_key: ", params.to_key);
    // Create house value tracking function with appreciation
    // Add house value to target envelope
    // GPU NOTE: buy_house house value (T - in)
    if (homeAssetEnabled) {
        addGPUDescriptor(envelopes, params.to_key, {
            type: "T",
            direction: "in",
            t_k: params.start_time,
            thetaParamKey: "a",
            theta: P({ a: params.home_value }),
            growth: theta_growth_dest
        });
    }


    // Take on loan amount on the mortgage envelope
    const loan_amount = params.home_value - params.downpayment;
    const loan_interest_rate = theta_growth_mortgage.r;
    // GPU NOTE: buy_house loan debit (T - out)
    if (mortgageEnabled) {
        addGPUDescriptor(envelopes, params.mortgage_envelope, {
            type: "T",
            direction: "out",
            t_k: params.start_time,
            thetaParamKey: "b",
            theta: P({ b: loan_amount }),
            growth: theta_growth_mortgage
        });
    }

    // Create mortgage payments to the mortgage envelope tracking the principle payments
    // Add mortgage payments to mortgage envelope
    // GPU NOTE: buy_house mortgage principal to mortgage envelope (R - in) using f_monthly_payment
    if (mortgageEnabled) {
        addGPUDescriptor(envelopes, params.mortgage_envelope, {
            type: "R",
            direction: "in",
            t0: params.start_time + 365.25 / 12,
            dt: 365.25 / 12,
            tf: params.start_time + params.loan_term_years * 365.25,
            thetaParamKey: "a",
            theta: P({ P: -loan_amount, r: loan_interest_rate, y: params.loan_term_years }),
            growth: theta_growth_mortgage,
            computeValue: f_monthly_payment
        });
    }
    // Pay the morgage from the source envelope
    // Add mortgage payments to source envelope
    // GPU NOTE: buy_house mortgage payment from source (R - out) using f_monthly_payment
    if (mortgagePaymentEnabled) {
        addGPUDescriptor(envelopes, params.from_key, {
            type: "R",
            direction: "in",
            t0: params.start_time + 365.25 / 12,
            dt: 365.25 / 12,
            tf: params.start_time + params.loan_term_years * 365.25,
            thetaParamKey: "b",
            theta: P({ P: loan_amount, r: loan_interest_rate, y: params.loan_term_years }),
            growth: theta_growth_source,
            computeValue: f_monthly_payment
        });
    }

    // Calculate and update loan end date if callback is provided
    if (updatePlan) {
        const loanTermYears = params.loan_term_years || 30;
        const startDate = params.start_time || 0;
        const endDate = startDate + (loanTermYears * 365.25);

        updatePlan([{
            eventId: event.id,
            paramType: 'end_time',
            value: endDate
        }]);
    }

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};
        if (upd_type === "new_appraisal") {
        } else if (upd_type === "extra_mortgage_payment") {
        } else if (upd_type === "late_payment") {
        } else if (upd_type === "sell_house") {
        }
    }

    // --- Property Tax Logic (added for property tax payments) ---
    // Only run if params.property_tax_rate and params.from_key are defined
    //Calcualte the house value at beginning of each year then calculate the property tax owed that year and the pay that in 6 month intervals.
    if (propertyTaxEnabled && params.property_tax_rate && params.from_key) {
        const simulation_settings = envelopes.simulation_settings;
        const startTime = simulation_settings.start_time;
        const endTime = simulation_settings.end_time;
        const interval = simulation_settings.interval;
        const birthDate = simulation_settings.birthDate;

        // Get year-end days based on birth date, this returns which days are Dec 31st of each year
        const yearEndDays = birthDate ? getYearEndDays(birthDate, startTime, endTime) : [];

        const houseEnvelope = envelopes[params.to_key];
        const [theta_growth_cash] = get_growth_parameters(envelopes, params.from_key);

        yearEndDays.forEach(yearStartDay => {
            // Evaluate house value at the start of the year
            const houseValue = evaluateEnvelopeAtTime(houseEnvelope, yearStartDay);
            // Calculate annual property tax
            const annualPropertyTax = houseValue * params.property_tax_rate;

            if (annualPropertyTax > 0) {
                // Create a recurring monthly outflow for property tax/12
                // GPU NOTE: property tax (R - out)
                addGPUDescriptor(envelopes, params.from_key, {
                    type: "R",
                    direction: "out",
                    t0: yearStartDay,
                    dt: 365.25 / 12,
                    tf: yearStartDay + 330,
                    thetaParamKey: "b",
                    theta: P({ b: annualPropertyTax / 12 }),
                    growth: theta_growth_cash
                });
            }
        });
    }

    // --- Mortgage Envelope Correction at End of Payment Cycle ---
    // Evaluate the mortgage envelope at the end of the payment cycle and correct any remaining balance
    const mortgage_end_time = params.start_time + params.loan_term_years * 365.25;
    const mortgageEnvelope = envelopes[params.mortgage_envelope];
    const mortgage_balance = evaluateEnvelopeAtTime(mortgageEnvelope, mortgage_end_time);
    if (Math.abs(mortgage_balance) > 1e-6 && mortgageCorrectionEnabled) { // Only correct if not already zero (allowing for floating point error)
        // Get growth parameters for both envelopes
        const [theta_growth_source, theta_growth_mortgage] = get_growth_parameters(
            envelopes, params.from_key, params.mortgage_envelope
        );
        // Create correction inflow to mortgage envelope
        // GPU NOTE: mortgage correction inflow (T - in)
        addGPUDescriptor(envelopes, params.mortgage_envelope, {
            type: "T",
            direction: "in",
            t_k: mortgage_end_time,
            thetaParamKey: "a",
            theta: P({ a: Math.abs(mortgage_balance) }),
            growth: theta_growth_mortgage
        });
        // Create correction outflow from source envelope
        // GPU NOTE: mortgage correction outflow (T - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "out",
            t_k: mortgage_end_time,
            thetaParamKey: "b",
            theta: P({ b: Math.abs(mortgage_balance) }),
            growth: theta_growth_source
        });
    }
};

export const buy_car = (event: any, envelopes: Record<string, any>, updatePlan?: (updates: Array<{ eventId: number, paramType: string, value: number }>) => void) => {
    const params = event.parameters;

    const functions = getTypedEventFunctions<AllEventTypes.buy_carFunctionState>(event);
    const downpaymentEnabled = functions.downpayment ?? true;  // Default to true if not specified
    const carAssetEnabled = functions.car_asset ?? true;  // Default to true if not specified
    const carLoanEnabled = functions.car_loan ?? true;  // Default to true if not specified
    const carLoanPaymentEnabled = functions.car_loan_payment ?? true;  // Default to true if not specified
    const carLoanCorrectionEnabled = functions.final_car_payment_correction ?? true;  // Default to true if not specified

    // Get growth parameters for source envelope
    const [theta_growth_source, theta_growth_dest, theta_growth_debt] = get_growth_parameters(envelopes, params.from_key, params.to_key, params.car_loan_envelope);

    // Handle downpayment (outflow)
    // Add downpayment to source envelope
    // GPU NOTE: buy_car downpayment (T - out)
    if (downpaymentEnabled) {
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "out",
            t_k: params.start_time,
            thetaParamKey: "b",
            theta: P({ b: params.downpayment }),
            growth: theta_growth_source
        });
    }
    // Create car value tracking function with depreciation
    // Add car value to target envelope
    // GPU NOTE: buy_car asset value (T - in)
    if (carAssetEnabled) {
        addGPUDescriptor(envelopes, params.to_key, {
            type: "T",
            direction: "in",
            t_k: params.start_time,
            thetaParamKey: "a",
            theta: P({ a: params.car_value }),
            growth: theta_growth_dest
        });
    }
    // Take the loan of the car in as debt
    // GPU NOTE: buy_car loan debit (T - out)
    if (carLoanEnabled) {
        addGPUDescriptor(envelopes, params.car_loan_envelope, {
            type: "T",
            direction: "out",
            t_k: params.start_time,
            thetaParamKey: "b",
            theta: P({ b: params.car_value - params.downpayment }),
            growth: theta_growth_debt
        });
    }
    const loan_interest_rate = theta_growth_source.r;

    // Create car loan payments
    const loan_amount = params.car_value - params.downpayment;
    // Add loan payments to source envelope
    // GPU NOTE: buy_car loan payment from source (R - out) using f_monthly_payment
    if (carLoanPaymentEnabled) {
        addGPUDescriptor(envelopes, params.from_key, {
            type: "R",
            direction: "in",
            t0: params.start_time + 365.25 / 12,
            dt: 365.25 / 12,
            tf: params.start_time + params.loan_term_years * 365.25,
            thetaParamKey: "b",
            theta: P({ P: -loan_amount, r: loan_interest_rate, y: params.loan_term_years }),
            growth: theta_growth_source,
            computeValue: f_monthly_payment
        });
    }
    // Create car loan payments to the mortgage envelope tracking the principle payments
    // Add mortgage payments to mortgage envelope
    // GPU NOTE: buy_car principal to loan envelope (R - in) using f_monthly_payment
    if (carLoanEnabled) {
        addGPUDescriptor(envelopes, params.car_loan_envelope, {
            type: "R",
            direction: "in",
            t0: params.start_time + 365.25 / 12,
            dt: 365.25 / 12,
            tf: params.start_time + params.loan_term_years * 365.25,
            thetaParamKey: "a",
            theta: P({ P: loan_amount, r: loan_interest_rate, y: params.loan_term_years }),
            growth: theta_growth_debt,
            computeValue: f_monthly_payment
        });
    }

    if (updatePlan) {
        const loanTermYears = params.loan_term_years || 30;
        const startDate = params.start_time || 0;
        const endDate = startDate + (loanTermYears * 365.25);

        updatePlan([{
            eventId: event.id,
            paramType: 'end_time',
            value: endDate
        }]);
    }

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "pay_loan_early") {
        } else if (upd_type === "car_repair") {
        }
    }

    // --- Car Loan Envelope Correction at End of Payment Cycle ---
    const car_loan_end_time = params.start_time + params.loan_term_years * 365.25;
    const carLoanEnvelope = envelopes[params.car_loan_envelope];
    const car_loan_balance = evaluateEnvelopeAtTime(carLoanEnvelope, car_loan_end_time);
    if (Math.abs(car_loan_balance) > 1e-6 && carLoanCorrectionEnabled) {
        const [theta_growth_source, theta_growth_debt] = get_growth_parameters(
            envelopes, params.from_key, params.car_loan_envelope
        );
        // GPU NOTE: car loan correction inflow (T - in)
        addGPUDescriptor(envelopes, params.car_loan_envelope, {
            type: "T",
            direction: "in",
            t_k: car_loan_end_time,
            thetaParamKey: "a",
            theta: P({ a: Math.abs(car_loan_balance) }),
            growth: theta_growth_debt
        });
        // GPU NOTE: car loan correction outflow (T - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "out",
            t_k: car_loan_end_time,
            thetaParamKey: "b",
            theta: P({ b: Math.abs(car_loan_balance) }),
            growth: theta_growth_source
        });
    }
};


export const pass_away = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const death_time = params.start_time;

    const functions = getTypedEventFunctions<AllEventTypes.pass_awayFunctionState>(event);
    const declare_accountsEnabled = functions.declare_accounts ?? true; //outflow of money

    // For each envelope, calculate the value at death_time and add a correction to bring it to zero
    for (const [envelope_name, envelope_data] of Object.entries(envelopes)) {
        if ("functions" in envelope_data) {
            const simulated_value = evaluateEnvelopeAtTime(envelope_data, death_time);
            const difference = 0 - simulated_value;
            // Get growth parameters from envelope
            const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, envelope_name);
            // Create the correction function and append it to the envelope
            // GPU NOTE: pass_away correction (T - in/out)
            if (declare_accountsEnabled) {
            addGPUDescriptor(envelopes, envelope_name, {
                type: "T",
                direction: difference > 0 ? "in" : "out",
                t_k: death_time + 1,
                thetaParamKey: difference > 0 ? "a" : "b",
                theta: P(difference > 0 ? { a: Math.abs(difference) } : { b: Math.abs(difference) }),
                growth: theta_growth_dest
            });
            }
        }
    }
};

// Unimported functions below

export const start_business = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );
    // Initial investment (outflow)
    // GPU NOTE: start_business initial investment (T - out)
    addGPUDescriptor(envelopes, params.from_key, {
        type: "T",
        direction: "out",
        t_k: params.start_time,
        thetaParamKey: "b",
        theta: P({ b: params.initial_investment }),
        growth: theta_growth_source
    });

    // Handle updating events (business income and losses)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "business_income") {
            // Get growth parameters from destination envelope
            const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, upd_params.to_key);

            // Create recurring income function
            // Add to target envelope
            // GPU NOTE: business income (R - in)
            addGPUDescriptor(envelopes, upd_params.to_key, {
                type: "R",
                direction: "in",
                t0: upd_params.start_time,
                dt: 365.25 / 12,
                tf: upd_params.end_time,
                thetaParamKey: "a",
                theta: P({ a: params.monthly_income }),
                growth: theta_growth_dest
            });

        } else if (upd_type === "business_loss") {
            // Get growth parameters from source envelope
            const [theta_growth_source, _] = get_growth_parameters(envelopes, upd_params.from_key);

            // Create one-time loss function
            // Add to source envelope
            // GPU NOTE: business loss (T - out)
            addGPUDescriptor(envelopes, upd_params.from_key, {
                type: "T",
                direction: "out",
                t_k: upd_params.start_time,
                thetaParamKey: "b",
                theta: P({ b: upd_params.loss_amount }),
                growth: theta_growth_source
            });
        }
    }
};


export const buy_home_insurance = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Create monthly premium payment function
    // Add premium payments to source envelope
    // GPU NOTE: home insurance premiums (R - out) with long tf handled by clamp
    addGPUDescriptor(envelopes, params.from_key, {
        type: "R",
        direction: "out",
        t0: params.start_time,
        dt: 365.25 / 12,
        tf: Infinity,
        thetaParamKey: "b",
        theta: P({ b: params.monthly_premium }),
        growth: theta_growth_source
    });

    // Handle updating events (damage events)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "tornado_damage" || upd_type === "house_fire" || upd_type === "flood_damage") {
            // Calculate insurance payout
            const damage_cost = upd_params.damage_cost;
            const coverage = upd_params.insurance_coverage ?? params.coverage_percentage;
            const payout = damage_cost * coverage;

            // Get growth parameters for both envelopes
            const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
                envelopes, params.from_key, upd_params.to_key ?? params.from_key
            );

            // Handle insurance payout (inflow)
            if (payout > 0) {
                addGPUDescriptor(envelopes, upd_params.to_key ?? params.from_key, {
                    type: "T",
                    direction: "in",
                    t_k: upd_params.start_time,
                    thetaParamKey: "a",
                    theta: P({ a: payout }),
                    growth: theta_growth_dest
                });
            }
        }
    }
};

export const have_kid = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create a recurring initial costs function
        // GPU NOTE: have_kid recurring initial costs (R - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "R",
            direction: "out",
            t0: params.start_time,
            dt: params.frequency_days,
            tf: params.end_time,
            thetaParamKey: "b",
            theta: P({ b: params.initial_costs }),
            growth: theta_growth_source
        });
    } else {
        // Handle initial costs (one-time outflow)
        // GPU NOTE: have_kid initial costs (T - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "out",
            t_k: params.start_time,
            thetaParamKey: "b",
            theta: P({ b: params.initial_costs }),
            growth: theta_growth_source
        });
    }

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "childcare_costs") {
            // Get growth parameters from source envelope
            const [theta_growth_source, _] = get_growth_parameters(envelopes, upd_params.from_key);

            // Create recurring childcare cost function
            // GPU NOTE: childcare costs (R - out)
            addGPUDescriptor(envelopes, upd_params.from_key, {
                type: "R",
                direction: "out",
                t0: upd_params.start_time,
                dt: 365.25 / 12,
                tf: upd_params.start_time + upd_params.end_time,
                thetaParamKey: "b",
                theta: P({ b: upd_params.monthly_cost }),
                growth: theta_growth_source
            });

        } else if (upd_type === "college_fund") {
            // Get growth parameters for both envelopes
            const [theta_growth_source, theta_growth_college] = get_growth_parameters(
                envelopes, upd_params.from_key, upd_params.to_key
            );

            // Handle initial college fund contribution
            // GPU NOTE: college fund initial contribution (T - out)
            addGPUDescriptor(envelopes, upd_params.from_key, {
                type: "T",
                direction: "out",
                t_k: upd_params.start_time,
                thetaParamKey: "b",
                theta: P({ b: upd_params.initial_contribution }),
                growth: theta_growth_source
            });

            // Create recurring college fund contribution function
            // GPU NOTE: college fund contribution (R - out)
            addGPUDescriptor(envelopes, upd_params.from_key, {
                type: "R",
                direction: "out",
                t0: upd_params.start_time,
                dt: 365.25 / 12,
                tf: upd_params.start_time + upd_params.end_time,
                thetaParamKey: "b",
                theta: P({ b: upd_params.monthly_contribution }),
                growth: theta_growth_source
            });

            // Create corresponding inflow to college fund envelope
            // GPU NOTE: college fund inflow (R - in)
            addGPUDescriptor(envelopes, upd_params.to_key, {
                type: "R",
                direction: "in",
                t0: upd_params.start_time,
                dt: 365.25 / 12,
                tf: upd_params.start_time + upd_params.end_time,
                thetaParamKey: "a",
                theta: P({ a: upd_params.monthly_contribution }),
                growth: theta_growth_college
            });
        }
    }
};

export const marriage = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Create wedding cost function (outflow)
    // Add wedding cost to source envelope
    // GPU NOTE: marriage wedding cost (T - out)
    addGPUDescriptor(envelopes, params.from_key, {
        type: "T",
        direction: "out",
        t_k: params.start_time,
        thetaParamKey: "b",
        theta: P({ b: params.cost }),
        growth: theta_growth_source
    });
};

export const divorce = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Handle settlement payment (outflow)


    // Handle attorney fees (outflow)

    // GPU NOTE: divorce settlement (T - out)
    addGPUDescriptor(envelopes, params.from_key, {
        type: "T",
        direction: "out",
        t_k: params.start_time,
        thetaParamKey: "b",
        theta: P({ b: params.settlement_amount }),
        growth: theta_growth_source
    });
    // GPU NOTE: divorce attorney fees (T - out)
    addGPUDescriptor(envelopes, params.from_key, {
        type: "T",
        direction: "out",
        t_k: params.start_time,
        thetaParamKey: "b",
        theta: P({ b: params.attorney_fees }),
        growth: theta_growth_source
    });
};

export const buy_health_insurance = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Create monthly premium payment function

    // Add premium payments to source envelope
    // GPU NOTE: health insurance premiums (R - out) with long tf handled by clamp
    addGPUDescriptor(envelopes, params.from_key, {
        type: "R",
        direction: "out",
        t0: params.start_time,
        dt: 365.25 / 12,
        tf: Infinity,
        thetaParamKey: "b",
        theta: P({ b: params.monthly_premium }),
        growth: theta_growth_source
    });

    // Handle updating events (medical expenses)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "medical_expense") {
            // Calculate out-of-pocket cost
            const total_cost = upd_params.total_cost;
            const deductible = upd_params.deductible ?? params.deductible;
            const coverage = upd_params.insurance_coverage ?? params.coverage_percentage;

            // Get growth parameters from source envelope
            const [theta_growth_source, _] = get_growth_parameters(envelopes, upd_params.from_key);

            // Handle deductible (outflow)
            if (deductible > 0) {
                // GPU NOTE: medical deductible (T - out)
                addGPUDescriptor(envelopes, upd_params.from_key, {
                    type: "T",
                    direction: "out",
                    t_k: upd_params.start_time,
                    thetaParamKey: "b",
                    theta: P({ b: deductible }),
                    growth: theta_growth_source
                });
            }

            // Handle remaining out-of-pocket cost
            const remaining_cost = total_cost - deductible;
            const out_of_pocket = remaining_cost * (1 - coverage);
            if (out_of_pocket > 0) {
                // GPU NOTE: medical out-of-pocket (T - out)
                addGPUDescriptor(envelopes, upd_params.from_key, {
                    type: "T",
                    direction: "out",
                    t_k: upd_params.start_time,
                    thetaParamKey: "b",
                    theta: P({ b: out_of_pocket }),
                    growth: theta_growth_source
                });
            }
        }
    }
};

export const buy_life_insurance = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Create monthly premium payment function

    // Add premium payments to source envelope

    // Handle updating events (coverage changes)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "increase_coverage") {
            // Create new premium payment function with updated amount
            addGPUDescriptor(envelopes, params.from_key, {
                type: "R",
                direction: "out",
                t0: upd_params.start_time,
                dt: 365.25 / 12,
                tf: params.start_time + params.term_years * 365.25,
                thetaParamKey: "b",
                theta: P({ b: params.new_monthly_premium }),
                growth: theta_growth_source
            });
        }
    }
};

export const receive_government_aid = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for destination envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, params.to_key);

    // Create recurring payment function

    // Add aid payments to target envelope
    // GPU NOTE: government aid (R - in)
    addGPUDescriptor(envelopes, params.to_key, {
        type: "R",
        direction: "in",
        t0: params.start_time,
        dt: params.frequency_days,
        tf: params.start_time + params.end_time,
        thetaParamKey: "a",
        theta: P({ a: params.amount }),
        growth: theta_growth_dest
    });
};

export const invest_money = (event: any, envelopes: Record<string, any>) => {
    // Get type-safe parameters - just add this one line!
    const params = getTypedParams<AllEventTypes.invest_moneyParams>(event);

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    // Calculate cost basis information for internal use
    const shares = 100;
    const costBasisPerShare = (params.amount / shares);
    const totalCostBasis = shares * costBasisPerShare;

    // Initialize purchases array for FIFO tracking
    const fifoQueue = [];

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // For recurring investments, create multiple purchase records for each period
        const numberOfPeriods = Math.floor((params.end_time - params.start_time) / params.frequency_days) + 1;

        for (let i = 0; i < numberOfPeriods; i++) {
            const purchaseDate = params.start_time + (i * params.frequency_days);
            fifoQueue.push({
                shares: shares,
                costBasisPerShare: costBasisPerShare,
                totalCostBasis: totalCostBasis,
                purchaseDate: purchaseDate,
                purchaseAmount: params.amount
            });
        }

        // Create recurring investment functions
        // GPU NOTE: invest recurring outflow (R - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "R",
            direction: "out",
            t0: params.start_time,
            dt: params.frequency_days,
            tf: params.end_time,
            thetaParamKey: "b",
            theta: P({ b: params.amount }),
            growth: theta_growth_source
        });

        // Create recurring investment growth function
        // GPU NOTE: invest recurring inflow (R - in)
        addGPUDescriptor(envelopes, params.to_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: params.frequency_days,
            tf: params.end_time,
            thetaParamKey: "a",
            theta: P({ a: params.amount }),
            growth: theta_growth_dest
        });
    } else {
        // For one-time investments, create a single purchase record
        fifoQueue.push({
            shares: shares,
            costBasisPerShare: costBasisPerShare,
            totalCostBasis: totalCostBasis,
            purchaseDate: params.start_time,
            purchaseAmount: params.amount
        });

        // Handle one-time investment (original logic)
        // GPU NOTE: invest one-time outflow (T - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "out",
            t_k: params.start_time,
            thetaParamKey: "b",
            theta: P({ b: params.amount }),
            growth: theta_growth_source
        });

        // Create investment growth function
        // GPU NOTE: invest one-time inflow (T - in)
        addGPUDescriptor(envelopes, params.to_key, {
            type: "T",
            direction: "in",
            t_k: params.start_time,
            thetaParamKey: "a",
            theta: P({ a: params.amount }),
            growth: theta_growth_dest
        });
    }

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        if (upd_type === "Reoccuring Dividend Payout") {
            // Handle dividend payments
            // GPU NOTE: dividend payout (R - in)
            // Get type-safe parameters for updating events!
            const dividend_params = getTypedUpdatingParams<AllEventTypes.Reoccuring_Dividend_PayoutParams>(upd);

            // Transfer money into the dividend envelope
            addGPUDescriptor(envelopes, params.to_key, {
                type: "R",
                direction: "in",
                t0: dividend_params.start_time,
                dt: dividend_params.frequency_days,
                tf: dividend_params.end_time,
                thetaParamKey: "a",
                theta: P({ a: dividend_params.amount }),
                growth: theta_growth_dest
            });

        } else if (upd_type === "transfer_out") {
            // Use to transfer amount out of an envelope to a source envelope
            // Also tracks the capital gains tax on the transfer
            // Get type-safe parameters for updating events!

            const transfer_params = getTypedUpdatingParams<AllEventTypes.transfer_outParams>(upd);

            // Transfer money out of the investment envelope
            addGPUDescriptor(envelopes, params.to_key, {
                type: "T",
                direction: "out",
                t_k: transfer_params.start_time,
                thetaParamKey: "b",
                theta: P({ b: transfer_params.amount }),
                growth: theta_growth_source
            });
            // Transfer money into the source envelope
            addGPUDescriptor(envelopes, transfer_params.to_key, {
                type: "T",
                direction: "in",
                t_k: transfer_params.start_time,
                thetaParamKey: "a",
                theta: P({ a: transfer_params.amount }),
                growth: theta_growth_source
            });

            // Calculate capital gains using FIFO (First In, First Out) logic
            let remainingAmountToSell = transfer_params.amount;
            let totalShortTermGains = 0;
            let totalLongTermGains = 0;

            // Sort purchases by date (oldest first) for FIFO
            const sortedPurchases = [...fifoQueue].sort((a, b) => a.purchaseDate - b.purchaseDate);

            for (const purchase of sortedPurchases) {
                if (remainingAmountToSell <= 0) break;

                // Calculate current value per share for this purchase
                const timeSincePurchase = transfer_params.start_time - purchase.purchaseDate;
                const growth = f_growth(theta_growth_dest, timeSincePurchase);
                const currentValuePerShare = purchase.costBasisPerShare * growth;
                const totalCurrentValue = currentValuePerShare * purchase.shares;

                // Determine how much to sell from this purchase
                const amountToSellFromThisPurchase = Math.min(
                    totalCurrentValue,
                    remainingAmountToSell
                );

                if (amountToSellFromThisPurchase > 0) {
                    const sharesSold = amountToSellFromThisPurchase / currentValuePerShare;
                    const costBasisSold = purchase.costBasisPerShare * sharesSold;
                    const capitalGains = amountToSellFromThisPurchase - costBasisSold;

                    // Determine if this is short-term or long-term based on holding period
                    if (timeSincePurchase > 365) {
                        totalLongTermGains += capitalGains;
                    } else {
                        totalShortTermGains += capitalGains;
                    }

                    remainingAmountToSell -= amountToSellFromThisPurchase;
                }
            }

            console.log("FIFO Results:", {
                totalShortTermGains,
                totalLongTermGains,
                remainingAmountToSell
            });

            // Apply capital gains to appropriate tax envelopes
            if (totalShortTermGains > 0) {
                addGPUDescriptor(envelopes, transfer_params.short_term_capital_gains_envelope, {
                    type: "T",
                    direction: "in",
                    t_k: transfer_params.start_time,
                    thetaParamKey: "a",
                    theta: P({ a: totalShortTermGains }),
                    growth: theta_growth_source
                });
            }

            if (totalLongTermGains > 0) {
                addGPUDescriptor(envelopes, transfer_params.long_term_capital_gains_envelope, {
                    type: "T",
                    direction: "in",
                    t_k: transfer_params.start_time,
                    thetaParamKey: "a",
                    theta: P({ a: totalLongTermGains }),
                    growth: theta_growth_source
                });
            }
        }
    }
};

export const high_yield_savings_account = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create recurring deposits to savings account
        // GPU NOTE: HYSA recurring deposit (R - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "R",
            direction: "out",
            t0: params.start_time,
            dt: params.frequency_days || 365.25 / 12,
            tf: params.end_time || params.start_time + 3650,
            thetaParamKey: "b",
            theta: P({ b: params.amount }),
            growth: theta_growth_source
        });

        // Create recurring savings growth function
        // GPU NOTE: HYSA recurring growth (R - in)
        addGPUDescriptor(envelopes, params.to_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: params.frequency_days || 365.25 / 12,
            tf: params.end_time || params.start_time + 3650,
            thetaParamKey: "a",
            theta: P({ a: params.amount }),
            growth: theta_growth_dest
        });
    } else {
        // Handle one-time account opening and initial deposit
        // GPU NOTE: HYSA one-time deposit (T - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "out",
            t_k: params.start_time,
            thetaParamKey: "b",
            theta: P({ b: params.amount }),
            growth: theta_growth_source
        });

        // Create one-time savings growth function
        // GPU NOTE: HYSA one-time growth (T - in)
        addGPUDescriptor(envelopes, params.to_key, {
            type: "T",
            direction: "in",
            t_k: params.start_time,
            thetaParamKey: "a",
            theta: P({ a: params.amount }),
            growth: theta_growth_dest
        });
    }
};

export const buy_groceries = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create recurring monthly grocery payment function
        // GPU NOTE: groceries recurring (R - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "R",
            direction: "out",
            t0: params.start_time,
            dt: 365.25 / 12,
            tf: params.start_time + params.end_time,
            thetaParamKey: "b",
            theta: P({ b: params.monthly_amount }),
            growth: theta_growth_source
        });
    } else {
        // Create one-time grocery purchase function
        // GPU NOTE: groceries one-time (T - out)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "out",
            t_k: params.start_time,
            thetaParamKey: "b",
            theta: P({ b: params.monthly_amount }),
            growth: theta_growth_source
        });
    }
};

// Helper function to calculate daily compound interest for student loans
const calculateAccumulatedDebt = (principal: number, annualRate: number, timeInDays: number): number => {
    // Daily compound interest formula: A = P(1 + r/365)^days
    return principal * Math.pow(1 + annualRate / 365, timeInDays);
};

export const federal_subsidized_loan = (event: any, envelopes: Record<string, any>, updatePlan?: (updates: Array<{ eventId: number, paramType: string, value: number }>) => void) => {
    const params = event.parameters;

    // Get growth parameters for source, during-school, and after-school envelopes
    const [theta_growth_source, theta_growth_during, theta_growth_after] = get_growth_parameters(
        envelopes, params.from_key, params.to_key, params.after_school_key
    );

    // Add debt to student loans during-school envelope (negative balance) - no interest accrues
    // GPU: during-school debt (T - out)
    addGPUDescriptor(envelopes, params.to_key, {
        type: "T",
        direction: "out",
        t_k: params.start_time,
        thetaParamKey: "b",
        theta: P({ b: params.amount }),
        growth: theta_growth_during
    });

    // Calculate when payments begin: graduation_date + 6 months (180 days)
    const payment_start_time = params.graduation_date + 180;

    // For subsidized loans, no interest accrues during school
    const accumulated_debt_amount = params.amount;

    // Transfer debt out of during-school envelope
    // GPU: transfer out of during-school (T - in)
    addGPUDescriptor(envelopes, params.to_key, {
        type: "T",
        direction: "in",
        t_k: payment_start_time,
        thetaParamKey: "a",
        theta: P({ a: accumulated_debt_amount }),
        growth: theta_growth_during
    });

    // Transfer accumulated debt into after-school envelope
    // GPU: transfer into after-school (T - out)
    addGPUDescriptor(envelopes, params.after_school_key, {
        type: "T",
        direction: "out",
        t_k: payment_start_time,
        thetaParamKey: "b",
        theta: P({ b: accumulated_debt_amount }),
        growth: theta_growth_after
    });

    // Standard 10-year repayment schedule
    const loan_term_years = params.loan_term_years;
    const payment_end_time = payment_start_time + loan_term_years * 365.25 - 365.25 / 12 - 1; // dont need last payment as we did first payment

    // Get interest rate from the after-school Student Loans envelope
    const interest_rate = envelopes[params.after_school_key].growth_rate || 0.055; // Default 5.5% if not specified

    // Monthly payments from cash (includes both principal and interest)
    // GPU NOTE: subsidized student loan monthly payment from cash (R - out) using f_monthly_payment
    addGPUDescriptor(envelopes, params.from_key, {
        type: "R",
        direction: "in",
        t0: payment_start_time,
        dt: 365.25 / 12,
        tf: payment_end_time,
        thetaParamKey: "a",
        theta: P({ P: accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        growth: theta_growth_source,
        computeValue: f_monthly_payment
    });

    // Monthly principal payments to reduce debt (positive payments to debt envelope)
    // GPU NOTE: subsidized student loan principal to debt (R - in) using f_monthly_payment
    addGPUDescriptor(envelopes, params.after_school_key, {
        type: "R",
        direction: "in",
        t0: payment_start_time,
        dt: 365.25 / 12,
        tf: payment_end_time,
        thetaParamKey: "a",
        theta: P({ P: -accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        growth: theta_growth_after,
        computeValue: f_monthly_payment
    });


    if (updatePlan) {
        const endDate = payment_end_time;

        updatePlan([{
            eventId: event.id,
            paramType: 'end_time',
            value: endDate
        }]);
    }

    // --- Student Loan Envelope Correction at End of Payment Cycle ---
    const student_loan_end_time = payment_end_time;
    const studentLoanEnvelope = envelopes[params.after_school_key];
    const student_loan_balance = evaluateEnvelopeAtTime(studentLoanEnvelope, student_loan_end_time);
    if (Math.abs(student_loan_balance) > 1e-6) {
        const [theta_growth_source, theta_growth_after] = get_growth_parameters(
            envelopes, params.from_key, params.after_school_key
        );

        // GPU: end correction (debt envelope T - out)
        addGPUDescriptor(envelopes, params.after_school_key, {
            type: "T",
            direction: "out",
            t_k: student_loan_end_time,
            thetaParamKey: "b",
            theta: P({ b: student_loan_balance }),
            growth: theta_growth_after
        });
        // GPU: end correction (cash/source T - in)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "in",
            t_k: student_loan_end_time,
            thetaParamKey: "a",
            theta: P({ a: student_loan_balance }),
            growth: theta_growth_source
        });
    }
};

export const federal_unsubsidized_loan = (event: any, envelopes: Record<string, any>, updatePlan?: (updates: Array<{ eventId: number, paramType: string, value: number }>) => void) => {
    const params = event.parameters;

    // Get growth parameters for source and destination envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    // Add debt to student loans envelope (negative balance) - interest accrues during school
    // GPU: unsubsidized/private during-school debt (T - out)
    addGPUDescriptor(envelopes, params.to_key, {
        type: "T",
        direction: "out",
        t_k: params.start_time,
        thetaParamKey: "b",
        theta: P({ b: params.amount }),
        growth: theta_growth_dest
    });

    // Calculate when payments begin: graduation_date + 6 months (180 days)
    const payment_start_time = params.graduation_date + 180;

    // Calculate accumulated debt using daily compound interest
    const interest_accrual_days = payment_start_time - params.start_time;
    const interest_rate = envelopes[params.to_key].growth_rate; // Get rate from envelope
    const accumulated_debt_amount = calculateAccumulatedDebt(params.amount, interest_rate, interest_accrual_days);

    // Standard 10-year repayment schedule
    const loan_term_years = params.loan_term_years;
    const payment_end_time = payment_start_time + loan_term_years * 365.25 - 365.25 / 12 - 1; // dont need last payment as we did first payment

    // Monthly payments from cash (includes both principal and interest)
    // GPU NOTE: unsubsidized student loan monthly payment from cash (R - out) using f_monthly_payment
    addGPUDescriptor(envelopes, params.from_key, {
        type: "R",
        direction: "out",
        t0: payment_start_time,
        dt: 365.25 / 12,
        tf: payment_end_time,
        thetaParamKey: "b",
        theta: P({ P: accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        growth: theta_growth_source,
        computeValue: f_monthly_payment
    });

    // Monthly principal payments to reduce debt
    // GPU NOTE: unsubsidized student loan principal to debt (R - in) using f_monthly_payment
    addGPUDescriptor(envelopes, params.to_key, {
        type: "R",
        direction: "in",
        t0: payment_start_time,
        dt: 365.25 / 12,
        tf: payment_end_time,
        thetaParamKey: "a",
        theta: P({ P: -accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        growth: theta_growth_dest,
        computeValue: f_monthly_payment
    });


    if (updatePlan) {
        const endDate = payment_end_time;

        updatePlan([{
            eventId: event.id,
            paramType: 'end_time',
            value: endDate
        }]);
    }

    // --- Student Loan Envelope Correction at End of Payment Cycle ---
    const student_loan_end_time = payment_end_time;
    const studentLoanEnvelope = envelopes[params.to_key];
    const student_loan_balance = evaluateEnvelopeAtTime(studentLoanEnvelope, student_loan_end_time);
    //console.log("student_loan_balance", student_loan_balance);
    if (Math.abs(student_loan_balance) > 1e-6) {
        const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
            envelopes, params.from_key, params.to_key
        );
        // GPU: end correction (debt envelope T - out)
        addGPUDescriptor(envelopes, params.to_key, {
            type: "T",
            direction: "out",
            t_k: student_loan_end_time,
            thetaParamKey: "b",
            theta: P({ b: student_loan_balance }),
            growth: theta_growth_dest
        });
        // GPU: end correction (cash/source T - in)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "in",
            t_k: student_loan_end_time,
            thetaParamKey: "a",
            theta: P({ a: student_loan_balance }),
            growth: theta_growth_source
        });
    }
};

export const private_student_loan = (event: any, envelopes: Record<string, any>, updatePlan?: (updates: Array<{ eventId: number, paramType: string, value: number }>) => void) => {
    const params = event.parameters;

    // Get growth parameters for source and destination envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    // Add debt to student loans envelope (negative balance) - interest accrues during school
    // GPU: unsubsidized/private during-school debt (T - out)
    addGPUDescriptor(envelopes, params.to_key, {
        type: "T",
        direction: "out",
        t_k: params.start_time,
        thetaParamKey: "b",
        theta: P({ b: params.amount }),
        growth: theta_growth_dest
    });

    // Calculate when payments begin: graduation_date + 6 months (180 days)
    const payment_start_time = params.graduation_date + 180;

    // Calculate accumulated debt using daily compound interest
    const interest_accrual_days = payment_start_time - params.start_time;
    const interest_rate = envelopes[params.to_key].growth_rate; // Get rate from envelope (higher for private)
    const accumulated_debt_amount = calculateAccumulatedDebt(params.amount, interest_rate, interest_accrual_days);

    // Standard 10-year repayment schedule
    const loan_term_years = params.loan_term_years;
    const payment_end_time = payment_start_time + loan_term_years * 365.25 - 365.25 / 12 - 1; // dont need last payment as we did first payment

    // First payment is 30 days after grace period
    // Monthly payments from cash (includes both principal and interest)
    // GPU NOTE: private student loan monthly payment from cash (R - out) using f_monthly_payment
    addGPUDescriptor(envelopes, params.from_key, {
        type: "R",
        direction: "in",
        t0: payment_start_time + 365.25 / 12,
        dt: 365.25 / 12,
        tf: payment_end_time,
        thetaParamKey: "a",
        theta: P({ P: accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        growth: theta_growth_source,
        computeValue: f_monthly_payment
    });

    // Monthly principal payments to reduce debt
    // GPU NOTE: private student loan principal to debt (R - in) using f_monthly_payment
    addGPUDescriptor(envelopes, params.to_key, {
        type: "R",
        direction: "in",
        t0: payment_start_time + 365.25 / 12,
        dt: 365.25 / 12,
        tf: payment_end_time,
        thetaParamKey: "a",
        theta: P({ P: -accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        growth: theta_growth_dest,
        computeValue: f_monthly_payment
    });


    if (updatePlan) {
        const endDate = payment_end_time;

        updatePlan([{
            eventId: event.id,
            paramType: 'end_time',
            value: endDate
        }]);
    }

    // --- Student Loan Envelope Correction at End of Payment Cycle ---
    const student_loan_end_time = payment_end_time;
    const studentLoanEnvelope = envelopes[params.to_key];
    const student_loan_balance = evaluateEnvelopeAtTime(studentLoanEnvelope, student_loan_end_time);
    if (Math.abs(student_loan_balance) > 1e-6) {
        const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
            envelopes, params.from_key, params.to_key
        );

        // GPU: end correction (debt envelope T - out)
        addGPUDescriptor(envelopes, params.to_key, {
            type: "T",
            direction: "out",
            t_k: student_loan_end_time,
            thetaParamKey: "b",
            theta: P({ b: student_loan_balance }),
            growth: theta_growth_dest
        });

        // GPU: end correction (cash/source T - in)
        addGPUDescriptor(envelopes, params.from_key, {
            type: "T",
            direction: "in",
            t_k: student_loan_end_time,
            thetaParamKey: "a",
            theta: P({ a: student_loan_balance }),
            growth: theta_growth_source
        });
    }
};

// Helper function to find year-end days based on birth date
const getYearEndDays = (birthDate: Date, startTime: number, endTime: number): number[] => {
    const yearEndDays: number[] = [];

    //console.log("Birth date", birthDate);
    //console.log("Start time", startTime);
    //console.log("End time", endTime);

    // Start from the birth year
    let currentYear = birthDate.getFullYear();

    //console.log("Current year", currentYear);

    while (true) {
        // Create the tax year-end date (December 31st of current year)
        const taxYearEndDate = new Date(currentYear, 11, 31); // Month 11 = December, Day 31

        // Calculate days since birth date
        const daysSinceBirth = Math.floor((taxYearEndDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

        //console.log(`Tax year ${currentYear} ends on day ${daysSinceBirth} (Dec 31, ${currentYear})`);

        // If this year-end is beyond our simulation end time, break
        if (daysSinceBirth > endTime) break;

        // If this year-end is within our simulation range and after birth, add it
        if (daysSinceBirth >= startTime && daysSinceBirth >= 0) {
            yearEndDays.push(daysSinceBirth);
        }

        currentYear++;
    }

    return yearEndDays;
};

// Helper function to calculate taxes based on taxable income using tax brackets
const calculateTaxes = (params: Record<string, any>): number => {
    // Extract parameters from the dictionary
    let taxable_income = params.taxable_income ?? 0;
    const p_401k_withdraw = params.p_401k_withdraw ?? 0;
    const p_401k_withdraw_withholding = params.p_401k_withdraw_withholding ?? 0;
    const roth_ira_withdraw = params.roth_ira_withdraw ?? 0;
    let roth_ira_principle = params.roth_ira_principle ?? 0;
    const federal_withholding = params.federal_withholding ?? 0;
    const state_withholding = params.state_withholding ?? 0;
    const local_withholding = params.local_withholding ?? 0;
    const ira_contributions = params.ira_contributions ?? 0;
    const real_estate_tax = params.real_estate_tax ?? 0;
    const short_term_capital_gains = params.short_term_capital_gains ?? 0;
    const long_term_capital_gains = params.long_term_capital_gains ?? 0;
    const filing_status = params.filing_status || "Single";
    const age = params.age ?? 0;
    const dependents = params.dependents ?? 0;
    const location = params.location || "City, State";
    const tax_year = params.tax_year || new Date().getFullYear();


    // use the rothIRA principle and see the withdrawals. 
    // Add the difference to the taxable income if greater than 0
    // You are only taxed on the interest not on the principle amount.
    // Set ROTHIRA principle to 0 if it is negative
    if (roth_ira_principle < 0) {
        roth_ira_principle = 0;
    }

    if (roth_ira_withdraw > roth_ira_principle && age <= 59.5) {
        const roth_ira_withdraw_difference = roth_ira_withdraw - roth_ira_principle;
        taxable_income += roth_ira_withdraw_difference;
    }

    taxable_income += p_401k_withdraw;

    // Add short-term capital gains to taxable income (taxed at ordinary income rates)
    taxable_income += short_term_capital_gains;

    if (taxable_income <= 0) return 0;

    // Define federal tax brackets for different filing statuses (2023 as example)
    const federalBracketsByStatus: Record<string, { min: number, max: number, rate: number }[]> = {
        "Single": [
            { min: 0, max: 11000, rate: 0.10 },
            { min: 11000, max: 44725, rate: 0.12 },
            { min: 44725, max: 95375, rate: 0.22 },
            { min: 95375, max: 182050, rate: 0.24 },
            { min: 182050, max: 231250, rate: 0.32 },
            { min: 231250, max: 578125, rate: 0.35 },
            { min: 578125, max: Infinity, rate: 0.37 }
        ],
        "Married Filing Jointly": [
            { min: 0, max: 22000, rate: 0.10 },
            { min: 22000, max: 89450, rate: 0.12 },
            { min: 89450, max: 190750, rate: 0.22 },
            { min: 190750, max: 364200, rate: 0.24 },
            { min: 364200, max: 462500, rate: 0.32 },
            { min: 462500, max: 693750, rate: 0.35 },
            { min: 693750, max: Infinity, rate: 0.37 }
        ]
        // Add more statuses as needed
    };

    // Select brackets based on filing status, default to 'Single' if not found
    const federalBrackets = federalBracketsByStatus[filing_status] || federalBracketsByStatus["Single"];

    // Simplified state tax (flat rate - adjust as needed)
    const stateRate = 0.05; // 5% flat state tax
    // Local tax (for demonstration, set to 0.01 or 1%)
    const localRate = 0.01;

    let federalTax = 0;
    let remainingIncome = taxable_income;

    // Calculate federal tax using brackets
    for (const bracket of federalBrackets) {
        if (remainingIncome <= 0) break;
        const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
        federalTax += taxableInBracket * bracket.rate;
        remainingIncome -= taxableInBracket;
    }

    // Calculate state and local tax
    const stateTax = taxable_income * stateRate;
    const localTax = taxable_income * localRate;

    // Calculate long-term capital gains tax separately
    let longTermCapitalGainsTax = 0;
    if (long_term_capital_gains > 0) {
        // Define long-term capital gains tax brackets (2023 rates)
        const longTermCapitalGainsBracketsByStatus: Record<string, { min: number, max: number, rate: number }[]> = {
            "Single": [
                { min: 0, max: 44725, rate: 0.00 },      // 0% for income up to $44,725
                { min: 44725, max: 492300, rate: 0.15 }, // 15% for income $44,725 to $492,300
                { min: 492300, max: Infinity, rate: 0.20 } // 20% for income above $492,300
            ],
            "Married Filing Jointly": [
                { min: 0, max: 89450, rate: 0.00 },      // 0% for income up to $89,450
                { min: 89450, max: 553850, rate: 0.15 }, // 15% for income $89,450 to $553,850
                { min: 553850, max: Infinity, rate: 0.20 } // 20% for income above $553,850
            ]
        };

        // Select brackets based on filing status
        const longTermBrackets = longTermCapitalGainsBracketsByStatus[filing_status] || longTermCapitalGainsBracketsByStatus["Single"];

        // Calculate long-term capital gains tax using brackets
        let remainingLongTermGains = long_term_capital_gains;
        for (const bracket of longTermBrackets) {
            if (remainingLongTermGains <= 0) break;
            const taxableInBracket = Math.min(remainingLongTermGains, bracket.max - bracket.min);
            longTermCapitalGainsTax += taxableInBracket * bracket.rate;
            remainingLongTermGains -= taxableInBracket;
        }
    }

    // Subtract withholdings and IRA contributions
    let totalTax = federalTax + stateTax + localTax + real_estate_tax + longTermCapitalGainsTax;
    totalTax -= federal_withholding;
    totalTax -= state_withholding;
    totalTax -= local_withholding;
    totalTax -= p_401k_withdraw_withholding;
    totalTax -= ira_contributions; // If deductible

    // Subtract dependent credits (roughly, $2000 per dependent)
    totalTax -= dependents * 2000;
    if (totalTax < 0) totalTax = 0;

    // If under the age of 59.5, add a 10% penalty to the tax for the 401k withdrawals  
    if (age < 59.5) {
        totalTax += p_401k_withdraw * 0.1;
        totalTax += roth_ira_withdraw * 0.1;
    }

    // Optionally use location, tax_year for future logic
    // console.log({ location, tax_year });

    return totalTax;
};

export const usa_tax_system = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const simulation_settings = envelopes.simulation_settings;

    // Always use peek mechanisms for resets, penalties, and incremental tax

    // Get growth parameters for the envelopes
    const [theta_growth_taxable_income, theta_growth_penalty_401k, theta_growth_taxes_401k, theta_growth_roth, theta_growth_penalty_roth, theta_growth_401k, theta_growth_irs_registered_account] = get_growth_parameters(
        envelopes, params.taxable_income_key, params.penalty_401k_key, params.taxes_401k_key, params.roth_key, params.penalty_roth_key, params.p_401k_key, params.irs_registered_account_key
    );

    //calcualte taxes
    const taxParams = {
        taxable_income: 0,
        federal_withholding: 0,
        state_withholding: 0,
        local_withholding: 0,
        ira_contributions: 0,
        real_estate_tax: 0,
        roth_ira_withdraw: 0,
        p_401k_withdraw: 0,
        p_401k_withdraw_withholding: 0,
        filing_status: params.filing_status || "Single",
        dependents: params.dependents ?? 0,
        location: params.location || "City, State",
        tax_year: params.tax_year || new Date().getFullYear()
    };

    // Create time range based on simulation settings
    const startTime = simulation_settings.start_time;
    const endTime = simulation_settings.end_time;
    const birthDate = simulation_settings.birthDate;

    // Get year-end days based on birth date, this returns which days are Dec 31st of each year
    const yearEndDays = birthDate ? getYearEndDays(birthDate, startTime, endTime) : [];

    //console.log("Year-end days", yearEndDays);

    // Calculate the day when person reaches 59.5 years old
    let age59HalfDay = null;
    if (birthDate) {
        // 59.5 years = 59 years + 6 months = 59 * 365.25 + 182.625 days
        const daysTo59Half = Math.floor(59.5 * 365.25);
        age59HalfDay = daysTo59Half;

        // Only apply if within simulation range
        if (age59HalfDay >= startTime && age59HalfDay <= endTime) {
            //console.log(`Person reaches age 59.5 on day ${age59HalfDay}`);
        } else {
            age59HalfDay = null; // Outside simulation range
        }
    }

    // Initialize staged peek queue holder (noop if already present) — still used for impulses/tax deltas
    (envelopes as any).__peeks = (envelopes as any).__peeks || [];


    // Process taxable income corrections and tax payment lazily at year-end days
    yearEndDays.forEach(yearEndDay => {
        // --- Reset taxable income and additional envelopes at year end ---
        // Evaluate value of all tax related envelopes for year-end tax calculation
        const taxEnvelopesBalances: Record<string, number> = {};

        //Calculate age and year
        const age = Math.floor(yearEndDay / 365);
        const year = birthDate.getFullYear() + age;

        //Evaluate taxes paid on these amounts
        const taxParams_tax_season = {
            ...taxParams,
            age: age,
            tax_year: year,
            taxable_income: taxEnvelopesBalances[params.taxable_income_key],
            p_401k_withdraw: taxEnvelopesBalances[params.p_401k_withdraw_key],
            p_401k_withdraw_withholding: taxEnvelopesBalances[params.p_401k_withdraw_withholding_key],
            roth_ira_withdraw: taxEnvelopesBalances[params.roth_ira_withdraw_key],
            roth_ira_principle: taxEnvelopesBalances[params.roth_ira_principle_key],
            federal_withholding: taxEnvelopesBalances[params.federal_withholdings_key],
            state_withholding: taxEnvelopesBalances[params.state_withholdings_key],
            local_withholding: taxEnvelopesBalances[params.local_withholdings_key],
            short_term_capital_gains: taxEnvelopesBalances[params.short_term_capital_gains_key] || 0,
            long_term_capital_gains: taxEnvelopesBalances[params.long_term_capital_gains_key] || 0,
        };

        const taxesOwed = calculateTaxes(taxParams_tax_season);
        //console.log("Tax Params", taxParams_tax_season);
        //console.log("Taxes Owed", taxesOwed);

        // GPU NOTE: Additional taxes attributable specifically to including 401k in taxable income
        // Compute delta at year end lazily using other envelopes' values at the same evaluation index
        if (params.taxes_401k_key && envelopes[params.taxes_401k_key]) {
            addGPUDescriptor(envelopes, params.taxes_401k_key, {
                type: "LazyFromEnvelopes",
                direction: "in",
                t_k: yearEndDay,
                thetaParamKey: "a",
                theta: P({ a: 0 }),
                growth: theta_growth_taxes_401k,
                computeTarget: ({ index, getValueAt }: { index: number, getValueAt: (key: string) => number }) => {
                    void index; // not used currently
                    const taxableIncome = Number(getValueAt(params.taxable_income_key) || 0);
                    const balance401k = Number(getValueAt(params.p_401k_key) || 0);
                    const with401k = calculateTaxes({ ...taxParams_tax_season, taxable_income: taxableIncome + balance401k });
                    const base = calculateTaxes({ ...taxParams_tax_season, taxable_income: taxableIncome });
                    return -(with401k - base);
                }
            } as any);
        }

        // Withdraw the taxes withhed from irs_registered_account_key
        // GPU NOTE: USA tax day payment from IRS registered account (T - out)
        addGPUDescriptor(envelopes, params.irs_registered_account_key, {
            type: "T",
            direction: "out",
            t_k: yearEndDay + 105,
            thetaParamKey: "b",
            theta: P({ b: taxesOwed }),
            growth: theta_growth_irs_registered_account
        });

        const resetEnvelopes = [
            params.taxable_income_key,
            params.federal_withholdings_key,
            params.state_withholdings_key,
            params.local_withholdings_key,
            params.ira_contributions_key,
            params.p_401k_withdraw_key,
            params.p_401k_withdraw_withholding_key,
            params.roth_ira_withdraw_key,
            params.short_term_capital_gains_key,
            params.long_term_capital_gains_key,
        ];
        // Replace peek-based resets with LazyCorrection to target 0 at year end
        for (const key of resetEnvelopes) {
            if (!key || !envelopes[key]) continue;
            const [_, theta_growth_env] = get_growth_parameters(envelopes, undefined, key);
            addGPUDescriptor(envelopes, key, {
                type: "LazyCorrection",
                direction: "in",
                t_k: yearEndDay,
                thetaParamKey: "a",
                theta: P({ a: 0 }),
                growth: theta_growth_env,
                target: 0
            });
        }
    });

    // Penalty dependency (single-pass, no impulses):
    // For t < age59HalfDay, set w_penalty_401k(t) = 0.10 * w_401k(t) and w_penalty_roth(t) = 0.10 * w_roth(t)
    // Implemented as a ScaleFromEnvelope descriptor that scales the current accumulated value.
    if (age59HalfDay !== null) {
        addGPUDescriptor(envelopes, params.penalty_401k_key, {
            type: "ScaleFromEnvelope",
            direction: "out",
            thetaParamKey: "b",
            theta: P({ b: 0 }), // not used
            growth: { type: "None", r: 0 },
            sourceKey: params.p_401k_key,
            coeff: 0.10,
            untilDay: age59HalfDay as number,
            applyBefore: true
        });
        addGPUDescriptor(envelopes, params.penalty_roth_key, {
            type: "ScaleFromEnvelope",
            direction: "out",
            thetaParamKey: "b",
            theta: P({ b: 0 }),
            growth: { type: "None", r: 0 },
            sourceKey: params.roth_key,
            coeff: 0.10,
            untilDay: age59HalfDay as number,
            applyBefore: true
        });
    }


    // Reset 401K penalty to 0 at age 59.5 using LazyCorrection
    if (age59HalfDay !== null) {
        addGPUDescriptor(envelopes, params.penalty_401k_key, {
            type: "LazyCorrection",
            direction: "in",
            t_k: age59HalfDay as number,
            thetaParamKey: "a",
            theta: P({ a: 0 }),
            growth: theta_growth_penalty_401k,
            target: 0
        });
        addGPUDescriptor(envelopes, params.penalty_roth_key, {
            type: "LazyCorrection",
            direction: "in",
            t_k: age59HalfDay as number,
            thetaParamKey: "a",
            theta: P({ a: 0 }),
            growth: theta_growth_penalty_roth,
            target: 0
        });
    }

};


export const retirement = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    //console.log("Retirement event processed with parameters:", envelopes);
    // Get growth parameters for all three envelopes
    const [theta_growth_401k, theta_growth_roth, theta_growth_dest] = get_growth_parameters(
        envelopes, params.p_401k_key, params.roth_ira_key, params.to_key
    );

    // Create recurring transfer from 401K to cash (outflow from 401K)

    // Add withdrawal function to 401K envelope
    // GPU NOTE: retirement 401k withdrawal (R - out)
    addGPUDescriptor(envelopes, params.p_401k_key, {
        type: "R",
        direction: "out",
        t0: params.start_time,
        dt: params.frequency_days,
        tf: params.end_time,
        thetaParamKey: "b",
        theta: P({ b: params.amount }),
        growth: theta_growth_401k
    });

    // Create recurring inflow to cash envelope

    // Add inflow function to cash envelope
    // GPU NOTE: retirement cash inflow from 401k (R - in)
    addGPUDescriptor(envelopes, params.to_key, {
        type: "R",
        direction: "in",
        t0: params.start_time,
        dt: params.frequency_days,
        tf: params.end_time,
        thetaParamKey: "a",
        theta: P({ a: (params.amount - params.amount * 0.25) }),
        growth: theta_growth_dest
    });


    // Create recurring transfer from ROTH IRA to cash (outflow from ROTH IRA)

    // Add withdrawal function to ROTH IRA envelope
    // GPU NOTE: retirement ROTH withdrawal (R - out)
    addGPUDescriptor(envelopes, params.roth_ira_key, {
        type: "R",
        direction: "out",
        t0: params.start_time,
        dt: params.frequency_days,
        tf: params.end_time,
        thetaParamKey: "b",
        theta: P({ b: params.amount_roth_ira }),
        growth: theta_growth_roth
    });

    // Create recurring inflow to cash envelope
    // GPU NOTE: retirement cash inflow from ROTH (R - in)
    addGPUDescriptor(envelopes, params.to_key, {
        type: "R",
        direction: "in",
        t0: params.start_time,
        dt: params.frequency_days,
        tf: params.end_time,
        thetaParamKey: "a",
        theta: P({ a: params.amount_roth_ira }),
        growth: theta_growth_dest
    });


    // Get growth rate for all tax accounts
    const [theta_growth_p_401k_withdraw_withholding, theta_growth_p_401k_withdraw, theta_growth_roth_ira_principle, theta_growth_roth_ira_withdraw] = get_growth_parameters(
        envelopes, params.p_401k_withdraw_withholding_key, params.p_401k_withdraw_key, params.roth_ira_principle_key, params.roth_ira_withdraw_key
    );

    // Create recurring taxable income from 401K withdrawals
    // GPU NOTE: retirement taxable income from 401k withdrawals (R - in)
    addGPUDescriptor(envelopes, params.p_401k_withdraw_key, {
        type: "R",
        direction: "in",
        t0: params.start_time,
        dt: params.frequency_days,
        tf: params.end_time,
        thetaParamKey: "a",
        theta: P({ a: params.amount }),
        growth: theta_growth_p_401k_withdraw
    });


    // Typically 20% for federal and 0-10% for state taxes

    // GPU NOTE: retirement withholdings from 401k (R - in)
    addGPUDescriptor(envelopes, params.p_401k_withdraw_withholding_key, {
        type: "R",
        direction: "in",
        t0: params.start_time,
        dt: params.frequency_days,
        tf: params.end_time,
        thetaParamKey: "a",
        theta: P({ a: params.amount * 0.25 }),
        growth: theta_growth_p_401k_withdraw_withholding
    });



    // Reoccuring withdraws from principle envelope
    // GPU NOTE: retirement ROTH IRA principle withdrawal (R - out)
    addGPUDescriptor(envelopes, params.roth_ira_principle_key, {
        type: "R",
        direction: "out",
        t0: params.start_time,
        dt: params.frequency_days,
        tf: params.end_time,
        thetaParamKey: "b",
        theta: P({ b: params.amount_roth_ira }),
        growth: theta_growth_roth_ira_principle
    });

    // Reoccuring withdraws from account

    // GPU NOTE: retirement ROTH IRA withdrawal tracking (R - in)
    addGPUDescriptor(envelopes, params.roth_ira_withdraw_key, {
        type: "R",
        direction: "in",
        t0: params.start_time,
        dt: params.frequency_days,
        tf: params.end_time,
        thetaParamKey: "a",
        theta: P({ a: params.amount_roth_ira }),
        growth: theta_growth_roth_ira_withdraw
    });

};

export const roth_ira_contribution = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const from_key = params.from_key;
    const to_key = params.to_key;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest, theta_growth_roth_ira_principle] = get_growth_parameters(envelopes, from_key, to_key, params.roth_ira_principle_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Recurring outflow from source envelope
        // GPU NOTE: retirement ROTH IRA contribution (R - out)
        addGPUDescriptor(envelopes, from_key, {
            type: "R",
            direction: "out",
            t0: params.start_time,
            dt: params.frequency_days,
            tf: params.end_time,
            thetaParamKey: "b",
            theta: P({ b: params.amount }),
            growth: theta_growth_source
        });

        // Recurring inflow to Roth IRA envelope
        // GPU NOTE: retirement ROTH IRA contribution (R - in)
        addGPUDescriptor(envelopes, to_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: params.frequency_days,
            tf: params.end_time,
            thetaParamKey: "a",
            theta: P({ a: params.amount }),
            growth: theta_growth_dest
        });

        // Reoccuring addition to the principle tracking for the envelope
        // GPU NOTE: retirement ROTH IRA principle contribution (R - in)
        addGPUDescriptor(envelopes, params.roth_ira_principle_key, {
            type: "R",
            direction: "in",
            t0: params.start_time,
            dt: params.frequency_days,
            tf: params.end_time,
            thetaParamKey: "a",
            theta: P({ a: params.amount }),
            growth: theta_growth_roth_ira_principle
        });
    } else {
        // One-time outflow from source envelope
        // GPU NOTE: retirement ROTH IRA contribution (T - out)
        addGPUDescriptor(envelopes, from_key, {
            type: "T",
            direction: "out",
            t_k: params.start_time,
            thetaParamKey: "b",
            theta: P({ b: params.amount }),
            growth: theta_growth_source
        });

        // One-time inflow to Roth IRA envelope

        // GPU NOTE: retirement ROTH IRA contribution (T - in)
        addGPUDescriptor(envelopes, to_key, {
            type: "T",
            direction: "in",
            t_k: params.start_time,
            thetaParamKey: "a",
            theta: P({ a: params.amount }),
            growth: theta_growth_dest
        });

        // One-time inflow to Roth IRA principle envelope
        // GPU NOTE: retirement ROTH IRA principle contribution (T - in)
        addGPUDescriptor(envelopes, params.roth_ira_principle_key, {
            type: "T",
            direction: "in",
            t_k: params.start_time,
            thetaParamKey: "a",
            theta: P({ a: params.amount }),
            growth: theta_growth_roth_ira_principle
        });
    }
};