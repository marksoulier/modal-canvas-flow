import React, { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from './ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './ui/popover';
import { cn } from '../lib/utils';
import { formatDate } from '../visualization/viz_utils';
import DatePicker from './DatePicker';
import { usePlan, daysSinceBirthToDateString, dateStringToDaysSinceBirth } from '../contexts/PlanContext';

interface DateRangePickerProps {
    className?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ className }) => {
    const { plan, setZoomToDateRange, getCurrentVisualizationRange, loadPlan } = usePlan();
    const [isOpen, setIsOpen] = useState(false);
    const [startDateString, setStartDateString] = useState<string>("");
    const [endDateString, setEndDateString] = useState<string>("");
    const [isInitialized, setIsInitialized] = useState(false);
    const [displayText, setDisplayText] = useState<string>('Select Date Range');

    // Use refs to track if we're currently updating to prevent loops
    const isUpdatingRef = useRef(false);
    const lastKnownRangeRef = useRef<{ startDay: number; endDay: number } | null>(null);

    // Initialize the range from the current visualization range
    useEffect(() => {
        if (!plan || isInitialized) return;

        const currentRange = getCurrentVisualizationRange();
        if (currentRange) {
            // Convert days since birth to date strings
            const startDateStr = daysSinceBirthToDateString(currentRange.startDay, plan.birth_date);
            const endDateStr = daysSinceBirthToDateString(currentRange.endDay, plan.birth_date);
            setStartDateString(startDateStr);
            setEndDateString(endDateStr);
            lastKnownRangeRef.current = currentRange;
            setIsInitialized(true);
        }
    }, [plan, getCurrentVisualizationRange, isInitialized]);

    // Live update the display text and local state when visualization range changes
    useEffect(() => {
        if (!plan || !isInitialized) return;

        const currentRange = getCurrentVisualizationRange();
        //console.log("DateRangePicker - currentRange:", currentRange);

        if (currentRange &&
            (lastKnownRangeRef.current?.startDay !== currentRange.startDay ||
                lastKnownRangeRef.current?.endDay !== currentRange.endDay)) {

            //console.log("DateRangePicker - updating range:", {
            //    old: lastKnownRangeRef.current,
            //    new: currentRange
            //});

            // Convert days since birth to date strings
            const startDateStr = daysSinceBirthToDateString(currentRange.startDay, plan.birth_date);
            const endDateStr = daysSinceBirthToDateString(currentRange.endDay, plan.birth_date);
            setStartDateString(startDateStr);
            setEndDateString(endDateStr);
            lastKnownRangeRef.current = currentRange;

            // Update display text
            updateDisplayText(currentRange);
        }
    }, [plan, getCurrentVisualizationRange, isInitialized]);

    // Update calendars when popover opens to show current range
    useEffect(() => {
        if (isOpen && plan) {
            const currentRange = getCurrentVisualizationRange();
            if (currentRange) {
                // Convert days since birth to date strings
                const startDateStr = daysSinceBirthToDateString(currentRange.startDay, plan.birth_date);
                const endDateStr = daysSinceBirthToDateString(currentRange.endDay, plan.birth_date);
                setStartDateString(startDateStr);
                setEndDateString(endDateStr);
            }
        }
    }, [isOpen, plan, getCurrentVisualizationRange]);

    // Function to update display text
    const updateDisplayText = (currentRange: { startDay: number; endDay: number }) => {
        if (!plan || !plan.birth_date) {
            setDisplayText('Select Date Range');
            return;
        }

        const birthDate = new Date(plan.birth_date + 'T00:00:00');
        const startFormatted = formatDate(currentRange.startDay, birthDate, 'month_year', true);
        const endFormatted = formatDate(currentRange.endDay, birthDate, 'month_year', true);

        const newDisplayText = `${startFormatted} | ${endFormatted}`;
        //console.log("DateRangePicker - updating display text:", newDisplayText);
        setDisplayText(newDisplayText);
    };

    // Force update display text when plan changes
    useEffect(() => {
        if (!plan || !plan.birth_date) {
            setDisplayText('Select Date Range');
            return;
        }

        const currentRange = getCurrentVisualizationRange();
        if (currentRange) {
            updateDisplayText(currentRange);
        }
    }, [plan, getCurrentVisualizationRange]);

    // Poll for visualization range updates (fallback mechanism)
    useEffect(() => {
        if (!plan || !plan.birth_date) return;

        const interval = setInterval(() => {
            const currentRange = getCurrentVisualizationRange();
            if (currentRange &&
                (lastKnownRangeRef.current?.startDay !== currentRange.startDay ||
                    lastKnownRangeRef.current?.endDay !== currentRange.endDay)) {

                //console.log("DateRangePicker - polling update:", currentRange);
                // Convert days since birth to date strings
                const startDateStr = daysSinceBirthToDateString(currentRange.startDay, plan.birth_date);
                const endDateStr = daysSinceBirthToDateString(currentRange.endDay, plan.birth_date);
                setStartDateString(startDateStr);
                setEndDateString(endDateStr);
                lastKnownRangeRef.current = currentRange;
                updateDisplayText(currentRange);
            }
        }, 100); // Check every 100ms

        return () => clearInterval(interval);
    }, [plan, getCurrentVisualizationRange]);

    const handleApply = () => {
        if (!plan) return;

        isUpdatingRef.current = true;

        // Convert date strings to days since birth
        const startDay = dateStringToDaysSinceBirth(startDateString, plan.birth_date);
        const endDay = dateStringToDaysSinceBirth(endDateString, plan.birth_date);

        // Set the zoom range
        setZoomToDateRange(startDay, endDay);

        // Update the plan's view dates
        const updatedPlan = {
            ...plan,
            view_start_date: startDateString,
            view_end_date: endDateString
        };

        loadPlan(updatedPlan);
        lastKnownRangeRef.current = { startDay, endDay };

        // Reset the updating flag after a short delay
        setTimeout(() => {
            isUpdatingRef.current = false;
        }, 100);

        setIsOpen(false);
    };

    const handleReset = () => {
        if (!plan) return;

        isUpdatingRef.current = true;

        // Clear the zoom range
        setZoomToDateRange(0, 365 * 100); // Set to a very wide range

        // Clear the plan's view dates
        const updatedPlan = {
            ...plan,
            view_start_date: undefined,
            view_end_date: undefined
        };

        loadPlan(updatedPlan);
        lastKnownRangeRef.current = null;

        // Reset the updating flag after a short delay
        setTimeout(() => {
            isUpdatingRef.current = false;
        }, 100);

        setIsOpen(false);
    };

    if (!plan || !plan.birth_date) {
        return null;
    }

    return (
        <div className={cn("fixed top-6 right-6 z-50", className)}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        className="bg-white/90 backdrop-blur-sm hover:bg-white/95 text-gray-500 hover:text-gray-700 rounded-lg shadow-sm border border-gray-100 px-4 py-2.5 h-auto font-medium transition-all duration-200 flex items-center gap-2"
                    >
                        <span className="text-sm">
                            {displayText}
                        </span>
                        <ChevronDownIcon className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 bg-white/95 backdrop-blur-sm border border-gray-200 shadow-lg rounded-lg">
                    <div className="space-y-4">
                        <div className="flex items-center gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-500">Start Date</label>
                                <DatePicker
                                    value={startDateString}
                                    onChange={setStartDateString}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-500">End Date</label>
                                <DatePicker
                                    value={endDateString}
                                    onChange={setEndDateString}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={handleApply}
                                className="flex-1 bg-[#03c6fc]/10 hover:bg-[#03c6fc]/20 text-slate-700 border border-[#03c6fc]/20 hover:border-[#03c6fc]/40"
                            >
                                Apply
                            </Button>
                            <Button
                                onClick={handleReset}
                                variant="outline"
                                className="flex-1 text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            >
                                Reset
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default DateRangePicker; 