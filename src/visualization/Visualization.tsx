import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Zoom } from '@visx/zoom';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { localPoint } from '@visx/event';
import { AxisLeft, AxisBottom } from '@visx/axis';
import TimelineAnnotation from '../components/TimelineAnnotation';
import { AreaClosed } from '@visx/shape';
import { curveLinear } from '@visx/curve';
import { LinearGradient } from '@visx/gradient';
import { TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { runSimulation } from '../hooks/simulationRunner';
import { usePlan } from '../contexts/PlanContext';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from '../components/ui/context-menu';
import { Button } from '../components/ui/button';
import { Trash2 } from 'lucide-react';

// Time interval type for controlling the visualization granularity
type TimeInterval = 'day' | 'week' | 'month' | 'year';

// Extended time interval type
type ExtendedTimeInterval = TimeInterval | 'full';

// Utility functions
const formatNumber = (value: { valueOf(): number }): string => {
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
const getAgeFromDays = (daysSinceBirth: number): number => {
  return Math.floor(daysSinceBirth / 365.25);
};

// Format date based on time interval, now also returns age if requested
// If showAgeAsJSX is true, returns JSX with age in light gray
const formatDate = (
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

// Convert days since birth to actual date
const daysToDate = (daysSinceBirth: number, birthDate: Date): Date => {
  const result = new Date(birthDate);
  result.setDate(result.getDate() + daysSinceBirth);
  return result;
};

// Get interval in days based on selected time interval
const getIntervalInDays = (interval: TimeInterval): number => {
  switch (interval) {
    case 'day':
      return 1;
    case 'week':
      return 7;
    case 'month':
      return 365 / 12;
    case 'year':
      return 365;
    default:
      return 365;
  }
};

interface Datum {
  date: number;
  value: number;
  parts: {
    [key: string]: number;
  };
}

interface ZoomTransform {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  skewX: number;
  skewY: number;
}

interface ZoomObject {
  transformMatrix: ZoomTransform;
  scale: (params: { scaleX: number; scaleY: number }) => void;
  dragStart: (event: React.MouseEvent) => void;
  dragMove: (event: React.MouseEvent) => void;
  dragEnd: (event: React.MouseEvent) => void;
}

interface DraggingAnnotation {
  index: number; // the day/data point
  eventId: number;
  offsetX: number;
  offsetY: number;
}

interface VisualizationProps {
  onAnnotationClick?: (eventId: number) => void;
  onAnnotationDelete?: (eventId: number) => void;
}

// Colors for each part
const partColors: Record<string, string> = {
  Cash: '#03c6fc',
  House: '#75daad',
  Savings: '#ff9f1c',
  Investments: '#ff6b6b',
  Retirement: '#6b66ff'
};

// Generate subtle colors for envelopes
const generateEnvelopeColors = (envelopes: string[]): Record<string, { area: string; line: string }> => {
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
const Legend = ({ envelopes, colors, currentValues }: {
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

export function Visualization({ onAnnotationClick, onAnnotationDelete }: VisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [closestPoint, setClosestPoint] = useState<Datum | null>(null);
  const [draggingAnnotation, setDraggingAnnotation] = useState<DraggingAnnotation | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipData, setTooltipData] = useState<Datum | null>(null);
  const [tooltipLeft, setTooltipLeft] = useState<number>(0);
  const [tooltipTop, setTooltipTop] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [netWorthData, setNetWorthData] = useState<Datum[]>([]);
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('year');
  const [birthDate, setBirthDate] = useState<Date>(new Date(2000, 0, 1)); // Default to Jan 1, 2000
  const [currentDaysSinceBirth, setCurrentDaysSinceBirth] = useState<number>(0);
  const [hoveredEventId, setHoveredEventId] = useState<number | null>(null);
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

  const { plan, loadDefaultPlan, getEventIcon, updateParameter, schema, deleteEvent } = usePlan();

  // Base sizes that will be adjusted by zoom
  const baseLineWidth = 2;
  const baseTextSize = 10;
  const basePointRadius = 4;

  const startDate: number = 0
  const endDate: number = 80 * 365

  // Function to determine time interval based on zoom level
  const getTimeIntervalFromZoom = (zoom: number): TimeInterval => {
    if (zoom >= 50) return 'day';
    if (zoom >= 20) return 'week';
    if (zoom >= 5) return 'month';
    return 'year';
  };

  // Load schema and run simulation when component mounts or time interval changes
  useEffect(() => {
    const loadSchemaAndRunSim = async () => {
      try {
        setIsLoading(true);

        // Set birth date from plan
        if (plan?.birth_date) {
          const birthDateObj = new Date(plan.birth_date);
          setBirthDate(birthDateObj);

          // Calculate current days since birth
          const currentDate = new Date();
          const daysSinceBirth = Math.floor(
            (currentDate.getTime() - birthDateObj.getTime()) / (1000 * 60 * 60 * 24)
          );
          setCurrentDaysSinceBirth(daysSinceBirth);
          console.log('Current days since birth:', daysSinceBirth);
        }

        // If no plan in context, load default plan
        if (!plan) {
          await loadDefaultPlan();
        }

        // Run simulation with plan and schema from context
        const result = await runSimulation(
          plan!,
          schema!,
          startDate,
          endDate,
          getIntervalInDays(timeInterval)
        );
        console.log('Loaded Financial Results:', result);
        setNetWorthData(result);
      } catch (err) {
        console.error('Simulation failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSchemaAndRunSim();
  }, [timeInterval, plan, loadDefaultPlan, schema]); // Re-run when time interval or plan changes

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
        const value = d.parts[key] || 0;
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
        stackedParts
      };
    });
  }, [netWorthData]);

  const screenToData = (screenX: number, screenY: number, zoom: any) => {
    const x = (screenX - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX;
    const y = (screenY - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY;
    return {
      x: xScale.invert(x),
      y: yScale.invert(y)
    };
  };

  const findClosestPoint = (dataX: number): Datum | null => {
    if (!netWorthData.length) return null;
    return netWorthData.reduce((closest, point) => {
      const distance = Math.abs(point.date - dataX);
      const closestDistance = Math.abs(closest.date - dataX);
      return distance < closestDistance ? point : closest;
    });
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

  const yScale = useMemo(() => {
    if (!netWorthData.length) return scaleLinear({ domain: [0, 1], range: [height, 0] });

    // Gather all y-values: total value and all stacked part values
    const allYValues = netWorthData.flatMap(d => [
      d.value,
      ...Object.values(d.parts)
    ]);

    const minY = Math.min(...allYValues);
    const maxY = Math.max(...allYValues);

    // Avoid zero range
    const domainMin = minY === maxY ? minY - 1 : minY;
    const domainMax = minY === maxY ? maxY + 1 : maxY;

    return scaleLinear({
      domain: [domainMin, domainMax],
      range: [height, 0],
    });
  }, [netWorthData, height]);

  // Get envelope colors from schema
  const envelopeColors = useMemo(() => {
    if (!schema?.envelopes) return {};
    return generateEnvelopeColors(schema.envelopes);
  }, [schema]);

  // Group events by date for stacking annotations
  const eventsByDate = useMemo(() => {
    if (!plan) return {};
    const map: { [date: number]: typeof plan.events } = {};
    for (const event of plan.events) {
      const startTimeParam = event.parameters.find(p => p.type === 'start_time');
      if (!startTimeParam) continue;
      const date = Number(startTimeParam.value);
      if (!map[date]) map[date] = [];
      map[date].push(event);
    }
    return map;
  }, [plan]);

  const updatingEventsByDate = useMemo(() => {
    if (!plan) return {};
    const map: { [date: number]: any[] } = {};
    for (const event of plan.events) {
      if (event.updating_events) {
        for (const updatingEvent of event.updating_events) {
          // Find the start_time parameter
          const startTimeParam = updatingEvent.parameters.find(p => p.type === 'start_time');
          if (!startTimeParam) continue;
          const date = Number(startTimeParam.value);
          if (!map[date]) map[date] = [];
          // Attach parent event id if needed for deletion, etc.
          map[date].push({ ...updatingEvent, parentEventId: event.id });
        }
      }
    }
    return map;
  }, [plan]);

  return (
    <div className="relative w-full h-full">
      <Zoom
        width={width}
        height={height}
        scaleXMin={0.8}
        scaleXMax={100}
        scaleYMin={0.8}
        scaleYMax={100}
        initialTransformMatrix={{
          scaleX: 0.8,
          scaleY: 0.8,
          translateX: 60,
          translateY: 40,
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

          // Calculate global zoom level (average of x and y scale)
          const globalZoom = (zoom.transformMatrix.scaleX + zoom.transformMatrix.scaleY) / 2;

          // Calculate visible date range based on current viewport with padding
          const viewportPadding = width * 0.2; // 20% padding on each side
          const visibleXDomain = [
            xScale.invert((-zoom.transformMatrix.translateX - viewportPadding) / zoom.transformMatrix.scaleX),
            xScale.invert((width - zoom.transformMatrix.translateX + viewportPadding) / zoom.transformMatrix.scaleX)
          ];

          // Filter data points to only those in viewport
          const visibleData = netWorthData.filter(d =>
            d.date >= visibleXDomain[0] && d.date <= visibleXDomain[1]
          );

          // Update time interval based on zoom level
          useEffect(() => {
            const newInterval = getTimeIntervalFromZoom(globalZoom);
            if (newInterval !== timeInterval) {
              setTimeInterval(newInterval);
            }
          }, [globalZoom]);

          // Calculate adjusted sizes based on zoom
          const adjustedLineWidth = baseLineWidth / globalZoom;
          const adjustedTextSize = baseTextSize / globalZoom;
          const adjustedPointRadius = basePointRadius / globalZoom;

          const handleAnnotationDragStart = (e: React.MouseEvent, eventId: number, date: number) => {
            e.stopPropagation();
            const point = getSVGPoint(e);
            setHasDragged(false);
            setDragStartPos({ x: point.x, y: point.y });

            const dataPoint = netWorthData.find(p => p.date === date);
            if (!dataPoint) return;
            const transformedX = (xScale(dataPoint.date) * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
            const transformedY = (yScale(dataPoint.value) * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

            setDraggingAnnotation({
              index: date,
              eventId: eventId,
              offsetX: point.x - transformedX,
              offsetY: point.y - transformedY
            });
          };

          const handleAnnotationDragMove = (e: React.MouseEvent) => {
            if (!draggingAnnotation || !dragStartPos) return;
            
            const point = getSVGPoint(e);
            
            // Check if we've dragged far enough to actually start dragging
            const dragDistance = Math.sqrt(
              Math.pow(point.x - dragStartPos.x, 2) + 
              Math.pow(point.y - dragStartPos.y, 2)
            );
            
            if (dragDistance > 10) {
              setHasDragged(true);
            }
            
            // Only proceed with drag logic if we've moved far enough
            if (!hasDragged && dragDistance < 10) return;

            const dataPoint = screenToData(point.x, point.y, zoom);
            const closestPoint = findClosestPoint(dataPoint.x);
            if (!closestPoint) return;

            // Convert data points to screen coordinates
            const screenX = xScale(closestPoint.date);
            const screenY = yScale(closestPoint.value);
            const transformedX = (screenX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
            const transformedY = (screenY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

            // Calculate distance in screen coordinates
            const distance = Math.sqrt(
              Math.pow(point.x - transformedX, 2) +
              Math.pow(point.y - transformedY, 2)
            );
            
            // Only update if within threshold (adjust 100 as needed)
            if (distance < 100) {
              // Find the event in the plan
              if (plan) {
                // Try main event first
                let event = plan.events.find(e => e.id === draggingAnnotation.eventId);
                if (event) {
                  const startTimeParam = event.parameters.find(p => p.type === 'start_time');
                  if (startTimeParam) {
                    // Update the event's start_time parameter
                    updateParameter(event.id, startTimeParam.id, closestPoint.date);
                  }
                } else {
                  // Try updating event
                  for (const parentEvent of plan.events) {
                    const updatingEvent = parentEvent.updating_events?.find(ue => ue.id === draggingAnnotation.eventId);
                    if (updatingEvent) {
                      const startTimeParam = updatingEvent.parameters.find(p => p.type === 'start_time');
                      if (startTimeParam) {
                        // Update the updating event's start_time parameter directly
                        updateParameter(updatingEvent.id, startTimeParam.id, closestPoint.date);
                      }
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
            const dataPoint = screenToData(point.x, point.y, zoom);
            const closestPoint = findClosestPoint(dataPoint.x);
            const closestIndex = netWorthData.findIndex(p => p.date === closestPoint?.date);

            setDraggingAnnotation(null);
            setClosestPoint(null);
            setDragStartPos(null);
          };

          return (
            <>
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
                    const dataPoint = screenToData(point.x, point.y, zoom);
                    const closest = findClosestPoint(dataPoint.x);
                    setClosestPoint(closest);

                    // Update tooltip position and data
                    if (closest) {
                      const canvasX = xScale(closest.date);
                      const canvasY = yScale(closest.value);
                      const transformedX = (canvasX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
                      const transformedY = (canvasY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

                      setTooltipData(closest);
                      setTooltipLeft(transformedX);
                      setTooltipTop(transformedY);
                    }
                  }

                  if (isDragging) {
                    zoom.dragMove(e);
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
                }}
                onMouseUp={(e) => {
                  if (draggingAnnotation) {
                    handleAnnotationDragEnd(e);
                  }
                  setIsDragging(false);
                  zoom.dragEnd();
                }}
                onWheel={(e) => {
                  const point = localPoint(e) || { x: 0, y: 0 };
                  const scaleFactor = e.deltaY > 0 ? 0.99 : 1.01;

                  // Get the center X position in screen coordinates
                  const centerX = width / 2;
                  //const centerX = point.x;

                  // Convert center X to data coordinates
                  const centerXData = xScale.invert((centerX - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX);

                  // Find the closest point to the center
                  let closestPoint = netWorthData[0];
                  let minDistance = Math.abs(netWorthData[0].date - centerXData);

                  netWorthData.forEach(point => {
                    const distance = Math.abs(point.date - centerXData);
                    if (distance < minDistance) {
                      minDistance = distance;
                      closestPoint = point;
                    }
                  });

                  // Calculate where the point would be after scaling
                  const newScaleX = zoom.transformMatrix.scaleX * scaleFactor;
                  const newScaleY = zoom.transformMatrix.scaleY * scaleFactor;

                  const scaledPointX = xScale(closestPoint.date) * newScaleX;
                  const scaledPointY = yScale(closestPoint.value) * newScaleY;

                  // Calculate translation needed to center the point
                  const translateX = width / 2 - scaledPointX;
                  const translateY = height / 2 - scaledPointY;

                  // Create new transform matrix
                  const newTransform = {
                    ...zoom.transformMatrix,
                    scaleX: newScaleX,
                    scaleY: newScaleY,
                    translateX,
                    translateY,
                  };

                  // Apply the new transform matrix
                  zoom.setTransformMatrix(newTransform);
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
                  {/* Add stacked areas - only show for yearly view */}
                  {timeInterval === 'year' && Object.keys(netWorthData[0]?.parts || {}).map((partKey) => (
                    <AreaClosed
                      key={`area-${partKey}`}
                      data={stackedData}
                      x={(d) => xScale(d.date)}
                      y0={(d) => yScale(d.stackedParts[partKey].y0)}
                      y1={(d) => yScale(d.stackedParts[partKey].y1)}
                      yScale={yScale}
                      stroke="none"
                      fill={envelopeColors[partKey]?.area || '#999'}
                      fillOpacity={0.2}
                      curve={curveLinear}
                    />
                  ))}

                  {/* Add top/bottom lines for each part - only at y1 */}
                  {Object.keys(netWorthData[0]?.parts || {}).map((partKey) => (
                    <LinePath
                      key={`line-${partKey}-edge`}
                      data={stackedData}
                      x={(d) => xScale(d.date)}
                      y={(d) => yScale(d.stackedParts[partKey].y1)}
                      stroke={envelopeColors[partKey]?.line || '#999'}
                      strokeWidth={1 / globalZoom}
                      strokeOpacity={0.5}
                      curve={curveLinear}
                    />
                  ))}

                  {/* Zero line - moved to be on top of areas and lines */}
                  <line
                    x1={0}
                    x2={width}
                    y1={yScale(0)}
                    y2={yScale(0)}
                    stroke="#bbd4dd"
                    strokeWidth={1 / globalZoom}
                    strokeDasharray="4,4"
                    opacity={1}
                  />

                  {/* Current day indicator line - more subtle and full height */}
                  <line
                    x1={xScale(currentDaysSinceBirth)}
                    x2={xScale(currentDaysSinceBirth)}
                    y1={0}
                    y2={height * 2}
                    stroke="#a0aec0" // subtle gray
                    strokeWidth={1 / globalZoom}
                    opacity={0.5}
                  />

                  {/* Total line */}
                  <LinePath
                    data={netWorthData}
                    x={(d) => xScale(d.date)}
                    y={(d) => yScale(d.value)}
                    stroke="#335966"
                    strokeWidth={3 / globalZoom}
                    curve={curveLinear}
                  />

                  {/* Data Points */}
                  {visibleData.map((point, index) => {
                    const canvasX = xScale(point.date);
                    const canvasY = yScale(point.value);
                    return (
                      <circle
                        key={`point-${index}`}
                        cx={canvasX}
                        cy={canvasY}
                        r={adjustedPointRadius}
                        fill="#335966"
                        stroke="#fff"
                        strokeWidth={adjustedLineWidth}
                      />
                    );
                  })}
                </g>

                {/* Timeline Annotations (outside zoom transform) */}
                {Object.entries(eventsByDate).map(([dateStr, eventsAtDate]) => {
                  const date = Number(dateStr);
                  // Find the closest visible data point
                  const visibleDataPoints = netWorthData.filter(p =>
                    p.date >= xScale.domain()[0] && p.date <= xScale.domain()[1]
                  );
                  if (visibleDataPoints.length === 0) return null;
                  // Find the closest data point to this date
                  const closestDataPoint = [...visibleDataPoints]
                    .sort((a, b) => Math.abs(a.date - date) - Math.abs(b.date - date))[0];

                  const canvasX = xScale(closestDataPoint.date);
                  const canvasY = yScale(closestDataPoint.value);
                  const transformedX = (canvasX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
                  const transformedY = (canvasY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

                  return eventsAtDate.map((event, i) => {
                    const isDraggingMain = draggingAnnotation?.eventId === event.id;
                    const yOffset = i * 60; // Increased spacing for better visibility
                    const x = isDraggingMain
                      ? cursorPos!.x - draggingAnnotation!.offsetX - 20
                      : transformedX - 20;
                    const y = isDraggingMain
                      ? cursorPos!.y - draggingAnnotation!.offsetY - 80
                      : transformedY - 80 - yOffset;
                    const isHighlighted = hoveredEventId === event.id;
                    return (
                      <foreignObject
                        key={`annotation-${event.id}`}
                        x={x}
                        y={y}
                        width={40}
                        height={40}
                        style={{
                          overflow: 'visible',
                          cursor: isDraggingMain ? 'grabbing' : 'move'
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleAnnotationDragStart(e, event.id, closestDataPoint.date);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hasDragged) {
                            onAnnotationClick?.(event.id);
                          }
                          setHasDragged(false);
                        }}
                        onMouseEnter={() => setHoveredEventId(event.id)}
                        onMouseLeave={() => setHoveredEventId(null)}
                      >
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div>
                              <TimelineAnnotation
                                icon={getEventIcon(event.type)}
                                label={event.description}
                                highlighted={isHighlighted}
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
                })}

                {/* Updating Event Annotations (outside zoom transform) */}
                {Object.entries(updatingEventsByDate).map(([dateStr, updatingEventsAtDate]) => {
                  const date = Number(dateStr);
                  // Find the closest visible data point
                  const visibleDataPoints = netWorthData.filter(p =>
                    p.date >= xScale.domain()[0] && p.date <= xScale.domain()[1]
                  );
                  if (visibleDataPoints.length === 0) return null;
                  // Find the closest data point to this date
                  const closestDataPoint = [...visibleDataPoints]
                    .sort((a, b) => Math.abs(a.date - date) - Math.abs(b.date - date))[0];

                  const canvasX = xScale(closestDataPoint.date);
                  const canvasY = yScale(closestDataPoint.value);
                  const transformedX = (canvasX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
                  const transformedY = (canvasY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

                  return updatingEventsAtDate.map((updatingEvent, i) => {
                    const isDraggingUpdating = draggingAnnotation?.eventId === updatingEvent.id;
                    const yOffset = i * 60; // Increased spacing for better visibility
                    // Calculate the number of main events at this date to offset properly
                    const mainEventsCount = eventsByDate[dateStr]?.length || 0;
                    const baseYOffset = mainEventsCount * 60;
                    const x = isDraggingUpdating
                      ? cursorPos!.x - draggingAnnotation!.offsetX - 20
                      : transformedX + 30; // Offset to the right of main events
                    const y = isDraggingUpdating
                      ? cursorPos!.y - draggingAnnotation!.offsetY - 80
                      : transformedY - 80 - baseYOffset - yOffset;
                    const isHighlighted = hoveredEventId === updatingEvent.parentEventId;
                    return (
                      <foreignObject
                        key={`updating-annotation-${updatingEvent.id}`}
                        x={x}
                        y={y}
                        width={40}
                        height={40}
                        style={{
                          overflow: 'visible',
                          cursor: isDraggingUpdating ? 'grabbing' : 'move'
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleAnnotationDragStart(e, updatingEvent.id, closestDataPoint.date);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hasDragged) {
                            onAnnotationClick?.(updatingEvent.parentEventId);
                          }
                          setHasDragged(false);
                        }}
                        onMouseEnter={() => setHoveredEventId(updatingEvent.parentEventId)}
                        onMouseLeave={() => setHoveredEventId(null)}
                      >
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div>
                              <TimelineAnnotation
                                icon={getEventIcon(updatingEvent.type)}
                                label={updatingEvent.description}
                                highlighted={isHighlighted}
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
                                  deleteEvent(updatingEvent.id);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Updating Event
                              </Button>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </foreignObject>
                    );
                  });
                })}

                {/* Axes with visible domain */}
                {
                  (() => {
                    const visibleXDomain = [
                      xScale.invert((-zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX),
                      xScale.invert((width - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX)
                    ];
                    const visibleYDomain = [
                      yScale.invert((height - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY),
                      yScale.invert((-zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY)
                    ];

                    const visibleXScale = scaleLinear({
                      domain: visibleXDomain,
                      range: [0, width], // I dont think range this does anything
                    });

                    const visibleYScale = scaleLinear({
                      domain: visibleYDomain,
                      range: [height, 0],
                    });

                    return (
                      <>
                        <AxisLeft
                          scale={visibleYScale}
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
              </svg>

              {/* Add Legend */}
              {netWorthData.length > 0 && (
                <Legend
                  envelopes={Object.keys(netWorthData[0].parts)}
                  colors={envelopeColors}
                  currentValues={closestPoint ? closestPoint.parts : netWorthData[netWorthData.length - 1].parts}
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
                    <div>{formatNumber({ valueOf: () => tooltipData.value })}</div>
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
              {typeof currentDaysSinceBirth === 'number' && (
                <div
                  style={{
                    position: 'absolute',
                    left: (xScale(currentDaysSinceBirth) * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX,
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
                  {formatDate(currentDaysSinceBirth, birthDate, 'full', true, true)}
                </div>
              )}
            </>
          );
        }}
      </Zoom>
    </div>
  );
} 