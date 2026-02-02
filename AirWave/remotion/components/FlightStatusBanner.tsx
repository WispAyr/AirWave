import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface FlightStatus {
  phase: string;
  description: string;
  altitude: number;
  speed: number;
  trackLength: number;
  duration: number;
}

interface FlightStatusBannerProps {
  flightStatus: FlightStatus;
  flight: string;
  tail: string;
  type: string;
  startFrame: number;
}

/**
 * Flight status banner showing what the aircraft is doing
 * Displays flight phase, altitude, speed, and other real-time data
 */
export const FlightStatusBanner: React.FC<FlightStatusBannerProps> = ({
  flightStatus,
  flight,
  tail,
  type,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  // Professional ease-out slide
  const slideIn = interpolate(
    localFrame,
    [0, 40],
    [-600, 0],
    {
      extrapolateRight: 'clamp',
      easing: (t) => 1 - Math.pow(1 - t, 4), // Ease-out quart
    }
  );

  // Smooth opacity fade-in
  const opacity = interpolate(
    localFrame,
    [10, 40],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  // Subtle pulse for live indicator
  const pulse = Math.sin(frame / 20) * 0.15 + 0.85;
  const glowPulse = Math.sin(frame / 15) * 0.3 + 0.7;

  // Get phase color
  const getPhaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      TAKEOFF: '#00ff88',
      CRUISE: '#00d8ff',
      DESCENT: '#ffd700',
      APPROACH: '#ff8800',
      LANDED: '#00ff88',
      TAXI: '#888888',
      EN_ROUTE: '#00d8ff',
    };
    return colors[phase] || '#00d8ff';
  };

  const phaseColor = getPhaseColor(flightStatus.phase);

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 60,
        transform: `translateX(${slideIn}px)`,
        opacity,
        background: 'linear-gradient(135deg, rgba(10, 14, 39, 0.92) 0%, rgba(26, 31, 58, 0.92) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderRadius: 16,
        padding: '24px 36px',
        minWidth: 480,
        maxWidth: 600,
        boxShadow: `
          0 20px 60px rgba(0, 0, 0, 0.6),
          0 0 0 1px rgba(255, 255, 255, 0.05),
          inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
        `,
        border: `2px solid rgba(0, 216, 255, ${0.4 * glowPulse})`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 15,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: 15,
        }}
      >
        {/* Flight number - Broadcast typography */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: '#00d8ff',
              letterSpacing: '-0.5px',
              fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif',
              textShadow: `
                0 0 20px rgba(0, 216, 255, 0.6),
                0 2px 4px rgba(0, 0, 0, 0.8)
              `,
            }}
          >
            {flight}
          </div>
          <div
            style={{
              fontSize: 15,
              color: 'rgba(245, 245, 245, 0.75)',
              marginTop: 6,
              fontWeight: 400,
              letterSpacing: '0.5px',
              fontFamily: '-apple-system, "SF Pro Text", sans-serif',
            }}
          >
            {tail} <span style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 8px' }}>•</span> {type}
          </div>
        </div>

        {/* Phase indicator - Broadcast style */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 24px',
            background: `linear-gradient(135deg, 
              rgba(${parseInt(phaseColor.slice(1, 3), 16)}, ${parseInt(phaseColor.slice(3, 5), 16)}, ${parseInt(phaseColor.slice(5, 7), 16)}, 0.25) 0%,
              rgba(${parseInt(phaseColor.slice(1, 3), 16)}, ${parseInt(phaseColor.slice(3, 5), 16)}, ${parseInt(phaseColor.slice(5, 7), 16)}, 0.15) 100%
            )`,
            backdropFilter: 'blur(10px)',
            borderRadius: 24,
            border: `2px solid ${phaseColor}`,
            transform: `scale(${pulse})`,
            boxShadow: `
              0 4px 20px rgba(${parseInt(phaseColor.slice(1, 3), 16)}, ${parseInt(phaseColor.slice(3, 5), 16)}, ${parseInt(phaseColor.slice(5, 7), 16)}, 0.4),
              inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
            `,
          }}
        >
          {/* Live indicator */}
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: phaseColor,
              boxShadow: `
                0 0 0 ${2 * pulse}px rgba(${parseInt(phaseColor.slice(1, 3), 16)}, ${parseInt(phaseColor.slice(3, 5), 16)}, ${parseInt(phaseColor.slice(5, 7), 16)}, 0.3),
                0 0 15px ${phaseColor}
              `,
            }}
          />
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: phaseColor,
              letterSpacing: '1px',
              fontFamily: '-apple-system, "SF Pro Display", sans-serif',
              textShadow: `0 0 10px ${phaseColor}`,
            }}
          >
            {flightStatus.phase.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Status description - Broadcast style */}
      <div
        style={{
          fontSize: 19,
          color: '#f5f5f5',
          marginBottom: 18,
          fontWeight: 500,
          letterSpacing: '0.3px',
          fontFamily: '-apple-system, "SF Pro Text", sans-serif',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
        }}
      >
        {flightStatus.description}
      </div>

      {/* Metrics - Broadcast design */}
      <div
        style={{
          display: 'flex',
          gap: 36,
        }}
      >
        {/* Altitude */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(245, 245, 245, 0.5)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600,
              fontFamily: '-apple-system, "SF Pro Text", sans-serif',
            }}
          >
            Altitude
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#00d8ff',
              fontWeight: 700,
              fontFamily: '-apple-system, "SF Pro Display", monospace',
              letterSpacing: '-0.5px',
              textShadow: '0 0 20px rgba(0, 216, 255, 0.5), 0 2px 4px rgba(0, 0, 0, 0.5)',
            }}
          >
            {flightStatus.altitude > 100 ? `FL${Math.round(flightStatus.altitude / 100)}` : `${flightStatus.altitude} ft`}
          </div>
        </div>

        {/* Speed */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(245, 245, 245, 0.5)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600,
              fontFamily: '-apple-system, "SF Pro Text", sans-serif',
            }}
          >
            Ground Speed
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#00ff88',
              fontWeight: 700,
              fontFamily: '-apple-system, "SF Pro Display", monospace',
              letterSpacing: '-0.5px',
              textShadow: '0 0 20px rgba(0, 255, 136, 0.5), 0 2px 4px rgba(0, 0, 0, 0.5)',
            }}
          >
            {flightStatus.speed} <span style={{ fontSize: 18, fontWeight: 400 }}>kts</span>
          </div>
        </div>

        {/* Track Points */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(245, 245, 245, 0.5)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600,
              fontFamily: '-apple-system, "SF Pro Text", sans-serif',
            }}
          >
            Positions
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#ffd700',
              fontWeight: 700,
              fontFamily: '-apple-system, "SF Pro Display", monospace',
              letterSpacing: '-0.5px',
              textShadow: '0 0 20px rgba(255, 215, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.5)',
            }}
          >
            {flightStatus.trackLength}
          </div>
        </div>
      </div>
    </div>
  );
};

