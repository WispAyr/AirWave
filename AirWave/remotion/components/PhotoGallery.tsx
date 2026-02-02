import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Img, staticFile } from 'remotion';

interface Photo {
  path: string;
  photographer?: string;
  aircraftType?: string;
  source?: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  startFrame: number;
  durationFrames: number;
}

/**
 * Beautiful photo gallery/slideshow component
 * Displays aircraft photos with Ken Burns effect and credits
 */
export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  startFrame,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (photos.length === 0) return null;

  // Calculate frames per photo
  const framesPerPhoto = Math.floor(durationFrames / photos.length);
  const localFrame = frame - startFrame;

  // Determine which photo to show
  const currentPhotoIndex = Math.min(
    Math.floor(localFrame / framesPerPhoto),
    photos.length - 1
  );
  const photoFrameProgress = (localFrame % framesPerPhoto) / framesPerPhoto;

  const currentPhoto = photos[currentPhotoIndex];
  const nextPhoto = photos[currentPhotoIndex + 1];

  // Fade transition
  const opacity = interpolate(
    localFrame,
    [startFrame, startFrame + 30],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  // Ken Burns zoom effect
  const scale = 1 + photoFrameProgress * 0.1;
  const translateX = photoFrameProgress * 5;

  // Cross-fade to next photo
  const crossFadeProgress = interpolate(
    localFrame % framesPerPhoto,
    [framesPerPhoto - 20, framesPerPhoto],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.98) 100%)',
      }}
    >
      {/* Vignette overlay for cinematic feel */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Current Photo with broadcast effects */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 1 - crossFadeProgress,
        }}
      >
        <Img
          src={currentPhoto.path}
          style={{
            maxWidth: '85%',
            maxHeight: '75%',
            objectFit: 'contain',
            transform: `scale(${scale}) translateX(${translateX}%)`,
            borderRadius: 16,
            border: '2px solid rgba(255, 255, 255, 0.1)',
            boxShadow: `
              0 40px 120px rgba(0, 0, 0, 0.9),
              0 0 60px rgba(0, 216, 255, 0.15),
              0 0 0 1px rgba(255, 255, 255, 0.08),
              inset 0 1px 0 0 rgba(255, 255, 255, 0.15)
            `,
            filter: 'contrast(1.08) saturate(1.15) brightness(1.05)',
          }}
        />
      </div>

      {/* Next Photo (for cross-fade) */}
      {nextPhoto && (
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: crossFadeProgress,
          }}
        >
          <Img
            src={nextPhoto.path}
            style={{
              maxWidth: '85%',
              maxHeight: '75%',
              objectFit: 'contain',
              borderRadius: 16,
              border: '2px solid rgba(255, 255, 255, 0.1)',
              boxShadow: `
                0 40px 120px rgba(0, 0, 0, 0.9),
                0 0 60px rgba(0, 216, 255, 0.15)
              `,
              filter: 'contrast(1.08) saturate(1.15) brightness(1.05)',
            }}
          />
        </div>
      )}

      {/* Broadcast-quality metadata overlay with enhanced gradient */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '50px 90px',
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.75) 40%, transparent 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        {/* Photo counter - Broadcast style */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 15,
          }}
        >
          <div
            style={{
              fontSize: 20,
              color: '#00d8ff',
              fontWeight: 700,
              fontFamily: '-apple-system, "SF Pro Display", monospace',
              letterSpacing: '1px',
              textShadow: '0 0 15px rgba(0, 216, 255, 0.6), 0 2px 4px rgba(0, 0, 0, 0.8)',
            }}
          >
            {String(currentPhotoIndex + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
          </div>
          <div
            style={{
              width: 3,
              height: 30,
              background: 'linear-gradient(to bottom, #00d8ff, #00ff88)',
              borderRadius: 2,
              boxShadow: '0 0 10px rgba(0, 216, 255, 0.5)',
            }}
          />
          <div
            style={{
              fontSize: 14,
              color: 'rgba(245, 245, 245, 0.7)',
              fontWeight: 500,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontFamily: '-apple-system, "SF Pro Text", sans-serif',
            }}
          >
            Aircraft Gallery
          </div>
        </div>

        {/* Credits - Professional layout */}
        <div style={{ textAlign: 'right' }}>
          {currentPhoto.aircraftType && (
            <div
              style={{
                fontSize: 15,
                color: 'rgba(245, 245, 245, 0.6)',
                marginBottom: 6,
                fontWeight: 400,
                letterSpacing: '0.5px',
                fontFamily: '-apple-system, "SF Pro Text", sans-serif',
              }}
            >
              {currentPhoto.aircraftType}
            </div>
          )}
          {currentPhoto.photographer && (
            <div
              style={{
                fontSize: 17,
                color: '#f5f5f5',
                fontWeight: 500,
                letterSpacing: '0.3px',
                fontFamily: '-apple-system, "SF Pro Text", sans-serif',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
              }}
            >
              📸 {currentPhoto.photographer}
            </div>
          )}
          {currentPhoto.source && (
            <div
              style={{
                fontSize: 13,
                color: 'rgba(245, 245, 245, 0.5)',
                marginTop: 4,
                fontWeight: 400,
                letterSpacing: '1px',
                fontFamily: '-apple-system, "SF Pro Text", sans-serif',
              }}
            >
              via {currentPhoto.source}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

