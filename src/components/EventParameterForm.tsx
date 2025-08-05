import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, HelpCircle, Calendar, Clock, FileText, DollarSign, Percent } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from './ui/tooltip';
import { usePlan, findEventOrUpdatingEventById, getEventDefinition, dateStringToDaysSinceBirth } from '../contexts/PlanContext';
import type { Plan, Event, Parameter, Schema, SchemaEvent, UpdatingEvent } from '../contexts/PlanContext';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import DatePicker from './DatePicker';
import { Pencil } from 'lucide-react';
import { valueToDay } from '../hooks/resultsEvaluation';
import { format, parseISO } from 'date-fns';

interface EventParametersFormProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: number;
    onSelectEvent: (eventId: number) => void;
    onOpenEnvelopeModal?: (envelopeName: string) => void;
    onAddEnvelope?: () => void;
}

const EventParametersForm: React.FC<EventParametersFormProps> = ({
    isOpen,
    onClose,
    eventId,
    onSelectEvent,
    onOpenEnvelopeModal,
    onAddEnvelope
}) => {
    const { plan, schema, getEventIcon, updateParameter, deleteEvent, getParameterDisplayName, getParameterUnits, getEventDisplayType, addUpdatingEvent, getParameterDescription, updateEventDescription, updateEventTitle, canEventBeRecurring, updateEventRecurring, getParameterOptions, currentDay, getEnvelopeDisplayName, getEventFunctionsParts, updateEventFunctionParts, getEventFunctionPartsState, getEventFunctionPartsIcon, getEventFunctionPartsDescription } = usePlan();
    
    // State for local parameter editing (now supports main and updating events)
    const [parameters, setParameters] = useState<Record<number, Record<number, { type: string; value: string | number }>>>({});
    const [loading, setLoading] = useState(false);
    const [newUpdatingEventType, setNewUpdatingEventType] = useState<string>("");
    const [title, setTitle] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    // State for main event description input expansion
    const [descExpanded, setDescExpanded] = useState(false);
    // State for updating event description input expansion (by updating event id)
    const [updatingDescExpanded, setUpdatingDescExpanded] = useState<Record<number, boolean>>({});
    // State for updating event descriptions
    const [updatingDescriptions, setUpdatingDescriptions] = useState<Record<number, string>>({});
    // State for updating event titles
    const [updatingTitles, setUpdatingTitles] = useState<Record<number, string>>({});
    const [usdInputFocus, setUsdInputFocus] = useState<Record<number, boolean>>({});
    const [usdTodayMode, setUsdTodayMode] = useState<Record<number, boolean>>({});
    const [usdTodayValues, setUsdTodayValues] = useState<Record<number, string>>({});
    const [customDaysMode, setCustomDaysMode] = useState<Record<number, boolean>>({});
    const [isRepeating, setIsRepeating] = useState<boolean>(false);

    // Helper to get eventType and paramType for any eventId and paramId (main or updating)
    function getEventTypeAndParamType(eventId: number, paramId: number): { eventType: string, paramType: string } | null {
        if (!plan) return null;
        const { event } = findEventOrUpdatingEventById(plan, eventId);
        if (!event) return null;
        const param = (event as any).parameters?.find((p: Parameter) => p.id === paramId);
        if (param) return { eventType: (event as any).type, paramType: param.type };
        return null;
    }

    // Helper function to format date strings for display
    const formatDateForDisplay = (dateString: string): string => {
        try {
            const date = parseISO(dateString);
            return format(date, 'MMMM dd, yyyy');
        } catch {
            return dateString;
        }
    };

    // Helper to get readable parameter values
    const getReadableParameterValue = (param: Parameter, eventForParam: Event | UpdatingEvent): string => {
        const paramUnits = getParameterUnits((eventForParam as any).type, param.type);
        const value = param.value;
        
        if (paramUnits === 'date' && typeof value === 'string') {
            return formatDateForDisplay(value);
        }
        if (paramUnits === 'usd' && typeof value === 'number') {
            return `$${value.toLocaleString()}`;
        }
        if (paramUnits === 'percentage' && typeof value === 'number') {
            return `${(value * 100).toFixed(2)}%`;
        }
        if (paramUnits === 'envelope' && typeof value === 'string') {
            return getEnvelopeDisplayName(value);
        }
        return String(value);
    };

    // Get icon for parameter type
    const getParameterIcon = (paramUnits: string) => {
        switch (paramUnits) {
            case 'date':
                return <Calendar className="w-4 h-4 text-primary/60" />;
            case 'usd':
                return <DollarSign className="w-4 h-4 text-emerald-600/60" />;
            case 'percentage':
                return <Percent className="w-4 h-4 text-blue-600/60" />;
            default:
                return <FileText className="w-4 h-4 text-muted-foreground/60" />;
        }
    };

    useEffect(() => {
        if (schema && plan) {
            const { event, parentEvent } = findEventOrUpdatingEventById(plan, eventId);
            const newParams: Record<number, Record<number, { type: string; value: string | number }>> = {};
            if (event) {
                // Always add the current event (main or updating)
                newParams[event.id] = {};
                (event as any).parameters?.forEach((param: Parameter) => {
                    const eventType = (event as any).type;
                    const paramUnits = getParameterUnits(eventType, param.type);
                    newParams[event.id][param.id] = {
                        type: param.type,
                        value: paramUnits === 'percentage' ? ((param.value as number) * 100).toFixed(2) : param.value
                    };
                });
                // If this is a main event, also add all updating events
                if (!parentEvent && (event as any).updating_events) {
                    (event as any).updating_events.forEach((ue: UpdatingEvent) => {
                        newParams[ue.id] = {};
                        ue.parameters.forEach((param: Parameter) => {
                            const eventType = ue.type;
                            const paramUnits = getParameterUnits(eventType, param.type);
                            newParams[ue.id][param.id] = {
                                type: param.type,
                                value: paramUnits === 'percentage' ? ((param.value as number) * 100).toFixed(2) : param.value
                            };
                        });
                    });
                }
            }
            setParameters(newParams);
        } else {
            setParameters({});
        }
    }, [schema, plan, eventId, getParameterUnits]);

    useEffect(() => {
        // Find the event or updating event by id
        let eventTitle = "";
        let desc = "";
        let updatingDescs: Record<number, string> = {};
        let updatingTitles: Record<number, string> = {};
        if (plan) {
            const { event, parentEvent } = findEventOrUpdatingEventById(plan, eventId);
            if (event && !parentEvent) {
                // Main event
                eventTitle = (event as any).title || "";
                desc = (event as any).description;
                if ((event as any).updating_events) {
                    for (const ue of (event as any).updating_events) {
                        updatingDescs[ue.id] = ue.description;
                        updatingTitles[ue.id] = ue.title || "";
                    }
                }
            } else if (event && parentEvent) {
                // Updating event
                eventTitle = (event as any).title || "";
                desc = (event as any).description;
            }
        }
        setTitle(eventTitle);
        setDescription(desc);
        setUpdatingDescriptions(updatingDescs);
        setUpdatingTitles(updatingTitles);

        // Set the isRepeating state based on the event's is_recurring property
        const { event: foundEventForState, parentEvent: foundParentEventForState } = findEventOrUpdatingEventById(plan, eventId);
        if (foundEventForState) {
            setIsRepeating((foundEventForState as any).is_recurring || false);
        }
    }, [plan, eventId]);

    const handleSubmit = async (e: React.FormEvent) => {
        console.log('handleSubmit called');
        e.preventDefault();
        setLoading(true);

        // Save all parameters
        const event = plan?.events.find(e => e.id === eventId);
        if (event) {
            Object.entries(parameters).forEach(([eventId, eventParams]) => {
                Object.entries(eventParams).forEach(([paramId, paramData]) => {
                    const paramUnits = getParameterUnits(event.type, paramData.type);
                    let value = paramData.value;
                    if (paramUnits === 'percentage') {
                        value = parseFloat(paramData.value as string) / 100;
                    } else if (paramUnits === 'usd') {
                        value = parseFloat(paramData.value as string) || 0;
                    }
                    // Find the parameter type from the paramId
                    const paramObj = parameters[parseInt(eventId)]?.[parseInt(paramId)];
                    if (paramObj && paramObj.type) {
                        updateParameter(parseInt(eventId), paramObj.type, value);
                    }
                });
            });
        }

        // Simulate a save operation
        await new Promise(resolve => setTimeout(resolve, 500));

        setLoading(false);
        onClose();
    };

    const handleInputChange = (eventIdForParam: number, paramId: number, value: any) => {
        setParameters(prev => ({
            ...prev,
            [eventIdForParam]: {
                ...prev[eventIdForParam],
                [paramId]: {
                    ...prev[eventIdForParam]?.[paramId],
                    value: value
                }
            }
        }));
    };

    const handleInputBlur = (paramId: number, value: any, eventIdForParam: number) => {
        const info = getEventTypeAndParamType(eventIdForParam, paramId);
        if (!info) return;
        const paramUnits = getParameterUnits(info.eventType, info.paramType);
        let saveValue = value;
        if (paramUnits === 'percentage') {
            saveValue = parseFloat(value) / 100;
        } else if (paramUnits === 'usd') {
            saveValue = parseFloat(value) || 0;
        }
        updateParameter(eventIdForParam, info.paramType, saveValue);
        // Also update local state to reflect the saved value (in case of normalization)
        setParameters(prev => ({
            ...prev,
            [eventIdForParam]: {
                ...prev[eventIdForParam],
                [paramId]: {
                    ...prev[eventIdForParam]?.[paramId],
                    value: value
                }
            }
        }));
    };

    // Handler for repeat toggle change
    const handleRepeatToggle = (checked: boolean) => {
        setIsRepeating(checked);
        updateEventRecurring(eventId, checked);
    };

    // Helper to filter parameters based on repeat settings
    const shouldShowParameter = (paramType: string): boolean => {
        const recurringOnlyParams = ['end_time', 'frequency_days'];

        // Get the event definition to check can_be_reocurring
        const eventDef = getEventDefinition(plan, schema, eventId);
        const { event } = findEventOrUpdatingEventById(plan, eventId);

        if (recurringOnlyParams.includes(paramType)) {
            // If event cannot be recurring, always show these parameters
            if (eventDef?.can_be_reocurring === false) {
                return true;
            }

            // For events that can be recurring:
            // - If the event is currently recurring, only show in the repeating section
            // - If the event is not recurring, don't show at all
            if (eventDef?.can_be_reocurring === true) {
                // Only show in regular section if NOT recurring
                return false;
            }
        }
        return true;
    };

    const renderDatePicker = (param: Parameter, event: (Event | UpdatingEvent)) => {
        const paramData = parameters[event.id]?.[param.id];
        const value = paramData?.value || '';

        return (
            <DatePicker
                value={String(value)}
                onChange={(newValue) => {
                    handleInputChange(event.id, param.id, newValue);
                    handleInputBlur(param.id, newValue, event.id);
                }}
                placeholder="Pick a date"
            />
        );
    };

    const renderInput = (param: Parameter, event: (Event | UpdatingEvent)) => {
        const paramData = parameters[event.id]?.[param.id];
        const value = paramData?.value ?? '';
        const typeToUse = (event as any).type;
        const paramUnits = getParameterUnits(typeToUse, param.type);
        // Find schema for this event type
        const schemaEvent = schema?.events.find(e => e.type === typeToUse);
        // If this is an updating event, look in updating_events
        let schemaParam = schemaEvent?.parameters.find(p => p.type === param.type);
        if (!schemaParam && (event as any).id && (event as any).parameters && schemaEvent?.updating_events) {
            for (const ue of schemaEvent.updating_events) {
                if (ue.type === typeToUse) {
                    schemaParam = ue.parameters.find(p => p.type === param.type);
                    break;
                }
            }
        }
        const defaultValue = schemaParam?.default;
        const isEditable = schemaParam?.editable !== false; // Default to true if not specified

        if (paramUnits === 'date') {
            return renderDatePicker(param, event);
        }

        if (paramUnits === 'envelope') {
            // Build display map for regular envelopes (editable)
            const displayEnvelopeMap: Record<string, string> = {};
            const envelopeCategoryMap: Record<string, string> = {};
            plan?.envelopes.forEach((envelopeObj) => {
                // Only include regular envelopes for editing
                if (envelopeObj.account_type === 'regular') {
                    const envelope = envelopeObj.name;
                    const displayName = getEnvelopeDisplayName(envelope);
                    displayEnvelopeMap[displayName] = envelope;
                    envelopeCategoryMap[envelope] = envelopeObj.category || 'Uncategorized';
                }
            });

            const growthRate = plan?.envelopes.find(e => e.name === value)?.rate;
            const growthType = plan?.envelopes.find(e => e.name === value)?.growth;
            const currentEnvelope = plan?.envelopes.find(e => e.name === value);
            console.log('currentEnvelope: ', currentEnvelope);
            const isCurrentEnvelopeRegular = currentEnvelope?.account_type === 'regular';

            console.log('growthRate: ', growthRate);

            // If parameter is not editable, show as read-only but with pencil button
            if (!isEditable) {
                const displayName = getEnvelopeDisplayName(String(value));
                const category = currentEnvelope?.category || 'Uncategorized';

                return (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                                {displayName} <span style={{ color: '#888', fontSize: '0.8em' }}>({category})</span>
                                <span className="ml-2 text-xs text-gray-500">(Read-only)</span>
                            </div>
                            {typeof onOpenEnvelopeModal === 'function' && (
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="ml-1 p-1 h-8 w-8 text-gray-400 hover:text-blue-500"
                                    tabIndex={-1}
                                    onClick={() => onOpenEnvelopeModal(String(value))}
                                    aria-label="Manage envelopes"
                                >
                                    <Pencil className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                        {/* Growth rate display - clickable to open envelope modal */}
                        {growthType === "None" ? (
                            <div
                                className="mt-1 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 border border-gray-100 cursor-pointer hover:bg-gray-100"
                                onClick={() => typeof onOpenEnvelopeModal === 'function' && onOpenEnvelopeModal(String(value))}
                            >
                                <span className="font-mono">
                                    No growth over time
                                </span>
                            </div>
                        ) : growthRate !== undefined && growthRate > 0 ? (
                            <div
                                className="mt-1 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 border border-gray-100 cursor-pointer hover:bg-gray-100"
                                onClick={() => typeof onOpenEnvelopeModal === 'function' && onOpenEnvelopeModal(String(value))}
                            >
                                <span className="font-mono">
                                    {growthType}: {(growthRate * 100).toFixed(2)}%/yr
                                </span>
                            </div>
                        ) : null}
                    </div>
                );
            }

            // If current value is a non-regular envelope, show it as read-only
            if (value && !isCurrentEnvelopeRegular) {
                const displayName = getEnvelopeDisplayName(String(value));
                const category = currentEnvelope?.category || 'Uncategorized';

                return (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                                {displayName} <span style={{ color: '#888', fontSize: '0.8em' }}>({category})</span>
                                <span className="ml-2 text-xs text-gray-500">(Default)</span>
                            </div>
                        </div>
                        {/* Growth rate display */}
                        {growthType === "None" ? (
                            <div className="mt-1 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 border border-gray-100">
                                <span className="font-mono">
                                    No growth over time
                                </span>
                            </div>
                        ) : growthRate !== undefined && growthRate > 0 ? (
                            <div className="mt-1 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 border border-gray-100">
                                <span className="font-mono">
                                    {growthType}: {(growthRate * 100).toFixed(2)}%/yr
                                </span>
                            </div>
                        ) : null}
                    </div>
                );
            }

            // Otherwise show the regular dropdown for editing
            return (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                        <Select
                            value={value as string}
                            onValueChange={(newValue) => {
                                if (newValue === "add_envelope") {
                                    // Don't update the parameter value, just trigger the add envelope function
                                    if (typeof onAddEnvelope === 'function') {
                                        onAddEnvelope();
                                    }
                                    return;
                                }
                                handleInputChange(event.id, param.id, newValue);
                                handleInputBlur(param.id, newValue, event.id);
                            }}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={defaultValue || "Select an envelope"} />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(displayEnvelopeMap).map(([displayName, envelopeKey]) => (
                                    <SelectItem key={envelopeKey} value={envelopeKey}>
                                        {displayName} <span style={{ color: '#888', fontSize: '0.8em' }}>({envelopeCategoryMap[envelopeKey]})</span>
                                    </SelectItem>
                                ))}
                                {typeof onAddEnvelope === 'function' && (
                                    <SelectItem
                                        value="add_envelope"
                                        className="bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium"
                                    >
                                        + Add Envelope
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {typeof onOpenEnvelopeModal === 'function' && (
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="ml-1 p-1 h-8 w-8 text-gray-400 hover:text-blue-500"
                                tabIndex={-1}
                                onClick={() => onOpenEnvelopeModal(String(value))}
                                aria-label="Manage envelopes"
                            >
                                <Pencil className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                    {/* Growth rate display */}
                    {growthType === "None" ? (
                        <div className="mt-1 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 border border-gray-100">
                            <span className="font-mono">
                                No growth over time
                            </span>
                        </div>
                    ) : growthRate !== undefined && growthRate > 0 ? (
                        <div className="mt-1 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 border border-gray-100">
                            <span className="font-mono">
                                {growthType}: {(growthRate * 100).toFixed(2)}%/yr
                            </span>
                        </div>
                    ) : null}
                </div>
            );
        }

        if (paramUnits === 'usd') {
            // If parameter is not editable, show as read-only
            if (!isEditable) {
                const formattedValue = value !== '' && value !== '-' && !isNaN(Number(value))
                    ? Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : String(value);

                return (
                    <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        ${formattedValue} <span className="ml-2 text-xs text-gray-500">(Read-only)</span>
                    </div>
                );
            }

            // Show formatted value with commas when not focused, raw when focused
            const isFocused = usdInputFocus[param.id] || false;
            const isTodayMode = usdTodayMode[param.id] || false;
            let displayValue = String(value);
            let todayValue = '';
            let actualValue = value;
            const placeholder = defaultValue ? String(defaultValue) : '';
            // Get eventDay from 'start_time' parameter
            let eventDay = currentDay;
            if (plan && plan.events) {
                const eventMain = plan.events.find(e => e.id === eventId);
                if (eventMain) {
                    const startDateParam = eventMain.parameters.find(p => p.type === 'start_time');
                    if (startDateParam && typeof startDateParam.value === 'string') {
                        // Convert date string to days since birth
                        eventDay = dateStringToDaysSinceBirth(startDateParam.value, plan.birth_date);
                    } else if (startDateParam && typeof startDateParam.value === 'number') {
                        // Legacy: value is already days since birth
                        eventDay = startDateParam.value;
                    }
                }
            }
            // Use inflationRate from plan
            const inflationRate = plan?.inflation_rate || 0.03;
            if (isTodayMode && value !== '' && !isNaN(Number(value))) {
                // Convert actual value to today's value for display
                let todayValNum = valueToDay(Number(value), currentDay, eventDay, inflationRate);
                todayValNum = Math.round(todayValNum * 100) / 100;
                todayValue = todayValNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                displayValue = isFocused ? (usdTodayValues[param.id] ?? todayValue) : todayValue;
            } else if (!isFocused && value !== '' && value !== '-' && !isNaN(Number(value))) {
                displayValue = Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else if (isFocused) {
                displayValue = String(value);
            }
            return (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isTodayMode}
                                onChange={e => setUsdTodayMode(prev => ({ ...prev, [param.id]: e.target.checked }))}
                                className="form-checkbox h-4 w-4 text-blue-500 border-gray-300 rounded"
                                style={{ accentColor: '#3b82f6' }}
                            />
                            Use Inflation Adjusted Value
                        </label>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                    <p className="text-sm">
                                        When enabled, you can enter the dollar amount in today's purchasing power.
                                        The system will automatically adjust it for inflation to calculate the equivalent
                                        value on the event date.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="relative flex items-center">
                        <Input
                            type="text"
                            value={displayValue}
                            placeholder={String(placeholder)}
                            onFocus={() => setUsdInputFocus(prev => ({ ...prev, [param.id]: true }))}
                            onBlur={e => {
                                setUsdInputFocus(prev => ({ ...prev, [param.id]: false }));
                                let newValue = e.target.value.replace(/,/g, '');
                                if (isTodayMode) {
                                    // Convert from today's value to event day value before saving
                                    const todayVal = parseFloat(newValue);
                                    let eventVal = isNaN(todayVal) ? '' : valueToDay(todayVal, eventDay, currentDay, inflationRate);
                                    if (typeof eventVal === 'number' && !isNaN(eventVal)) eventVal = Math.round(eventVal * 100) / 100;
                                    // Always save as string with 2 decimals for consistency
                                    handleInputBlur(param.id, typeof eventVal === 'number' && !isNaN(eventVal) ? Number(eventVal.toFixed(2)) : '', event.id);
                                    setUsdTodayValues(prev => ({ ...prev, [param.id]: newValue }));
                                } else {
                                    if (newValue === '' || newValue === '-') {
                                        handleInputBlur(param.id, '', event.id);
                                    } else {
                                        let parsed = parseFloat(newValue);
                                        if (typeof parsed === 'number' && !isNaN(parsed)) parsed = Math.round(parsed * 100) / 100;
                                        handleInputBlur(param.id, typeof parsed === 'number' && !isNaN(parsed) ? Number(parsed.toFixed(2)) : '', event.id);
                                    }
                                }
                            }}
                            onChange={e => {
                                let raw = e.target.value.replace(/,/g, '');
                                if (isTodayMode) {
                                    setUsdTodayValues(prev => ({ ...prev, [param.id]: raw }));
                                    handleInputChange(event.id, param.id, raw);
                                } else {
                                    handleInputChange(event.id, param.id, raw);
                                }
                            }}
                            className="w-full pr-12 placeholder:text-muted-foreground"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none flex items-center">$</span>
                    </div>
                    {isTodayMode && value !== '' && !isNaN(Number(value)) && (
                        <div className="mt-1 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 border border-gray-100">
                            <span className="font-mono">{(Math.round(Number(value) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Future Value)</span>
                        </div>
                    )}
                </div>
            );
        }

        if (paramUnits === 'apy' || paramUnits === 'percentage') {
            // If parameter is not editable, show as read-only
            if (!isEditable) {
                const displayValue = paramUnits === 'percentage'
                    ? `${(Number(value) * 100).toFixed(2)}%`
                    : `${String(value)}${paramUnits === 'apy' ? ' APY' : '%'}`;

                return (
                    <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        {displayValue} <span className="ml-2 text-xs text-gray-500">(Read-only)</span>
                    </div>
                );
            }

            const placeholder = defaultValue ?
                (paramUnits === 'percentage' ? ((defaultValue as number) * 100).toFixed(2) : String(defaultValue)) :
                '';
            return (
                <div className="relative">
                    <Input
                        type="text"
                        value={String(value)}
                        placeholder={placeholder}
                        onChange={(e) => {
                            // Allow raw input (including minus, decimal, etc.)
                            handleInputChange(event.id, param.id, e.target.value);
                        }}
                        onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '' || val === '-') {
                                handleInputBlur(param.id, '', event.id);
                            } else {
                                const parsed = parseFloat(val);
                                handleInputBlur(param.id, isNaN(parsed) ? '' : parsed, event.id);
                            }
                        }}
                        step={paramUnits === 'percentage' ? '0.01' : 'any'}
                        className="w-full pr-12 placeholder:text-muted-foreground"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {paramUnits === 'apy' ? 'APY' : '%'}
                    </div>
                </div>
            );
        }

        if (paramUnits === 'days') {
            // If parameter is not editable, show as read-only
            if (!isEditable) {
                return (
                    <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        {String(value)} days <span className="ml-2 text-xs text-gray-500">(Read-only)</span>
                    </div>
                );
            }

            const placeholder = defaultValue ? String(defaultValue) : '';

            // Define frequency options with their day mappings
            const frequencyOptions = [
                { label: 'Daily', value: 1 },
                { label: 'Weekly', value: 7 },
                { label: 'Biweekly', value: 14 },
                { label: 'Monthly', value: 365.25 / 12 },
                { label: 'Quarterly', value: 365.25 / 4 },
                { label: 'Semi-annually', value: 365.25 / 2 },
                { label: 'Yearly', value: 365.25 },
                { label: 'Custom', value: 'custom' }
            ];

            // Find if current value matches any predefined option
            const currentValue = Number(value);
            const matchingOption = frequencyOptions.find(option =>
                typeof option.value === 'number' && option.value === currentValue
            );
            const isCustomMode = customDaysMode[param.id] || !matchingOption;
            const selectedValue = isCustomMode ? 'Custom' : (matchingOption ? matchingOption.label : 'Custom');

            return (
                <div className="space-y-2">
                    <Select
                        value={selectedValue}
                        onValueChange={(newValue) => {
                            const option = frequencyOptions.find(opt => opt.label === newValue);
                            if (option && typeof option.value === 'number') {
                                setCustomDaysMode(prev => ({ ...prev, [param.id]: false }));
                                handleInputChange(event.id, param.id, option.value);
                                handleInputBlur(param.id, option.value, event.id);
                            } else if (newValue === 'Custom') {
                                setCustomDaysMode(prev => ({ ...prev, [param.id]: true }));
                            }
                        }}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                            {frequencyOptions.map((option) => (
                                <SelectItem key={option.label} value={option.label}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {isCustomMode && (
                        <div className="relative">
                            <Input
                                type="text"
                                value={String(value)}
                                placeholder={placeholder}
                                onChange={(e) => {
                                    // Allow raw input (including minus, etc.)
                                    handleInputChange(event.id, param.id, e.target.value);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        handleInputBlur(param.id, '', event.id);
                                    } else {
                                        const parsed = parseInt(val, 10);
                                        handleInputBlur(param.id, isNaN(parsed) ? '' : parsed, event.id);
                                    }
                                }}
                                step="1"
                                className="w-full pr-12 placeholder:text-muted-foreground"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                days
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (paramUnits === 'hours') {
            // If parameter is not editable, show as read-only
            if (!isEditable) {
                return (
                    <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        {String(value)} hours <span className="ml-2 text-xs text-gray-500">(Read-only)</span>
                    </div>
                );
            }

            const placeholder = defaultValue ? String(defaultValue) : '';
            return (
                <div className="relative">
                    <Input
                        type="text"
                        value={String(value)}
                        placeholder={placeholder}
                        onChange={(e) => {
                            // Allow raw input (including decimal numbers)
                            handleInputChange(event.id, param.id, e.target.value);
                        }}
                        onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '' || val === '-') {
                                handleInputBlur(param.id, '', event.id);
                            } else {
                                const parsed = parseFloat(val);
                                handleInputBlur(param.id, isNaN(parsed) ? '' : parsed, event.id);
                            }
                        }}
                        step="0.1"
                        className="w-full pr-12 placeholder:text-muted-foreground"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        hours
                    </div>
                </div>
            );
        }

        if (paramUnits === 'years') {
            // If parameter is not editable, show as read-only
            if (!isEditable) {
                return (
                    <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        {String(value)} years <span className="ml-2 text-xs text-gray-500">(Read-only)</span>
                    </div>
                );
            }

            const placeholder = defaultValue ? String(defaultValue) : '';
            return (
                <div className="relative">
                    <Input
                        type="text"
                        value={String(value)}
                        placeholder={placeholder}
                        onChange={(e) => {
                            // Allow raw input (including decimal numbers)
                            handleInputChange(event.id, param.id, e.target.value);
                        }}
                        onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '' || val === '-') {
                                handleInputBlur(param.id, '', event.id);
                            } else {
                                const parsed = parseFloat(val);
                                handleInputBlur(param.id, isNaN(parsed) ? '' : parsed, event.id);
                            }
                        }}
                        step="0.1"
                        className="w-full pr-12 placeholder:text-muted-foreground"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        years
                    </div>
                </div>
            );
        }

        if (paramUnits === 'number_per_year') {
            // If parameter is not editable, show as read-only
            if (!isEditable) {
                return (
                    <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        {String(value)} per year <span className="ml-2 text-xs text-gray-500">(Read-only)</span>
                    </div>
                );
            }

            const placeholder = defaultValue ? String(defaultValue) : '';

            // Define pay frequency options with their annual counts
            const payFrequencyOptions = [
                { label: 'Weekly', value: 52 },
                { label: 'Biweekly', value: 26 },
                { label: 'Semi-monthly', value: 24 },
                { label: 'Monthly', value: 12 },
                { label: 'Quarterly', value: 4 },
                { label: 'Custom', value: 'custom' }
            ];

            // Find if current value matches any predefined option
            const currentValue = Number(value);
            const matchingOption = payFrequencyOptions.find(option =>
                typeof option.value === 'number' && option.value === currentValue
            );
            const isCustomMode = customDaysMode[param.id] || !matchingOption;
            const selectedValue = isCustomMode ? 'Custom' : (matchingOption ? matchingOption.label : 'Custom');

            return (
                <div className="space-y-2">
                    <Select
                        value={selectedValue}
                        onValueChange={(newValue) => {
                            const option = payFrequencyOptions.find(opt => opt.label === newValue);
                            if (option && typeof option.value === 'number') {
                                setCustomDaysMode(prev => ({ ...prev, [param.id]: false }));
                                handleInputChange(event.id, param.id, option.value);
                                handleInputBlur(param.id, option.value, event.id);
                            } else if (newValue === 'Custom') {
                                setCustomDaysMode(prev => ({ ...prev, [param.id]: true }));
                            }
                        }}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select pay frequency" />
                        </SelectTrigger>
                        <SelectContent>
                            {payFrequencyOptions.map((option) => (
                                <SelectItem key={option.label} value={option.label}>
                                    {option.label}
                                    {typeof option.value === 'number' && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                            ({option.value} per year)
                                        </span>
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {isCustomMode && (
                        <div className="relative">
                            <Input
                                type="text"
                                value={String(value)}
                                placeholder={placeholder}
                                onChange={(e) => {
                                    // Allow raw input (including decimal numbers)
                                    handleInputChange(event.id, param.id, e.target.value);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        handleInputBlur(param.id, '', event.id);
                                    } else {
                                        const parsed = parseFloat(val);
                                        handleInputBlur(param.id, isNaN(parsed) ? '' : parsed, event.id);
                                    }
                                }}
                                step="1"
                                className="w-full pr-20 placeholder:text-muted-foreground"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                per year
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (paramUnits === 'enum') {
            // If parameter is not editable, show as read-only
            if (!isEditable) {
                return (
                    <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        {String(value)} <span className="ml-2 text-xs text-gray-500">(Read-only)</span>
                    </div>
                );
            }

            const options = getParameterOptions(typeToUse, param.type);
            return (
                <Select
                    value={value as string}
                    onValueChange={(newValue) => {
                        handleInputChange(event.id, param.id, newValue);
                        handleInputBlur(param.id, newValue, event.id);
                    }}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder={defaultValue || "Select an option"} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option: string) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        // If parameter is not editable, show as read-only
        if (!isEditable) {
            return (
                <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                    {String(value)} <span className="ml-2 text-xs text-gray-500">(Read-only)</span>
                </div>
            );
        }

        return (
            <Input
                type="text"
                value={String(value)}
                placeholder={defaultValue ? String(defaultValue) : ''}
                onChange={(e) => handleInputChange(event.id, param.id, e.target.value)}
                onBlur={(e) => handleInputBlur(param.id, e.target.value, event.id)}
                className="w-full placeholder:text-muted-foreground"
            />
        );
    };

    if (!schema || !plan) return null;

    // Find the event by ID
    const { event: foundEvent, parentEvent: foundParentEvent } = findEventOrUpdatingEventById(plan, eventId);
    const event = foundEvent as Event | UpdatingEvent | null;
    if (!event) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Event Not Found</DialogTitle>
                        <DialogDescription>The requested event could not be found.</DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        );
    }

    const eventType = (event as any).type;
    const eventIcon = getEventIcon(eventType);
    const eventDisplayType = getEventDisplayType(eventType);

    // Find the schema event
    let eventDef = schema.events.find(e => e.type === eventType);
    let eventName = eventDisplayType;

    // Collect read-only parameters for display
    const readOnlyParams: { param: Parameter; event: Event | UpdatingEvent; label: string; value: string; units: string }[] = [];
    
    // Check main event parameters
    if (event && (event as any).parameters) {
        const schemaEvent = schema.events.find(e => e.type === (event as any).type);
        (event as any).parameters.forEach((param: Parameter) => {
            const schemaParam = schemaEvent?.parameters.find(p => p.type === param.type);
            if (schemaParam?.editable === false) {
                readOnlyParams.push({
                    param,
                    event: event as Event | UpdatingEvent,
                    label: getParameterDisplayName((event as any).type, param.type),
                    value: getReadableParameterValue(param, event as Event | UpdatingEvent),
                    units: getParameterUnits((event as any).type, param.type)
                });
            }
        });
    }

    // Collect date parameters for display
    const dateParams: { param: Parameter; event: Event | UpdatingEvent; label: string; value: string }[] = [];
    if (event && (event as any).parameters) {
        (event as any).parameters.forEach((param: Parameter) => {
            const paramUnits = getParameterUnits((event as any).type, param.type);
            if (paramUnits === 'date') {
                dateParams.push({
                    param,
                    event: event as Event | UpdatingEvent,
                    label: getParameterDisplayName((event as any).type, param.type),
                    value: getReadableParameterValue(param, event as Event | UpdatingEvent)
                });
            }
        });
    }

    // For rendering parameters, use the helper to get the right event/updating event
    const currentEvent = foundEvent && !foundParentEvent ? foundEvent : null;
    const currentUpdatingEvent = foundEvent && foundParentEvent ? foundEvent : null;

    // --- Updating Events Section ---
    // Helper to get main event and its updating events
    const mainEvent = plan?.events.find(e => e.id === eventId);
    const mainEventSchema = mainEvent ? schema?.events.find(e => e.type === mainEvent.type) : undefined;
    const updatingEventTypes = mainEventSchema?.updating_events?.map(ue => ue.type) || [];

    // Handler to add updating event
    const handleAddUpdatingEvent = () => {
        if (mainEvent && newUpdatingEventType) {
            addUpdatingEvent(mainEvent.id, newUpdatingEventType);
            setNewUpdatingEventType("");
        }
    };

    // Helper to get updating event schema
    const getUpdatingEventSchema = (mainEventType: string, updatingEventType: string) => {
        return schema?.events.find(e => e.type === mainEventType)?.updating_events?.find(ue => ue.type === updatingEventType);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="space-y-3 border-b border-border pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{eventIcon}</span>
                            <div>
                                <DialogTitle className="text-xl font-semibold text-foreground">{eventName}</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground">
                                    Customize this financial life event
                                </DialogDescription>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                deleteEvent(eventId);
                                onClose();
                            }}
                            className="flex items-center gap-2"
                        >
                            <Trash2 size={16} />
                            Delete Event
                        </Button>
                    </div>
                </DialogHeader>

                {/* Two-panel layout */}
                <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* Left Panel - Form */}
                    <div className="flex-1 overflow-y-auto pr-2">
                        <form onSubmit={handleSubmit} className="space-y-6 py-4">
                            <div className="bg-card rounded-lg border border-border p-6">
                                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Event Details
                                </h3>
                                
                                {/* Title Input */}
                                <div className="space-y-2 mb-4">
                                    <Label htmlFor="event-title" className="text-sm font-medium text-foreground">Title</Label>
                                    <Input
                                        id="event-title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        onBlur={() => updateEventTitle(eventId, title)}
                                        placeholder="Enter event title"
                                        className="bg-background"
                                    />
                                </div>

                                {/* Description */}
                                <div className="space-y-2">
                                    <Label htmlFor="event-description" className="text-sm font-medium text-foreground">Description</Label>
                                    <Textarea
                                        id="event-description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        onBlur={() => updateEventDescription(eventId, description)}
                                        placeholder="Enter event description"
                                        className="bg-background min-h-[80px]"
                                    />
                                </div>
                            </div>

                            {/* Parameters Section */}
                            <div className="bg-card rounded-lg border border-border p-6">
                                <h3 className="text-lg font-semibold text-foreground mb-4">Parameters</h3>
                                <div className="space-y-4">
                                    {currentEvent && currentEvent.parameters && currentEvent.parameters
                                        .filter((param) => shouldShowParameter(param.type))
                                        .map((param) => (
                                            <div key={param.id} className="space-y-2">
                                                <div className="space-y-1">
                                                    <Label htmlFor={param.id.toString()} className="text-sm font-medium">
                                                        {getParameterDisplayName((currentEvent as any).type, param.type)}
                                                    </Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {getEventDefinition(plan, schema, eventId)?.parameters.find((p: any) => p.type === param.type)?.description}
                                                    </p>
                                                </div>
                                                {currentEvent && renderInput(param, currentEvent as any)}
                                            </div>
                                        ))}
                                    {canEventBeRecurring(eventId) && (
                                        <div className="flex flex-col gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                            <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isRepeating}
                                                        onChange={(e) => handleRepeatToggle(e.target.checked)}
                                                        className="form-checkbox h-4 w-4 text-blue-500 border-gray-300 rounded"
                                                        style={{ accentColor: '#3b82f6' }}
                                                    />
                                                    Repeat Event
                                                </label>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <HelpCircle className="h-4 w-4 text-blue-400 hover:text-blue-600 cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-xs">
                                                            <p className="text-sm">
                                                                Enable this to make the event repeat over time. When enabled, you can set
                                                                the end date and frequency for the recurring event.
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            {isRepeating && currentEvent && (
                                                <div className="flex flex-col gap-2 mt-2">
                                                    {['frequency_days', 'end_time'].map((type) =>
                                                        currentEvent.parameters
                                                            .filter(param => param.type === type)
                                                            .map(param => (
                                                                <div key={param.id} className="space-y-1">
                                                                    <Label htmlFor={param.id.toString()} className="text-sm font-medium">
                                                                        {getParameterDisplayName((currentEvent as any).type, param.type)}
                                                                    </Label>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {getEventDefinition(plan, schema, eventId)?.parameters.find((p: any) => p.type === param.type)?.description}
                                                                    </p>
                                                                    {renderInput(param, currentEvent as any)}
                                                                </div>
                                                            ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Event Functions Section */}
                            {currentEvent && (() => {
                                const eventType = (currentEvent as any).type;
                                const eventFunctions = getEventFunctionsParts(eventType);

                                if (eventFunctions && eventFunctions.length > 0) {
                                    return (
                                        <div className="bg-card rounded-lg border border-border p-6">
                                            <h3 className="text-lg font-semibold text-foreground mb-4">Event Functions</h3>
                                            <div className="space-y-3">
                                                {eventFunctions.map((func) => {
                                                    const isEnabled = getEventFunctionPartsState(eventId, func.title);
                                                    const iconComponent = getEventFunctionPartsIcon(eventType, func.title);

                                                    return (
                                                        <div key={func.title} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex items-center gap-2">
                                                                    {iconComponent}
                                                                    <div>
                                                                        <div className="text-sm font-medium text-gray-900">
                                                                            {func.title}
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">
                                                                            {getEventFunctionPartsDescription(eventType, func.title)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isEnabled}
                                                                        onChange={(e) => updateEventFunctionParts(eventId, func.title, e.target.checked)}
                                                                        className="form-checkbox h-4 w-4 text-blue-500 border-gray-300 rounded"
                                                                        style={{ accentColor: '#3b82f6' }}
                                                                    />
                                                                    <span className="text-sm text-gray-700">
                                                                        {isEnabled ? 'Enabled' : 'Disabled'}
                                                                    </span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* --- Updating Events Section --- */}
                            {mainEvent && (
                                <div className="bg-card rounded-lg border border-border p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-foreground">Updating Events</h3>
                                        {updatingEventTypes.length > 0 && (
                                            <div className="flex gap-2 items-center">
                                                <Select
                                                    value={newUpdatingEventType}
                                                    onValueChange={setNewUpdatingEventType}
                                                >
                                                    <SelectTrigger className="w-40">
                                                        <SelectValue placeholder="Add updating event" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {mainEventSchema?.updating_events
                                                            ?.filter(ue => ue.display_event !== false)
                                                            .map(ue => (
                                                                <SelectItem key={ue.type} value={ue.type}>{ue.display_type}</SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={handleAddUpdatingEvent}
                                                    disabled={!newUpdatingEventType}
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    {mainEvent.updating_events && mainEvent.updating_events.length > 0 ? (
                                        <Accordion type="single" collapsible>
                                            {mainEvent.updating_events.map((ue) => {
                                                const ueSchema = getUpdatingEventSchema(mainEvent.type, ue.type);
                                                return (
                                                    <AccordionItem key={ue.id} value={String(ue.id)}>
                                                        <AccordionTrigger className="flex items-center gap-2">
                                                            {getEventIcon(ue.type)}
                                                            <span className="font-medium">{ueSchema?.display_type || ueSchema?.description || ue.type}</span>
                                                        </AccordionTrigger>
                                                        <AccordionContent>
                                                            <div className="space-y-4">
                                                                {/* Repeat Event Toggle for Updating Event */}
                                                                {(() => {
                                                                    const mainSchemaEvent = schema?.events.find(e => e.type === mainEvent.type);
                                                                    const updatingSchemaEvent = mainSchemaEvent?.updating_events?.find(ue_schema => ue_schema.type === ue.type);
                                                                    const canBeRecurring = (updatingSchemaEvent as any)?.can_be_reocurring === true;
                                                                    const isRecurring = (ue as any).is_recurring || false;

                                                                    return canBeRecurring && (
                                                                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                                            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isRecurring}
                                                                                    onChange={(e) => {
                                                                                        updateEventRecurring(ue.id, e.target.checked);
                                                                                    }}
                                                                                    className="form-checkbox h-4 w-4 text-blue-500 border-gray-300 rounded"
                                                                                    style={{ accentColor: '#3b82f6' }}
                                                                                />
                                                                                Repeat Event
                                                                            </label>
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <HelpCircle className="h-4 w-4 text-blue-400 hover:text-blue-600 cursor-help" />
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent side="top" className="max-w-xs">
                                                                                        <p className="text-sm">
                                                                                            Enable this to make the event repeat over time. When enabled, you can set
                                                                                            the end date and frequency for the recurring event.
                                                                                        </p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {ue.parameters.filter(param => {
                                                                    const recurringOnlyParams = ['end_time', 'frequency_days'];
                                                                    if (recurringOnlyParams.includes(param.type)) {
                                                                        return (ue as any).is_recurring || false;
                                                                    }
                                                                    return true;
                                                                }).map(param => (
                                                                    <div key={param.id} className="space-y-1">
                                                                        <Label className="text-sm font-medium">
                                                                            {getParameterDisplayName(ue.type, param.type)}
                                                                        </Label>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {getParameterDescription(ue.type, param.type)}
                                                                        </p>
                                                                        {renderInput(param, ue)}
                                                                    </div>
                                                                ))}

                                                                {/* Event Functions Section for Updating Event */}
                                                                {(() => {
                                                                    const eventType = ue.type;
                                                                    const eventFunctions = getEventFunctionsParts(eventType);

                                                                    if (eventFunctions && eventFunctions.length > 0) {
                                                                        return (
                                                                            <div className="space-y-3">
                                                                                <h4 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-2">
                                                                                    Event Functions
                                                                                </h4>
                                                                                <div className="space-y-2">
                                                                                    {eventFunctions.map((func) => {
                                                                                        const isEnabled = getEventFunctionPartsState(ue.id, func.title);
                                                                                        const iconComponent = getEventFunctionPartsIcon(eventType, func.title);

                                                                                        return (
                                                                                            <div key={func.title} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        {iconComponent}
                                                                                                        <div>
                                                                                                            <div className="text-xs font-medium text-gray-900">
                                                                                                                {func.title}
                                                                                                            </div>
                                                                                                            <div className="text-xs text-gray-500">
                                                                                                                {getEventFunctionPartsDescription(eventType, func.title)}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                                                                                                        <input
                                                                                                            type="checkbox"
                                                                                                            checked={isEnabled}
                                                                                                            onChange={(e) => updateEventFunctionParts(ue.id, func.title, e.target.checked)}
                                                                                                            className="form-checkbox h-3 w-3 text-blue-500 border-gray-300 rounded"
                                                                                                            style={{ accentColor: '#3b82f6' }}
                                                                                                        />
                                                                                                        <span className="text-xs text-gray-700">
                                                                                                            {isEnabled ? 'Enabled' : 'Disabled'}
                                                                                                        </span>
                                                                                                    </label>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}

                                                                {/* Updating Event Title and Description Edit Box */}
                                                                <div className="mt-4 space-y-3">
                                                                    {/* Title Input */}
                                                                    <div className="space-y-1">
                                                                        <Label htmlFor={`updating-event-title-${ue.id}`} className="text-xs font-medium text-gray-700">
                                                                            Title
                                                                        </Label>
                                                                        <Input
                                                                            id={`updating-event-title-${ue.id}`}
                                                                            value={updatingTitles[ue.id] || ''}
                                                                            onChange={e => setUpdatingTitles(prev => ({ ...prev, [ue.id]: e.target.value }))}
                                                                            onBlur={e => updateEventTitle(ue.id, e.target.value)}
                                                                            placeholder="Enter event title..."
                                                                            className="w-full border-gray-200 focus:border-gray-400 focus:ring-gray-400 text-xs"
                                                                        />
                                                                    </div>

                                                                    {/* Description Input */}
                                                                    <div className="space-y-1">
                                                                        <Label htmlFor={`updating-event-description-${ue.id}`} className="text-xs font-medium text-gray-700">
                                                                            Description
                                                                        </Label>
                                                                        {updatingDescExpanded[ue.id] ? (
                                                                            <Textarea
                                                                                id={`updating-event-description-${ue.id}`}
                                                                                value={updatingDescriptions[ue.id] || ''}
                                                                                onChange={e => setUpdatingDescriptions(prev => ({ ...prev, [ue.id]: e.target.value }))}
                                                                                onBlur={e => { updateEventDescription(ue.id, e.target.value); setUpdatingDescExpanded(prev => ({ ...prev, [ue.id]: false })); }}
                                                                                className="w-full mt-1 mb-2"
                                                                                rows={2}
                                                                                autoFocus
                                                                            />
                                                                        ) : (
                                                                            <Input
                                                                                id={`updating-event-description-${ue.id}`}
                                                                                value={updatingDescriptions[ue.id] || ''}
                                                                                onFocus={() => setUpdatingDescExpanded(prev => ({ ...prev, [ue.id]: true }))}
                                                                                onChange={e => setUpdatingDescriptions(prev => ({ ...prev, [ue.id]: e.target.value }))}
                                                                                className="w-full mt-1 cursor-pointer mb-2"
                                                                                readOnly
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => deleteEvent(ue.id)}
                                                                        className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Updating Event
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                );
                                            })}
                                        </Accordion>
                                    ) : (
                                        <p className="text-xs text-muted-foreground mt-2">No updating events.</p>
                                    )}
                                </div>
                            )}

                            {/* Go to Parent Event Button */}
                            {foundParentEvent && (
                                <div className="mb-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            onClose();
                                            onSelectEvent(foundParentEvent.id);
                                        }}
                                    >
                                        Go to Parent Event
                                    </Button>
                                </div>
                            )}

                            <div className="flex flex-col gap-3 pt-6">
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save Event'}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Right Panel - Display Information */}
                    <div className="w-80 border-l border-border pl-6 overflow-y-auto">
                        <div className="space-y-6 py-4">
                            {/* Event Summary */}
                            <div className="bg-muted/30 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                    <span className="text-lg">{eventIcon}</span>
                                    Event Overview
                                </h3>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-foreground">{title || eventName}</p>
                                    {description && (
                                        <p className="text-xs text-muted-foreground">{description}</p>
                                    )}
                                </div>
                            </div>

                            {/* Dates Section */}
                            {dateParams.length > 0 && (
                                <div className="bg-card rounded-lg border border-border p-4">
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-primary" />
                                        Important Dates
                                    </h4>
                                    <div className="space-y-3">
                                        {dateParams.map((item, index) => (
                                            <div key={index} className="flex flex-col gap-1">
                                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    {item.label}
                                                </span>
                                                <span className="text-sm text-foreground font-medium">
                                                    {item.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Read-only Information */}
                            {readOnlyParams.length > 0 && (
                                <div className="bg-card rounded-lg border border-border p-4">
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-muted-foreground" />
                                        Read-only Information
                                    </h4>
                                    <div className="space-y-3">
                                        {readOnlyParams.map((item, index) => (
                                            <div key={index} className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    {getParameterIcon(item.units)}
                                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                        {item.label}
                                                    </span>
                                                </div>
                                                <span className="text-sm text-foreground font-medium">
                                                    {item.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Event Functions Toggle */}
                            <div className="bg-card rounded-lg border border-border p-4">
                                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    Event Functions
                                </h4>
                                <div className="space-y-3">
                                    {/* Toggle switches for event functions would go here */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-foreground">Enable Functions</span>
                                        <Button variant="outline" size="sm" className="text-xs">
                                            Toggle
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Event functions integration would be implemented here...
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default EventParametersForm;
