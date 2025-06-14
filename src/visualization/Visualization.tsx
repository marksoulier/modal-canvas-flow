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

// Time interval type for controlling the visualization granularity
type TimeInterval = 'day' | 'week' | 'month' | 'year';

// Utility functions
const formatNumber = (value: { valueOf(): number }): string => {
  const num = value.valueOf();
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(0)}k`;
  }
  return `$${num.toFixed(0)}`;
};

// Format date based on time interval
const formatDate = (daysSinceBirth: number, birthDate: Date, interval: TimeInterval): string => {
  const date = daysToDate(daysSinceBirth, birthDate);

  switch (interval) {
    case 'year':
      return date.getFullYear().toString();
    case 'month':
      // Only show year on January
      if (date.getMonth() === 0) {
        return `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      }
      return date.toLocaleString('default', { month: 'short' });
    case 'week':
    case 'day':
      return date.toLocaleString('default', {
        day: 'numeric',
        month: 'short'
      });
    default:
      return date.toLocaleDateString();
  }
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

interface StackedDatum extends Datum {
  stackedParts: { [key: string]: number };
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
}

// Colors for each part
const partColors: Record<string, string> = {
  envelope1: '#03c6fc',
  envelope2: '#75daad',
  envelope3: '#ff9f1c'
};

export function Visualization({ onAnnotationClick }: VisualizationProps) {
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
  const [simulationData, setSimulationData] = useState<Datum[]>([]);
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('year');
  const [birthDate, setBirthDate] = useState<Date>(new Date(2000, 0, 1)); // Default to Jan 1, 2000
  const [currentDaysSinceBirth, setCurrentDaysSinceBirth] = useState<number>(0);
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

  const { plan, loadDefaultPlan, getEventIcon, updateParameter, schema } = usePlan();

  // Base sizes that will be adjusted by zoom
  const baseLineWidth = 2;
  const baseTextSize = 10;
  const basePointRadius = 4;

  const startDate: number = 0
  const endDate: number = 30 * 365

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
        setSimulationData(result?.["Cash"] ?? []);
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
    if (!simulationData.length) return [];

    // Get all unique part keys from the data
    const partKeys = Array.from(
      new Set(simulationData.flatMap(d => Object.keys(d.parts)))
    );

    // Create stacked data
    return simulationData.map(d => {
      const stackedParts: { [key: string]: number } = {};
      let currentSum = 0;

      partKeys.forEach(key => {
        currentSum += d.parts[key] || 0;
        stackedParts[key] = currentSum;
      });

      return {
        ...d,
        stackedParts
      };
    });
  }, [simulationData]);

  const screenToData = (screenX: number, screenY: number, zoom: any) => {
    const x = (screenX - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX;
    const y = (screenY - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY;
    return {
      x: xScale.invert(x),
      y: yScale.invert(y)
    };
  };

  const findClosestPoint = (dataX: number): Datum | null => {
    if (!simulationData.length) return null;
    return simulationData.reduce((closest, point) => {
      const distance = Math.abs(point.date - dataX);
      const closestDistance = Math.abs(closest.date - dataX);
      return distance < closestDistance ? point : closest;
    });
  };

  // Calculate scales based on simulation data
  const xScale = useMemo(() => {
    if (!simulationData.length) return scaleLinear({ domain: [0, 1], range: [0, width] });

    const maxDate = Math.max(...simulationData.map(d => d.date));
    return scaleLinear({
      domain: [0, maxDate],
      range: [0, width],
    });
  }, [simulationData, width]);

  const yScale = useMemo(() => {
    if (!simulationData.length) return scaleLinear({ domain: [0, 1], range: [height, 0] });

    const maxValue = Math.max(...simulationData.map(d => {
      const totalValue = Object.values(d.parts).reduce((sum, val) => sum + val, 0);
      return Math.max(d.value, totalValue);
    }));

    return scaleLinear({
      domain: [0, maxValue],
      range: [height, 0],
    });
  }, [simulationData, height]);

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
          const visibleData = simulationData.filter(d =>
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

            const dataPoint = simulationData.find(p => p.date === date);
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
            console.log("dsircance: ", distance)

            // Only update if within threshold (adjust 0.5 as needed)
            if (distance < 150) {
              // Find the event in the plan
              if (plan) {
                const event = plan.events.find(e => e.id === draggingAnnotation.eventId);
                if (event) {
                  const startTimeParam = event.parameters.find(p => p.type === 'start_time');
                  if (startTimeParam) {
                    // Update the event's start_time parameter
                    updateParameter(event.id, startTimeParam.id, closestPoint.date);
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
            const closestIndex = simulationData.findIndex(p => p.date === closestPoint?.date);

            setDraggingAnnotation(null);
            setClosestPoint(null);
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
                  let closestPoint = simulationData[0];
                  let minDistance = Math.abs(simulationData[0].date - centerXData);

                  simulationData.forEach(point => {
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
                  {/* Zero line */}
                  <line
                    x1={0}
                    x2={width}
                    y1={yScale(0)}
                    y2={yScale(0)}
                    stroke="#bbd4dd"
                    strokeWidth={1 / globalZoom}
                    strokeDasharray="4,4"
                    opacity={0.8}
                  />

                  {/* Current day indicator line */}
                  <line
                    x1={xScale(currentDaysSinceBirth)}
                    x2={xScale(currentDaysSinceBirth)}
                    y1={0}
                    y2={height}
                    stroke="#ff0000"
                    strokeWidth={2 / globalZoom}
                    strokeDasharray="4,4"
                    opacity={0.8}
                  />

                  {/* Add stacked areas */}
                  {Object.keys(simulationData[0]?.parts || {}).map((partKey, index, keys) => (
                    <AreaClosed
                      key={`area-${partKey}`}
                      data={visibleData}
                      x={(d: StackedDatum) => xScale(d.date)}
                      y0={(d: StackedDatum) => {
                        const prevValue = index === 0 ? 0 : d.stackedParts[keys[index - 1]];
                        return yScale(prevValue);
                      }}
                      y1={(d: StackedDatum) => yScale(d.stackedParts[partKey])}
                      yScale={yScale}
                      strokeWidth={1}
                      stroke={partColors[partKey]}
                      fill={partColors[partKey]}
                      fillOpacity={0.2}
                      curve={curveLinear}
                    />
                  ))}

                  {/* Add lines for each part */}
                  {Object.keys(simulationData[0]?.parts || {}).map((partKey) => (
                    <LinePath
                      key={`line-${partKey}`}
                      data={visibleData}
                      x={(d: StackedDatum) => xScale(d.date)}
                      y={(d: StackedDatum) => yScale(d.stackedParts[partKey])}
                      stroke={partColors[partKey]}
                      strokeWidth={1 / globalZoom}
                      strokeOpacity={0.5}
                      curve={curveLinear}
                    />
                  ))}

                  {/* Total line */}
                  <LinePath
                    data={visibleData}
                    x={(d: StackedDatum) => xScale(d.date)}
                    y={(d: StackedDatum) => yScale(d.value)}
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
                {plan && plan.events.map((event) => {
                  // Find the start_time parameter
                  const startTimeParam = event.parameters.find(p => p.type === 'start_time');
                  if (!startTimeParam) return null;
                  const date = Number(startTimeParam.value);
                  if (isNaN(date)) return null;

                  // Find the closest visible data point
                  const visibleDataPoints = simulationData.filter(p =>
                    p.date >= xScale.domain()[0] && p.date <= xScale.domain()[1]
                  );
                  if (visibleDataPoints.length === 0) return null;

                  // Find the closest data point to this event's date
                  const closestDataPoint = [...visibleDataPoints]
                    .sort((a, b) => Math.abs(a.date - date) - Math.abs(b.date - date))[0];

                  const canvasX = xScale(closestDataPoint.date);
                  const canvasY = yScale(closestDataPoint.value);
                  const transformedX = (canvasX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
                  const transformedY = (canvasY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

                  // If this annotation is being dragged, use cursor position
                  const isDragging = draggingAnnotation?.eventId === event.id;
                  const x = isDragging
                    ? cursorPos!.x - draggingAnnotation!.offsetX - 20
                    : transformedX - 20;
                  const y = isDragging
                    ? cursorPos!.y - draggingAnnotation!.offsetY - 80
                    : transformedY - 80;

                  return (
                    <foreignObject
                      key={`annotation-${event.id}`}
                      x={x}
                      y={y}
                      width={40}
                      height={40}
                      style={{
                        overflow: 'visible',
                        cursor: 'move'
                      }}
                      onMouseDown={(e) => {
                        // Start drag operation
                        handleAnnotationDragStart(e, event.id, closestDataPoint.date);
                      }}
                      onClick={(e) => {
                        // Only trigger click if we haven't dragged
                        if (!hasDragged) {
                          e.stopPropagation();
                          onAnnotationClick?.(event.id);
                        }
                        setHasDragged(false);
                      }}
                    >
                      <div>
                        <TimelineAnnotation icon={getEventIcon(event.icon)} label={event.description} />
                      </div>
                    </foreignObject>
                  );
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
                          tickFormat={(value) => formatDate(value.valueOf(), birthDate, timeInterval)}
                          tickLabelProps={() => ({
                            fill: '#335966',
                            fontSize: 12,
                            textAnchor: 'middle',
                            dy: '0.33em',
                          })}
                          left={0}
                        />
                      </>
                    );
                  })()
                }
              </svg>

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
                    <div>Total: {formatNumber({ valueOf: () => tooltipData.value })}</div>
                    {Object.entries(tooltipData.parts).map(([key, value]) => (
                      <div key={key} style={{ color: partColors[key] }}>
                        {key}: {formatNumber({ valueOf: () => value })}
                      </div>
                    ))}
                  </div>
                </TooltipWithBounds>
              )}
            </>
          );
        }}
      </Zoom>
    </div>
  );
} 