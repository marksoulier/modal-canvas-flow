import React, { useState } from 'react';
import { Calendar, Clock, FileText, DollarSign, Percent, HelpCircle, Pencil } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
import DatePicker from './DatePicker';
import { valueToDay } from '../hooks/resultsEvaluation';
import type { Parameter, Event, UpdatingEvent } from '../contexts/PlanContext';

interface EventParameterInputsProps {
    param: Parameter;
    event: Event | UpdatingEvent;
    parameters: Record<number, Record<number, { type: string; value: string | number }>>;
    handleInputChange: (eventId: number, paramId: number, value: any) => void;
    handleInputBlur: (paramId: number, value: any, eventId: number) => void;
    getParameterUnits: (eventType: string, paramType: string) => string;
    getParameterOptions: (eventType: string, paramType: string) => string[];
    getEnvelopeDisplayName: (envelopeName: string) => string;
    currentDay: number;
    plan: any;
    onOpenEnvelopeModal?: (envelopeName: string) => void;
    onAddEnvelope?: () => void;
}

const EventParameterInputs: React.FC<EventParameterInputsProps> = ({
    param,
    event,
    parameters,
    handleInputChange,
    handleInputBlur,
    getParameterUnits,
    getParameterOptions,
    getEnvelopeDisplayName,
    currentDay,
    plan,
    onOpenEnvelopeModal,
    onAddEnvelope
}) => {
    const [usdInputFocus, setUsdInputFocus] = useState<Record<number, boolean>>({});
    const [usdTodayMode, setUsdTodayMode] = useState<Record<number, boolean>>({});
    const [usdTodayValues, setUsdTodayValues] = useState<Record<number, string>>({});
    const [customDaysMode, setCustomDaysMode] = useState<Record<number, boolean>>({});

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

        // For now, we'll assume editable by default since we don't have schema access here
        const isEditable = true;
        const defaultValue = '';

        if (paramUnits === 'date') {
            return renderDatePicker(param, event);
        }

        if (paramUnits === 'envelope') {
            // Build display map for regular envelopes (editable)
            const displayEnvelopeMap: Record<string, string> = {};
            const envelopeCategoryMap: Record<string, string> = {};
            plan?.envelopes.forEach((envelopeObj: any) => {
                // Only include regular envelopes for editing
                if (envelopeObj.account_type === 'regular') {
                    const envelope = envelopeObj.name;
                    const displayName = getEnvelopeDisplayName(envelope);
                    displayEnvelopeMap[displayName] = envelope;
                    envelopeCategoryMap[envelope] = envelopeObj.category || 'Uncategorized';
                }
            });

            const growthRate = plan?.envelopes.find((e: any) => e.name === value)?.rate;
            const growthType = plan?.envelopes.find((e: any) => e.name === value)?.growth;
            const currentEnvelope = plan?.envelopes.find((e: any) => e.name === value);
            const isCurrentEnvelopeRegular = currentEnvelope?.account_type === 'regular';

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
                const eventMain = plan.events.find((e: any) => e.id === event.id);
                if (eventMain) {
                    const startDateParam = eventMain.parameters.find((p: any) => p.type === 'start_time');
                    if (startDateParam && typeof startDateParam.value === 'string') {
                        // Convert date string to days since birth
                        eventDay = currentDay; // This would need dateStringToDaysSinceBirth function
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

    return renderInput(param, event);
};

export default EventParameterInputs; 