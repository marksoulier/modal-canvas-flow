import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, differenceInDays, isValid, parse } from 'date-fns';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';
import { cn } from '../lib/utils';
import { getAgeFromBirthToDate, getTargetDateFromBirthAndAge } from '../contexts/PlanContext';
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
    const [isExpanded, setIsExpanded] = useState(false);
    const [monthInput, setMonthInput] = useState<string>("");
    const [dayInput, setDayInput] = useState<string>("");
    const [yearInput, setYearInput] = useState<string>("");
    const [focusedInput, setFocusedInput] = useState<'month' | 'day' | 'year' | null>(null);

    const monthRef = useRef<HTMLInputElement>(null);
    const dayRef = useRef<HTMLInputElement>(null);
    const yearRef = useRef<HTMLInputElement>(null);

    // Update view month when value changes
    useEffect(() => {
        if (value) {
            setViewMonth(new Date(value + 'T00:00:00'));
        }
    }, [value]);

    // Update inputs when value changes
    useEffect(() => {
        if (value && !isExpanded) {
            try {
                const date = new Date(value + 'T00:00:00');
                setMonthInput(format(date, 'MM'));
                setDayInput(format(date, 'dd'));
                setYearInput(format(date, 'yyyy'));
            } catch {
                setMonthInput("");
                setDayInput("");
                setYearInput("");
            }
        }
    }, [value, isExpanded]);

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
        setIsExpanded(false);
    };

    const handleInputFocus = () => {
        setIsExpanded(true);
        setFocusedInput('month');
        setTimeout(() => monthRef.current?.focus(), 0);
    };

    const handleInputBlur = () => {
        // Delay to allow for tab navigation
        setTimeout(() => {
            if (!monthRef.current?.contains(document.activeElement) &&
                !dayRef.current?.contains(document.activeElement) &&
                !yearRef.current?.contains(document.activeElement)) {
                setIsExpanded(false);
                setFocusedInput(null);
                updateDateFromInputs();
            }
        }, 100);
    };

    const updateDateFromInputs = () => {
        const month = parseInt(monthInput, 10);
        const day = parseInt(dayInput, 10);
        const year = parseInt(yearInput, 10);

        if (!isNaN(month) && !isNaN(day) && !isNaN(year) &&
            month >= 1 && month <= 12 &&
            day >= 1 && day <= 31 &&
            year >= 1900 && year <= 2100) {

            try {
                const dateString = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const testDate = new Date(dateString + 'T00:00:00');
                if (isValid(testDate)) {
                    onChange(dateString);
                }
            } catch {
                // Invalid date, don't update
            }
        }
    };

    const handleInputChange = (type: 'month' | 'day' | 'year', value: string) => {
        const numValue = value.replace(/\D/g, '');

        switch (type) {
            case 'month':
                setMonthInput(numValue.slice(0, 2));
                if (numValue.length === 2 && parseInt(numValue) <= 12) {
                    dayRef.current?.focus();
                    setFocusedInput('day');
                }
                break;
            case 'day':
                setDayInput(numValue.slice(0, 2));
                if (numValue.length === 2 && parseInt(numValue) <= 31) {
                    yearRef.current?.focus();
                    setFocusedInput('year');
                }
                break;
            case 'year':
                setYearInput(numValue.slice(0, 4));
                if (numValue.length === 4) {
                    updateDateFromInputs();
                }
                break;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'month' | 'day' | 'year') => {
        if (e.key === 'Tab') {
            e.preventDefault();
            if (type === 'month') {
                dayRef.current?.focus();
                setFocusedInput('day');
            } else if (type === 'day') {
                yearRef.current?.focus();
                setFocusedInput('year');
            } else if (type === 'year') {
                updateDateFromInputs();
                setIsExpanded(false);
                setFocusedInput(null);
            }
        } else if (e.key === 'Enter') {
            updateDateFromInputs();
            setIsExpanded(false);
            setFocusedInput(null);
        }
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

    const getDisplayText = () => {
        if (!value) return placeholder;
        try {
            const date = new Date(value + 'T00:00:00');
            return format(date, 'MMMM d, yyyy');
        } catch {
            return placeholder;
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
                            "px-3 py-2",
                            className
                        )}
                        onClick={() => setPopoverOpen(true)}
                    >
                        <CalendarIcon className="h-4 w-4" />
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

            <div className="flex-1">
                {!isExpanded ? (
                    <div
                        className={cn(
                            "px-3 py-2 border rounded-md text-sm cursor-text",
                            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                            "placeholder:text-muted-foreground",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={handleInputFocus}
                        onFocus={handleInputFocus}
                        tabIndex={disabled ? -1 : 0}
                    >
                        {getDisplayText()}
                    </div>
                ) : (
                    <div className="flex items-center gap-1 px-3 py-2 border rounded-md text-sm">
                        <input
                            ref={monthRef}
                            type="text"
                            className="w-8 text-center border-none outline-none bg-transparent"
                            placeholder="MM"
                            value={monthInput}
                            onChange={(e) => handleInputChange('month', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'month')}
                            onBlur={handleInputBlur}
                            maxLength={2}
                        />
                        <span className="text-muted-foreground">/</span>
                        <input
                            ref={dayRef}
                            type="text"
                            className="w-8 text-center border-none outline-none bg-transparent"
                            placeholder="DD"
                            value={dayInput}
                            onChange={(e) => handleInputChange('day', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'day')}
                            onBlur={handleInputBlur}
                            maxLength={2}
                        />
                        <span className="text-muted-foreground">/</span>
                        <input
                            ref={yearRef}
                            type="text"
                            className="w-12 text-center border-none outline-none bg-transparent"
                            placeholder="YYYY"
                            value={yearInput}
                            onChange={(e) => handleInputChange('year', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'year')}
                            onBlur={handleInputBlur}
                            maxLength={4}
                        />
                    </div>
                )}
            </div>

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