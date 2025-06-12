
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { cn } from '@/lib/utils';
import type { EventSchema, EventDefinition } from '../types/eventSchema';

interface EventParametersFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (parameters: Record<string, any>) => void;
  onDelete?: () => void;
  eventType?: string;
  initialParameters?: Record<string, any>;
  schemaPath: string;
}

const EventParametersForm: React.FC<EventParametersFormProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  eventType = "Event",
  initialParameters = {},
  schemaPath
}) => {
  const [schema, setSchema] = useState<EventSchema | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSchema = async () => {
      try {
        const response = await fetch(schemaPath);
        const data = await response.json();
        setSchema(data);
      } catch (error) {
        console.error('Error loading schema:', error);
      }
    };
    loadSchema();
  }, [schemaPath]);

  useEffect(() => {
    if (schema && eventType) {
      const event = schema.events.find(e => e.type === eventType);
      if (event) {
        const newParams: Record<string, any> = {};
        event.parameters.forEach(param => {
          newParams[param.type] = initialParameters[param.type] ?? param.default;
        });
        setParameters(newParams);
      }
    }
  }, [schema, eventType, initialParameters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(parameters);
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setParameters(prev => ({ ...prev, [field]: value }));
  };

  const getEventDefinition = (): EventDefinition | undefined => {
    if (!schema || !eventType) return undefined;
    return schema.events.find(e => e.type === eventType);
  };

  const renderDatePicker = (param: any, value: any) => {
    const date = value ? new Date(value) : undefined;
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => {
              if (newDate) {
                handleInputChange(param.type, newDate.toISOString());
              }
            }}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    );
  };

  const renderInput = (param: any) => {
    const value = parameters[param.type];
    
    if (param.type === 'start_time' || param.type === 'end_time') {
      return renderDatePicker(param, value);
    }
    
    if (typeof param.default === 'number') {
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => handleInputChange(param.type, parseFloat(e.target.value) || 0)}
          step="any"
          className="w-full"
        />
      );
    }
    
    return (
      <Input
        type="text"
        value={value || ''}
        onChange={(e) => handleInputChange(param.type, e.target.value)}
        className="w-full"
      />
    );
  };

  const event = getEventDefinition();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {eventType}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {event?.parameters.map((param) => (
            <div key={param.type} className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor={param.type} className="text-sm font-medium">
                  {param.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {param.description}
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
              variant="outline" 
              onClick={onClose} 
              className="w-full"
              disabled={loading}
            >
              Cancel
            </Button>
            
            {onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                className="w-full bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
                disabled={loading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Event
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventParametersForm;
