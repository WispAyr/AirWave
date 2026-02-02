// Utility functions for converting geographic coordinates to pixel positions

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp?: number;
}

/**
 * Calculate the bounding box for a set of track points
 */
export function calculateBounds(trackPoints: TrackPoint[]): Bounds {
  if (trackPoints.length === 0) {
    return { north: 0, south: 0, east: 0, west: 0 };
  }

  let north = trackPoints[0].lat;
  let south = trackPoints[0].lat;
  let east = trackPoints[0].lon;
  let west = trackPoints[0].lon;

  trackPoints.forEach(point => {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lon);
    west = Math.min(west, point.lon);
  });

  // Add 10% padding to the bounds
  const latPadding = (north - south) * 0.1;
  const lonPadding = (east - west) * 0.1;

  return {
    north: north + latPadding,
    south: south - latPadding,
    east: east + lonPadding,
    west: west - lonPadding,
  };
}

/**
 * Convert latitude/longitude to pixel coordinates using Web Mercator projection
 */
export function latLonToPixel(
  lat: number,
  lon: number,
  bounds: Bounds,
  width: number,
  height: number
): { x: number; y: number } {
  // Normalize coordinates to 0-1 range
  const x = (lon - bounds.west) / (bounds.east - bounds.west);
  
  // For latitude, we need to use the Mercator projection
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  
  const boundsNorthRad = (bounds.north * Math.PI) / 180;
  const boundsSouthRad = (bounds.south * Math.PI) / 180;
  const boundsMercN = Math.log(Math.tan(Math.PI / 4 + boundsNorthRad / 2));
  const boundsMercS = Math.log(Math.tan(Math.PI / 4 + boundsSouthRad / 2));
  
  const y = (boundsMercN - mercN) / (boundsMercN - boundsMercS);

  return {
    x: x * width,
    y: y * height,
  };
}

/**
 * Calculate an appropriate zoom level for the given bounds
 * This is used for static map tile services
 */
export function calculateZoomLevel(
  bounds: Bounds,
  width: number,
  height: number
): number {
  const WORLD_DIM = { height: 256, width: 256 };
  const ZOOM_MAX = 21;

  function latRad(lat: number) {
    const sin = Math.sin((lat * Math.PI) / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
  }

  function zoom(mapPx: number, worldPx: number, fraction: number) {
    return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
  }

  const latFraction = (latRad(bounds.north) - latRad(bounds.south)) / Math.PI;
  const lngDiff = bounds.east - bounds.west;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const latZoom = zoom(height, WORLD_DIM.height, latFraction);
  const lngZoom = zoom(width, WORLD_DIM.width, lngFraction);

  return Math.min(latZoom, lngZoom, ZOOM_MAX);
}

/**
 * Get the center point of the bounds
 */
export function getBoundsCenter(bounds: Bounds): { lat: number; lon: number } {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lon: (bounds.east + bounds.west) / 2,
  };
}





