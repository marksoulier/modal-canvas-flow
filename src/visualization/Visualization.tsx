import { useRef, useState, useEffect } from 'react';
import { Zoom } from '@visx/zoom';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { CornerDownLeft } from 'lucide-react';
import { localPoint } from '@visx/event';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { extent, bisector } from 'd3-array';
import { runSimulation } from '../hooks/simulationRunner';


interface Datum {
  x: number;
  y: number;
}

interface EventAnnotation {
  x: number;
  y: number;
  label: string;
  weight: number;
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

// Utility functions
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

const getPointInterval = (currentScale: number): number => {
  if (currentScale >= 5) return 1; // Show every point
  if (currentScale >= 2) return 7; // Show weekly
  return 365; // Show yearly
};

const formatTimeByScale = (value: { valueOf(): number }, currentScale: number): string => {
  const days = value.valueOf();
  if (currentScale >= 5) {
    return `${days}d`;
  } else if (currentScale >= 2) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return `${months}m ${remainingDays}d`;
  } else {
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    const months = Math.floor(remainingDays / 30);
    return `${years}y ${months}m`;
  }
};

export function Visualization() {
  const [isLoading, setIsLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverPos, setHoverPos] = useState<{ svgX: number; svgY: number } | null>(null);
  const [hoverData, setHoverData] = useState<Datum | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<Datum | null>(null);
  const [draggedPoint, setDraggedPoint] = useState<Datum | null>(null);
  const [simulationData, setSimulationData] = useState<Datum[]>([]);
  const [currentScale, setCurrentScale] = useState(1);
  const [eventAnnotations, setEventAnnotations] = useState<EventAnnotation[]>([]);


  // Prevent browser zoom
  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', preventZoom, { passive: false });
    return () => window.removeEventListener('wheel', preventZoom);
  }, []);

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

  if (isLoading || !simulationData.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-DEFAULT">
        <div className="text-background-900">
          {isLoading ? 'Loading simulation data...' : 'Failed to load simulation data'}
        </div>
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

  // Constrain drag area
  const maxDragX = width * 2;
  const maxDragY = height * 2;

  return (
    <div className="relative w-full h-full">
      <Zoom
        width={width}
        height={height}
        scaleXMin={1}
        scaleXMax={100}
        scaleYMin={1}
        scaleYMax={100}
        initialTransformMatrix={{
          scaleX: 1,
          scaleY: 1,
          translateX: 0,
          translateY: 0,
          skewX: 0,
          skewY: 0,
        }}
      >
        {(zoom: ZoomObject) => {
          // Update current scale when zoom changes
          setCurrentScale(zoom.transformMatrix.scaleX);

          // Calculate visible domain based on current zoom and padding
          const visibleXDomain = [
            xScale.invert((-zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX),
            xScale.invert((width - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX)
          ];
          const visibleYDomain = [
            yScale.invert((height - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY),
            yScale.invert((-zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY)
          ];

          // Constrain translation
          const constrainedTranslateX = Math.max(-maxDragX, Math.min(maxDragX, zoom.transformMatrix.translateX));
          const constrainedTranslateY = Math.max(-maxDragY, Math.min(maxDragY, zoom.transformMatrix.translateY));

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
              style={{ cursor: 'point' }}
              onMouseMove={(e) => {
                if (draggedPoint) {
                  const point = localPoint(e) || { x: 0, y: 0 };
                  const transformedX = (point.x - constrainedTranslateX) / zoom.transformMatrix.scaleX;
                  const transformedY = (point.y - constrainedTranslateY) / zoom.transformMatrix.scaleY;
                  const xValue = xScale.invert(transformedX);
                  const yValue = yScale.invert(transformedY);

                  // Update the dragged point's position
                  const updatedPoint = { ...draggedPoint, x: xValue, y: yValue };
                  setDraggedPoint(updatedPoint);
                } else {
                  const point = localPoint(e) || { x: 0, y: 0 };
                  const transformedX = (point.x - constrainedTranslateX) / zoom.transformMatrix.scaleX;
                  const transformedY = (point.y - constrainedTranslateY) / zoom.transformMatrix.scaleY;
                  const xValue = xScale.invert(transformedX);
                  const index = bisectX(simulationData, xValue);
                  const d0 = simulationData[index - 1];
                  const d1 = simulationData[index];
                  let d = d0;
                  if (d1 && Math.abs(d1.x - xValue) < Math.abs(d0.x - xValue)) {
                    d = d1;
                  }
                  setHoverData(d);
                  setHoverPos({
                    svgX: xScale(d.x),
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
                const scaleFactor = e.deltaY > 0 ? 0.99 : 1.01;

                // Get the center X position in screen coordinates
                const centerX = width / 2;

                // Convert center X to data coordinates
                const centerXData = xScale.invert((centerX - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX);

                // Find the closest point to the center
                let closestPoint = simulationData[0];
                let minDistance = Math.abs(simulationData[0].x - centerXData);

                simulationData.forEach(point => {
                  const distance = Math.abs(point.x - centerXData);
                  if (distance < minDistance) {
                    minDistance = distance;
                    closestPoint = point;
                  }
                });

                // Calculate where the point would be after scaling
                const newScaleX = zoom.transformMatrix.scaleX * scaleFactor;
                const newScaleY = zoom.transformMatrix.scaleY * scaleFactor;

                const scaledPointX = xScale(closestPoint.x) * newScaleX;
                const scaledPointY = yScale(closestPoint.y) * newScaleY;

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
              <g transform={`translate(${constrainedTranslateX},${constrainedTranslateY}) scale(${zoom.transformMatrix.scaleX},${zoom.transformMatrix.scaleY})`}>
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

                  {/* Data Points with interval */}
                  {simulationData.map((point, index) => {
                    const interval = getPointInterval(currentScale);
                    if (index % interval !== 0) return null;

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
                      </g>
                    );
                  })}
                </g>
              </g>

              {/* Non-zoomed elements (will maintain size) */}
              <g>
                {/* Hover Effects */}
                {hoverPos && hoverData && (
                  <>
                    <line
                      x1={hoverPos.svgX}
                      x2={hoverPos.svgX}
                      y1={0}
                      y2={height - 40}
                      stroke="#f99207"
                      strokeWidth={1}
                      strokeDasharray="4,2"
                    />

                    <circle
                      cx={hoverPos.svgX}
                      cy={hoverPos.svgY}
                      r={5}
                      fill="#f99207"
                      stroke="#fff"
                      strokeWidth={1}
                    />

                    <text
                      x={hoverPos.svgX + 10}
                      y={hoverPos.svgY - 10}
                      fill="#f99207"
                      fontSize={12}
                    >
                      {formatTimeByScale(hoverData.x, currentScale)}, {formatNumber(hoverData.y)}
                    </text>
                  </>
                )}

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
                  tickFormat={(value) => formatTimeByScale(value, currentScale)}
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