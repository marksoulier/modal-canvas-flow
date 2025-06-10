import React, { useState, useEffect } from 'react';
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
import type { EventSchema, EventDefinition } from '../types/eventSchema';

interface EventParametersModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventType?: string;
  schemaPath: string;
}

const EventParametersModal: React.FC<EventParametersModalProps> = ({
  isOpen,
  onClose,
  eventType = "Event",
  schemaPath
}) => {
  const [schema, setSchema] = useState<EventSchema | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});

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
        const initialParams: Record<string, string> = {};
        event.parameters.forEach(param => {
          initialParams[param.type] = param.default.toString();
        });
        setParameters(initialParams);
      }
    }
  }, [schema, eventType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Event parameters:', parameters);
    onClose();
  };

  const handleInputChange = (field: string, value: string) => {
    setParameters(prev => ({ ...prev, [field]: value }));
  };

  const getEventDefinition = (): EventDefinition | undefined => {
    if (!schema || !eventType) return undefined;
    return schema.events.find(e => e.type === eventType);
  };

  const event = getEventDefinition();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure {eventType}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {event?.parameters.map((param) => (
            <div key={param.type} className="space-y-2">
              <Label htmlFor={param.type}>{param.description}</Label>
              <Input
                id={param.type}
                value={parameters[param.type] || ''}
                onChange={(e) => handleInputChange(param.type, e.target.value)}
                placeholder={`Enter ${param.description.toLowerCase()}`}
                required
                type={typeof param.default === 'number' ? 'number' : 'text'}
                step={typeof param.default === 'number' ? 'any' : undefined}
              />
            </div>
          ))}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Event
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventParametersModal;
