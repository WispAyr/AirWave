const EventEmitter = require('events');

/**
 * Aircraft Tracker Service
 * Manages aircraft tracks with position history for ADS-B data
 */
class AircraftTracker extends EventEmitter {
  constructor(database, trajectoryPredictor = null) {
    super();
    this.database = database;
    this.trajectoryPredictor = trajectoryPredictor;
    this.activeAircraft = new Map(); // In-memory cache of active aircraft
    this.trackUpdateInterval = 5000; // Update database every 5 seconds
    this.maxTrackPoints = 1000; // Max position points per track
    this.trackTimeout = 1200000; // 20 minutes - allow time for parking logic (15m) to trigger
  }

  /**
   * Set trajectory predictor (for late initialization)
   */
  setTrajectoryPredictor(predictor) {
    this.trajectoryPredictor = predictor;
  }

  /**
   * Update aircraft position
   * @param {Object} aircraft - Aircraft data from ADS-B
   */
  updateAircraft(aircraft) {
    // Use hex as primary key (most reliable identifier)
    const key = aircraft.hex || aircraft.tail || aircraft.id;
    const now = Date.now();

    let track = this.activeAircraft.get(key);

    if (!track) {
      // New aircraft track
      track = {
        id: key,  // This becomes aircraft_id in database
        hex: aircraft.hex,
        flight: aircraft.flight,
        tail: aircraft.tail,
        aircraft_type: aircraft.aircraft_type,
        first_seen: now,
        last_seen: now,
        positions: [],
        last_db_update: 0
      };
      this.activeAircraft.set(key, track);
      console.log(`✈️  New aircraft track: ${aircraft.flight || aircraft.hex || key}`);
    }

    // Update track metadata
    track.flight = aircraft.flight || track.flight;
    track.tail = aircraft.tail || track.tail;
    track.aircraft_type = aircraft.aircraft_type || track.aircraft_type;
    track.last_seen = now;

    // Add position if it has valid lat/lon
    if (aircraft.position?.lat && aircraft.position?.lon) {
      const position = {
        timestamp: now,
        lat: aircraft.position.lat,
        lon: aircraft.position.lon,
        altitude: aircraft.position.altitude,
        ground_speed: aircraft.ground_speed,
        heading: aircraft.heading,
        vertical_rate: aircraft.vertical_rate,
        squawk: aircraft.squawk
      };

      // Only add if position has changed significantly
      if (this.shouldAddPosition(track.positions, position)) {
        track.positions.push(position);

        // Trim old positions if exceeding max
        if (track.positions.length > this.maxTrackPoints) {
          track.positions = track.positions.slice(-this.maxTrackPoints);
        }
      }
    }

    // Generate trajectory prediction if predictor available
    if (this.trajectoryPredictor && track.positions.length >= 2) {
      try {
        const prediction = this.trajectoryPredictor.predictTrajectory(track, 10);
        if (prediction) {
          track.predicted_path = prediction.predicted_path;
          track.prediction_generated_at = prediction.prediction_generated_at;
          track.prediction_confidence = prediction.prediction_confidence;
        }
      } catch (error) {
        console.error('Error generating trajectory prediction:', error);
        // Continue without prediction
      }
    }

    // Update database periodically (not every position update)
    if (now - track.last_db_update > this.trackUpdateInterval) {
      this.saveTrackToDatabase(track);
      track.last_db_update = now;
    }

    // Emit update event (now includes predicted_path)
    this.emit('aircraft:update', track);
  }

  /**
   * Check if position should be added (avoid duplicate/insignificant updates)
   */
  shouldAddPosition(positions, newPos) {
    if (positions.length === 0) return true;

    const lastPos = positions[positions.length - 1];

    // Time difference (at least 1 second)
    if (newPos.timestamp - lastPos.timestamp < 1000) return false;

    // Position difference (at least 0.001 degrees ~100m)
    const latDiff = Math.abs(newPos.lat - lastPos.lat);
    const lonDiff = Math.abs(newPos.lon - lastPos.lon);

    if (latDiff < 0.001 && lonDiff < 0.001) return false;

    return true;
  }

  /**
   * Save track to database
   */
  saveTrackToDatabase(track) {
    if (!this.database) return;

    try {
      this.database.saveAircraftTrack({
        aircraft_id: track.id,
        hex: track.hex,
        flight: track.flight,
        tail: track.tail,
        aircraft_type: track.aircraft_type,
        first_seen: new Date(track.first_seen).toISOString(),
        last_seen: new Date(track.last_seen).toISOString(),
        position_count: track.positions.length,
        current_position: track.positions[track.positions.length - 1],
        track_points: track.positions.slice(-100), // Store last 100 points
        predicted_path: track.predicted_path ? JSON.stringify(track.predicted_path) : null,
        prediction_generated_at: track.prediction_generated_at || null,
        prediction_confidence: track.prediction_confidence || null
      });
    } catch (error) {
      console.error('Error saving aircraft track:', error);
    }
  }

  /**
   * Get active aircraft
   */
  getActiveAircraft() {
    const now = Date.now();
    const active = [];

    for (const [key, track] of this.activeAircraft.entries()) {
      if (now - track.last_seen < this.trackTimeout) {
        active.push({
          id: track.id,
          hex: track.hex,
          flight: track.flight,
          tail: track.tail,
          aircraft_type: track.aircraft_type,
          first_seen: track.first_seen,
          last_seen: track.last_seen,
          position_count: track.positions.length,
          current_position: track.positions[track.positions.length - 1],
          predicted_path: track.predicted_path || [],
          prediction_confidence: track.prediction_confidence || 0
        });
      }
    }

    return active;
  }

  /**
   * Get track for specific aircraft
   */
  getTrack(aircraftId) {
    return this.activeAircraft.get(aircraftId);
  }

  /**
   * Clean up stale tracks
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    // EGPK Coordinates (Prestwick)
    const EGPK_LAT = 55.5094;
    const EGPK_LON = -4.5944;

    for (const [key, track] of this.activeAircraft.entries()) {
      const timeSinceSeen = now - track.last_seen;

      // Auto-parking logic for EGPK
      // If > 15 mins (900000ms) and < trackTimeout (so we catch it before strict deletion if timeout is larger, 
      // or we handle it right before deletion)
      // Actually user said "no updates in over 15 mins".
      // Let's check if it's at EGPK and stalling.

      if (timeSinceSeen > 900000) { // 15 minutes
        const lastPos = track.positions[track.positions.length - 1];
        if (lastPos) {
          // Check distance to EGPK (simple approx)
          const latDiff = Math.abs(lastPos.lat - EGPK_LAT);
          const lonDiff = Math.abs(lastPos.lon - EGPK_LON);

          // Approx 5km radius (0.05 deg roughly)
          if (latDiff < 0.05 && lonDiff < 0.08) {
            // It's at EGPK. Is it on ground?
            // heuristic: altitude < 500ft or ground_speed < 30kts or explicitly on ground (if we had that flag)
            if (lastPos.altitude < 500 || lastPos.ground_speed < 30) {
              if (track.status !== 'parking') {
                track.status = 'parking';
                console.log(`🅿️  Auto-parking EGPK aircraft: ${track.flight || track.hex} (Inactive > 15m)`);
                this.emit('aircraft:update', track); // Notify frontend of status change
                this.saveTrackToDatabase(track); // Save the status

                // If we want to keep it visible as "parking", we might NOT want to delete it yet?
                // But the cleanup loop below deletes if > trackTimeout.
                // If trackTimeout is 10 mins (600000), this 15 min check will never fire for active tracks unless we increase timeout.
                // I should increase trackTimeout or handle this differently.
                // For now, I'll assume I should update the status before it gets removed, 
                // BUT if trackTimeout < 15mins, it's already gone.
                // User request implies persistence or longer visibility.
                // let's bump `last_seen` to keep it alive? No, that falsifies data.
              }
            }
          }
        }
      }

      if (timeSinceSeen > this.trackTimeout) {
        // Save final state to database
        this.saveTrackToDatabase(track);
        this.activeAircraft.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} stale aircraft tracks`);
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

module.exports = AircraftTracker;

