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
import { usePlan, getEnvelopeCategory } from '../contexts/PlanContext';
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
  getAgeFromDays,
  formatDate,
  daysToDate,
  getIntervalInDays,
  generateEnvelopeColors,
  Legend,
  findClosestPoint,
  getEnvelopeAndCategoryColors,
} from './viz_utils';
import type {
  TimeInterval,
  ExtendedTimeInterval,
  Datum
} from './viz_utils';
import { getAllEventsByDate } from './Events';
import type { Plan } from '../contexts/PlanContext';

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

// --- Type for enhanced data points with category sums ---
type CategoryDatum = Datum & { categorySums: Record<string, number> };

export function Visualization({ onAnnotationClick, onAnnotationDelete }: VisualizationProps) {
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
  const [currentDaysSinceBirth, setCurrentDaysSinceBirth] = useState<number>(0);
  const [hoveredEventId, setHoveredEventId] = useState<number | null>(null);
  const [lastMouse, setLastMouse] = useState<{ x: number, y: number } | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [eventDescriptionTooltip, setEventDescriptionTooltip] = useState<{
    left: number;
    top: number;
    displayType: string;
    description: string;
  } | null>(null);

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

  const { plan, getEventIcon, updateParameter, schema, deleteEvent, getEventDisplayType } = usePlan();

  // Base sizes that will be adjusted by zoom
  const baseLineWidth = 2;
  const baseTextSize = 10;
  const basePointRadius = 4;

  const startDate: number = 0
  const endDate: number = 80 * 365

  // Function to determine time interval based on zoom level
  const getTimeIntervalFromZoom = (zoom: number): TimeInterval => {

    if (zoom >= 250) return 'day';
    if (zoom >= 60) return 'week';
    if (zoom >= 10) return 'month';
    if (zoom >= 5) return 'quarter';
    if (zoom >= 3) return 'half_year';
    return 'year';
  };

  // Load schema and run simulation when component mounts or time interval changes
  useEffect(() => {
    const loadSchemaAndRunSim = async () => {
      // Only run if plan and schema are available (plan is now always loaded by context)
      if (!plan || !schema) return;
      try {
        setIsLoading(true);

        // Set birth date from plan
        if (plan.birth_date) {
          const birthDateObj = new Date(plan.birth_date);
          setBirthDate(birthDateObj);

          // Calculate current days since birth
          const currentDate = new Date();
          const daysSinceBirth = Math.floor(
            (currentDate.getTime() - birthDateObj.getTime()) / (1000 * 60 * 60 * 24)
          );
          setCurrentDaysSinceBirth(daysSinceBirth);
          //console.log('Current days since birth:', daysSinceBirth);
        }

        // Run simulation with plan and schema from context
        const result = await runSimulation(
          plan,
          schema,
          startDate,
          endDate,
          getIntervalInDays(timeInterval),
          currentDaysSinceBirth // pass current day
        );
        //console.log('Loaded Financial Results:', result);
        setNetWorthData(result);
      } catch (err) {
        console.error('Simulation failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSchemaAndRunSim();
  }, [timeInterval, plan, schema]); // Re-run when time interval, plan, or schema changes

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
  const categoryMap = useMemo(() => groupEnvelopesByCategory(plan, envelopeKeys), [plan, envelopeKeys]);
  // Use new color generator
  const { envelopeColors, categoryColors } = useMemo(() => {
    if (!plan || !schema) return { envelopeColors: {}, categoryColors: {} };
    return getEnvelopeAndCategoryColors(
      envelopeKeys.map(name => ({ name, category: getEnvelopeCategory(plan, name) || 'Uncategorized' })),
      Object.keys(categoryMap)
    );
  }, [plan, schema, envelopeKeys, categoryMap]);

  return (
    <div className="relative w-full h-full">
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

          // Get envelope colors from schema
          const envelopeColors = useMemo(() => {
            if (!schema?.categories) return {};
            //console.log('schema.categories: ', schema.categories);
            return generateEnvelopeColors(schema.categories);
          }, [schema]);

          const allEventsByDate = getAllEventsByDate(plan!);

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

          const handleAnnotationDragStart = (e: React.MouseEvent, eventId: number, date: number, annotationYOffset: number, DRAG_Y_OFFSET: number) => {
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
              offsetX: point.x - annotationX,
              offsetY: point.y - annotationY
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
                  const startTimeParam = event.parameters.find(p => p.type === 'start_time');
                  if (startTimeParam) {
                    // Update the event's start_time parameter
                    updateParameter(event.id, startTimeParam.type, closestPoint.date);
                  }
                  // Log event info during drag
                  //console.log('[Drag Move] Dragging event:', event.id, event.description || event.type);
                } else {
                  // Try updating event
                  for (const parentEvent of plan.events) {
                    const updatingEvent = parentEvent.updating_events?.find(ue => ue.id === draggingAnnotation.eventId);
                    if (updatingEvent) {
                      const startTimeParam = updatingEvent.parameters.find(p => p.type === 'start_time');
                      if (startTimeParam) {
                        updateParameter(updatingEvent.id, startTimeParam.type, closestPoint.date);
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
            if (!visibleData.length) return scaleLinear({ domain: [0, 1], range: [height, 0] });
            const allYValues = visibleData.flatMap((d: any) => [
              d.value,
              ...Object.values(d.parts)
            ]);
            const minY = Math.min(...allYValues);
            const adjustedMinY = minY > 0 ? 0 : minY;
            const maxY = Math.max(...allYValues);
            // Add 10% padding to top and bottom
            const yRange = maxY - adjustedMinY || 1;
            const pad = yRange * 0.1;
            const domainMin = adjustedMinY - pad;
            const domainMax = maxY + pad;
            return scaleLinear({
              domain: [domainMin, domainMax],
              range: [height, 0],
            });
          }, [visibleData, height]);

          // Move handleZoomToYears here so it's in scope for the buttons
          const handleZoomToYears = (years: number) => {
            const daysPerYear = 365;
            const xmin = currentDaysSinceBirth - 20 * years - 20; // aproximate padding on side
            const xmax = currentDaysSinceBirth + years * daysPerYear;
            const maxDate = Math.max(...netWorthData.map(d => d.date));
            const clampedXmax = Math.min(xmax, maxDate);
            const regionWidth = clampedXmax - xmin;
            if (regionWidth <= 0) return;
            const scaleX = width / (xScale(clampedXmax) - xScale(xmin));
            const translateX = -xScale(xmin) * scaleX;
            zoom.setTransformMatrix({
              ...zoom.transformMatrix,
              scaleX,
              translateX,
            });
          };

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
                  onClick={() => handleZoomToYears(1)}
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
                  onClick={() => handleZoomToYears(5)}
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
                  onClick={() => handleZoomToYears(10)}
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
                  {/* Add stacked areas */}
                  {Object.keys(netWorthData[0]?.parts || {}).map((partKey) => {
                    const category = getEnvelopeCategory(plan, partKey) || 'Uncategorized';
                    const color = categoryColors[category] || { area: '#ccc', line: '#888' };
                    return (
                      <AreaClosed
                        key={`area-${partKey}`}
                        data={stackedData}
                        x={(d) => xScale(d.date)}
                        y0={(d) => visibleYScale(d.stackedParts[partKey].y0)}
                        y1={(d) => visibleYScale(d.stackedParts[partKey].y1)}
                        yScale={visibleYScale}
                        stroke="none"
                        fill={color.area}
                        fillOpacity={0.2}
                        curve={curveLinear}
                      />
                    );
                  })}

                  {/* Add top/bottom lines for each part */}
                  {[...Object.keys(netWorthData[0]?.parts || {})].reverse().map((partKey) => {
                    const category = getEnvelopeCategory(plan, partKey) || 'Uncategorized';
                    const color = categoryColors[category] || { area: '#ccc', line: '#888' };
                    return (
                      <LinePath
                        key={`line-${partKey}-edge`}
                        data={stackedData}
                        x={(d) => xScale(d.date)}
                        y={(d) => visibleYScale(d.stackedParts[partKey].y1)}
                        stroke={color.line}
                        strokeWidth={1 / globalZoom}
                        strokeOpacity={1}
                        curve={curveLinear}
                      />
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
                    x1={xScale(currentDaysSinceBirth)}
                    x2={xScale(currentDaysSinceBirth)}
                    y1={0}
                    y2={height * 2}
                    stroke="#a0aec0" // subtle gray
                    strokeWidth={1 / globalZoom}
                    opacity={0.5}
                  />
                </g>

                {/* Net Worth Line and Data Circles rendered outside the zoom <g> so their thickness and size are fixed */}
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
                  return (
                    <circle
                      key={`point-${index}`}
                      cx={canvasX}
                      cy={canvasY}
                      r={basePointRadius}
                      fill="#335966"
                      stroke="#fff"
                      strokeWidth={baseLineWidth}
                    />
                  );
                })}

                {/* Timeline Annotations (outside zoom transform) */}
                {(() => {
                  // 1. Build a map: snappedDataPointDate -> [events]
                  const snappedEventsMap: { [snappedDate: number]: Array<{ event: any, originalDate: number }> } = {};
                  for (const [dateStr, eventsAtDate] of Object.entries(allEventsByDate)) {
                    const date = Number(dateStr);
                    // Find the closest visible data point
                    const visibleDataPoints = netWorthData.filter(p =>
                      p.date >= xScale.domain()[0] && p.date <= xScale.domain()[1]
                    );
                    if (visibleDataPoints.length === 0) continue;
                    // Find the closest data point to this date
                    const closestDataPoint = [...visibleDataPoints]
                      .sort((a, b) => Math.abs(a.date - date) - Math.abs(b.date - date))[0];
                    if (!closestDataPoint) continue;
                    // For each event at this date, add to the snapped map
                    for (const event of eventsAtDate) {
                      if (!snappedEventsMap[closestDataPoint.date]) {
                        snappedEventsMap[closestDataPoint.date] = [];
                      }
                      snappedEventsMap[closestDataPoint.date].push({ event: event.event, originalDate: date });
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
                    return events.map(({ event }, i) => {
                      const isDraggingMain = draggingAnnotation?.eventId === event.id;
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
                            handleAnnotationDragStart(e, event.id, closestDataPoint.date, yOffset, DRAG_Y_OFFSET);
                          }}
                          onMouseEnter={() => {
                            setHoveredEventId(event.id);
                            setEventDescriptionTooltip({
                              left: x + 50, // adjust as needed for best placement
                              top: y,
                              displayType: getEventDisplayType(event.type),
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
              </svg>

              {/* Add Legend */}
              {netWorthData.length > 0 && (
                <Legend
                  envelopes={Object.keys(netWorthData[0].parts)}
                  envelopeColors={envelopeColors}
                  currentValues={closestPoint ? closestPoint.parts : netWorthData[netWorthData.length - 1].parts}
                  getCategory={(envelope) => getEnvelopeCategory(plan, envelope)}
                  categoryColors={categoryColors}
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
