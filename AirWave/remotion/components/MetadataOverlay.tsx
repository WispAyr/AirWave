import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import {
  formatAltitude,
  formatSpeed,
  formatHeading,
  formatTimestamp,
  getTrackPointAtFrame,
} from '../utils/animationHelpers';

interface MetadataOverlayProps {
  flight: string;
  tail: string;
  type: string;
  trackPoints: Array<{
    lat: number;
    lon: number;
    altitude: number;
    speed: number;
    heading: number;
    timestamp: number;
  }>;
  totalFrames: number;
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * Displays aircraft metadata overlay with SpaceX mission control aesthetic
 */
export const MetadataOverlay: React.FC<MetadataOverlayProps> = ({
  flight,
  tail,
  type,
  trackPoints,
  totalFrames,
  primaryColor = '#00d8ff',
  secondaryColor = '#00ff88',
}) => {
  const frame = useCurrentFrame();

  // Fade in animation for the overlay
  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Get current position data
  const currentPoint = trackPoints.length > 0
    ? getTrackPointAtFrame(frame, trackPoints, totalFrames)
    : null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        fontFamily: 'monospace',
        color: '#ffffff',
        opacity: fadeIn,
        pointerEvents: 'none',
      }}
    >
      {/* Top-left: Flight information - Broadcast enhanced */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          backgroundColor: 'rgba(10, 14, 39, 0.92)',
          padding: '24px 28px',
          borderRadius: '8px',
          border: `3px solid ${primaryColor}`,
          boxShadow: `
            0 0 30px ${primaryColor}60,
            0 8px 32px rgba(0, 0, 0, 0.6)
          `,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ 
          fontSize: 13, 
          color: primaryColor, 
          marginBottom: 12,
          letterSpacing: '2px',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          FLIGHT IDENTIFIER
        </div>
        <div style={{ 
          fontSize: 42, 
          fontWeight: 900, 
          marginBottom: 20,
          letterSpacing: '2px',
          textShadow: `0 0 20px ${primaryColor}80, 0 4px 10px rgba(0, 0, 0, 0.8)`,
        }}>
          {flight}
        </div>
        <div style={{ 
          fontSize: 14, 
          color: 'rgba(255, 255, 255, 0.7)', 
          marginBottom: 8,
          letterSpacing: '1px',
          fontWeight: 600,
        }}>
          TAIL: <span style={{ color: '#ffffff', fontWeight: 700 }}>{tail}</span>
        </div>
        <div style={{ 
          fontSize: 14, 
          color: 'rgba(255, 255, 255, 0.7)',
          letterSpacing: '0.5px',
          fontWeight: 600,
        }}>
          TYPE: <span style={{ color: '#ffffff', fontWeight: 700 }}>{type}</span>
        </div>
      </div>

      {/* Top-right: Live telemetry - Broadcast enhanced */}
      {currentPoint && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 40,
            backgroundColor: 'rgba(10, 14, 39, 0.92)',
            padding: '24px 28px',
            borderRadius: '8px',
            border: `3px solid ${secondaryColor}`,
            boxShadow: `
              0 0 30px ${secondaryColor}60,
              0 8px 32px rgba(0, 0, 0, 0.6)
            `,
            backdropFilter: 'blur(12px)',
            minWidth: 240,
          }}
        >
          <div style={{ 
            fontSize: 13, 
            color: secondaryColor, 
            marginBottom: 18,
            letterSpacing: '2px',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}>
            LIVE TELEMETRY
          </div>
          
          <TelemetryRow
            label="ALTITUDE"
            value={formatAltitude(currentPoint.altitude)}
            color={primaryColor}
          />
          <TelemetryRow
            label="SPEED"
            value={formatSpeed(currentPoint.speed)}
            color={primaryColor}
          />
          <TelemetryRow
            label="HEADING"
            value={formatHeading(currentPoint.heading)}
            color={primaryColor}
          />
        </div>
      )}

      {/* Bottom-left: Coordinates and timestamp - ABOVE altitude chart */}
      {currentPoint && (
        <div
          style={{
            position: 'absolute',
            bottom: 300, // Positioned above 280px altitude chart
            left: 40,
            backgroundColor: 'rgba(10, 14, 39, 0.92)',
            padding: '18px 22px',
            borderRadius: '6px',
            border: `2px solid rgba(0, 216, 255, 0.4)`,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(10px)',
            fontSize: 12,
          }}
        >
          <div style={{ color: primaryColor, marginBottom: 8, fontSize: 11, letterSpacing: '1px', fontWeight: 600 }}>
            POSITION
          </div>
          <div style={{ fontWeight: 'bold', fontSize: 14, color: '#f5f5f5', fontFamily: 'monospace' }}>
            {currentPoint.lat.toFixed(6)}°, {currentPoint.lon.toFixed(6)}°
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: 14, marginBottom: 8, fontSize: 11, letterSpacing: '1px', fontWeight: 600 }}>
            TIMESTAMP
          </div>
          <div style={{ fontWeight: 'bold', fontSize: 13, color: '#f5f5f5', fontFamily: 'monospace' }}>
            {formatTimestamp(currentPoint.timestamp)}
          </div>
        </div>
      )}

      {/* Bottom-right: Branding - ABOVE altitude chart */}
      <div
        style={{
          position: 'absolute',
          bottom: 305, // Positioned above altitude chart
          right: 40,
          textAlign: 'right',
          padding: '16px 20px',
          background: 'rgba(10, 14, 39, 0.85)',
          borderRadius: '6px',
          border: '2px solid rgba(0, 216, 255, 0.3)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 6,
            letterSpacing: '-1px',
            textShadow: `0 0 20px rgba(0, 216, 255, 0.4)`,
          }}
        >
          AIRWAVE
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '2px', fontWeight: 500 }}>
          MISSION CONTROL
        </div>
      </div>

      {/* Top border accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '3px',
          background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor}, ${primaryColor})`,
        }}
      />

      {/* Bottom border accent */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '3px',
          background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor}, ${primaryColor})`,
        }}
      />
    </div>
  );
};

/**
 * Helper component for telemetry rows - Broadcast quality
 */
const TelemetryRow: React.FC<{ label: string; value: string; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div style={{ 
    marginBottom: 14, 
    display: 'flex', 
    justifyContent: 'space-between', 
    gap: 30,
    alignItems: 'center',
  }}>
    <div style={{ 
      fontSize: 12, 
      color: 'rgba(255, 255, 255, 0.65)',
      letterSpacing: '1px',
      fontWeight: 600,
    }}>
      {label}
    </div>
    <div style={{ 
      fontSize: 18, 
      fontWeight: 900, 
      color,
      fontFamily: 'monospace',
      textShadow: `0 0 15px ${color}60, 0 2px 6px rgba(0, 0, 0, 0.8)`,
      letterSpacing: '1px',
    }}>
      {value}
    </div>
  </div>
);


