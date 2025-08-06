import type { Plan, Event, UpdatingEvent, Schema } from '../contexts/PlanContext';
import { dateStringToDaysSinceBirth } from '../contexts/PlanContext';

export interface DatedEvent {
    date: number;
    event: Event | UpdatingEvent;
    isUpdatingEvent: boolean;
    isEndingEvent: boolean;
    displayId: string; // Unique ID for display/dragging purposes
    parentEventId?: number;
}

// Helper function to add an event to the map
function addEventToMap(
    map: { [date: number]: DatedEvent[] },
    event: Event | UpdatingEvent,
    date: number,
    isUpdatingEvent: boolean,
    isEndingEvent: boolean,
    parentEventId?: number
) {
    if (!map[date]) map[date] = [];
    map[date].push({
        date,
        event,
        isUpdatingEvent,
        isEndingEvent,
        displayId: `${isEndingEvent ? 'end' : 'start'}-${event.id}`,
        parentEventId
    });
}

// Combines all events (main and updating) into a single map by date
export function getAllEventsByDate(plan: Plan, schema?: Schema) {
    const map: { [date: number]: DatedEvent[] } = {};
    if (!plan) return map;

    for (const event of plan.events) {
        // Main event start_time
        const startTimeParam = event.parameters.find(p => p.type === 'start_time');
        if (startTimeParam && typeof startTimeParam.value === 'string') {
            const date = dateStringToDaysSinceBirth(startTimeParam.value, plan.birth_date);
            addEventToMap(map, event, date, false, false);
        }

        // Main event end_time - add if event is recurring OR if it cannot be recurring
        const eventSchema = schema?.events.find(e => e.type === event.type);
        const canBeRecurring = eventSchema?.can_be_reocurring;
        if (event.is_recurring || canBeRecurring === false) {
            const endTimeParam = event.parameters.find(p => p.type === 'end_time');
            if (endTimeParam && typeof endTimeParam.value === 'string') {
                const date = dateStringToDaysSinceBirth(endTimeParam.value, plan.birth_date);
                addEventToMap(map, event, date, false, true);
            }
        }

        // Updating events
        if (event.updating_events) {
            for (const updatingEvent of event.updating_events) {
                // Updating event start_time
                const startTimeParam = updatingEvent.parameters.find(p => p.type === 'start_time');
                if (startTimeParam && typeof startTimeParam.value === 'string') {
                    const date = dateStringToDaysSinceBirth(startTimeParam.value, plan.birth_date);
                    addEventToMap(map, updatingEvent, date, true, false, event.id);
                }

                // Updating event end_time - add if updating event is recurring OR if it cannot be recurring
                const parentEventSchema = schema?.events.find(e => e.type === event.type);
                const updatingEventSchema = parentEventSchema?.updating_events?.find(ue => ue.type === updatingEvent.type);
                const canBeRecurring = updatingEventSchema?.can_be_reocurring;
                if (updatingEvent.is_recurring || canBeRecurring === false) {
                    const endTimeParam = updatingEvent.parameters.find(p => p.type === 'end_time');
                    if (endTimeParam && typeof endTimeParam.value === 'string') {
                        const date = dateStringToDaysSinceBirth(endTimeParam.value, plan.birth_date);
                        addEventToMap(map, updatingEvent, date, true, true, event.id);
                    }
                }
            }
        }
    }
    return map;
} 