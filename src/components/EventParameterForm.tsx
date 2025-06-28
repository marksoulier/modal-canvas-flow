import React, { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { CalendarIcon, Trash2, ChevronDownIcon } from 'lucide-react';
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
import { Calendar } from './ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import { cn } from '@/lib/utils';
import { usePlan } from '../contexts/PlanContext';
import type { Plan, Event, Parameter, Schema, SchemaEvent } from '../contexts/PlanContext';


interface EventParametersFormProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: number;
}

const EventParametersForm: React.FC<EventParametersFormProps> = ({
    isOpen,
    onClose,
    eventId
}) => {
    const { plan, schema, getEventIcon, updateParameter, deleteEvent, getParameterDisplayName, getParameterUnits, getEventDisplayType } = usePlan();
    const [parameters, setParameters] = useState<Record<number, { type: string; value: string | number }>>({});
    const [loading, setLoading] = useState(false);
    const [calendarMonths, setCalendarMonths] = useState<Record<number, Date>>({});

    useEffect(() => {
        if (schema && plan) {
            const event = plan.events.find(e => e.id === eventId);
            if (event) {
                const eventDef = schema.events.find(e => e.type === event.type);
                if (eventDef) {
                    const newParams: Record<number, { type: string; value: string | number }> = {};
                    const newCalendarMonths: Record<number, Date> = {};

                    event.parameters.forEach(param => {
                        const paramUnits = getParameterUnits(event.type, param.type);
                        newParams[param.id] = {
                            type: param.type,
                            value: paramUnits === 'percentage' ? ((param.value as number) * 100).toFixed(2) : param.value
                        };

                        // Initialize calendar month for date parameters
                        if (paramUnits === 'date' && plan.birth_date) {
                            const birthDate = new Date(plan.birth_date);
                            const daysSinceBirth = parseInt(param.value as string);
                            newCalendarMonths[param.id] = addDays(birthDate, daysSinceBirth);
                        }
                    });

                    setParameters(newParams);
                    setCalendarMonths(newCalendarMonths);
                }
            } else {
                // Reset parameters if event not found
                setParameters({});
                setCalendarMonths({});
            }
        }
    }, [schema, plan, eventId, getParameterUnits]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Save all parameters
        const event = plan?.events.find(e => e.id === eventId);
        if (event) {
            Object.entries(parameters).forEach(([paramId, paramData]) => {
                const paramUnits = getParameterUnits(event.type, paramData.type);
                const value = paramUnits === 'percentage' ? parseFloat(paramData.value as string) / 100 : paramData.value;
                updateParameter(eventId, parseInt(paramId), value);
            });
        }

        // Simulate a save operation
        await new Promise(resolve => setTimeout(resolve, 500));
        setLoading(false);
        onClose();
    };

    const handleInputChange = (paramId: number, value: any) => {
        setParameters(prev => ({
            ...prev,
            [paramId]: {
                ...prev[paramId],
                value: value
            }
        }));
    };

    const handleInputBlur = (paramId: number, value: any) => {
        const event = plan?.events.find(e => e.id === eventId);
        const paramUnits = event ? getParameterUnits(event.type, parameters[paramId].type) : '';
        console.log(eventId, paramId, value);
        updateParameter(eventId, paramId, paramUnits === 'percentage' ? value / 100 : value);
    };

    const getEventDefinition = (): SchemaEvent | undefined => {
        if (!schema || !plan) return undefined;
        const event = plan.events.find(e => e.id === eventId);
        if (!event) return undefined;
        return schema.events.find(e => e.type === event.type);
    };

    const updateCalendarMonth = (paramId: number, newDate: Date) => {
        setCalendarMonths(prev => ({
            ...prev,
            [paramId]: newDate
        }));
    };

    const renderDatePicker = (param: Parameter) => {
        if (!plan?.birth_date) return null;

        const paramData = parameters[param.id];
        const value = paramData?.value;
        const birthDate = new Date(plan.birth_date);
        const daysSinceBirth = value ? parseInt(value as string) : 0;
        const date = addDays(birthDate, daysSinceBirth);
        const currentMonth = calendarMonths[param.id] || date;

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            "w-full justify-between text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <div className="flex items-center">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </div>
                        <ChevronDownIcon className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(newDate) => {
                            if (newDate) {
                                const daysDiff = Math.floor((newDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
                                const newValue = daysDiff.toString();
                                handleInputChange(param.id, newValue);
                                handleInputBlur(param.id, newValue);
                                updateCalendarMonth(param.id, newDate);
                            }
                        }}
                        month={currentMonth}
                        onMonthChange={(newMonth) => updateCalendarMonth(param.id, newMonth)}
                        defaultMonth={date}
                        className="pointer-events-auto"
                        footer={
                            <div className="flex justify-between px-2 py-1.5 border-t">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        const newDate = new Date(date);
                                        newDate.setFullYear(newDate.getFullYear() - 1);
                                        const daysDiff = Math.floor((newDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
                                        handleInputChange(param.id, daysDiff.toString());
                                        handleInputBlur(param.id, daysDiff.toString());
                                        updateCalendarMonth(param.id, newDate);
                                    }}
                                >
                                    Previous Year
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        const newDate = new Date(date);
                                        newDate.setFullYear(newDate.getFullYear() + 1);
                                        const daysDiff = Math.floor((newDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
                                        handleInputChange(param.id, daysDiff.toString());
                                        handleInputBlur(param.id, daysDiff.toString());
                                        updateCalendarMonth(param.id, newDate);
                                    }}
                                >
                                    Next Year
                                </Button>
                            </div>
                        }
                    />
                </PopoverContent>
            </Popover>
        );
    };

    const renderInput = (param: Parameter) => {
        const paramData = parameters[param.id];
        const value = paramData?.value ?? '';
        const event = plan?.events.find(e => e.id === eventId);
        const paramUnits = event ? getParameterUnits(event.type, param.type) : '';
        const schemaParam = event ? schema?.events.find(e => e.type === event.type)?.parameters.find(p => p.type === param.type) : undefined;
        const defaultValue = schemaParam?.default;

        if (paramUnits === 'date') {
            return renderDatePicker(param);
        }

        if (paramUnits === 'envelope') {
            return (
                <Select
                    value={value as string}
                    onValueChange={(newValue) => {
                        handleInputChange(param.id, newValue);
                        handleInputBlur(param.id, newValue);
                    }}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder={defaultValue || "Select an envelope"} />
                    </SelectTrigger>
                    <SelectContent>
                        {schema?.envelopes.map((envelope) => (
                            <SelectItem key={envelope} value={envelope}>
                                {envelope}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        if (paramUnits === 'usd' || paramUnits === 'apy' || paramUnits === 'percentage') {
            const displayValue = value === 0 ? '' : String(value);
            const placeholder = defaultValue ?
                (paramUnits === 'percentage' ? ((defaultValue as number) * 100).toFixed(2) : String(defaultValue)) :
                '';

            return (
                <div className="relative">
                    <Input
                        type="number"
                        value={displayValue}
                        placeholder={placeholder}
                        onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            handleInputChange(param.id, newValue);
                        }}
                        onBlur={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            handleInputBlur(param.id, newValue);
                        }}
                        step={paramUnits === 'percentage' ? '0.01' : 'any'}
                        className="w-full pr-12 placeholder:text-muted-foreground"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {paramUnits === 'usd' ? '$' : paramUnits === 'apy' ? 'APY' : '%'}
                    </div>
                </div>
            );
        }

        if (paramUnits === 'days') {
            const displayValue = value === 0 ? '' : String(value);
            const placeholder = defaultValue ? String(defaultValue) : '';

            return (
                <div className="relative">
                    <Input
                        type="number"
                        value={displayValue}
                        placeholder={placeholder}
                        onChange={(e) => {
                            const newValue = parseInt(e.target.value) || 0;
                            handleInputChange(param.id, newValue);
                        }}
                        onBlur={(e) => {
                            const newValue = parseInt(e.target.value) || 0;
                            handleInputBlur(param.id, newValue);
                        }}
                        step="1"
                        className="w-full pr-12 placeholder:text-muted-foreground"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        days
                    </div>
                </div>
            );
        }

        return (
            <Input
                type="text"
                value={String(value)}
                placeholder={defaultValue ? String(defaultValue) : ''}
                onChange={(e) => handleInputChange(param.id, e.target.value)}
                onBlur={(e) => handleInputBlur(param.id, e.target.value)}
                className="w-full placeholder:text-muted-foreground"
            />
        );
    };

    const event = getEventDefinition();
    const currentEvent = plan?.events.find(e => e.id === eventId);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto p-6">
                <DialogHeader className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        {event && getEventIcon(event.icon)}
                        <DialogTitle>{event ? getEventDisplayType(event.type) : 'Event'}</DialogTitle>
                    </div>
                    <DialogDescription>
                        Configure the parameters for this event. Changes will be saved automatically.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {currentEvent?.parameters.map((param) => (
                        <div key={param.id} className="space-y-2">
                            <div className="space-y-1">
                                <Label htmlFor={param.id.toString()} className="text-sm font-medium">
                                    {getParameterDisplayName(currentEvent.type, param.type)}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    {event?.parameters.find(p => p.type === param.type)?.description}
                                </p>
                            </div>
                            {renderInput(param)}
                        </div>
                    ))}

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
            </DialogContent>
        </Dialog>
    );
};

export default EventParametersForm;