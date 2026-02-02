const EventEmitter = require('events');
const turf = require('@turf/turf');

/**
 * Conflict Detector Service
 * Monitors aircraft separation and detects potential conflicts
 */
class ConflictDetector extends EventEmitter {
  constructor(aircraftTracker, trajectoryPredictor) {
    super();
    this.aircraftTracker = aircraftTracker;
    this.trajectoryPredictor = trajectoryPredictor;
    
    // Separation standards (configurable)
    this.minHorizontalSeparation = 5; // nautical miles
    this.minVerticalSeparation = 1000; // feet
    
    // Active conflicts tracking
    this.activeConflicts = new Map();
    
    // Monitoring state
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Start periodic conflict monitoring
   * @param {Number} intervalMs - Check interval in milliseconds
   */
  startMonitoring(intervalMs = 30000) {
    if (this.isMonitoring) {
      console.log('⚠️  Conflict monitoring already running');
      return;
    }

    console.log(`🛡️  Starting conflict monitoring (every ${intervalMs/1000}s)`);
    this.isMonitoring = true;
    
    // Run immediately
    this.checkConflicts();
    
    // Then run periodically
    this.monitoringInterval = setInterval(() => {
      this.checkConflicts();
    }, intervalMs);
  }

  /**
   * Stop conflict monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('🛡️  Conflict monitoring stopped');
  }

  /**
   * Check all active aircraft for conflicts
   */
  checkConflicts() {
    if (!this.aircraftTracker) {
      return;
    }

    try {
      const aircraft = this.aircraftTracker.getActiveAircraft();
      
      // Filter out aircraft without valid positions or on ground
      const flyingAircraft = aircraft.filter(ac => {
        if (!ac.current_position) return false;
        const { lat, lon, altitude } = ac.current_position;
        if (!lat || !lon) return false;
        
        // Filter out ground aircraft (altitude < 500ft or speed < 50kts)
        const alt = typeof altitude === 'number' ? altitude : parseInt(altitude) || 0;
        const speed = ac.current_position.ground_speed || 0;
        return alt > 500 && speed > 50;
      });

      console.log(`🔍 Checking conflicts for ${flyingAircraft.length} aircraft`);

      // Check all pairs
      const newConflicts = [];
      for (let i = 0; i < flyingAircraft.length; i++) {
        for (let j = i + 1; j < flyingAircraft.length; j++) {
          const conflict = this._checkAircraftPair(flyingAircraft[i], flyingAircraft[j]);
          if (conflict) {
            newConflicts.push(conflict);
          }
        }
      }

      // Update active conflicts
      this._updateConflicts(newConflicts);

    } catch (error) {
      console.error('Error checking conflicts:', error);
    }
  }

  /**
   * Check a pair of aircraft for conflicts
   */
  _checkAircraftPair(aircraft1, aircraft2) {
    const pos1 = aircraft1.current_position;
    const pos2 = aircraft2.current_position;

    // Calculate current separation
    const point1 = turf.point([pos1.lon, pos1.lat]);
    const point2 = turf.point([pos2.lon, pos2.lat]);
    const horizontalDistance = turf.distance(point1, point2, { units: 'nauticalmiles' });

    const alt1 = typeof pos1.altitude === 'number' ? pos1.altitude : parseInt(pos1.altitude) || 0;
    const alt2 = typeof pos2.altitude === 'number' ? pos2.altitude : parseInt(pos2.altitude) || 0;
    const verticalDistance = Math.abs(alt1 - alt2);

    // Check current separation
    const horizontalViolation = horizontalDistance < this.minHorizontalSeparation;
    const verticalViolation = verticalDistance < this.minVerticalSeparation;

    // Current conflict
    if (horizontalViolation && verticalViolation) {
      return this._createConflict(aircraft1, aircraft2, horizontalDistance, verticalDistance, 0, 'critical');
    }

    // Predict future conflict using trajectories
    const prediction1 = aircraft1.predicted_path || [];
    const prediction2 = aircraft2.predicted_path || [];

    if (prediction1.length > 0 && prediction2.length > 0) {
      const futureConflict = this._checkPredictedConflict(
        aircraft1, aircraft2, 
        prediction1, prediction2,
        horizontalDistance, verticalDistance
      );
      if (futureConflict) {
        return futureConflict;
      }
    }

    // Check for close encounters (warning)
    if (horizontalDistance < this.minHorizontalSeparation * 1.5 && verticalDistance < this.minVerticalSeparation * 1.5) {
      return this._createConflict(aircraft1, aircraft2, horizontalDistance, verticalDistance, 0, 'medium');
    }

    return null;
  }

  /**
   * Check predicted trajectories for future conflicts
   */
  _checkPredictedConflict(aircraft1, aircraft2, pred1, pred2, currentHDist, currentVDist) {
    let minHorizontalDist = currentHDist;
    let minVerticalDist = currentVDist;
    let timeToCPA = 0;

    // Check each prediction interval
    const maxLen = Math.min(pred1.length, pred2.length);
    for (let i = 0; i < maxLen; i++) {
      const p1 = pred1[i];
      const p2 = pred2[i];

      const point1 = turf.point([p1.lon, p1.lat]);
      const point2 = turf.point([p2.lon, p2.lat]);
      const hDist = turf.distance(point1, point2, { units: 'nauticalmiles' });
      const vDist = Math.abs((p1.altitude || 0) - (p2.altitude || 0));

      if (hDist < minHorizontalDist) {
        minHorizontalDist = hDist;
        minVerticalDist = vDist;
        // Calculate time to CPA (minutes ahead = i+1)
        timeToCPA = (i + 1) * 60; // seconds
      }

      // Found a predicted conflict
      if (hDist < this.minHorizontalSeparation && vDist < this.minVerticalSeparation) {
        const severity = timeToCPA < 120 ? 'critical' : timeToCPA < 300 ? 'high' : 'medium';
        return this._createConflict(aircraft1, aircraft2, hDist, vDist, timeToCPA, severity);
      }
    }

    return null;
  }

  /**
   * Create a conflict object
   */
  _createConflict(aircraft1, aircraft2, hDist, vDist, timeToCPA, severity) {
    const id = this._generateConflictId(aircraft1.id, aircraft2.id);
    
    return {
      id,
      aircraft_1_id: aircraft1.id,
      aircraft_2_id: aircraft2.id,
      aircraft_1_callsign: aircraft1.flight || aircraft1.tail || aircraft1.hex,
      aircraft_2_callsign: aircraft2.flight || aircraft2.tail || aircraft2.hex,
      detected_at: new Date().toISOString(),
      min_horizontal_distance: parseFloat(hDist.toFixed(2)),
      min_vertical_distance: Math.round(vDist),
      time_to_cpa: Math.round(timeToCPA),
      severity,
      status: 'active'
    };
  }

  /**
   * Generate a unique conflict ID
   */
  _generateConflictId(id1, id2) {
    const sorted = [id1, id2].sort();
    return `conflict_${sorted[0]}_${sorted[1]}_${Date.now()}`;
  }

  /**
   * Update active conflicts and emit events
   */
  _updateConflicts(newConflicts) {
    const newConflictIds = new Set(newConflicts.map(c => c.id));

    // Check for resolved conflicts
    for (const [id, conflict] of this.activeConflicts.entries()) {
      if (!newConflictIds.has(id)) {
        // Conflict resolved
        conflict.resolved_at = new Date().toISOString();
        conflict.status = 'resolved';
        this.emit('conflict_resolved', conflict);
        this.activeConflicts.delete(id);
        console.log(`✅ Conflict resolved: ${conflict.aircraft_1_callsign} <-> ${conflict.aircraft_2_callsign}`);
      }
    }

    // Check for new/updated conflicts
    for (const conflict of newConflicts) {
      const existing = this.activeConflicts.get(conflict.id);
      
      if (!existing) {
        // New conflict detected
        this.activeConflicts.set(conflict.id, conflict);
        this.emit('conflict_detected', conflict);
        console.log(`⚠️  Conflict detected: ${conflict.aircraft_1_callsign} <-> ${conflict.aircraft_2_callsign} (${conflict.severity})`);
      } else {
        // Update existing conflict
        existing.min_horizontal_distance = conflict.min_horizontal_distance;
        existing.min_vertical_distance = conflict.min_vertical_distance;
        existing.time_to_cpa = conflict.time_to_cpa;
        existing.severity = conflict.severity;
        this.emit('conflict_updated', existing);
      }
    }
  }

  /**
   * Get all active conflicts
   */
  getActiveConflicts() {
    return Array.from(this.activeConflicts.values());
  }

  /**
   * Get conflict history (would need database implementation)
   */
  getConflictHistory(startTime, endTime, limit = 100) {
    // TODO: Implement database query for conflict history
    // For now return empty array
    return [];
  }

  /**
   * Get specific conflict by ID
   */
  getConflictById(id) {
    return this.activeConflicts.get(id) || null;
  }
}

module.exports = ConflictDetector;



