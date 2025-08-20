import type { Plan, Event, UpdatingEvent, Schema } from '../contexts/PlanContext';
import { dateStringToDaysSinceBirth, getEventWeightFromSchema, usePlan } from '../contexts/PlanContext';

export interface DatedEvent {
    date: number;
    event: Event | UpdatingEvent;
    isUpdatingEvent: boolean;
    isEndingEvent: boolean;
    displayId: string; // Unique ID for display/dragging purposes
    parentEventId?: number;
    isShadowMode?: boolean;
    iconSizePercent?: number;
    isRecurringInstance?: boolean;
    recurrenceIndex?: number;
}

// Helper function to add an event to the map
function addEventToMap(
    map: { [date: number]: DatedEvent[] },
    event: Event | UpdatingEvent,
    date: number,
    isUpdatingEvent: boolean,
    isEndingEvent: boolean,
    parentEventId?: number,
    isShadowMode: boolean = false,
    iconSizePercent?: number,
    displayIdSuffix?: string,
    isRecurringInstance: boolean = false,
    recurrenceIndex?: number
) {
    if (!map[date]) map[date] = [];
    const displayId = `${isEndingEvent ? 'end' : 'start'}-${event.id}${displayIdSuffix ? displayIdSuffix : ''}${isShadowMode ? '-shadow' : ''}`;
    map[date].push({
        date,
        event,
        isUpdatingEvent,
        isEndingEvent,
        displayId,
        parentEventId,
        isShadowMode,
        iconSizePercent,
        isRecurringInstance,
        recurrenceIndex
    });
}

// Combines all events (main and updating) into a single map by date
function meetsZoomThreshold(iconSizePercent: number | undefined, zoomLevel?: number): boolean {
    if (zoomLevel === undefined || iconSizePercent === undefined) return true;
    const ZOOM_MIN_FOR_GROWTH = 1;
    const ZOOM_FULL_GROWTH = 250;
    const VISIBILITY_SCALE_THRESHOLD = 0.65; // require at least this effective scale to render
    const minScale = Math.max(0, Math.min(1, iconSizePercent / 100));
    const t = Math.max(0, Math.min(1, (zoomLevel - ZOOM_MIN_FOR_GROWTH) / (ZOOM_FULL_GROWTH - ZOOM_MIN_FOR_GROWTH)));
    const zoomAmp = 1 - Math.exp(-4 * t);
    const effectiveScale = minScale + (1 - minScale) * zoomAmp;
    return effectiveScale >= VISIBILITY_SCALE_THRESHOLD;
}

// Combines events for current plan and locked plan, marking locked plan events as shadow mode
export function getAllEventsByDateWithLocked(plan: Plan, lockedPlan?: Plan | null, schema?: Schema, zoomLevel?: number) {
    const map: { [date: number]: DatedEvent[] } = {};
    if (!plan) return map;

    const { show_all } = usePlan();

    const processPlan = (p: Plan, isShadow: boolean) => {
        // Filter out hidden events if show_all is false
        // const events = show_all ? p.events : p.events.filter(event => !event.hide);
        const events = p.events;
        for (const event of events) {
            const startTimeParam = event.parameters.find(pr => pr.type === 'start_time');
            if (startTimeParam && typeof startTimeParam.value === 'string') {
                const date = dateStringToDaysSinceBirth(startTimeParam.value, p.birth_date);
                const weight = getEventWeightFromSchema(schema || undefined as any, event.type);
                if (meetsZoomThreshold(weight, zoomLevel)) {
                    addEventToMap(map, event, date, false, false, undefined, isShadow, weight);
                }
            }

            const eventSchema = schema?.events.find(e => e.type === event.type);
            const canBeRecurring = eventSchema?.can_be_reocurring;
            if (event.is_recurring || canBeRecurring === false) {
                const endTimeParam = event.parameters.find(pr => pr.type === 'end_time');
                if (endTimeParam && typeof endTimeParam.value === 'string') {
                    const date = dateStringToDaysSinceBirth(endTimeParam.value, p.birth_date);
                    const weight = getEventWeightFromSchema(schema || undefined as any, event.type);
                    if (meetsZoomThreshold(weight, zoomLevel)) {
                        addEventToMap(map, event, date, false, true, undefined, isShadow, weight);
                    }
                }
            }

            // Add recurring occurrences for main events when marked as recurring
            if (event.is_recurring) {
                const startParam = event.parameters.find(pr => pr.type === 'start_time');
                const endParam = event.parameters.find(pr => pr.type === 'end_time');
                const freqParam = event.parameters.find(pr => pr.type === 'frequency_days');
                const hasValidDates = startParam && endParam && typeof startParam.value === 'string' && typeof endParam.value === 'string';
                const frequencyDays = typeof freqParam?.value === 'number' ? freqParam.value : Number(freqParam?.value);
                if (hasValidDates && Number.isFinite(frequencyDays) && frequencyDays > 0) {
                    const startDays = dateStringToDaysSinceBirth(startParam!.value as string, p.birth_date);
                    const endDays = dateStringToDaysSinceBirth(endParam!.value as string, p.birth_date);
                    const weightRecurring = 10; // Fixed weight for recurring instances
                    if (meetsZoomThreshold(weightRecurring, zoomLevel)) {
                        let occurrenceIndex = 1;
                        for (let d = startDays + frequencyDays; d <= endDays; d += frequencyDays) {
                            addEventToMap(map, event, d, false, false, undefined, isShadow, weightRecurring, `-r${occurrenceIndex}`, true, occurrenceIndex);
                            occurrenceIndex++;
                        }
                    }
                }
            }

            if (event.updating_events) {
                // Filter out hidden updating events if show_all is false
                const updatingEvents = show_all ? event.updating_events : event.updating_events.filter(ue => !ue.hide);
                for (const updatingEvent of updatingEvents) {
                    const startTimeParamUE = updatingEvent.parameters.find(pr => pr.type === 'start_time');
                    if (startTimeParamUE && typeof startTimeParamUE.value === 'string') {
                        const date = dateStringToDaysSinceBirth(startTimeParamUE.value, p.birth_date);
                        const weight = getEventWeightFromSchema(schema || undefined as any, updatingEvent.type, event.type);
                        if (meetsZoomThreshold(weight, zoomLevel)) {
                            addEventToMap(map, updatingEvent, date, true, false, event.id, isShadow, weight);
                        }
                    }

                    const parentEventSchema = schema?.events.find(e => e.type === event.type);
                    const updatingEventSchema = parentEventSchema?.updating_events?.find(ue => ue.type === updatingEvent.type);
                    const canBeRecurringUE = updatingEventSchema?.can_be_reocurring;
                    if (updatingEvent.is_recurring || canBeRecurringUE === false) {
                        const endTimeParamUE = updatingEvent.parameters.find(pr => pr.type === 'end_time');
                        if (endTimeParamUE && typeof endTimeParamUE.value === 'string') {
                            const date = dateStringToDaysSinceBirth(endTimeParamUE.value, p.birth_date);
                            const weight = getEventWeightFromSchema(schema || undefined as any, updatingEvent.type, event.type);
                            if (meetsZoomThreshold(weight, zoomLevel)) {
                                addEventToMap(map, updatingEvent, date, true, true, event.id, isShadow, weight);
                            }
                        }
                    }

                    // Add recurring occurrences for updating events when marked as recurring
                    if (updatingEvent.is_recurring) {
                        const startParamUE = updatingEvent.parameters.find(pr => pr.type === 'start_time');
                        const endParamUE = updatingEvent.parameters.find(pr => pr.type === 'end_time');
                        const freqParamUE = updatingEvent.parameters.find(pr => pr.type === 'frequency_days');
                        const hasValidDatesUE = startParamUE && endParamUE && typeof startParamUE.value === 'string' && typeof endParamUE.value === 'string';
                        const frequencyDaysUE = typeof freqParamUE?.value === 'number' ? freqParamUE.value : Number(freqParamUE?.value);
                        if (hasValidDatesUE && Number.isFinite(frequencyDaysUE) && frequencyDaysUE > 0) {
                            const startDaysUE = dateStringToDaysSinceBirth(startParamUE!.value as string, p.birth_date);
                            const endDaysUE = dateStringToDaysSinceBirth(endParamUE!.value as string, p.birth_date);
                            const weightRecurringUE = 30; // Fixed weight for recurring instances
                            if (meetsZoomThreshold(weightRecurringUE, zoomLevel)) {
                                let occurrenceIndexUE = 1;
                                for (let d = startDaysUE + frequencyDaysUE; d <= endDaysUE; d += frequencyDaysUE) {
                                    addEventToMap(map, updatingEvent, d, true, false, event.id, isShadow, weightRecurringUE, `-r${occurrenceIndexUE}`, true, occurrenceIndexUE);
                                    occurrenceIndexUE++;
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    processPlan(plan, false);
    if (lockedPlan) processPlan(lockedPlan, true);

    return map;
}