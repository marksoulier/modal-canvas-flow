import React, { useState, useEffect } from 'react';
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
import { getDaysFromAge } from '../visualization/viz_utils';

interface DatePickerProps {
    value: string | number;
    onChange: (value: number) => void;
    birthDate?: string;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    birthDate,
    placeholder = "Pick a date",
    className,
    disabled = false
}) => {
    // viewMonth is the calendar's current view, independent of the selected value
    const [viewMonth, setViewMonth] = useState<Date>(() => {
        if (birthDate && value !== undefined && value !== null) {
            const birth = new Date(birthDate);
            const daysSinceBirth = Number(value);
            return addDays(birth, daysSinceBirth);
        }
        return new Date();
    });

    const getDisplayDate = (): Date | undefined => {
        if (!birthDate || value === undefined || value === null) return undefined;
        const birth = new Date(birthDate);
        const daysSinceBirth = Number(value);
        return addDays(birth, daysSinceBirth);
    };

    const displayDate = getDisplayDate();
    const handleDateSelect = (newDate: Date | undefined) => {
        if (!newDate) return;

        if (!birthDate) return;
        const birth = new Date(birthDate);
        const daysDiff = Math.floor((newDate.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
        onChange(Number(daysDiff));
        setViewMonth(newDate);
    };

    const handlePreviousYear = () => {
        const newDate = new Date(viewMonth);
        newDate.setFullYear(newDate.getFullYear() - 1);
        setViewMonth(newDate);
    };

    const handleNextYear = () => {
        const newDate = new Date(viewMonth);
        newDate.setFullYear(newDate.getFullYear() + 1);
        setViewMonth(newDate);
    };

    const handleToday = () => {
        setViewMonth(new Date());
    };

    // When the selected value changes (e.g. user picks a date or parent changes it),
    // reset the viewMonth to the selected date (so popover always opens to the right month)
    useEffect(() => {
        if (birthDate && value !== undefined && value !== null) {
            const birth = new Date(birthDate);
            const daysSinceBirth = Number(value);
            setViewMonth(addDays(birth, daysSinceBirth));
        }
    }, [birthDate, value]);

    const [ageInput, setAgeInput] = useState<string>("");

    // Update age input when value changes
    useEffect(() => {
        if (birthDate && value !== undefined && value !== null) {
            const age = Math.floor(Number(value) / 365.25);
            setAgeInput(age.toString());
        } else {
            setAgeInput("");
        }
    }, [value, birthDate]);

    const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newAge = e.target.value;
        setAgeInput(newAge);
        const ageNum = parseInt(newAge, 10);
        if (!isNaN(ageNum) && birthDate) {
            const days = getDaysFromAge(ageNum);
            onChange(days);
        }
    };

    return (
        <div className="flex items-center gap-2">
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
                        month={viewMonth}
                        onMonthChange={setViewMonth}
                        defaultMonth={viewMonth}
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
            <input
                type="number"
                min={0}
                className="w-20 px-2 py-1 border rounded text-sm"
                placeholder="Age"
                value={ageInput}
                onChange={handleAgeChange}
                disabled={disabled}
                style={{ minWidth: 0 }}
            />
            <span className="text-xs text-muted-foreground">yrs</span>
        </div>
    );
};

export default DatePicker; 