export function extractSchema(schema: any) {
    const eventSchemas: Record<string, any> = {};

    for (const event of schema.events) {
        const eventType = event.type;
        const params = event.parameters; // Store full parameter objects

        eventSchemas[eventType] = {
            params,
            updating_events: {}
        };

        if (event.updating_events) {
            for (const update of event.updating_events) {
                const updateType = update.type;
                const updateParams = update.parameters; // Store full parameter objects
                eventSchemas[eventType].updating_events[updateType] = updateParams;
            }
        }
    }

    return eventSchemas;
}

export function validateParameters(
    eventType: string,
    eventId: string,
    expectedParams: any[], // Changed from Set<string> to any[]
    providedParams: any[],
    isUpdating = false,
    parentEventId?: string
): string[] {
    const errors: string[] = [];

    // Filter out non-editable parameters from expected params
    const expectedTypes = new Set(expectedParams.map(p => p.type));
    const providedTypes = new Set(providedParams.map(p => p.type));

    const missing = [...expectedTypes].filter(p => !providedTypes.has(p));
    if (missing.length > 0) {
        const desc = isUpdating ? `${eventType} under ${parentEventId}` : eventType;
        errors.push(`❌ Missing in ${desc}: ${missing}`);
    }

    // For unexpected parameters, only flag them as errors if they are editable
    // Non-editable unexpected parameters are allowed (they might be calculated/system-generated)
    const editableProvidedParams = providedParams.filter(p => p.editable !== false);
    const editableProvidedTypes = new Set(editableProvidedParams.map(p => p.type));
    const extra = [...editableProvidedTypes].filter(p => !expectedTypes.has(p));
    if (extra.length > 0) {
        const desc = isUpdating ? `updating event ${eventType}, parent event ${parentEventId}` : `event ${eventId} (${eventType})`;
        errors.push(`❌ Unexpected parameters in ${desc}: ${extra}`);
    }

    const paramIds = providedParams.map(p => p.id);
    const duplicates = [...new Set(paramIds.filter((id, idx) => paramIds.indexOf(id) !== idx))];
    if (duplicates.length > 0) {
        const desc = isUpdating ? `updating event ${eventType}, parent event ${parentEventId}` : `event ${eventId} (${eventType})`;
        errors.push(`❌ Duplicate parameter ids in ${desc}: ${duplicates}`);
    }

    return errors;
}

export function validateEventIds(events: any[], isUpdating = false, parentEventId?: string): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const event of events) {
        const id = event.id;
        if (seen.has(id)) {
            const desc = isUpdating ? `updating event id in event ${parentEventId}` : "event id";
            errors.push(`❌ Duplicate ${desc}: ${id}`);
        } else {
            seen.add(id);
        }
    }

    return errors;
}


// Exported helper: Get all valid event categories from the schema
export function getValidCategories(schema: any): Set<string> {
    // Use the top-level categories array
    return new Set(schema.categories);
}

export function validateProblem(problem: any, schemaMap: any, schema?: any, plan?: any): string[] {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    // --- Envelope category check ---
    if (problem.envelopes && schema) {
        const validCategories = getValidCategories(schema);
        for (const envelope of problem.envelopes) {
            if (envelope.category && !validCategories.has(envelope.category)) {
                errors.push(`❌ Envelope "${envelope.name}" has unknown category "${envelope.category}"`);
            }
        }
    }

    // --- Envelope parameter value check ---
    // Only run if plan is provided and has envelopes
    let validEnvelopeNames: Set<string> = new Set();
    if (plan && plan.envelopes) {
        validEnvelopeNames = new Set(plan.envelopes.map((e: any) => e.name));
    }

    for (const event of problem.events) {
        const type = event.type;
        const id = event.id;

        if (!(type in schemaMap)) {
            errors.push(`❌ Unknown event type: ${type}`);
            continue;
        }

        errors.push(...validateParameters(type, id, schemaMap[type].params, event.parameters || []));

        // Envelope parameter check for main event
        if (event.parameters && validEnvelopeNames.size > 0) {
            for (const param of event.parameters) {
                if (param.type === 'envelope' && !validEnvelopeNames.has(param.value)) {
                    errors.push(`❌ Invalid envelope name "${param.value}" in event ${id} (${type})`);
                }
            }
        }

        if (seenIds.has(id)) {
            errors.push(`❌ Duplicate event id: ${id}`);
        } else {
            seenIds.add(id);
        }

        if (event.updating_events) {
            for (const upd of event.updating_events) {
                const updType = upd.type;
                const updId = upd.id;

                if (!(updType in schemaMap[type].updating_events)) {
                    errors.push(`❌ Unknown updating event type: ${updType} under ${type}`);
                    continue;
                }

                errors.push(...validateParameters(updType, updId, schemaMap[type].updating_events[updType], upd.parameters || [], true, id));

                // Envelope parameter check for updating event
                if (upd.parameters && validEnvelopeNames.size > 0) {
                    for (const param of upd.parameters) {
                        if (param.type === 'envelope' && !validEnvelopeNames.has(param.value)) {
                            errors.push(`❌ Invalid envelope name "${param.value}" in updating event ${updId} (${updType}), parent event ${id}`);
                        }
                    }
                }
            }

            errors.push(...validateEventIds(event.updating_events, true, id));
        }
    }

    return errors;
}

export function parseEvents(problem: any) {
    return problem.events.map((event: any) => ({
        id: event.id,
        type: event.type,
        description: event.description || "",
        is_recurring: event.is_recurring || false,
        parameters: Object.fromEntries(event.parameters.map((p: any) => [p.type, p.value])),
        event_functions: Object.fromEntries((event.event_functions || []).map((f: any) => [f.type, f.enabled])),
        updating_events: (event.updating_events || []).map((upd: any) => ({
            id: upd.id,
            type: upd.type,
            description: upd.description || "",
            parameters: Object.fromEntries(upd.parameters.map((p: any) => [p.type, p.value])),
            event_functions: Object.fromEntries((upd.event_functions || []).map((f: any) => [f.type, f.enabled]))
        }))
    }));
}