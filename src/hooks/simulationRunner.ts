// simulationRunner.ts
import { extractSchema, validateProblem, parseEvents } from './schemaChecker';
import {
    get_job, purchase, gift, start_business, retirement,
    buy_house, buy_car, have_kid, marriage, divorce, pass_away,
    buy_health_insurance, buy_life_insurance,
    receive_government_aid, invest_money,
    high_yield_savings_account, pay_taxes, buy_groceries, manual_correction,
    get_wage_job, transfer_money
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

export function initializeEnvelopes(): Record<string, ((t: number) => number)[]> {
    return {
        Cash: [],
        House: [],
        Savings: [],
        Investments: [],
        Retirement: []
    };
}

export async function runSimulation(
    plan: Plan,
    schema: Schema,
    startDate: number = 0,
    endDate: number = 30 * 365,
    interval: number = 365
): Promise<Datum[]> {
    try {
        const schemaMap = extractSchema(schema);
        const issues = validateProblem(plan, schemaMap);

        if (issues.length > 0) {
            console.error("❌ Validation issues found:");
            for (const issue of issues) console.error(issue);
            return [];
        }

        const parsedEvents = parseEvents(plan);
        const envelopes = initializeEnvelopes();

        for (const event of parsedEvents) {
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
                case 'manual_correction': manual_correction(event, envelopes); break;
                case 'transfer_money': transfer_money(event, envelopes); break;
                case 'pass_away': pass_away(event, envelopes); break;
                default:
                    console.warn(`⚠️ Unhandled event type: ${event.type}`);
            }
        }

        const results = evaluateResults(envelopes, startDate, endDate, interval);
        const timePoints = Array.from({ length: Math.ceil(endDate / interval) }, (_, i) => i * interval);

        // Get all envelope keys from the results
        const envelopeKeys = Object.keys(results);

        // Filter out envelopes that have zero values in the first interval
        const nonZeroEnvelopeKeys = envelopeKeys.filter(key => {
            const firstValue = results[key][0];
            return firstValue !== 0;
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
