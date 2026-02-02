const EventEmitter = require('events');

/**
 * HFGCS Aircraft Tracker Service
 * Tracks E-6B Mercury and E-4B Nightwatch aircraft
 */
class HFGCSAircraftTracker extends EventEmitter {
  constructor(database, aircraftTracker) {
    super();
    this.database = database;
    this.aircraftTracker = aircraftTracker;
    this.activeHFGCSAircraft = new Map(); // In-memory cache of HFGCS aircraft
    this.trackTimeout = 1800000; // 30 minutes - longer due to mission duration
    
    // E-4B hex codes (confirmed)
    this.E4B_HEX_CODES = new Set([
      'ADFEB3', // 73-1676
      'ADFEB4', // 73-1677
      'ADFEB5', // 74-0787
      'ADFEB6'  // 75-0125
    ]);
    
    // E-6B Bureau Numbers and derived hex codes
    // BuNo range: 162782-162797, 163918-163919, 164387-164410
    this.E6B_HEX_CODES = new Set([
      'AE0C6E', 'AE0C6F', 'AE0C70', 'AE0C71', 'AE0C72', 'AE0C73', 'AE0C74', 'AE0C75',
      'AE0C76', 'AE0C77', 'AE0C78', 'AE0C79', 'AE0C7A', 'AE0C7B', 'AE0C7C', 'AE0C7D',
      'AE1026', 'AE1027', 'AE140B', 'AE140C', 'AE140D', 'AE140E', 'AE140F', 'AE1410',
      'AE1411', 'AE1412', 'AE1413', 'AE1414', 'AE1415', 'AE1416', 'AE1417', 'AE1418',
      'AE1419', 'AE141A', 'AE141B', 'AE141C', 'AE141D', 'AE141E', 'AE141F', 'AE1420',
      'AE1421', 'AE1422'
    ]);
    
    // B-1B Lancer hex codes (add as discovered)
    this.B1_HEX_CODES = new Set([]);
    
    // B-52 Stratofortress hex codes (add as discovered)
    this.B52_HEX_CODES = new Set([]);
    
    // KC-135 Stratotanker callsign-based detection
    this.KC135_HEX_CODES = new Set([]);
    
    // KC-46 Pegasus callsign-based detection
    this.KC46_HEX_CODES = new Set([]);
    
    // Known callsign patterns
    this.E6B_CALLSIGN_PATTERNS = ['IRON', 'GOTO'];
    this.E4B_CALLSIGN_PATTERNS = ['GORDO', 'TITAN', 'SLICK'];
    this.B1_CALLSIGN_PATTERNS = ['BONE', 'LANCER'];
    this.B52_CALLSIGN_PATTERNS = ['BUFF', 'HOBO'];
    this.KC135_CALLSIGN_PATTERNS = ['PACK', 'GOLD', 'SPAR'];
    this.KC46_CALLSIGN_PATTERNS = ['PEGASUS', 'RCH'];
    
    // Aircraft type patterns (exact match with word boundaries)
    this.E6B_TYPE_PATTERNS = ['E-6B', 'E6B', 'TACAMO'];
    this.E4B_TYPE_PATTERNS = ['E-4B', 'E4B', 'NIGHTWATCH'];
    this.B1_TYPE_PATTERNS = ['B-1B', 'B1B', 'B-1', 'LANCER'];
    this.B52_TYPE_PATTERNS = ['B-52', 'B52', 'STRATOFORTRESS', 'BUFF'];
    this.KC135_TYPE_PATTERNS = ['KC-135', 'KC135', 'STRATOTANKER'];
    this.KC46_TYPE_PATTERNS = ['KC-46', 'KC46', 'PEGASUS'];
    
    // Track which aircraft types are enabled (all enabled by default)
    this.enabledTypes = new Set(['E-4B', 'E-6B', 'B-1B', 'B-52', 'KC-135', 'KC-46']);
    
    this.stats = {
      totalDetected: 0,
      e6bCount: 0,
      e4bCount: 0,
      totalMessages: 0,
      lastActivity: null
    };
  }

  /**
   * Check if message is from HFGCS aircraft
   * @param {Object} message - Aircraft message
   * @returns {Object|null} HFGCS classification or null
   */
  isHFGCSAircraft(message) {
    const hex = (message.hex || '').toUpperCase();
    const callsign = (message.flight || message.callsign || '').toUpperCase();
    const tail = (message.tail || '').toUpperCase();
    const aircraftType = (message.aircraft_type || '').toUpperCase();
    
    // Check E-4B by hex code
    if (this.E4B_HEX_CODES.has(hex)) {
      return {
        is_hfgcs: true,
        aircraft_type: 'E-4B',
        detected_by: 'hex',
        hex: hex
      };
    }
    
    // Check E-6B by hex code
    if (this.E6B_HEX_CODES.has(hex)) {
      return {
        is_hfgcs: true,
        aircraft_type: 'E-6B',
        detected_by: 'hex',
        hex: hex
      };
    }
    
    // Check E-4B by callsign pattern
    for (const pattern of this.E4B_CALLSIGN_PATTERNS) {
      if (callsign.startsWith(pattern)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'E-4B',
          detected_by: 'callsign',
          callsign: callsign
        };
      }
    }
    
    // Check E-6B by callsign pattern
    for (const pattern of this.E6B_CALLSIGN_PATTERNS) {
      if (callsign.includes(pattern)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'E-6B',
          detected_by: 'callsign',
          callsign: callsign
        };
      }
    }
    
    // Check E-4B by aircraft type (exact match or word boundary)
    for (const pattern of this.E4B_TYPE_PATTERNS) {
      // Use word boundary regex to avoid false positives (e.g., BE40 shouldn't match E4)
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(aircraftType)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'E-4B',
          detected_by: 'type',
          aircraft_type_str: aircraftType
        };
      }
    }
    
    // Check E-6B by aircraft type (exact match or word boundary)
    for (const pattern of this.E6B_TYPE_PATTERNS) {
      // Use word boundary regex to avoid false positives
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(aircraftType)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'E-6B',
          detected_by: 'type',
          aircraft_type_str: aircraftType
        };
      }
    }
    
    // Check B-1B by hex code
    if (this.B1_HEX_CODES.has(hex)) {
      return {
        is_hfgcs: true,
        aircraft_type: 'B-1B',
        detected_by: 'hex',
        hex: hex
      };
    }
    
    // Check B-52 by hex code
    if (this.B52_HEX_CODES.has(hex)) {
      return {
        is_hfgcs: true,
        aircraft_type: 'B-52',
        detected_by: 'hex',
        hex: hex
      };
    }
    
    // Check KC-135 by callsign pattern
    for (const pattern of this.KC135_CALLSIGN_PATTERNS) {
      if (callsign.includes(pattern)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'KC-135',
          detected_by: 'callsign',
          callsign: callsign
        };
      }
    }
    
    // Check KC-46 by callsign pattern
    for (const pattern of this.KC46_CALLSIGN_PATTERNS) {
      if (callsign.includes(pattern)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'KC-46',
          detected_by: 'callsign',
          callsign: callsign
        };
      }
    }
    
    // Check B-1B by callsign pattern
    for (const pattern of this.B1_CALLSIGN_PATTERNS) {
      if (callsign.includes(pattern)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'B-1B',
          detected_by: 'callsign',
          callsign: callsign
        };
      }
    }
    
    // Check B-52 by callsign pattern
    for (const pattern of this.B52_CALLSIGN_PATTERNS) {
      if (callsign.includes(pattern)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'B-52',
          detected_by: 'callsign',
          callsign: callsign
        };
      }
    }
    
    // Check B-1B by aircraft type
    for (const pattern of this.B1_TYPE_PATTERNS) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(aircraftType)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'B-1B',
          detected_by: 'type',
          aircraft_type_str: aircraftType
        };
      }
    }
    
    // Check B-52 by aircraft type
    for (const pattern of this.B52_TYPE_PATTERNS) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(aircraftType)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'B-52',
          detected_by: 'type',
          aircraft_type_str: aircraftType
        };
      }
    }
    
    // Check KC-135 by aircraft type
    for (const pattern of this.KC135_TYPE_PATTERNS) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(aircraftType)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'KC-135',
          detected_by: 'type',
          aircraft_type_str: aircraftType
        };
      }
    }
    
    // Check KC-46 by aircraft type
    for (const pattern of this.KC46_TYPE_PATTERNS) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(aircraftType)) {
        return {
          is_hfgcs: true,
          aircraft_type: 'KC-46',
          detected_by: 'type',
          aircraft_type_str: aircraftType
        };
      }
    }
    
    // Only return if the detected type is enabled
    return null;
  }

  /**
   * Update HFGCS aircraft tracking
   * @param {Object} message - Enriched message with HFGCS classification
   */
  updateAircraft(message) {
    if (!message.hfgcs_classification?.is_hfgcs) return;
    
    const key = message.tail || message.hex || message.flight || message.id;
    const now = Date.now();
    
    let aircraft = this.activeHFGCSAircraft.get(key);
    
    if (!aircraft) {
      // New HFGCS aircraft detected
      aircraft = {
        id: key,
        aircraft_type: message.hfgcs_classification.aircraft_type,
        hex: message.hex,
        callsign: message.flight || message.callsign,
        tail: message.tail,
        first_detected: now,
        last_seen: now,
        message_count: 0,
        positions: [],
        detection_method: message.hfgcs_classification.detected_by
      };
      
      this.activeHFGCSAircraft.set(key, aircraft);
      this.stats.totalDetected++;
      
      if (aircraft.aircraft_type === 'E-6B') {
        this.stats.e6bCount++;
      } else {
        this.stats.e4bCount++;
      }
      
      console.log(`🛡️  HFGCS aircraft detected: ${aircraft.aircraft_type} - ${aircraft.callsign || key}`);
      this.emit('hfgcs_aircraft_detected', aircraft);
      
      // Save to database
      this.saveHFGCSAircraft(aircraft);
    } else {
      // Update existing aircraft
      aircraft.last_seen = now;
      aircraft.message_count++;
      aircraft.callsign = message.flight || message.callsign || aircraft.callsign;
      aircraft.tail = message.tail || aircraft.tail;
      
      // Update position if available
      if (message.position?.lat && message.position?.lon) {
        aircraft.last_position = {
          lat: message.position.lat,
          lon: message.position.lon,
          altitude: message.position.altitude,
          timestamp: now
        };
        
        aircraft.positions.push(aircraft.last_position);
        
        // Keep last 500 positions
        if (aircraft.positions.length > 500) {
          aircraft.positions = aircraft.positions.slice(-500);
        }
      }
      
      this.emit('hfgcs_aircraft_updated', aircraft);
    }
    
    this.stats.totalMessages++;
    this.stats.lastActivity = now;
    
    // Periodically save to database (every 10 messages)
    if (aircraft.message_count % 10 === 0) {
      this.saveHFGCSAircraft(aircraft);
    }
  }

  /**
   * Save HFGCS aircraft to database
   */
  saveHFGCSAircraft(aircraft) {
    if (!this.database) return;
    
    try {
      this.database.saveHFGCSAircraft({
        aircraft_id: aircraft.id,
        aircraft_type: aircraft.aircraft_type,
        hex: aircraft.hex,
        callsign: aircraft.callsign,
        tail: aircraft.tail,
        first_detected: new Date(aircraft.first_detected).toISOString(),
        last_seen: new Date(aircraft.last_seen).toISOString(),
        total_messages: aircraft.message_count,
        last_position_lat: aircraft.last_position?.lat,
        last_position_lon: aircraft.last_position?.lon,
        last_altitude: aircraft.last_position?.altitude,
        detection_method: aircraft.detection_method
      });
    } catch (error) {
      console.error('Error saving HFGCS aircraft:', error);
    }
  }

  /**
   * Get active HFGCS aircraft
   */
  getActiveAircraft() {
    const now = Date.now();
    const active = [];
    
    for (const [key, aircraft] of this.activeHFGCSAircraft.entries()) {
      if (now - aircraft.last_seen < this.trackTimeout) {
        active.push({
          id: aircraft.id,
          aircraft_type: aircraft.aircraft_type,
          hex: aircraft.hex,
          callsign: aircraft.callsign,
          tail: aircraft.tail,
          first_detected: aircraft.first_detected,
          last_seen: aircraft.last_seen,
          message_count: aircraft.message_count,
          last_position: aircraft.last_position,
          detection_method: aircraft.detection_method
        });
      }
    }
    
    return active;
  }

  /**
   * Get tracking statistics
   */
  getStats() {
    const activeCount = this.getActiveAircraft().length;
    
    return {
      ...this.stats,
      activeCount,
      lastActivityFormatted: this.stats.lastActivity ? new Date(this.stats.lastActivity).toISOString() : null
    };
  }

  /**
   * Clean up stale HFGCS aircraft
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, aircraft] of this.activeHFGCSAircraft.entries()) {
      if (now - aircraft.last_seen > this.trackTimeout) {
        // Save final state to database
        this.saveHFGCSAircraft(aircraft);
        this.activeHFGCSAircraft.delete(key);
        removed++;
        
        this.emit('hfgcs_aircraft_lost', {
          id: aircraft.id,
          aircraft_type: aircraft.aircraft_type,
          callsign: aircraft.callsign
        });
      }
    }
    
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} stale HFGCS aircraft tracks`);
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 120000); // Every 2 minutes
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
  
  /**
   * Get current configuration
   */
  getConfiguration() {
    return {
      enabled_types: Array.from(this.enabledTypes),
      aircraft_types: [
        {
          id: 'E-4B',
          name: 'E-4B Nightwatch',
          category: 'Command Post',
          description: 'National Airborne Operations Center',
          hex_count: this.E4B_HEX_CODES.size,
          callsigns: this.E4B_CALLSIGN_PATTERNS
        },
        {
          id: 'E-6B',
          name: 'E-6B Mercury',
          category: 'Command Post',
          description: 'TACAMO Strategic Communications',
          hex_count: this.E6B_HEX_CODES.size,
          callsigns: this.E6B_CALLSIGN_PATTERNS
        },
        {
          id: 'B-1B',
          name: 'B-1B Lancer',
          category: 'Bomber',
          description: 'Supersonic Strategic Bomber',
          hex_count: this.B1_HEX_CODES.size,
          callsigns: this.B1_CALLSIGN_PATTERNS
        },
        {
          id: 'B-52',
          name: 'B-52 Stratofortress',
          category: 'Bomber',
          description: 'Strategic Heavy Bomber',
          hex_count: this.B52_HEX_CODES.size,
          callsigns: this.B52_CALLSIGN_PATTERNS
        },
        {
          id: 'KC-135',
          name: 'KC-135 Stratotanker',
          category: 'Tanker',
          description: 'Aerial Refueling Aircraft',
          hex_count: this.KC135_HEX_CODES.size,
          callsigns: this.KC135_CALLSIGN_PATTERNS
        },
        {
          id: 'KC-46',
          name: 'KC-46 Pegasus',
          category: 'Tanker',
          description: 'Next-Gen Aerial Refueling',
          hex_count: this.KC46_HEX_CODES.size,
          callsigns: this.KC46_CALLSIGN_PATTERNS
        }
      ]
    };
  }
  
  /**
   * Update which aircraft types to track
   */
  updateEnabledTypes(types) {
    this.enabledTypes = new Set(types);
    console.log(`🛡️  HFGCS tracking updated:`, Array.from(this.enabledTypes));
  }
}

module.exports = HFGCSAircraftTracker;

