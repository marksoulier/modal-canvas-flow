import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Zoom } from '@visx/zoom';
import debounce from 'lodash/debounce';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { localPoint } from '@visx/event';
import { AxisLeft, AxisBottom } from '@visx/axis';
import TimelineAnnotation from '../components/TimelineAnnotation';
import { AreaClosed } from '@visx/shape';
import { curveLinear, curveStepAfter } from '@visx/curve';
import { LinearGradient } from '@visx/gradient';
import { TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { runSimulation } from '../hooks/simulationRunner';
import { usePlan, getEnvelopeCategory, getEnvelopeDisplayName, dateStringToDaysSinceBirth, daysSinceBirthToDateString, getEffectiveEventId } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from '../components/ui/context-menu';
import { Button } from '../components/ui/button';
import { Trash2, Edit3 } from 'lucide-react';
import {
  formatNumber,
  formatDate,
  getIntervalInDays,
  generateEnvelopeColors,
  Legend,
  findClosestPoint,
  getEnvelopeAndCategoryColors,
  findFirstDayAboveGoal,
  getNetWorthAndLockedOnDay,
} from './viz_utils';
import type {
  TimeInterval,
  Datum
} from './viz_utils';
import { getAllEventsByDateWithLocked } from './Events';
import type { Plan } from '../contexts/PlanContext';

const DEBUG = false;
const IS_ANIMATION_ENABLED = true;
const ZOOM_ANIMATION_DURATION = 750; // milliseconds
const SIMULATION_ANIMATION_DURATION = 1000; // milliseconds

// Helper function for zoom animation with easing
const animateZoom = (
  startState: { scaleX: number; translateX: number },
  endState: { scaleX: number; translateX: number },
  onUpdate: (state: { scaleX: number; translateX: number }) => void,
  onComplete?: () => void
) => {
  // If animation is disabled, immediately go to end state
  if (!IS_ANIMATION_ENABLED) {
    onUpdate(endState);
    onComplete?.();
    return;
  }

  const startTime = Date.now();

  const animate = () => {
    const currentTime = Date.now();
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / ZOOM_ANIMATION_DURATION, 1);

    // Easing function (easeInOutCubic)
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    // Interpolate between start and end states
    const currentState = {
      scaleX: startState.scaleX + (endState.scaleX - startState.scaleX) * eased,
      translateX: startState.translateX + (endState.translateX - startState.translateX) * eased
    };

    onUpdate(currentState);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  };

  requestAnimationFrame(animate);
};

// Helper function to normalize -0 to 0 and small values near zero
const normalizeZero = (value: number): number => {
  const threshold = 1e-2; // Very small threshold for floating point precision
  return Math.abs(value) < threshold ? 0 : value;
};

// Helper function to detect if a transition is from/to zero (manhattan style needed)
const isZeroTransition = (prevValue: number, currentValue: number): boolean => {
  const prev = normalizeZero(prevValue);
  const curr = normalizeZero(currentValue);
  // Detect sign changes (including transitions through zero)
  return (prev >= 0 && curr < 0) || (prev < 0 && curr >= 0);
};

// Helper function to split data into segments based on 0-to-value transitions
const splitDataForMixedCurves = (data: any[], getValueFn: (d: any) => number): { segments: any[][] } => {
  if (data.length < 2) return { segments: [data] };

  const segments: any[][] = [];
  let currentSegment: any[] = [data[0]];

  for (let i = 1; i < data.length; i++) {
    const prevValue = getValueFn(data[i - 1]);
    const currentValue = getValueFn(data[i]);
    const isTransition = isZeroTransition(prevValue, currentValue);

    if (isTransition) {
      // End current segment
      if (currentSegment.length > 0) {
        segments.push([...currentSegment]);
      }
      // Create transition segment
      segments.push([data[i - 1], data[i]]);
      // Start new segment
      currentSegment = [data[i]];
    } else {
      currentSegment.push(data[i]);
    }
  }

  // Add the final segment if it exists
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return { segments };
};

interface DraggingAnnotation {
  index: number; // the day/data point
  eventId: number; // The actual event ID for parameter updates
  displayId: string; // Unique display ID for dragging
  offsetX: number;
  offsetY: number;
  isEndingEvent: boolean;
}

interface VisualizationProps {
  onAnnotationClick?: (eventId: number) => void;
  onAnnotationDelete?: (eventId: number) => void;
  onNegativeAccountWarning?: (warnings: Array<{ envelopeName: string; category: string; minValue: number; date: number; warningType: 'negative' | 'positive' }>) => void;
  onChartClick?: (dayOffset: number) => void;
  onEditEnvelope?: (envelopeName: string) => void;
}

// Custom tick renderer for AxisBottom to style age in light gray
const AxisBottomTick = ({
  x,
  y,
  formattedValue
}: {
  x: number;
  y: number;
  formattedValue: string;
}) => {
  // Split date and age
  const match = formattedValue.match(/^(.*) \((\d+)\)$/);
  let datePart = formattedValue;
  let agePart = '';
  if (match) {
    datePart = match[1];
    agePart = match[2];
  }
  return (
    <text
      x={x}
      y={y}
      fill="#335966"
      fontSize={12}
      textAnchor="middle"
      dy="0.33em"
    >
      {datePart}
      {agePart && (
        <tspan fill="#b0b0b0"> ({agePart})</tspan>
      )}
    </text>
  );
};

// --- Helper: Group envelopes by category and sum values ---
function groupEnvelopesByCategory(plan: Plan | null, envelopeKeys: string[]): Record<string, string[]> {
  const categoryMap: Record<string, string[]> = {};
  envelopeKeys.forEach((env: string) => {
    const cat = getEnvelopeCategory(plan, env) || 'Uncategorized';
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(env);
  });
  return categoryMap;
}

// Helper function to detect account warnings (negative non-debt accounts and positive debt accounts)
const detectAccountWarnings = (netWorthData: Datum[], plan: Plan | null): Array<{ envelopeName: string; category: string; minValue: number; date: number; warningType: 'negative' | 'positive' }> => {
  if (!plan || !netWorthData.length) return [];

  const warnings: Array<{ envelopeName: string; category: string; minValue: number; date: number; warningType: 'negative' | 'positive' }> = [];

  // Get all envelope names from the data
  const envelopeNames = Object.keys(netWorthData[0]?.parts || {});

  // For each envelope, check if it goes negative or positive (for debt)
  envelopeNames.forEach(envelopeName => {
    // Find the envelope in the plan to get its category and account_type
    const envelope = plan.envelopes.find(e => e.name === envelopeName);
    if (!envelope) return;

    // Check each data point for this envelope
    let minValue = Infinity;
    let maxValue = -Infinity;
    let minDate = 0;
    let maxDate = 0;

    netWorthData.forEach(datum => {
      const value = datum.parts[envelopeName] || 0;
      if (value < minValue) {
        minValue = value;
        minDate = datum.date;
      }
      if (value > maxValue) {
        maxValue = value;
        maxDate = datum.date;
      }
    });
    //console.log("minValue: ", minValue);
    //console.log("maxValue: ", maxValue);

    // For non-debt accounts: check if they go negative
    if (envelope.category !== 'Debt' && minValue < 0) {
      warnings.push({
        envelopeName,
        category: envelope.category,
        minValue,
        date: minDate,
        warningType: 'negative'
      });
    }

    // For debt accounts: check if they go positive
    if (envelope.category === 'Debt' && maxValue > 1) {
      warnings.push({
        envelopeName,
        category: envelope.category,
        minValue: maxValue, // Use maxValue for debt warnings
        date: maxDate,
        warningType: 'positive'
      });
    }
  });

  return warnings;
};


export function Visualization({ onAnnotationClick, onAnnotationDelete, onNegativeAccountWarning, onChartClick, onEditEnvelope }: VisualizationProps) {
  // Ref to store the setZoomToDateRange function for context access
  const setZoomToDateRangeRef = useRef<((startDay: number, endDay: number) => void) | null>(null);

  // Ref to store the handleZoomToWindow function for context access
  const handleZoomToWindowRef = useRef<((options: { years?: number; months?: number; days?: number }) => void) | null>(null);

  // Get the registerCurrentVisualizationRange function from context
  const { registerCurrentVisualizationRange } = usePlan();
  const { isOnboardingAtOrAbove } = useAuth();
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [closestPoint, setClosestPoint] = useState<Datum | null>(null);
  const [draggingAnnotation, setDraggingAnnotation] = useState<DraggingAnnotation | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [tooltipData, setTooltipData] = useState<Datum | null>(null);
  const [tooltipLeft, setTooltipLeft] = useState<number>(0);
  const [tooltipTop, setTooltipTop] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [netWorthData, setNetWorthData] = useState<Datum[]>([]);
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('year');
  const [birthDate, setBirthDate] = useState<Date>(new Date(2000, 0, 1)); // Default to Jan 1, 2000
  const [hoveredEventId, setHoveredEventId] = useState<number | null>(null);
  const [hoveredArea, setHoveredArea] = useState<{ envelope: string; category: string } | null>(null);
  const [lastMouse, setLastMouse] = useState<{ x: number, y: number } | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  // Track if the last simulation was triggered by an interval change
  const [isIntervalChange, setIsIntervalChange] = useState(false);
  const [currentVisibleRange, setCurrentVisibleRange] = useState<{
    startDate: number;
    endDate: number;
    startDateFormatted: string;
    endDateFormatted: string;
    totalDays: number;
  } | null>(null);

  // Track the last simulation window to detect significant changes
  const [lastSimulationWindow, setLastSimulationWindow] = useState<{
    startDate: number;
    endDate: number;
    totalDays: number;
  } | null>(null);
  const [eventDescriptionTooltip, setEventDescriptionTooltip] = useState<{
    left: number;
    top: number;
    displayType: string;
    description: string;
  } | null>(null);

  // Animation states
  const [animationProgress, setAnimationProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [pathLength, setPathLength] = useState(0);
  // Animation function
  const animateData = useCallback(() => {
    setIsAnimating(true);
    const startTime = Date.now();
    const duration = SIMULATION_ANIMATION_DURATION; // 2 seconds animation

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      // Use easeInOutQuad for smoother animation
      const rawProgress = Math.min(elapsed / duration, 1);
      const progress = rawProgress < 0.5
        ? 2 * rawProgress * rawProgress
        : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;

      setAnimationProgress(progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  // Trigger animation when data changes
  useEffect(() => {
    if (netWorthData.length > 0) {
      // Only animate if animation is enabled AND this wasn't triggered by an interval change
      if (IS_ANIMATION_ENABLED && !isIntervalChange) {
        setAnimationProgress(0); // Reset animation
        animateData();
      } else {
        setAnimationProgress(1); // Show full data immediately
      }
      // Reset the interval change flag after handling
      setIsIntervalChange(false);
    }
  }, [netWorthData, animateData]);

  // State for locked plan simulation results
  const [lockedNetWorthData, setLockedNetWorthData] = useState<{ date: number, value: number }[]>([]);

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Add wheel event handler ref
  const wheelHandler = useCallback((e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, []);

  // Add wheel event listener with passive: false
  useEffect(() => {
    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('wheel', wheelHandler, { passive: false });
      return () => svg.removeEventListener('wheel', wheelHandler);
    }
  }, [wheelHandler]);

  const { plan, plan_locked, getEventIcon, updateParameter, schema, deleteEvent, getEventDisplayType, currentDay, registerSetZoomToDateRange, setVisualizationReady, convertDateParametersToDays, registerTriggerSimulation, registerHandleZoomToWindow, updatePlanDirectly, updateLockedPlanDirectly, isCompareMode } = usePlan();

  // Register the setZoomToDateRange function with the context when it's available
  useEffect(() => {
    if (setZoomToDateRangeRef.current) {
      registerSetZoomToDateRange(setZoomToDateRangeRef.current);
    }
  }, [registerSetZoomToDateRange]);

  // Register the handleZoomToWindow function with the context when it's available
  useEffect(() => {
    if (handleZoomToWindowRef.current) {
      registerHandleZoomToWindow(handleZoomToWindowRef.current);
    }
  }, [registerHandleZoomToWindow]);

  // The actual handleZoomToWindow function will be assigned inside the Zoom component
  // where it has access to the zoom state and xScale



  // Base sizes that will be adjusted by zoom
  const baseLineWidth = 2;
  const baseTextSize = 10;
  const basePointRadius = 4;

  // Get the current visible date range with padding for simulator
  const getVisibleDateRange = (zoom: any, xScale: any, width: number) => {
    const viewportPadding = width * 0.2; // 20% padding on each side

    // Calculate the visible domain in data coordinates
    const visibleXDomain = [
      xScale.invert((-zoom.transformMatrix.translateX - viewportPadding) / zoom.transformMatrix.scaleX),
      xScale.invert((width - zoom.transformMatrix.translateX + viewportPadding) / zoom.transformMatrix.scaleX)
    ];

    // Clamp to valid date range (0 to 80 years)
    let startDate = Math.max(0, Math.floor(visibleXDomain[0]));
    let endDate = Math.min(80 * 365, Math.ceil(visibleXDomain[1]));

    // Only enforce minimum range if no specific range is set in the plan
    if (!plan?.view_start_date || !plan?.view_end_date) {
      // Ensure minimum range of 1 year
      const minRange = 365;
      if (endDate - startDate < minRange) {
        const center = (startDate + endDate) / 2;
        startDate = Math.max(0, Math.floor(center - minRange / 2));
        endDate = Math.min(80 * 365, Math.ceil(center + minRange / 2));
      }
    }

    const startDateFormatted = formatDate(startDate, birthDate, 'full', true, false);
    const endDateFormatted = formatDate(endDate, birthDate, 'full', true, false);

    return {
      startDate,
      endDate,
      startDateFormatted: typeof startDateFormatted === 'string' ? startDateFormatted : startDateFormatted.toString(),
      endDateFormatted: typeof endDateFormatted === 'string' ? endDateFormatted : endDateFormatted.toString(),
      totalDays: endDate - startDate
    };
  };

  // Get the actual visible date range without padding for context registration
  const getActualVisibleDateRange = (zoom: any, xScale: any, width: number) => {
    // Calculate the visible domain in data coordinates without padding
    const visibleXDomain = [
      xScale.invert((-zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX),
      xScale.invert((width - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX)
    ];

    // Clamp to valid date range (0 to 80 years)
    let startDate = Math.max(0, Math.floor(visibleXDomain[0]));
    let endDate = Math.min(80 * 365, Math.ceil(visibleXDomain[1]));

    const startDateFormatted = formatDate(startDate, birthDate, 'full', true, false);
    const endDateFormatted = formatDate(endDate, birthDate, 'full', true, false);

    return {
      startDate,
      endDate,
      startDateFormatted: typeof startDateFormatted === 'string' ? startDateFormatted : startDateFormatted.toString(),
      endDateFormatted: typeof endDateFormatted === 'string' ? endDateFormatted : endDateFormatted.toString(),
      totalDays: endDate - startDate
    };
  };

  // Default full range (fallback)
  const startDate: number = 0
  const endDate: number = 80 * 365

  // Function to determine time interval based on zoom level
  const getTimeIntervalFromZoom = (zoom: number): TimeInterval => {
    if (zoom >= 500) return 'day';
    if (zoom >= 250) return 'half_week';
    if (zoom >= 60) return 'week';
    if (zoom >= 10) return 'month';
    if (zoom >= 5) return 'quarter';
    if (zoom >= 3) return 'half_year';
    return 'year';
  };

  // Manual simulation control
  const runSimulationManually = useCallback(async (
    intervalOverride?: TimeInterval,
    visibleRangeOverride?: { startDate: number, endDate: number }
  ) => {
    const intervalToUse = intervalOverride || timeInterval;

    // Get base range from override or current visible range
    const baseRange = visibleRangeOverride || (currentVisibleRange ? {
      startDate: currentVisibleRange.startDate,
      endDate: currentVisibleRange.endDate
    } : undefined);

    // Apply padding to the range if we have one
    const rangeToUse = baseRange ? (() => {
      const visibleRangeWidth = baseRange.endDate - baseRange.startDate;
      const padding = visibleRangeWidth * 5; // 5x padding

      //console.log('🔍 Padding:', padding);
      const paddedRange = {
        startDate: Math.max(0, baseRange.startDate - padding),
        endDate: Math.min(80 * 365, baseRange.endDate + padding)
      };

      // console.log('🔍 Simulation Input Parameters:', {
      //   baseRange,
      //   visibleRangeWidth,
      //   padding,
      //   paddedRange,
      //   intervalToUse,
      //   getIntervalInDays: getIntervalInDays(intervalToUse)
      // });

      return paddedRange;
    })() : undefined;

    if (!plan || !schema) return;

    try {
      setIsLoading(true);

      // Set birth date from plan
      if (plan.birth_date) {
        const birthDateObj = new Date(plan.birth_date + 'T00:00:00');
        setBirthDate(birthDateObj);
      }

      // Convert date parameters to days for simulation
      const convertedPlan = {
        ...plan,
        events: convertDateParametersToDays(plan.events)
      };

      // Run simulation with visible range for two-stage evaluation
      const simulationResult = await runSimulation(
        convertedPlan,
        schema,
        startDate,
        endDate,
        getIntervalInDays(intervalToUse),
        currentDay,
        birthDate,
        (updates) => {
          if (updates.length > 0) {
            const updatedPlan = { ...plan };
            updates.forEach(update => {
              const event = updatedPlan.events.find(e => e.id === update.eventId);
              if (event) {
                const param = event.parameters.find(p => p.type === update.paramType);
                if (param) {
                  // Look up parameter units from schema to determine if conversion is needed
                  const eventSchema = schema.events.find(e => e.type === event.type);
                  let paramSchema;
                  if (eventSchema) {
                    paramSchema = eventSchema.parameters.find(p => p.type === param.type);
                  }
                  if (paramSchema && paramSchema.parameter_units === 'date') {
                    param.value = daysSinceBirthToDateString(update.value, plan.birth_date);
                  } else {
                    param.value = update.value;
                  }
                }
              }
            });
            updatePlanDirectly(updatedPlan);
          }
        },
        rangeToUse
      );

      // console.log('🔍 Simulation Results:', {
      //   resultLength: simulationResult.length,
      //   firstPoint: simulationResult[0],
      //   lastPoint: simulationResult[simulationResult.length - 1],
      //   rangeInDays: simulationResult[simulationResult.length - 1].date - simulationResult[0].date
      // });

      // Store the simulation data
      setNetWorthData(simulationResult);
      //console.log('📊 Simulation results length:', simulationResult.length);

      // Run simulation for locked plan if it exists and compare mode is on
      if (plan_locked && isCompareMode) {
        try {
          // Convert date parameters to days for locked plan simulation
          const convertedPlanLocked = {
            ...plan_locked,
            events: convertDateParametersToDays(plan_locked.events)
          };

          const lockedResult = await runSimulation(
            convertedPlanLocked,
            schema,
            startDate,
            endDate,
            getIntervalInDays(intervalToUse),
            currentDay,
            birthDate,
            (updates) => {
              // Handle updates for locked plan if needed
              if (updates.length > 0) {
                // Deep clone locked plan before applying updates to avoid mutating shared references
                const updatedPlan = JSON.parse(JSON.stringify(plan_locked));
                updates.forEach(update => {
                  const event = updatedPlan.events.find(e => e.id === update.eventId);
                  if (event) {
                    const param = event.parameters.find(p => p.type === update.paramType);
                    if (param) {
                      const eventSchema = schema.events.find(e => e.type === event.type);
                      let paramSchema;
                      if (eventSchema) {
                        paramSchema = eventSchema.parameters.find(p => p.type === param.type);
                      }
                      if (paramSchema && paramSchema.parameter_units === 'date') {
                        param.value = daysSinceBirthToDateString(update.value, plan_locked.birth_date);
                      } else {
                        param.value = update.value;
                      }
                    }
                  }
                });
                updateLockedPlanDirectly(updatedPlan);
              }
            },
            rangeToUse
          );

          setLockedNetWorthData(lockedResult);
          //console.log('📊 Locked simulation results length:', lockedResult.length);
        } catch (err) {
          console.error('Locked plan simulation failed:', err);
          setLockedNetWorthData([]);
        }
      } else {
        setLockedNetWorthData([]);
      }

      // Check for negative accounts and trigger warning
      const negativeWarnings = detectAccountWarnings(simulationResult, plan);
      if (negativeWarnings.length > 0 && onNegativeAccountWarning) {
        onNegativeAccountWarning(negativeWarnings);
      }

      // Track the simulation window that was used
      if (rangeToUse) {
        setLastSimulationWindow({
          startDate: rangeToUse.startDate,
          endDate: rangeToUse.endDate,
          totalDays: rangeToUse.endDate - rangeToUse.startDate
        });
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [plan, plan_locked, schema, timeInterval, currentDay, onNegativeAccountWarning, convertDateParametersToDays, currentVisibleRange]);

  // Run simulation on initial load
  useEffect(() => {
    // Only run simulation on initial load
    if (plan && schema) {
      // console.log('🚀 Running initial simulation');
      runSimulationManually();
    }
  }, []); // do not depend on plan and schema, only run on initial load

  // Expose manual simulation trigger for external use
  const triggerSimulation = useCallback(() => {
    //console.log('🎯 Manual simulation triggered with current interval and visible range:', timeInterval, currentVisibleRange);
    runSimulationManually(timeInterval, currentVisibleRange ? {
      startDate: currentVisibleRange.startDate,
      endDate: currentVisibleRange.endDate
    } : undefined);
  }, [runSimulationManually, timeInterval, currentVisibleRange]);

  // Register the triggerSimulation function with the context when it's available so it can be used in other components
  useEffect(() => {
    registerTriggerSimulation(triggerSimulation);
  }, [registerTriggerSimulation, triggerSimulation]);

  // Calculate stacked data from simulation results
  const stackedData = useMemo(() => {
    if (!netWorthData.length) return [];

    // Get all unique part keys from the data
    const partKeys = Array.from(
      new Set(netWorthData.flatMap(d => Object.keys(d.parts)))
    );

    // Separate debt and non-debt envelopes
    const { debtEnvelopes, assetEnvelopes } = partKeys.reduce((acc, key) => {
      const category = getEnvelopeCategory(plan, key);
      if (category === 'Debt') {
        acc.debtEnvelopes.push(key);
      } else {
        acc.assetEnvelopes.push(key);
      }
      return acc;
    }, { debtEnvelopes: [] as string[], assetEnvelopes: [] as string[] });

    return netWorthData.map(d => {
      let posSum = 0;
      let negSum = 0;
      const stackedParts: { [key: string]: { y0: number, y1: number } } = {};

      // First handle debt envelopes (always negative or zero)
      debtEnvelopes.forEach(key => {
        const value = normalizeZero(d.parts[key] || 0);
        // Debt values should always be negative or zero
        const adjustedValue = Math.min(value, 0);
        stackedParts[key] = { y0: negSum, y1: negSum + adjustedValue };
        negSum += adjustedValue;
      });

      // Then handle asset envelopes
      assetEnvelopes.forEach(key => {
        const value = normalizeZero(d.parts[key] || 0);
        if (value >= 0) {
          stackedParts[key] = { y0: posSum, y1: posSum + value };
          posSum += value;
        } else {
          // For non-debt categories that temporarily go negative
          stackedParts[key] = { y0: negSum, y1: negSum + value };
          negSum += value;
        }
      });

      return {
        ...d,
        value: normalizeZero(d.value),
        parts: Object.fromEntries(
          Object.entries(d.parts).map(([key, val]) => [key, normalizeZero(val)])
        ),
        stackedParts
      };
    });
  }, [netWorthData, plan]);

  const screenToData = (screenX: number, screenY: number, zoom: any, yScale: any) => {
    const x = (screenX - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX;
    const y = (screenY - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY;
    return {
      x: xScale.invert(x),
      y: yScale.invert(y)
    };
  };

  // Calculate scales based on simulation data
  const xScale = useMemo(() => {
    if (!netWorthData.length) return scaleLinear({ domain: [0, 1], range: [0, width] });

    const maxDate = Math.max(...netWorthData.map(d => d.date));
    return scaleLinear({
      domain: [0, endDate],
      range: [0, width],
    });
  }, [netWorthData, width]);

  // Make sure categoryColors is defined before render logic
  const envelopeKeys = useMemo(() => Object.keys(netWorthData[0]?.parts || {}), [netWorthData]);
  const nonNetworthEnvelopeKeys = useMemo(() => Object.keys(netWorthData[0]?.nonNetworthParts || {}), [netWorthData]);
  const allEnvelopeKeys = useMemo(() => [...envelopeKeys, ...nonNetworthEnvelopeKeys], [envelopeKeys, nonNetworthEnvelopeKeys]);
  const categoryMap = useMemo(() => groupEnvelopesByCategory(plan, allEnvelopeKeys), [plan, allEnvelopeKeys]);
  // Use new color generator
  const { envelopeColors, categoryColors } = useMemo(() => {
    if (!plan || !schema) return { envelopeColors: {}, categoryColors: {} };
    return getEnvelopeAndCategoryColors(
      allEnvelopeKeys.map(name => ({ name, category: getEnvelopeCategory(plan, name) || 'Uncategorized' })),
      Object.keys(categoryMap)
    );
  }, [plan, schema, allEnvelopeKeys, categoryMap]);

  // Canvas context menu state
  // const [canvasContextMenu, setCanvasContextMenu] = useState<{
  //   visible: boolean;
  //   x: number;
  //   y: number;
  // } | null>(null);

  // Track if mouse was dragged during left click
  const [leftClickStartPos, setLeftClickStartPos] = useState<{ x: number; y: number } | null>(null);
  const [hasDraggedFromLeftClick, setHasDraggedFromLeftClick] = useState(false);
  const [isClickingAnnotation, setIsClickingAnnotation] = useState(false);

  // Auto-close context menu after 3 seconds
  // useEffect(() => {
  //   if (canvasContextMenu) {
  //     const timer = setTimeout(() => {
  //       setCanvasContextMenu(null);
  //     }, 3000);

  //     return () => clearTimeout(timer);
  //   }
  // }, [canvasContextMenu]);

  return (
    <div className="relative w-full h-full visualization-container">
      <Zoom
        width={width}
        height={height}
        scaleXMin={1.0}
        scaleXMax={1000}
        scaleYMin={1.0}
        scaleYMax={1000}
        initialTransformMatrix={{
          scaleX: 1.0,
          scaleY: 1.0,
          translateX: 80,
          translateY: 0,
          skewX: 0,
          skewY: 0,
        }}
      >
        {(zoom) => {
          const getSVGPoint = (e: React.MouseEvent) => {
            const svgPoint = svgRef.current!.createSVGPoint();
            svgPoint.x = e.clientX;
            svgPoint.y = e.clientY;
            return svgPoint.matrixTransform(svgRef.current!.getScreenCTM()!.inverse());
          };

          // Calculate global zoom level (now only depends on scaleX)
          const globalZoom = zoom.transformMatrix.scaleX;

          //console.log('🔍 globalZoom:', globalZoom, 'timeInterval:', timeInterval);
          // Calculate visible date range based on current viewport with padding
          const viewportPadding = width * 0.2; // 20% padding on each side
          const visibleXDomain = [
            xScale.invert((-zoom.transformMatrix.translateX - viewportPadding) / zoom.transformMatrix.scaleX),
            xScale.invert((width - zoom.transformMatrix.translateX + viewportPadding) / zoom.transformMatrix.scaleX)
          ];

          // Get actual visible range for simulator (this is where we have access to real zoom state)
          const actualVisibleRange = getVisibleDateRange(zoom, xScale, width);
          // Get actual visible range without padding for context registration
          const actualVisibleRangeNoPadding = getActualVisibleDateRange(zoom, xScale, width);
          // console.log('🔍 ACTUAL Visible Date Range (from zoom state):', {
          //   start: actualVisibleRange.startDateFormatted,
          //   end: actualVisibleRange.endDateFormatted,
          //   days: actualVisibleRange.totalDays,
          //   startDate: actualVisibleRange.startDate,
          //   endDate: actualVisibleRange.endDate,
          //   zoomLevel: globalZoom,
          //   translateX: zoom.transformMatrix.translateX
          // });

          // Update current visible range for logging and register with context
          useEffect(() => {
            setCurrentVisibleRange({
              startDate: actualVisibleRange.startDate,
              endDate: actualVisibleRange.endDate,
              startDateFormatted: actualVisibleRange.startDateFormatted,
              endDateFormatted: actualVisibleRange.endDateFormatted,
              totalDays: actualVisibleRange.totalDays
            });
            // console.log('🔍 Registering current range with context (no padding):', {
            //   startDay: actualVisibleRangeNoPadding.startDate,
            //   endDay: actualVisibleRangeNoPadding.endDate,
            //   zoom: {
            //     scaleX: zoom.transformMatrix.scaleX,
            //     translateX: zoom.transformMatrix.translateX
            //   }
            // });
            // Register current range with context for DateRangePicker to access (without padding)
            registerCurrentVisualizationRange({
              startDay: actualVisibleRangeNoPadding.startDate,
              endDay: actualVisibleRangeNoPadding.endDate
            });

            // Mark visualization as ready for auto-save
            setVisualizationReady(true);
          }, [actualVisibleRange.startDate, actualVisibleRange.endDate, actualVisibleRange.startDateFormatted, actualVisibleRange.endDateFormatted, actualVisibleRange.totalDays, actualVisibleRangeNoPadding.startDate, actualVisibleRangeNoPadding.endDate, registerCurrentVisualizationRange, setVisualizationReady]);

          // Filter data points to only those in viewport
          const visibleData = netWorthData.filter(d =>
            d.date >= visibleXDomain[0] && d.date <= visibleXDomain[1]
          );
          // Filter locked plan net worth data to visible x-range
          const visibleLockedNetWorthData = lockedNetWorthData.filter(d =>
            d.date >= visibleXDomain[0] && d.date <= visibleXDomain[1]
          );

          // Also compute actual visible data without padding for Y scale calculations
          const actualVisibleData = netWorthData.filter(d =>
            d.date >= actualVisibleRangeNoPadding.startDate && d.date <= actualVisibleRangeNoPadding.endDate
          );
          const actualVisibleLockedNetWorthData = lockedNetWorthData.filter(d =>
            d.date >= actualVisibleRangeNoPadding.startDate && d.date <= actualVisibleRangeNoPadding.endDate
          );

          // Update time interval based on zoom level
          useEffect(() => {
            const newInterval = getTimeIntervalFromZoom(globalZoom);
            if (newInterval !== timeInterval) {
              //console.log('🎯 Time interval changed from', timeInterval, 'to', newInterval);

              // Get the actual visible range without padding
              const actualRange = getActualVisibleDateRange(zoom, xScale, width);

              // Calculate the visible range with some padding to prevent edge effects
              const paddedRange = {
                startDate: Math.max(0, actualRange.startDate), // Add 1 year padding
                endDate: Math.min(80 * 365, actualRange.endDate) // Add 1 year padding
              };

              // console.log('🎯 Running simulation with range:', {
              //   interval: newInterval,
              //   visibleRange: {
              //     startDate: paddedRange.startDate,
              //     endDate: paddedRange.endDate,
              //     startFormatted: formatDate(paddedRange.startDate, birthDate, 'full', true, false),
              //     endFormatted: formatDate(paddedRange.endDate, birthDate, 'full', true, false)
              //   }
              // });

              // Run simulation with new interval and padded range
              setIsIntervalChange(true);
              runSimulationManually(newInterval, paddedRange);

              // Update state after simulation is triggered
              setTimeInterval(newInterval);
            }
          }, [globalZoom]);



          // Get envelope colors from schema
          const envelopeColors = useMemo(() => {
            if (!schema?.categories) return {};
            //console.log('schema.categories: ', schema.categories);
            return generateEnvelopeColors(schema.categories);
          }, [schema]);

          const allEventsByDate = getAllEventsByDateWithLocked(plan!, plan_locked, schema || undefined, globalZoom);
          // console.log('📅 Events by Date in Visualization:', {
          //   totalDates: Object.keys(allEventsByDate).length,
          //   allDates: Object.keys(allEventsByDate).map(date => ({
          //     date: Number(date),
          //     formattedDate: formatDate(Number(date), birthDate, 'full', true, false),
          //     events: allEventsByDate[Number(date)].map(e => ({
          //       eventId: e.event.id,
          //       displayId: e.displayId,
          //       isEndingEvent: e.isEndingEvent
          //     }))
          //   }))
          // });

          // Utility to apply a transform matrix to a point
          function applyMatrixToPoint(matrix: any, point: { x: number; y: number }) {
            return {
              x: point.x * matrix.scaleX + matrix.translateX,
              y: point.y * matrix.scaleY + matrix.translateY,
            };
          }

          // Constrain transform to keep content within [0,0,width,height]
          function constrainTransform(transformMatrix: any, prevTransformMatrix: any, width: number, height: number, isZooming?: boolean) {
            const xPad = 80;
            const min = applyMatrixToPoint(transformMatrix, { x: 0, y: 0 });
            const max = applyMatrixToPoint(transformMatrix, { x: width, y: height });

            // Allow zooming out even if temporarily out of bounds
            if (isZooming && transformMatrix.scaleX < prevTransformMatrix.scaleX) {
              // After zoom out, adjust position to be within bounds if needed
              let adjustedTransform = { ...transformMatrix };
              if (max.x < width - xPad) {
                adjustedTransform.translateX = width - xPad - (width * transformMatrix.scaleX);
              }
              if (min.x > xPad) {
                adjustedTransform.translateX = xPad;
              }
              return adjustedTransform;
            }

            if (max.x < width - xPad || min.x > 0 + xPad) {
              return prevTransformMatrix;
            }
            return transformMatrix;
          }

          const handleAnnotationDragStart = (e: React.MouseEvent, eventId: number, displayId: string, date: number, annotationYOffset: number, DRAG_Y_OFFSET: number, isEndingEvent: boolean) => {
            e.stopPropagation();
            const point = getSVGPoint(e);
            setHasDragged(false);
            setDragStartPos({ x: point.x, y: point.y });

            const dataPoint = netWorthData.find(p => p.date === date);
            if (!dataPoint) return;
            // Use the same transform as annotation rendering
            const canvasX = xScale(dataPoint.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX;
            const canvasY = visibleYScale(dataPoint.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY;
            // DRAG_Y_OFFSET and annotationYOffset must match rendering
            const annotationY = canvasY - annotationYOffset;
            const annotationX = canvasX;

            // Log event info at drag start
            let event = plan?.events.find(e => e.id === eventId);
            if (!event) {
              for (const parentEvent of plan?.events || []) {
                event = parentEvent.updating_events?.find(ue => ue.id === eventId);
                if (event) break;
              }
            }

            setDraggingAnnotation({
              index: date,
              eventId: eventId,
              displayId: displayId,
              offsetX: point.x - annotationX,
              offsetY: point.y - annotationY,
              isEndingEvent: isEndingEvent
            });
          };

          const handleAnnotationDragMove = (e: React.MouseEvent) => {
            if (!draggingAnnotation) return;
            const point = getSVGPoint(e);
            if (dragStartPos) {
              const dx = point.x - dragStartPos.x;
              const dy = point.y - dragStartPos.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance > 10) {
                setHasDragged(true);
              }
            }

            const dataPoint = screenToData(point.x, point.y, zoom, visibleYScale);
            const closestPoint = findClosestPoint(netWorthData, dataPoint.x);
            if (!closestPoint) return;

            // Convert data points to screen coordinates
            const screenX = xScale(closestPoint.date);
            const screenY = visibleYScale(closestPoint.value);
            const transformedX = (screenX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
            const transformedY = (screenY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

            // Calculate distance in screen coordinates
            const distance = Math.sqrt(
              Math.pow(point.x - transformedX, 2) +
              Math.pow(point.y - transformedY, 2)
            );

            // Only update visual position if within threshold
            if (distance < 150) {
              setClosestPoint(closestPoint);
            }
          };

          const handleAnnotationDragEnd = (e: React.MouseEvent) => {
            if (!draggingAnnotation || !closestPoint) {
              setDraggingAnnotation(null);
              setClosestPoint(null);
              return;
            }

            const point = getSVGPoint(e);
            const dataPoint = screenToData(point.x, point.y, zoom, visibleYScale);

            // Calculate final position and distance
            const screenX = xScale(closestPoint.date);
            const screenY = visibleYScale(closestPoint.value);
            const transformedX = (screenX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
            const transformedY = (screenY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

            const distance = Math.sqrt(
              Math.pow(point.x - transformedX, 2) +
              Math.pow(point.y - transformedY, 2)
            );

            // Only update parameter if within threshold AND there was actual dragging
            if (distance < 150 && plan && hasDragged) {
              console.log('🎯 Drag End Position:', {
                mousePoint: point,
                dataPoint,
                closestPoint: {
                  date: closestPoint.date,
                  formattedDate: formatDate(closestPoint.date, birthDate, 'full', true, false)
                },
                screenCoords: { x: screenX, y: screenY },
                transformedCoords: { x: transformedX, y: transformedY },
                distance
              });

              // Find the event in the plan
              let event = plan.events.find(e => e.id === draggingAnnotation.eventId);
              console.log("🎯 Found Event:", {
                event,
                eventId: draggingAnnotation.eventId,
                isEndingEvent: draggingAnnotation.isEndingEvent
              });
              if (event) {
                if (draggingAnnotation.isEndingEvent) {
                  const endTimeParam = event.parameters.find(p => p.type === 'end_time');
                  if (endTimeParam) {
                    const dateString = daysSinceBirthToDateString(closestPoint.date, plan.birth_date);
                    console.log('🎯 Updating End Time:', {
                      eventId: event.id,
                      originalDays: closestPoint.date,
                      convertedDateString: dateString,
                      birthDate: plan.birth_date
                    });
                    updateParameter(event.id, endTimeParam.type, dateString);
                  }
                } else {
                  const startTimeParam = event.parameters.find(p => p.type === 'start_time');
                  if (startTimeParam) {
                    const dateString = daysSinceBirthToDateString(closestPoint.date, plan.birth_date);
                    console.log('🎯 Updating Start Time:', {
                      eventId: event.id,
                      originalDays: closestPoint.date,
                      convertedDateString: dateString,
                      birthDate: plan.birth_date
                    });
                    updateParameter(event.id, startTimeParam.type, dateString);
                  }
                }
              } else {
                // Try updating event
                for (const parentEvent of plan.events) {
                  const updatingEvent = parentEvent.updating_events?.find(ue => ue.id === draggingAnnotation.eventId);
                  if (updatingEvent) {
                    if (draggingAnnotation.isEndingEvent) {
                      const endTimeParam = updatingEvent.parameters.find(p => p.type === 'end_time');
                      if (endTimeParam) {
                        const dateString = daysSinceBirthToDateString(closestPoint.date, plan.birth_date);
                        updateParameter(updatingEvent.id, endTimeParam.type, dateString);
                      }
                    } else {
                      const startTimeParam = updatingEvent.parameters.find(p => p.type === 'start_time');
                      if (startTimeParam) {
                        const dateString = daysSinceBirthToDateString(closestPoint.date, plan.birth_date);
                        updateParameter(updatingEvent.id, startTimeParam.type, dateString);
                      }
                    }
                    break;
                  }
                }
              }
            }

            setDraggingAnnotation(null);
            setClosestPoint(null);
          };

          // Calculate visibleYScale based on actual visible data (no padding)
          const visibleYScale = useMemo(() => {
            if (!actualVisibleData.length && !actualVisibleLockedNetWorthData.length) return scaleLinear({ domain: [0, 1], range: [height, 0] });
            // Compute stacked sums for each data point
            const stackedSums = actualVisibleData.map((d: any) => {
              const values = [normalizeZero(d.value), ...Object.values(d.parts).map((v: any) => normalizeZero(v))];
              const positiveSum = values.filter(v => v > 0).reduce((a, b) => a + b, 0);
              const negativeSum = values.filter(v => v < 0).reduce((a, b) => a + b, 0);
              return { positiveSum, negativeSum };
            });
            const lockedValues = actualVisibleLockedNetWorthData.map(d => normalizeZero(d.value));
            const maxY = Math.max(0, ...stackedSums.map(s => s.positiveSum), ...lockedValues);
            const minY = Math.min(0, ...stackedSums.map(s => s.negativeSum), ...lockedValues);
            const adjustedMinY = minY > 0 ? 0 : minY;
            // Add 10% padding to top and bottom
            const yRange = maxY - adjustedMinY || 1;
            const pad = yRange * 0.2;
            const domainMin = adjustedMinY - pad;
            const domainMax = maxY + pad;
            return scaleLinear({
              domain: [domainMin, domainMax],
              range: [height, 0],
            });
          }, [actualVisibleData, actualVisibleLockedNetWorthData, height]);

          // Find first day when net worth exceeds retirement goal
          const firstDayAboveGoal = useMemo(() => {
            if (!plan?.retirement_goal || plan.retirement_goal <= 0) return null;
            return findFirstDayAboveGoal(netWorthData, plan.retirement_goal);
          }, [netWorthData, plan?.retirement_goal]);

          // Get the net worth and locked net worth values at the intersection day
          const netWorthValues = useMemo(() => {
            if (!firstDayAboveGoal) return null;
            return getNetWorthAndLockedOnDay(netWorthData, lockedNetWorthData, firstDayAboveGoal);
          }, [netWorthData, lockedNetWorthData, firstDayAboveGoal]);
          const handleZoomToWindow = ({
            years = 0,
            months = 0,
            days = 0,
          }: { years?: number; months?: number; days?: number }) => {
            const daysPerYear = 365;
            const daysPerMonth = 30; // Approximate
            const windowStart = currentDay;
            const windowEnd =
              currentDay +
              (years * daysPerYear) +
              (months * daysPerMonth) +
              days;
            const maxDate = Math.max(...netWorthData.map(d => d.date));
            const clampedEnd = Math.min(windowEnd, maxDate);

            const windowWidth = clampedEnd - windowStart;
            if (windowWidth <= 0) return;

            const targetScaleX = width / (xScale(clampedEnd) - xScale(windowStart));
            const targetTranslateX = -xScale(windowStart) * targetScaleX + 80;

            // Animate or immediately update based on IS_ANIMATION_ENABLED
            animateZoom(
              {
                scaleX: zoom.transformMatrix.scaleX,
                translateX: zoom.transformMatrix.translateX
              },
              {
                scaleX: targetScaleX,
                translateX: targetTranslateX
              },
              (state) => {
                zoom.setTransformMatrix({
                  ...zoom.transformMatrix,
                  ...state
                });
              }
            );
          };

          // Assign the function to the ref for external access
          handleZoomToWindowRef.current = handleZoomToWindow;

          // Method to set zoom to show a specific date range
          const setZoomToDateRange = (startDay: number, endDay: number) => {
            console.log('🎯 Setting zoom to date range:', {
              startDay,
              endDay,
              startDateFormatted: formatDate(startDay, birthDate, 'full', true, false),
              endDateFormatted: formatDate(endDay, birthDate, 'full', true, false),
              totalDays: endDay - startDay
            });

            // Calculate the scale and translation to show this range
            const rangeWidth = endDay - startDay;
            if (rangeWidth <= 0) return;

            const targetScaleX = width / (xScale(endDay) - xScale(startDay));
            const targetTranslateX = -xScale(startDay) * targetScaleX;

            console.log('🎯 Calculated zoom parameters:', {
              targetScaleX,
              targetTranslateX,
              xScaleStartDay: xScale(startDay),
              xScaleEndDay: xScale(endDay),
              xScaleRange: xScale(endDay) - xScale(startDay),
              width
            });

            // Animate or immediately update based on IS_ANIMATION_ENABLED
            animateZoom(
              {
                scaleX: zoom.transformMatrix.scaleX,
                translateX: zoom.transformMatrix.translateX
              },
              {
                scaleX: targetScaleX,
                translateX: targetTranslateX
              },
              (state) => {
                zoom.setTransformMatrix({
                  ...zoom.transformMatrix,
                  ...state
                });
              }
            );

            // Log what the zoom will show after setting
            setTimeout(() => {
              const actualRange = getActualVisibleDateRange(zoom, xScale, width);
              console.log('🎯 Actual range after zoom set:', {
                requested: { startDay, endDay },
                actual: actualRange,
                difference: {
                  start: actualRange.startDate - startDay,
                  end: actualRange.endDate - endDay
                }
              });
            }, 50);
          };

          // Store the function in the ref for context access
          setZoomToDateRangeRef.current = setZoomToDateRange;

          return (
            <>

              {/* Zoom Buttons - Top Center */}
              <div
                style={{
                  position: 'absolute',
                  top: 32,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 20,
                  display: 'flex',
                  gap: 8,
                }}
              >
                {isOnboardingAtOrAbove('user_info') && (
                  <button
                    style={{
                      background: 'rgba(51, 89, 102, 0.06)',
                      color: '#335966',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '4px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      opacity: 0.85,
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                    onClick={() => {
                      handleZoomToWindow({ months: 1 });
                    }}
                  >
                    1m
                  </button>
                )}
                {isOnboardingAtOrAbove('user_info') && (
                  <button
                    style={{
                      background: 'rgba(51, 89, 102, 0.06)',
                      color: '#335966',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '4px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      opacity: 0.85,
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                    onClick={() => {
                      handleZoomToWindow({ months: 3 });
                    }}
                  >
                    3m
                  </button>
                )}
                {isOnboardingAtOrAbove('updating_events') && (
                  <button
                    style={{
                      background: 'rgba(51, 89, 102, 0.06)',
                      color: '#335966',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '4px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      opacity: 0.85,
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                    onClick={() => {
                      handleZoomToWindow({ years: 1 });
                    }}
                  >
                    1yr
                  </button>
                )}
                {isOnboardingAtOrAbove('updating_events') && (
                  <button
                    style={{
                      background: 'rgba(51, 89, 102, 0.06)',
                      color: '#335966',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '4px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      opacity: 0.85,
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                    onClick={() => {
                      handleZoomToWindow({ years: 5 });
                    }}
                  >
                    5yr
                  </button>
                )}
                {isOnboardingAtOrAbove('declare_accounts') && (
                  <button
                    style={{
                      background: 'rgba(51, 89, 102, 0.06)',
                      color: '#335966',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '4px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      opacity: 0.85,
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                    onClick={() => {
                      handleZoomToWindow({ years: 10 });
                    }}
                  >
                    10yr
                  </button>
                )}
                {isOnboardingAtOrAbove('assets') && (
                  <button
                    style={{
                      background: 'rgba(51, 89, 102, 0.06)',
                      color: '#335966',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '4px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      opacity: 0.85,
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                    onClick={() => {
                      handleZoomToWindow({ years: 50 });
                    }}
                  >
                    50yr
                  </button>
                )}
              </div>

              <svg
                ref={svgRef}
                width={width}
                height={height}
                style={{
                  cursor: isDragging ? 'grabbing' : 'pointer',
                  touchAction: 'none'
                }}
                onMouseMove={(e) => {
                  const point = getSVGPoint(e);
                  setCursorPos(point);

                  // Check if we're dragging from a left click
                  if (leftClickStartPos && e.buttons === 1) {
                    const distance = Math.sqrt(
                      Math.pow(e.clientX - leftClickStartPos.x, 2) +
                      Math.pow(e.clientY - leftClickStartPos.y, 2)
                    );

                    // If moved more than 5px, consider it dragging
                    if (distance > 5) {
                      setHasDraggedFromLeftClick(true);
                    }
                  }

                  if (draggingAnnotation) {
                    handleAnnotationDragMove(e);
                  } else {
                    const dataPoint = screenToData(point.x, point.y, zoom, visibleYScale);
                    const closest = findClosestPoint(netWorthData, dataPoint.x);
                    setClosestPoint(closest);

                    // Update tooltip position and data
                    if (closest) {
                      const canvasX = xScale(closest.date);
                      const canvasY = visibleYScale(closest.value);
                      const transformedX = (canvasX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
                      const transformedY = (canvasY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

                      setTooltipData(closest);
                      setTooltipLeft(transformedX);
                      setTooltipTop(transformedY);
                    }
                  }

                  if (isDragging && lastMouse) {
                    const dx = e.clientX - lastMouse.x;
                    const dy = e.clientY - lastMouse.y;
                    // Calculate new transform
                    let newTransform = {
                      ...zoom.transformMatrix,
                      translateX: zoom.transformMatrix.translateX + dx,
                      translateY: zoom.transformMatrix.translateY + dy,
                    };
                    // Clamp
                    newTransform = constrainTransform(newTransform, zoom.transformMatrix, width, height, false);
                    zoom.setTransformMatrix(newTransform);
                    setLastMouse({ x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseLeave={() => {
                  setCursorPos({ x: 0, y: 0 });
                  setClosestPoint(null);
                  setTooltipData(null);
                  setHasDragged(false);
                }}
                onMouseDown={(e) => {
                  // Open context menu on right click (button 2)
                  // if (e.button === 2) {
                  //   e.preventDefault();
                  //   const rect = svgRef.current?.getBoundingClientRect();
                  //   if (rect) {
                  //     setCanvasContextMenu({
                  //       visible: true,
                  //       x: e.clientX - rect.left,
                  //       y: e.clientY - rect.top
                  //     });
                  //   }
                  //   return; // Don't start dragging on right click
                  // }

                  // Track left click start position
                  if (e.button === 0) {
                    setLeftClickStartPos({ x: e.clientX, y: e.clientY });
                    setHasDraggedFromLeftClick(false);
                  }

                  setIsDragging(true);
                  zoom.dragStart(e);
                  setLastMouse({ x: e.clientX, y: e.clientY });
                }}
                onClick={(e) => {
                  // Close canvas context menu when clicking elsewhere
                  // if (canvasContextMenu) {
                  //   setCanvasContextMenu(null);
                  // }
                }}
                onMouseUp={(e) => {
                  if (draggingAnnotation) {
                    handleAnnotationDragEnd(e);
                  }

                  // Only handle chart clicks if we're not clicking an annotation and haven't dragged
                  if (e.button === 0 && !isClickingAnnotation && !hasDraggedFromLeftClick && closestPoint && onChartClick) {
                    onChartClick(closestPoint.date);
                  }

                  // Reset left click tracking
                  setLeftClickStartPos(null);
                  setHasDraggedFromLeftClick(false);

                  setIsDragging(false);
                  zoom.dragEnd();
                }}
                // onContextMenu={(e) => {
                //   e.preventDefault();
                //   const rect = svgRef.current?.getBoundingClientRect();
                //   if (rect) {
                //     setCanvasContextMenu({
                //       visible: true,
                //       x: e.clientX - rect.left,
                //       y: e.clientY - rect.top
                //     });
                //   }
                // }
                onWheel={(e) => {
                  const scaleFactor = e.deltaY > 0 ? 0.97 : 1.03;

                  // Get the center X position in screen coordinates
                  const centerX = width / 2;
                  const centerY = height / 2;

                  // Convert center X to data coordinates (before zoom)
                  const centerXData = xScale.invert((centerX - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX);

                  // Only change scaleX, keep scaleY the same
                  const newScaleX = zoom.transformMatrix.scaleX * scaleFactor;
                  const newScaleY = zoom.transformMatrix.scaleY; // unchanged

                  // After zoom, the centerXData should remain at centerX
                  // So, solve for new translateX:
                  // centerX = xScale(centerXData) * newScaleX + translateX
                  // => translateX = centerX - xScale(centerXData) * newScaleX
                  const newTranslateX = centerX - xScale(centerXData) * newScaleX;

                  // For Y: center the average of min and max stacked y values in the visible data
                  let minY = Infinity;
                  let maxY = -Infinity;
                  visibleData.forEach(d => {
                    Object.values(d.parts).forEach((v) => {
                      minY = Math.min(minY, v);
                      maxY = Math.max(maxY, v);
                    });
                    // Also consider the total value
                    minY = Math.min(minY, d.value);
                    maxY = Math.max(maxY, d.value);
                  });
                  // Fallback if no data
                  if (!isFinite(minY) || !isFinite(maxY)) {
                    minY = 0;
                    maxY = 1;
                  }
                  const avgY = (minY + maxY) / 2;
                  // Center this y value in the screen
                  // y = visibleYScale(avgY) * scaleY + translateY = centerY
                  // => translateY = centerY - visibleYScale(avgY) * scaleY
                  const newTranslateY = centerY - visibleYScale(avgY) * newScaleY;

                  // Save previous transform
                  const prevTransform = { ...zoom.transformMatrix };
                  // Create new transform matrix
                  const newTransform = {
                    ...zoom.transformMatrix,
                    scaleX: newScaleX,
                    scaleY: newScaleY,
                    translateX: newTranslateX,
                    translateY: newTranslateY,
                  };
                  // Constrain after zoom
                  const constrained = constrainTransform(newTransform, prevTransform, width, height, true);
                  zoom.setTransformMatrix(constrained);
                }}
              >
                <defs>
                  <LinearGradient id="area-gradient" from="#03c6fc" to="#FFFFFF" toOpacity={0.01} />
                </defs>

                <rect width={width} height={height} fill="#f7fafb" />

                {/* Closest Point Vertical Line */}
                {closestPoint && cursorPos && (
                  <line
                    x1={xScale(closestPoint.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX}
                    x2={xScale(closestPoint.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX}
                    y1={0}
                    y2={height}
                    stroke="#03c6fc"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                    opacity={1}
                  />
                )}

                {/* Main content with zoom transform */}
                <g transform={`translate(${zoom.transformMatrix.translateX},${zoom.transformMatrix.translateY}) scale(${zoom.transformMatrix.scaleX},${zoom.transformMatrix.scaleY})`}>
                  {/* Add stacked areas */}
                  {Object.keys(netWorthData[0]?.parts || {}).map((partKey) => {
                    const category = getEnvelopeCategory(plan, partKey) || 'Uncategorized';
                    const color = categoryColors[category] || { area: '#ccc', line: '#888' };
                    const isDebt = category === 'Debt';
                    return (
                      <g key={`area-group-${partKey}`}>
                        <AreaClosed
                          data={stackedData}
                          x={(d) => xScale(d.date)}
                          y0={(d) => visibleYScale(d.stackedParts[partKey].y0)}
                          y1={(d) => visibleYScale(d.stackedParts[partKey].y1)}
                          yScale={visibleYScale}
                          stroke="none"
                          fill={color.area}
                          fillOpacity={hoveredArea?.envelope === partKey ? 1 : 0.8 * animationProgress}
                          curve={curveLinear}
                          style={{
                            clipPath: `polygon(0 0, ${animationProgress * 100}% 0, ${animationProgress * 100}% 100%, 0 100%)`
                          }}
                          onMouseMove={() => setHoveredArea({ envelope: partKey, category: getEnvelopeCategory(plan, partKey) || 'Uncategorized' })}
                        />
                      </g>
                    );
                  })}

                  {/* Add top/bottom lines for each part */}
                  {[...Object.keys(netWorthData[0]?.parts || {})].reverse().map((partKey) => {
                    const category = getEnvelopeCategory(plan, partKey) || 'Uncategorized';
                    const color = categoryColors[category] || { area: '#ccc', line: '#888' };
                    const isDebt = category === 'Debt';

                    return (
                      <g key={`line-group-${partKey}`}>
                        <LinePath
                          data={stackedData}
                          x={(d) => xScale(d.date)}
                          y={(d) => visibleYScale(d.stackedParts[partKey].y1)}
                          stroke={color.line}
                          strokeWidth={1 / globalZoom}
                          strokeOpacity={animationProgress}
                          curve={curveLinear}
                          style={{
                            clipPath: `polygon(0 0, ${animationProgress * 100}% 0, ${animationProgress * 100}% 100%, 0 100%)`
                          }}
                        />
                      </g>
                    );
                  })}

                  {/* Render non-networth parts as separate lines (debugging) */}
                  {DEBUG && Object.keys(netWorthData[0]?.nonNetworthParts || {}).map((partKey) => {
                    const category = getEnvelopeCategory(plan, partKey) || 'Non-Networth';
                    const color = categoryColors[category] || { area: '#ff6b6b', line: '#ff4757' };

                    // Split data for this non-networth envelope part
                    const { segments } = splitDataForMixedCurves(
                      netWorthData,
                      (d: any) => d.nonNetworthParts?.[partKey] || 0
                    );

                    return (
                      <g key={`non-networth-line-group-${partKey}`}>
                        {segments.map((segment, segIndex) => {
                          const isTransitioning = segment.length === 2 &&
                            isZeroTransition(
                              segment[0].nonNetworthParts?.[partKey] || 0,
                              segment[1].nonNetworthParts?.[partKey] || 0
                            );

                          return (
                            <LinePath
                              key={`non-networth-line-${partKey}-${segIndex}`}
                              data={segment}
                              x={(d: any) => xScale(d.date)}
                              y={(d: any) => visibleYScale(d.nonNetworthParts?.[partKey] || 0)}
                              stroke={color.line}
                              strokeWidth={2 / globalZoom}
                              strokeOpacity={0.7}
                              strokeDasharray="5,3"
                              curve={isTransitioning ? curveStepAfter : curveLinear}
                            />
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Extended zero line: always from left to right edge of canvas */}
                  <line
                    x1={-width}
                    x2={width * 2}
                    y1={visibleYScale(0)}
                    y2={visibleYScale(0)}
                    strokeWidth={2}
                    stroke="#4a5568" // darker gray for better visibility
                    opacity={0.8}
                    strokeDasharray={`${8 / globalZoom},${4 / globalZoom}`}
                  />

                  {/* Current day indicator line - more prominent and full height */}
                  <line
                    x1={xScale(currentDay)}
                    x2={xScale(currentDay)}
                    y1={0}
                    y2={height * 2}
                    stroke="#2d3748" // even darker gray for today's line
                    strokeWidth={1 / globalZoom}
                    opacity={0.9}
                  />

                  {/* Retirement Goal Line (solid, inside zoom group) */}
                  {plan?.retirement_goal && plan.retirement_goal > 0 && (
                    <line
                      x1={0}
                      x2={width}
                      y1={visibleYScale(plan.retirement_goal)}
                      y2={visibleYScale(plan.retirement_goal)}
                      stroke="#f59e42"
                      strokeWidth={1.8}
                      opacity={0.7}
                    />
                  )}
                </g>

                {/* Net Worth Line and Data Circles rendered outside the zoom <g> so their thickness and size are fixed */}
                {/* Locked Plan Net Worth Line (light gray, overlay) */}
                {/* Using visibleLockedNetWorthData which contains ${visibleLockedNetWorthData.length} points in current view */}
                {lockedNetWorthData.length > 0 && isOnboardingAtOrAbove('assets') && isCompareMode && (
                  <LinePath
                    data={visibleLockedNetWorthData}
                    x={d => xScale(d.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX}
                    y={d => visibleYScale(d.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY}
                    stroke="#d1d5db"
                    strokeWidth={2}
                    curve={curveLinear}
                    strokeDasharray="4,2"
                  />
                )}

                {/* Main Net Worth Line */}
                {/* Using visibleData which contains ${visibleData.length} points in current view */}
                {/* Full dataset has ${netWorthData.length} points, filtering to visible range for performance */}
                <g>
                  <LinePath
                    innerRef={node => {
                      if (node) {
                        const length = node.getTotalLength();
                        if (length !== pathLength) {
                          setPathLength(length);
                        }
                      }
                    }}
                    data={visibleData}
                    x={d => xScale(d.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX}
                    y={d => visibleYScale(d.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY}
                    stroke="#335966"
                    strokeWidth={baseLineWidth}
                    curve={curveLinear}
                    style={{
                      strokeDasharray: `${pathLength}px`,
                      strokeDashoffset: `${pathLength * (1 - animationProgress)}px`,
                      transition: 'none'
                    }}
                  />

                  {/* Circles with animation */}
                  {visibleData.map((point, index) => {
                    const canvasX = xScale(point.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX;
                    const canvasY = visibleYScale(point.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY;
                    const isClosestPoint = closestPoint && point.date === closestPoint.date;

                    // Calculate if this point should be visible based on animation progress
                    const pointProgress = index / (visibleData.length - 1);
                    const isVisible = pointProgress <= animationProgress;

                    return (
                      <circle
                        key={`point-${index}`}
                        cx={canvasX}
                        cy={canvasY}
                        r={basePointRadius}
                        fill={isClosestPoint ? "#03c6fc" : "#335966"}
                        stroke="#fff"
                        strokeWidth={baseLineWidth}
                        style={{
                          opacity: isVisible ? 1 : 0,
                          transition: 'opacity 0.1s ease-in'
                        }}
                      />
                    );
                  })}

                </g>

                {/* Comparison between locked and current net worth - rendered on top */}
                {closestPoint && lockedNetWorthData.length > 0 && (() => {
                  // Find the corresponding locked net worth point
                  const lockedPoint = lockedNetWorthData.find(d => d.date === closestPoint.date);
                  if (!lockedPoint) return null;

                  const currentX = xScale(closestPoint.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX;
                  const currentY = visibleYScale(closestPoint.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY;
                  const lockedX = xScale(lockedPoint.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX;
                  const lockedY = visibleYScale(lockedPoint.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY;

                  const difference = closestPoint.value - lockedPoint.value;

                  // Only show if difference is greater than 0.01 (1 cent)
                  if (Math.abs(difference) <= 0.01) return null;

                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      {/* Circle on locked net worth line */}
                      <circle
                        cx={lockedX}
                        cy={lockedY}
                        r={basePointRadius}
                        fill="#d1d5db"
                        stroke="#fff"
                        strokeWidth={baseLineWidth}
                      />

                      {/* Connecting line */}
                      {/* <line
                        x1={currentX}
                        y1={currentY}
                        x2={lockedX}
                        y2={lockedY}
                        stroke="#335966"
                        strokeWidth={1}
                        strokeDasharray="4,4"
                      /> */}

                      {/* Difference label */}
                      {/* <g transform={`translate(${(currentX + lockedX) / 2}, ${(currentY + lockedY) / 2 - 10})`}>
                        <rect
                          x={-40}
                          y={-12}
                          width={80}
                          height={20}
                          rx={4}
                          fill="white"
                          stroke={difference >= 0 ? "#4CAF50" : "#F44336"}
                          strokeWidth={1}
                          opacity={0.95}
                          filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.1))"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={difference >= 0 ? "#4CAF50" : "#F44336"}
                          fontSize={11}
                          fontWeight="600"
                        >
                          {difference >= 0 ? '+' : '-'}{formattedDiff}
                        </text>
                      </g> */}
                    </g>
                  );
                })()}

                {/* Timeline Annotations (outside zoom transform) */}
                {(() => {
                  // Separate snapped maps for current and locked plan
                  const snappedEventsMapCurrent: { [snappedDate: number]: Array<{ event: any, originalDate: number, isEndingEvent: boolean, displayId: string, iconSizePercent?: number, isRecurringInstance?: boolean, recurrenceIndex?: number, isUpdatingEvent?: boolean, parentEventId?: number }> } = {};
                  const snappedEventsMapLocked: { [snappedDate: number]: Array<{ event: any, originalDate: number, isEndingEvent: boolean, displayId: string, iconSizePercent?: number, isRecurringInstance?: boolean, recurrenceIndex?: number, isUpdatingEvent?: boolean, parentEventId?: number }> } = {};

                  const visibleOnscreenDateSetCurrent = new Set(visibleData.map(p => p.date));
                  const visibleOnscreenDateSetLocked = new Set(visibleLockedNetWorthData.map(p => p.date));

                  const findClosestPoint = (points: { date: number, value: number }[], date: number) => {
                    if (points.length === 0) return null;
                    const future = points.filter(p => p.date >= date);
                    if (future.length > 0) {
                      return future.reduce((closest, current) => Math.abs(current.date - date) < Math.abs(closest.date - date) ? current : closest);
                    }
                    return points[points.length - 1];
                  };

                  for (const [dateStr, eventsAtDate] of Object.entries(allEventsByDate)) {
                    const date = Number(dateStr);
                    for (const eventEntry of eventsAtDate) {
                      if (eventEntry.isShadowMode) {
                        const closestLocked = findClosestPoint(lockedNetWorthData, date);
                        if (!closestLocked) continue;
                        if (!snappedEventsMapLocked[closestLocked.date]) snappedEventsMapLocked[closestLocked.date] = [];
                        snappedEventsMapLocked[closestLocked.date].push({
                          event: eventEntry.event,
                          originalDate: date,
                          isEndingEvent: eventEntry.isEndingEvent,
                          displayId: eventEntry.displayId,
                          iconSizePercent: (eventEntry as any).iconSizePercent,
                          isRecurringInstance: (eventEntry as any).isRecurringInstance,
                          recurrenceIndex: (eventEntry as any).recurrenceIndex,
                          isUpdatingEvent: (eventEntry as any).isUpdatingEvent,
                          parentEventId: (eventEntry as any).parentEventId,
                        });
                      } else {
                        const closestCurrent = findClosestPoint(netWorthData, date);
                        if (!closestCurrent) continue;
                        if (!snappedEventsMapCurrent[closestCurrent.date]) snappedEventsMapCurrent[closestCurrent.date] = [];
                        snappedEventsMapCurrent[closestCurrent.date].push({
                          event: eventEntry.event,
                          originalDate: date,
                          isEndingEvent: eventEntry.isEndingEvent,
                          displayId: eventEntry.displayId,
                          iconSizePercent: (eventEntry as any).iconSizePercent,
                          isRecurringInstance: (eventEntry as any).isRecurringInstance,
                          recurrenceIndex: (eventEntry as any).recurrenceIndex,
                          isUpdatingEvent: (eventEntry as any).isUpdatingEvent,
                          parentEventId: (eventEntry as any).parentEventId,
                        });
                      }
                    }
                  }

                  const renderGroup = (entries: [string, Array<{ event: any, originalDate: number, isEndingEvent: boolean, displayId: string, iconSizePercent?: number, isRecurringInstance?: boolean, recurrenceIndex?: number, isUpdatingEvent?: boolean, parentEventId?: number }>][], useLocked: boolean) => {
                    return entries.flatMap(([snappedDateStr, events]) => {
                      const snappedDate = Number(snappedDateStr);
                      const visibleSet = useLocked ? visibleOnscreenDateSetLocked : visibleOnscreenDateSetCurrent;
                      if (!visibleSet.has(snappedDate)) return null;
                      const dataArr = useLocked ? visibleLockedNetWorthData : visibleData;
                      const closestDataPoint = dataArr.find(p => p.date === snappedDate);
                      if (!closestDataPoint) return null;
                      const canvasX = xScale(closestDataPoint.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX;
                      const canvasY = visibleYScale(closestDataPoint.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY;
                      // Precompute variable stacking offsets based on effective scales (icon size and zoom)
                      const baseSize = 40;
                      const gap = 10;
                      const ZOOM_MIN_FOR_GROWTH = 1;      // start growing from this zoom
                      const ZOOM_FULL_GROWTH = 300;        // icons reach near-full size around this zoom
                      const computeZoomAmplify = (z: number) => {
                        const t = Math.max(0, Math.min(1, (z - ZOOM_MIN_FOR_GROWTH) / (ZOOM_FULL_GROWTH - ZOOM_MIN_FOR_GROWTH)));
                        // Exponential ease-out to approach 1 as t->1
                        return 1 - Math.exp(-4 * t);
                      };
                      const zoomAmp = computeZoomAmplify(globalZoom);
                      const effectiveScaleOf = (minScale: number) => minScale + (1 - minScale) * zoomAmp;
                      const minScales = events.map(e => Math.max(0, (e.iconSizePercent ?? 100)) / 100);
                      const effScales = minScales.map(ms => effectiveScaleOf(ms));
                      const offsets = events.map((_, idx) => idx === 0 ? 0 : effScales.slice(0, idx).reduce((sum, s) => sum + (baseSize * s) + gap, 0));

                      return events.map(({ event, isEndingEvent, displayId, iconSizePercent, isRecurringInstance, isUpdatingEvent, parentEventId }, i) => {
                        const isDraggingMain = draggingAnnotation?.displayId === displayId;
                        const yOffset = offsets[i];
                        const DRAG_Y_OFFSET = 80;
                        const minScale = Math.max(0, (iconSizePercent ?? 100)) / 100;
                        const scale = effectiveScaleOf(minScale);
                        const width = baseSize; // keep base viewport size; scale inner content
                        const height = baseSize;
                        const x = isDraggingMain
                          ? cursorPos!.x - draggingAnnotation!.offsetX - 20
                          : canvasX - 20;
                        const y = isDraggingMain
                          ? cursorPos!.y - draggingAnnotation!.offsetY - DRAG_Y_OFFSET
                          : canvasY - DRAG_Y_OFFSET - yOffset;
                        const xAdj = x - (baseSize * (scale - 1)) / 2;
                        const yAdj = y - (baseSize * (scale - 1)) / 2 + 1 / scale * 10;
                        const effectiveEventId = getEffectiveEventId(plan!, event.id);
                        const effectiveHoveredId = hoveredEventId ? getEffectiveEventId(plan!, hoveredEventId) : null;
                        const isHighlighted = useLocked ? false : (effectiveHoveredId === effectiveEventId);

                        return (
                          <foreignObject
                            key={`annotation-${displayId}`}
                            x={xAdj}
                            y={yAdj}
                            width={width}
                            height={height}
                            style={{
                              overflow: 'visible',
                              cursor: useLocked ? 'default' : (isRecurringInstance ? 'pointer' : (isDraggingMain ? 'grabbing' : 'move'))
                            }}
                            onMouseDown={useLocked || isRecurringInstance ? undefined : (e) => {
                              const adjustedYOffset = yOffset + (baseSize * (scale - 1)) / 2;
                              handleAnnotationDragStart(e, event.id, displayId, closestDataPoint.date, adjustedYOffset, DRAG_Y_OFFSET, isEndingEvent);
                            }}
                            onMouseEnter={useLocked ? undefined : () => {
                              setHoveredEventId(event.id);
                              setEventDescriptionTooltip({
                                left: xAdj + baseSize * scale + 10,
                                top: yAdj,
                                displayType: event.title || getEventDisplayType(event.type),
                                description: event.description || '',
                              });
                            }}
                            onMouseLeave={useLocked ? undefined : () => {
                              setHoveredEventId(null);
                              setEventDescriptionTooltip(null);
                            }}
                          >
                            {useLocked ? (
                              <div style={{ width: baseSize, height: baseSize, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                                <TimelineAnnotation
                                  icon={getEventIcon(event.type, event)}
                                  highlighted={isHighlighted}
                                  isRecurring={event.is_recurring}
                                  isEnding={isEndingEvent}
                                  isShadowMode
                                  isRecurringInstance={!!isRecurringInstance}
                                />
                              </div>
                            ) : (
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div>
                                    <div
                                      style={{ width: baseSize, height: baseSize, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                                      onMouseDown={isRecurringInstance ? undefined : (e) => {
                                        setIsClickingAnnotation(true);
                                      }}
                                      onMouseUp={(e) => {
                                        if (!hasDragged && e.button === 0) {
                                          const clickTargetId = parentEventId ?? event.id;
                                          onAnnotationClick?.(clickTargetId);
                                        }
                                        setHasDragged(false);
                                        setTimeout(() => setIsClickingAnnotation(false), 100);
                                      }}
                                    >
                                      <TimelineAnnotation
                                        icon={getEventIcon(event.type, event)}
                                        highlighted={isHighlighted}
                                        isRecurring={event.is_recurring}
                                        isEnding={isEndingEvent}
                                        isRecurringInstance={!!isRecurringInstance}
                                      />
                                    </div>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  <ContextMenuItem asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="w-full h-7 text-xs justify-start bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
                                      onClick={() => {
                                        deleteEvent(event.id);
                                        onAnnotationDelete?.(event.id);
                                        setEventDescriptionTooltip(null);
                                        setHoveredEventId(null);
                                      }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete Event
                                    </Button>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            )}
                          </foreignObject>
                        );
                      });
                    });
                  };

                  const renderedCurrent = renderGroup(Object.entries(snappedEventsMapCurrent), false);
                  const renderedLocked = renderGroup(Object.entries(snappedEventsMapLocked), true);
                  return (
                    <>
                      {isCompareMode && renderedLocked}
                      {renderedCurrent}
                    </>
                  );
                })()}



                {/* Axes with visible domain */}
                {
                  (() => {
                    const visibleXDomain = [
                      xScale.invert((-zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX),
                      xScale.invert((width - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX)
                    ];
                    const visibleYDomain: [number, number] = [
                      visibleYScale.invert((height - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY),
                      visibleYScale.invert((-zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY)
                    ];

                    const visibleXScale = scaleLinear({
                      domain: visibleXDomain,
                      range: [0, width], // I dont think range this does anything
                    });

                    const visibleYScaleForAxis = scaleLinear({
                      domain: visibleYDomain,
                      range: [height, 0],
                    });

                    return (
                      <>
                        <AxisLeft
                          scale={visibleYScaleForAxis}
                          stroke="#bbd4dd"
                          tickStroke="#bbd4dd"
                          tickFormat={(value) => formatNumber(value)}
                          tickLabelProps={() => ({
                            fill: '#335966',
                            fontSize: 12,
                            textAnchor: 'end',
                            dy: '0.33em',
                          })}
                          left={60}
                        />

                        <AxisBottom
                          top={height - 40}
                          scale={visibleXScale}
                          stroke="#bbd4dd"
                          tickStroke="#bbd4dd"
                          tickFormat={(value) => formatDate(value.valueOf(), birthDate, timeInterval, true, false) as string}
                          tickComponent={({ x, y, formattedValue }) => (
                            <AxisBottomTick
                              x={x}
                              y={y}
                              formattedValue={formattedValue as string}
                            />
                          )}
                          left={0}
                        />
                      </>
                    );
                  })()
                }

                {/* Net worth values at intersection day (right side with tick marks) */}
                {firstDayAboveGoal && netWorthValues && (
                  <>
                    {/* Tick mark for net worth value */}
                    {/* <line
                      x1={width - 60}
                      x2={width - 40}
                      y1={visibleYScale(netWorthValues.netWorth) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY}
                      y2={visibleYScale(netWorthValues.netWorth) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY}
                      stroke="#335966"
                      strokeWidth={2}
                    /> */}

                    {/* Tick mark for locked net worth value */}
                    {/* <line
                      x1={width - 60}
                      x2={width - 40}
                      y1={visibleYScale(netWorthValues.lockedNetWorth) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY}
                      y2={visibleYScale(netWorthValues.lockedNetWorth) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY}
                      stroke="#d1d5db"
                      strokeWidth={2}
                    /> */}

                    {/* Horizontal line connecting the two tick marks */}
                    {/* <line
                      x1={width - 50}
                      x2={width - 50}
                      y1={visibleYScale(netWorthValues.lockedNetWorth) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY}
                      y2={visibleYScale(netWorthValues.netWorth) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY}
                      stroke="#335966"
                      strokeWidth={1}
                      strokeDasharray="2,2"
                    /> */}
                  </>
                )}
              </svg>
              {netWorthData.length > 0 && isOnboardingAtOrAbove('declare_accounts') && (
                <Legend
                  envelopes={Object.keys(netWorthData[0].parts)}
                  envelopeColors={envelopeColors}
                  currentValues={closestPoint ? closestPoint.parts : netWorthData[netWorthData.length - 1].parts}
                  getCategory={(envelope) => getEnvelopeCategory(plan, envelope)}
                  categoryColors={categoryColors}
                  nonNetworthEnvelopes={DEBUG ? Object.keys(netWorthData[0].nonNetworthParts || {}) : undefined}
                  nonNetworthCurrentValues={DEBUG ? (closestPoint ? closestPoint.nonNetworthParts : netWorthData[netWorthData.length - 1].nonNetworthParts) : undefined}
                  lockedNetWorthValue={isCompareMode && closestPoint && lockedNetWorthData.length > 0 ?
                    lockedNetWorthData.find(d => d.date === closestPoint.date)?.value : undefined}
                  hoveredArea={hoveredArea}
                  isOnboardingAtOrAbove={isOnboardingAtOrAbove}
                />
              )}

              {tooltipData && (
                <TooltipWithBounds
                  key={Math.random()}
                  left={tooltipLeft}
                  top={tooltipTop - 40}
                  style={{
                    ...defaultStyles,
                    background: 'white',
                    border: '1px solid #335966',
                    color: '#335966',
                    padding: '8px',
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  <div style={{ fontSize: '12px' }}>
                    <div>{formatNumber({ valueOf: () => normalizeZero(tooltipData.value) })}</div>
                    {/* {Object.entries(tooltipData.parts).map(([key, value]) => (
                      <div key={key} style={{ color: partColors[key] }}>
                        {key}: {formatNumber({ valueOf: () => value })}
                      </div>
                    ))} */}
                  </div>
                </TooltipWithBounds>
              )}

              {/* Bottom axis tooltip for vertical blue line (closestPoint) */}
              {closestPoint && (
                <div
                  style={{
                    position: 'absolute',
                    left: (xScale(closestPoint.date) * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX,
                    bottom: 24, // just above the x axis
                    transform: 'translateX(-50%)',
                    background: 'white',
                    border: '1px solid #03c6fc',
                    color: '#03c6fc',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    zIndex: 10,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                  }}
                >
                  {formatDate(closestPoint.date, birthDate, 'full', true, true)}
                </div>
              )}

              {/* Bottom axis tooltip for current day indicator line (more prominent) */}
              {typeof currentDay === 'number' && (
                <div
                  style={{
                    position: 'absolute',
                    left: (xScale(currentDay) * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX,
                    bottom: 24, // just above the x axis
                    transform: 'translateX(-50%)',
                    background: 'rgba(255,255,255,0.85)',
                    border: '1px solid #2d3748',
                    color: '#6b7280',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    zIndex: 9,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.1)'
                  }}
                >
                  {formatDate(currentDay, birthDate, 'full', true, true)}
                </div>
              )}

              {/* Tool tip for the first day above goal lined in yellow goal like retirment line for now  only boarder gold color*/}
              {/* {firstDayAboveGoal && (
                <div
                  style={{
                    position: 'absolute',
                    left: (xScale(firstDayAboveGoal) * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX,
                    bottom: 24, // just above the x axis
                    transform: 'translateX(-50%)',
                    background: 'rgba(255,255,255,0.85)',
                    border: '1px solid #ffd700',
                    color: '#6b7280',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    zIndex: 9,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                  }}
                >
                  {formatDate(firstDayAboveGoal, birthDate, 'full', true, true)}
                </div>
              )} */}

              {/* Difference label in the middle of the connecting line */}
              {/* {firstDayAboveGoal && netWorthValues && (
                <div
                  style={{
                    position: 'absolute',
                    left: width - 80,
                    top: (visibleYScale(netWorthValues.lockedNetWorth) + visibleYScale(netWorthValues.netWorth)) / 2 * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY - 10,
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: `1px solid ${netWorthValues.difference >= 0 ? '#10b981' : '#ef4444'}`,
                    color: netWorthValues.difference >= 0 ? '#10b981' : '#ef4444',
                    padding: '3px 6px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 500,
                    zIndex: 21,
                    transform: 'translateY(-50%)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {formatNumber({ valueOf: () => netWorthValues.difference })}
                </div>
              )} */}

              {/* Event Description Tooltip (on-canvas) */}
              {eventDescriptionTooltip && (
                <div
                  style={{
                    position: 'absolute',
                    left: eventDescriptionTooltip.left,
                    top: eventDescriptionTooltip.top,
                    background: 'white',
                    color: '#335966',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    pointerEvents: 'none',
                    zIndex: 100,
                    maxWidth: 240,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                    border: '2px solid #d1d5db', // gray-300
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{eventDescriptionTooltip.displayType}</div>
                  <div style={{ fontSize: 13 }}>{eventDescriptionTooltip.description}</div>
                </div>
              )}

              {/* Canvas Context Menu */}
              {/* {canvasContextMenu && (
                <div
                  style={{
                    position: 'absolute',
                    left: canvasContextMenu.x,
                    top: canvasContextMenu.y,
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    zIndex: 1000,
                    minWidth: 160,
                    padding: '4px',
                    pointerEvents: 'none', // Don't interfere with mouse tracking
                  }}
                  onMouseLeave={() => setCanvasContextMenu(null)}
                >
                  <button
                    onClick={() => {
                      if (hoveredArea?.envelope && onEditEnvelope) {
                        onEditEnvelope(hoveredArea.envelope);
                      }
                      setCanvasContextMenu(null);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#374151',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s',
                      pointerEvents: 'auto', // Allow clicks on the button
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Edit3 size={16} />
                    Edit Envelope
                  </button>
                </div>
              )} */}
            </>
          );
        }}
      </Zoom>
    </div>
  );
}
