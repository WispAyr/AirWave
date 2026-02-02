import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { LensFlare, ParticleField } from './BroadcastGraphics';

interface AirWaveBumperProps {
  type: 'intro' | 'outro';
}

/**
 * BROADCAST-QUALITY branded bumper
 * Professional intro/outro with cinematic effects
 */
export const AirWaveBumper: React.FC<AirWaveBumperProps> = ({ type }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Professional spring animation (smooth, not bouncy)
  const logoScale = spring({
    frame,
    fps,
    config: {
      damping: 25,
      stiffness: 70,
      mass: 1.2,
    },
  });

  // Smooth opacity curves
  const textOpacity = interpolate(
    frame,
    [15, 35],
    [0, 1],
    {
      extrapolateRight: 'clamp',
      easing: (t) => t * t * (3 - 2 * t), // Smoothstep
    }
  );

  const glowIntensity = interpolate(
    frame,
    [0, 60],
    [0, 1],
    {
      extrapolateRight: 'clamp',
      easing: (t) => 1 - Math.pow(1 - t, 3), // Ease-out cubic
    }
  );

  // Pulsing glow
  const pulseSlow = Math.sin(frame / 20) * 0.2 + 1;
  const pulseFast = Math.sin(frame / 10) * 0.1 + 1;

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse at center, #1a1f3a 0%, #0a0e27 70%, #000000 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Particle field atmosphere */}
      <ParticleField count={80} color="#00d8ff" />

      {/* Animated grid background with perspective */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundImage:
            'linear-gradient(rgba(0, 216, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 216, 255, 0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: glowIntensity * 0.4,
          transform: 'perspective(1000px) rotateX(60deg) scale(2)',
          transformOrigin: 'center bottom',
        }}
      />

      {/* Lens flares for cinematic feel */}
      <LensFlare x={960} y={400} intensity={glowIntensity * 0.6} />
      <LensFlare x={1200} y={300} intensity={glowIntensity * 0.3} />

      {/* Logo container with broadcast effects */}
      <div
        style={{
          transform: `scale(${logoScale}) translateZ(0)`,
          position: 'relative',
          textAlign: 'center',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 800,
            height: 400,
            background: `radial-gradient(circle, rgba(0, 216, 255, ${0.25 * glowIntensity * pulseSlow}) 0%, transparent 70%)`,
            filter: 'blur(60px)',
            zIndex: 0,
          }}
        />

        {/* AirWave Logo - Broadcast typography with proper text rendering */}
        <div
          style={{
            fontSize: 140,
            fontWeight: 900,
            color: '#00d8ff',
            textAlign: 'center',
            letterSpacing: '-6px',
            fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
            textShadow: `
              0 0 40px rgba(0, 216, 255, ${0.8 * glowIntensity}),
              0 0 80px rgba(0, 255, 136, ${0.4 * glowIntensity}),
              0 8px 20px rgba(0, 0, 0, 0.6)
            `,
            position: 'relative',
            zIndex: 2,
            background: `linear-gradient(135deg, #00d8ff 0%, #00ff88 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          AIRWAVE
        </div>

        {/* Accent line */}
        <div
          style={{
            width: interpolate(frame, [20, 50], [0, 500], { extrapolateRight: 'clamp' }),
            maxWidth: 500,
            height: 4,
            background: 'linear-gradient(90deg, transparent, #00d8ff, #00ff88, transparent)',
            margin: '25px auto',
            borderRadius: 2,
            boxShadow: `0 0 15px rgba(0, 216, 255, ${0.9 * glowIntensity})`,
            position: 'relative',
            zIndex: 2,
          }}
        />

        {/* Subtitle with professional spacing - FIXED BOX */}
        <div
          style={{
            fontSize: 24,
            color: '#f5f5f5',
            textAlign: 'center',
            opacity: textOpacity,
            letterSpacing: '14px',
            fontWeight: 400,
            textTransform: 'uppercase',
            fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif',
            textShadow: '0 3px 15px rgba(0, 0, 0, 0.8)',
            position: 'relative',
            zIndex: 2,
            paddingRight: '14px', // Compensate for letter-spacing
          }}
        >
          Mission Control
        </div>
      </div>

      {/* Tagline with broadcast typography */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          fontSize: 22,
          color: '#f5f5f5',
          opacity: textOpacity,
          fontWeight: 400,
          letterSpacing: '3px',
          fontFamily: '-apple-system, "SF Pro Text", sans-serif',
          textShadow: '0 2px 20px rgba(0, 0, 0, 0.8)',
        }}
      >
        {type === 'intro' ? 'REAL-TIME AVIATION INTELLIGENCE' : 'AIRWAVE.IO'}
      </div>

      {/* Professional decorative elements */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          display: 'flex',
          gap: 20,
          alignItems: 'center',
          opacity: textOpacity,
        }}
      >
        <div
          style={{
            width: interpolate(frame, [25, 55], [0, 200], { extrapolateRight: 'clamp' }),
            height: 2,
            background: 'linear-gradient(90deg, transparent, #00d8ff)',
            boxShadow: '0 0 8px rgba(0, 216, 255, 0.6)',
          }}
        />
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#00d8ff',
            boxShadow: '0 0 15px rgba(0, 216, 255, 1)',
          }}
        />
        <div
          style={{
            width: interpolate(frame, [25, 55], [0, 200], { extrapolateRight: 'clamp' }),
            height: 2,
            background: 'linear-gradient(90deg, #00ff88, transparent)',
            boxShadow: '0 0 8px rgba(0, 255, 136, 0.6)',
          }}
        />
      </div>

      {/* Vignette effect for broadcast finish */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.6) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

