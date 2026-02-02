const turf = require('@turf/turf');

/**
 * Trajectory Predictor Service
 * Calculates future aircraft positions using kinematic models
 */
class TrajectoryPredictor {
  constructor() {
    this.defaultHorizonMinutes = 10;
    this.minDataFreshness = 60000; // 60 seconds
  }

  /**
   * Predict aircraft trajectory
   * @param {Object} track - Aircraft track data with positions and velocity
   * @param {Number} horizonMinutes - Prediction time horizon in minutes
   * @returns {Object} Prediction result with waypoints and metadata
   */
  predictTrajectory(track, horizonMinutes = this.defaultHorizonMinutes) {
    try {
      // Validate input
      if (!track || !track.positions || track.positions.length === 0) {
        return null;
      }

      const currentPosition = track.positions[track.positions.length - 1];
      
      // Check if we have required data
      if (!currentPosition.lat || !currentPosition.lon) {
        return null;
      }

      // Check data freshness
      const now = Date.now();
      const positionAge = now - new Date(currentPosition.timestamp).getTime();
      if (positionAge > this.minDataFreshness * 10) {
        // Data too old, low confidence
        return this._generatePrediction(track, horizonMinutes, 0.1);
      }

      // Calculate confidence based on data quality
      const confidence = this._calculateConfidence(track, positionAge);

      return this._generatePrediction(track, horizonMinutes, confidence);
    } catch (error) {
      console.error('Error predicting trajectory:', error);
      return null;
    }
  }

  /**
   * Generate prediction using kinematic model
   */
  _generatePrediction(track, horizonMinutes, confidence) {
    const currentPosition = track.positions[track.positions.length - 1];
    const predictedPath = [];
    
    // Get velocity vector
    const { heading, ground_speed, vertical_rate } = this._getVelocityVector(track);
    
    // Check if aircraft is stationary or on ground
    if (!ground_speed || ground_speed < 50) {
      // Aircraft stationary or taxiing, no meaningful prediction
      return {
        predicted_path: [],
        prediction_generated_at: new Date().toISOString(),
        prediction_confidence: 0.05,
        horizon_minutes: horizonMinutes,
        note: 'Aircraft stationary or insufficient speed for prediction'
      };
    }

    // Generate waypoints at 1-minute intervals
    const intervals = horizonMinutes;
    const startTime = new Date(currentPosition.timestamp);

    for (let i = 1; i <= intervals; i++) {
      const minutesAhead = i;
      const secondsAhead = minutesAhead * 60;
      
      // Calculate distance traveled (speed in knots to nautical miles)
      const distanceNm = (ground_speed / 60) * minutesAhead;
      
      // Use turf to calculate destination point
      const from = turf.point([currentPosition.lon, currentPosition.lat]);
      const destination = turf.destination(from, distanceNm, heading, { units: 'nauticalmiles' });
      
      // Calculate future altitude
      let futureAltitude = currentPosition.altitude || 0;
      if (vertical_rate && typeof currentPosition.altitude === 'number') {
        const altitudeChange = (vertical_rate / 60) * minutesAhead; // ft/min to ft
        futureAltitude = Math.max(0, currentPosition.altitude + altitudeChange);
      }
      
      const eta = new Date(startTime.getTime() + secondsAhead * 1000);
      
      predictedPath.push({
        lat: destination.geometry.coordinates[1],
        lon: destination.geometry.coordinates[0],
        altitude: Math.round(futureAltitude),
        eta: eta.toISOString(),
        confidence: confidence * (1 - (i / intervals) * 0.3) // Decay confidence over time
      });
    }

    return {
      predicted_path: predictedPath,
      prediction_generated_at: new Date().toISOString(),
      prediction_confidence: confidence,
      horizon_minutes: horizonMinutes,
      velocity: {
        ground_speed,
        heading,
        vertical_rate
      }
    };
  }

  /**
   * Get velocity vector from track history
   */
  _getVelocityVector(track) {
    const currentPosition = track.positions[track.positions.length - 1];
    
    // Use current values if available
    let heading = currentPosition.heading;
    let ground_speed = currentPosition.ground_speed;
    let vertical_rate = currentPosition.vertical_rate || 0;

    // If heading/speed not available, calculate from position history
    if ((!heading || !ground_speed) && track.positions.length >= 2) {
      const prevPosition = track.positions[track.positions.length - 2];
      
      // Calculate heading from two points
      const from = turf.point([prevPosition.lon, prevPosition.lat]);
      const to = turf.point([currentPosition.lon, currentPosition.lat]);
      heading = turf.bearing(from, to);
      if (heading < 0) heading += 360;
      
      // Calculate ground speed from distance and time
      const distance = turf.distance(from, to, { units: 'nauticalmiles' });
      const timeDiff = (new Date(currentPosition.timestamp) - new Date(prevPosition.timestamp)) / 1000 / 3600; // hours
      ground_speed = timeDiff > 0 ? distance / timeDiff : 0;

      // Calculate vertical rate if altitudes available
      if (prevPosition.altitude && currentPosition.altitude) {
        const altDiff = currentPosition.altitude - prevPosition.altitude;
        const timeMinutes = (new Date(currentPosition.timestamp) - new Date(prevPosition.timestamp)) / 1000 / 60;
        vertical_rate = timeMinutes > 0 ? altDiff / timeMinutes : 0;
      }
    }

    return {
      heading: heading || 0,
      ground_speed: ground_speed || 0,
      vertical_rate: vertical_rate || 0
    };
  }

  /**
   * Calculate confidence score based on data quality
   */
  _calculateConfidence(track, positionAge) {
    let confidence = 1.0;

    // Decay based on data age
    if (positionAge > this.minDataFreshness) {
      confidence *= Math.max(0.3, 1 - (positionAge / (this.minDataFreshness * 5)));
    }

    // Increase confidence with more track points
    const pointCount = track.positions.length;
    if (pointCount < 3) {
      confidence *= 0.5;
    } else if (pointCount < 5) {
      confidence *= 0.7;
    }

    // Check velocity consistency
    const lastPositions = track.positions.slice(-3);
    if (lastPositions.length >= 2) {
      const speeds = lastPositions
        .filter(p => p.ground_speed)
        .map(p => p.ground_speed);
      
      if (speeds.length >= 2) {
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - avgSpeed, 2), 0) / speeds.length;
        const stdDev = Math.sqrt(variance);
        
        // Lower confidence if speed varies significantly
        if (stdDev > avgSpeed * 0.3) {
          confidence *= 0.7;
        }
      }
    }

    return Math.max(0.05, Math.min(1.0, confidence));
  }
}

module.exports = TrajectoryPredictor;



