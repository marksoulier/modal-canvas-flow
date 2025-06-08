export function extractSchema(schema: any) {
    const eventSchemas: Record<string, any> = {};

    for (const event of schema.events) {
        const eventType = event.type;
        const params = new Set(event.parameters.map((p: any) => p.type));

        eventSchemas[eventType] = {
            params,
            updating_events: {}
        };

        if (event.updating_events) {
            for (const update of event.updating_events) {
                const updateType = update.type;
                const updateParams = new Set(update.parameters.map((p: any) => p.type));
                eventSchemas[eventType].updating_events[updateType] = updateParams;
            }
        }
    }

    return eventSchemas;
}

export function validateParameters(
    eventType: string,
    eventId: string,
    expectedParams: Set<string>,
    providedParams: any[],
    isUpdating = false,
    parentEventId?: string
): string[] {
    const errors: string[] = [];
    const providedTypes = new Set(providedParams.map(p => p.type));

    const missing = [...expectedParams].filter(p => !providedTypes.has(p));
    if (missing.length > 0) {
        const desc = isUpdating ? `${eventType} under ${parentEventId}` : eventType;
        errors.push(`❌ Missing in ${desc}: ${missing}`);
    }

    const extra = [...providedTypes].filter(p => !expectedParams.has(p));
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

export function validateProblem(problem: any, schemaMap: any): string[] {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    for (const event of problem.events) {
        const type = event.type;
        const id = event.id;

        if (!(type in schemaMap)) {
            errors.push(`❌ Unknown event type: ${type}`);
            continue;
        }

        errors.push(...validateParameters(type, id, schemaMap[type].params, event.parameters || []));

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
        parameters: Object.fromEntries(event.parameters.map((p: any) => [p.type, p.value])),
        updating_events: (event.updating_events || []).map((upd: any) => ({
            id: upd.id,
            type: upd.type,
            description: upd.description || "",
            parameters: Object.fromEntries(upd.parameters.map((p: any) => [p.type, p.value]))
        }))
    }));
}