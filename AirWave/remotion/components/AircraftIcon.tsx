import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { Bounds, latLonToPixel } from '../utils/coordinateConverter';
import { getTrackPointAtFrame } from '../utils/animationHelpers';

interface AircraftIconProps {
  trackPoints: Array<{
    lat: number;
    lon: number;
    altitude: number;
    speed: number;
    heading: number;
    timestamp: number;
  }>;
  bounds: Bounds;
  width: number;
  height: number;
  color?: string;
}

/**
 * Renders an animated aircraft icon that follows the flight path with smooth interpolation
 */
export const AircraftIcon: React.FC<AircraftIconProps> = ({
  trackPoints,
  bounds,
  width,
  height,
  color = '#00ff88',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  if (trackPoints.length === 0) {
    return null;
  }

  // Get the current track point with smooth interpolation
  const currentPoint = getTrackPointAtFrame(frame, trackPoints, durationInFrames);
  
  // Get next point for smoother heading transition
  const nextFrame = Math.min(frame + 1, durationInFrames - 1);
  const nextPoint = getTrackPointAtFrame(nextFrame, trackPoints, durationInFrames);

  // Convert to pixel coordinates
  const position = latLonToPixel(currentPoint.lat, currentPoint.lon, bounds, width, height);
  const nextPosition = latLonToPixel(nextPoint.lat, nextPoint.lon, bounds, width, height);
  
  // Calculate smooth heading based on actual movement direction
  const dx = nextPosition.x - position.x;
  const dy = nextPosition.y - position.y;
  const smoothHeading = dx !== 0 || dy !== 0 
    ? (Math.atan2(dx, -dy) * 180 / Math.PI)
    : currentPoint.heading;

  // Animate the pulsing glow effect with smooth spring animation
  const pulse = spring({
    frame: frame % 30,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
      mass: 0.5,
    },
  });

  const glowOpacity = interpolate(pulse, [0, 1], [0.4, 0.9], {
    easing: Easing.bezier(0.42, 0, 0.58, 1), // Smooth easing
  });
  const glowRadius = interpolate(pulse, [0, 1], [25, 35]);

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        {/* Radial gradient for glow effect */}
        <radialGradient id="aircraftGlow">
          <stop offset="0%" stopColor={color} stopOpacity={glowOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        
        {/* Filter for the icon glow */}
        <filter id="iconGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Pulsing glow circle */}
      <circle
        cx={position.x}
        cy={position.y}
        r={glowRadius}
        fill="url(#aircraftGlow)"
      />

      {/* Aircraft icon group (rotated based on smooth heading) */}
      <g
        transform={`translate(${position.x}, ${position.y}) rotate(${smoothHeading})`}
        filter="url(#iconGlow)"
        style={{
          transition: 'transform 0.1s cubic-bezier(0.4, 0.0, 0.2, 1)',
        }}
      >
        {/* Aircraft body (simplified plane shape) */}
        <path
          d="M 0,-12 L -3,-6 L -8,-4 L -8,0 L -3,2 L -3,6 L -5,8 L -5,9 L 0,8 L 5,9 L 5,8 L 3,6 L 3,2 L 8,0 L 8,-4 L 3,-6 L 0,-12 Z"
          fill={color}
          stroke="#ffffff"
          strokeWidth="0.5"
        />
        
        {/* Cockpit highlight */}
        <circle
          cx="0"
          cy="-8"
          r="2"
          fill="rgba(255, 255, 255, 0.6)"
        />
      </g>

      {/* Position marker (circle below the aircraft) */}
      <circle
        cx={position.x}
        cy={position.y}
        r="4"
        fill="none"
        stroke={color}
        strokeWidth="2"
        opacity="0.6"
      />
    </svg>
  );
};

