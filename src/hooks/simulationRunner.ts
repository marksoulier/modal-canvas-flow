// simulationRunner.ts
import { extractSchema, validateProblem, parseEvents } from './schemaChecker';
import {
    get_job, purchase, gift, start_business, retirement,
    buy_house, buy_car, have_kid, marriage, divorce, pass_away,
    buy_health_insurance, buy_life_insurance,
    receive_government_aid, invest_money,
    high_yield_savings_account, pay_taxes, buy_groceries, manual_correction,
    get_wage_job, transfer_money, reoccuring_income, reoccuring_spending, reoccuring_transfer,
    declare_accounts,
    monthly_budgeting, roth_ira_contribution, tax_payment_estimated
} from './baseFunctions';
import { evaluateResults } from './resultsEvaluation';
import type { Plan, Schema } from '../contexts/PlanContext';

interface Datum {
    date: number;
    value: number;
    parts: {
        [key: string]: number;
    };
}

export function initializeEnvelopes(plan: Plan): Record<string, { functions: ((t: number) => number)[], growth_type: string, growth_rate: number, days_of_usefulness?: number }> {
    const envelopes: Record<string, { functions: ((t: number) => number)[], growth_type: string, growth_rate: number, days_of_usefulness?: number }> = {};

    for (const env of plan.envelopes) {
        const name = env.name;
        const growth_type = env.growth || "None";
        const rate = env.rate || 0.0;
        const days_of_usefulness = env.days_of_usefulness;
        envelopes[name] = { functions: [], growth_type, growth_rate: rate, days_of_usefulness };
    }

    return envelopes;
}

export async function runSimulation(
    plan: Plan,
    schema: Schema,
    startDate: number = 0,
    endDate: number = 30 * 365,
    interval: number = 365,
    currentDay?: number
): Promise<Datum[]> {
    try {
        const schemaMap = extractSchema(schema);
        const issues = validateProblem(plan, schemaMap, schema, plan);
        if (issues.length > 0) {
            console.error("❌ Validation issues found:");
            for (const issue of issues) console.error(issue);
            console.log('[runSimulation] Issues:', issues);
            return [];
        }

        const parsedEvents = parseEvents(plan);
        const envelopes = initializeEnvelopes(plan);
        //console.log('Initialized envelopes:', envelopes);
        // Collect manual_correction events to process at the end
        const manualCorrectionEvents: any[] = [];
        // Collect declare_accounts events to process at the end
        const declareAccountsEvents: any[] = [];

        for (const event of parsedEvents) {
            //console.log("Event: ", event.type)

            // Skip manual_correction events during the first pass
            if (event.type === 'manual_correction') {
                manualCorrectionEvents.push(event);
                continue;
            }

            // Skip declare_accounts events during the first pass
            if (event.type === 'declare_accounts') {
                declareAccountsEvents.push(event);
                continue;
            }

            switch (event.type) {
                case 'purchase': purchase(event, envelopes); break;
                case 'gift': gift(event, envelopes); break;
                case 'get_job': get_job(event, envelopes); break;
                case 'get_wage_job': get_wage_job(event, envelopes); break;
                case 'start_business': start_business(event, envelopes); break;
                case 'retirement': retirement(event, envelopes); break;
                case 'buy_house': buy_house(event, envelopes); break;
                case 'buy_car': buy_car(event, envelopes); break;
                case 'have_kid': have_kid(event, envelopes); break;
                case 'marriage': marriage(event, envelopes); break;
                case 'divorce': divorce(event, envelopes); break;
                case 'buy_health_insurance': buy_health_insurance(event, envelopes); break;
                case 'buy_life_insurance': buy_life_insurance(event, envelopes); break;
                case 'receive_government_aid': receive_government_aid(event, envelopes); break;
                case 'invest_money': invest_money(event, envelopes); break;
                case 'high_yield_savings_account': high_yield_savings_account(event, envelopes); break;
                case 'pay_taxes': pay_taxes(event, envelopes); break;
                case 'buy_groceries': buy_groceries(event, envelopes); break;
                case 'transfer_money': transfer_money(event, envelopes); break;
                case 'reoccuring_income': reoccuring_income(event, envelopes); break;
                case 'reoccuring_spending': reoccuring_spending(event, envelopes); break;
                case 'reoccuring_transfer': reoccuring_transfer(event, envelopes); break;
                case 'pass_away': pass_away(event, envelopes); break;
                case 'monthly_budgeting': monthly_budgeting(event, envelopes); break;
                case 'roth_ira_contribution': roth_ira_contribution(event, envelopes); break;
                case 'tax_payment_estimated': tax_payment_estimated(event, envelopes); break;
                default:
                    console.warn(`⚠️ Unhandled event type: ${event.type}`);
            }
        }

        // Process all manual_correction events at the end
        //console.log(`Processing ${manualCorrectionEvents.length} manual correction events at the end`);
        for (const event of manualCorrectionEvents) {
            //console.log("Manual correction event: ", event.parameters);
            manual_correction(event, envelopes);
        }

        // Process all declare_accounts events at the end
        //console.log(`Processing ${declareAccountsEvents.length} declare_accounts events at the end`);
        for (const event of declareAccountsEvents) {
            //console.log("Declare accounts event: ", event.parameters);
            declare_accounts(event, envelopes);
        }

        //console.log(envelopes)

        // Determine if we should adjust for inflation
        let results;
        if (plan.adjust_for_inflation) {
            // Use inflation rate from schema
            const inflationRate = schema.inflation_rate;
            results = evaluateResults(envelopes, startDate, endDate, interval, currentDay, inflationRate);
        } else {
            results = evaluateResults(envelopes, startDate, endDate, interval);
        }
        const timePoints = Array.from({ length: Math.ceil(endDate / interval) }, (_, i) => i * interval);

        // Get all envelope keys from the results
        const envelopeKeys = Object.keys(results);

        // Filter out envelopes that have zero values in all intervals
        const nonZeroEnvelopeKeys = envelopeKeys.filter(key => {
            const allValues = results[key];
            return allValues.some(value => value !== 0);
        });

        // Create a single array of Datum objects where each Datum contains all non-zero envelope values as parts
        return timePoints.map((date, i) => {
            const parts: { [key: string]: number } = {};
            let totalValue = 0;

            // Populate parts with values from each non-zero envelope
            nonZeroEnvelopeKeys.forEach(key => {
                const value = results[key][i];
                parts[key] = value;
                totalValue += value;
            });

            return {
                date,
                value: totalValue,
                parts
            };
        });
    } catch (error) {
        console.error('Error running simulation:', error);
        throw error;
    }
}

// Example:
// const output = runSimulation('plan2.json', 'event_schema.json');
// console.log(output);
