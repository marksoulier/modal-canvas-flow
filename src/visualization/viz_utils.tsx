import React from 'react';
import { TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import chroma from 'chroma-js';

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
    'Savings': '#2196F3', // Blue
    'Investments': '#4CAF50', // Green
    'Income': '#FF9800', // Orange
    'Retirement': '#9C27B0', // Purple
    'Debt': '#F44336', // Red
    'Cash': '#00BCD4', // Cyan
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
export const Legend = ({ envelopes, envelopeColors, currentValues, getCategory, categoryColors }: {
    envelopes: string[];
    envelopeColors: Record<string, { area: string; line: string }>;
    currentValues: { [key: string]: number };
    getCategory: (envelope: string) => string | undefined;
    categoryColors: Record<string, { area: string; line: string }>;
}) => {
    // Group envelopes by category
    const categoryMap: Record<string, string[]> = {};
    envelopes.forEach((envelope) => {
        const category = getCategory(envelope);
        if (!category) return; // skip undefined categories
        if (!categoryMap[category]) categoryMap[category] = [];
        categoryMap[category].push(envelope);
    });

    return (
        <div className="absolute right-4 bottom-12 bg-white p-4 rounded-lg shadow-lg">
            <h3 className="text-sm font-semibold mb-2">Envelopes</h3>
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
                                    {envs.map((envelope) => {
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
}

export const findClosestPoint = (data: Datum[], dataX: number): Datum | null => {
    if (!data.length) return null;
    return data.reduce((closest, point) => {
        const distance = Math.abs(point.date - dataX);
        const closestDistance = Math.abs(closest.date - dataX);
        return distance < closestDistance ? point : closest;
    });
};