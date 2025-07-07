import { useMemo } from 'react';
import type { Plan, Event, UpdatingEvent } from '../contexts/PlanContext';

export interface DatedEvent {
    date: number;
    event: Event | UpdatingEvent;
    isUpdatingEvent: boolean;
    parentEventId?: number;
}

// Combines all events (main and updating) into a single map by date
export function getAllEventsByDate(plan: Plan) {
    return useMemo(() => {
        const map: { [date: number]: DatedEvent[] } = {};
        if (!plan) return map;
        for (const event of plan.events) {
            // Main event
            const startTimeParam = event.parameters.find(p => p.type === 'start_time');
            if (startTimeParam) {
                const date = Number(startTimeParam.value);
                if (!map[date]) map[date] = [];
                map[date].push({ date, event, isUpdatingEvent: false });
            }
            // Updating events
            if (event.updating_events) {
                for (const updatingEvent of event.updating_events) {
                    const startTimeParam = updatingEvent.parameters.find(p => p.type === 'start_time');
                    if (!startTimeParam) continue;
                    const date = Number(startTimeParam.value);
                    if (!map[date]) map[date] = [];
                    map[date].push({ date, event: updatingEvent, isUpdatingEvent: true, parentEventId: event.id });
                }
            }
        }
        return map;
    }, [plan]);
} 