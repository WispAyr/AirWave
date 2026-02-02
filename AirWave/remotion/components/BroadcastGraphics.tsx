import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

/**
 * Professional broadcast-quality graphic elements
 * Includes lens flares, light leaks, and atmospheric effects
 */

interface LensFlareProps {
  x: number;
  y: number;
  intensity?: number;
}

export const LensFlare: React.FC<LensFlareProps> = ({ x, y, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const pulse = Math.sin(frame / 30) * 0.2 + 0.8;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 200,
        height: 200,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    >
      {/* Main flare */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(0, 216, 255, ${0.3 * intensity * pulse}) 0%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />
      {/* Secondary glow */}
      <div
        style={{
          position: 'absolute',
          width: '60%',
          height: '60%',
          left: '20%',
          top: '20%',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255, 255, 255, ${0.4 * intensity * pulse}) 0%, transparent 60%)`,
          filter: 'blur(10px)',
        }}
      />
      {/* Core */}
      <div
        style={{
          position: 'absolute',
          width: '30%',
          height: '30%',
          left: '35%',
          top: '35%',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255, 255, 255, ${0.8 * intensity}) 0%, transparent 50%)`,
          filter: 'blur(5px)',
        }}
      />
    </div>
  );
};

interface AnimatedLineProps {
  start: { x: number; y: number };
  end: { x: number; y: number };
  color?: string;
  delay?: number;
}

export const AnimatedLine: React.FC<AnimatedLineProps> = ({
  start,
  end,
  color = '#00d8ff',
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 20,
      stiffness: 60,
    },
  });

  const currentX = start.x + (end.x - start.x) * progress;
  const currentY = start.y + (end.y - start.y) * progress;

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
        <linearGradient id={`line-gradient-${delay}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1={start.x}
        y1={start.y}
        x2={currentX}
        y2={currentY}
        stroke={`url(#line-gradient-${delay})`}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

interface ParticleFieldProps {
  count?: number;
  color?: string;
}

export const ParticleField: React.FC<ParticleFieldProps> = ({
  count = 50,
  color = '#00d8ff',
}) => {
  const frame = useCurrentFrame();

  const particles = Array.from({ length: count }, (_, i) => {
    const baseX = (i / count) * 100;
    const baseY = ((i * 7) % 100);
    const speed = 0.05 + (i % 10) * 0.01;
    const x = (baseX + frame * speed) % 100;
    const y = baseY;
    const opacity = 0.1 + Math.sin((i + frame) / 20) * 0.1;
    const size = 1 + (i % 3);

    return { x, y, opacity, size };
  });

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity: 0.3,
      }}
    >
      {particles.map((particle, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            borderRadius: '50%',
            background: color,
            opacity: particle.opacity,
            boxShadow: `0 0 ${particle.size * 2}px ${color}`,
          }}
        />
      ))}
    </div>
  );
};

interface GlitchTextProps {
  children: string;
  style?: React.CSSProperties;
}

export const GlitchText: React.FC<GlitchTextProps> = ({ children, style = {} }) => {
  const frame = useCurrentFrame();
  const shouldGlitch = frame % 180 < 3; // Glitch every 6 seconds for 3 frames

  if (!shouldGlitch) {
    return <div style={style}>{children}</div>;
  }

  const offset = (Math.random() - 0.5) * 4;

  return (
    <div style={{ position: 'relative', ...style }}>
      {/* Red channel */}
      <div
        style={{
          position: 'absolute',
          color: '#ff0000',
          transform: `translateX(${-offset}px)`,
          opacity: 0.7,
          mixBlendMode: 'screen',
        }}
      >
        {children}
      </div>
      {/* Green channel */}
      <div
        style={{
          position: 'absolute',
          color: '#00ff00',
          opacity: 0.7,
          mixBlendMode: 'screen',
        }}
      >
        {children}
      </div>
      {/* Blue channel */}
      <div
        style={{
          position: 'absolute',
          color: '#0000ff',
          transform: `translateX(${offset}px)`,
          opacity: 0.7,
          mixBlendMode: 'screen',
        }}
      >
        {children}
      </div>
      {/* Main text */}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
};

interface ScanlineEffectProps {
  intensity?: number;
}

export const ScanlineEffect: React.FC<ScanlineEffectProps> = ({ intensity = 0.05 }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: intensity,
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.5) 2px,
          rgba(0, 0, 0, 0.5) 4px
        )`,
        transform: `translateY(${(frame % 60) * 2}px)`,
      }}
    />
  );
};

