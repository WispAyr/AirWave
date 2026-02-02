import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface AltitudePoint {
  time: number;
  altitude: number;
  speed: number;
}

interface AltitudeChartProps {
  altitudeProfile: {
    min: number;
    max: number;
    avg: number;
    points: AltitudePoint[];
  };
  width: number;
  height: number;
  startFrame: number;
  durationFrames: number;
}

/**
 * Animated altitude profile chart
 * Shows altitude changes over time with smooth reveal animation
 */
export const AltitudeChart: React.FC<AltitudeChartProps> = ({
  altitudeProfile,
  width,
  height,
  startFrame,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (!altitudeProfile || altitudeProfile.points.length === 0) return null;

  const { min, max, avg, points } = altitudeProfile;

  // Chart dimensions
  const chartPadding = 40;
  const chartWidth = width - chartPadding * 2;
  const chartHeight = height - chartPadding * 2;

  // Animation progress
  const progress = interpolate(
    localFrame,
    [0, durationFrames],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  // Generate SVG path
  const generatePath = () => {
    const visiblePoints = points.slice(0, Math.floor(points.length * progress));
    
    if (visiblePoints.length < 2) return '';

    const path = visiblePoints.map((point, index) => {
      const x = (index / (points.length - 1)) * chartWidth + chartPadding;
      const y =
        chartHeight -
        ((point.altitude - min) / (max - min)) * chartHeight +
        chartPadding;

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return path;
  };

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        filter: 'drop-shadow(0 -10px 30px rgba(0, 0, 0, 0.5))',
      }}
    >
      {/* Broadcast-quality background */}
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(10, 14, 39, 0.95)" />
          <stop offset="100%" stopColor="rgba(10, 14, 39, 0.98)" />
        </linearGradient>
        <filter id="innerShadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.5" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="url(#bgGradient)"
        filter="url(#innerShadow)"
      />
      
      {/* Top border glow */}
      <rect
        x={0}
        y={0}
        width={width}
        height={2}
        fill="url(#topBorderGradient)"
      />
      <defs>
        <linearGradient id="topBorderGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="20%" stopColor="rgba(0, 216, 255, 0.5)" />
          <stop offset="80%" stopColor="rgba(0, 255, 136, 0.5)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>

      {/* Broadcast-quality grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
        const y = chartHeight - ratio * chartHeight + chartPadding;
        const altitude = min + ratio * (max - min);
        const isMajor = ratio === 0 || ratio === 0.5 || ratio === 1;
        return (
          <g key={ratio}>
            <line
              x1={chartPadding}
              y1={y}
              x2={width - chartPadding}
              y2={y}
              stroke={isMajor ? 'rgba(0, 216, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)'}
              strokeWidth={isMajor ? 1.5 : 1}
              strokeDasharray={isMajor ? '0' : '4,4'}
            />
            <text
              x={chartPadding - 15}
              y={y + 5}
              fill={isMajor ? 'rgba(245, 245, 245, 0.8)' : 'rgba(245, 245, 245, 0.5)'}
              fontSize={isMajor ? 14 : 12}
              fontWeight={isMajor ? '600' : '400'}
              textAnchor="end"
              fontFamily="-apple-system, 'SF Pro Text', monospace"
            >
              FL{Math.round(altitude / 100)}
            </text>
          </g>
        );
      })}

      {/* Broadcast-quality altitude line with glow */}
      {/* Glow layer */}
      <path
        d={generatePath()}
        fill="none"
        stroke="url(#altitudeGradient)"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.4}
        filter="blur(4px)"
      />
      {/* Main line */}
      <path
        d={generatePath()}
        fill="none"
        stroke="url(#altitudeGradient)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="drop-shadow(0 0 8px rgba(0, 216, 255, 0.6))"
      />

      {/* Fill area under the line with enhanced gradient */}
      <path
        d={`${generatePath()} L ${width - chartPadding} ${height - chartPadding} L ${chartPadding} ${height - chartPadding} Z`}
        fill="url(#altitudeAreaGradient)"
        opacity={0.8}
      />

      {/* Enhanced gradients for broadcast quality */}
      <defs>
        <linearGradient id="altitudeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00d8ff" stopOpacity="1" />
          <stop offset="50%" stopColor="#00e8cc" stopOpacity="1" />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="altitudeAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(0, 216, 255, 0.35)" />
          <stop offset="50%" stopColor="rgba(0, 232, 204, 0.2)" />
          <stop offset="100%" stopColor="rgba(0, 255, 136, 0.08)" />
        </linearGradient>
      </defs>

      {/* Professional labels */}
      <text
        x={chartPadding}
        y={chartPadding - 12}
        fill="#00d8ff"
        fontSize={18}
        fontWeight="700"
        fontFamily="-apple-system, 'SF Pro Display', sans-serif"
        letterSpacing="0.5px"
        filter="drop-shadow(0 0 10px rgba(0, 216, 255, 0.5))"
      >
        ALTITUDE PROFILE
      </text>
      
      {/* Statistics - Broadcast layout */}
      <g>
        <text
          x={width - chartPadding}
          y={chartPadding - 12}
          fill="rgba(245, 245, 245, 0.8)"
          fontSize={14}
          fontWeight="500"
          textAnchor="end"
          fontFamily="-apple-system, 'SF Pro Text', monospace"
        >
          <tspan fill="#00d8ff">MIN</tspan> FL{Math.round(min / 100)}
          {' '}|{' '}
          <tspan fill="#ffd700">MAX</tspan> FL{Math.round(max / 100)}
          {' '}|{' '}
          <tspan fill="#00ff88">AVG</tspan> FL{Math.round(avg / 100)}
        </text>
      </g>
    </svg>
  );
};

