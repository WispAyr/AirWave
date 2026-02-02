import React from 'react';
import { Composition } from 'remotion';
import { registerRoot } from 'remotion';
import { AircraftTrackVideo } from './compositions/AircraftTrackVideo';

// Extended types for enhanced video features
export interface Photo {
  path: string;
  photographer?: string;
  aircraftType?: string;
  source?: string;
}

export interface AltitudeProfile {
  min: number;
  max: number;
  avg: number;
  points: Array<{
    time: number;
    altitude: number;
    speed: number;
  }>;
}

export interface FlightStatus {
  phase: string;
  description: string;
  altitude: number;
  speed: number;
  trackLength: number;
  duration: number;
}

// Define the input props interface for the aircraft track video composition
export interface AircraftTrackVideoProps {
  // Aircraft metadata
  flight: string;
  tail: string;
  type: string;
  
  // Track points with position and metadata
  trackPoints: {
    lat: number;
    lon: number;
    altitude: number;
    speed: number;
    heading: number;
    timestamp: number;
  }[];

  // Photos for gallery
  photos?: Photo[];

  // Altitude profile data
  altitudeProfile?: AltitudeProfile;

  // Flight status
  flightStatus?: FlightStatus;
  
  // Styling options
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
    accentColor?: string;
  };
  
  // Video options
  durationSeconds?: number;
}

// Calculate duration based on track points (default 15 seconds for enhanced video)
const calculateDuration = (props: AircraftTrackVideoProps): number => {
  const durationSeconds = props.durationSeconds || 15;
  return durationSeconds * 30; // 30 fps
};

// Register the root component - REQUIRED by Remotion
registerRoot(() => {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Composition, {
      id: "AircraftTrackVideo",
      component: AircraftTrackVideo,
      durationInFrames: 450, // 15 seconds default
      fps: 30,
      width: 1920,
      height: 1080,
      defaultProps: {
        flight: 'N/A',
        tail: 'N/A',
        type: 'Unknown',
        trackPoints: [],
        photos: [],
        altitudeProfile: {
          min: 0,
          max: 35000,
          avg: 20000,
          points: []
        },
        flightStatus: {
          phase: 'CRUISE',
          description: 'Cruising',
          altitude: 35000,
          speed: 450,
          trackLength: 0,
          duration: 0
        },
        theme: {
          primaryColor: '#00d8ff',
          secondaryColor: '#00ff88',
          backgroundColor: '#0a0e27',
          accentColor: '#ff6b6b',
        },
        durationSeconds: 15,
      },
      calculateMetadata: ({ props }: { props: AircraftTrackVideoProps }) => {
        return {
          durationInFrames: calculateDuration(props),
          props,
        };
      },
    })
  );
});
