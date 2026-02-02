import React from 'react';
import { interpolate, useCurrentFrame, Easing } from 'remotion';
import { Bounds, latLonToPixel, TrackPoint } from '../utils/coordinateConverter';

interface FlightPathProps {
  trackPoints: TrackPoint[];
  bounds: Bounds;
  width: number;
  height: number;
  totalFrames: number;
  color?: string;
}

/**
 * Renders an animated flight path with progressive reveal effect
 * Slower, more cinematic pacing for broadcast quality
 */
export const FlightPath: React.FC<FlightPathProps> = ({
  trackPoints,
  bounds,
  width,
  height,
  totalFrames,
  color = '#00d8ff',
}) => {
  const frame = useCurrentFrame();

  if (trackPoints.length < 2) {
    return null;
  }

  // Convert all track points to pixel coordinates
  const pixelPoints = trackPoints.map(point =>
    latLonToPixel(point.lat, point.lon, bounds, width, height)
  );

  // Calculate the total path length for animation
  let totalLength = 0;
  for (let i = 0; i < pixelPoints.length - 1; i++) {
    const dx = pixelPoints[i + 1].x - pixelPoints[i].x;
    const dy = pixelPoints[i + 1].y - pixelPoints[i].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Animate the path reveal - SLOWER for better viewing (uses only 80% of frames)
  const progress = interpolate(frame, [0, totalFrames * 0.8], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.33, 0.0, 0.2, 1), // Slower ease-in-out
  });

  const dashOffset = interpolate(progress, [0, 1], [totalLength, 0], {
    easing: Easing.linear,
  });

  // Create smooth SVG path string using quadratic curves
  const pathString = pixelPoints.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    
    // Use smooth curves between points
    if (index < pixelPoints.length - 1) {
      const nextPoint = pixelPoints[index + 1];
      const cpX = (point.x + nextPoint.x) / 2;
      const cpY = (point.y + nextPoint.y) / 2;
      return `${path} Q ${point.x} ${point.y}, ${cpX} ${cpY}`;
    } else {
      return `${path} L ${point.x} ${point.y}`;
    }
  }, '');

  // Add waypoint markers every 10th point
  const waypointIndices = trackPoints
    .map((_, index) => index)
    .filter((index) => index % 10 === 0 || index === trackPoints.length - 1);

  const visibleWaypoints = waypointIndices.filter(
    (index) => index <= progress * (trackPoints.length - 1)
  );

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <defs>
        {/* Glow filter for the path */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background path (darker, thicker for glow effect) */}
      <path
        d={pathString}
        fill="none"
        stroke="rgba(0, 216, 255, 0.15)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={progress}
      />

      {/* Mid-layer path for depth */}
      <path
        d={pathString}
        fill="none"
        stroke="rgba(0, 216, 255, 0.3)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLength}
        strokeDashoffset={dashOffset}
      />

      {/* Animated foreground path with glow */}
      <path
        d={pathString}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLength}
        strokeDashoffset={dashOffset}
        filter="url(#glow)"
      />

      {/* Waypoint markers */}
      {visibleWaypoints.map((index) => {
        const point = pixelPoints[index];
        const isStart = index === 0;
        const isEnd = index === trackPoints.length - 1;
        
        return (
          <g key={index}>
            {/* Marker circle */}
            <circle
              cx={point.x}
              cy={point.y}
              r={isStart || isEnd ? 6 : 3}
              fill={isEnd ? '#00ff88' : isStart ? '#ff00aa' : color}
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="1"
              filter="url(#glow)"
            />
            
            {/* Start/End labels */}
            {(isStart || isEnd) && (
              <text
                x={point.x}
                y={point.y - 12}
                fontSize="12"
                fontFamily="monospace"
                fill="#ffffff"
                textAnchor="middle"
                style={{
                  textShadow: '0 0 4px rgba(0, 0, 0, 0.8)',
                }}
              >
                {isStart ? 'START' : 'END'}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
