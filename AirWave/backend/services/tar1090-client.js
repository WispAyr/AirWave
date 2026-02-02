const axios = require('axios');
const EventEmitter = require('events');

class Tar1090Client extends EventEmitter {
  constructor(messageProcessor, aircraftTracker = null) {
    super();
    this.messageProcessor = messageProcessor;
    this.aircraftTracker = aircraftTracker;
    this.tar1090Url = null;
    this.pollInterval = 2000; // 2 seconds default
    this.pollTimer = null;
    this.connected = false;
    this.messageCount = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.lastAircraft = new Map(); // Track aircraft to detect changes
  }

  isConnected() {
    return this.connected;
  }

  getMessageCount() {
    return this.messageCount;
  }

  configure(config) {
    this.tar1090Url = config.url || this.tar1090Url;
    this.pollInterval = config.pollInterval || this.pollInterval;
  }

  connect(url = null, pollInterval = null) {
    if (url) {
      this.tar1090Url = url;
    }
    if (pollInterval) {
      this.pollInterval = pollInterval;
    }

    if (!this.tar1090Url) {
      console.error('❌ TAR1090 URL not configured');
      return false;
    }

    console.log(`🛰️  Connecting to TAR1090 at ${this.tar1090Url}...`);
    this.startPolling();
    return true;
  }

  startPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    const poll = async () => {
      try {
        const response = await axios.get(this.tar1090Url, {
          timeout: 5000,
          headers: {
            'User-Agent': 'AIRWAVE-MissionControl/1.0',
            'Accept': 'application/json'
          }
        });

        if (response.status === 200 && response.data) {
          if (!this.connected) {
            console.log('✅ Connected to TAR1090 feed!');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
          }

          this.processAircraftData(response.data);
        }
      } catch (error) {
        if (this.connected) {
          console.error('❌ TAR1090 poll error:', error.message);
          this.connected = false;
          this.emit('disconnected');
        }

        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log(`⚠️  TAR1090 connection failed after ${this.maxReconnectAttempts} attempts`);
          this.disconnect();
        }
      }
    };

    // Poll immediately, then at interval
    poll();
    this.pollTimer = setInterval(poll, this.pollInterval);
  }

  processAircraftData(data) {
    const aircraft = data.aircraft || [];
    const now = data.now || Date.now() / 1000;

    aircraft.forEach(ac => {
      // Only process aircraft with valid position data
      if (!ac.lat || !ac.lon) {
        return;
      }

      // Transform TAR1090 aircraft to message format
      const message = this.transformAircraft(ac, now);
      
      // Update aircraft tracker (for position history)
      if (this.aircraftTracker) {
        this.aircraftTracker.updateAircraft(message);
      }
      
      // Only send significant updates to message processor (reduces database spam)
      if (this.shouldProcessUpdate(ac)) {
        this.messageProcessor.process(message);
        this.messageCount++;
        
        // Update last known state
        this.lastAircraft.set(ac.hex, {
          lat: ac.lat,
          lon: ac.lon,
          alt_baro: ac.alt_baro,
          timestamp: now
        });
      }
    });

    // Clean up stale aircraft (not seen in last 5 minutes)
    const staleTime = now - 300;
    for (const [hex, data] of this.lastAircraft.entries()) {
      if (data.timestamp < staleTime) {
        this.lastAircraft.delete(hex);
      }
    }
  }

  shouldProcessUpdate(aircraft) {
    const last = this.lastAircraft.get(aircraft.hex);
    
    // Always process if we haven't seen this aircraft before
    if (!last) {
      return true;
    }

    // Process if position has changed significantly (>0.01 degrees ~1km)
    const latChanged = Math.abs((aircraft.lat || 0) - (last.lat || 0)) > 0.01;
    const lonChanged = Math.abs((aircraft.lon || 0) - (last.lon || 0)) > 0.01;
    
    // Process if altitude has changed significantly (>500 ft)
    const altChanged = Math.abs((aircraft.alt_baro || 0) - (last.alt_baro || 0)) > 500;

    return latChanged || lonChanged || altChanged;
  }

  transformAircraft(aircraft, timestamp) {
    // Generate unique ID
    const id = `adsb_${aircraft.hex}_${Math.floor(timestamp)}`;
    
    // Convert Unix timestamp to ISO string
    const isoTimestamp = new Date(timestamp * 1000).toISOString();

    // Transform to message format compatible with existing schema
    return {
      id,
      timestamp: isoTimestamp,
      flight: aircraft.flight ? aircraft.flight.trim() : null,
      tail: aircraft.r || aircraft.hex, // Registration or hex as fallback
      airline: this.extractAirline(aircraft.flight),
      text: this.generatePositionText(aircraft),
      category: 'position',
      source_type: 'adsb',
      
      // Position data
      position: {
        lat: aircraft.lat,
        lon: aircraft.lon,
        altitude: aircraft.alt_baro ? `${aircraft.alt_baro}` : null,
        coordinates: `${aircraft.lat},${aircraft.lon}`
      },

      // ADS-B specific fields
      squawk: aircraft.squawk || null,
      ground_speed: aircraft.gs || null,
      heading: aircraft.track || null,
      vertical_rate: aircraft.baro_rate || null,
      aircraft_type: aircraft.t || null,

      // Source information
      source: {
        type: 'adsb',
        station_id: 'tar1090',
        frequency: 1090 // ADS-B frequency in MHz
      }
    };
  }

  generatePositionText(aircraft) {
    const parts = [];
    
    if (aircraft.flight) {
      parts.push(`FLT:${aircraft.flight.trim()}`);
    }
    
    parts.push(`POS:${aircraft.lat.toFixed(4)},${aircraft.lon.toFixed(4)}`);
    
    if (aircraft.alt_baro) {
      parts.push(`ALT:${aircraft.alt_baro}ft`);
    }
    
    if (aircraft.gs) {
      parts.push(`SPD:${aircraft.gs}kts`);
    }
    
    if (aircraft.track !== undefined) {
      parts.push(`HDG:${aircraft.track}°`);
    }

    if (aircraft.squawk) {
      parts.push(`SQ:${aircraft.squawk}`);
    }

    return parts.join(' ');
  }

  extractAirline(flight) {
    if (!flight) return null;
    
    // Extract airline code (usually first 3 characters)
    const match = flight.trim().match(/^([A-Z]{2,3})/);
    return match ? match[1] : null;
  }

  disconnect() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.connected = false;
    this.lastAircraft.clear();
    console.log('🛑 TAR1090 client disconnected');
    this.emit('disconnected');
  }
}

module.exports = Tar1090Client;

