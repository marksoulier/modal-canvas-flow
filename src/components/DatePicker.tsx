import React, { useState, useEffect } from 'react';
import { format, addDays, differenceInDays } from 'date-fns';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';
import { cn } from '../lib/utils';
import { getAgeFromBirthToDate, getBirthDateStringFromAge, getTargetDateFromBirthAndAge } from '../visualization/viz_utils';
import { usePlan } from '../contexts/PlanContext';

interface DatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    showAgeInput?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    placeholder = "Pick a date",
    className,
    disabled = false,
    showAgeInput = true
}) => {
    const { plan } = usePlan();
    const [isOpen, setIsOpen] = useState(false);
    const [viewMonth, setViewMonth] = useState<Date>(value ? new Date(value + 'T00:00:00') : new Date());
    const [ageInput, setAgeInput] = useState<string>("");

    // Update view month when value changes
    useEffect(() => {
        if (value) {
            setViewMonth(new Date(value + 'T00:00:00'));
        }
    }, [value]);

    // Update age input when value changes (calculate age from birth date to selected date)
    useEffect(() => {
        if (value && plan?.birth_date && showAgeInput) {
            try {
                const ageInYears = getAgeFromBirthToDate(plan.birth_date, value);
                setAgeInput(Math.max(0, ageInYears).toString());
            } catch {
                setAgeInput("");
            }
        } else {
            setAgeInput("");
        }
    }, [value, plan?.birth_date, showAgeInput]);

    const getDisplayDate = (): Date | undefined => {
        if (!value) return undefined;
        try {
            return new Date(value + 'T00:00:00');
        } catch {
            return undefined;
        }
    };

    const displayDate = getDisplayDate();
    const [popoverOpen, setPopoverOpen] = useState(false);

    const handleDateSelect = (newDate: Date | undefined) => {
        if (!newDate) return;

        // Format as YYYY-MM-DD string
        const dateString = format(newDate, 'yyyy-MM-dd');
        onChange(dateString);
        setViewMonth(newDate);
        setPopoverOpen(false); // Close popover on date select
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

    const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newAge = e.target.value;
        setAgeInput(newAge);
        const ageNum = parseInt(newAge, 10);
        if (!isNaN(ageNum) && ageNum >= 0 && plan?.birth_date) {
            // Get the birth date
            const birthDate = new Date(plan.birth_date + 'T00:00:00');
            // Add the specified number of years to the birth date
            const targetDate = new Date(birthDate);
            targetDate.setFullYear(birthDate.getFullYear() + ageNum);
            // Format as YYYY-MM-DD string
            const dateString = format(targetDate, 'yyyy-MM-dd');
            onChange(dateString);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                            "w-full justify-between text-left font-normal",
                            !displayDate && "text-muted-foreground",
                            className
                        )}
                        onClick={() => setPopoverOpen(true)}
                    >
                        <div className="flex items-center">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {displayDate ? format(displayDate, "PPP") : <span>{placeholder}</span>}
                        </div>
                        <ChevronDownIcon className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="flex justify-between px-2 py-1.5 border-b gap-2">
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
                    <Calendar
                        mode="single"
                        selected={displayDate}
                        onSelect={handleDateSelect}
                        month={viewMonth}
                        onMonthChange={setViewMonth}
                        defaultMonth={viewMonth}
                        className="pointer-events-auto"
                    />
                </PopoverContent>
            </Popover>
            {showAgeInput && (
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
            )}
            {showAgeInput && <span className="text-xs text-muted-foreground">age</span>}
        </div>
    );
};

export default DatePicker; 