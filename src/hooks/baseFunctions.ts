// utilities.ts
import type { Theta, FuncWithTheta } from "./types";

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

export const R = (
    theta_re: Record<string, number>,
    f: (params: Record<string, any>, t: number) => number,
    theta: Theta,
    theta_g: Record<string, any>,
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
    thetaChange: Record<string, number>,
    tStar: number
): Theta => {
    return (t: number) =>
        t < tStar ? theta(t) : { ...theta(t), ...thetaChange };
};

export const inflationAdjust = (
    base: number,
    inflation_rate: number,
    start_time: number
) => (t: number) =>
        base * Math.pow(1 + inflation_rate, (t - start_time) / 365);

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
        return Math.max(0, Math.pow(1 - r, t / 365));
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

export const f_principal_payment = (theta: Record<string, any>, t: number): number => {
    const months = Math.floor(t / (365 / 12));
    const r = theta.r;
    const y = theta.y;
    const Loan = theta.P;
    // Calculate default mortgage payment if not provided
    const default_payment = Loan * (r / 12) * Math.pow(1 + r / 12, 12 * y) / (Math.pow(1 + r / 12, 12 * y) - 1);
    const p_m = theta.p_mortgage ?? default_payment;
    const payment = Loan * Math.pow(1 + r / 12, months) * (r / 12) / (Math.pow(1 + r / 12, 12 * y) - 1);
    const mortgage_amt = f_monthly_payment({ P: Loan, r: r, y: y }, t);
    const principle_payment = payment - Math.max(mortgage_amt - p_m, 0);
    return principle_payment;
};

export const f_monthly_payment = (theta: Record<string, any>, t: number): number => {
    if (theta.r === 0) {
        return +(theta.P / (12 * theta.y)).toFixed(2);
    }
    return +(
        -theta.P * (theta.r / 12) * Math.pow(1 + theta.r / 12, 12 * theta.y) /
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
    return R({ t0: theta.time_start, dt: 365 / theta.p, tf: theta.time_end }, f_salary, P(theta), { type: "None", r: 0.0 })(t);
};

export const outflow = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source] = get_growth_parameters(envelopes, params.from_key);

    //See if event is reoccuring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create a recurring outflow function for the purchase
        const outflow_func = R(
            { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
            f_out,
            P({ b: params.amount }),
            theta_growth_source
        );
        // Add the purchase function to the specified envelope
        envelopes[params.from_key].functions.push(outflow_func);
    } else {
        // Create a one-time outflow function for the purchase

        // Create a one-time outflow function for the purchase
        const purchase_func = T(
            { t_k: params.start_time },
            f_out,
            P({ b: params.amount }),
            theta_growth_source
        );

        // Add the purchase function to the specified envelope
        const from_key = params.from_key;
        envelopes[from_key].functions.push(purchase_func);
    }
};

export const inflow = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_dest] = get_growth_parameters(envelopes, params.to_key);

    //See if event is reoccuring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create a recurring inflow function for the purchase
        const inflow_func = R(
            { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
            f_in,
            P({ a: params.amount }),
            theta_growth_dest
        );
        // Add the purchase function to the specified envelope
        envelopes[params.to_key].functions.push(inflow_func);
    } else {
        // Create a one-time inflow function for the purchase
        const inflow_func = T(
            { t_k: params.start_time },
            f_in,
            P({ a: params.amount }),
            theta_growth_dest
        );

        // Add the purchase function to the specified envelope
        envelopes[params.to_key].functions.push(inflow_func);
    }
}

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


// Estimate taxes owed based on simplified parameters
export const estimate_taxes = (params: Record<string, any>): number => {
    // Basic taxable income: salary + capital gains - deductions - retirement contributions - (dependents * 2000 credit)
    const yearly_income = params.yearly_income || 0;
    const capital_gains = params.capital_gains || 0;
    const retirement_contributions = params.retirement_contributions || 0;
    const itemized_deductions = params.itemized_deductions || 0;
    const number_of_dependents = params.number_of_dependents || 0;
    const dependent_credit = 2000; // per dependent, rough estimate
    const federal_tax_rate = params.federal_tax_rate || 0.12;
    const state_tax_rate = params.state_tax_rate || 0.05;
    const federal_income_tax_withheld = params.federal_income_tax_withheld || 0;
    const state_income_tax_withheld = params.state_income_tax_withheld || 0;

    // Taxable income
    let taxable_income = yearly_income + capital_gains - retirement_contributions - itemized_deductions;
    if (taxable_income < 0) taxable_income = 0;

    // Estimate total tax before credits
    let total_tax = taxable_income * (federal_tax_rate + state_tax_rate);

    // Subtract dependent credits (roughly)
    total_tax -= number_of_dependents * dependent_credit;
    if (total_tax < 0) total_tax = 0;

    // Subtract withheld taxes
    total_tax -= federal_income_tax_withheld;
    total_tax -= state_income_tax_withheld;

    return total_tax;
};


// Declare initial balances for up to five envelopes at a specific time
export const declare_accounts = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    for (let i = 1; i <= 5; i++) {
        const amountKey = `amount${i}`;
        const envelopeKey = `envelope${i}`;
        if (params[envelopeKey] && envelopes[params[envelopeKey]]) {
            const to_key = params[envelopeKey];
            const env = envelopes[to_key];
            let simulated_value = 0.0;
            for (const func of env.functions) {
                simulated_value += func(params.start_time);
            }
            const difference = params[amountKey] - simulated_value;
            console.log(`Difference applied to ${to_key}:`, difference);
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
        }
    }
};

export const transfer_money = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create recurring outflow function for source envelope
        const outflow_func = R(
            { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
            f_out,
            P({ b: params.amount }),
            theta_growth_source
        );
        envelopes[params.from_key].functions.push(outflow_func);

        // Create recurring inflow function for destination envelope
        const inflow_func = R(
            { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
            f_in,
            P({ a: params.amount }),
            theta_growth_dest
        );
        envelopes[params.to_key].functions.push(inflow_func);
    } else {
        // Create one-time outflow function for source envelope
        const outflow_func = T(
            { t_k: params.start_time },
            f_out,
            P({ b: params.amount }),
            theta_growth_source
        );
        envelopes[params.from_key].functions.push(outflow_func);

        // Create one-time inflow function for destination envelope
        const inflow_func = T(
            { t_k: params.start_time },
            f_in,
            P({ a: params.amount }),
            theta_growth_dest
        );
        envelopes[params.to_key].functions.push(inflow_func);
    }
};

export const income_with_changing_parameters = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

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

    // Create recurring income function
    const income_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_in,
        theta,
        theta_growth_dest
    );

    envelopes[params.to_key].functions.push(income_func);
};

export const reoccuring_spending_inflation_adjusted = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for destination envelope
    const [theta_growth_source,] = get_growth_parameters(envelopes, params.from_key);

    // Create recurring spending function with inflation adjustment
    const spending_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_out,
        P({ b: inflationAdjust(params.amount, envelopes.simulation_settings.inflation_rate, params.start_time) }),
        theta_growth_source
    );

    envelopes[params.from_key].functions.push(spending_func);
};

export const loan_amortization = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source and destination envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    // console.log("Loan interest rate: ", params.interest_rate);
    // console.log("Loan term years: ", params.loan_term_years);
    // console.log("Principal: ", params.principal);
    // const monthly_payment = f_monthly_payment({ P: params.principal, r: params.interest_rate, y: params.loan_term_years }, params.start_time);
    // console.log("Monthly payment: ", monthly_payment);

    // Take out loan so add the amount recieved to cash and the debit to the debt
    const recieved_loan = T(
        { t_k: params.start_time },
        f_in,
        P({ a: params.principal }),
        theta_growth_dest
    );
    envelopes[params.to_key].functions.push(recieved_loan);

    const loan_debit = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.principal }),
        theta_growth_source
    );
    envelopes[params.from_key].functions.push(loan_debit);

    // Now pay off the loan in an amortization schedule, aply principle payments to the debt
    const loan_amortization = R(
        { t0: params.start_time + 30, dt: 365 / 12, tf: params.start_time + params.loan_term_years * 365 },
        f_principal_payment,
        P({ P: params.principal, r: params.interest_rate, y: params.loan_term_years }),
        theta_growth_source
    );
    envelopes[params.from_key].functions.push(loan_amortization);

    // Pay each monthly payment both the interest and the principle
    const payments_func = R(
        { t0: params.start_time + 30, dt: 365 / 12, tf: params.start_time + params.loan_term_years * 365 },
        f_monthly_payment,
        P({ P: params.principal, r: params.interest_rate, y: params.loan_term_years }),
        theta_growth_dest
    );

    envelopes[params.to_key].functions.push(payments_func);

    // --- Loan Envelope Correction at End of Payment Cycle ---
    const loan_end_time = params.start_time + params.loan_term_years * 365;
    const loanEnvelope = envelopes[params.from_key];
    let loan_balance = 0.0;
    for (const func of loanEnvelope.functions) {
        loan_balance += func(loan_end_time);
    }
    if (Math.abs(loan_balance) > 1e-6) {
        const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
            envelopes, params.from_key, params.to_key
        );
        const correction_inflow = T(
            { t_k: loan_end_time },
            f_in,
            P({ a: Math.abs(loan_balance) }),
            theta_growth_dest
        );
        loanEnvelope.functions.push(correction_inflow);
        const correction_outflow = T(
            { t_k: loan_end_time },
            f_out,
            P({ b: Math.abs(loan_balance) }),
            theta_growth_source
        );
        envelopes[params.to_key].functions.push(correction_outflow);
    }
};

export const loan = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source and destination envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    const loan_interest_rate = theta_growth_source.r;
    // console.log("Loan interest rate: ", loan_interest_rate);
    const end_time = params.start_time + params.loan_term_years * 365;
    // console.log("Start time: ", params.start_time);
    // console.log("End time: ", end_time);
    // console.log("Loan term years: ", params.loan_term_years);
    // console.log("Principal: ", params.principal);
    // const monthly_payment = f_monthly_payment({ P: params.principal, r: loan_interest_rate, y: params.loan_term_years }, params.start_time);
    // console.log("Monthly payment: ", monthly_payment);

    // Take out loan so add the amount recieved to cash and the debit to the debt
    const recieved_loan = T(
        { t_k: params.start_time },
        f_in,
        P({ a: params.principal }),
        theta_growth_dest
    );
    envelopes[params.to_key].functions.push(recieved_loan);

    const loan_debit = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.principal }),
        theta_growth_source
    );
    envelopes[params.from_key].functions.push(loan_debit);

    // Now pay off the loan in a reoccuring schedule of monthly payments
    const loan_amortization = R(
        { t0: params.start_time + 30, dt: 365 / 12, tf: params.start_time + params.loan_term_years * 365 },
        f_monthly_payment,
        P({ P: -params.principal, r: loan_interest_rate, y: params.loan_term_years }),
        theta_growth_source
    );
    envelopes[params.from_key].functions.push(loan_amortization);

    // Pay each monthly payment both the interest and the principle
    const payments_func = R(
        { t0: params.start_time + 30, dt: 365 / 12, tf: params.start_time + params.loan_term_years * 365 },
        f_monthly_payment,
        P({ P: params.principal, r: loan_interest_rate, y: params.loan_term_years }),
        theta_growth_dest
    );

    envelopes[params.to_key].functions.push(payments_func);

    // --- Loan Envelope Correction at End of Payment Cycle ---
    const loan_end_time = params.start_time + params.loan_term_years * 365;
    const loanEnvelope = envelopes[params.from_key];
    let loan_balance = 0.0;
    for (const func of loanEnvelope.functions) {
        loan_balance += func(loan_end_time);
    }
    console.log("Loan balance: ", loan_balance);
    if (Math.abs(loan_balance)) {
        const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
            envelopes, params.from_key, params.to_key
        );
        const correction_inflow = T(
            { t_k: loan_end_time },
            f_out,
            P({ b: loan_balance }),
            theta_growth_source
        );
        loanEnvelope.functions.push(correction_inflow);
        const correction_outflow = T(
            { t_k: loan_end_time },
            f_in,
            P({ a: loan_balance }),
            theta_growth_dest
        );
        envelopes[params.to_key].functions.push(correction_outflow);
    }
};


export const purchase = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create a recurring outflow function for the purchase
        const purchase_func = R(
            { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
            f_out,
            P({ b: params.money }),
            theta_growth_source
        );
        // Add the purchase function to the specified envelope
        envelopes[params.from_key].functions.push(purchase_func);
    } else {
        // Create a one-time outflow function for the purchase
        const purchase_func = T(
            { t_k: params.start_time },
            f_out,
            P({ b: params.money }),
            theta_growth_source
        );
        // Add the purchase function to the specified envelope
        envelopes[params.from_key].functions.push(purchase_func);
    }
};


export const gift = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters from destination envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, params.to_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create a recurring gift function
        const gift_func = R(
            { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
            f_in,
            P({ a: params.money }),
            theta_growth_dest
        );
        // Add the gift function to the specified envelope
        envelopes[params.to_key].functions.push(gift_func);
    } else {
        // Create a one-time gift function
        const gift_func = T(
            { t_k: params.start_time },
            f_in,
            P({ a: params.money }),
            theta_growth_dest
        );
        // Add the gift function to the specified envelope
        envelopes[params.to_key].functions.push(gift_func);
    }
};


export const monthly_budgeting = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const from_key = params.from_key;
    const start_time = params.start_time;
    const end_time = params.end_time;
    const inflation_rate = envelopes.simulation_settings.inflation_rate; // Default 2% if not provided

    // List of parameter keys to skip (not budget categories)
    const skip_keys = new Set(["start_time", "end_time", "from_key", "inflation_rate"]);

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, from_key);

    // For each budget category, create a recurring outflow
    Object.keys(params).forEach(key => {
        if (!skip_keys.has(key) && typeof params[key] === "number" && params[key] > 0) {
            // Allow for inflation adjustment by passing a function for b
            const theta = P({
                b: inflationAdjust(params[key], inflation_rate, start_time)
            });
            const outflow_func = R(
                { t0: start_time, dt: params.frequency_days, tf: end_time },
                f_out,
                theta,
                theta_growth_source
            );
            envelopes[from_key].functions.push(outflow_func);
        }
    });
};

// Add missing exports for event functions
export const get_job = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest, theta_growth_taxable_income, theta_growth_penalty_401k, theta_growth_taxes_401k] = get_growth_parameters(
        envelopes, params.from_key, params.to_key, params.taxable_income_key, params.penalty_401k_key, params.taxes_401k_key
    );

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
                T({ t_k: upd_params.start_time }, f_in, P({ a: upd_params.bonus }), theta_growth_dest)
            );
        }
    }

    // Add salary payments to cash envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(
        R({ t0: params.start_time, dt: 365 / params.pay_period, tf: params.end_time },
            f_salary, theta, theta_growth_dest)
    );

    // Add salary income to taxable income envelope
    envelopes[params.taxable_income_key].functions.push(
        R({ t0: params.start_time, dt: 365 / params.pay_period, tf: params.end_time },
            f_in, P({ a: params.salary / params.pay_period }), theta_growth_taxable_income)
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
            const withholding_amount = (params.salary / params.pay_period) * config.rate;
            envelopes[config.key].functions.push(
                R({ t0: params.start_time, dt: 365 / params.pay_period, tf: params.end_time },
                    f_in, P({ a: withholding_amount }), theta_growth_withholding)
            );
        }
    }
};

export const get_wage_job = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

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
            f_wage, theta, theta_growth_dest)
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


export const buy_house = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for from_key, to_key, and mortgage_envelope
    const [theta_growth_source, theta_growth_dest, theta_growth_mortgage] = get_growth_parameters(
        envelopes, params.from_key, params.to_key, params.mortgage_envelope
    );

    // // Handle downpayment (outflow)
    const downpayment_func = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.downpayment }),
        theta_growth_source
    );
    // Add downpayment to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(downpayment_func);

    console.log("to_key: ", params.to_key);
    // Create house value tracking function with appreciation
    const house_func = T(
        { t_k: params.start_time },
        f_in,
        P({ a: params.home_value }),
        theta_growth_dest
    );
    // Add house value to target envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(house_func);


    // Take on loan amount on the mortgage envelope
    const loan_amount = params.home_value - params.downpayment;
    const loan_func = T(
        { t_k: params.start_time },
        f_out,
        P({ b: loan_amount }),
        theta_growth_mortgage
    );
    envelopes[params.mortgage_envelope].functions.push(loan_func);

    // Create mortgage payments to the mortgage envelope tracking the principle payments
    const mortgage_func = R(
        { t0: params.start_time + 30, dt: 365 / 12, tf: params.start_time + params.loan_term_years * 365 },
        f_principal_payment,
        P({ P: loan_amount, r: params.loan_rate, y: params.loan_term_years }),
        theta_growth_mortgage
    );
    // Add mortgage payments to mortgage envelope
    envelopes[params.mortgage_envelope].functions.push(mortgage_func);

    // Pay the morgage from the source envelope
    const mortgage_func_source = R(
        { t0: params.start_time + 30, dt: 365 / 12, tf: params.start_time + params.loan_term_years * 365 },
        f_monthly_payment,
        P({ P: loan_amount, r: params.loan_rate, y: params.loan_term_years }),
        theta_growth_source
    );
    // Add mortgage payments to source envelope
    envelopes[params.from_key].functions.push(mortgage_func_source);

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
    if (params.property_tax_rate && params.from_key) {
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
            let houseValue = 0.0;
            for (const func of houseEnvelope.functions) {
                houseValue += func(yearStartDay);
            }
            // Calculate annual property tax
            const annualPropertyTax = houseValue * params.property_tax_rate;

            if (annualPropertyTax > 0) {
                // Create a recurring monthly outflow for property tax/12
                const propertyTaxFunc = R(
                    { t0: yearStartDay, dt: 30, tf: yearStartDay + 330 }, // 12 payments, approx monthly
                    f_out,
                    P({ b: annualPropertyTax / 12 }),
                    theta_growth_cash
                );
                envelopes[params.from_key].functions.push(propertyTaxFunc);
            }
        });
    }

    // --- Mortgage Envelope Correction at End of Payment Cycle ---
    // Evaluate the mortgage envelope at the end of the payment cycle and correct any remaining balance
    const mortgage_end_time = params.start_time + params.loan_term_years * 365;
    const mortgageEnvelope = envelopes[params.mortgage_envelope];
    let mortgage_balance = 0.0;
    for (const func of mortgageEnvelope.functions) {
        mortgage_balance += func(mortgage_end_time);
    }
    if (Math.abs(mortgage_balance) > 1e-6) { // Only correct if not already zero (allowing for floating point error)
        // Get growth parameters for both envelopes
        const [theta_growth_source, theta_growth_mortgage] = get_growth_parameters(
            envelopes, params.from_key, params.mortgage_envelope
        );
        // Create correction inflow to mortgage envelope
        const correction_inflow = T(
            { t_k: mortgage_end_time },
            f_in,
            P({ a: Math.abs(mortgage_balance) }),
            theta_growth_mortgage
        );
        mortgageEnvelope.functions.push(correction_inflow);
        // Create correction outflow from source envelope
        const correction_outflow = T(
            { t_k: mortgage_end_time },
            f_out,
            P({ b: Math.abs(mortgage_balance) }),
            theta_growth_source
        );
        envelopes[params.from_key].functions.push(correction_outflow);
    }
};

export const buy_car = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, theta_growth_dest, theta_growth_debt] = get_growth_parameters(envelopes, params.from_key, params.to_key, params.car_loan_envelope);

    // Handle downpayment (outflow)
    const downpayment_func = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.downpayment }),
        theta_growth_source
    );

    // Add downpayment to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(downpayment_func);

    // Create car value tracking function with depreciation
    const car_func = T(
        { t_k: params.start_time },
        f_in,
        P({ a: params.car_value }),
        theta_growth_dest
    );

    // Add car value to target envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(car_func);

    // Take the loan of the car in as debt
    const loan_func = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.car_value - params.downpayment }),
        theta_growth_debt
    );
    envelopes[params.car_loan_envelope].functions.push(loan_func);

    // Create car loan payments
    const loan_amount = params.car_value - params.downpayment;
    const loan_payment_func = R(
        { t0: params.start_time + 30, dt: 365 / 12, tf: params.start_time + params.loan_term_years * 365 },
        f_monthly_payment,
        P({ P: loan_amount, r: params.loan_rate, y: params.loan_term_years }),
        theta_growth_source
    );

    // Add loan payments to source envelope
    envelopes[from_key].functions.push(loan_payment_func);

    // Create car loan payments to the mortgage envelope tracking the principle payments
    const car_loan_func = R(
        { t0: params.start_time + 30, dt: 365 / 12, tf: params.start_time + params.loan_term_years * 365 },
        f_principal_payment,
        P({ P: loan_amount, r: params.loan_rate, y: params.loan_term_years }),
        theta_growth_debt
    );
    // Add mortgage payments to mortgage envelope
    envelopes[params.car_loan_envelope].functions.push(car_loan_func);

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "pay_loan_early") {
        } else if (upd_type === "car_repair") {
        }
    }

    // --- Car Loan Envelope Correction at End of Payment Cycle ---
    const car_loan_end_time = params.start_time + params.loan_term_years * 365;
    const carLoanEnvelope = envelopes[params.car_loan_envelope];
    let car_loan_balance = 0.0;
    for (const func of carLoanEnvelope.functions) {
        car_loan_balance += func(car_loan_end_time);
    }
    if (Math.abs(car_loan_balance) > 1e-6) {
        const [theta_growth_source, theta_growth_debt] = get_growth_parameters(
            envelopes, params.from_key, params.car_loan_envelope
        );
        const correction_inflow = T(
            { t_k: car_loan_end_time },
            f_in,
            P({ a: Math.abs(car_loan_balance) }),
            theta_growth_debt
        );
        carLoanEnvelope.functions.push(correction_inflow);
        const correction_outflow = T(
            { t_k: car_loan_end_time },
            f_out,
            P({ b: Math.abs(car_loan_balance) }),
            theta_growth_source
        );
        envelopes[params.from_key].functions.push(correction_outflow);
    }
};


export const pass_away = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const death_time = params.start_time;

    // For each envelope, calculate the value at death_time and add a correction to bring it to zero
    for (const [envelope_name, envelope_data] of Object.entries(envelopes)) {
        if ("functions" in envelope_data) {
            let simulated_value = 0.0;
            for (const func of envelope_data.functions) {
                simulated_value += func(death_time);
            }
            const difference = 0 - simulated_value;
            // Get growth parameters from envelope
            const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, envelope_name);
            // Create the correction function and append it to the envelope
            const correction_func = T(
                { t_k: death_time + 1 },
                difference > 0 ? f_in : f_out,
                P(difference > 0 ? { a: Math.abs(difference) } : { b: Math.abs(difference) }),
                theta_growth_dest
            );
            envelope_data.functions.push(correction_func);
        }
    }
};

export const pay_taxes = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    // Handle tax payment (outflow)
    const tax_payment = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.total_tax_due }),
        theta_growth_source
    );

    // Add tax payment to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(tax_payment);

    // Handle updating events (tax refunds)
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "receive_tax_refund") {
            // Get growth parameters for destination envelope
            const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, upd_params.to_key);

            // Handle tax refund (inflow)
            const refund_func = T(
                { t_k: upd_params.start_time },
                f_in,
                P({ a: upd_params.amount }),
                theta_growth_dest
            );
            envelopes[upd_params.to_key].functions.push(refund_func);
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
    const initial_investment = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.initial_investment }),
        theta_growth_source
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
            // Get growth parameters from source envelope
            const [theta_growth_source, _] = get_growth_parameters(envelopes, upd_params.from_key);

            // Create one-time loss function
            const loss_func = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: upd_params.loss_amount }),
                theta_growth_source
            );
            // Add to source envelope
            const from_key = upd_params.from_key;
            envelopes[from_key].functions.push(loss_func);
        }
    }
};


export const buy_home_insurance = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Create monthly premium payment function
    const premium_func = R(
        { t0: params.start_time, dt: 30, tf: Infinity },
        f_out,
        P({ b: params.monthly_premium }),
        theta_growth_source
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

            // Get growth parameters for both envelopes
            const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
                envelopes, from_key, upd_params.to_key ?? from_key
            );

            // Handle deductible (outflow)
            const deductible = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: params.deductible }),
                theta_growth_source
            );
            envelopes[from_key].functions.push(deductible);

            // Handle insurance payout (inflow)
            if (payout > 0) {
                const payout_func = T(
                    { t_k: upd_params.start_time },
                    f_in,
                    P({ a: payout }),
                    theta_growth_dest
                );
                const to_key = upd_params.to_key ?? from_key;
                envelopes[to_key].functions.push(payout_func);
            }
        }
    }
};

export const have_kid = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const from_key = params.from_key;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create a recurring initial costs function
        const initial_costs = R(
            { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
            f_out,
            P({ b: params.initial_costs }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(initial_costs);
    } else {
        // Handle initial costs (one-time outflow)
        const initial_costs = T(
            { t_k: params.start_time },
            f_out,
            P({ b: params.initial_costs }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(initial_costs);
    }

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "childcare_costs") {
            // Get growth parameters from source envelope
            const [theta_growth_source, _] = get_growth_parameters(envelopes, upd_params.from_key);

            // Create recurring childcare cost function
            const childcare_func = R(
                { t0: upd_params.start_time, dt: 30, tf: upd_params.start_time + upd_params.end_time },
                f_out,
                P({ b: upd_params.monthly_cost }),
                theta_growth_source
            );
            envelopes[upd_params.from_key].functions.push(childcare_func);

        } else if (upd_type === "college_fund") {
            // Get growth parameters for both envelopes
            const [theta_growth_source, theta_growth_college] = get_growth_parameters(
                envelopes, upd_params.from_key, upd_params.to_key
            );

            // Handle initial college fund contribution
            const initial_contribution = T(
                { t_k: upd_params.start_time },
                f_out,
                P({ b: upd_params.initial_contribution }),
                theta_growth_source
            );
            envelopes[upd_params.from_key].functions.push(initial_contribution);

            // Create recurring college fund contribution function
            const contribution_func = R(
                { t0: upd_params.start_time, dt: 30, tf: upd_params.start_time + upd_params.end_time },
                f_out,
                P({ b: upd_params.monthly_contribution }),
                theta_growth_source
            );
            envelopes[upd_params.from_key].functions.push(contribution_func);

            // Create corresponding inflow to college fund envelope
            const fund_inflow = R(
                { t0: upd_params.start_time, dt: 30, tf: upd_params.start_time + upd_params.end_time },
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

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Create wedding cost function (outflow)
    const wedding_cost = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.cost }),
        theta_growth_source
    );

    // Add wedding cost to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(wedding_cost);
};

export const divorce = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Handle settlement payment (outflow)
    const settlement = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.settlement_amount }),
        theta_growth_source
    );

    // Handle attorney fees (outflow)
    const attorney_fees = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.attorney_fees }),
        theta_growth_source
    );

    // Add both costs to source envelope
    const from_key = params.from_key;
    envelopes[from_key].functions.push(settlement);
    envelopes[from_key].functions.push(attorney_fees);
};

export const buy_health_insurance = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Create monthly premium payment function
    const premium_func = R(
        { t0: params.start_time, dt: 30, tf: Infinity },
        f_out,
        P({ b: params.monthly_premium }),
        theta_growth_source
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

            // Get growth parameters from source envelope
            const [theta_growth_source, _] = get_growth_parameters(envelopes, upd_params.from_key);

            // Handle deductible (outflow)
            if (deductible > 0) {
                const deductible_func = T(
                    { t_k: upd_params.start_time },
                    f_out,
                    P({ b: deductible }),
                    theta_growth_source
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
                    theta_growth_source
                );
                envelopes[upd_params.from_key].functions.push(out_of_pocket_func);
            }
        }
    }
};

export const buy_life_insurance = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    // Create monthly premium payment function
    const premium_func = R(
        { t0: params.start_time, dt: 30, tf: params.start_time + params.term_years * 365 },
        f_out,
        P({ b: params.monthly_premium }),
        theta_growth_source
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
                theta_growth_source
            );
            envelopes[from_key].functions.push(new_premium_func);
        }
    }
};

export const receive_government_aid = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for destination envelope
    const [_, theta_growth_dest] = get_growth_parameters(envelopes, undefined, params.to_key);

    // Create recurring payment function
    const aid_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.start_time + params.end_time },
        f_in,
        P({ a: params.amount }),
        theta_growth_dest
    );

    // Add aid payments to target envelope
    const to_key = params.to_key;
    envelopes[to_key].functions.push(aid_func);
};

export const invest_money = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const from_key = params.from_key;
    const to_key = params.to_key;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create recurring investment functions
        const initial_investment = R(
            { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
            f_out,
            P({ b: params.amount }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(initial_investment);

        // Create recurring investment growth function
        const investment_func = R(
            { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
            f_in,
            P({ a: params.amount }),
            theta_growth_dest
        );
        envelopes[to_key].functions.push(investment_func);
    } else {
        // Handle one-time investment (original logic)
        const initial_investment = T(
            { t_k: params.start_time },
            f_out,
            P({ b: params.amount }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(initial_investment);

        // Create investment growth function
        const investment_func = T(
            { t_k: params.start_time },
            f_in,
            P({ a: params.amount }),
            theta_growth_dest
        );
        envelopes[to_key].functions.push(investment_func);
    }

    // Handle updating events
    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "Reoccuring Dividend Payout") {
            // Handle dividend payments
            const dividend_func = R(
                { t0: upd_params.start_time, dt: upd_params.frequency_days, tf: upd_params.end_time },
                f_in,
                P({ a: upd_params.amount }),
                theta_growth_dest
            );
            envelopes[to_key].functions.push(dividend_func);

        } else if (upd_type === "Reoccuring Contribution") {
            // Handle recurring contributions
            const contribution_func = R(
                { t0: upd_params.start_time, dt: upd_params.frequency_days, tf: upd_params.end_time },
                f_out,
                P({ b: upd_params.amount }),
                theta_growth_source
            );
            envelopes[from_key].functions.push(contribution_func);

            // Add corresponding investment growth
            const new_investment_func = R(
                { t0: upd_params.start_time, dt: upd_params.frequency_days, tf: upd_params.end_time },
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
    const from_key = params.from_key;
    const to_key = params.to_key;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create recurring deposits to savings account
        const initial_deposit = R(
            { t0: params.start_time, dt: params.frequency_days || 30, tf: params.end_time || params.start_time + 3650 },
            f_out,
            P({ b: params.amount }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(initial_deposit);

        // Create recurring savings growth function
        const savings_func = R(
            { t0: params.start_time, dt: params.frequency_days || 30, tf: params.end_time || params.start_time + 3650 },
            f_in,
            P({ a: params.amount }),
            theta_growth_dest
        );
        envelopes[to_key].functions.push(savings_func);
    } else {
        // Handle one-time account opening and initial deposit
        const initial_deposit = T(
            { t_k: params.start_time },
            f_out,
            P({ b: params.amount }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(initial_deposit);

        // Create one-time savings growth function
        const savings_func = T(
            { t_k: params.start_time },
            f_in,
            P({ a: params.amount }),
            theta_growth_dest
        );
        envelopes[to_key].functions.push(savings_func);
    }
};

export const buy_groceries = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const from_key = params.from_key;

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, params.from_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create recurring monthly grocery payment function
        const grocery_func = R(
            { t0: params.start_time, dt: 30, tf: params.start_time + params.end_time },
            f_out,
            P({ b: params.monthly_amount }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(grocery_func);
    } else {
        // Create one-time grocery purchase function
        const grocery_func = T(
            { t_k: params.start_time },
            f_out,
            P({ b: params.monthly_amount }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(grocery_func);
    }
};

export const tax_payment_estimated = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const from_key = params.from_key;
    const start_time = params.start_time;
    const end_time = params.end_time;

    // Estimate taxes owed
    const estimated_tax = estimate_taxes(params);

    // Get growth parameters for source envelope
    const [theta_growth_source, _] = get_growth_parameters(envelopes, from_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Create a recurring outflow for the estimated tax
        const outflow_func = R(
            { t0: start_time, dt: params.frequency_days || 365, tf: end_time },
            f_out,
            P({ b: estimated_tax }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(outflow_func);
    } else {
        // Create a one-time outflow for the estimated tax
        const outflow_func = T(
            { t_k: start_time },
            f_out,
            P({ b: estimated_tax }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(outflow_func);
    }
};

// Helper function to calculate daily compound interest for student loans
const calculateAccumulatedDebt = (principal: number, annualRate: number, timeInDays: number): number => {
    // Daily compound interest formula: A = P(1 + r/365)^days
    return principal * Math.pow(1 + annualRate / 365, timeInDays);
};

export const federal_subsidized_loan = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source and destination envelopes
    const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
        envelopes, params.from_key, params.to_key
    );

    //loan going straight to school.

    // Add debt to student loans envelope (negative balance)
    const loan_debt = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.amount }),
        theta_growth_dest
    );
    envelopes[params.to_key].functions.push(loan_debt);

    // Calculate when payments begin: graduation_date + 6 months (180 days)
    const payment_start_time = params.graduation_date + 180;

    // For subsidized loans, no interest accrues during school, so debt amount remains the same
    const accumulated_debt_amount = params.amount;

    // Standard 10-year repayment schedule
    const loan_term_years = params.loan_term_years;
    const payment_end_time = payment_start_time + loan_term_years * 365 - 30;

    // Get interest rate from the Student Loans envelope
    const interest_rate = envelopes[params.to_key].growth_rate || 0.055; // Default 5.5% if not specified

    // Monthly payments from cash (includes both principal and interest)
    const monthly_payments = R(
        { t0: payment_start_time, dt: 365 / 12, tf: payment_end_time },
        f_monthly_payment,
        P({ P: accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        theta_growth_source
    );
    envelopes[params.from_key].functions.push(monthly_payments);

    // Monthly principal payments to reduce debt (positive payments to debt envelope)
    const principal_payments = R(
        { t0: payment_start_time, dt: 365 / 12, tf: payment_end_time },
        f_principal_payment,
        P({ P: accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        theta_growth_dest
    );
    envelopes[params.to_key].functions.push(principal_payments);

    // --- Student Loan Envelope Correction at End of Payment Cycle ---
    const student_loan_end_time = payment_end_time;
    const studentLoanEnvelope = envelopes[params.to_key];
    let student_loan_balance = 0.0;
    for (const func of studentLoanEnvelope.functions) {
        student_loan_balance += func(student_loan_end_time);
    }
    if (Math.abs(student_loan_balance) > 1e-6) {
        const [theta_growth_source, theta_growth_dest] = get_growth_parameters(
            envelopes, params.from_key, params.to_key
        );
        const correction_inflow = T(
            { t_k: student_loan_end_time },
            f_in,
            P({ a: Math.abs(student_loan_balance) }),
            theta_growth_dest
        );
        studentLoanEnvelope.functions.push(correction_inflow);
        const correction_outflow = T(
            { t_k: student_loan_end_time },
            f_out,
            P({ b: Math.abs(student_loan_balance) }),
            theta_growth_source
        );
        envelopes[params.from_key].functions.push(correction_outflow);
    }
};

export const federal_unsubsidized_loan = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source, during-school, and after-school envelopes
    const [theta_growth_source, theta_growth_during, theta_growth_after] = get_growth_parameters(
        envelopes, params.from_key, params.to_key, params.after_school_key
    );

    // Add debt to student loans during-school envelope (negative balance) - interest accrues during school
    const loan_debt = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.amount }),
        theta_growth_during
    );
    envelopes[params.to_key].functions.push(loan_debt);

    // Calculate when payments begin: graduation_date + 6 months (180 days)
    const payment_start_time = params.graduation_date + 180;
    //console.log("To_key envelope", envelopes[params.to_key]);
    // Calculate accumulated debt using daily compound interest
    const interest_accrual_days = payment_start_time - params.start_time;
    const during_school_rate = envelopes[params.to_key].growth_rate; // Get rate from during-school envelope
    const accumulated_debt_amount = calculateAccumulatedDebt(params.amount, during_school_rate, interest_accrual_days);

    // Transfer debt out of during-school envelope
    const debt_transfer_out = T(
        { t_k: payment_start_time },
        f_in, // Positive to remove the negative debt balance
        P({ a: accumulated_debt_amount }),
        theta_growth_during
    );
    envelopes[params.to_key].functions.push(debt_transfer_out);

    // Transfer accumulated debt into after-school envelope
    const debt_transfer_in = T(
        { t_k: payment_start_time },
        f_out, // Negative to create debt balance
        P({ b: accumulated_debt_amount }),
        theta_growth_after
    );
    envelopes[params.after_school_key].functions.push(debt_transfer_in);

    // Standard 10-year repayment schedule starting after transfer
    const loan_term_years = params.loan_term_years;
    const payment_end_time = payment_start_time + loan_term_years * 365 - 30;

    // Get interest rate from the after-school Student Loans envelope
    const interest_rate = envelopes[params.to_key].growth_rate; // Default 6.5% for unsubsidized

    // Monthly payments from cash (includes both principal and interest)
    const monthly_payments = R(
        { t0: payment_start_time, dt: 365 / 12, tf: payment_end_time },
        f_monthly_payment,
        P({ P: accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        theta_growth_source
    );
    envelopes[params.from_key].functions.push(monthly_payments);

    // Monthly principal payments to reduce debt in after-school envelope
    const principal_payments = R(
        { t0: payment_start_time, dt: 365 / 12, tf: payment_end_time },
        f_principal_payment,
        P({ P: accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        theta_growth_after
    );
    envelopes[params.after_school_key].functions.push(principal_payments);

    // --- Student Loan Envelope Correction at End of Payment Cycle ---
    const student_loan_end_time = payment_end_time;
    const studentLoanEnvelope = envelopes[params.after_school_key];
    let student_loan_balance = 0.0;
    for (const func of studentLoanEnvelope.functions) {
        student_loan_balance += func(student_loan_end_time);
    }
    if (Math.abs(student_loan_balance) > 1e-6) {
        const [theta_growth_source, theta_growth_after] = get_growth_parameters(
            envelopes, params.from_key, params.after_school_key
        );
        const correction_inflow = T(
            { t_k: student_loan_end_time },
            f_in,
            P({ a: Math.abs(student_loan_balance) }),
            theta_growth_after
        );
        studentLoanEnvelope.functions.push(correction_inflow);
        const correction_outflow = T(
            { t_k: student_loan_end_time },
            f_out,
            P({ b: Math.abs(student_loan_balance) }),
            theta_growth_source
        );
        envelopes[params.from_key].functions.push(correction_outflow);
    }
};

export const private_student_loan = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    // Get growth parameters for source, during-school, and after-school envelopes
    const [theta_growth_source, theta_growth_during, theta_growth_after] = get_growth_parameters(
        envelopes, params.from_key, params.to_key, params.after_school_key
    );

    // Add debt to student loans during-school envelope (negative balance) - interest accrues during school
    const loan_debt = T(
        { t_k: params.start_time },
        f_out,
        P({ b: params.amount }),
        theta_growth_during
    );
    envelopes[params.to_key].functions.push(loan_debt);

    // Calculate when payments begin: graduation_date + 6 months (180 days)
    const payment_start_time = params.graduation_date + 180;

    // Calculate accumulated debt using daily compound interest
    const interest_accrual_days = payment_start_time - params.start_time;
    const during_school_rate = envelopes[params.to_key].growth_rate; // Get rate from during-school envelope (higher for private)
    const accumulated_debt_amount = calculateAccumulatedDebt(params.amount, during_school_rate, interest_accrual_days);

    // Transfer debt out of during-school envelope
    const debt_transfer_out = T(
        { t_k: payment_start_time },
        f_in, // Positive to remove the negative debt balance
        P({ a: accumulated_debt_amount }),
        theta_growth_during
    );
    envelopes[params.to_key].functions.push(debt_transfer_out);

    // Transfer accumulated debt into after-school envelope
    const debt_transfer_in = T(
        { t_k: payment_start_time },
        f_out, // Negative to create debt balance
        P({ b: accumulated_debt_amount }),
        theta_growth_after
    );
    envelopes[params.after_school_key].functions.push(debt_transfer_in);

    // Standard 10-year repayment schedule starting after transfer
    const loan_term_years = params.loan_term_years;
    const payment_end_time = payment_start_time + loan_term_years * 365;

    // Get interest rate from the during-school envelope (private loans typically have higher rates)
    const interest_rate = envelopes[params.to_key].growth_rate; // Default 6.5% for private loans

    // First payment is 30 days after transfer
    // Monthly payments from cash (includes both principal and interest)
    const monthly_payments = R(
        { t0: payment_start_time + 30, dt: 365 / 12, tf: payment_end_time },
        f_monthly_payment,
        P({ P: accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        theta_growth_source
    );
    envelopes[params.from_key].functions.push(monthly_payments);

    // Monthly principal payments to reduce debt in after-school envelope
    const principal_payments = R(
        { t0: payment_start_time + 30, dt: 365 / 12, tf: payment_end_time },
        f_principal_payment,
        P({ P: accumulated_debt_amount, r: interest_rate, y: loan_term_years }),
        theta_growth_after
    );
    envelopes[params.after_school_key].functions.push(principal_payments);

    // --- Student Loan Envelope Correction at End of Payment Cycle ---
    const student_loan_end_time = payment_end_time;
    const studentLoanEnvelope = envelopes[params.after_school_key];
    let student_loan_balance = 0.0;
    for (const func of studentLoanEnvelope.functions) {
        student_loan_balance += func(student_loan_end_time);
    }
    if (Math.abs(student_loan_balance) > 1e-6) {
        const [theta_growth_source, theta_growth_after] = get_growth_parameters(
            envelopes, params.from_key, params.after_school_key
        );
        const correction_inflow = T(
            { t_k: student_loan_end_time },
            f_in,
            P({ a: Math.abs(student_loan_balance) }),
            theta_growth_after
        );
        studentLoanEnvelope.functions.push(correction_inflow);
        const correction_outflow = T(
            { t_k: student_loan_end_time },
            f_out,
            P({ b: Math.abs(student_loan_balance) }),
            theta_growth_source
        );
        envelopes[params.from_key].functions.push(correction_outflow);
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

    // Subtract withholdings and IRA contributions
    let totalTax = federalTax + stateTax + localTax + real_estate_tax;
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

    // Get growth parameters for the envelopes
    const [theta_growth_taxable_income, theta_growth_penalty_401k, theta_growth_taxes_401k, theta_growth_roth, theta_growth_penalty_roth, theta_growth_401k, theta_growth_irs_registered_account] = get_growth_parameters(
        envelopes, params.taxable_income_key, params.penalty_401k_key, params.taxes_401k_key, params.roth_key, params.penalty_roth_key, params.p_401k_key, params.irs_registered_account_key
    );

    //calcualte taxes owned just on the 401K balance part
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

    // Get the relevant envelopes
    const envelope401k = envelopes[params.p_401k_key];
    const penaltyEnvelope = envelopes[params.penalty_401k_key];
    const taxableIncomeEnvelope = envelopes[params.taxable_income_key];
    const taxesEnvelope = envelopes[params.taxes_401k_key];
    const envelopeRothIra = envelopes[params.roth_key];
    const penaltyEnvelopeRothIra = envelopes[params.penalty_roth_key];

    // Create time range based on simulation settings
    const startTime = simulation_settings.start_time;
    const endTime = simulation_settings.end_time;
    const interval = simulation_settings.interval;
    const birthDate = simulation_settings.birthDate;

    // Generate time points similar to resultsEvaluation.ts
    const timePoints = Array.from(
        { length: Math.ceil((endTime - startTime) / interval) },
        (_, i) => startTime + i * interval
    );

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
            console.log(`Person reaches age 59.5 on day ${age59HalfDay}`);
        } else {
            age59HalfDay = null; // Outside simulation range
        }
    }

    // Process taxable income corrections on year-end days
    yearEndDays.forEach(yearEndDay => {
        // --- Reset taxable income and additional envelopes at year end ---

        // Before year end, evalute value of all tax related envelopes
        const taxEnvelopes = [
            params.taxable_income_key,
            params.federal_withholdings_key,
            params.state_withholdings_key,
            params.local_withholdings_key,
            params.ira_contributions_key,
            params.penalty_401k_key,
            params.taxes_401k_key,
            params.roth_key,
            params.penalty_roth_key,
            params.roth_ira_principle_key,
            params.roth_ira_withdraw_key, //The amount withdrawn from the ROTH IRA
            params.p_401k_key, //Actual account value of 401k
            params.p_401k_withdraw_key, //Withholding from 401k this year
            params.p_401k_withdraw_withholding_key //Withholding from 401k this year
        ];

        //Dictionary for saving relevant balances
        const taxEnvelopesBalances: Record<string, number> = {};

        for (const key of taxEnvelopes) {
            if (key && envelopes[key]) {
                let envBalance = 0.0;
                for (const func of envelopes[key].functions) {
                    envBalance += func(yearEndDay);
                }
                taxEnvelopesBalances[key] = envBalance;
            }
        }

        //Calculate age and year
        const age = Math.floor(yearEndDay / 365);
        const year = birthDate.getFullYear() + age;
        console.log("Age", age);
        console.log("Year", year);

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
        };

        const taxesOwed = calculateTaxes(taxParams_tax_season);
        console.log("Tax Params", taxParams_tax_season);
        console.log("Taxes Owed", taxesOwed);

        // Withdraw the taxes withhed from irs_registered_account_key
        const irsRegisteredAccountEnvelope = envelopes[params.irs_registered_account_key];
        const pay_taxes_func = T(
            { t_k: yearEndDay + 105 }, // 105 days from the end of the year is tax day.
            f_out,
            P({ b: taxesOwed }),
            theta_growth_irs_registered_account
        );
        irsRegisteredAccountEnvelope.functions.push(pay_taxes_func);

        const resetEnvelopes = [
            params.taxable_income_key,
            params.federal_withholdings_key,
            params.state_withholdings_key,
            params.local_withholdings_key,
            params.ira_contributions_key,
            params.p_401k_withdraw_key,
            params.p_401k_withdraw_withholding_key,
            params.roth_ira_withdraw_key,
        ];
        for (const key of resetEnvelopes) {
            if (key && envelopes[key]) {
                let envBalance = 0.0;
                for (const func of envelopes[key].functions) {
                    envBalance += func(yearEndDay);
                }
                if (envBalance !== 0) {
                    // Get growth parameters for this envelope
                    const [_, theta_growth_env] = get_growth_parameters(envelopes, undefined, key);
                    const diff = 0 - envBalance;
                    const correctionFunc = T(
                        { t_k: yearEndDay },
                        diff > 0 ? f_in : f_out,
                        P(diff > 0 ? { a: Math.abs(diff) } : { b: Math.abs(diff) }),
                        theta_growth_env
                    );
                    envelopes[key].functions.push(correctionFunc);
                }
            }
        }
    });

    // For each time point, evaluate the 401K balance and create penalty functions
    timePoints.forEach(t => {

        // Evaluate ROTH IRA balance at time t
        let balanceRothIra = 0.0;
        for (const func of envelopeRothIra.functions) {
            balanceRothIra += func(t);
        }


        // Evaluate 401K envelope balance at time t
        let balance401k = 0.0;
        for (const func of envelope401k.functions) {
            balance401k += func(t);
        }

        // Only apply 401K penalty if person is under 59.5 years old
        if (!age59HalfDay || t < age59HalfDay) {
            // Calculate 10% penalty
            const penaltyAmount = balance401k * 0.10;

            // Calculate ROTH IRA penalty
            const penaltyAmountRothIra = balanceRothIra * 0.10;

            // Create an impulse function at time t for the penalty amount
            if (penaltyAmount > 0) {
                const penaltyFunc = impulse_T(
                    { t_k: t },
                    f_out, // Using outflow function since it's a penalty (negative)
                    P({ b: penaltyAmount }),
                    theta_growth_penalty_401k,
                    0
                );

                // Add the penalty function to the penalty envelope
                penaltyEnvelope.functions.push(penaltyFunc);
            }

            if (penaltyAmountRothIra > 0) {

                //Roth IRA penalty
                const penaltyRothIraFunc = impulse_T(
                    { t_k: t },
                    f_out, // Using outflow function since it's a penalty (negative)
                    P({ b: penaltyAmountRothIra }),
                    theta_growth_penalty_roth,
                    0
                );
                // Add the penalty function to the penalty envelope
                penaltyEnvelopeRothIra.functions.push(penaltyRothIraFunc);
            }
        }

        // Evaluate taxable income envelope balance at time t
        let taxableIncomeBalance = 0.0;
        for (const func of taxableIncomeEnvelope.functions) {
            taxableIncomeBalance += func(t);
        }
        const taxParams_401K_included = {
            ...taxParams,
            taxable_income: taxableIncomeBalance + balance401k
        };
        const taxParamsBase = {
            ...taxParams,
            taxable_income: taxableIncomeBalance
        };
        const taxesOwed = calculateTaxes(taxParams_401K_included) - calculateTaxes(taxParamsBase);

        // Create an impulse function at time t for the tax amount
        const taxFunc = impulse_T(
            { t_k: t },
            f_out, // Using outflow function since taxes are owed (positive debt)
            P({ b: taxesOwed }),
            theta_growth_taxes_401k,
            0
        );

        // Add the tax function to the taxes envelope
        taxesEnvelope.functions.push(taxFunc);

        // console.log(`Added taxes of ${taxesOwed.toFixed(2)} on taxable income of ${taxableIncomeBalance.toFixed(2)} at time ${t}`);
    });

    // Apply manual correction to reset 401K penalty to 0 at age 59.5
    if (age59HalfDay !== null) {
        // Evaluate penalty envelope balance at age 59.5
        let penaltyBalance = 0.0;
        for (const func of penaltyEnvelope.functions) {
            penaltyBalance += func(age59HalfDay);
        }

        if (penaltyBalance !== 0) {
            // Apply difference correction - subtract the current balance to reset it to 0
            const difference = 0 - penaltyBalance; // Target amount (0) minus current balance

            // Create correction function following manual_correction pattern
            const correctionFunc = T(
                { t_k: age59HalfDay },
                difference > 0 ? f_in : f_out,
                P(difference > 0 ? { a: Math.abs(difference) } : { b: Math.abs(difference) }),
                theta_growth_penalty_401k
            );

            // Add the correction to penalty envelope
            penaltyEnvelope.functions.push(correctionFunc);

            console.log(`Applied 401K penalty correction of ${difference} at age 59.5 (day ${age59HalfDay})`);
        }
    }

    // console.log('USA Tax System event processed with parameters:', params);
    // console.log(`Applied 401K penalties at ${timePoints.length} time points`);
    //console.log(`Applied taxable income corrections at ${yearEndDays.length} year-end days:`, yearEndDays);
};


export const retirement = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;

    console.log("Retirement event processed with parameters:", envelopes);
    // Get growth parameters for all three envelopes
    const [theta_growth_401k, theta_growth_roth, theta_growth_dest] = get_growth_parameters(
        envelopes, params.p_401k_key, params.roth_ira_key, params.to_key
    );

    // Create recurring transfer from 401K to cash (outflow from 401K)
    const withdrawal_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_out,
        P({ b: params.amount }),
        theta_growth_401k
    );

    // Add withdrawal function to 401K envelope
    envelopes[params.p_401k_key].functions.push(withdrawal_func);

    // Create recurring inflow to cash envelope
    const inflow_func = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_in,
        P({ a: (params.amount - params.amount * 0.25) }),
        theta_growth_dest
    );

    // Add inflow function to cash envelope
    envelopes[params.to_key].functions.push(inflow_func);


    // Create recurring transfer from ROTH IRA to cash (outflow from ROTH IRA)
    const withdrawal_func_roth = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_out,
        P({ b: params.amount_roth_ira }),
        theta_growth_roth
    );

    // Add withdrawal function to ROTH IRA envelope
    envelopes[params.roth_ira_key].functions.push(withdrawal_func_roth);

    // Create recurring inflow to cash envelope
    const inflow_func_roth = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_in,
        P({ a: (params.amount_roth_ira) }),
        theta_growth_dest
    );

    // Add inflow function to cash envelope
    envelopes[params.to_key].functions.push(inflow_func_roth);


    // Get growth rate for all tax accounts
    const [theta_growth_p_401k_withdraw_withholding, theta_growth_p_401k_withdraw, theta_growth_roth_ira_principle, theta_growth_roth_ira_withdraw] = get_growth_parameters(
        envelopes, params.p_401k_withdraw_withholding_key, params.p_401k_withdraw_key, params.roth_ira_principle_key, params.roth_ira_withdraw_key
    );

    // Create recurring taxable income from 401K withdrawals
    const func_401K_withdrawals = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_in,
        P({ a: params.amount }),
        theta_growth_p_401k_withdraw
    );

    // Add taxable income function to taxable income envelope
    envelopes[params.p_401k_withdraw_key].functions.push(func_401K_withdrawals);


    // Typically 20% for federal and 0-10% for state taxes

    const func_401K_witholdings = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_in,
        P({ a: params.amount * 0.25 }),
        theta_growth_p_401k_withdraw_withholding
    );

    envelopes[params.p_401k_withdraw_withholding_key].functions.push(func_401K_witholdings);



    // Reoccuring withdraws from principle envelope
    const func_roth_ira_principle = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_out,
        P({ b: params.amount_roth_ira }),
        theta_growth_roth_ira_principle
    );

    // Add taxable income function to taxable income envelope
    envelopes[params.roth_ira_principle_key].functions.push(func_roth_ira_principle);

    // Reoccuring withdraws from account
    const func_roth_ira_withdraw = R(
        { t0: params.start_time, dt: params.frequency_days, tf: params.end_time },
        f_in,
        P({ a: params.amount_roth_ira }),
        theta_growth_roth_ira_withdraw
    );

    // Add taxable income function to taxable income envelope
    envelopes[params.roth_ira_withdraw_key].functions.push(func_roth_ira_withdraw);

};

export const roth_ira_contribution = (event: any, envelopes: Record<string, any>) => {
    const params = event.parameters;
    const from_key = params.from_key;
    const to_key = params.to_key;
    const start_time = params.start_time;
    const end_time = params.end_time;
    const amount = params.amount;

    // Get growth parameters for both envelopes
    const [theta_growth_source, theta_growth_dest, theta_growth_roth_ira_principle] = get_growth_parameters(envelopes, from_key, to_key, params.roth_ira_principle_key);

    //See if event is recurring or not
    const is_recurring = event.is_recurring;
    if (is_recurring) {
        // Recurring outflow from source envelope
        const outflow_func = R(
            { t0: start_time, dt: params.frequency_days, tf: end_time },
            f_out,
            P({ b: amount }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(outflow_func);

        // Recurring inflow to Roth IRA envelope
        const inflow_func = R(
            { t0: start_time, dt: params.frequency_days, tf: end_time },
            f_in,
            P({ a: amount }),
            theta_growth_dest
        );
        envelopes[to_key].functions.push(inflow_func);

        // Reoccuring addition to the principle tracking for the envelope
        const inflow_func_principle = R(
            { t0: start_time, dt: params.frequency_days, tf: end_time },
            f_in,
            P({ a: amount }),
            theta_growth_roth_ira_principle
        );
        envelopes[params.roth_ira_principle_key].functions.push(inflow_func_principle);
    } else {
        // One-time outflow from source envelope
        const outflow_func = T(
            { t_k: start_time },
            f_out,
            P({ b: amount }),
            theta_growth_source
        );
        envelopes[from_key].functions.push(outflow_func);

        // One-time inflow to Roth IRA envelope
        const inflow_func = T(
            { t_k: start_time },
            f_in,
            P({ a: amount }),
            theta_growth_dest
        );
        envelopes[to_key].functions.push(inflow_func);

        // One-time inflow to Roth IRA principle envelope
        const inflow_func_principle = T(
            { t_k: start_time },
            f_in,
            P({ a: amount }),
            theta_growth_roth_ira_principle
        );
        envelopes[params.roth_ira_principle_key].functions.push(inflow_func_principle);
    }
};