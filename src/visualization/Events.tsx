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

// Function to get interpolated x-coordinate for an event
export function getInterpolatedX(eventDate: number, dataPoints: any[], xScale: any): number {
    let leftPoint = null;
    let rightPoint = null;

    for (let i = 0; i < dataPoints.length - 1; i++) {
        if (dataPoints[i].date <= eventDate && dataPoints[i + 1].date >= eventDate) {
            leftPoint = dataPoints[i];
            rightPoint = dataPoints[i + 1];
            break;
        }
    }

    if (leftPoint && rightPoint) {
        const proportion = (eventDate - leftPoint.date) / (rightPoint.date - leftPoint.date);
        return xScale(leftPoint.date) + proportion * (xScale(rightPoint.date) - xScale(leftPoint.date));
    }

    // If event date is before the first data point
    if (dataPoints.length > 0 && eventDate < dataPoints[0].date) {
        return xScale(eventDate);
    }

    // If event date is after the last data point
    if (dataPoints.length > 0 && eventDate > dataPoints[dataPoints.length - 1].date) {
        return xScale(eventDate);
    }

    return xScale(eventDate); // Fallback to the event's own date if no points are found
}

// Function to get interpolated y-value for an event based on surrounding data points
export function getInterpolatedY(eventDate: number, dataPoints: any[], yScale: any): number {
    let leftPoint = null;
    let rightPoint = null;

    for (let i = 0; i < dataPoints.length - 1; i++) {
        if (dataPoints[i].date <= eventDate && dataPoints[i + 1].date >= eventDate) {
            leftPoint = dataPoints[i];
            rightPoint = dataPoints[i + 1];
            break;
        }
    }

    if (leftPoint && rightPoint) {
        // Linear interpolation between the two points
        const proportion = (eventDate - leftPoint.date) / (rightPoint.date - leftPoint.date);
        const interpolatedValue = leftPoint.value + proportion * (rightPoint.value - leftPoint.value);
        return yScale(interpolatedValue);
    }

    // If event date is before the first data point
    if (dataPoints.length > 0 && eventDate < dataPoints[0].date) {
        return yScale(dataPoints[0].value);
    }

    // If event date is after the last data point
    if (dataPoints.length > 0 && eventDate > dataPoints[dataPoints.length - 1].date) {
        return yScale(dataPoints[dataPoints.length - 1].value);
    }

    // If no data points are available, return a default position
    return 0;
}

// Function to check if two events overlap based on their canvas positions
export function doEventsOverlap(
    event1: { canvasX: number },
    event2: { canvasX: number },
    annotationWidth: number = 40 // Width of the timeline annotation
): boolean {
    return Math.abs(event1.canvasX - event2.canvasX) < annotationWidth;
}

// Function to group overlapping events
export function groupOverlappingEvents(
    events: { date: number, displayId: string, canvasX: number }[],
    annotationWidth: number = 40
): { [groupId: string]: string[] } {
    const groups: { [groupId: string]: string[] } = {};
    let currentGroupId = 0;

    // Sort events by canvas X position
    const sortedEvents = [...events].sort((a, b) => a.canvasX - b.canvasX);

    for (let i = 0; i < sortedEvents.length; i++) {
        const currentEvent = sortedEvents[i];
        let foundGroup = false;

        // Check existing groups for overlap
        for (const [groupId, groupEvents] of Object.entries(groups)) {
            // Get the events data for the current group
            const groupEventsData = groupEvents.map(displayId =>
                events.find(e => e.displayId === displayId)!
            );

            // Check if current event overlaps with any event in the group
            const overlapsWithGroup = groupEventsData.some(groupEvent =>
                doEventsOverlap(currentEvent, groupEvent, annotationWidth)
            );

            if (overlapsWithGroup) {
                groups[groupId].push(currentEvent.displayId);
                foundGroup = true;
                break;
            }
        }

        // If no overlapping group found, create a new group
        if (!foundGroup) {
            groups[currentGroupId.toString()] = [currentEvent.displayId];
            currentGroupId++;
        }
    }

    return groups;
} 