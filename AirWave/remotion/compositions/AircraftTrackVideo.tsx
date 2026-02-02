import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { AircraftTrackVideoProps } from '../index';
import { calculateBounds } from '../utils/coordinateConverter';
import { MapBackground } from '../components/MapBackground';
import { FlightPath } from '../components/FlightPath';
import { AircraftIcon } from '../components/AircraftIcon';
import { MetadataOverlay } from '../components/MetadataOverlay';
import { AirWaveBumper } from '../components/AirWaveBumper';
import { USAFBumper } from '../components/USAFBumper';
import { PhotoGallery } from '../components/PhotoGallery';
import { AltitudeChart } from '../components/AltitudeChart';
import { FlightStatusBanner } from '../components/FlightStatusBanner';

/**
 * Main composition that renders the aircraft track animation video
 * Enhanced with photos, altitude chart, flight status, and branded bumpers
 */
export const AircraftTrackVideo: React.FC<AircraftTrackVideoProps> = ({
  flight,
  tail,
  type,
  trackPoints,
  photos = [],
  altitudeProfile,
  flightStatus,
  theme = {
    primaryColor: '#00d8ff',
    secondaryColor: '#00ff88',
    backgroundColor: '#0a0e27',
    accentColor: '#ff6b6b',
  },
  durationSeconds = 15,
}) => {
  // Video dimensions (from composition config)
  const width = 1920;
  const height = 1080;
  const totalFrames = durationSeconds * 30; // 30 fps

  // Detect if this is a US Air Force aircraft
  const isUSAF = type.includes('E-6B') || type.includes('E-4B') || type.includes('KC-135') || 
                 type.includes('KC-46') || type.includes('C-17') || type.includes('C-130') ||
                 flight.includes('RCH') || flight.includes('REACH') || flight.includes('SPUR');

  // Timing breakdown
  const usafBumperDuration = isUSAF ? 75 : 0; // 2.5 seconds for USAF intro
  const introDuration = 60; // 2 seconds
  const mainContentDuration = totalFrames - introDuration - usafBumperDuration - 60; // Leave 2s for outro
  const outroDuration = 60; // 2 seconds
  const photoGalleryDuration = photos.length > 0 ? Math.min(120, mainContentDuration / 3) : 0;
  const trackAnimationStart = introDuration + usafBumperDuration;
  const trackAnimationDuration = mainContentDuration - photoGalleryDuration;

  // Calculate bounds from track points
  const bounds = calculateBounds(trackPoints);

  // Handle edge case: no track points
  if (trackPoints.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: theme.backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          color: '#ffffff',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
          <div style={{ fontSize: 24 }}>No Track Data Available</div>
          <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.6)', marginTop: 10 }}>
            {flight || 'Unknown Flight'}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.backgroundColor,
        fontFamily: 'monospace',
      }}
    >
      {/* Intro Bumper */}
      <Sequence durationInFrames={introDuration}>
        <AirWaveBumper type="intro" />
      </Sequence>

      {/* USAF Bumper (if military aircraft) */}
      {isUSAF && (
        <Sequence from={introDuration} durationInFrames={usafBumperDuration}>
          <USAFBumper flight={flight} type={type} />
        </Sequence>
      )}

      {/* Main Content */}
      <Sequence from={trackAnimationStart} durationInFrames={mainContentDuration}>
        <AbsoluteFill>
          {/* Background map layer */}
          <MapBackground bounds={bounds} width={width} height={height} />

          {/* Flight path animation layer */}
          <FlightPath
            trackPoints={trackPoints}
            bounds={bounds}
            width={width}
            height={height}
            totalFrames={trackAnimationDuration}
            color={theme.primaryColor}
          />

          {/* Aircraft icon animation layer */}
          <AircraftIcon
            trackPoints={trackPoints}
            bounds={bounds}
            width={width}
            height={height}
            color={theme.secondaryColor}
          />

          {/* Metadata overlay layer */}
          <MetadataOverlay
            flight={flight}
            tail={tail}
            type={type}
            trackPoints={trackPoints}
            totalFrames={trackAnimationDuration}
            primaryColor={theme.primaryColor}
            secondaryColor={theme.secondaryColor}
          />

          {/* Flight Status Banner */}
          {flightStatus && (
            <FlightStatusBanner
              flightStatus={flightStatus}
              flight={flight}
              tail={tail}
              type={type}
              startFrame={0}
            />
          )}

          {/* Altitude Chart (lower portion, not overlapping map) */}
          {altitudeProfile && altitudeProfile.points.length > 0 && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: width, height: 280, zIndex: 50 }}>
              <AltitudeChart
                altitudeProfile={altitudeProfile}
                width={width}
                height={280}
                startFrame={30}
                durationFrames={trackAnimationDuration - 30}
              />
            </div>
          )}
        </AbsoluteFill>
      </Sequence>

      {/* Photo Gallery */}
      {photos.length > 0 && (
        <Sequence from={trackAnimationStart + trackAnimationDuration} durationInFrames={photoGalleryDuration}>
          <PhotoGallery
            photos={photos}
            startFrame={0}
            durationFrames={photoGalleryDuration}
          />
        </Sequence>
      )}

      {/* Outro Bumper */}
      <Sequence from={totalFrames - outroDuration} durationInFrames={outroDuration}>
        <AirWaveBumper type="outro" />
      </Sequence>
    </AbsoluteFill>
  );
};

