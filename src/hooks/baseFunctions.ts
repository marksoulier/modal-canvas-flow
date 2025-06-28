// utilities.ts
import type { Theta, FuncWithTheta } from "./types";

export const u = (t: number): number => (t >= 0 ? 1.0 : 0.0);

export const P = (params: Record<string, any>): Theta => {
    return (_t: number) => params;
};

export const T = (
    theta_event: Record<string, number>,
    f: FuncWithTheta,
    theta: Theta = P({}),
    theta_g: Record<string, any> = { type: "None", r: 0.0 }
): ((t: number) => number) => {
    const t_k = theta_event.t_k;
    const params = theta(t_k);
    return (t: number) => f(params, t_k)(t - t_k) * u(t - t_k) * f_growth(theta_g, t - t_k);
};

export const R = (
    theta_re: Record<string, number>,
    f: FuncWithTheta,
    theta: Theta,
    theta_g: Record<string, any> = { type: "None", r: 0.0 },
    omega: Record<number, [number, Theta]> = {}
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

            if (i in omega) {
                const [t_hat, theta_prime] = omega[i];
                current_t = t_hat;
                current_theta = theta_prime;
            }

            // Apply the occurrence function with growth
            const occurrence = T({ t_k: current_t }, f, current_theta, theta_g);
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
    thetaChange: Record<string, number>,
    tStar: number
): Theta => {
    return (t: number) =>
        t < tStar ? theta(t) : { ...theta(t), ...thetaChange };
};

// Growth magnitude function with different compounding types
export const f_growth = (theta_g: Record<string, any>, t: number): number => {
    const growth_type = theta_g.type;
    const r = theta_g.r;

    switch (growth_type) {
        case "Daily Compound":
            return Math.pow(1 + r / 365, 365 * t / 365);
        case "Monthly Compound":
            return Math.pow(1 + r / 12, 12 * t / 365);
        case "Yearly Compound":
            return Math.pow(1 + r, t / 365);
        case "Simple Interest":
            return 1 + r * (t / 365);
        case "Appreciation":
            return 1 + r * (t / 365);
        case "Depreciation":
            return 1 - r * (t / 365);
        case "None":
        default:
            return 1;
    }
};

// Helper function to get growth parameters from envelopes
export const get_growth_parameters = (
    envelopes: Record<string, any>,
    from_key?: string,
    to_key?: string
): [Record<string, any>, Record<string, any>] => {
    // Get source growth parameters
    let theta_growth_source: Record<string, any> = { type: "None", r: 0.0 };
    if (from_key && from_key in envelopes) {
        const source_env = envelopes[from_key];
        theta_growth_source = {
            type: source_env.growth_type || "None",
            r: source_env.growth_rate || 0.0
        };
    }

    // Get destination growth parameters
    let theta_growth_destination: Record<string, any> = { type: "None", r: 0.0 };
    if (to_key && to_key in envelopes) {
        const dest_env = envelopes[to_key];
        theta_growth_destination = {
            type: dest_env.growth_type || "None",
            r: dest_env.growth_rate || 0.0
        };
    }

    return [theta_growth_source, theta_growth_destination];
};

// baseFunctions.ts
// f_in: inflow function
export const f_in = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) => params.a * u(t);
};

// f_out: outflow function
export const f_out = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) => -params.b * u(t);
};

// f_com: compound interest - REMOVED (no longer used)
// f_app: appreciation - REMOVED (no longer used)  
// f_dep: depreciation - REMOVED (no longer used)

// Compound salary into 401k - REMOVED (no longer used)

// Mortgage payment calculation - REMOVED (no longer used)

// f_buy_house - REMOVED (no longer used)
// f_buy_car - REMOVED (no longer used)

// f_insurance - REMOVED (no longer used)
// f_maint - REMOVED (no longer used)

// f_empirical - REMOVED (no longer used)
// f_purchase - REMOVED (no longer used)
// f_get_job - REMOVED (no longer used)

// f_get_wage_job - REMOVED (no longer used)

// f_get_bonus - REMOVED (no longer used)
// f_start_business - REMOVED (no longer used)
// f_business_income - REMOVED (no longer used)
// f_retirement - REMOVED (no longer used)
// f_hysa - REMOVED (no longer used)

// Remove all the deprecated override functions
// raise_override, wage_raise_override, update_business_income, update_401k, adjust_depreciation, adjust_mortgage - REMOVED

export const f_sal = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    const net = 1 -
        (params.r_SS + params.r_Med + params.r_Fed + params.r_401k);
    return (t: number) => (params.S / params.p) * net * u(t);
};

// f_wage: wage with deductions
export const f_wage = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    const net = 1 - (params.r_SS + params.r_Med + params.r_Fed + params.r_401k);
    return (t: number) => ((params.w * params.h * 52) / params.p) * net * u(t);
};

// f_com: compound interest - REMOVED (no longer used)
// f_sal: salary with deductions

// f_wage: wage with deductions

// f_com: compound interest - REMOVED (no longer used)

// f_sal: salary with deductions

// f_wage: wage with deductions

export const f_401 = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) => (params.S / params.p) * params.r_401 * u(t);
};

// Mortgage payment calculation - REMOVED (no longer used)

export const f_principal = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number): number => {
        const months = Math.floor(t / (365 / 12));
        const r = params.r;
        const y = params.y;
        const Loan = params.P;
        const default_payment = (Loan * (r / 12) * Math.pow(1 + r / 12, 12 * y)) /
            (Math.pow(1 + r / 12, 12 * y) - 1);
        const p_m = params.p_mortgage ?? default_payment;
        const payment = (Loan * Math.pow(1 + r / 12, months) * (r / 12)) /
            (Math.pow(1 + r / 12, 12 * y) - 1);
        const mortgage_amt = f_mortgage(P({ P: Loan, r, y }), t_i)(t);
        return payment + Math.max(mortgage_amt - p_m, 0);
    };
};

export const f_buy_house = (theta_h: Theta, theta_p: Theta, t_i: number) => {
    const h = theta_h(t_i);
    return (t: number) =>
        f_app(P({ V0: h.H0, r_app: h.r_app }), t_i)(t) -
        (h.H0 - h.D - R(h.t_buy, 365 / 30, h.t_buy + h.y * 365, f_principal, theta_p)(t));
};

export const f_buy_car = (theta_c: Theta, theta_p: Theta, t_i: number) => {
    const c = theta_c(t_i);
    return (t: number) =>
        f_dep(P({ V0: c.C0, r_dep: c.r_dep }), t_i)(t) -
        (c.C0 - c.D - R(c.t_buy, 365 / 12, c.t_buy + c.y * 365, f_principal, theta_p)(t));
};

export const f_mortgage = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (_t: number) =>
        (params.P * (params.r / 12) * Math.pow(1 + params.r / 12, 12 * params.y)) /
        (Math.pow(1 + params.r / 12, 12 * params.y) - 1);
};

export const f_insurance = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) => params.p0 * Math.pow(1 + params.r_adj, t / 365);
};

export const f_maint = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) => params.m0 + params.alpha * (t - params.t0);
};

export const f_inflation_adjust = (
    W: (t: number) => number,
    theta: Theta,
    t_i: number
) => {
    const params = theta(t_i);
    return (t: number) =>
        t >= params.t_today ? W(t) / Math.pow(1 + params.r_inf, (t - params.t_today) / 365) : W(t);
};

export const f_purchase = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return f_out(P({ b: params.m }), t_i);
};

export const f_get_job = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) => R(params.time_start, 365 / params.p, params.time_end, f_sal, theta)(t);
};

// f_get_wage_job: recurring wage payments - REMOVED (no longer used)

export const manual_correction = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const to_key = params.to_key;
    const env = envelopes[to_key];

    let simulated_value = 0.0;
    for (const func of env.functions) {
        simulated_value += func(params.start_time);
    }
    const difference = params.amount - simulated_value;
    console.log("Difference applied:", difference);

    // Get growth parameters from envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, to_key);

    // Create the correction function and append it to the envelope
    const correction_func = T(
        { t_k: params.start_time },
        difference > 0 ? f_in : f_out,
        P(difference > 0 ? { a: Math.abs(difference) } : { b: Math.abs(difference) }),
        theta_growth_dest
    );
    env.functions.push(correction_func);
};

export const transfer_money = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    // Create outflow function for source envelope
    const outflow_func = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.amount }),
        theta_growth_source
    );
    envelopes[params.from_key].functions.push(outflow_func);

    // Create inflow function for destination envelope with growth
    const inflow_func = T(
        { t_k: params.start_time },
        f_in,
        P({ a: params.amount }),
        theta_growth_dest
    );
    envelopes[params.to_key].functions.push(inflow_func);
};

export const reoccuring_income = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for destination envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, params.to_key);

    // Create recurring income function
    const income_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_days },
        f_in,
        P({ a: params.amount }),
        theta_growth_dest
    );

    envelopes[params.to_key].functions.push(income_func);
};

export const reoccuring_spending = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Create recurring spending function
    const spending_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_days },
        f_out,
        P({ b: params.amount }),
        theta_growth_source
    );

    envelopes[params.from_key].functions.push(spending_func);
};

export const reoccuring_transfer = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    // Outflow from source envelope
    const outflow_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_days },
        f_out,
        P({ b: params.amount }),
        theta_growth_source
    );

    envelopes[params.from_key].functions.push(outflow_func);

    // Inflow to destination envelope
    const inflow_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_days },
        f_in,
        P({ a: params.amount }),
        theta_growth_dest
    );
    envelopes[params.to_key].functions.push(inflow_func);
};