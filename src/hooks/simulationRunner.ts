// simulationRunner.ts
import { extractSchema, validateProblem, parseEvents } from './schemaChecker';
import {
    get_job, purchase, gift, start_business, retirement,
    buy_house, buy_car, have_kid, marriage, divorce, pass_away,
    buy_health_insurance, buy_life_insurance,
    receive_government_aid, invest_money,
    high_yield_savings_account, pay_taxes, buy_groceries, manual_correction
} from './baseFunctions';
import { evaluateResults } from './resultsEvaluation';

interface Datum {
    x: number;
    y: number;
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

export async function runSimulation(planPath: string, schemaPath: string): Promise<Record<string, Datum[]> | undefined> {
    try {
        const schemaDict = await fetch(schemaPath).then(res => res.json());
        const problemDict = await fetch(planPath).then(res => res.json());

        const schemaMap = extractSchema(schemaDict);
        const issues = validateProblem(problemDict, schemaMap);

        if (issues.length > 0) {
            console.error("❌ Validation issues found:");
            for (const issue of issues) console.error(issue);
            return;
        }

        const parsedEvents = parseEvents(problemDict);
        const envelopes = initializeEnvelopes();

        for (const event of parsedEvents) {
            switch (event.type) {
                case 'purchase': purchase(event, envelopes); break;
                case 'gift': gift(event, envelopes); break;
                case 'get_job': get_job(event, envelopes); break;
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
                case 'pass_away': pass_away(event, envelopes); break;
                default:
                    console.warn(`⚠️ Unhandled event type: ${event.type}`);
            }
        }

        const tEnd = 20 * 365;
        const interval = 5;
        const results = evaluateResults(envelopes, 0, tEnd, interval);

        const data: Record<string, Datum[]> = {};
        const timePoints = Array.from({ length: Math.ceil(tEnd / interval) }, (_, i) => i * interval);

        for (const [key, values] of Object.entries(results)) {
            data[key] = values.map((y, i) => ({ x: timePoints[i], y }));
        }

        return data;
    } catch (error) {
        console.error('❌ Error in runSimulation:', error);
        throw error;
    }
}

// Example:
// const output = runSimulation('plan2.json', 'event_schema.json');
// console.log(output);
