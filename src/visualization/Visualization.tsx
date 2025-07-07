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
import {
  formatNumber,
  getAgeFromDays,
  formatDate,
  daysToDate,
  getIntervalInDays,
  generateEnvelopeColors,
  Legend,
  findClosestPoint,
} from './viz_utils';
import type {
  TimeInterval,
  ExtendedTimeInterval,
  Datum
} from './viz_utils';
import { getAllEventsByDate } from './Events';

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
      console.log('Constraint: max out of bounds', max);
      return prevTransformMatrix;
    } else if (min.x > 0 + xPad) {
      console.log('Constraint: min out of bounds', min);
      return prevTransformMatrix;
    }
    return transformMatrix;
  }

  return (
    <div className="relative w-full h-full">
      <Zoom
        width={width}
        height={height}
        scaleXMin={1.0}
        scaleXMax={100}
        scaleYMin={1.0}
        scaleYMax={100}
        initialTransformMatrix={{
          scaleX: 1.0,
          scaleY: 1.0,
          translateX: 0,
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

          // Calculate adjusted sizes based on scaleX only
          const adjustedLineWidth = baseLineWidth / globalZoom;
          const adjustedPointRadius = basePointRadius / globalZoom;

          // Get envelope colors from schema
          const envelopeColors = useMemo(() => {
            if (!schema?.envelopes) return {};
            return generateEnvelopeColors(schema.envelopes);
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
              console.log('Constraint: max out of bounds', max);
              return prevTransformMatrix;
            } else if (min.x > 0 + xPad) {
              console.log('Constraint: min out of bounds', min);
              return prevTransformMatrix;
            }
            return transformMatrix;
          }

          const handleAnnotationDragStart = (e: React.MouseEvent, eventId: number, date: number) => {
            e.stopPropagation();
            const point = getSVGPoint(e);
            setHasDragged(false);

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
            if (!draggingAnnotation) return;
            setHasDragged(true);

            const point = getSVGPoint(e);
            const dataPoint = screenToData(point.x, point.y, zoom);
            const closestPoint = findClosestPoint(netWorthData, dataPoint.x);
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
            console.log("distance: ", distance)

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
                    updateParameter(event.id, startTimeParam.id, closestPoint.date);
                  }
                } else {
                  // Try updating event
                  for (const parentEvent of plan.events) {
                    const updatingEvent = parentEvent.updating_events?.find(ue => ue.id === draggingAnnotation.eventId);
                    if (updatingEvent) {
                      const startTimeParam = updatingEvent.parameters.find(p => p.type === 'start_time');
                      if (startTimeParam) {
                        updateParameter(parentEvent.id, startTimeParam.id, closestPoint.date);
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
            const maxY = Math.max(...allYValues);
            const domainMin = minY === maxY ? minY - 1 : minY;
            const domainMax = minY === maxY ? maxY + 1 : maxY;
            return scaleLinear({
              domain: [domainMin, domainMax],
              range: [height, 0],
            });
          }, [visibleData, height]);

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
                  const scaleFactor = e.deltaY > 0 ? 0.99 : 1.01;

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
                  {/* Add stacked areas - only show for yearly view */}
                  {timeInterval === 'year' && Object.keys(netWorthData[0]?.parts || {}).map((partKey) => (
                    <AreaClosed
                      key={`area-${partKey}`}
                      data={stackedData}
                      x={(d) => xScale(d.date)}
                      y0={(d) => visibleYScale(d.stackedParts[partKey].y0)}
                      y1={(d) => visibleYScale(d.stackedParts[partKey].y1)}
                      yScale={visibleYScale}
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
                      y={(d) => visibleYScale(d.stackedParts[partKey].y1)}
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
                    y1={visibleYScale(0)}
                    y2={visibleYScale(0)}
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
                    y={(d) => visibleYScale(d.value)}
                    stroke="#335966"
                    strokeWidth={3 / globalZoom}
                    curve={curveLinear}
                  />

                  {/* Data Points */}
                  {visibleData.map((point, index) => {
                    const canvasX = xScale(point.date);
                    const canvasY = visibleYScale(point.value);
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
                {Object.entries(allEventsByDate).map(([dateStr, eventsAtDate]) => {
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
                  const canvasY = visibleYScale(closestDataPoint.value);
                  const transformedX = (canvasX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
                  const transformedY = (canvasY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

                  return eventsAtDate.map((event, i) => {
                    const isDraggingMain = draggingAnnotation?.eventId === event.event.id;
                    const yOffset = i * 50;
                    const x = isDraggingMain
                      ? cursorPos!.x - draggingAnnotation!.offsetX - 20
                      : transformedX - 20;
                    const y = isDraggingMain
                      ? cursorPos!.y - draggingAnnotation!.offsetY - 80
                      : transformedY - 80 - yOffset;
                    const isHighlighted = hoveredEventId === event.event.id;
                    return (
                      <foreignObject
                        key={`annotation-${event.event.id}`}
                        x={x}
                        y={y}
                        width={40}
                        height={40}
                        style={{
                          overflow: 'visible',
                          cursor: isDraggingMain ? 'grabbing' : 'move'
                        }}
                        onMouseDown={(e) => {
                          handleAnnotationDragStart(e, event.event.id, closestDataPoint.date);
                        }}
                        onMouseEnter={() => setHoveredEventId(event.event.id)}
                        onMouseLeave={() => setHoveredEventId(null)}
                      >
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div>
                              <TimelineAnnotation
                                icon={getEventIcon(event.event.type)}
                                label={event.event.description}
                                highlighted={isHighlighted}
                                onClick={() => {
                                  if (!hasDragged) {
                                    onAnnotationClick?.(event.event.id);
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
                                  deleteEvent(event.event.id);
                                  onAnnotationDelete?.(event.event.id);
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