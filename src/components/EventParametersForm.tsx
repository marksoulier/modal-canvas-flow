
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

interface EventParameter {
  name: string;
  type: string;
  description?: string;
  value?: any;
}

interface EventParametersFormProps {
  eventName: string;
  parameters: EventParameter[];
  onSave: (values: Record<string, any>) => void;
  onDelete: () => void;
}

export const EventParametersForm: React.FC<EventParametersFormProps> = ({
  eventName,
  parameters,
  onSave,
  onDelete
}) => {
  const [values, setValues] = useState<Record<string, any>>({});

  const handleInputChange = (paramName: string, value: any) => {
    setValues(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(values);
  };

  const renderInput = (param: EventParameter) => {
    if (param.name === 'start_time' || param.name === 'end_time') {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !values[param.name] && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {values[param.name] ? format(values[param.name], "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={values[param.name]}
              onSelect={(date) => handleInputChange(param.name, date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <Input
        type={param.type === 'number' ? 'number' : 'text'}
        value={values[param.name] || ''}
        onChange={(e) => handleInputChange(param.name, e.target.value)}
        placeholder={`Enter ${param.name}`}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{eventName}</h2>
        <p className="text-muted-foreground">Configure event parameters</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {parameters.map((param) => (
          <div key={param.name} className="space-y-2">
            <Label htmlFor={param.name} className="text-sm font-medium">
              {param.name}
            </Label>
            {renderInput(param)}
            {param.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {param.description}
              </p>
            )}
          </div>
        ))}

        <div className="flex flex-col space-y-3 pt-4">
          <Button type="submit" className="w-full">
            Save Event
          </Button>
          
          <div className="bg-red-50 p-3 rounded-md">
            <Button 
              type="button"
              variant="destructive"
              onClick={onDelete}
              className="w-full"
            >
              Delete Event
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
