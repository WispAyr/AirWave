const EventEmitter = require('events');

class MessageProcessor extends EventEmitter {
  constructor(validator, database = null, hfgcsTracker = null, aircraftTracker = null) {
    super();
    this.validator = validator;
    this.database = database;
    this.hfgcsTracker = hfgcsTracker;
    this.aircraftTracker = aircraftTracker;
    this.messageCount = 0;
    this.stats = {
      total: 0,
      byType: {},
      byAirline: {},
      errors: 0
    };
  }

  process(message) {
    this.messageCount++;
    this.stats.total++;

    try {
      // Enrich message with metadata
      const enriched = this.enrichMessage(message);
      
      // Validate message - skip validation for ADS-B and EAM messages
      let validation;
      if (enriched.source_type === 'adsb' || enriched.source_type === 'eam') {
        validation = { valid: true, skipped: enriched.source_type, errors: [] };
      } else {
        validation = this.validator.validateACARSMessage(enriched);
      }
      
      // Track statistics
      this.updateStats(enriched, validation);
      
      const processedMessage = {
        ...enriched,
        validation,
        processed_at: new Date().toISOString(),
        message_number: this.messageCount
      };

      // Track ADS-B aircraft positions in aircraft_tracks (not in messages table)
      if (this.aircraftTracker && enriched.source_type === 'adsb' && enriched.position?.lat && enriched.position?.lon) {
        // Normalize different data source formats
        const normalizedData = {
          // Identifier - prefer hex, fallback to tail
          hex: enriched.hex || enriched.tail,
          flight: enriched.flight,
          tail: enriched.tail || enriched.registration || enriched.hex,
          aircraft_type: enriched.aircraft_type,
          
          // Position - already normalized
          position: {
            lat: enriched.position.lat,
            lon: enriched.position.lon,
            altitude: enriched.position.altitude // Can be string or number
          },
          
          // Flight data - handle different field names
          heading: enriched.heading || enriched.true_track,
          ground_speed: enriched.ground_speed || enriched.velocity,
          vertical_rate: enriched.vertical_rate,
          
          // Timestamp - convert to milliseconds
          timestamp: new Date(enriched.timestamp).getTime(),
          
          // Additional data
          squawk: enriched.squawk
        };
        
        this.aircraftTracker.updateAircraft(normalizedData);
        
        // Emit all ADS-B messages to WebSocket (batching happens in server.js)
        // We'll rely on backend batching to reduce load, not filtering here
        this.emit('message', processedMessage);
        
        // Return early without saving to database (only tracked in aircraft_tracks)
        return processedMessage;
      }

      // Handle EAM messages from EAM.watch API
      if (enriched.source_type === 'eam' && enriched.eam) {
        // Save to eam_messages table instead of messages table
        if (this.database && enriched.eam) {
          this.database.saveEAMMessage({
            message_type: enriched.eam.message_type || 'EAM',
            header: enriched.eam.header,
            message_body: enriched.eam.message_body,
            message_length: enriched.eam.message_length,
            confidence_score: enriched.eam.confidence_score || 100,
            first_detected: enriched.eam.first_detected || enriched.timestamp,
            last_detected: enriched.eam.last_detected || enriched.timestamp,
            recording_ids: null, // API messages don't have local recordings
            raw_transcription: enriched.text || enriched.eam.message_body,
            codeword: enriched.eam.codeword,
            time_code: enriched.eam.time_code,
            authentication: enriched.eam.authentication,
            multi_segment: false,
            segment_count: 1
          });
        }

        // Emit EAM message to WebSocket
        this.emit('message', processedMessage);
        
        // Return early without saving to regular messages table
        return processedMessage;
      }

      // For non-ADS-B, non-EAM messages (ACARS, etc), save to database
      if (this.database) {
        this.database.saveMessage(processedMessage);
      }

      // Emit processed message (for non-ADS-B messages like ACARS)
      this.emit('message', processedMessage);

      return processedMessage;
    } catch (error) {
      console.error('Error processing message:', error);
      this.stats.errors++;
      return null;
    }
  }

  enrichMessage(message) {
    const enriched = { ...message };

    // Detect message category
    enriched.category = this.categorizeMessage(message);
    
    // Detect HFGCS aircraft
    if (this.hfgcsTracker) {
      const hfgcsInfo = this.hfgcsTracker.isHFGCSAircraft(enriched);
      if (hfgcsInfo) {
        enriched.hfgcs_classification = hfgcsInfo;
        // Notify tracker of HFGCS aircraft activity
        this.hfgcsTracker.updateAircraft(enriched);
      }
    }
    
    // Handle ADS-B specific enrichment
    if (message.source_type === 'adsb') {
      // Ensure timestamp is present
      if (!enriched.timestamp) {
        enriched.timestamp = new Date().toISOString();
      }
      
      // Normalize ADS-B fields
      if (enriched.squawk) enriched.squawk = String(enriched.squawk);
      if (enriched.ground_speed) enriched.ground_speed = Number(enriched.ground_speed);
      if (enriched.heading) enriched.heading = Number(enriched.heading);
      if (enriched.vertical_rate) enriched.vertical_rate = Number(enriched.vertical_rate);
      if (enriched.aircraft_type) enriched.aircraft_type = String(enriched.aircraft_type);
      
      // Position should already be set, but ensure format
      if (enriched.position && enriched.position.lat && enriched.position.lon) {
        enriched.position.lat = Number(enriched.position.lat);
        enriched.position.lon = Number(enriched.position.lon);
      }
    } else {
      // Parse OOOI if present
      if (enriched.category === 'oooi') {
        enriched.oooi = this.parseOOOI(message.text);
      }

      // Parse position report
      if (enriched.category === 'position' && message.text) {
        enriched.position = this.parsePosition(message.text);
      }

      // Parse CPDLC
      if (enriched.category === 'cpdlc') {
        enriched.cpdlc = this.parseCPDLC(message.text);
      }
    }

    // Detect flight phase - only if not already set
    if (!enriched.flight_phase) {
      enriched.flight_phase = this.detectFlightPhase(enriched);
    }

    return enriched;
  }

  categorizeMessage(message) {
    // ADS-B messages are always position reports
    if (message.source_type === 'adsb') {
      return 'position';
    }

    if (!message.text) return 'unknown';

    const text = message.text.toUpperCase();

    if (/^(OUT|OFF|ON|IN)\s+\d{4}/.test(text)) {
      return 'oooi';
    }

    if (text.includes('POS')) {
      return 'position';
    }

    if (message.label && ['_d', '5Z', '5Y'].includes(message.label)) {
      return 'cpdlc';
    }

    if (text.includes('WX') || text.includes('METAR') || text.includes('TAF')) {
      return 'weather';
    }

    if (text.includes('ETA') || text.includes('FUEL')) {
      return 'performance';
    }

    if (text.includes('REQ') || text.includes('CLIMB') || text.includes('DESCEND')) {
      return 'atc_request';
    }

    return 'freetext';
  }

  parseOOOI(text) {
    const match = text.match(/^(OUT|OFF|ON|IN)\s+(\d{4})/);
    if (match) {
      return {
        event: match[1],
        time: match[2],
        timestamp: this.convertToTimestamp(match[2])
      };
    }
    return null;
  }

  parsePosition(text) {
    // Simple position parsing - POS N3745W12230,281234,350,KSFO,KJFK
    const parts = text.split(',');
    if (parts.length >= 3) {
      const coordinates = parts[0].replace('POS ', '').trim();
      const coords = this.parseCoordinates(coordinates);
      
      return {
        coordinates,
        lat: coords?.lat || null,
        lon: coords?.lon || null,
        time: parts[1] ? parts[1].trim() : null,
        altitude: parts[2] ? parts[2].trim() : null,
        departure: parts[3] ? parts[3].trim() : null,
        arrival: parts[4] ? parts[4].trim() : null
      };
    }
    return null;
  }

  parseCoordinates(coordString) {
    try {
      // Format: N3745W12230 or similar
      const match = coordString.match(/([NS])(\d{2})(\d{2,3})([EW])(\d{2,3})(\d{2,3})?/);
      if (!match) return null;

      const latDir = match[1];
      const latDeg = parseInt(match[2]);
      const latMin = parseInt(match[3].slice(0, 2));
      
      const lonDir = match[4];
      const lonDeg = parseInt(match[5]);
      const lonMin = match[6] ? parseInt(match[6].slice(0, 2)) : 0;

      let lat = latDeg + latMin / 60;
      if (latDir === 'S') lat = -lat;

      let lon = lonDeg + lonMin / 60;
      if (lonDir === 'W') lon = -lon;

      return { lat, lon };
    } catch (error) {
      return null;
    }
  }

  parseCPDLC(text) {
    return {
      raw: text,
      type: text.includes('CLIMB') ? 'clearance' : 
            text.includes('REQ') ? 'request' : 'message'
    };
  }

  detectFlightPhase(message) {
    // ADS-B flight phase detection based on altitude and vertical rate
    if (message.source_type === 'adsb') {
      const altString = message.position?.altitude?.toString() || '';
      const verticalRate = message.vertical_rate || 0;
      
      // Check if on ground (TAR1090 returns 'ground' as string)
      if (altString === 'ground' || altString === '0') return 'TAXI';
      
      const altitude = parseInt(altString);
      
      // Invalid altitude data
      if (isNaN(altitude) || altitude === 0) return 'UNKNOWN';
      
      // On ground or very low
      if (altitude < 500) return 'TAXI';
      
      // Takeoff/Climb (positive vertical rate)
      if (verticalRate > 500) {
        if (altitude < 5000) return 'TAKEOFF';
        if (altitude < 18000) return 'CLIMB';
        return 'CRUISE'; // Climbing above FL180 still considered cruise
      }
      
      // Descent/Approach (negative vertical rate)
      if (verticalRate < -500) {
        if (altitude < 5000) return 'APPROACH';
        if (altitude < 18000) return 'DESCENT';
        return 'CRUISE'; // Descending from cruise
      }
      
      // Level flight - determine by altitude
      if (altitude > 18000) return 'CRUISE';
      if (altitude > 5000) return 'ENROUTE';
      
      return 'APPROACH'; // Low and level
    }

    // ACARS flight phase detection
    const text = message.text || '';
    const label = message.label || '';

    if (text.includes('OUT') && !text.includes('OFF')) return 'TAXI';
    if (text.includes('OFF')) return 'TAKEOFF';
    if (text.includes('CLIMB')) return 'CRUISE';
    if (text.includes('DESCEND') || text.includes('DESCENT')) return 'DESCENT';
    if (text.includes('APPROACH')) return 'APPROACH';
    if (text.includes('ON') || text.includes('IN')) return 'LANDING';
    
    return 'CRUISE';
  }

  convertToTimestamp(timeStr) {
    // Convert HHMM to ISO timestamp (today's date)
    const now = new Date();
    const hours = parseInt(timeStr.substr(0, 2));
    const minutes = parseInt(timeStr.substr(2, 2));
    
    const timestamp = new Date(now);
    timestamp.setHours(hours, minutes, 0, 0);
    
    return timestamp.toISOString();
  }

  updateStats(message, validation) {
    // Track by category
    const category = message.category || 'unknown';
    this.stats.byType[category] = (this.stats.byType[category] || 0) + 1;

    // Track by airline
    if (message.airline) {
      this.stats.byAirline[message.airline] = (this.stats.byAirline[message.airline] || 0) + 1;
    }

    // Track validation errors - don't count skipped validations
    if (!validation.valid && !validation.skipped) {
      this.stats.errors++;
    }
  }

  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime()
    };
  }

  hasSignificantADSBChange(oldData, newData) {
    // Check if position changed significantly (>0.001 degrees ≈ 100m)
    const posChanged = Math.abs((newData.position?.lat || 0) - (oldData.position?.lat || 0)) > 0.001 ||
                       Math.abs((newData.position?.lon || 0) - (oldData.position?.lon || 0)) > 0.001;
    
    // Check if altitude changed significantly (>500 feet)
    const altChanged = Math.abs((newData.position?.altitude || 0) - (oldData.position?.altitude || 0)) > 500;
    
    // Check if speed changed significantly (>30 knots)
    const speedChanged = Math.abs((newData.ground_speed || 0) - (oldData.ground_speed || 0)) > 30;
    
    // Check if heading changed significantly (>15 degrees)
    const headingChanged = Math.abs((newData.heading || 0) - (oldData.heading || 0)) > 15;
    
    // Check if callsign changed
    const callsignChanged = newData.flight !== oldData.flight;
    
    return posChanged || altChanged || speedChanged || headingChanged || callsignChanged;
  }

  resetStats() {
    this.stats = {
      total: 0,
      byType: {},
      byAirline: {},
      errors: 0
    };
    this.messageCount = 0;
  }
}

module.exports = MessageProcessor;

