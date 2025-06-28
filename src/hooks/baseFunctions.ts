// utilities.ts
import type { Theta, FuncWithTheta } from "./types";

export const u = (t: number): number => (t >= 0 ? 1.0 : 0.0);

export const P = (params: Record<string, any>): Theta => {
    return (_t: number) => params;
};

export const T = (
    theta_event: Record<string, number>,
    f: (params: Record<string, any>, t: number) => number,
    theta: Theta = P({}),
    theta_g: Record<string, any> = { type: "None", r: 0.0 }
): ((t: number) => number) => {
    const t_k = theta_event.t_k;
    const params = theta(t_k); // θ = θ(t_k) - evaluate at t_k

    return (t: number) => f(params, t_k) * u(t - t_k) * f_growth(theta_g, t - t_k);
};

export const R = (
    theta_re: Record<string, number>,
    f: (params: Record<string, any>, t: number) => number,
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

    if (growth_type === "Daily Compound") {
        return Math.pow(1 + r / 365, 365 * t / 365);
    } else if (growth_type === "Monthly Compound") {
        return Math.pow(1 + r / 12, 12 * t / 365);
    } else if (growth_type === "Yearly Compound") {
        return Math.pow(1 + r, t / 365);
    } else if (growth_type === "Simple Interest") {
        return 1 + r * (t / 365);
    } else if (growth_type === "Appreciation") {
        return 1 + r * (t / 365);
    } else if (growth_type === "Depreciation") {
        return 1 - r * (t / 365);
    } else if (growth_type === "None") {
        return 1;
    } else {
        throw new Error(`Unknown growth type: ${growth_type}`);
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
export const f_in = (theta_in: Record<string, any>, t: number): number => {
    return theta_in.a;
};

// f_out: outflow function
export const f_out = (theta_out: Record<string, any>, t: number): number => {
    return -theta_out.b;
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

export const f_principal = (theta: Record<string, any>, t: number): number => {
    const months = Math.floor(t / (365 / 12));
    const r = theta.r;
    const y = theta.y;
    const Loan = theta.P;
    // Calculate default mortgage payment if not provided
    const default_payment = Loan * (r / 12) * Math.pow(1 + r / 12, 12 * y) / (Math.pow(1 + r / 12, 12 * y) - 1);
    const p_m = theta.p_mortgage ?? default_payment;
    const payment = Loan * Math.pow(1 + r / 12, months) * (r / 12) / (Math.pow(1 + r / 12, 12 * y) - 1);
    const mortgage_amt = f_mortgage({ P: Loan, r: r, y: y }, t);
    return payment + Math.max(mortgage_amt - p_m, 0);
};

export const f_mortgage = (theta: Record<string, any>, t: number): number => {
    return theta.P * (theta.r / 12) * Math.pow(1 + theta.r / 12, 12 * theta.y) / (Math.pow(1 + theta.r / 12, 12 * theta.y) - 1);
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
    return R({ t0: theta.time_start, dt: 365 / theta.p, tf: theta.time_end }, f_salary, P(theta), { type: "None", r: 0.0 })(t);
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

// Add missing exports for event functions
export const get_job = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

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
            envelopes[params.to_key].functions.push(
                T({ t_k: upd_params.start_time }, f_in, P({ a: upd_params.bonus }), { type: "None", r: 0.0 })
            );
        }
    }

    // Add salary payments to cash envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(
        R({ t0: params.start_time, dt: 365 / params.pay_period, tf: params.end_time },
            f_salary, theta, { type: "None", r: 0.0 })
    );

    // Add 401(k) contributions if specified
    const contribution_amount = (params.salary / params.pay_period) *
        (params.p_401k_contribution + params.p_401k_match);

    // Get growth parameters from 401k envelope
    const [_, theta_growth_401k] = get_growth_parameters(envelopes, undefined, params.p_401k_key);

    envelopes[params.p_401k_key].functions.push(
        R({ t0: params.start_time, dt: 365 / params.pay_period, tf: params.end_time },
            f_in, P({ a: contribution_amount }), theta_growth_401k)
    );
};

export const get_wage_job = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

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
    const cash_key = params.to_key;
    envelopes[cash_key].functions.push(
        R({ t0: params.start_time, dt: 365 / params.pay_period, tf: params.end_time },
            f_wage, theta, { type: "None", r: 0.0 })
    );

    // Add 401(k) contributions if specified
    const contribution_amount = (params.hourly_wage * params.hours_per_week * 52 / params.pay_period) *
        (params.p_401k_contribution + params.employer_match);

    // Get growth parameters from 401k envelope
    const [_, theta_growth_401k] = get_growth_parameters(envelopes, undefined, params.p_401k_key);

    // Add 401(k) contributions
    envelopes[params.p_401k_key].functions.push(
        R({ t0: params.start_time, dt: 365 / params.pay_period, tf: params.end_time },
            f_in, P({ a: contribution_amount }), theta_growth_401k)
    );
};

export const gift = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters from destination envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, params.to_key);

    envelopes[params.to_key].functions.push(
        T({ t_k: params.start_time }, f_in, P({ a: params.money }), theta_growth_dest)
    );
};

export const start_business = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Initial investment (outflow)
    const initial_investment = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.initial_investment }),
        { type: "None", r: 0.0 }
    );

    // Add initial investment to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(initial_investment);

    // Handle updating events (business income and losses)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "business_income") {
            // Get growth parameters from destination envelope
            const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, upd_params.to_key);

            // Create recurring income function
            const income_func = R(
                { t0: upd_params.start_time, dt: 30, tf: upd_params.end_time },
                f_in,
                P({ a: params.monthly_income }),
                theta_growth_dest
            );
            // Add to target envelope
            const to_key = upd_params.to_key;
            envelopes[to_key].functions.push(income_func);

        } else if (upd_type === "business_loss") {
            // Create one-time loss function
            const loss_func = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: upd_params.loss_amount }),
                { type: "None", r: 0.0 }
            );
            // Add to source envelope
            const from_key = upd_params.from_key;
            envelopes[from_key].functions.push(loss_func);
        }
    }
};

export const retirement = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Create recurring withdrawal function
    const withdrawal_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_out,
        P({ b: params.amount }),
        { type: "None", r: 0.0 }
    );

    // Add withdrawal function to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(withdrawal_func);

    // Create corresponding inflow to target envelope
    const deposit_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_in,
        P({ a: params.amount }),
        { type: "None", r: 0.0 }
    );

    // Add deposit function to target envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(deposit_func);
};

export const buy_house = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Handle downpayment (outflow)
    const downpayment_func = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.downpayment }),
        { type: "None", r: 0.0 }
    );

    // Add downpayment to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(downpayment_func);

    // Create house value tracking function with appreciation
    const house_func = T(
        { t_k: params.start_time },
        f_in,
        P({ a: params.home_value }),
        { type: "Appreciation", r: params.appreciation_rate }
    );

    // Add house value to target envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(house_func);

    // Create mortgage payments
    const loan_amount = params.home_value - params.downpayment;
    const mortgage_func = R(
        { t0: params.start_time, dt: 365 / 12, tf: params.start_time + params.loan_term_years * 365 },
        f_mortgage,
        P({ P: loan_amount, r: params.loan_rate, y: params.loan_term_years }),
        { type: "None", r: 0.0 }
    );

    // Add mortgage payments to source envelope
    envelopes[from_key].functions.push(mortgage_func);

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "new_appraisal") {
            // Update house value with new appraisal
            const new_house_func = T(
                { t_k: upd_params.start_time },
                f_in,
                P({ a: upd_params.appraised_value }),
                { type: "Appreciation", r: params.appreciation_rate }
            );
            envelopes[to_key].functions.push(new_house_func);

        } else if (upd_type === "extra_mortgage_payment") {
            // Handle extra payment
            const extra_payment = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: upd_params.amount }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.from_key].functions.push(extra_payment);

        } else if (upd_type === "late_payment") {
            // Handle late payment
            const late_payment = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: upd_params.amount }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.from_key].functions.push(late_payment);

        } else if (upd_type === "sell_house") {
            // Handle house sale
            const sale_value = T(
                { t_k: upd_params.start_time },
                f_in,
                P({ a: upd_params.sale_price }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.to_key].functions.push(sale_value);

            // Remove house value from tracking
            const house_removal = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: params.home_value }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.from_key].functions.push(house_removal);
        }
    }
};

export const buy_car = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Handle downpayment (outflow)
    const downpayment_func = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.downpayment }),
        { type: "None", r: 0.0 }
    );

    // Add downpayment to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(downpayment_func);

    // Create car value tracking function with depreciation
    const car_func = T(
        { t_k: params.start_time },
        f_in,
        P({ a: params.car_value }),
        { type: "Depreciation", r: 0.15 }
    );

    // Add car value to target envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(car_func);

    // Create car loan payments
    const loan_amount = params.car_value - params.downpayment;
    const loan_func = R(
        { t0: params.start_time, dt: 365 / 12, tf: params.start_time + params.loan_term_years * 365 },
        f_mortgage,
        P({ P: loan_amount, r: params.loan_rate, y: params.loan_term_years }),
        { type: "None", r: 0.0 }
    );

    // Add loan payments to source envelope
    envelopes[from_key].functions.push(loan_func);

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "pay_loan_early") {
            // Handle early loan payment
            const early_payment = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: upd_params.amount }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.from_key].functions.push(early_payment);

        } else if (upd_type === "car_repair") {
            // Handle repair cost
            const repair_cost = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: upd_params.cost }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.from_key].functions.push(repair_cost);
        }
    }
};

export const buy_home_insurance = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Create monthly premium payment function
    const premium_func = R(
        { t0: params.start_time, dt: 30, tf: Infinity },
        f_out,
        P({ b: params.monthly_premium }),
        { type: "None", r: 0.0 }
    );

    // Add premium payments to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(premium_func);

    // Handle updating events (damage events)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "tornado_damage" || upd_type === "house_fire" || upd_type === "flood_damage") {
            // Calculate insurance payout
            const damage_cost = upd_params.damage_cost;
            const coverage = upd_params.insurance_coverage ?? params.coverage_percentage;
            const payout = damage_cost * coverage;

            // Handle deductible (outflow)
            const deductible = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: params.deductible }),
                { type: "None", r: 0.0 }
            );
            envelopes[from_key].functions.push(deductible);

            // Handle insurance payout (inflow)
            if (payout > 0) {
                const payout_func = T(
                    { t_k: upd_params.start_time },
                    f_in,
                    P({ a: payout }),
                    { type: "None", r: 0.0 }
                );
                const to_key = upd_params.to_key ?? from_key;
                envelopes[to_key].functions.push(payout_func);
            }
        }
    }
};

export const have_kid = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Handle initial costs (outflow)
    const initial_costs = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.initial_costs }),
        { type: "None", r: 0.0 }
    );

    // Add initial costs to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(initial_costs);

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "childcare_costs") {
            // Create recurring childcare cost function
            const childcare_func = R(
                { t0: upd_params.start_time, dt: 30, tf: upd_params.start_time + upd_params.end_days },
                f_out,
                P({ b: upd_params.monthly_cost }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.from_key].functions.push(childcare_func);

        } else if (upd_type === "college_fund") {
            // Handle initial college fund contribution
            const initial_contribution = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: upd_params.initial_contribution }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.from_key].functions.push(initial_contribution);

            // Create recurring college fund contribution function
            const contribution_func = R(
                { t0: upd_params.start_time, dt: 30, tf: upd_params.start_time + upd_params.end_days },
                f_out,
                P({ b: upd_params.monthly_contribution }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.from_key].functions.push(contribution_func);

            // Create corresponding inflow to college fund envelope
            const [_, theta_growth_college] = get_growth_parameters(envelopes, undefined, upd_params.to_key);
            const fund_inflow = R(
                { t0: upd_params.start_time, dt: 30, tf: upd_params.start_time + upd_params.end_days },
                f_in,
                P({ a: upd_params.monthly_contribution }),
                theta_growth_college
            );
            envelopes[upd_params.to_key].functions.push(fund_inflow);
        }
    }
};

export const marriage = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Create wedding cost function (outflow)
    const wedding_cost = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.cost }),
        { type: "None", r: 0.0 }
    );

    // Add wedding cost to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(wedding_cost);
};

export const divorce = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Handle settlement payment (outflow)
    const settlement = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.settlement_amount }),
        { type: "None", r: 0.0 }
    );

    // Handle attorney fees (outflow)
    const attorney_fees = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.attorney_fees }),
        { type: "None", r: 0.0 }
    );

    // Add both costs to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(settlement);
    envelopes[from_key].functions.push(attorney_fees);
};

export const pass_away = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const death_time = params.start_time;

    // For each envelope, create a function that returns 0 after death
    for (const [envelope_name, envelope_data] of Object.entries(envelopes)) {
        if ("functions" in envelope_data) {
            // For each function in the envelope, wrap it with D to return 0 after death
            const new_funcs = [];
            for (const func of envelope_data.functions) {
                // Create a function that returns 0 for all time
                const zero_func = (t: number) => 0;
                // Wrap the original function to return 0 after death
                const new_func = (t: number) => t < death_time ? func(t) : 0;
                new_funcs.push(new_func);
            }

            // Replace the envelope's functions with the new ones
            envelopes[envelope_name].functions = new_funcs;
        }
    }
};

export const buy_health_insurance = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Create monthly premium payment function
    const premium_func = R(
        { t0: params.start_time, dt: 30, tf: Infinity },
        f_out,
        P({ b: params.monthly_premium }),
        { type: "None", r: 0.0 }
    );

    // Add premium payments to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(premium_func);

    // Handle updating events (medical expenses)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "medical_expense") {
            // Calculate out-of-pocket cost
            const total_cost = upd_params.total_cost;
            const deductible = upd_params.deductible ?? params.deductible;
            const coverage = upd_params.insurance_coverage ?? params.coverage_percentage;

            // Handle deductible (outflow)
            if (deductible > 0) {
                const deductible_func = T(
                    { t_k: upd_params.start_time },
                    f_out,
                    P({ b: deductible }),
                    { type: "None", r: 0.0 }
                );
                envelopes[upd_params.from_key].functions.push(deductible_func);
            }

            // Handle remaining out-of-pocket cost
            const remaining_cost = total_cost - deductible;
            const out_of_pocket = remaining_cost * (1 - coverage);
            if (out_of_pocket > 0) {
                const out_of_pocket_func = T(
                    { t_k: upd_params.start_time },
                    f_out,
                    P({ b: out_of_pocket }),
                    { type: "None", r: 0.0 }
                );
                envelopes[upd_params.from_key].functions.push(out_of_pocket_func);
            }
        }
    }
};

export const buy_life_insurance = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Create monthly premium payment function
    const premium_func = R(
        { t0: params.start_time, dt: 30, tf: params.start_time + params.term_years * 365 },
        f_out,
        P({ b: params.monthly_premium }),
        { type: "None", r: 0.0 }
    );

    // Add premium payments to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(premium_func);

    // Handle updating events (coverage changes)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "increase_coverage") {
            // Create new premium payment function with updated amount
            const new_premium_func = R(
                { t0: upd_params.start_time, dt: 30, tf: params.start_time + params.term_years * 365 },
                f_out,
                P({ b: params.new_monthly_premium }),
                { type: "None", r: 0.0 }
            );
            envelopes[from_key].functions.push(new_premium_func);
        }
    }
};

export const receive_government_aid = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Create recurring payment function
    const aid_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.start_time + params.end_days },
        f_in,
        P({ a: params.amount }),
        { type: "None", r: 0.0 }
    );

    // Add aid payments to target envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(aid_func);
};

export const invest_money = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Handle initial investment (outflow)
    const initial_investment = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.amount }),
        { type: "None", r: 0.0 }
    );

    // Add initial investment to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(initial_investment);

    // Get growth parameters from destination envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, params.to_key);

    // Create investment growth function
    const investment_func = T(
        { t_k: params.start_time },
        f_in,
        P({ a: params.amount }),
        theta_growth_dest
    );

    // Add investment growth to target envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(investment_func);

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "Reoccuring Dividend Payout") {
            // Handle dividend payments
            const dividend_func = T(
                { t_k: upd_params.start_time },
                f_in,
                P({ a: params.amount }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.to_key].functions.push(dividend_func);

        } else if (upd_type === "Reoccuring Contribution") {
            // Handle recurring contributions
            const contribution_func = R(
                { t0: upd_params.start_time, dt: 30, tf: upd_params.end_time },
                f_out,
                P({ b: params.amount }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.from_key].functions.push(contribution_func);

            // Add corresponding investment growth
            const new_investment_func = T(
                { t_k: upd_params.start_time },
                f_in,
                P({ a: upd_params.amount }),
                theta_growth_dest
            );
            envelopes[to_key].functions.push(new_investment_func);
        }
    }
};

export const high_yield_savings_account = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Handle initial deposit (outflow)
    const initial_deposit = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.amount }),
        { type: "None", r: 0.0 }
    );

    // Add initial deposit to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(initial_deposit);

    // Get growth parameters from destination envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, params.to_key);

    // Create savings growth function with daily compounding
    const savings_func = T(
        { t_k: params.start_time },
        f_in,
        P({ a: params.amount }),
        theta_growth_dest
    );

    // Add savings growth to target envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(savings_func);
};

export const pay_taxes = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Handle tax payment (outflow)
    const tax_payment = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.total_tax_due }),
        { type: "None", r: 0.0 }
    );

    // Add tax payment to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(tax_payment);

    // Handle updating events (tax refunds)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "receive_tax_refund") {
            // Handle tax refund (inflow)
            const refund_func = T(
                { t_k: upd_params.start_time },
                f_in,
                P({ a: params.amount }),
                { type: "None", r: 0.0 }
            );
            envelopes[upd_params.to_key].functions.push(refund_func);
        }
    }
};

export const buy_groceries = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Create recurring monthly grocery payment function
    const grocery_func = R(
        { t0: params.start_time, dt: 30, tf: params.start_time + params.end_days },
        f_out,
        P({ b: params.monthly_amount }),
        { type: "None", r: 0.0 }
    );

    // Add grocery payments to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(grocery_func);

    // Handle updating events (amount changes)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "update_amount") {
            // Create new payment function with updated amount
            const new_grocery_func = R(
                { t0: upd_params.start_time, dt: 30, tf: params.start_time + params.end_days },
                f_out,
                P({ b: params.new_amount }),
                { type: "None", r: 0.0 }
            );
            envelopes[from_key].functions.push(new_grocery_func);
        }
    }
};

export const purchase = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    console.log("Event params", event);
    // Create a one-time outflow function for the purchase
    const purchase_func = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.money }),
        { type: "None", r: 0.0 }
    );

    // Add the purchase function to the specified envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(purchase_func);
}; 