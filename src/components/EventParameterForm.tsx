import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, HelpCircle } from 'lucide-react';
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
import { usePlan, findEventOrUpdatingEventById, getEventDefinition } from '../contexts/PlanContext';
import type { Plan, Event, Parameter, Schema, SchemaEvent, UpdatingEvent } from '../contexts/PlanContext';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import DatePicker from './DatePicker';
import { Pencil } from 'lucide-react';
import { valueToDay } from '../hooks/resultsEvaluation';


interface EventParametersFormProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: number;
    onSelectEvent: (eventId: number) => void;
    onOpenEnvelopeModal?: (envelopeName: string) => void;
}

const EventParametersForm: React.FC<EventParametersFormProps> = ({
    isOpen,
    onClose,
    eventId,
    onSelectEvent,
    onOpenEnvelopeModal
}) => {
    const { plan, schema, getEventIcon, updateParameter, deleteEvent, getParameterDisplayName, getParameterUnits, getEventDisplayType, addUpdatingEvent, getParameterDescription, updateEventDescription, getParameterOptions, currentDay } = usePlan();
    // State for local parameter editing (now supports main and updating events)
    const [parameters, setParameters] = useState<Record<number, Record<number, { type: string; value: string | number }>>>({});
    const [loading, setLoading] = useState(false);
    const [newUpdatingEventType, setNewUpdatingEventType] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    // State for main event description input expansion
    const [descExpanded, setDescExpanded] = useState(false);
    // State for updating event description input expansion (by updating event id)
    const [updatingDescExpanded, setUpdatingDescExpanded] = useState<Record<number, boolean>>({});
    // State for updating event descriptions
    const [updatingDescriptions, setUpdatingDescriptions] = useState<Record<number, string>>({});
    const [usdInputFocus, setUsdInputFocus] = useState<Record<number, boolean>>({});
    const [usdTodayMode, setUsdTodayMode] = useState<Record<number, boolean>>({});
    const [usdTodayValues, setUsdTodayValues] = useState<Record<number, string>>({});
    const [customDaysMode, setCustomDaysMode] = useState<Record<number, boolean>>({});

    // Helper to get eventType and paramType for any eventId and paramId (main or updating)
    function getEventTypeAndParamType(eventId: number, paramId: number): { eventType: string, paramType: string } | null {
        if (!plan) return null;
        const { event } = findEventOrUpdatingEventById(plan, eventId);
        if (!event) return null;
        const param = (event as any).parameters?.find((p: Parameter) => p.id === paramId);
        if (param) return { eventType: (event as any).type, paramType: param.type };
        return null;
    }

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
        let desc = "";
        let updatingDescs: Record<number, string> = {};
        if (plan) {
            const { event, parentEvent } = findEventOrUpdatingEventById(plan, eventId);
            if (event && !parentEvent) {
                // Main event
                desc = (event as any).description;
                if ((event as any).updating_events) {
                    for (const ue of (event as any).updating_events) {
                        updatingDescs[ue.id] = ue.description;
                    }
                }
            } else if (event && parentEvent) {
                // Updating event
                desc = (event as any).description;
            }
        }
        setDescription(desc);
        setUpdatingDescriptions(updatingDescs);
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

    const renderDatePicker = (param: Parameter, event: (Event | UpdatingEvent)) => {
        if (!plan?.birth_date) return null;
        const paramData = parameters[event.id]?.[param.id];
        const value = paramData?.value || 0;

        return (
            <DatePicker
                value={value}
                onChange={(newValue) => {
                    handleInputChange(event.id, param.id, newValue);
                    handleInputBlur(param.id, newValue, event.id);
                }}
                birthDate={plan.birth_date}
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

        if (paramUnits === 'date') {
            return renderDatePicker(param, event);
        }

        if (paramUnits === 'envelope') {
            // Build display map
            const displayEnvelopeMap: Record<string, string> = {};
            const envelopeCategoryMap: Record<string, string> = {};
            plan?.envelopes.forEach((envelopeObj) => {
                const envelope = envelopeObj.name;
                const otherMatch = envelope.match(/^Other \((.+)\)$/);
                if (otherMatch) {
                    displayEnvelopeMap[otherMatch[1]] = envelope;
                    envelopeCategoryMap[envelope] = envelopeObj.category || 'Uncategorized';
                } else {
                    displayEnvelopeMap[envelope] = envelope;
                    envelopeCategoryMap[envelope] = envelopeObj.category || 'Uncategorized';
                }
            });

            return (
                <div className="flex items-center gap-1">
                    <Select
                        value={value as string}
                        onValueChange={(newValue) => {
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
            );
        }

        if (paramUnits === 'usd') {
            // Show formatted value with commas when not focused, raw when focused
            const isFocused = usdInputFocus[param.id] || false;
            const isTodayMode = usdTodayMode[param.id] || false;
            let displayValue = String(value);
            let todayValue = '';
            let actualValue = value;
            const placeholder = defaultValue ? String(defaultValue) : '';
            // Get eventDay from 'start_date' parameter
            let eventDay = currentDay;
            if (plan && plan.events) {
                const eventMain = plan.events.find(e => e.id === eventId);
                if (eventMain) {
                    const startDateParam = eventMain.parameters.find(p => p.type === 'start_time');
                    if (startDateParam) {
                        eventDay = Number(startDateParam.value) || currentDay;
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
                            Use Today's Value
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
            const placeholder = defaultValue ? String(defaultValue) : '';

            // Define frequency options with their day mappings
            const frequencyOptions = [
                { label: 'Daily', value: 1 },
                { label: 'Weekly', value: 7 },
                { label: 'Biweekly', value: 14 },
                { label: 'Monthly', value: 30 },
                { label: 'Quarterly', value: 90 },
                { label: 'Semi-annually', value: 182 },
                { label: 'Yearly', value: 365 },
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

    // For rendering parameters, use the helper to get the right event/updating event
    const { event: foundEvent, parentEvent: foundParentEvent } = findEventOrUpdatingEventById(plan, eventId);
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
            <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto p-6">
                <DialogHeader className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        {currentEvent && getEventIcon((currentEvent as any).type)}
                        {currentUpdatingEvent && getEventIcon((currentUpdatingEvent as any).type)}
                        <DialogTitle>
                            {currentEvent
                                ? getEventDisplayType((currentEvent as any).type)
                                : currentUpdatingEvent
                                    ? getEventDisplayType((currentUpdatingEvent as any).type)
                                    : 'Event'}
                        </DialogTitle>
                    </div>
                    <DialogDescription>
                        Configure the parameters for this event. Changes will be saved automatically.
                    </DialogDescription>
                </DialogHeader>


                <form onSubmit={handleSubmit} className="space-y-6">
                    {currentEvent && currentEvent.parameters && currentEvent.parameters.map((param) => (
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
                    {currentUpdatingEvent && currentUpdatingEvent.parameters &&
                        currentUpdatingEvent.parameters.map((param) => (
                            <div key={param.id} className="space-y-2">
                                <div className="space-y-1">
                                    <Label htmlFor={param.id.toString()} className="text-sm font-medium">
                                        {getParameterDisplayName((currentUpdatingEvent as any).type, param.type)}
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        {getEventDefinition(plan, schema, eventId)?.parameters.find((p: any) => p.type === param.type)?.description}
                                    </p>
                                </div>
                                {currentUpdatingEvent && renderInput(param, currentUpdatingEvent as any)}
                            </div>
                        ))}

                    {/* Main Event Description Edit Box (before Updating Events) */}
                    <div className="mt-2">
                        <Label htmlFor="event-description" className="text-sm font-medium">Description</Label>
                        {descExpanded ? (
                            <Textarea
                                id="event-description"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                onBlur={e => { updateEventDescription(eventId, e.target.value); setDescExpanded(false); }}
                                className="w-full mt-1"
                                rows={2}
                                autoFocus
                            />
                        ) : (
                            <Input
                                id="event-description"
                                value={description}
                                onFocus={() => setDescExpanded(true)}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full mt-1 cursor-pointer"
                                readOnly
                            />
                        )}
                    </div>

                    <div className="flex flex-col gap-3 pt-6">
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Event'}
                        </Button>

                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                deleteEvent(eventId);
                                onClose();
                            }}
                            className="w-full bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
                            disabled={loading}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Event
                        </Button>
                    </div>
                </form>
                {/* --- Updating Events Section --- */}
                {mainEvent && (
                    <div className="pt-8 border-t mt-8">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-md font-semibold">Updating Events</h3>
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
                                                    {ue.parameters.map(param => (
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
                                                    {/* Updating Event Description Edit Box */}
                                                    <div className="mt-4">
                                                        <Label htmlFor={`updating-event-description-${ue.id}`} className="text-xs font-medium">Description</Label>
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
            </DialogContent>
        </Dialog>
    );
};

export default EventParametersForm;