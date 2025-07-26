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
import { usePlan } from '../contexts/PlanContext';

interface DateRangePickerProps {
    className?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ className }) => {
    const { plan, setZoomToDateRange, getCurrentVisualizationRange, loadPlan } = usePlan();
    const [isOpen, setIsOpen] = useState(false);
    const [startDay, setStartDay] = useState<number>(0);
    const [endDay, setEndDay] = useState<number>(0);
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
            setStartDay(currentRange.startDay);
            setEndDay(currentRange.endDay);
            lastKnownRangeRef.current = currentRange;
            setIsInitialized(true);
        }
    }, [plan, getCurrentVisualizationRange, isInitialized]);

    // Live update the display text and local state when visualization range changes
    useEffect(() => {
        if (!plan || !isInitialized) return;

        const currentRange = getCurrentVisualizationRange();
        console.log("DateRangePicker - currentRange:", currentRange);

        if (currentRange &&
            (lastKnownRangeRef.current?.startDay !== currentRange.startDay ||
                lastKnownRangeRef.current?.endDay !== currentRange.endDay)) {

            console.log("DateRangePicker - updating range:", {
                old: lastKnownRangeRef.current,
                new: currentRange
            });

            // Update local state to reflect current visualization range
            setStartDay(currentRange.startDay);
            setEndDay(currentRange.endDay);
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
                setStartDay(currentRange.startDay);
                setEndDay(currentRange.endDay);
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
        console.log("DateRangePicker - updating display text:", newDisplayText);
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

                console.log("DateRangePicker - polling update:", currentRange);
                setStartDay(currentRange.startDay);
                setEndDay(currentRange.endDay);
                lastKnownRangeRef.current = currentRange;
                updateDisplayText(currentRange);
            }
        }, 100); // Check every 100ms

        return () => clearInterval(interval);
    }, [plan, getCurrentVisualizationRange]);

    const handleApply = () => {
        if (!plan) return;

        isUpdatingRef.current = true;

        // Set the zoom range
        setZoomToDateRange(startDay, endDay);

        // Update the plan's view dates
        const birthDate = new Date(plan.birth_date + 'T00:00:00');
        const startDate = new Date(birthDate.getTime() + startDay * 24 * 60 * 60 * 1000);
        const endDate = new Date(birthDate.getTime() + endDay * 24 * 60 * 60 * 1000);

        const updatedPlan = {
            ...plan,
            view_start_date: startDate.toISOString().split('T')[0],
            view_end_date: endDate.toISOString().split('T')[0]
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
                        className="text-black hover:text-gray-700 hover:bg-transparent p-0 h-auto font-normal"
                    >
                        <span className="text-sm">
                            {displayText}
                        </span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 bg-white/95 backdrop-blur-sm border border-gray-200">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Start Date</label>
                                <DatePicker
                                    value={startDay}
                                    onChange={setStartDay}
                                    birthDate={plan.birth_date}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">End Date</label>
                                <DatePicker
                                    value={endDay}
                                    onChange={setEndDay}
                                    birthDate={plan.birth_date}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleApply} className="flex-1">
                                Apply
                            </Button>
                            <Button onClick={handleReset} variant="outline" className="flex-1">
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