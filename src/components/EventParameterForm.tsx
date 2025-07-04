import React, { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
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
import { usePlan } from '../contexts/PlanContext';
import type { Plan, Event, Parameter, Schema, SchemaEvent } from '../contexts/PlanContext';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';
import DatePicker from './DatePicker';


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
    const { plan, schema, getEventIcon, updateParameter, deleteEvent, getParameterDisplayName, getParameterUnits, getEventDisplayType, addUpdatingEvent, getParameterDescription, updateEventDescription } = usePlan();
    const [parameters, setParameters] = useState<Record<number, { type: string; value: string | number }>>({});
    const [loading, setLoading] = useState(false);
    const [newUpdatingEventType, setNewUpdatingEventType] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    // State for main event description input expansion
    const [descExpanded, setDescExpanded] = useState(false);
    // State for updating event description input expansion (by updating event id)
    const [updatingDescExpanded, setUpdatingDescExpanded] = useState<Record<number, boolean>>({});
    // State for updating event descriptions
    const [updatingDescriptions, setUpdatingDescriptions] = useState<Record<number, string>>({});

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
                    });

                    setParameters(newParams);
                }
            } else {
                // Reset parameters if event not found
                setParameters({});
            }
        }
    }, [schema, plan, eventId, getParameterUnits]);

    useEffect(() => {
        // Find the event or updating event by id
        let desc = "";
        let updatingDescs: Record<number, string> = {};
        if (plan) {
            const mainEvent = plan.events.find(e => e.id === eventId);
            if (mainEvent) {
                desc = mainEvent.description;
                if (mainEvent.updating_events) {
                    for (const ue of mainEvent.updating_events) {
                        updatingDescs[ue.id] = ue.description;
                    }
                }
            } else {
                for (const event of plan.events) {
                    const updating = event.updating_events?.find(ue => ue.id === eventId);
                    if (updating) {
                        desc = updating.description;
                        break;
                    }
                }
            }
        }
        setDescription(desc);
        setUpdatingDescriptions(updatingDescs);
    }, [plan, eventId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Save all parameters
        const event = plan?.events.find(e => e.id === eventId);
        if (event) {
            Object.entries(parameters).forEach(([paramId, paramData]) => {
                const paramUnits = getParameterUnits(event.type, paramData.type);
                let value = paramData.value;
                if (paramUnits === 'percentage') {
                    value = parseFloat(paramData.value as string) / 100;
                } else if (paramUnits === 'usd') {
                    value = parseFloat(paramData.value as string) || 0;
                }
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
        let saveValue = value;
        if (paramUnits === 'percentage') {
            saveValue = parseFloat(value) / 100;
        } else if (paramUnits === 'usd') {
            saveValue = parseFloat(value) || 0;
        }
        updateParameter(eventId, paramId, saveValue);
    };

    const getEventDefinition = (): SchemaEvent | undefined => {
        if (!schema || !plan) return undefined;
        const event = plan.events.find(e => e.id === eventId);
        if (!event) return undefined;
        return schema.events.find(e => e.type === event.type);
    };



    const renderDatePicker = (param: Parameter) => {
        if (!plan?.birth_date) return null;

        const paramData = parameters[param.id];
        const value = paramData?.value || 0;

        return (
            <DatePicker
                value={value}
                onChange={(newValue) => {
                    handleInputChange(param.id, newValue);
                    handleInputBlur(param.id, newValue);
                }}
                birthDate={plan.birth_date}
                placeholder="Pick a date"
            />
        );
    };

    const renderInput = (param: Parameter, eventType?: string) => {
        const paramData = parameters[param.id];
        const value = paramData?.value ?? '';
        const event = plan?.events.find(e => e.id === eventId);
        const typeToUse = eventType || (event ? event.type : '');
        const paramUnits = getParameterUnits(typeToUse, param.type);
        const schemaParam = eventType
            ? schema?.events.find(e => e.type === eventType)?.parameters.find(p => p.type === param.type)
            : event ? schema?.events.find(e => e.type === event.type)?.parameters.find(p => p.type === param.type) : undefined;
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

        if (paramUnits === 'usd') {
            // Show formatted value with commas, but store as number
            let displayValue = value === 0 ? '' : value;
            if (value && !isNaN(Number(value))) {
                displayValue = Number(value).toLocaleString('en-US');
            }
            displayValue = String(displayValue);
            const placeholder = defaultValue ? String(defaultValue) : '';
            return (
                <div className="relative">
                    <Input
                        type="text"
                        value={String(displayValue)}
                        placeholder={String(placeholder)}
                        onChange={(e) => {
                            // Remove commas for storage
                            let newValue = e.target.value.replace(/,/g, '');
                            newValue = newValue === '' ? '' : String(parseFloat(newValue) || 0);
                            handleInputChange(param.id, newValue);
                        }}
                        onBlur={(e) => {
                            let newValue = e.target.value.replace(/,/g, '');
                            newValue = newValue === '' ? '' : String(parseFloat(newValue) || 0);
                            handleInputBlur(param.id, newValue);
                        }}
                        className="w-full pr-12 placeholder:text-muted-foreground"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        $
                    </div>
                </div>
            );
        }

        if (paramUnits === 'apy' || paramUnits === 'percentage') {
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
                        {paramUnits === 'apy' ? 'APY' : '%'}
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
                        {event && getEventIcon(event.type)}
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
                </form>
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
                                            {mainEventSchema?.updating_events?.map(ue => (
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
                                                            {renderInput(param, ue.type)}
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
            </DialogContent>
        </Dialog>
    );
};

export default EventParametersForm;