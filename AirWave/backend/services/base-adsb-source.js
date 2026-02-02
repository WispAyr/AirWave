const EventEmitter = require('events');

/**
 * Base class for ADS-B data sources
 * Provides common functionality for polling-based aircraft tracking
 * @extends EventEmitter
 */
class BaseADSBSource extends EventEmitter {
  /**
   * @param {Object} config - Configuration object
   * @param {number} config.poll_interval - Polling interval in milliseconds
   */
  constructor(config = {}) {
    super();
    this.connected = false;
    this.pollInterval = null;
    this.updateInterval = config.poll_interval || 10000;
    this.lastUpdate = null;
    this.trackedAircraft = new Map();
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Fetch data from the remote API
   * @returns {Promise<*>} Fetched data or null on error
   */
  async fetchData() {
    throw new Error('fetchData() must be implemented by subclass');
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Process fetched data and emit messages
   * @param {*} data - Raw data from API
   */
  processData(data) {
    throw new Error('processData() must be implemented by subclass');
  }

  /**
   * Format coordinates to aviation format (DDMMN/DDDMME)
   * @param {number} lat - Latitude in decimal degrees
   * @param {number} lon - Longitude in decimal degrees
   * @returns {string} Formatted coordinates
   */
  formatCoordinates(lat, lon) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    
    const latAbs = Math.abs(lat);
    const lonAbs = Math.abs(lon);
    
    const latDeg = Math.floor(latAbs);
    const latMin = Math.floor((latAbs - latDeg) * 60);
    
    const lonDeg = Math.floor(lonAbs);
    const lonMin = Math.floor((lonAbs - lonDeg) * 60);
    
    return `${latDir}${String(latDeg).padStart(2, '0')}${String(latMin).padStart(2, '0')}${lonDir}${String(lonDeg).padStart(3, '0')}${String(lonMin).padStart(2, '0')}`;
  }

  /**
   * Generate position text message
   * @param {string} callsign - Aircraft callsign
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} alt - Altitude
   * @returns {string} Position text
   */
  generatePositionText(callsign, lat, lon, alt) {
    const coords = this.formatCoordinates(lat, lon);
    const fl = alt ? Math.round(alt / 100) : '000';
    const cs = callsign ? callsign.trim() : 'UNKNOWN';
    return `POS ${coords},${new Date().toISOString().split('T')[1].slice(0, 8).replace(/:/g, '')},${fl}`;
  }

  /**
   * Determine flight phase based on altitude and vertical rate
   * @param {boolean} on_ground - Whether aircraft is on ground
   * @param {number} altitude - Altitude in feet
   * @param {number} vertical_rate - Vertical rate in feet per minute
   * @returns {string} Flight phase (TAXI, TAKEOFF, CRUISE, DESCENT, APPROACH, UNKNOWN)
   */
  determineFlightPhase(on_ground, altitude, vertical_rate) {
    if (on_ground || (altitude && altitude < 100)) return 'TAXI';
    if (!altitude) return 'UNKNOWN';
    
    if (vertical_rate > 500) return 'TAKEOFF';
    if (vertical_rate < -500) return 'DESCENT';
    if (altitude < 10000 && vertical_rate > -500 && vertical_rate < 500) return 'APPROACH';
    return 'CRUISE';
  }

  /**
   * Check if message has significant change from previous
   * @param {Object} oldMessage - Previous message
   * @param {Object} newMessage - New message
   * @returns {boolean} True if significant change detected
   */
  hasSignificantChange(oldMessage, newMessage) {
    if (!oldMessage) return true;
    
    const oldPos = oldMessage.position;
    const newPos = newMessage.position;
    
    // Position change threshold (roughly 0.1nm)
    const latDiff = Math.abs(newPos.lat - oldPos.lat);
    const lonDiff = Math.abs(newPos.lon - oldPos.lon);
    const positionChange = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) > 0.001;
    
    // Altitude change threshold (1000 feet)
    const altChange = Math.abs((newPos.altitude || 0) - (oldPos.altitude || 0)) > 1000;
    
    // Speed change threshold (50 knots)
    const speedChange = Math.abs((newMessage.velocity || 0) - (oldMessage.velocity || 0)) > 50;
    
    // Heading change threshold (30 degrees)
    const headingChange = Math.abs((newMessage.heading || 0) - (oldMessage.heading || 0)) > 30;
    
    // Flight phase change
    const phaseChange = newMessage.flight_phase !== oldMessage.flight_phase;
    
    return positionChange || altChange || speedChange || headingChange || phaseChange;
  }

  /**
   * Start polling for aircraft data
   */
  startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Poll immediately
    this.fetchData();

    // Then poll at interval
    this.pollInterval = setInterval(() => {
      this.fetchData();
    }, this.updateInterval);

    console.log(`🔄 ${this.constructor.name} polling every ${this.updateInterval / 1000}s`);
  }

  /**
   * Update polling interval
   * @param {number} interval - New interval in milliseconds
   */
  setPollInterval(interval) {
    this.updateInterval = interval;
    if (this.connected && this.pollInterval) {
      this.startPolling();
    }
    console.log(`⚙️  ${this.constructor.name} poll interval updated to ${interval / 1000}s`);
  }

  /**
   * Disconnect from data source
   */
  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.connected = false;
    this.emit('disconnected');
    console.log(`🛑 ${this.constructor.name} disconnected`);
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get source statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      connected: this.connected,
      tracked_aircraft: this.trackedAircraft.size,
      last_update: this.lastUpdate,
      update_interval: this.updateInterval
    };
  }
}

module.exports = BaseADSBSource;

