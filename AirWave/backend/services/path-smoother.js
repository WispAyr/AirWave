/**
 * Path Smoother Service
 * Implements Catmull-Rom spline interpolation for flight path smoothing
 */
class PathSmoother {
  /**
   * Smooth a path using Catmull-Rom spline interpolation
   * @param {Array} trackPoints - Array of {lat, lon, altitude, timestamp} points
   * @param {Number} density - Number of interpolated points per segment (default: 10)
   * @returns {Array} Smoothed path with interpolated points
   */
  smoothPath(trackPoints, density = 10) {
    if (!trackPoints || trackPoints.length < 2) {
      return trackPoints || [];
    }

    // Need at least 4 points for Catmull-Rom spline
    if (trackPoints.length < 4) {
      return this._linearInterpolate(trackPoints, density);
    }

    const smoothedPoints = [];

    // Add first point
    smoothedPoints.push(trackPoints[0]);

    // Interpolate between points using Catmull-Rom
    for (let i = 0; i < trackPoints.length - 1; i++) {
      // Get 4 control points for Catmull-Rom
      const p0 = trackPoints[Math.max(0, i - 1)];
      const p1 = trackPoints[i];
      const p2 = trackPoints[i + 1];
      const p3 = trackPoints[Math.min(trackPoints.length - 1, i + 2)];

      // Generate interpolated points
      for (let t = 1; t <= density; t++) {
        const u = t / density;
        const point = this._catmullRomInterpolate(p0, p1, p2, p3, u);
        smoothedPoints.push(point);
      }
    }

    return smoothedPoints;
  }

  /**
   * Catmull-Rom spline interpolation
   */
  _catmullRomInterpolate(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;

    // Catmull-Rom basis matrix coefficients
    const lat = 0.5 * (
      (2 * p1.lat) +
      (-p0.lat + p2.lat) * t +
      (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2 +
      (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3
    );

    const lon = 0.5 * (
      (2 * p1.lon) +
      (-p0.lon + p2.lon) * t +
      (2 * p0.lon - 5 * p1.lon + 4 * p2.lon - p3.lon) * t2 +
      (-p0.lon + 3 * p1.lon - 3 * p2.lon + p3.lon) * t3
    );

    // Interpolate altitude if available
    let altitude = undefined;
    if (p1.altitude !== undefined && p2.altitude !== undefined) {
      const alt0 = p0.altitude || p1.altitude;
      const alt1 = p1.altitude;
      const alt2 = p2.altitude;
      const alt3 = p3.altitude || p2.altitude;

      altitude = 0.5 * (
        (2 * alt1) +
        (-alt0 + alt2) * t +
        (2 * alt0 - 5 * alt1 + 4 * alt2 - alt3) * t2 +
        (-alt0 + 3 * alt1 - 3 * alt2 + alt3) * t3
      );
    }

    // Interpolate timestamp
    const time1 = new Date(p1.timestamp).getTime();
    const time2 = new Date(p2.timestamp).getTime();
    const timestamp = new Date(time1 + (time2 - time1) * t).toISOString();

    return {
      lat,
      lon,
      altitude,
      timestamp,
      interpolated: true
    };
  }

  /**
   * Simple linear interpolation for cases with < 4 points
   */
  _linearInterpolate(trackPoints, density) {
    if (trackPoints.length < 2) {
      return trackPoints;
    }

    const smoothedPoints = [];
    smoothedPoints.push(trackPoints[0]);

    for (let i = 0; i < trackPoints.length - 1; i++) {
      const p1 = trackPoints[i];
      const p2 = trackPoints[i + 1];

      for (let t = 1; t <= density; t++) {
        const u = t / density;
        
        const lat = p1.lat + (p2.lat - p1.lat) * u;
        const lon = p1.lon + (p2.lon - p1.lon) * u;
        
        let altitude = undefined;
        if (p1.altitude !== undefined && p2.altitude !== undefined) {
          altitude = p1.altitude + (p2.altitude - p1.altitude) * u;
        }

        const time1 = new Date(p1.timestamp).getTime();
        const time2 = new Date(p2.timestamp).getTime();
        const timestamp = new Date(time1 + (time2 - time1) * u).toISOString();

        smoothedPoints.push({
          lat,
          lon,
          altitude,
          timestamp,
          interpolated: true
        });
      }
    }

    return smoothedPoints;
  }
}

module.exports = PathSmoother;



