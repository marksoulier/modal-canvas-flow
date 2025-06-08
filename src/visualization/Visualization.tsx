import { useMemo, useRef, useState, useEffect } from 'react';
import { Zoom } from '@visx/zoom';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { localPoint } from '@visx/event';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { extent, bisector } from 'd3-array';
import { useFinancialSimulation } from '../hooks/useFinancialSimulator';
import { useFinancialProblem, loadFinancialProblemFromFile } from '../hooks/useFinancialProblem';
import type { FinancialProblem, FinancialEvent } from '../types/financial-types.ts.ts';

interface Datum {
  x: number;
  y: number;
}

export function Visualization() {
  const [isLoading, setIsLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverPos, setHoverPos] = useState<{ svgX: number; svgY: number } | null>(null);
  const [hoverData, setHoverData] = useState<Datum | null>(null);
  const [hoverEvent, setHoverEvent] = useState<FinancialEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FinancialEvent | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [initialData, setInitialData] = useState<FinancialProblem | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<Datum | null>(null);
  const [draggedPoint, setDraggedPoint] = useState<Datum | null>(null);

  // Use the financial problem hook with initial data
  const {
    financialProblem,
    updateEventTime,
    updateEventAmount,
    updateEventRate
  } = useFinancialProblem(initialData);

  // Load financial problem only once when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await loadFinancialProblemFromFile('/modal-canvas-flow/assets/financialproblem.json');
        console.log('Loaded Financial Problem:', data);
        setInitialData(data);
      } catch (error) {
        console.error('Error loading financial problem:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []); // Empty dependency array means this only runs once on mount

  // Get simulation data only when financial problem is loaded
  const { simulationData } = useFinancialSimulation(
    financialProblem || {
      envelopes: [],
      functions: [],
      events: []
    }, 60
  );

  // Don't render visualization until data is loaded
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-DEFAULT">
        <div className="text-background-900">Loading financial problem...</div>
      </div>
    );
  }

  if (!financialProblem) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-DEFAULT">
        <div className="text-background-900">Failed to load financial problem</div>
      </div>
    );
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  const xExtent = extent(simulationData, (d: Datum) => d.x) as [number, number];
  const yExtent = extent(simulationData, (d: Datum) => d.y) as [number, number];

  const xScale = scaleLinear({
    domain: xExtent,
    range: [0, width],
  });

  const yScale = scaleLinear({
    domain: yExtent,
    range: [height, 0],
  });

  const bisectX = bisector((d: Datum) => d.x).left;

  // Get time parameter from event
  const getEventTime = (event: FinancialEvent): number => {
    const timeParam = event.parameters.find(p => p.type === 'time');
    return timeParam ? Number(timeParam.value) : 0;
  };

  // Sort events by time
  const sortedEvents = [...financialProblem.events].sort((a, b) => getEventTime(a) - getEventTime(b));

  // Handle event drag start
  const handleEventDragStart = (event: FinancialEvent, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling to canvas
    setSelectedEvent(event);
    setIsDragging(true);
  };

  // Handle event drag
  const handleEventDrag = (e: React.MouseEvent, zoom: any) => {
    if (!selectedEvent || !isDragging) return;
    e.stopPropagation();

    const point = localPoint(e) || { x: 0, y: 0 };
    const transformedX = (point.x - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX;
    const newTime = Math.round(xScale.invert(transformedX - 60)); // Account for left padding

    // Update the event time
    updateEventTime(selectedEvent.id, newTime);
  };

  // Handle event drag end
  const handleEventDragEnd = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent event from bubbling to canvas
    }
    setIsDragging(false);
    setSelectedEvent(null);
  };

  // Format number with k/M suffix and dollar sign
  const formatNumber = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

  // Format time (months to years/months)
  const formatTime = (months: number): string => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years > 0) {
      return `${years}y${remainingMonths > 0 ? ` ${remainingMonths}m` : ''}`;
    }
    return `${months}m`;
  };

  return (
    <div className="relative w-full h-full">
      <Zoom
        width={width}
        height={height}
        scaleXMin={0.5}
        scaleXMax={10}
        scaleYMin={0.5}
        scaleYMax={10}
        initialTransformMatrix={{
          scaleX: 1,
          scaleY: 1,
          translateX: 0,
          translateY: 0,
          skewX: 0,
          skewY: 0,
        }}
      >
        {(zoom: any) => {
          // Calculate visible domain based on current zoom and padding
          const visibleXDomain = [
            xScale.invert((-zoom.transformMatrix.translateX - 60) / zoom.transformMatrix.scaleX),
            xScale.invert((width - zoom.transformMatrix.translateX - 60) / zoom.transformMatrix.scaleX)
          ];
          const visibleYDomain = [
            yScale.invert((height - zoom.transformMatrix.translateY - 20) / zoom.transformMatrix.scaleY),
            yScale.invert((-zoom.transformMatrix.translateY - 20) / zoom.transformMatrix.scaleY)
          ];

          // Create scales for the visible axes
          const visibleXScale = scaleLinear({
            domain: visibleXDomain,
            range: [60, width - 20],
          });

          const visibleYScale = scaleLinear({
            domain: visibleYDomain,
            range: [height - 40, 20],
          });

          return (
            <svg
              ref={svgRef}
              width={width}
              height={height}
              style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
              onMouseMove={(e) => {
                if (isDragging) {
                  handleEventDrag(e, zoom);
                } else if (draggedPoint) {
                  const point = localPoint(e) || { x: 0, y: 0 };
                  const transformedX = (point.x - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX;
                  const transformedY = (point.y - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY;
                  const xValue = xScale.invert(transformedX - 60);
                  const yValue = yScale.invert(transformedY);

                  // Update the dragged point's position
                  const updatedPoint = { ...draggedPoint, x: xValue, y: yValue };
                  setDraggedPoint(updatedPoint);
                } else {
                  const point = localPoint(e) || { x: 0, y: 0 };
                  const transformedX = (point.x - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX;
                  const transformedY = (point.y - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY;
                  const xValue = xScale.invert(transformedX - 60);
                  const index = bisectX(simulationData, xValue);
                  const d0 = simulationData[index - 1];
                  const d1 = simulationData[index];
                  let d = d0;
                  if (d1 && Math.abs(d1.x - xValue) < Math.abs(d0.x - xValue)) {
                    d = d1;
                  }
                  setHoverData(d);
                  setHoverPos({
                    svgX: xScale(d.x) + 60,
                    svgY: yScale(d.y)
                  });

                  // Check if mouse is near any event
                  const event = sortedEvents.find(event => {
                    const eventX = xScale(getEventTime(event)) + 60;
                    return Math.abs(eventX - transformedX) < 10;
                  });
                  setHoverEvent(event || null);
                }
              }}
              onMouseLeave={() => {
                setHoverData(null);
                setHoverPos(null);
                setHoverEvent(null);
                handleEventDragEnd();
              }}
              onWheel={(e) => {
                if (isDragging) return; // Prevent zooming while dragging
                const point = localPoint(e) || { x: 0, y: 0 };
                e.preventDefault();

                const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;

                zoom.scale({
                  scaleX: scaleFactor,
                  scaleY: scaleFactor,
                });
              }}
              onMouseDown={(e) => {
                if (!isDragging) {
                  zoom.dragStart(e);
                }
              }}
              onMouseMoveCapture={(e) => {
                if (!isDragging) {
                  zoom.dragMove(e);
                }
              }}
              onMouseUp={(e) => {
                if (!isDragging) {
                  zoom.dragEnd(e);
                }
                handleEventDragEnd(e);
                setDraggedPoint(null);
              }}
            >
              <rect width={width} height={height} fill="#f7fafb" />

              {/* Main content with zoom transform */}
              <g transform={zoom.toString()}>
                <g transform="translate(60, 20)">
                  {/* Zero Line */}
                  <line
                    x1={0}
                    x2={width - 80}
                    y1={yScale(0)}
                    y2={yScale(0)}
                    stroke="#bbd4dd"
                    strokeWidth={1}
                    strokeDasharray="4,2"
                  />

                  {/* Net Worth Line */}
                  <LinePath
                    data={simulationData}
                    x={(d: Datum) => xScale(d.x)}
                    y={(d: Datum) => yScale(d.y)}
                    stroke="#03c6fc"
                    strokeWidth={2}
                  />

                  {/* Data Points */}
                  {simulationData.map((point, index) => {
                    const isHovered = hoveredPoint === point;
                    const isDragged = draggedPoint === point;
                    const radius = isHovered || isDragged ? 6 : 4;

                    return (
                      <g
                        key={`point-${index}`}
                        onMouseEnter={() => setHoveredPoint(point)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggedPoint(point);
                        }}
                        style={{ cursor: 'grab' }}
                      >
                        <circle
                          cx={xScale(point.x)}
                          cy={yScale(point.y)}
                          r={radius}
                          fill="#03c6fc"
                          stroke="#fff"
                          strokeWidth={1}
                          opacity={isHovered || isDragged ? 1 : 0.6}
                        />
                        {isHovered && !isDragged && (
                          <text
                            x={xScale(point.x) + 10}
                            y={yScale(point.y) - 10}
                            fill="#335966"
                            fontSize={12}
                          >
                            {formatTime(point.x)}, {formatNumber(point.y)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Event Markers */}
                  {sortedEvents.map((event, index) => {
                    const eventTime = getEventTime(event);
                    const x = xScale(eventTime);
                    const y = yScale(simulationData.find(d => d.x >= eventTime)?.y || 0) - 20;

                    return (
                      <g
                        key={`${event.type}-${index}`}
                        onMouseDown={(e) => handleEventDragStart(event, e)}
                        style={{ cursor: 'grab' }}
                      >
                        <line
                          x1={x}
                          x2={x}
                          y1={y}
                          y2={y + 15}
                          stroke="#f99207"
                          strokeWidth={2}
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r={5}
                          fill="#f99207"
                          stroke="#fff"
                          strokeWidth={1}
                        />
                        {hoverEvent === event && (
                          <text
                            x={x + 10}
                            y={y - 10}
                            fill="#f99207"
                            fontSize={12}
                          >
                            {event.type}: {event.parameters.map(p => `${p.type}=${p.value}`).join(', ')}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Hover Effects */}
                  {hoverPos && hoverData && (
                    <>
                      <line
                        x1={hoverPos.svgX - 60}
                        x2={hoverPos.svgX - 60}
                        y1={0}
                        y2={height - 40}
                        stroke="#f99207"
                        strokeWidth={1}
                        strokeDasharray="4,2"
                      />

                      <circle
                        cx={hoverPos.svgX - 60}
                        cy={hoverPos.svgY}
                        r={5}
                        fill="#f99207"
                        stroke="#fff"
                        strokeWidth={1}
                      />

                      <text
                        x={hoverPos.svgX - 50}
                        y={hoverPos.svgY - 10}
                        fill="#f99207"
                        fontSize={12}
                      >
                        {formatTime(hoverData.x)}, {formatNumber(hoverData.y)}
                      </text>
                    </>
                  )}
                </g>
              </g>

              {/* Overlay axes (not affected by zoom) */}
              <g>
                {/* Y Axis */}
                <AxisLeft
                  scale={visibleYScale}
                  tickFormat={formatNumber}
                  stroke="#bbd4dd"
                  tickStroke="#bbd4dd"
                  tickLabelProps={() => ({
                    fill: '#335966',
                    fontSize: 12,
                    textAnchor: 'end',
                    dy: '0.33em',
                  })}
                  left={60}
                />

                {/* X Axis */}
                <AxisBottom
                  top={height - 40}
                  scale={visibleXScale}
                  tickFormat={formatTime}
                  stroke="#bbd4dd"
                  tickStroke="#bbd4dd"
                  tickLabelProps={() => ({
                    fill: '#335966',
                    fontSize: 12,
                    textAnchor: 'middle',
                    dy: '0.33em',
                  })}
                  left={60}
                />
              </g>
            </svg>
          );
        }}
      </Zoom>
    </div>
  );
} 