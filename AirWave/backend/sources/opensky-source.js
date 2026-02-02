const axios = require('axios');
const BaseADSBSource = require('../services/base-adsb-source');

class OpenSkySource extends BaseADSBSource {
  constructor(config = {}) {
    super(config);
    this.apiUrl = 'https://opensky-network.org/api';
  }

  connect() {
    console.log('🛰️  Connecting to OpenSky Network...');
    
    // Test connection first
    this.fetchData().then(success => {
      if (success) {
        console.log('✅ OpenSky Network connected successfully');
        this.connected = true;
        this.emit('connected');
        this.startPolling();
      } else {
        console.error('❌ Failed to connect to OpenSky Network');
        this.emit('error', new Error('Connection failed'));
      }
    });
  }

  async fetchData() {
    return this.fetchStates();
  }

  async fetchStates() {
    try {
      const response = await axios.get(`${this.apiUrl}/states/all`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'AIRWAVE-MissionControl/1.0'
        }
      });

      if (response.data && response.data.states) {
        const aircraft = response.data.states;
        console.log(`📥 OpenSky: Received ${aircraft.length} aircraft positions`);
        
        this.lastUpdate = new Date(response.data.time * 1000);
        this.processStates(aircraft);
        return true;
      }
      
      return false;
    } catch (error) {
      if (error.response?.status === 429) {
        console.warn('⚠️  OpenSky rate limit hit, slowing down...');
        this.updateInterval = 15000; // Slow down if rate limited
      } else {
        console.error('OpenSky fetch error:', error.message);
      }
      return false;
    }
  }

  processStates(states) {
    states.forEach(state => {
      // OpenSky state vector format:
      // [0] icao24, [1] callsign, [2] origin_country, [3] time_position,
      // [4] last_contact, [5] longitude, [6] latitude, [7] baro_altitude,
      // [8] on_ground, [9] velocity, [10] true_track, [11] vertical_rate,
      // [12] sensors, [13] geo_altitude, [14] squawk, [15] spi, [16] position_source

      const [
        icao24, callsign, origin_country, time_position, last_contact,
        longitude, latitude, baro_altitude, on_ground, velocity,
        true_track, vertical_rate, sensors, geo_altitude, squawk
      ] = state;

      // Skip if no position data
      if (!latitude || !longitude) return;

      // Convert altitude from meters to feet
      const altitudeFeet = baro_altitude ? Math.round(baro_altitude * 3.28084) : null;

      // Convert to AIRWAVE message format
      const message = {
        id: `opensky_${icao24}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: {
          type: 'adsb',
          station_id: 'opensky',
          api: 'opensky'
        },
        source_type: 'adsb',
        
        // Aircraft identification
        hex: icao24,
        tail: icao24,
        flight: callsign ? callsign.trim() : null,
        
        // Position data (altitude in feet)
        position: {
          lat: latitude,
          lon: longitude,
          altitude: altitudeFeet, // altitude in feet
          coordinates: this.formatCoordinates(latitude, longitude)
        },
        
        // Additional data
        ground_speed: velocity ? Math.round(velocity * 1.94384) : null, // m/s to knots
        velocity: velocity ? Math.round(velocity * 1.94384) : null, // also keep velocity for compatibility
        heading: true_track,
        vertical_rate: vertical_rate, // vertical rate in m/s (OpenSky format)
        on_ground: on_ground,
        squawk: squawk,
        origin_country: origin_country,
        
        // Categorization (use feet for phase determination)
        category: 'position',
        flight_phase: this.determineFlightPhase(on_ground, altitudeFeet, vertical_rate),
        
        // Text representation for compatibility (use feet for FL calculation)
        text: this.generatePositionText(callsign, latitude, longitude, altitudeFeet)
      };

      // Check for significant changes before emitting
      const previousMessage = this.trackedAircraft.get(icao24);
      const hasChanges = this.hasSignificantChange(previousMessage, message);
      
      // Only emit if significant change detected
      if (hasChanges) {
        this.emit('message', message);
      }
      
      // Track aircraft for comparison
      this.trackedAircraft.set(icao24, message);
    });
  }
}

module.exports = OpenSkySource;

