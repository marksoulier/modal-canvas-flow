import React from 'react';
import { TooltipWithBounds, defaultStyles } from '@visx/tooltip';

// Format number as currency with suffixes
export const formatNumber = (value: { valueOf(): number }): string => {
    const num = value.valueOf();
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (absNum >= 1000000) {
        return `${sign}$${(absNum / 1000000).toFixed(1)}M`;
    }
    if (absNum >= 10000) {
        return `${sign}$${(absNum / 1000).toFixed(0)}k`;
    }
    if (absNum >= 1000) {
        return `${sign}$${Number(absNum.toFixed(0)).toLocaleString()}`;
    }
    return `${sign}$${absNum.toFixed(0)}`;
};

// Helper to calculate age in years from days since birth
export const getAgeFromDays = (daysSinceBirth: number): number => {
    return Math.floor(daysSinceBirth / 365.25);
};

// Helper to calculate days since birth from age in years
export const getDaysFromAge = (age: number): number => {
    return Math.round(age * 365.25);
};

// Convert days since birth to actual date
export const daysToDate = (daysSinceBirth: number, birthDate: Date): Date => {
    const result = new Date(birthDate);
    result.setDate(result.getDate() + daysSinceBirth);
    return result;
};

// Get interval in days based on selected time interval
export type TimeInterval = 'day' | 'week' | 'month' | 'quarter' | 'half_year' | 'year';
export type ExtendedTimeInterval = TimeInterval | 'full';

export const getIntervalInDays = (interval: TimeInterval): number => {
    switch (interval) {
        case 'day':
            return 1;
        case 'week':
            return 7;
        case 'month':
            return 365 / 12;
        case 'quarter':
            return 91.25;
        case 'half_year':
            return 182.5;
        case 'year':
            return 365;
        default:
            return 365;
    }
};

// Format date based on time interval, now also returns age if requested
export const formatDate = (
    daysSinceBirth: number,
    birthDate: Date,
    interval: ExtendedTimeInterval,
    showAge: boolean = false,
    showAgeAsJSX: boolean = false
): string | JSX.Element => {
    const date = daysToDate(daysSinceBirth, birthDate);
    let dateStr = '';
    switch (interval) {
        case 'year':
            dateStr = date.getFullYear().toString();
            break;
        case 'month':
            if (date.getMonth() === 0) {
                dateStr = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
            } else {
                dateStr = date.toLocaleString('default', { month: 'short' });
            }
            break;
        case 'week':
        case 'day':
            dateStr = date.toLocaleString('default', {
                day: 'numeric',
                month: 'short'
            });
            break;
        case 'full':
            dateStr = date.toLocaleString('default', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            break;
        default:
            dateStr = date.toLocaleDateString();
    }
    if (showAge) {
        const age = getAgeFromDays(daysSinceBirth);
        if (showAgeAsJSX) {
            return <><span>{dateStr} </span><span style={{ color: '#b0b0b0', fontWeight: 400 }}>({age})</span></>;
        }
        return `${dateStr} (${age})`;
    }
    return dateStr;
};

// Generate subtle colors for envelopes
export const generateEnvelopeColors = (envelopes: string[]): Record<string, { area: string; line: string }> => {
    const baseColors = [
        { area: '#E3F2FD', line: '#2196F3' }, // Blue
        { area: '#E8F5E9', line: '#4CAF50' }, // Green
        { area: '#FFF3E0', line: '#FF9800' }, // Orange
        { area: '#F3E5F5', line: '#9C27B0' }, // Purple
        { area: '#FFEBEE', line: '#F44336' }, // Red
        { area: '#E0F7FA', line: '#00BCD4' }, // Cyan
        { area: '#F1F8E9', line: '#8BC34A' }, // Light Green
        { area: '#FCE4EC', line: '#E91E63' }, // Pink
    ];

    return envelopes.reduce((acc, envelope, index) => {
        acc[envelope] = baseColors[index % baseColors.length];
        return acc;
    }, {} as Record<string, { area: string; line: string }>);
};

// Legend component
export const Legend = ({ envelopes, colors, currentValues }: {
    envelopes: string[];
    colors: Record<string, { area: string; line: string }>;
    currentValues: { [key: string]: number };
}) => (
    <div className="absolute right-4 bottom-4 bg-white p-4 rounded-lg shadow-lg">
        <h3 className="text-sm font-semibold mb-2">Envelopes</h3>
        <div className="space-y-2">
            {envelopes.map((envelope) => (
                <div key={envelope} className="flex items-center justify-between space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: colors[envelope].area, border: `2px solid ${colors[envelope].line}` }} />
                        <span className="text-sm">{envelope}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                        {formatNumber({ valueOf: () => currentValues[envelope] || 0 })}
                    </span>
                </div>
            ))}
        </div>
    </div>
);

// Find the closest point in data to a given x value
export interface Datum {
    date: number;
    value: number;
    parts: {
        [key: string]: number;
    };
}

export const findClosestPoint = (data: Datum[], dataX: number): Datum | null => {
    if (!data.length) return null;
    return data.reduce((closest, point) => {
        const distance = Math.abs(point.date - dataX);
        const closestDistance = Math.abs(closest.date - dataX);
        return distance < closestDistance ? point : closest;
    });
};