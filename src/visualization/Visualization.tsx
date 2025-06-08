import { useMemo, useRef, useState, useEffect } from 'react';
import { Zoom } from '@visx/zoom';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { localPoint } from '@visx/event';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { extent, bisector } from 'd3-array';
import type { FinancialEvent } from '../types/financial-types.ts.ts';
import { runSimulation } from '../hooks/simulationRunner';

interface Datum {
  x: number;
  y: number;
}

export function Visualization() {
  const [isLoading, setIsLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverPos, setHoverPos] = useState<{ svgX: number; svgY: number } | null>(null);
  const [hoverData, setHoverData] = useState<Datum | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<Datum | null>(null);
  const [draggedPoint, setDraggedPoint] = useState<Datum | null>(null);
  const [simulationData, setSimulationData] = useState<Datum[]>([]);

  // Run simulation when component mounts
  useEffect(() => {
    const runSim = async () => {
      try {
        setIsLoading(true);
        const result = await runSimulation(
          '/assets/plan.json',
          '/assets/event_schema.json'
        );
        console.log('Loaded Financial Results:', result);
        setSimulationData(result?.["Cash"] ?? []);
      } catch (err) {
        console.error('Simulation failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    runSim();
  }, []);

  // Don't render visualization until data is loaded
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-DEFAULT">
        <div className="text-background-900">Loading simulation data...</div>
      </div>
    );
  }

  if (!simulationData.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-DEFAULT">
        <div className="text-background-900">Failed to load simulation data</div>
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

  // Format number with k/M suffix and dollar sign
  const formatNumber = (value: { valueOf(): number }): string => {
    const num = value.valueOf();
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}k`;
    }
    return `$${num.toFixed(0)}`;
  };

  // Format time (days to years/months/days)
  const formatTime = (value: { valueOf(): number }): string => {
    const days = value.valueOf();
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    const months = Math.floor(remainingDays / 30);
    const finalDays = remainingDays % 30;

    const parts = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}m`);
    if (finalDays > 0 || parts.length === 0) parts.push(`${finalDays}d`);
    return parts.join(' ');
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
              style={{ cursor: 'crosshair' }}
              onMouseMove={(e) => {
                if (draggedPoint) {
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
                }
              }}
              onMouseLeave={() => {
                setHoverData(null);
                setHoverPos(null);
                setHoveredPoint(null);
                setDraggedPoint(null);
              }}
              onWheel={(e) => {
                const point = localPoint(e) || { x: 0, y: 0 };
                e.preventDefault();

                const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;

                zoom.scale({
                  scaleX: scaleFactor,
                  scaleY: scaleFactor,
                });
              }}
              onMouseDown={(e) => {
                zoom.dragStart(e);
              }}
              onMouseMoveCapture={(e) => {
                zoom.dragMove(e);
              }}
              onMouseUp={(e) => {
                zoom.dragEnd(e);
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