import React from 'react';
import { TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import chroma from 'chroma-js';
import { dateStringToDaysSinceBirth } from '../contexts/PlanContext';

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
    return `${sign}$${absNum.toFixed(2)}`;
};

// Helper to calculate age in years from days since birth
export const getAgeFromDays = (daysSinceBirth: number): number => {
    return Math.floor(daysSinceBirth / 365.25);
};

// Helper to calculate days since birth from age in years
export const getDaysFromAge = (age: number): number => {
    return Math.round(age * 365.25);
};

// Calculate age from birth date string and target date string
export const getAgeFromDateStrings = (birthDateString: string, targetDateString: string): number => {
    const birthDate = new Date(birthDateString + 'T00:00:00');
    const targetDate = new Date(targetDateString + 'T00:00:00');
    const daysSinceBirth = Math.floor((targetDate.getTime() - birthDate.getTime()) / (24 * 60 * 60 * 1000));
    return Math.floor(daysSinceBirth / 365.25);
};

// Calculate age from birth date to a specific target date (for DatePicker context)
export const getAgeFromBirthToDate = (birthDateString: string, targetDateString: string): number => {
    const birthDate = new Date(birthDateString + 'T00:00:00');
    const targetDate = new Date(targetDateString + 'T00:00:00');
    const daysSinceBirth = Math.floor((targetDate.getTime() - birthDate.getTime()) / (24 * 60 * 60 * 1000));
    return Math.floor(daysSinceBirth / 365.25);
};

// Calculate birth date string from current birth date string and desired age
export const getBirthDateStringFromAge = (currentBirthDateString: string, desiredAge: number): string => {
    const currentBirthDate = new Date(currentBirthDateString + 'T00:00:00');
    const today = new Date();
    const daysSinceBirth = Math.round(desiredAge * 365.25);
    const newBirthDate = new Date(today);
    newBirthDate.setDate(today.getDate() - daysSinceBirth);
    return newBirthDate.toISOString().split('T')[0];
};

// Calculate target date from birth date and age
export const getTargetDateFromBirthAndAge = (birthDateString: string, age: number): string => {
    const birthDate = new Date(birthDateString + 'T00:00:00');
    const targetDate = new Date(birthDate.getTime());
    targetDate.setDate(birthDate.getDate() + Math.round(age * 365.25));
    return targetDate.toISOString().split('T')[0];
};

// Convert days since birth to actual date
export const daysToDate = (daysSinceBirth: number, birthDate: Date): Date => {
    // Create a new date object to avoid mutating the original
    const result = new Date(birthDate.getTime());
    result.setDate(result.getDate() + daysSinceBirth);
    return result;
};

// Get interval in days based on selected time interval
export type TimeInterval = 'day' | 'half_week' | 'week' | 'month' | 'quarter' | 'half_year' | 'year';
export type ExtendedTimeInterval = TimeInterval | 'full' | 'month_year';

export const getIntervalInDays = (interval: TimeInterval): number => {
    switch (interval) {
        case 'day':
            return 1;
        case 'half_week':
            return 3.5;
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
            return 1;
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
        case 'month_year':
            dateStr = date.toLocaleString('default', {
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

// Format date string directly (for date string parameters)
export const formatDateString = (
    dateString: string,
    birthDate: Date,
    interval: ExtendedTimeInterval,
    showAge: boolean = false,
    showAgeAsJSX: boolean = false
): string | JSX.Element => {
    // Convert date string to days since birth
    const daysSinceBirth = dateStringToDaysSinceBirth(dateString, birthDate.toISOString().split('T')[0]);
    return formatDate(daysSinceBirth, birthDate, interval, showAge, showAgeAsJSX);
};

// Generate subtle colors for categories
export const generateEnvelopeColors = (categories: string[]): Record<string, { area: string; line: string }> => {
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

    return categories.reduce((acc, category, index) => {
        acc[category] = baseColors[index % baseColors.length];
        return acc;
    }, {} as Record<string, { area: string; line: string }>);
};

// --- New: Generate category and envelope colors ---

// Assign a base color to each category (can be customized as needed)
const CATEGORY_BASE_COLORS: Record<string, string> = {
    'Savings': '#FFC107', // Yellow
    'Investments': '#00BCD4', // Cyan
    'Income': '#FF9800', // Orange
    'Retirement': '#9C27B0', // Purple
    'Debt': '#F44336', // Red
    'Cash': '#4CAF50', // Green
    'Assets': '#888888', // Grey
};

// Fallback palette for categories not in the above
const BASE_COLOR_PALETTE = [
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#F44336', // Red
    '#00BCD4', // Cyan
    '#8BC34A', // Light Green
    '#E91E63', // Pink
    '#888888', // Gray
];

// Returns { envelopeColors, categoryColors }
export function getEnvelopeAndCategoryColors(
    envelopes: { name: string; category: string }[],
    categories: string[]
): {
    envelopeColors: Record<string, { area: string; line: string }>,
    categoryColors: Record<string, { area: string; line: string }>
} {
    // Assign base color to each category
    const categoryBaseColors: Record<string, string> = {};
    let paletteIdx = 0;
    categories.forEach((cat) => {
        if (CATEGORY_BASE_COLORS[cat]) {
            categoryBaseColors[cat] = CATEGORY_BASE_COLORS[cat];
        } else {
            categoryBaseColors[cat] = BASE_COLOR_PALETTE[paletteIdx % BASE_COLOR_PALETTE.length];
            paletteIdx++;
        }
    });
    // For each category, get all envelopes in that category
    const categoryToEnvelopes: Record<string, string[]> = {};
    envelopes.forEach(env => {
        if (!env.category) return; // skip undefined categories
        const cat = env.category;
        if (!categoryToEnvelopes[cat]) categoryToEnvelopes[cat] = [];
        categoryToEnvelopes[cat].push(env.name);
    });
    // Generate envelope colors (shades/tints of category base)
    const envelopeColors: Record<string, { area: string; line: string }> = {};
    Object.entries(categoryToEnvelopes).forEach(([cat, envNames]) => {
        const base = categoryBaseColors[cat] || '#888888';
        // Use chroma-js to generate a scale for this category
        const scale = chroma.scale([
            chroma(base).brighten(1.2).saturate(0.5).hex(),
            base,
            chroma(base).darken(1.2).saturate(1.2).hex()
        ]).mode('lab').colors(envNames.length);
        envNames.forEach((env, i) => {
            // Area: lighter, Line: base or darker
            envelopeColors[env] = {
                area: chroma(scale[i]).brighten(1.2).alpha(0.18).hex(),
                line: scale[i]
            };
        });
    });
    // Category colors (for legend): area is light, line is base
    const categoryColors: Record<string, { area: string; line: string }> = {};
    Object.entries(categoryBaseColors).forEach(([cat, base]) => {
        categoryColors[cat] = {
            area: chroma(base).brighten(2).alpha(0.18).hex(),
            line: base
        };
    });
    return { envelopeColors, categoryColors };
}

// Legend component
export const Legend = ({
    envelopes,
    envelopeColors,
    currentValues,
    getCategory,
    categoryColors,
    nonNetworthEnvelopes,
    nonNetworthCurrentValues
}: {
    envelopes: string[];
    envelopeColors: Record<string, { area: string; line: string }>;
    currentValues: { [key: string]: number };
    getCategory: (envelope: string) => string | undefined;
    categoryColors: Record<string, { area: string; line: string }>;
    nonNetworthEnvelopes?: string[];
    nonNetworthCurrentValues?: { [key: string]: number };
}) => {
    // Group envelopes by category
    const categoryMap: Record<string, string[]> = {};
    envelopes.forEach((envelope) => {
        const category = getCategory(envelope);
        if (!category) return; // skip undefined categories
        if (!categoryMap[category]) categoryMap[category] = [];
        categoryMap[category].push(envelope);
    });

    // Group non-networth envelopes by category
    const nonNetworthCategoryMap: Record<string, string[]> = {};
    if (nonNetworthEnvelopes && nonNetworthCurrentValues) {
        nonNetworthEnvelopes.forEach((envelope) => {
            const category = getCategory(envelope) || 'Non-Networth';
            if (!nonNetworthCategoryMap[category]) nonNetworthCategoryMap[category] = [];
            nonNetworthCategoryMap[category].push(envelope);
        });
    }

    if (!envelopes || envelopes.length === 0) {
        return null;
    }
    // Calculate net worth as the sum of all envelope values
    const netWorth = envelopes.reduce((sum, env) => sum + (currentValues[env] || 0), 0);

    // Choose a color for the net worth box (you can pick a unique color or reuse a category color)
    const netWorthColor = { area: '#335966', line: '#03c6fc' }; // Example: blue/teal

    return (
        <div className="absolute right-4 bottom-12 bg-white p-4 rounded-lg shadow-lg" style={{ pointerEvents: 'none' }}>
            <div
                className="flex items-center justify-between space-x-4"
                style={{ fontWeight: 600, color: '#222', fontSize: '1rem', marginBottom: 12 }}
            >
                <div className="flex items-center space-x-2">
                    {/* <div
                        className="w-4 h-4 rounded"
                        style={{
                            backgroundColor: netWorthColor.area,
                            border: `2px solid ${netWorthColor.line}`,
                        }}
                    /> */}
                    <span className="text-sm" style={{ fontWeight: 500 }}>
                        Net Worth
                    </span>
                </div>
                <span className="text-xs text-gray-800" style={{ fontWeight: 700 }}>
                    {formatNumber({ valueOf: () => netWorth })}
                </span>
            </div>
            <div className="space-y-3">
                {Object.entries(categoryMap).map(([category, envs]) => {
                    const catColor = categoryColors[category] || { area: '#ccc', line: '#888' };
                    const categorySum = envs.reduce((sum, env) => sum + (currentValues[env] || 0), 0);
                    // Only show envelope list if:
                    // - more than one envelope in category, or
                    // - the only envelope does NOT start with 'Other'
                    const showEnvelopes = envs.length > 1 || (envs.length === 1 && !/^other/i.test(envs[0]));
                    return (
                        <div key={category} style={{ marginBottom: 12 }}>
                            <div className="flex items-center justify-between space-x-4" style={{ fontWeight: 600, color: '#222', fontSize: '1rem' }}>
                                <div className="flex items-center space-x-2">
                                    <div className="w-4 h-4 rounded" style={{ backgroundColor: catColor.area, border: `2px solid ${catColor.line}` }} />
                                    <span className="text-sm" style={{ fontWeight: 500 }}>{category}</span>
                                </div>
                                <span className="text-xs text-gray-500" style={{ fontWeight: 500 }}>{formatNumber({ valueOf: () => categorySum })}</span>
                            </div>
                            {showEnvelopes && (
                                <div style={{ marginLeft: 20, marginTop: 2 }} className="space-y-1">
                                    {envs
                                        .filter(envelope => Number((currentValues[envelope] || 0).toFixed(2)) !== 0) // Filter out values that round to 0.00
                                        .map((envelope) => {
                                            const envColor = envelopeColors[envelope] || catColor;
                                            return (
                                                <div key={envelope} className="flex items-center justify-between space-x-4">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-3 h-3 rounded" style={{ backgroundColor: envColor.area, border: `2px solid ${envColor.line}` }} />
                                                        <span className="text-xs" style={{ fontWeight: 500, color: '#444' }}>{envelope}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        {formatNumber({ valueOf: () => currentValues[envelope] || 0 })}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Render non-networth categories */}
                {Object.entries(nonNetworthCategoryMap).map(([category, envs]) => {
                    const catColor = categoryColors[category] || { area: '#ff6b6b', line: '#ff4757' };
                    const categorySum = envs.reduce((sum, env) => sum + ((nonNetworthCurrentValues && nonNetworthCurrentValues[env]) || 0), 0);
                    const showEnvelopes = envs.length > 1 || (envs.length === 1 && !/^other/i.test(envs[0]));
                    return (
                        <div key={`non-networth-${category}`} style={{ marginBottom: 12, opacity: 0.8 }}>
                            <div className="flex items-center justify-between space-x-4" style={{ fontWeight: 600, color: '#222', fontSize: '1rem' }}>
                                <div className="flex items-center space-x-2">
                                    <div className="w-4 h-4 rounded" style={{
                                        backgroundColor: 'transparent',
                                        border: `2px dashed ${catColor.line}`,
                                        borderRadius: '2px'
                                    }} />
                                    <span className="text-sm" style={{ fontWeight: 500, fontStyle: 'italic' }}>{category} (Debug)</span>
                                </div>
                                <span className="text-xs text-gray-500" style={{ fontWeight: 500 }}>{formatNumber({ valueOf: () => categorySum })}</span>
                            </div>
                            {showEnvelopes && nonNetworthCurrentValues && (
                                <div style={{ marginLeft: 20, marginTop: 2 }} className="space-y-1">
                                    {envs
                                        .filter(envelope => Number((nonNetworthCurrentValues[envelope] || 0).toFixed(2)) !== 0) // Filter out values that round to 0.00
                                        .map((envelope) => {
                                            const envColor = envelopeColors[envelope] || catColor;
                                            return (
                                                <div key={envelope} className="flex items-center justify-between space-x-4">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-3 h-3 rounded" style={{
                                                            backgroundColor: 'transparent',
                                                            border: `2px dashed ${envColor.line}`,
                                                            borderRadius: '2px'
                                                        }} />
                                                        <span className="text-xs" style={{ fontWeight: 500, color: '#444', fontStyle: 'italic' }}>{envelope}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        {formatNumber({ valueOf: () => nonNetworthCurrentValues[envelope] || 0 })}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Find the closest point in data to a given x value
export interface Datum {
    date: number;
    value: number;
    parts: {
        [key: string]: number;
    };
    nonNetworthParts?: {
        [key: string]: number;
    };
}

// Find the first day when net worth exceeds the retirement goal
export const findFirstDayAboveGoal = (
    netWorthData: Datum[],
    retirementGoal: number
): number | null => {
    if (!netWorthData.length || retirementGoal <= 0) return null;

    // Find the first point where net worth exceeds the goal
    for (let i = 0; i < netWorthData.length; i++) {
        if (netWorthData[i].value >= retirementGoal) {
            return netWorthData[i].date;
        }
    }

    return null;
};

export const findClosestPoint = (data: Datum[], dataX: number): Datum | null => {
    if (!data.length) return null;
    return data.reduce((closest, point) => {
        const distance = Math.abs(point.date - dataX);
        const closestDistance = Math.abs(closest.date - dataX);
        return distance < closestDistance ? point : closest;
    });
};

// Get the net worth, locked net worth, and their difference on a specific day (exact match only)
export const getNetWorthAndLockedOnDay = (
    netWorthData: Datum[],
    lockedNetWorthData: { date: number, value: number }[],
    day: number
): { netWorth: number, lockedNetWorth: number, difference: number } | null => {
    const netWorthPoint = netWorthData.find(d => d.date === day);
    const lockedPoint = lockedNetWorthData.find(d => d.date === day);
    if (!netWorthPoint || !lockedPoint) return null;
    return {
        netWorth: netWorthPoint.value,
        lockedNetWorth: lockedPoint.value,
        difference: netWorthPoint.value - lockedPoint.value,
    };
};

// Helper function to normalize -0 to 0 and small values near zero
export const normalizeZero = (value: number): number => {
    const threshold = 1e-2; // Very small threshold for floating point precision
    return Math.abs(value) < threshold ? 0 : value;
};

// Helper function to detect if a transition is from/to zero (manhattan style needed)
export const isZeroTransition = (prevValue: number, currentValue: number): boolean => {
    const prev = normalizeZero(prevValue);
    const curr = normalizeZero(currentValue);
    // True if going from 0 to value OR from value to 0
    return false; //set false for now.
    //return (prev === 0 && curr !== 0) || (prev !== 0 && curr === 0);
};

// Helper function to split data into segments based on 0-to-value transitions
export const splitDataForMixedCurves = (data: any[], getValueFn: (d: any) => number) => {
    if (data.length < 2) return { stepSegments: [], linearSegments: [data] };

    const stepSegments: any[][] = [];
    const linearSegments: any[][] = [];
    let currentSegment: any[] = [data[0]];
    let isCurrentSegmentStep = false;

    for (let i = 1; i < data.length; i++) {
        const prevValue = getValueFn(data[i - 1]);
        const currentValue = getValueFn(data[i]);
        const isStepTransition = isZeroTransition(prevValue, currentValue);

        if (isStepTransition && !isCurrentSegmentStep) {
            // Start a new step segment
            if (currentSegment.length > 1) {
                linearSegments.push(currentSegment);
            }
            currentSegment = [data[i - 1], data[i]];
            isCurrentSegmentStep = true;
        } else if (!isStepTransition && isCurrentSegmentStep) {
            // End step segment, start linear segment
            stepSegments.push(currentSegment);
            currentSegment = [data[i - 1], data[i]];
            isCurrentSegmentStep = false;
        } else {
            // Continue current segment
            currentSegment.push(data[i]);
        }
    }

    // Add the final segment
    if (currentSegment.length > 1) {
        if (isCurrentSegmentStep) {
            stepSegments.push(currentSegment);
        } else {
            linearSegments.push(currentSegment);
        }
    }

    return { stepSegments, linearSegments };
};