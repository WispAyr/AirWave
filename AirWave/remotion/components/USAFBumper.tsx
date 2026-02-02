import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { LensFlare, ParticleField } from './BroadcastGraphics';

interface USAFBumperProps {
  flight: string;
  type: string;
}

/**
 * BROADCAST-QUALITY US Air Force bumper
 * Professional military-themed intro for USAF aircraft (E-6B, E-4B, tankers, etc.)
 */
export const USAFBumper: React.FC<USAFBumperProps> = ({ flight, type }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Professional spring animation
  const contentScale = spring({
    frame,
    fps,
    config: {
      damping: 30,
      stiffness: 60,
      mass: 1.5,
    },
  });

  // Smooth opacity curves
  const textOpacity = interpolate(
    frame,
    [10, 30],
    [0, 1],
    {
      extrapolateRight: 'clamp',
      easing: (t) => t * t * (3 - 2 * t), // Smoothstep
    }
  );

  const glowIntensity = interpolate(
    frame,
    [0, 75],
    [0, 1.2],
    {
      extrapolateRight: 'clamp',
      easing: (t) => 1 - Math.pow(1 - t, 3),
    }
  );

  // Military-themed colors
  const militaryBlue = '#003f87';
  const goldAccent = '#ffd700';

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${militaryBlue} 0%, #001a3d 70%, #000000 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Particle field atmosphere */}
      <ParticleField count={120} color={goldAccent} />

      {/* Animated star field */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundImage:
            'linear-gradient(rgba(255, 215, 0, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 215, 0, 0.06) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: glowIntensity * 0.3,
          transform: 'perspective(1000px) rotateX(70deg) scale(2.5)',
          transformOrigin: 'center bottom',
        }}
      />

      {/* Lens flares */}
      <LensFlare x={960} y={400} intensity={glowIntensity * 0.5} />

      {/* Main content container */}
      <div
        style={{
          transform: `scale(${contentScale}) translateZ(0)`,
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* USAF Shield/Emblem representation */}
        <div
          style={{
            width: 160,
            height: 160,
            margin: '0 auto 40px',
            background: `radial-gradient(circle, ${goldAccent} 0%, rgba(255, 215, 0, 0.3) 100%)`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `4px solid ${goldAccent}`,
            boxShadow: `
              0 0 40px rgba(255, 215, 0, ${0.6 * glowIntensity}),
              0 0 80px rgba(255, 215, 0, ${0.3 * glowIntensity}),
              inset 0 0 40px rgba(255, 215, 0, 0.1)
            `,
            position: 'relative',
          }}
        >
          {/* Star symbol */}
          <div
            style={{
              fontSize: 100,
              color: militaryBlue,
              fontWeight: 900,
              textShadow: `0 0 20px rgba(255, 255, 255, ${0.5 * glowIntensity})`,
            }}
          >
            ★
          </div>
        </div>

        {/* UNITED STATES AIR FORCE text */}
        <div
          style={{
            fontSize: 42,
            fontWeight: 900,
            color: goldAccent,
            letterSpacing: '8px',
            textTransform: 'uppercase',
            fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
            textShadow: `
              0 0 30px rgba(255, 215, 0, ${0.8 * glowIntensity}),
              0 4px 12px rgba(0, 0, 0, 0.8)
            `,
            marginBottom: 25,
            opacity: textOpacity,
          }}
        >
          United States Air Force
        </div>

        {/* Accent line */}
        <div
          style={{
            width: interpolate(frame, [15, 45], [0, 600], { extrapolateRight: 'clamp' }),
            height: 3,
            background: `linear-gradient(90deg, transparent, ${goldAccent}, ${goldAccent}, transparent)`,
            margin: '0 auto 30px',
            borderRadius: 2,
            boxShadow: `0 0 15px rgba(255, 215, 0, ${0.8 * glowIntensity})`,
          }}
        />

        {/* Aircraft type/callsign */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '4px',
            fontFamily: '-apple-system, "SF Pro Display", monospace',
            marginBottom: 20,
            opacity: textOpacity,
            textShadow: `
              0 0 20px rgba(255, 255, 255, ${0.5 * glowIntensity}),
              0 4px 20px rgba(0, 0, 0, 0.9)
            `,
          }}
        >
          {flight}
        </div>

        {/* Aircraft type */}
        <div
          style={{
            fontSize: 26,
            color: 'rgba(255, 255, 255, 0.9)',
            letterSpacing: '3px',
            fontWeight: 500,
            fontFamily: '-apple-system, "SF Pro Text", sans-serif',
            opacity: textOpacity,
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
          }}
        >
          {type}
        </div>
      </div>

      {/* Bottom classification/tagline */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          fontSize: 18,
          color: 'rgba(255, 255, 255, 0.7)',
          opacity: textOpacity,
          fontWeight: 400,
          letterSpacing: '4px',
          textTransform: 'uppercase',
          fontFamily: '-apple-system, "SF Pro Text", sans-serif',
          textShadow: '0 2px 20px rgba(0, 0, 0, 0.9)',
        }}
      >
        Strategic Communications Platform
      </div>

      {/* Decorative mil-spec elements */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          display: 'flex',
          gap: 15,
          alignItems: 'center',
          opacity: textOpacity,
        }}
      >
        <div
          style={{
            width: interpolate(frame, [20, 50], [0, 150], { extrapolateRight: 'clamp' }),
            height: 2,
            background: `linear-gradient(90deg, transparent, ${goldAccent})`,
            boxShadow: `0 0 8px rgba(255, 215, 0, 0.6)`,
          }}
        />
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: goldAccent,
            boxShadow: `0 0 20px ${goldAccent}`,
          }}
        />
        <div
          style={{
            width: interpolate(frame, [20, 50], [0, 150], { extrapolateRight: 'clamp' }),
            height: 2,
            background: `linear-gradient(90deg, ${goldAccent}, transparent)`,
            boxShadow: `0 0 8px rgba(255, 215, 0, 0.6)`,
          }}
        />
      </div>

      {/* Broadcast vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.7) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

