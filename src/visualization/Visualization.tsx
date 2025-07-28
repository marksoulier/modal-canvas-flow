import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Zoom } from '@visx/zoom';
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
import { usePlan, getEnvelopeCategory, getEnvelopeDisplayName, dateStringToDaysSinceBirth, daysSinceBirthToDateString } from '../contexts/PlanContext';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from '../components/ui/context-menu';
import { Button } from '../components/ui/button';
import { Trash2 } from 'lucide-react';
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
import { getAllEventsByDate } from './Events';
import type { Plan } from '../contexts/PlanContext';

const DEBUG = false;

// Helper function to normalize -0 to 0 and small values near zero
const normalizeZero = (value: number): number => {
  const threshold = 1e-2; // Very small threshold for floating point precision
  return Math.abs(value) < threshold ? 0 : value;
};

// Helper function to detect if a transition is from/to zero (manhattan style needed)
const isZeroTransition = (prevValue: number, currentValue: number): boolean => {
  const prev = normalizeZero(prevValue);
  const curr = normalizeZero(currentValue);
  // True if going from 0 to value OR from value to 0
  return false; //set false for now.
  //return (prev === 0 && curr !== 0) || (prev !== 0 && curr === 0);
};

// Helper function to split data into segments based on 0-to-value transitions
const splitDataForMixedCurves = (data: any[], getValueFn: (d: any) => number) => {
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
  autoRunSimulation?: boolean; // Whether to automatically run simulation when plan changes
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


export function Visualization({ onAnnotationClick, onAnnotationDelete, onNegativeAccountWarning, autoRunSimulation = false }: VisualizationProps) {
  // Ref to store the setZoomToDateRange function for context access
  const setZoomToDateRangeRef = useRef<((startDay: number, endDay: number) => void) | null>(null);

  // Get the registerCurrentVisualizationRange function from context
  const { registerCurrentVisualizationRange } = usePlan();
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
  const [lastMouse, setLastMouse] = useState<{ x: number, y: number } | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [eventDescriptionTooltip, setEventDescriptionTooltip] = useState<{
    left: number;
    top: number;
    displayType: string;
    description: string;
  } | null>(null);
  const [autoZoomTrigger, setAutoZoomTrigger] = useState<{ years?: number; months?: number; days?: number } | null>(null);

  // Visible range detection (for logging/debugging only)
  const [currentVisibleRange, setCurrentVisibleRange] = useState<{
    startDate: number;
    endDate: number;
    startDateFormatted: string;
    endDateFormatted: string;
    totalDays: number;
  } | null>(null);

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

  const { plan, plan_locked, getEventIcon, updateParameter, schema, deleteEvent, getEventDisplayType, currentDay, registerSetZoomToDateRange, setVisualizationReady, convertDateParametersToDays, loadPlan } = usePlan();

  // Register the setZoomToDateRange function with the context when it's available
  useEffect(() => {
    if (setZoomToDateRangeRef.current) {
      registerSetZoomToDateRange(setZoomToDateRangeRef.current);
    }
  }, [registerSetZoomToDateRange]);

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

  // Run simulation for locked plan
  useEffect(() => {
    const runLockedSim = async () => {
      if (!plan_locked || !schema) {
        setLockedNetWorthData([]);
        return;
      }
      try {
        // Run simulation with full range
        console.log('🔍 Locked Plan - Running simulation with full range:', {
          startDate,
          endDate,
          days: endDate - startDate
        });

        // Convert date parameters to days for simulation
        const convertedPlanLocked = {
          ...plan_locked,
          events: convertDateParametersToDays(plan_locked.events)
        };

        const result = await runSimulation(
          convertedPlanLocked,
          schema,
          startDate,
          endDate,
          getIntervalInDays(timeInterval),
          currentDay,
          birthDate
        );
        // Only keep {date, value}
        setLockedNetWorthData(result.map(({ date, value }) => ({ date, value })));
      } catch (err) {
        setLockedNetWorthData([]);
      }
    };
    runLockedSim();
  }, [plan_locked, schema, timeInterval, currentDay, convertDateParametersToDays]);

  // Function to determine time interval based on zoom level
  const getTimeIntervalFromZoom = (zoom: number): TimeInterval => {

    if (zoom >= 250) return 'day';
    if (zoom >= 60) return 'week';
    if (zoom >= 10) return 'month';
    if (zoom >= 5) return 'quarter';
    if (zoom >= 3) return 'half_year';
    return 'year';
  };

  // Manual simulation control
  const runSimulationManually = useCallback(async () => {
    if (!plan || !schema) return;

    try {
      setIsLoading(true);

      // Set birth date from plan
      if (plan.birth_date) {
        // Parse birth date as local date to avoid timezone issues
        const birthDateObj = new Date(plan.birth_date + 'T00:00:00');
        setBirthDate(birthDateObj);
      }

      // Run simulation with full range
      console.log('🔍 Running simulation with full range:', {
        startDate,
        endDate,
        days: endDate - startDate
      });

      // Convert date parameters to days for simulation
      const convertedPlan = {
        ...plan,
        events: convertDateParametersToDays(plan.events)
      };

      const result = await runSimulation(
        convertedPlan,
        schema,
        startDate,
        endDate,
        getIntervalInDays(timeInterval),
        currentDay,
        birthDate,
        (updates) => {
          // Handle plan updates from simulation
          if (updates.length > 0) {
            console.log('📝 Applying plan updates from simulation:', updates);

            // Create a copy of the current plan
            const updatedPlan = { ...plan };

            // Apply each update
            updates.forEach(update => {
              const event = updatedPlan.events.find(e => e.id === update.eventId);
              if (event) {
                const param = event.parameters.find(p => p.type === update.paramType);
                if (param) {
                  // if param is a end_time or start_time, convert it to a date string
                  if (param.type === 'end_time' || param.type === 'start_time') {
                    param.value = daysSinceBirthToDateString(update.value, plan.birth_date);
                  } else {
                    param.value = update.value;
                  }
                  console.log(`✅ Updated ${update.paramType} for event ${update.eventId} to ${update.value}`);
                }
              }
            });

            // Update the plan with calculated values
            loadPlan(updatedPlan);
          }
        }
      );

      setNetWorthData(result);

      // Check for negative accounts and trigger warning
      const negativeWarnings = detectAccountWarnings(result, plan);
      if (negativeWarnings.length > 0 && onNegativeAccountWarning) {
        onNegativeAccountWarning(negativeWarnings);
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [plan, schema, timeInterval, currentDay, onNegativeAccountWarning, convertDateParametersToDays]);

  // Run simulation on mount only (not on every plan change)
  useEffect(() => {
    if (plan && schema) {
      runSimulationManually();
    }
  }, []); // Empty dependency array - only run on mount

  // Optional: Auto-run simulation when plan changes (if enabled)
  useEffect(() => {
    if (autoRunSimulation && plan && schema) {
      runSimulationManually();
    }
  }, [autoRunSimulation, plan, schema, runSimulationManually]);

  // Calculate stacked data from simulation results
  const stackedData = useMemo(() => {
    if (!netWorthData.length) return [];

    // Get all unique part keys from the data
    const partKeys = Array.from(
      new Set(netWorthData.flatMap(d => Object.keys(d.parts)))
    );

    return netWorthData.map(d => {
      let posSum = 0;
      let negSum = 0;
      const stackedParts: { [key: string]: { y0: number, y1: number } } = {};

      partKeys.forEach(key => {
        const value = normalizeZero(d.parts[key] || 0);
        if (value >= 0) {
          stackedParts[key] = { y0: posSum, y1: posSum + value };
          posSum += value;
        } else {
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
  }, [netWorthData]);

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
      domain: [0, maxDate],
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

  return (
    <div className="relative w-full h-full visualization-container">
      <Zoom
        width={width}
        height={height}
        scaleXMin={1.0}
        scaleXMax={400}
        scaleYMin={1.0}
        scaleYMax={400}
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

          //console.log('globalZoom: ', globalZoom);
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

          // Update time interval based on zoom level
          useEffect(() => {
            const newInterval = getTimeIntervalFromZoom(globalZoom);
            if (newInterval !== timeInterval) {
              setTimeInterval(newInterval);
            }
          }, [globalZoom]);

          // Get envelope colors from schema
          const envelopeColors = useMemo(() => {
            if (!schema?.categories) return {};
            //console.log('schema.categories: ', schema.categories);
            return generateEnvelopeColors(schema.categories);
          }, [schema]);

          const allEventsByDate = getAllEventsByDate(plan!, schema || undefined);

          // Utility to apply a transform matrix to a point
          function applyMatrixToPoint(matrix: any, point: { x: number; y: number }) {
            return {
              x: point.x * matrix.scaleX + matrix.translateX,
              y: point.y * matrix.scaleY + matrix.translateY,
            };
          }

          // Constrain transform to keep content within [0,0,width,height]
          function constrainTransform(transformMatrix: any, prevTransformMatrix: any, width: number, height: number) {
            const xPad = 80; // or whatever value you want
            const min = applyMatrixToPoint(transformMatrix, { x: 0, y: 0 });
            const max = applyMatrixToPoint(transformMatrix, { x: width, y: height });

            (window as any).debugMin = min;
            (window as any).debugMax = max;

            if (max.x < width - xPad) {
              //console.log('Constraint: max out of bounds', max);
              return prevTransformMatrix;
            } else if (min.x > 0 + xPad) {
              //console.log('Constraint: min out of bounds', min);
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
            //console.log("distance: ", distance)

            // Only update if within threshold (adjust 0.5 as needed)
            if (distance < 150) {
              // Find the event in the plan
              if (plan) {
                // Try main event first
                let event = plan.events.find(e => e.id === draggingAnnotation.eventId);
                if (event) {
                  if (draggingAnnotation.isEndingEvent) {
                    const endTimeParam = event.parameters.find(p => p.type === 'end_time');
                    if (endTimeParam) {
                      // Convert days since birth to date string for the parameter
                      const dateString = daysSinceBirthToDateString(closestPoint.date, plan.birth_date);
                      updateParameter(event.id, endTimeParam.type, dateString);
                    }
                  } else {
                    const startTimeParam = event.parameters.find(p => p.type === 'start_time');
                    if (startTimeParam) {
                      // Convert days since birth to date string for the parameter
                      const dateString = daysSinceBirthToDateString(closestPoint.date, plan.birth_date);
                      updateParameter(event.id, startTimeParam.type, dateString);
                    }
                  }
                  // Log event info during drag
                  //console.log('[Drag Move] Dragging event:', event.id, event.description || event.type);
                } else {
                  // Try updating event
                  for (const parentEvent of plan.events) {
                    const updatingEvent = parentEvent.updating_events?.find(ue => ue.id === draggingAnnotation.eventId);
                    if (updatingEvent) {
                      if (draggingAnnotation.isEndingEvent) {
                        const endTimeParam = updatingEvent.parameters.find(p => p.type === 'end_time');
                        if (endTimeParam) {
                          // Convert days since birth to date string for the parameter
                          const dateString = daysSinceBirthToDateString(closestPoint.date, plan.birth_date);
                          updateParameter(updatingEvent.id, endTimeParam.type, dateString);
                        }
                      } else {
                        const startTimeParam = updatingEvent.parameters.find(p => p.type === 'start_time');
                        if (startTimeParam) {
                          // Convert days since birth to date string for the parameter
                          const dateString = daysSinceBirthToDateString(closestPoint.date, plan.birth_date);
                          updateParameter(updatingEvent.id, startTimeParam.type, dateString);
                        }
                      }
                      // Log event info during drag
                      //console.log('[Drag Move] Dragging updating event:', updatingEvent.id, updatingEvent.description || updatingEvent.type);
                      break;
                    }
                  }
                }
              }
            }
            setClosestPoint(closestPoint);
          };

          const handleAnnotationDragEnd = (e: React.MouseEvent) => {
            if (!draggingAnnotation) return;

            const point = getSVGPoint(e);
            const dataPoint = screenToData(point.x, point.y, zoom, visibleYScale);
            const closestPoint = findClosestPoint(netWorthData, dataPoint.x);
            const closestIndex = netWorthData.findIndex(p => p.date === closestPoint?.date);

            setDraggingAnnotation(null);
            setClosestPoint(null);
          };

          // Calculate visibleYScale based on visibleData only
          const visibleYScale = useMemo(() => {
            if (!visibleData.length && !visibleLockedNetWorthData.length) return scaleLinear({ domain: [0, 1], range: [height, 0] });
            // Compute stacked sums for each data point
            const stackedSums = visibleData.map((d: any) => {
              const values = [normalizeZero(d.value), ...Object.values(d.parts).map((v: any) => normalizeZero(v))];
              const positiveSum = values.filter(v => v > 0).reduce((a, b) => a + b, 0);
              const negativeSum = values.filter(v => v < 0).reduce((a, b) => a + b, 0);
              return { positiveSum, negativeSum };
            });
            const lockedValues = visibleLockedNetWorthData.map(d => normalizeZero(d.value));
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
          }, [visibleData, visibleLockedNetWorthData, height]);

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
            const scaleX = width / (xScale(clampedEnd) - xScale(windowStart));
            const translateX = -xScale(windowStart) * scaleX + 80;

            zoom.setTransformMatrix({
              ...zoom.transformMatrix,
              scaleX,
              translateX,
            });
          };

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

            const scaleX = width / (xScale(endDay) - xScale(startDay));
            const translateX = -xScale(startDay) * scaleX;

            console.log('🎯 Calculated zoom parameters:', {
              scaleX,
              translateX,
              xScaleStartDay: xScale(startDay),
              xScaleEndDay: xScale(endDay),
              xScaleRange: xScale(endDay) - xScale(startDay),
              width
            });

            zoom.setTransformMatrix({
              ...zoom.transformMatrix,
              scaleX,
              translateX,
            });

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
          // Auto-trigger second zoom after component rerenders
          useEffect(() => {
            if (autoZoomTrigger !== null) {
              const timer = setTimeout(() => {
                handleZoomToWindow(autoZoomTrigger);
                setAutoZoomTrigger(null);
              }, 250); // Small delay to ensure render completes
              return () => clearTimeout(timer);
            }
          }, [autoZoomTrigger, netWorthData]); // Trigger when netWorthData changes (after rerender)

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
                  alignItems: 'center',
                }}
              >
                {/* Run Simulation Button */}
                <button
                  style={{
                    background: isLoading ? '#f3f4f6' : '#10b981',
                    color: isLoading ? '#6b7280' : 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    padding: '6px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    opacity: isLoading ? 0.6 : 0.9,
                    transition: 'all 0.2s',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    marginRight: 16,
                  }}
                  onClick={runSimulationManually}
                  disabled={isLoading}
                >
                  {isLoading ? 'Running...' : 'Run Simulation'}
                </button>
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
                    setAutoZoomTrigger({ months: 3 });
                  }}
                >
                  3m
                </button>
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
                    setAutoZoomTrigger({ years: 1 });
                  }}
                >
                  1yr
                </button>
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
                    setAutoZoomTrigger({ years: 5 });
                  }}
                >
                  5yr
                </button>
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
                    setAutoZoomTrigger({ years: 10 });
                  }}
                >
                  10yr
                </button>
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
                    newTransform = constrainTransform(newTransform, zoom.transformMatrix, width, height);
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
                  setIsDragging(true);
                  zoom.dragStart(e);
                  setLastMouse({ x: e.clientX, y: e.clientY });

                }}
                onMouseUp={(e) => {
                  if (draggingAnnotation) {
                    handleAnnotationDragEnd(e);
                  }
                  setIsDragging(false);
                  zoom.dragEnd();
                }}
                onWheel={(e) => {
                  const scaleFactor = e.deltaY > 0 ? 0.98 : 1.02;

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
                  const constrained = constrainTransform(newTransform, prevTransform, width, height);
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
                  {/* Add stacked areas with mixed curves */}
                  {Object.keys(netWorthData[0]?.parts || {}).map((partKey) => {
                    const category = getEnvelopeCategory(plan, partKey) || 'Uncategorized';
                    const color = categoryColors[category] || { area: '#ccc', line: '#888' };

                    // Split data for this envelope part
                    const { stepSegments, linearSegments } = splitDataForMixedCurves(
                      stackedData,
                      (d) => d.stackedParts[partKey].y1 - d.stackedParts[partKey].y0
                    );

                    return (
                      <g key={`area-group-${partKey}`}>
                        {/* Render linear segments */}
                        {linearSegments.map((segment, segIndex) => (
                          <AreaClosed
                            key={`area-linear-${partKey}-${segIndex}`}
                            data={segment}
                            x={(d) => xScale(d.date)}
                            y0={(d) => visibleYScale(d.stackedParts[partKey].y0)}
                            y1={(d) => visibleYScale(d.stackedParts[partKey].y1)}
                            yScale={visibleYScale}
                            stroke="none"
                            fill={color.area}
                            fillOpacity={0.8}
                            curve={curveLinear}
                          />
                        ))}
                        {/* Render step segments for 0↔value transitions */}
                        {stepSegments.map((segment, segIndex) => (
                          <AreaClosed
                            key={`area-step-${partKey}-${segIndex}`}
                            data={segment}
                            x={(d) => xScale(d.date)}
                            y0={(d) => visibleYScale(d.stackedParts[partKey].y0)}
                            y1={(d) => visibleYScale(d.stackedParts[partKey].y1)}
                            yScale={visibleYScale}
                            stroke="none"
                            fill={color.area}
                            fillOpacity={0.8}
                            curve={curveStepAfter}
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* Add top/bottom lines for each part with mixed curves */}
                  {[...Object.keys(netWorthData[0]?.parts || {})].reverse().map((partKey) => {
                    const category = getEnvelopeCategory(plan, partKey) || 'Uncategorized';
                    const color = categoryColors[category] || { area: '#ccc', line: '#888' };

                    // Split data for this envelope part
                    const { stepSegments, linearSegments } = splitDataForMixedCurves(
                      stackedData,
                      (d) => d.stackedParts[partKey].y1 - d.stackedParts[partKey].y0
                    );

                    return (
                      <g key={`line-group-${partKey}`}>
                        {/* Render linear segments */}
                        {linearSegments.map((segment, segIndex) => (
                          <LinePath
                            key={`line-linear-${partKey}-${segIndex}`}
                            data={segment}
                            x={(d) => xScale(d.date)}
                            y={(d) => visibleYScale(d.stackedParts[partKey].y1)}
                            stroke={color.line}
                            strokeWidth={1 / globalZoom}
                            strokeOpacity={1}
                            curve={curveLinear}
                          />
                        ))}
                        {/* Render step segments for 0↔value transitions */}
                        {stepSegments.map((segment, segIndex) => (
                          <LinePath
                            key={`line-step-${partKey}-${segIndex}`}
                            data={segment}
                            x={(d) => xScale(d.date)}
                            y={(d) => visibleYScale(d.stackedParts[partKey].y1)}
                            stroke={color.line}
                            strokeWidth={1 / globalZoom}
                            strokeOpacity={1}
                            curve={curveStepAfter}
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* Render non-networth parts as separate lines (debugging) */}
                  {DEBUG && Object.keys(netWorthData[0]?.nonNetworthParts || {}).map((partKey) => {
                    const category = getEnvelopeCategory(plan, partKey) || 'Non-Networth';
                    const color = categoryColors[category] || { area: '#ff6b6b', line: '#ff4757' };

                    // Split data for this non-networth envelope part
                    const { stepSegments, linearSegments } = splitDataForMixedCurves(
                      netWorthData,
                      (d) => d.nonNetworthParts?.[partKey] || 0
                    );

                    return (
                      <g key={`non-networth-line-group-${partKey}`}>
                        {/* Render linear segments */}
                        {linearSegments.map((segment, segIndex) => (
                          <LinePath
                            key={`non-networth-line-linear-${partKey}-${segIndex}`}
                            data={segment}
                            x={(d) => xScale(d.date)}
                            y={(d) => visibleYScale(d.nonNetworthParts?.[partKey] || 0)}
                            stroke={color.line}
                            strokeWidth={2 / globalZoom}
                            strokeOpacity={0.7}
                            strokeDasharray="5,3"
                            curve={curveLinear}
                          />
                        ))}
                        {/* Render step segments for 0↔value transitions */}
                        {stepSegments.map((segment, segIndex) => (
                          <LinePath
                            key={`non-networth-line-step-${partKey}-${segIndex}`}
                            data={segment}
                            x={(d) => xScale(d.date)}
                            y={(d) => visibleYScale(d.nonNetworthParts?.[partKey] || 0)}
                            stroke={color.line}
                            strokeWidth={2 / globalZoom}
                            strokeOpacity={0.7}
                            strokeDasharray="5,3"
                            curve={curveStepAfter}
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* Extended zero line: always from left to right edge of canvas */}
                  <line
                    x1={-width}
                    x2={width * 2}
                    y1={visibleYScale(0)}
                    y2={visibleYScale(0)}
                    strokeWidth={1}
                    stroke="#a0aec0" // subtle gray
                    opacity={0.7}
                  />

                  {/* Current day indicator line - more subtle and full height */}
                  <line
                    x1={xScale(currentDay)}
                    x2={xScale(currentDay)}
                    y1={0}
                    y2={height * 2}
                    stroke="#a0aec0" // subtle gray
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
                {lockedNetWorthData.length > 0 && (
                  <LinePath
                    data={lockedNetWorthData}
                    x={d => xScale(d.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX}
                    y={d => visibleYScale(d.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY}
                    stroke="#d1d5db"
                    strokeWidth={2}
                    curve={curveLinear}
                    strokeDasharray="4,2"
                  />
                )}
                <LinePath
                  data={netWorthData}
                  x={d => xScale(d.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX}
                  y={d => visibleYScale(d.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY}
                  stroke="#335966"
                  strokeWidth={baseLineWidth}
                  curve={curveLinear}
                />
                {visibleData.map((point, index) => {
                  const canvasX = xScale(point.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX;
                  const canvasY = visibleYScale(point.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY;
                  const isClosestPoint = closestPoint && point.date === closestPoint.date;
                  return (
                    <circle
                      key={`point-${index}`}
                      cx={canvasX}
                      cy={canvasY}
                      r={basePointRadius}
                      fill={isClosestPoint ? "#03c6fc" : "#335966"}
                      stroke="#fff"
                      strokeWidth={baseLineWidth}
                    />
                  );
                })}

                {/* Timeline Annotations (outside zoom transform) */}
                {(() => {
                  // 1. Build a map: snappedDataPointDate -> [events]
                  const snappedEventsMap: { [snappedDate: number]: Array<{ event: any, originalDate: number, isEndingEvent: boolean, displayId: string }> } = {};
                  for (const [dateStr, eventsAtDate] of Object.entries(allEventsByDate)) {
                    const date = Number(dateStr);
                    // Find the closest visible data point that is greater than or equal to the event date
                    const visibleDataPoints = netWorthData.filter(p =>
                      p.date >= xScale.domain()[0] && p.date <= xScale.domain()[1]
                    );
                    if (visibleDataPoints.length === 0) continue;

                    // Find the closest data point that is >= the event date
                    const futureDataPoints = visibleDataPoints.filter(p => p.date >= date);
                    let closestDataPoint;

                    if (futureDataPoints.length > 0) {
                      // If we have future data points, find the closest one
                      closestDataPoint = futureDataPoints.reduce((closest, current) =>
                        Math.abs(current.date - date) < Math.abs(closest.date - date) ? current : closest
                      );
                    } else {
                      // If no future data points, use the latest available data point
                      closestDataPoint = visibleDataPoints[visibleDataPoints.length - 1];
                    }

                    if (!closestDataPoint) continue;
                    // For each event at this date, add to the snapped map
                    for (const event of eventsAtDate) {
                      if (!snappedEventsMap[closestDataPoint.date]) {
                        snappedEventsMap[closestDataPoint.date] = [];
                      }
                      snappedEventsMap[closestDataPoint.date].push({
                        event: event.event,
                        originalDate: date,
                        isEndingEvent: event.isEndingEvent,
                        displayId: event.displayId
                      });
                    }
                  }
                  // 2. Render each group stacked
                  return Object.entries(snappedEventsMap).flatMap(([snappedDateStr, events]) => {
                    const snappedDate = Number(snappedDateStr);
                    // Find the closest data point (should exist)
                    const closestDataPoint = netWorthData.find(p => p.date === snappedDate);
                    if (!closestDataPoint) return null;
                    const canvasX = xScale(closestDataPoint.date) * zoom.transformMatrix.scaleX + zoom.transformMatrix.translateX;
                    const canvasY = visibleYScale(closestDataPoint.value) * zoom.transformMatrix.scaleY + zoom.transformMatrix.translateY;
                    return events.map(({ event, isEndingEvent, displayId }, i) => {
                      const isDraggingMain = draggingAnnotation?.displayId === displayId;
                      const yOffset = i * 50;
                      const DRAG_Y_OFFSET = 80; // adjust this value for better alignment
                      const x = isDraggingMain
                        ? cursorPos!.x - draggingAnnotation!.offsetX - 20
                        : canvasX - 20;
                      const y = isDraggingMain
                        ? cursorPos!.y - draggingAnnotation!.offsetY - DRAG_Y_OFFSET
                        : canvasY - DRAG_Y_OFFSET - yOffset;
                      const isHighlighted = hoveredEventId === event.id;
                      return (
                        <foreignObject
                          key={`annotation-${displayId}`}
                          x={x}
                          y={y}
                          width={40}
                          height={40}
                          style={{
                            overflow: 'visible',
                            cursor: isDraggingMain ? 'grabbing' : 'move'
                          }}
                          onMouseDown={(e) => {
                            handleAnnotationDragStart(e, event.id, displayId, closestDataPoint.date, yOffset, DRAG_Y_OFFSET, isEndingEvent);
                          }}
                          onMouseEnter={() => {
                            setHoveredEventId(event.id);
                            setEventDescriptionTooltip({
                              left: x + 50, // adjust as needed for best placement
                              top: y,
                              displayType: event.title || getEventDisplayType(event.type),
                              description: event.description || '',
                            });
                          }}
                          onMouseLeave={() => {
                            setHoveredEventId(null);
                            setEventDescriptionTooltip(null);
                          }}
                        >
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div>
                                <TimelineAnnotation
                                  icon={getEventIcon(event.type)}
                                  label={event.description}
                                  highlighted={isHighlighted}
                                  isRecurring={event.is_recurring}
                                  isEnding={isEndingEvent}
                                  onClick={() => {
                                    if (!hasDragged) {
                                      onAnnotationClick?.(event.id);
                                    }
                                    setHasDragged(false);
                                  }}
                                />
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
                                    // Clear tooltip when event is deleted
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
                        </foreignObject>
                      );
                    });
                  });
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
              {netWorthData.length > 0 && (
                <Legend
                  envelopes={Object.keys(netWorthData[0].parts)}
                  envelopeColors={envelopeColors}
                  currentValues={closestPoint ? closestPoint.parts : netWorthData[netWorthData.length - 1].parts}
                  getCategory={(envelope) => getEnvelopeCategory(plan, envelope)}
                  categoryColors={categoryColors}
                  nonNetworthEnvelopes={DEBUG ? Object.keys(netWorthData[0].nonNetworthParts || {}) : undefined}
                  nonNetworthCurrentValues={DEBUG ? (closestPoint ? closestPoint.nonNetworthParts : netWorthData[netWorthData.length - 1].nonNetworthParts) : undefined}
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

              {/* Bottom axis tooltip for current day indicator line (gray, more transparent) */}
              {typeof currentDay === 'number' && (
                <div
                  style={{
                    position: 'absolute',
                    left: (xScale(currentDay) * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX,
                    bottom: 24, // just above the x axis
                    transform: 'translateX(-50%)',
                    background: 'rgba(255,255,255,0.85)',
                    border: '1px solid #d1d5db',
                    color: '#6b7280',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    zIndex: 9,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                  }}
                >
                  {formatDate(currentDay, birthDate, 'full', true, true)}
                </div>
              )}

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
            </>
          );
        }}
      </Zoom>
    </div>
  );
}
