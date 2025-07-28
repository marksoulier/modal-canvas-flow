// simulationRunner.ts
import { extractSchema, validateProblem, parseEvents } from './schemaChecker';
import {
    get_job, inflow, outflow, gift, start_business, retirement,
    buy_house, buy_car, have_kid, marriage, divorce, pass_away,
    buy_health_insurance, buy_life_insurance,
    receive_government_aid, invest_money,
    high_yield_savings_account, pay_taxes, buy_groceries, manual_correction,
    get_wage_job, transfer_money, income_with_changing_parameters,
    declare_accounts, purchase,
    monthly_budgeting, roth_ira_contribution, tax_payment_estimated,
    reoccuring_spending_inflation_adjusted, loan_amortization, loan,
    federal_subsidized_loan, federal_unsubsidized_loan, private_student_loan,
    usa_tax_system
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

export function initializeEnvelopes(plan: Plan, simulation_settings: any): Record<string, any> {
    const envelopes: Record<string, any> = {};

    //console.log("plan.envelopes", plan.envelopes);
    for (const env of plan.envelopes) {
        const name = env.name;
        const growth_type = env.growth || "None";
        const rate = env.rate || 0.0;
        const days_of_usefulness = env.days_of_usefulness;
        const inflation_rate = plan.inflation_rate;
        const account_type = env.account_type;
        envelopes[name] = { functions: [], growth_type, growth_rate: rate, days_of_usefulness, inflation_rate, account_type };
    }

    // Add simulation settings to envelopes
    envelopes.simulation_settings = simulation_settings;

    return envelopes;
}

export async function runSimulation(
    plan: Plan,
    schema: Schema,
    startDate: number = 0,
    endDate: number = 30 * 365,
    interval: number = 365,
    currentDay?: number,
    birthDate?: Date,
    onPlanUpdate?: (updates: Array<{ eventId: number, paramType: string, value: number }>) => void
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

        const simulation_settings = {
            inflation_rate: plan.inflation_rate,
            birthDate: birthDate,
            interval: interval,
            start_time: startDate,
            end_time: endDate
        };

        const parsedEvents = parseEvents(plan);

        const envelopes = initializeEnvelopes(plan, simulation_settings);
        //console.log('Initialized envelopes:', envelopes);
        // Collect manual_correction events to process at the end
        const manualCorrectionEvents: any[] = [];
        // Collect declare_accounts events to process at the end
        const declareAccountsEvents: any[] = [];
        // Collect plan updates from events
        const planUpdates: Array<{ eventId: number, paramType: string, value: number }> = [];

        for (const event of parsedEvents) {
            console.log("Event: ", event)

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
                case 'inflow': inflow(event, envelopes); break;
                case 'outflow': outflow(event, envelopes); break;
                case 'purchase': purchase(event, envelopes); break;
                case 'gift': gift(event, envelopes); break;
                case 'get_job': get_job(event, envelopes); break;
                case 'get_wage_job': get_wage_job(event, envelopes); break;
                case 'start_business': start_business(event, envelopes); break;
                case 'retirement': retirement(event, envelopes); break;
                case 'buy_house': buy_house(event, envelopes, (updates) => {
                    planUpdates.push(...updates);
                }); break;
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
                case 'income_with_changing_parameters': income_with_changing_parameters(event, envelopes); break;
                case 'reoccuring_spending_inflation_adjusted': reoccuring_spending_inflation_adjusted(event, envelopes); break;
                case 'pass_away': pass_away(event, envelopes); break;
                case 'monthly_budgeting': monthly_budgeting(event, envelopes); break;
                case 'roth_ira_contribution': roth_ira_contribution(event, envelopes); break;
                case 'tax_payment_estimated': tax_payment_estimated(event, envelopes); break;
                case 'loan_amortization': loan_amortization(event, envelopes); break;
                case 'loan': loan(event, envelopes); break;
                case 'federal_subsidized_loan': federal_subsidized_loan(event, envelopes); break;
                case 'federal_unsubsidized_loan': federal_unsubsidized_loan(event, envelopes); break;
                case 'private_student_loan': private_student_loan(event, envelopes); break;
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

        // Process usa_tax_system events at the end
        for (const event of parsedEvents) {
            //console.log("Event: ", event);
            if (event.type === 'usa_tax_system') {
                usa_tax_system(event, envelopes);
            }
        }

        // Apply plan updates if callback is provided
        if (onPlanUpdate && planUpdates.length > 0) {
            onPlanUpdate(planUpdates);
        }

        //console.log(envelopes)

        // Remove simulation_settings from envelopes for evaluation
        const allEvalEnvelopes = Object.fromEntries(
            Object.entries(envelopes)
                .filter(([key, env]) => key !== 'simulation_settings')
        );

        console.log("allEvalEnvelopes", allEvalEnvelopes);

        let allResults;
        if (plan.adjust_for_inflation) {
            const inflationRate = plan.inflation_rate;
            allResults = evaluateResults(allEvalEnvelopes, startDate, endDate, interval, currentDay, inflationRate);
        } else {
            allResults = evaluateResults(allEvalEnvelopes, startDate, endDate, interval);
        }

        // Now split the results into networth and non-networth for visualization
        const envelopeKeys = Object.keys(allResults);
        const timePoints = Array.from({ length: Math.ceil(endDate / interval) }, (_, i) => i * interval);

        const networthKeys = envelopeKeys.filter(key => envelopes[key]?.account_type !== 'non-networth-account');
        const nonNetworthKeys = envelopeKeys.filter(key => envelopes[key]?.account_type === 'non-networth-account');

        // Filter out envelopes that have zero values in all intervals
        const nonZeroNetworthKeys = networthKeys.filter(key => allResults[key].some(value => value !== 0));
        const nonZeroNonNetworthKeys = nonNetworthKeys.filter(key => allResults[key].some(value => value !== 0));

        // Create a single array of Datum objects where each Datum contains all non-zero envelope values as parts
        return timePoints.map((date, i) => {
            const parts: { [key: string]: number } = {};
            const nonNetworthParts: { [key: string]: number } = {};
            let totalValue = 0;

            // Populate parts with values from each non-zero envelope
            nonZeroNetworthKeys.forEach(key => {
                const value = allResults[key][i];
                parts[key] = value;
                totalValue += value;
            });

            // Populate non-networth parts (these don't contribute to total value)
            nonZeroNonNetworthKeys.forEach(key => {
                const value = allResults[key][i];
                nonNetworthParts[key] = value;
            });

            return {
                date,
                value: totalValue,
                parts,
                nonNetworthParts
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
