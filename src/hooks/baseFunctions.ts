// utilities.ts
import type { Theta, FuncWithTheta } from "./types";

export const u = (t: number): number => (t >= 0 ? 1.0 : 0.0);

export const P = (params: Record<string, any>): Theta => {
    return (_t: number) => params;
};

export const T = (
    tk: number,
    f: FuncWithTheta,
    theta: Theta = P({})
): ((t: number) => number) => {
    return (t: number) => f(theta, tk)(t - tk) * u(t - tk);
};

export const R = (
    t0: number,
    dt: number,
    tf: number,
    f: FuncWithTheta,
    theta: Theta,
    overrides: Record<number, Theta> = {}
): ((t: number) => number) => {
    return (t: number) =>
        Array.from({ length: Math.floor((tf - t0) / dt) + 1 }, (_, i) => {
            const ti = t0 + i * dt;
            return ti <= tf ? f(overrides[i] ?? theta, ti)(t - ti) * u(t - ti) : 0;
        }).reduce((acc, val) => acc + val, 0);
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

// baseFunctions.ts
// f_in: inflow function
export const f_in = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) => params["a"] * u(t);
};

// f_out: outflow function
export const f_out = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) => -params["b"] * u(t);
};

// f_com: compound interest
export const f_com = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) =>
        params["P"] * Math.pow(1 + params["r"] / 365, t) * u(t);
};

// f_sal: salary with deductions
export const f_sal = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    const net = 1 -
        (params["r_SS"] + params["r_Med"] + params["r_Fed"] + params["r_401k"]);
    return (t: number) => (params["S"] / params["p"]) * net * u(t);
};

// f_app: appreciation
export const f_app = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) => params["V0"] * Math.pow(1 + params["r_app"], t / 365);
};

// f_dep: depreciation
export const f_dep = (theta: Theta, t_i: number) => {
    const params = theta(t_i);
    return (t: number) => params["V0"] * Math.pow(1 - params["r_dep"], t / 365);
};


// Compound salary into 401k
export const f_401 = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return f_com(
        P({ P: (p.S / p.p) * p.r_401, r: p.r_growth }),
        t_i
    );
};

// Mortgage payment calculation
export const f_principal = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return (t: number): number => {
        const months = Math.floor(t / (365 / 12));
        const r = p.r;
        const y = p.y;
        const Loan = p.P;
        const default_payment = (Loan * (r / 12) * Math.pow(1 + r / 12, 12 * y)) /
            (Math.pow(1 + r / 12, 12 * y) - 1);
        const p_m = p.p_mortgage ?? default_payment;
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
    const p = theta(t_i);
    return (_t: number) =>
        (p.P * (p.r / 12) * Math.pow(1 + p.r / 12, 12 * p.y)) /
        (Math.pow(1 + p.r / 12, 12 * p.y) - 1);
};

export const f_insurance = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return (t: number) => p.p0 * Math.pow(1 + p.r_adj, t / 365);
};

export const f_maint = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return (t: number) => p.m0 + p.alpha * (t - p.t0);
};

export const f_inflation_adjust = (
    W: (t: number) => number,
    theta: Theta,
    t_i: number
) => {
    const p = theta(t_i);
    return (t: number) =>
        t >= p.t_today ? W(t) / Math.pow(1 + p.r_inf, (t - p.t_today) / 365) : W(t);
};

export const f_empirical = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return (t: number) => Math.abs(t - p.t_k) < 1e-5 ? p.V_obs : 0.0;
};

export const f_purchase = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return f_out(P({ b: p.m }), t_i);
};

export const f_get_job = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return (t: number) => R(p.time_start, 365 / p.p, p.time_end, f_sal, theta)(t);
};

export const raise_override = (theta: Theta, new_salary: number, t_raise: number): Theta => {
    return gamma(theta, { S: new_salary }, t_raise);
};

export const f_get_bonus = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return f_in(P({ a: p.b }), t_i);
};

export const f_start_business = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return f_out(P({ b: p.a }), t_i);
};

export const f_business_income = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return (t: number) =>
        R(p.t0, p["Δt"], p.tf, f_in, P({ a: p.m }))(t);
};

export const update_business_income = (theta: Theta, new_m: number, t_update: number): Theta => {
    return gamma(theta, { m: new_m }, t_update);
};

export const f_retirement = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return (t: number) =>
        R(p.t0, p["Δt"], p.tf, f_out, P({ b: p.w }))(t);
};

export const f_hysa = (theta: Theta, t_i: number) => {
    const p = theta(t_i);
    return f_com(P({ P: p.p, r: p.r_y }), t_i);
};

export const update_401k = (theta: Theta, new_r_401k: number, t_update: number): Theta => {
    return gamma(theta, { r_401k: new_r_401k }, t_update);
};

export const adjust_depreciation = (theta: Theta, new_r_dep: number, t_update: number): Theta => {
    return gamma(theta, { r_dep: new_r_dep }, t_update);
};

export const adjust_mortgage = (theta: Theta, new_payment: number, t_update: number): Theta => {
    return gamma(theta, { monthly_payment: new_payment }, t_update);
};








export const get_job = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;

    let theta = P({
        S: params.salary,
        p: params.pay_period,
        r_Fed: params.federal_income_tax,
        r_SS: params.social_security_tax,
        r_Med: params.medicare_tax,
        r_401k: params.p_401k_contribution,
        r_state: params.state_income_tax,
        time_start: params.start_time,
        time_end: params.end_time
    });

    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "get_a_raise") {
            theta = raise_override(theta, upd_params.salary, upd_params.start_time);
        } else if (upd_type === "change_401k_contribution") {
            theta = update_401k(theta, upd_params.p_401k_contribution, upd_params.start_time);
        } else if (upd_type === "get_a_bonus") {
            envelopes["Cash"].push(T(upd_params.start_time, f_in, P({ a: upd_params.bonus })));
        }
    }

    const to_key = params.to_key;
    envelopes[to_key].push(f_get_job(theta, params.start_time));
};

export const purchase = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;
    envelopes[params.from_key].push(
        T(params.start_time, f_out, P({ b: params.money }))
    );
};

export const gift = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;
    envelopes[params.to_key].push(
        T(params.start_time, f_in, P({ a: params.money }))
    );
};

export const start_business = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;

    envelopes[params.from_key].push(
        T(params.start_time, f_out, P({ b: params.initial_investment }))
    );

    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "business_income") {
            envelopes[upd_params.to_key].push(
                R(upd_params.start_time, 30, upd_params.end_time, f_in, P({ a: upd_params.monthly_income }))
            );
        } else if (upd_type === "business_loss") {
            envelopes[upd_params.from_key].push(
                T(upd_params.start_time, f_out, P({ b: upd_params.loss_amount }))
            );
        }
    }
};

export const retirement = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;

    const withdrawal_func = R(
        params.start_time,
        params.frequency_days,
        params.end_time,
        f_out,
        P({ b: params.amount })
    );

    envelopes[params.from_key].push(withdrawal_func);

    const deposit_func = R(
        params.start_time,
        params.frequency_days,
        params.end_time,
        f_in,
        P({ a: params.amount })
    );

    envelopes[params.to_key].push(deposit_func);
};


export const buy_house = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;
    const house_params = {
        H0: params.home_value,
        r_app: params.appreciation_rate,
        t_buy: params.start_time,
        y: params.loan_term_years,
        D: params.downpayment,
        Omega: []
    };
    const mortgage_params = {
        P: params.home_value - params.downpayment,
        r: params.loan_rate,
        y: params.loan_term_years
    };

    let house_func = f_buy_house(P(house_params), P(mortgage_params), params.start_time);
    envelopes[params.to_key].push(house_func);

    const downpayment_func = T(params.start_time, f_out, P({ b: params.downpayment }));
    envelopes[params.from_key].push(downpayment_func);

    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "new_appraisal") {
            house_params.H0 = upd_params.appraised_value;
            house_func = f_buy_house(P(house_params), P(mortgage_params), upd_params.start_time);
            envelopes[params.to_key].push(house_func);
        } else if (upd_type === "extra_mortgage_payment" || upd_type === "late_payment") {
            const payment_func = T(upd_params.start_time, f_out, P({ b: upd_params.amount }));
            envelopes[upd_params.from_key].push(payment_func);
        } else if (upd_type === "sell_house") {
            const sale_func = T(upd_params.start_time, f_in, P({ a: upd_params.sale_price }));
            envelopes[upd_params.to_key].push(sale_func);
            const removal_func = T(upd_params.start_time, f_out, P({ b: params.home_value }));
            envelopes[upd_params.from_key].push(removal_func);
        }
    }
};

export const buy_home_insurance = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;

    const premium_func = R(
        params.start_time,
        30,
        Infinity,
        f_out,
        P({ b: params.monthly_premium })
    );
    envelopes[params.from_key].push(premium_func);

    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (["tornado_damage", "house_fire", "flood_damage"].includes(upd_type)) {
            const damage_cost = upd_params.damage_cost;
            const coverage = upd_params.insurance_coverage ?? params.coverage_percentage;
            const payout = damage_cost * coverage;

            const deductible = T(upd_params.start_time, f_out, P({ b: params.deductible }));
            envelopes[params.from_key].push(deductible);

            if (payout > 0) {
                const payout_func = T(upd_params.start_time, f_in, P({ a: payout }));
                envelopes[upd_params.to_key ?? params.from_key].push(payout_func);
            }
        }
    }
};

export const buy_car = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;

    const car_params = {
        C0: params.car_value,
        r_dep: 0.15,
        t_buy: params.start_time,
        y: params.loan_term_years,
        D: params.downpayment
    };
    const loan_params = {
        P: params.car_value - params.downpayment,
        r: params.loan_rate,
        y: params.loan_term_years
    };

    const car_func = f_buy_car(P(car_params), P(loan_params), params.start_time);
    envelopes[params.to_key].push(car_func);

    const downpayment_func = T(params.start_time, f_out, P({ b: params.downpayment }));
    envelopes[params.from_key].push(downpayment_func);

    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "pay_loan_early" || upd_type === "car_repair") {
            const payment_func = T(upd_params.start_time, f_out, P({ b: upd_params.amount ?? upd_params.cost }));
            envelopes[upd_params.from_key].push(payment_func);
        }
    }
};


export const have_kid = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;

    envelopes[params.from_key].push(
        T(params.start_time, f_out, P({ b: params.initial_costs }))
    );

    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "childcare_costs") {
            const childcare_func = R(
                upd_params.start_time,
                30,
                upd_params.start_time + upd_params.end_days,
                f_out,
                P({ b: upd_params.monthly_cost })
            );
            envelopes[upd_params.from_key].push(childcare_func);
        } else if (upd_type === "college_fund") {
            envelopes[upd_params.from_key].push(
                T(upd_params.start_time, f_out, P({ b: upd_params.initial_contribution }))
            );
            envelopes[upd_params.from_key].push(
                R(upd_params.start_time, 30, upd_params.start_time + upd_params.end_days, f_out, P({ b: upd_params.monthly_contribution }))
            );
            envelopes[upd_params.to_key].push(
                R(upd_params.start_time, 30, upd_params.start_time + upd_params.end_days, f_in, P({ a: upd_params.monthly_contribution }))
            );
        }
    }
};

export const marriage = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;
    envelopes[params.from_key].push(
        T(params.start_time, f_out, P({ b: params.cost }))
    );
};

export const divorce = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;
    envelopes[params.from_key].push(
        T(params.start_time, f_out, P({ b: params.settlement_amount }))
    );
    envelopes[params.from_key].push(
        T(params.start_time, f_out, P({ b: params.attorney_fees }))
    );
};

export const pass_away = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const death_time = event.parameters.start_time;

    for (const [key, funcs] of Object.entries(envelopes)) {
        envelopes[key] = funcs.map(func => D(death_time, func, (_t: number) => 0));
    }
};

export const buy_health_insurance = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;

    envelopes[params.from_key].push(
        R(params.start_time, 30, Infinity, f_out, P({ b: params.monthly_premium }))
    );

    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "medical_expense") {
            const total_cost = upd_params.total_cost;
            const deductible = upd_params.deductible ?? params.deductible;
            const coverage = upd_params.insurance_coverage ?? params.coverage_percentage;

            if (deductible > 0) {
                envelopes[upd_params.from_key].push(
                    T(upd_params.start_time, f_out, P({ b: deductible }))
                );
            }

            const remaining_cost = total_cost - deductible;
            const out_of_pocket = remaining_cost * (1 - coverage);
            if (out_of_pocket > 0) {
                envelopes[upd_params.from_key].push(
                    T(upd_params.start_time, f_out, P({ b: out_of_pocket }))
                );
            }
        }
    }
};



export const buy_life_insurance = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;
    const from_key = params.from_key;

    envelopes[from_key].push(
        R(params.start_time, 30, params.start_time + params.term_years * 365, f_out, P({ b: params.monthly_premium }))
    );

    for (const upd of event.updating_events || []) {
        if (upd.type === "increase_coverage") {
            const upd_params = upd.parameters || {};
            envelopes[from_key].push(
                R(upd_params.start_time, 30, params.start_time + params.term_years * 365, f_out, P({ b: upd_params.new_monthly_premium }))
            );
        }
    }
};

export const receive_government_aid = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;
    envelopes[params.to_key].push(
        R(params.start_time, params.frequency_days, params.start_time + params.end_days, f_in, P({ a: params.amount }))
    );
};

export const invest_money = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;

    envelopes[params.from_key].push(T(params.start_time, f_out, P({ b: params.amount })));
    envelopes[params.to_key].push(f_com(P({ P: params.amount, r: params.expected_return }), params.start_time));

    for (const upd of event.updating_events || []) {
        const upd_type = upd.type;
        const upd_params = upd.parameters || {};

        if (upd_type === "Reoccuring Dividend Payout") {
            envelopes[upd_params.to_key].push(T(upd_params.start_time, f_in, P({ a: upd_params.amount })));
        } else if (upd_type === "Reoccuring Contribution") {
            envelopes[upd_params.from_key].push(R(upd_params.start_time, 30, upd_params.end_time, f_out, P({ b: upd_params.amount })));
            envelopes[params.to_key].push(f_com(P({ P: upd_params.amount, r: params.expected_return }), upd_params.start_time));
        }
    }
};

export const high_yield_savings_account = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;

    envelopes[params.from_key].push(T(params.start_time, f_out, P({ b: params.amount })));
    envelopes[params.to_key].push(f_com(P({ P: params.amount, r: params.interest_rate }), params.start_time));
};

export const pay_taxes = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;

    envelopes[params.from_key].push(T(params.start_time, f_out, P({ b: params.total_tax_due })));

    for (const upd of event.updating_events || []) {
        if (upd.type === "receive_tax_refund") {
            const upd_params = upd.parameters || {};
            envelopes[upd_params.to_key].push(T(upd_params.start_time, f_in, P({ a: upd_params.amount })));
        }
    }
};

export const buy_groceries = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;
    const from_key = params.from_key;

    envelopes[from_key].push(
        R(params.start_time, 30, params.start_time + params.end_days, f_out, P({ b: params.monthly_amount }))
    );

    for (const upd of event.updating_events || []) {
        if (upd.type === "update_amount") {
            const upd_params = upd.parameters || {};
            envelopes[from_key].push(
                R(upd_params.start_time, 30, params.start_time + params.end_days, f_out, P({ b: upd_params.new_amount }))
            );
        }
    }
};

export const manual_correction = (event: any, envelopes: Record<string, ((t: number) => number)[]>) => {
    const params = event.parameters;
    const to_key = params.to_key;
    const is_positive = params.amount > 0;

    const correction_func = (is_positive ? f_in : f_out)(P({ [is_positive ? "a" : "b"]: Math.abs(params.amount) }), params.start_time);
    envelopes[to_key].push(D(params.start_time, correction_func, (_t: number) => 0));

    if (to_key !== "Cash") {
        envelopes[to_key].push(
            f_com(P({ P: params.amount, r: params.rate }), params.start_time)
        );
    }
};
