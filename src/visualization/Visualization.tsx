import { useRef, useState, useEffect, useMemo } from 'react';
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
  index: number;
  offsetX: number;
  offsetY: number;
}

// Colors for each part
const partColors: Record<string, string> = {
  envelope1: '#03c6fc',
  envelope2: '#75daad',
  envelope3: '#ff9f1c'
};

export function Visualization() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestPoint, setClosestPoint] = useState<Datum | null>(null);
  const [draggingAnnotation, setDraggingAnnotation] = useState<DraggingAnnotation | null>(null);
  const [annotationIndex, setAnnotationIndex] = useState<number>(3);
  const [tooltipData, setTooltipData] = useState<Datum | null>(null);
  const [tooltipLeft, setTooltipLeft] = useState<number>(0);
  const [tooltipTop, setTooltipTop] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [simulationData, setSimulationData] = useState<Datum[]>([]);
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Base sizes that will be adjusted by zoom
  const baseLineWidth = 2;
  const baseTextSize = 10;
  const basePointRadius = 4;

  const startDate: number = 0
  const endDate: number = 30 * 365
  const interval: number = 365

  // Run simulation when component mounts
  useEffect(() => {
    const runSim = async () => {
      try {
        setIsLoading(true);
        const result = await runSimulation(
          '/assets/plan.json',
          '/assets/event_schema.json',
          startDate,
          endDate,
          interval
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

  // Coordinate conversion utilities
  const screenToCanvas = (screenX: number, screenY: number, zoom: ZoomObject) => ({
    x: (screenX - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX,
    y: (screenY - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY
  });

  const canvasToData = (canvasX: number, canvasY: number) => ({
    x: xScale.invert(canvasX),
    y: yScale.invert(canvasY)
  });

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
        scaleXMax={10}
        scaleYMin={0 - 8}
        scaleYMax={10}
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

          const handleAnnotationDragStart = (e: React.MouseEvent, index: number) => {
            e.stopPropagation();
            const point = getSVGPoint(e);

            const dataPoint = simulationData[index];
            const transformedX = (xScale(dataPoint.date) * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
            const transformedY = (yScale(dataPoint.value) * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

            setDraggingAnnotation({
              index,
              offsetX: point.x - transformedX,
              offsetY: point.y - transformedY
            });
          };

          const handleAnnotationDragMove = (e: React.MouseEvent) => {
            if (!draggingAnnotation) return;

            const point = getSVGPoint(e);
            const dataPoint = screenToData(point.x, point.y, zoom);
            const closestPoint = findClosestPoint(dataPoint.x);
            const closestIndex = simulationData.findIndex(p => p.date === closestPoint.date && p.value === closestPoint.y);

            // Calculate distance between cursor and closest point
            const distance = Math.sqrt(
              Math.pow(dataPoint.x - closestPoint.date, 2) +
              Math.pow(dataPoint.y - closestPoint.value, 2)
            );

            // Only update if within threshold (adjust 0.5 as needed)
            if (distance < 50) {
              setAnnotationIndex(closestIndex);
            }

            setClosestPoint(closestPoint);
          };

          const handleAnnotationDragEnd = (e: React.MouseEvent) => {
            if (!draggingAnnotation) return;

            const point = getSVGPoint(e);
            const dataPoint = screenToData(point.x, point.y, zoom);
            const closestPoint = findClosestPoint(dataPoint.x);
            const closestIndex = simulationData.findIndex(p => p.date === closestPoint.date && p.value === closestPoint.value);

            setDraggingAnnotation(null);
            setClosestPoint(null);
          };

          // Calculate global zoom level (average of x and y scale)
          const globalZoom = (zoom.transformMatrix.scaleX + zoom.transformMatrix.scaleY) / 2;

          // Calculate adjusted sizes based on zoom
          const adjustedLineWidth = baseLineWidth / globalZoom;
          const adjustedTextSize = baseTextSize / globalZoom;
          const adjustedPointRadius = basePointRadius / globalZoom;

          return (
            <>
              <svg
                ref={svgRef}
                width={width}
                height={height}
                style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
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
                    const canvasX = xScale(closest.date);
                    const canvasY = yScale(closest.value);
                    const transformedX = (canvasX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
                    const transformedY = (canvasY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

                    setTooltipData(closest);
                    setTooltipLeft(transformedX);
                    setTooltipTop(transformedY);
                  }

                  if (isDragging) {
                    zoom.dragMove(e);
                  }
                }}
                onMouseLeave={() => {
                  setCursorPos(null);
                  setClosestPoint(null);
                  setTooltipData(null);
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
                  e.preventDefault();
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

                {/* Crosshair */}
                {cursorPos && (
                  <>
                    <line
                      x1={0}
                      x2={width}
                      y1={cursorPos.y}
                      y2={cursorPos.y}
                      stroke="#335966"
                      strokeWidth={adjustedLineWidth}
                      strokeDasharray="4,4"
                      opacity={0.5}
                    />
                    <line
                      x1={cursorPos.x}
                      x2={cursorPos.x}
                      y1={0}
                      y2={height}
                      stroke="#335966"
                      strokeWidth={adjustedLineWidth}
                      strokeDasharray="4,4"
                      opacity={0.5}
                    />
                  </>
                )}

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
                  {Object.keys(simulationData[0]?.parts || {}).map((partKey, index, keys) => (
                    <AreaClosed
                      key={`area-${partKey}`}
                      data={stackedData}
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
                      data={stackedData}
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
                    data={stackedData}
                    x={(d: StackedDatum) => xScale(d.date)}
                    y={(d: StackedDatum) => yScale(d.value)}
                    stroke="#335966"
                    strokeWidth={3 / globalZoom}
                    curve={curveLinear}
                  />

                  {/* Data Points */}
                  {simulationData.map((point, index) => {
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
                {simulationData.map((point) => {
                  const canvasX = xScale(point.date);
                  const canvasY = yScale(point.value);
                  const transformedX = (canvasX * zoom.transformMatrix.scaleX) + zoom.transformMatrix.translateX;
                  const transformedY = (canvasY * zoom.transformMatrix.scaleY) + zoom.transformMatrix.translateY;

                  // Only show annotation for the assigned index
                  if (point.date !== annotationIndex) return null;

                  // If this annotation is being dragged, use cursor position
                  const isDragging = draggingAnnotation?.index === point.date;
                  const x = isDragging
                    ? cursorPos!.x - draggingAnnotation!.offsetX - 20
                    : transformedX - 20;
                  const y = isDragging
                    ? cursorPos!.y - draggingAnnotation!.offsetY - 80
                    : transformedY - 80;

                  return (
                    <foreignObject
                      key={`annotation-${point.date}`}
                      x={x}
                      y={y}
                      width={40}
                      height={40}
                      style={{
                        overflow: 'visible',
                        cursor: 'move'
                      }}
                      onMouseDown={(e) => handleAnnotationDragStart(e, point.date)}
                    >
                      <div>
                        <TimelineAnnotation />
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

                {/* Debug Info */}
                <g transform={`translate(${width - 300}, 20)`}>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    fontWeight="bold"
                  >
                    {`Global Zoom: ${globalZoom.toFixed(2)}x`}
                  </text>

                  {/* Viewport Info */}
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={20}
                    fontWeight="bold"
                  >
                    Viewport:
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={40}
                  >
                    {`Width: ${width}px`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={60}
                  >
                    {`Height: ${height}px`}
                  </text>

                  {/* Scale Info */}
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={100}
                    fontWeight="bold"
                  >
                    Scale Domains:
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={120}
                  >
                    {`X Scale: [${xScale.domain()[0]} → ${xScale.domain()[1]}]`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={140}
                  >
                    {`X Range: [${xScale.range()[0]} → ${xScale.range()[1]}]`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={160}
                  >
                    {`Y Scale: [${yScale.domain()[0]} → ${yScale.domain()[1]}]`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={180}
                  >
                    {`Y Range: [${yScale.range()[0]} → ${yScale.range()[1]}]`}
                  </text>

                  {/* Visible Domain Calculations */}
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={220}
                    fontWeight="bold"
                  >
                    Visible Domain Calculations:
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={240}
                  >
                    {`X Left: (-${zoom.transformMatrix.translateX} / ${zoom.transformMatrix.scaleX.toFixed(2)})`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={260}
                  >
                    {`X Right: (${width - zoom.transformMatrix.translateX} / ${zoom.transformMatrix.scaleX.toFixed(2)})`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={280}
                  >
                    {`Y Bottom: (${height - zoom.transformMatrix.translateY} / ${zoom.transformMatrix.scaleY.toFixed(2)})`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={300}
                  >
                    {`Y Top: (-${zoom.transformMatrix.translateY} / ${zoom.transformMatrix.scaleY.toFixed(2)})`}
                  </text>

                  {/* Visible Domain Results */}
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={340}
                    fontWeight="bold"
                  >
                    Visible Domain:
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={360}
                  >
                    {`X: [${xScale.invert((-zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX).toFixed(1)} → ${xScale.invert((width - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX).toFixed(1)}]`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={380}
                  >
                    {`Y: [${yScale.invert((height - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY).toFixed(1)} → ${yScale.invert((-zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY).toFixed(1)}]`}
                  </text>

                  {/* Transform Matrix */}
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={420}
                    fontWeight="bold"
                  >
                    Transform Matrix:
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={440}
                  >
                    {`Scale X: ${zoom.transformMatrix.scaleX.toFixed(2)}x`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={460}
                  >
                    {`Scale Y: ${zoom.transformMatrix.scaleY.toFixed(2)}x`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={480}
                  >
                    {`Translate X: ${zoom.transformMatrix.translateX.toFixed(0)}px`}
                  </text>
                  <text
                    fill="#335966"
                    fontSize={12}
                    textAnchor="start"
                    y={500}
                  >
                    {`Translate Y: ${zoom.transformMatrix.translateY.toFixed(0)}px`}
                  </text>

                  {/* Cursor Position */}
                  {cursorPos && (
                    <>
                      <text
                        fill="#335966"
                        fontSize={12}
                        textAnchor="start"
                        y={540}
                        fontWeight="bold"
                      >
                        Cursor Position:
                      </text>
                      <text
                        fill="#335966"
                        fontSize={12}
                        textAnchor="start"
                        y={560}
                      >
                        {`Screen: (${cursorPos.x.toFixed(0)}, ${cursorPos.y.toFixed(0)})`}
                      </text>
                      <text
                        fill="#335966"
                        fontSize={12}
                        textAnchor="start"
                        y={580}
                      >
                        {`Canvas: (${xScale.invert((cursorPos.x - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX).toFixed(1)}, ${yScale.invert((cursorPos.y - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY).toFixed(1)})`}
                      </text>
                      <text
                        fill="#335966"
                        fontSize={12}
                        textAnchor="start"
                        y={600}
                      >
                        {`Graph: (${xScale.invert((cursorPos.x - zoom.transformMatrix.translateX) / zoom.transformMatrix.scaleX).toFixed(1)}, ${yScale.invert((cursorPos.y - zoom.transformMatrix.translateY) / zoom.transformMatrix.scaleY).toFixed(1)})`}
                      </text>
                    </>
                  )}

                  {/* Drag Offset Info */}
                  {draggingAnnotation && (
                    <>
                      <text
                        fill="#335966"
                        fontSize={12}
                        textAnchor="start"
                        y={640}
                        fontWeight="bold"
                      >
                        Drag Offset:
                      </text>
                      <text
                        fill="#335966"
                        fontSize={12}
                        textAnchor="start"
                        y={660}
                      >
                        {`Offset: (${draggingAnnotation.offsetX.toFixed(0)}, ${draggingAnnotation.offsetY.toFixed(0)})`}
                      </text>
                      <text
                        fill="#335966"
                        fontSize={12}
                        textAnchor="start"
                        y={680}
                      >
                        {`Position: (${(cursorPos!.x - draggingAnnotation.offsetX).toFixed(0)}, ${(cursorPos!.y - draggingAnnotation.offsetY).toFixed(0)})`}
                      </text>
                    </>
                  )}
                </g>
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
                    <div>Total: {tooltipData.value}</div>
                    {Object.entries(tooltipData.parts).map(([key, value]) => (
                      <div key={key} style={{ color: partColors[key] }}>
                        {key}: {value}
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