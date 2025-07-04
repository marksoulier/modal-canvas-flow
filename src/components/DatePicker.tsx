import React, { useState } from 'react';
import { format, addDays } from 'date-fns';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';
import { cn } from '../lib/utils';

interface DatePickerProps {
    value: string | number;
    onChange: (value: string) => void;
    birthDate?: string;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    isBirthDate?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    birthDate,
    placeholder = "Pick a date",
    className,
    disabled = false,
    isBirthDate = false
}) => {
    const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
        if (isBirthDate && value) {
            return new Date(value as string);
        }
        if (birthDate && value) {
            const birth = new Date(birthDate);
            const daysSinceBirth = typeof value === 'string' ? parseInt(value) : value;
            return addDays(birth, daysSinceBirth);
        }
        return new Date();
    });

    const getDisplayDate = (): Date | undefined => {
        if (isBirthDate) {
            return value ? new Date(value as string) : undefined;
        }
        if (!birthDate || !value) return undefined;
        const birth = new Date(birthDate);
        const daysSinceBirth = typeof value === 'string' ? parseInt(value) : value;
        return addDays(birth, daysSinceBirth);
    };

    const handleDateSelect = (newDate: Date | undefined) => {
        if (!newDate) return;

        if (isBirthDate) {
            onChange(newDate.toISOString().split('T')[0]);
            setCalendarMonth(newDate);
            return;
        }

        if (!birthDate) return;
        const birth = new Date(birthDate);
        const daysDiff = Math.floor((newDate.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
        onChange(daysDiff.toString());
        setCalendarMonth(newDate);
    };

    const handlePreviousYear = () => {
        const currentDate = getDisplayDate();
        if (!currentDate) return;

        const newDate = new Date(currentDate);
        newDate.setFullYear(newDate.getFullYear() - 1);

        if (isBirthDate) {
            onChange(newDate.toISOString().split('T')[0]);
        } else if (birthDate) {
            const birth = new Date(birthDate);
            const daysDiff = Math.floor((newDate.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
            onChange(daysDiff.toString());
        }
        setCalendarMonth(newDate);
    };

    const handleNextYear = () => {
        const currentDate = getDisplayDate();
        if (!currentDate) return;

        const newDate = new Date(currentDate);
        newDate.setFullYear(newDate.getFullYear() + 1);

        if (isBirthDate) {
            onChange(newDate.toISOString().split('T')[0]);
        } else if (birthDate) {
            const birth = new Date(birthDate);
            const daysDiff = Math.floor((newDate.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
            onChange(daysDiff.toString());
        }
        setCalendarMonth(newDate);
    };

    const handleToday = () => {
        const today = new Date();

        if (isBirthDate) {
            onChange(today.toISOString().split('T')[0]);
        } else if (birthDate) {
            const birth = new Date(birthDate);
            const daysDiff = Math.floor((today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
            onChange(daysDiff.toString());
        }
        setCalendarMonth(today);
    };

    const displayDate = getDisplayDate();

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between text-left font-normal",
                        !displayDate && "text-muted-foreground",
                        className
                    )}
                >
                    <div className="flex items-center">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {displayDate ? format(displayDate, "PPP") : <span>{placeholder}</span>}
                    </div>
                    <ChevronDownIcon className="h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={displayDate}
                    onSelect={handleDateSelect}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    defaultMonth={displayDate}
                    className="pointer-events-auto"
                    footer={
                        <div className="flex justify-between px-2 py-1.5 border-t gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={handlePreviousYear}
                            >
                                Previous Year
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={handleToday}
                                style={{ opacity: 0.7 }}
                            >
                                Today
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={handleNextYear}
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

export default DatePicker; 