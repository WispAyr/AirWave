const axios = require('axios');
const EventEmitter = require('events');

/**
 * Hex-to-Registration Lookup Service
 * Converts ICAO hex codes (Mode S) to aircraft registrations
 */
class HexToRegService extends EventEmitter {
  constructor(database) {
    super();
    this.database = database;
    this.cache = new Map();
    this.rateLimit = 1000; // 1 second between requests
    this.lastRequestTime = 0;
    
    // Multiple fallback APIs for hex-to-registration conversion
    this.apis = [
      {
        name: 'ADS-B Exchange',
        url: (hex) => `https://globe.adsbexchange.com/api/aircraft/${hex.toLowerCase()}/`,
        parseResponse: (data) => {
          if (data.ac && data.ac.length > 0) {
            return {
              registration: data.ac[0].r || data.ac[0].reg || null,
              type: data.ac[0].t || null,
              country: null
            };
          }
          return null;
        },
        requiresAuth: false
      },
      {
        name: 'OpenSky Network',
        url: (hex) => `https://opensky-network.org/api/metadata/aircraft/icao/${hex.toLowerCase()}`,
        parseResponse: (data) => {
          if (data.registration) {
            return {
              registration: data.registration,
              type: data.typecode || data.model || null,
              country: data.country || null
            };
          }
          return null;
        },
        requiresAuth: false
      }
    ];
  }

  /**
   * Convert hex code to registration
   * @param {string} hex - ICAO hex code (e.g., "4cac55")
   * @returns {Promise<object|null>} Registration data or null
   */
  async lookupRegistration(hex) {
    if (!hex) return null;

    // Normalize hex (remove spaces, convert to lowercase)
    const normalizedHex = hex.replace(/\s+/g, '').toLowerCase();

    try {
      // Check memory cache first
      if (this.cache.has(normalizedHex)) {
        console.log(`💾 Cache hit for hex: ${normalizedHex}`);
        return this.cache.get(normalizedHex);
      }

      // Check database cache
      const cached = this.database.getRegistrationByHex(normalizedHex);
      if (cached && cached.registration) {
        console.log(`🗄️  Database cache hit for hex: ${normalizedHex} → ${cached.registration}`);
        this.cache.set(normalizedHex, cached);
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      // Try each API until we get a result
      for (const api of this.apis) {
        try {
          console.log(`🔍 Looking up ${normalizedHex} via ${api.name}...`);
          
          const url = api.url(normalizedHex);
          const response = await axios.get(url, {
            timeout: 8000,
            headers: {
              'User-Agent': 'AirWave-MissionControl/1.0'
            }
          });

          const result = api.parseResponse(response.data);
          
          if (result && result.registration) {
            console.log(`✅ Found registration for ${normalizedHex}: ${result.registration} via ${api.name}`);
            
            // Add hex to result
            result.hex = normalizedHex;
            result.source = api.name;
            result.lookedUpAt = new Date().toISOString();
            
            // Cache in memory and database
            this.cache.set(normalizedHex, result);
            this.database.saveHexToRegistration(result);
            
            this.emit('registration_found', result);
            return result;
          }
        } catch (error) {
          console.log(`⚠️  ${api.name} lookup failed for ${normalizedHex}: ${error.message}`);
          // Continue to next API
        }
      }

      // No registration found from any API
      console.log(`❌ No registration found for hex: ${normalizedHex}`);
      
      // Cache the negative result temporarily (prevent repeated lookups)
      const negativeResult = {
        hex: normalizedHex,
        registration: null,
        lookedUpAt: new Date().toISOString()
      };
      this.cache.set(normalizedHex, negativeResult);
      
      return null;
    } catch (error) {
      console.error(`Error looking up hex ${hex}:`, error.message);
      return null;
    }
  }

  /**
   * Batch lookup multiple hex codes
   * @param {Array<string>} hexCodes - Array of hex codes
   * @returns {Promise<Map>} Map of hex → registration data
   */
  async batchLookup(hexCodes) {
    const results = new Map();
    
    console.log(`🔄 Batch lookup for ${hexCodes.length} aircraft...`);
    
    for (const hex of hexCodes) {
      try {
        const result = await this.lookupRegistration(hex);
        if (result && result.registration) {
          results.set(hex, result);
        }
        
        // Rate limiting between requests
        await new Promise(resolve => setTimeout(resolve, this.rateLimit));
      } catch (error) {
        console.error(`Error in batch lookup for ${hex}:`, error.message);
      }
    }
    
    console.log(`✅ Batch lookup complete: ${results.size}/${hexCodes.length} found`);
    return results;
  }

  /**
   * Lookup registrations for active aircraft and update database
   */
  async updateActiveAircraftRegistrations() {
    try {
      console.log('🔄 Updating registrations for active aircraft...');
      
      // Get active aircraft without registrations
      const activeAircraft = this.database.getActiveAircraft(100);
      const needsLookup = activeAircraft.filter(ac => {
        // Skip if already has a proper registration (not just hex)
        const hasReg = ac.tail && ac.tail.match(/^[A-Z]{1,2}-?[A-Z0-9]{3,5}$/i);
        return !hasReg && ac.tail;
      });

      console.log(`   Found ${needsLookup.length} aircraft needing registration lookup`);

      let foundCount = 0;
      for (const aircraft of needsLookup.slice(0, 20)) { // Limit to 20 to avoid rate limits
        const result = await this.lookupRegistration(aircraft.tail);
        
        if (result && result.registration) {
          // Update aircraft record with registration
          this.database.updateAircraftRegistration(aircraft.tail, result.registration, result.type);
          foundCount++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.rateLimit));
      }

      console.log(`✅ Updated ${foundCount} aircraft registrations`);
      
      this.emit('batch_update_complete', {
        processed: Math.min(needsLookup.length, 20),
        found: foundCount
      });
      
      return foundCount;
    } catch (error) {
      console.error('Error updating aircraft registrations:', error);
      throw error;
    }
  }

  /**
   * Start background job to lookup registrations
   */
  startBackgroundLookup(intervalMs = 10 * 60 * 1000) { // Every 10 minutes
    console.log(`🔄 Starting background registration lookup (every ${intervalMs / 1000 / 60} minutes)`);
    
    // Run immediately
    setTimeout(() => {
      this.updateActiveAircraftRegistrations().catch(err => {
        console.error('Background lookup failed:', err);
      });
    }, 5000); // Wait 5 seconds after startup
    
    // Then run on interval
    this.lookupInterval = setInterval(() => {
      this.updateActiveAircraftRegistrations().catch(err => {
        console.error('Background lookup failed:', err);
      });
    }, intervalMs);
  }

  /**
   * Stop background lookup
   */
  stopBackgroundLookup() {
    if (this.lookupInterval) {
      clearInterval(this.lookupInterval);
      this.lookupInterval = null;
      console.log('🛑 Background registration lookup stopped');
    }
  }

  /**
   * Enforce rate limiting
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimit) {
      const delay = this.rateLimit - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      dbCacheSize: this.database.getHexToRegCacheSize()
    };
  }

  /**
   * Clear memory cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️  Memory cache cleared');
  }
}

module.exports = HexToRegService;

