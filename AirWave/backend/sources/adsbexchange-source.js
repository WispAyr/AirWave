const axios = require('axios');
const BaseADSBSource = require('../services/base-adsb-source');

class ADSBExchangeSource extends BaseADSBSource {
  constructor(config = {}) {
    super(config);
    let apiKey = config.api_key || process.env.ADSBEXCHANGE_API_KEY || '';
    
    // Strip 'api-auth:' prefix if present
    if (apiKey && apiKey.startsWith('api-auth:')) {
      apiKey = apiKey.substring('api-auth:'.length);
      console.log('ℹ️  Stripped api-auth: prefix from API key');
    }
    
    this.apiKey = apiKey;
    this.apiUrl = config.api_url || process.env.ADSBEXCHANGE_API_URL || 'https://adsbexchange.com/api/aircraft';
    this.defaultLat = config.default_lat || parseFloat(process.env.ADSBEXCHANGE_DEFAULT_LAT) || 55.8642; // Glasgow
    this.defaultLon = config.default_lon || parseFloat(process.env.ADSBEXCHANGE_DEFAULT_LON) || -4.2518;
    this.defaultDist = config.default_dist || parseInt(process.env.ADSBEXCHANGE_DEFAULT_DIST) || 10;
    
    // Validate API key format (UUID)
    if (this.apiKey && !this.isValidUUID(this.apiKey)) {
      console.warn('⚠️  ADS-B Exchange API key format appears invalid (should be UUID)');
    }
  }

  isValidUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  connect() {
    console.log('🛰️  Connecting to ADS-B Exchange...');
    console.log(`   API Key: ${this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'NOT SET'}`);
    console.log(`   Location: ${this.defaultLat}, ${this.defaultLon}`);
    console.log(`   Distance: ${this.defaultDist} nm`);
    console.log(`   API URL: ${this.apiUrl}`);
    
    // Check if API key is present
    if (!this.apiKey) {
      const errorMsg = 'ADS-B Exchange API key not configured. Set ADSBEXCHANGE_API_KEY environment variable.';
      console.error(`❌ ${errorMsg}`);
      this.emit('error', new Error(errorMsg));
      this.connected = false;
      return;
    }
    
    // Test connection with default location
    this.fetchAircraft(this.defaultLat, this.defaultLon, this.defaultDist).then(aircraft => {
      if (aircraft !== null) {
        console.log('✅ ADS-B Exchange connected successfully');
        this.connected = true;
        this.emit('connected');
        this.startPolling();
      } else {
        console.error('❌ Failed to connect to ADS-B Exchange - check API key and location settings');
        this.emit('error', new Error('Connection failed'));
      }
    }).catch(error => {
      console.error('❌ ADS-B Exchange connection error:', error.message);
      this.emit('error', error);
    });
  }

  async fetchData() {
    return this.fetchAircraft(this.defaultLat, this.defaultLon, this.defaultDist);
  }

  async fetchAircraft(lat, lon, dist) {
    try {
      const url = `${this.apiUrl}/lat/${lat}/lon/${lon}/dist/${dist}/`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'api-auth': this.apiKey,
          'User-Agent': 'AIRWAVE-MissionControl/1.0'
        }
      });

      if (response.data && response.data.aircraft) {
        const aircraft = response.data.aircraft;
        console.log(`📥 ADS-B Exchange: Received ${aircraft.length} aircraft positions`);
        
        this.lastUpdate = new Date();
        this.processAircraft(aircraft);
        return aircraft;
      } else if (response.data && response.data.ac) {
        // Fallback for older API format
        const aircraft = response.data.ac;
        console.log(`📥 ADS-B Exchange: Received ${aircraft.length} aircraft positions (legacy format)`);
        
        this.lastUpdate = new Date();
        this.processAircraft(aircraft);
        return aircraft;
      }
      
      return null;
    } catch (error) {
      if (error.response?.status === 429) {
        console.warn('⚠️  ADS-B Exchange rate limit hit, slowing down...');
        this.updateInterval = 15000; // Slow down if rate limited
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('❌ ADS-B Exchange authentication failed. Check API key.');
      } else {
        console.error('ADS-B Exchange fetch error:', error.message);
      }
      return null;
    }
  }

  processAircraft(aircraftArray) {
    // DEBUG: Log first aircraft to see actual structure
    if (aircraftArray.length > 0) {
      console.log('🔍 ADS-B Exchange sample aircraft:', JSON.stringify(aircraftArray[0], null, 2));
    }
    
    // ADS-B Exchange uses 'icao' as identifier
    const currentAircraft = new Set(aircraftArray.map(ac => ac.icao || ac.hex));
    
    // Remove stale aircraft (not in current response)
    for (const [hex, aircraft] of this.trackedAircraft.entries()) {
      if (!currentAircraft.has(hex)) {
        this.trackedAircraft.delete(hex);
        console.log(`🗑️  Removed stale aircraft ${hex} from tracking`);
      }
    }
    
    let processedCount = 0;
    let skippedNoPosition = 0;
    let skippedNoHex = 0;
    
    aircraftArray.forEach(ac => {
      // ADS-B Exchange ACTUAL format:
      // hex: ICAO24, r: registration, t: type, flight: callsign,
      // alt_baro/alt_geom: altitude (feet), gs: ground speed (knots), track: heading (degrees)
      // lat, lon: position, squawk: transponder code, category: emitter category
      // baro_rate/geom_rate: vertical rate (fpm), nav_qnh: on ground indicator
      

      // Normalize: ADS-B Exchange uses 'icao' as primary identifier
      const hexCode = ac.icao || ac.hex;
      if (!hexCode) {
        skippedNoHex++;
        return;
      }

      // Skip if no position data (allow 0.0 coordinates)
      if (ac.lat == null || ac.lon == null || isNaN(parseFloat(ac.lat)) || isNaN(parseFloat(ac.lon))) {
        skippedNoPosition++;
        return;
      }

      // Check if this is an update to existing aircraft
      const existingAircraft = this.trackedAircraft.get(hexCode);
      const isUpdate = existingAircraft !== undefined;
      
      // Use existing message ID for updates, create new for new aircraft
      const messageId = isUpdate ? existingAircraft.id : `adsbexchange_${hexCode}_${Date.now()}`;

      // Convert to AIRWAVE message format
      const message = {
        id: messageId,
        timestamp: new Date().toISOString(),
        source: {
          type: 'adsb',
          station_id: 'adsbexchange',
          api: 'adsbexchange',
          data_type: ac.type || 'adsb_icao' // Track the data source type
        },
        source_type: 'adsb', // Add this for frontend filtering
        
        // Aircraft identification - ADS-B Exchange format
        hex: hexCode, // ICAO24 hex code
        tail: ac.reg || ac.r || hexCode, // Use registration if available, fallback to hex
        flight: (ac.call || ac.flight) ? (ac.call || ac.flight).trim() : null,
        registration: ac.reg || ac.r || null,
        aircraft_type: ac.type || ac.t || null,
        
        // Position data - ADS-B Exchange format
        position: {
          lat: parseFloat(ac.lat),
          lon: parseFloat(ac.lon),
          altitude: ac.alt ? parseFloat(ac.alt) : (ac.galt ? parseFloat(ac.galt) : (ac.alt_baro ? parseFloat(ac.alt_baro) : null)), // altitude in feet
          coordinates: this.formatCoordinates(parseFloat(ac.lat), parseFloat(ac.lon))
        },
        
        // Flight data - ADS-B Exchange format with fallbacks
        ground_speed: parseFloat(ac.spd || ac.gs || ac.speed) || null, // ground speed in knots
        velocity: parseFloat(ac.spd || ac.gs || ac.speed) || null, // also keep velocity for compatibility
        heading: parseFloat(ac.trak || ac.track || ac.hdg) || null, // track in degrees
        vertical_rate: (ac.vsi || ac.baro_rate || ac.geom_rate) ? parseFloat(ac.vsi || ac.baro_rate || ac.geom_rate) : null, // vertical rate in fpm
        on_ground: ac.gnd === "1" || ac.gnd === 1 || ac.gnd === true, // on ground flag (coerce to boolean)
        squawk: ac.sqk || ac.squawk || null,
        emitter_category: ac.wtc || ac.category || null, // emitter category (renamed to avoid collision)
        
        // Additional ADS-B Exchange specific fields
        emergency: ac.emergency || null,
        spi: ac.spi || false, // Special position identification
        alert: ac.alert || false, // Flight status alert
        nav_modes: ac.nav_modes || null, // Navigation modes
        nav_altitude_mcp: ac.nav_altitude_mcp || null, // Selected altitude
        nav_heading: ac.nav_heading || null, // Selected heading
        
        // Data quality indicators
        nic: ac.nic || null, // Navigation Integrity Category
        nac_p: ac.nac_p || null, // Navigation Accuracy for Position
        nac_v: ac.nac_v || null, // Navigation Accuracy for Velocity
        sil: ac.sil || null, // Source Integrity Level
        
        // ADS-B Exchange specific fields
        operator: ac.opicao || ac.ownop || null, // Operator ICAO code
        country: ac.cou || null, // Country
        military: ac.mil === "1" || ac.mil === 1 || ac.mil === true || ac.dbFlags === 1, // Military aircraft flag (coerce to boolean)
        interested: ac.interested === "1" || ac.interested === 1 || ac.interested === true, // Interested aircraft flag
        from_airport: ac.from || null, // Origin airport
        to_airport: ac.to || null, // Destination airport
        distance: ac.dst ? parseFloat(ac.dst) : null, // Distance to destination
        
        // Categorization
        category: 'adsb',
        flight_phase: this.determineFlightPhase(
          ac.gnd === "1" || ac.gnd === 1 || ac.gnd === true, 
          ac.alt ? parseFloat(ac.alt) : 0, 
          ac.vsi ? parseFloat(ac.vsi) : 0
        ),
        
        // Text representation for compatibility
        text: this.generatePositionText(ac.call || ac.flight, ac.lat, ac.lon, ac.alt)
      };

      // Check for significant changes before emitting
      const hasChanges = this.hasSignificantChange(existingAircraft, message);
      
      // Only emit if significant change detected
      if (hasChanges) {
        this.emit('message', message);
        processedCount++;
      }
      
      // Update tracked aircraft
      this.trackedAircraft.set(hexCode, message);
    });
    
    console.log(`📊 ADS-B Exchange processing: ${processedCount} emitted, ${skippedNoPosition} no position, ${skippedNoHex} no hex`);
  }
}

module.exports = ADSBExchangeSource;

