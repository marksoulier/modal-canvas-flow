import type { Plan, Schema, Event, UpdatingEvent, Parameter, Envelope, SchemaParameter } from '../contexts/PlanContext';

interface EventSummary {
    title: string;
    type: string;
    startDate: Date | null;
    endDate: Date | null;
    isRecurring: boolean;
    nextOccurrence: Date | null;
    keyAmounts: string[];
    description: string;
    allParams: string[];
    allParamsWithDesc: string[];
}

function parseDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;

    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return null;
        return date;
    } catch {
        return null;
    }
}

function isAmountKey(key: string): boolean {
    const k = key.toLowerCase();
    return [
        'amount',
        'salary',
        'money',
        'downpayment',
        'home_value',
        'loan_rate',
        'rate',
        'payment',
        'value'
    ].some(token => k.includes(token));
}

function formatNumber(value: any): string | null {
    if (typeof value === 'boolean') return null;

    if (typeof value === 'number') {
        // Handle percentages (values between -1 and 1, excluding 0)
        if (value > -1 && value < 1 && value !== 0) {
            return `${(value * 100).toFixed(2)}%`;
        }
        // Handle large numbers with currency
        if (Math.abs(value) >= 1000) {
            return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        }
        // Handle integers
        if (Number.isInteger(value)) {
            return value.toString();
        }
        // Handle decimals
        return value.toFixed(2);
    }

    // Handle string numbers
    if (typeof value === 'string') {
        const cleanValue = value.trim().replace(/,/g, '');
        const num = parseFloat(cleanValue);
        if (!isNaN(num)) {
            return formatNumber(num);
        }
    }

    return null;
}

function collectKeyAmountSnippets(parameters: Parameter[], maxItems: number = 3): string[] {
    const entries: [string, string][] = [];

    // First try explicit amount-like keys
    parameters.forEach(p => {
        const key = p.type || '';
        if (key && isAmountKey(key)) {
            const formatted = formatNumber(p.value);
            if (formatted) {
                entries.push([key, formatted]);
            }
        }
    });

    // If nothing found, try any numeric values
    if (entries.length === 0) {
        parameters.forEach(p => {
            const key = p.type || 'value';
            const formatted = formatNumber(p.value);
            if (formatted) {
                entries.push([key, formatted]);
            }
        });
    }

    // Deduplicate preserving order
    const seen = new Set<string>();
    const deduped: [string, string][] = [];

    for (const [k, v] of entries) {
        if (!seen.has(k)) {
            seen.add(k);
            deduped.push([k, v]);
            if (deduped.length >= maxItems) break;
        }
    }

    return deduped.map(([k, v]) => `${k}: ${v}`);
}

function getParamValue(parameters: Parameter[], key: string): any {
    const param = parameters.find(p => p.type?.toLowerCase() === key.toLowerCase());
    return param?.value;
}

function formatValue(value: any): string {
    const num = formatNumber(value);
    if (num !== null) return num;
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

function collectAllParamSnippets(parameters: Parameter[]): string[] {
    return parameters.map(p => {
        const key = p.type || 'value';
        return `${key}: ${formatValue(p.value)}`;
    });
}

function computeNextOccurrence(
    start: Date | null,
    end: Date | null,
    frequencyDays: number | null,
    today: Date
): Date | null {
    if (!start) return null;
    if (end && today > end) return null;
    if (!frequencyDays || frequencyDays <= 0) {
        // One-time event
        return start >= today ? start : null;
    }

    if (start >= today) return start;

    const deltaDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const cycles = Math.ceil(deltaDays / frequencyDays);
    const nextDate = new Date(start.getTime() + cycles * frequencyDays * 24 * 60 * 60 * 1000);

    if (end && nextDate > end) return null;
    return nextDate;
}

function summarizeEvent(evt: Event | UpdatingEvent, today: Date): EventSummary {
    const title = evt.title.trim() || evt.type.replace(/_/g, ' ');
    const params = evt.parameters || [];

    const start = parseDate(getParamValue(params, 'start_time'));
    const end = parseDate(getParamValue(params, 'end_time'));
    const frequencyDays = Number(getParamValue(params, 'frequency_days')) || null;

    const nextOcc = computeNextOccurrence(start, end, frequencyDays, today);
    const keyAmounts = collectKeyAmountSnippets(params);
    const allParams = collectAllParamSnippets(params);

    return {
        title,
        type: evt.type,
        startDate: start,
        endDate: end,
        isRecurring: evt.is_recurring,
        nextOccurrence: nextOcc,
        keyAmounts,
        description: 'description' in evt ? evt.description : '',
        allParams,
        allParamsWithDesc: [] // Will be filled later when schema is available
    };
}

function computeAge(birth: Date, onDate: Date): number {
    let years = onDate.getFullYear() - birth.getFullYear();
    if (
        onDate.getMonth() < birth.getMonth() ||
        (onDate.getMonth() === birth.getMonth() && onDate.getDate() < birth.getDate())
    ) {
        years--;
    }
    return Math.max(0, years);
}

function buildParamDescriptionIndex(schema: Schema): Record<string, Record<string, { description?: string; displayName?: string; units?: string }>> {
    const index: Record<string, Record<string, { description?: string; displayName?: string; units?: string }>> = {};

    schema.events.forEach(ev => {
        const evType = ev.type.toLowerCase();
        if (!evType) return;

        ev.parameters.forEach(p => {
            const pType = p.type?.toLowerCase();
            if (!pType) return;

            const meta = {
                description: p.description,
                displayName: p.display_name,
                units: p.parameter_units
            };

            if (!index[evType]) index[evType] = {};
            index[evType][pType] = meta;
        });

        // Also index updating events
        ev.updating_events?.forEach(u => {
            const uType = u.type.toLowerCase();
            if (!uType) return;

            // Note: Schema updating events don't have their own parameters defined
            // They inherit from the main event's parameters
        });
    });

    return index;
}

function enrichParamsWithSchema(
    eventType: string,
    parameters: Parameter[],
    paramDescIndex: Record<string, Record<string, { description?: string; displayName?: string; units?: string }>>
): string[] {
    const lines: string[] = [];
    const metaForEvent = paramDescIndex[eventType.toLowerCase()] || {};

    parameters.forEach(p => {
        const key = p.type || 'value';
        const meta = metaForEvent[key.toLowerCase()] || {};

        let line = `${key}: ${formatValue(p.value)}`;
        const extras: string[] = [];

        if (meta.units) extras.push(`units=${meta.units}`);
        if (meta.displayName) extras.push(`label=${meta.displayName}`);
        if (meta.description) extras.push(`desc=${meta.description}`);

        if (extras.length > 0) {
            line += ` (${extras.join('; ')})`;
        }

        lines.push(line);
    });

    return lines;
}

export function summarizeRetirementPlan(plan: Plan, schema: Schema | null, maxNextEvents: number = 5): string {
    const today = new Date();
    const events: (Event | UpdatingEvent)[] = [...plan.events];

    // Build summaries
    const eventSummaries: EventSummary[] = events.map(evt => summarizeEvent(evt, today));

    // Enrich with schema if available
    if (schema) {
        const paramDescIndex = buildParamDescriptionIndex(schema);
        events.forEach((evt, idx) => {
            const enriched = enrichParamsWithSchema(
                eventSummaries[idx].type,
                evt.parameters,
                paramDescIndex
            );
            eventSummaries[idx].allParamsWithDesc = enriched;
        });
    }

    // Upcoming events sorted by next occurrence
    const upcoming = eventSummaries
        .filter(e => e.nextOccurrence !== null)
        .sort((a, b) => (a.nextOccurrence!.getTime() - b.nextOccurrence!.getTime()));

    const upcomingDisplay = upcoming.slice(0, maxNextEvents);

    // Initialize output lines array
    const lines: string[] = [];

    // Format header
    const headerParts: string[] = [`Snapshot as of Today: ${today.toISOString().split('T')[0]}.`];

    // Global plan fields
    const metaSnippets: string[] = [];

    // Add simulation results summary if available
    if (plan.simulation_results && plan.simulation_results.length > 0) {
        const firstPoint = plan.simulation_results[0];
        const lastPoint = plan.simulation_results[plan.simulation_results.length - 1];

        // Calculate total timespan
        const totalDays = lastPoint.date - firstPoint.date;
        const totalYears = Math.round(totalDays / 365);
        metaSnippets.push(`Simulation period: ${totalYears} years`);

        // Net worth progression
        const startValue = formatNumber(firstPoint.value) || '0';
        const endValue = formatNumber(lastPoint.value) || '0';
        metaSnippets.push(`Net worth progression: ${startValue} → ${endValue}`);

        // Add 10 snapshots throughout the simulation
        metaSnippets.push('\nKey milestones:');
        const numSnapshots = 10;
        const stepSize = Math.floor(plan.simulation_results.length / (numSnapshots - 1));

        for (let i = 0; i < numSnapshots; i++) {
            const index = Math.min(i * stepSize, plan.simulation_results.length - 1);
            const point = plan.simulation_results[index];
            const age = Math.floor(point.date / 365); // point.date is already days since birth
            const birthDate = parseDate(plan.birth_date);
            const date = birthDate ? new Date(birthDate.getTime() + (point.date * 24 * 60 * 60 * 1000)) : new Date();

            metaSnippets.push(`\n${date.toISOString().split('T')[0]} (Age ${age}):`);
            metaSnippets.push(`  Net Worth: ${formatNumber(point.value)}`);

            // Add account balances
            if (point.parts) {
                Object.entries(point.parts)
                    .sort(([, a], [, b]) => b - a) // Sort by balance descending
                    .forEach(([account, balance]) => {
                        if (balance !== 0) {
                            metaSnippets.push(`  ${account}: ${formatNumber(balance)}`);
                        }
                    });
            }
        }

        // Find highest net worth point
        const peakPoint = plan.simulation_results.reduce((max, point) =>
            point.value > max.value ? point : max
            , firstPoint);
        const peakValueFormatted = formatNumber(peakPoint.value) || '0';
        metaSnippets.push(`Peak net worth: ${peakValueFormatted}`);

        // Add account summary if available
        if (lastPoint.parts && Object.keys(lastPoint.parts).length > 0) {
            metaSnippets.push('\nFinal account balances:');
            Object.entries(lastPoint.parts)
                .sort(([, a], [, b]) => b - a)
                .forEach(([account, balance]) => {
                    const formattedBalance = formatNumber(balance) || '0';
                    metaSnippets.push(`  ${account}: ${formattedBalance}`);
                });
        }
    }

    const birthDate = parseDate(plan.birth_date);
    if (birthDate) {
        const ageToday = computeAge(birthDate, today);
        metaSnippets.push(`Birth date: ${birthDate.toISOString().split('T')[0]}; Age: ${ageToday}`);
    }

    // Add personal information
    if (plan.location) {
        metaSnippets.push(`Location: ${plan.location}`);
    }
    if (plan.degree) {
        metaSnippets.push(`Education: ${plan.degree}`);
    }
    if (plan.occupation) {
        metaSnippets.push(`Occupation: ${plan.occupation}`);
    }
    if (plan.goals) {
        metaSnippets.push(`Goals: ${plan.goals}`);
    }

    if (plan.retirement_goal) {
        const fmt = formatNumber(plan.retirement_goal);
        if (fmt) metaSnippets.push(`Retirement goal: ${fmt}`);
    }

    if (plan.inflation_rate !== undefined) {
        const fmt = formatNumber(plan.inflation_rate);
        if (fmt) metaSnippets.push(`Assumed inflation: ${fmt}`);
    }

    if (metaSnippets.length > 0) {
        headerParts.push(metaSnippets.join(' '));
    }



    // Build output
    lines.push(...headerParts);

    // Upcoming section
    if (upcomingDisplay.length > 0) {
        lines.push('\nNext events:');
        upcomingDisplay.forEach(e => {
            const dateStr = e.nextOccurrence?.toISOString().split('T')[0] || 'N/A';
            const keyAmt = e.keyAmounts.length > 0 ? ` | ${e.keyAmounts.join('; ')}` : '';
            const recur = e.isRecurring ? ' (recurring)' : '';
            const desc = e.description ? ` | desc: ${e.description}` : '';
            let agePart = '';
            if (birthDate && e.nextOccurrence) {
                const ageAtNext = computeAge(birthDate, e.nextOccurrence);
                agePart = ` | age: ${ageAtNext}`;
            }
            lines.push(`- ${dateStr}: ${e.title}${recur}${keyAmt}${desc}${agePart}`);
        });
    } else {
        lines.push('\nNext events: None scheduled.');
    }

    // All events detailed
    lines.push('\nPlan events (detailed):');

    // Sort by start date then title
    const sortedSummaries = [...eventSummaries].sort((a, b) => {
        if (!a.startDate && !b.startDate) return a.title.localeCompare(b.title);
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        const dateCompare = a.startDate.getTime() - b.startDate.getTime();
        return dateCompare === 0 ? a.title.localeCompare(b.title) : dateCompare;
    });

    sortedSummaries.forEach(e => {
        const startStr = e.startDate?.toISOString().split('T')[0] || 'N/A';
        const endStr = e.endDate?.toISOString().split('T')[0] || 'N/A';
        const recur = e.isRecurring ? ' (recurring)' : '';

        lines.push(`- ${e.title} [type=${e.type}]${recur}`);
        lines.push(`  - Dates: start=${startStr}, end=${endStr}`);

        if (birthDate && e.startDate) {
            lines.push(`  - Age at start: ${computeAge(birthDate, e.startDate)}`);
        }

        if (e.nextOccurrence) {
            lines.push(`  - Next occurrence: ${e.nextOccurrence.toISOString().split('T')[0]}`);
        }

        if (e.description) {
            lines.push(`  - Description: ${e.description}`);
        }

        if (e.keyAmounts.length > 0) {
            lines.push(`  - Key amounts: ${e.keyAmounts.join('; ')}`);
        }

        const detailedParams = e.allParamsWithDesc.length > 0 ? e.allParamsWithDesc : e.allParams;
        if (detailedParams.length > 0) {
            lines.push('  - Parameters:');
            detailedParams.forEach(p => lines.push(`    - ${p}`));
        }
    });

    // Envelopes overview
    if (plan.envelopes && plan.envelopes.length > 0) {
        lines.push('\nEnvelopes:');
        plan.envelopes.forEach((env: Envelope) => {
            const parts: string[] = [];

            // Use the envelope name instead of account_type
            const envelopeName = env.name || env.account_type || 'Unnamed Account';
            parts.push(envelopeName);

            // Add category if present and different from name
            if (env.category && env.category !== envelopeName) {
                parts.push(`Category: ${env.category}`);
            }

            // Add growth and rate if present
            if (env.growth && env.growth !== 'None') parts.push(`Growth: ${env.growth}`);
            if (env.rate !== undefined && env.rate !== 0) parts.push(`Rate: ${formatValue(env.rate)}`);
            if (env.days_of_usefulness) parts.push(`Days of usefulness: ${env.days_of_usefulness}`);

            lines.push(`- ${parts.join('; ')}`);
        });
    }

    return lines.join('\n');
}
