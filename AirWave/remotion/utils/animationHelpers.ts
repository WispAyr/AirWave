// Helper functions for animation timing and interpolation

export interface TrackPoint {
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  heading: number;
  timestamp: number;
}

/**
 * Calculate the duration of the video in frames based on track length
 * @param trackPoints Array of track points
 * @param fps Frames per second (default 30)
 * @param minDuration Minimum duration in seconds (default 5)
 * @param maxDuration Maximum duration in seconds (default 30)
 * @returns Duration in frames
 */
export function calculateDuration(
  trackPoints: TrackPoint[],
  fps: number = 30,
  minDuration: number = 5,
  maxDuration: number = 30
): number {
  if (trackPoints.length === 0) {
    return minDuration * fps;
  }

  // Calculate duration based on track length (1 point per second as baseline)
  const durationSeconds = Math.min(
    Math.max(trackPoints.length / 10, minDuration),
    maxDuration
  );

  return Math.floor(durationSeconds * fps);
}

/**
 * Get the interpolated track point for a given frame
 * @param frame Current frame number
 * @param trackPoints Array of track points
 * @param totalFrames Total frames in the video
 * @returns Interpolated track point
 */
export function getTrackPointAtFrame(
  frame: number,
  trackPoints: TrackPoint[],
  totalFrames: number
): TrackPoint {
  if (trackPoints.length === 0) {
    return {
      lat: 0,
      lon: 0,
      altitude: 0,
      speed: 0,
      heading: 0,
      timestamp: Date.now(),
    };
  }

  if (trackPoints.length === 1) {
    return trackPoints[0];
  }

  // Calculate the exact position in the track points array
  const progress = frame / totalFrames;
  const exactIndex = progress * (trackPoints.length - 1);
  const index = Math.floor(exactIndex);
  const fraction = exactIndex - index;

  // If we're at or past the last point, return it
  if (index >= trackPoints.length - 1) {
    return trackPoints[trackPoints.length - 1];
  }

  // Interpolate between the two surrounding points
  const point1 = trackPoints[index];
  const point2 = trackPoints[index + 1];

  return interpolateTrackData(fraction, point1, point2);
}

/**
 * Interpolate between two track points
 * @param fraction Fraction between 0 and 1
 * @param point1 First track point
 * @param point2 Second track point
 * @returns Interpolated track point
 */
export function interpolateTrackData(
  fraction: number,
  point1: TrackPoint,
  point2: TrackPoint
): TrackPoint {
  return {
    lat: point1.lat + (point2.lat - point1.lat) * fraction,
    lon: point1.lon + (point2.lon - point1.lon) * fraction,
    altitude: Math.round(point1.altitude + (point2.altitude - point1.altitude) * fraction),
    speed: Math.round(point1.speed + (point2.speed - point1.speed) * fraction),
    heading: interpolateHeading(point1.heading, point2.heading, fraction),
    timestamp: Math.round(point1.timestamp + (point2.timestamp - point1.timestamp) * fraction),
  };
}

/**
 * Interpolate heading (angle) properly handling the 0/360 boundary
 * @param heading1 First heading in degrees
 * @param heading2 Second heading in degrees
 * @param fraction Fraction between 0 and 1
 * @returns Interpolated heading
 */
function interpolateHeading(heading1: number, heading2: number, fraction: number): number {
  // Normalize headings to 0-360 range
  heading1 = ((heading1 % 360) + 360) % 360;
  heading2 = ((heading2 % 360) + 360) % 360;

  // Calculate the shortest path between the two headings
  let diff = heading2 - heading1;
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }

  const result = heading1 + diff * fraction;
  return ((result % 360) + 360) % 360;
}

/**
 * Get visible track points up to the current frame
 * @param frame Current frame number
 * @param trackPoints Array of track points
 * @param totalFrames Total frames in the video
 * @returns Array of visible track points
 */
export function getVisibleTrackPoints(
  frame: number,
  trackPoints: TrackPoint[],
  totalFrames: number
): TrackPoint[] {
  const progress = frame / totalFrames;
  const visibleCount = Math.ceil(progress * trackPoints.length);
  return trackPoints.slice(0, visibleCount);
}

/**
 * Format altitude for display
 * @param altitude Altitude in feet
 * @returns Formatted altitude string
 */
export function formatAltitude(altitude: number): string {
  return `${altitude.toLocaleString()} ft`;
}

/**
 * Format speed for display
 * @param speed Speed in knots
 * @returns Formatted speed string
 */
export function formatSpeed(speed: number): string {
  return `${Math.round(speed)} kts`;
}

/**
 * Format heading for display
 * @param heading Heading in degrees
 * @returns Formatted heading string
 */
export function formatHeading(heading: number): string {
  return `${Math.round(heading).toString().padStart(3, '0')}°`;
}

/**
 * Format timestamp for display
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted time string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}





