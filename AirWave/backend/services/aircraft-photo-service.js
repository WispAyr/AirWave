const axios = require('axios');
const EventEmitter = require('events');

/**
 * Aircraft Photo Service
 * Fetches and caches aircraft photos from JetAPI
 */
class AircraftPhotoService extends EventEmitter {
  constructor(database, hexToRegService = null) {
    super();
    this.database = database;
    this.hexToRegService = hexToRegService;
    this.baseUrl = process.env.JETAPI_BASE_URL || 'https://www.jetapi.dev/api';
    this.defaultPhotoCount = parseInt(process.env.JETAPI_DEFAULT_PHOTO_COUNT) || 5;
    this.cacheTTL = parseInt(process.env.JETAPI_CACHE_TTL_DAYS) || 7;
    this.rateLimit = parseInt(process.env.JETAPI_RATE_LIMIT_MS) || 1000;
    this.lastRequestTime = 0;
    this.prefetchInterval = null;
    this.activeRequests = new Map();
  }

  /**
   * Set hex-to-reg service (can be set after construction)
   */
  setHexToRegService(hexToRegService) {
    this.hexToRegService = hexToRegService;
  }

  /**
   * Fetch photos for aircraft from JetAPI
   * @param {string} identifier - Aircraft registration/tail number or hex code
   * @param {Object} options - Optional parameters
   * @returns {Promise<Array>} Array of photo objects
   */
  async fetchPhotosForAircraft(identifier, options = {}) {
    if (!identifier) {
      throw new Error('Aircraft identifier is required');
    }

    let registration = identifier;

    // Check if identifier is a hex code (6 hex digits)
    const isHexCode = /^[0-9a-f]{6}$/i.test(identifier);
    
    if (isHexCode && this.hexToRegService) {
      console.log(`🔍 Identifier ${identifier} appears to be a hex code, looking up registration...`);
      
      try {
        const regData = await this.hexToRegService.lookupRegistration(identifier);
        
        if (regData && regData.registration) {
          registration = regData.registration;
          console.log(`✅ Converted hex ${identifier} to registration ${registration}`);
        } else {
          console.warn(`⚠️  No registration found for hex ${identifier}, cannot fetch photos`);
          return [];
        }
      } catch (error) {
        console.error(`❌ Hex lookup failed for ${identifier}:`, error.message);
        return [];
      }
    } else if (isHexCode) {
      console.warn(`⚠️  Hex-to-reg service not available, cannot convert ${identifier}`);
      return [];
    }

    const photoCount = options.photoCount || this.defaultPhotoCount;
    
    try {
      // Rate limiting - ensure minimum time between requests
      await this.enforceRateLimit();
      
      // Build API request URL
      const url = `${this.baseUrl}?reg=${encodeURIComponent(registration)}&photos=${photoCount}`;
      
      console.log(`📸 Fetching photos for ${registration} from JetAPI...`);
      
      // Make request with retry logic
      const response = await this.makeRequestWithRetry(url, 3);
      
      if (!response.data) {
        throw new Error('No data returned from JetAPI');
      }

      // Parse and normalize photo data
      const photos = this.parsePhotoResponse(response.data, registration);
      
      if (photos.length > 0) {
        // Store photos in database
        const saved = await this.database.saveAircraftPhotos(registration, photos);
        
        if (saved) {
          this.emit('photos_fetched', {
            registration,
            count: photos.length,
            timestamp: new Date().toISOString()
          });
          
          console.log(`✅ Fetched and saved ${photos.length} photos for ${registration}`);
        } else {
          console.log(`⚠️  Fetched ${photos.length} photos but failed to save for ${registration}`);
        }
      } else {
        console.log(`⚠️  No photos found for ${registration}`);
      }
      
      return photos;
    } catch (error) {
      console.error(`❌ Error fetching photos for ${registration}:`, error.message);
      
      this.emit('photos_fetch_failed', {
        registration,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Make HTTP request with exponential backoff retry
   */
  async makeRequestWithRetry(url, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'AirWave-MissionControl/1.0'
          }
        });
        
        return response;
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏰ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Enforce rate limiting between requests
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
   * Parse JetAPI response and normalize photo data
   */
  parsePhotoResponse(data, registration) {
    const photos = [];
    
    // Handle JetAPI response format
    let photoArray = [];
    
    // JetPhotos section
    if (data.JetPhotos && data.JetPhotos.Images && Array.isArray(data.JetPhotos.Images)) {
      photoArray = data.JetPhotos.Images;
    }
    // FlightRadar section (if available)
    else if (data.FlightRadar && Array.isArray(data.FlightRadar)) {
      photoArray = data.FlightRadar;
    }
    // Generic array fallback
    else if (Array.isArray(data)) {
      photoArray = data;
    } else if (data.photos && Array.isArray(data.photos)) {
      photoArray = data.photos;
    } else if (data.data && Array.isArray(data.data)) {
      photoArray = data.data;
    }
    
    for (const item of photoArray) {
      try {
        const photo = {
          url: item.Image || item.url || item.photo_url || item.link,
          thumbnail_url: item.Thumbnail || item.thumbnail || item.thumb_url || item.thumbnail_url || null,
          photographer: item.Photographer || item.photographer || item.author || item.credit || 'Unknown',
          upload_date: item.DateTaken || item.DateUploaded || item.upload_date || item.date || item.timestamp || null,
          source: item.source || this.determineSource(item.Image || item.url) || 'JetPhotos',
          aircraft_type: item.Aircraft || item.aircraft_type || item.type || null,
        };
        
        // Only add if we have a valid URL
        if (photo.url) {
          photos.push(photo);
        }
      } catch (error) {
        console.error('Error parsing photo item:', error);
      }
    }
    
    return photos;
  }

  /**
   * Determine photo source from URL
   */
  determineSource(url) {
    if (!url) return null;
    
    if (url.includes('jetphotos.com') || url.includes('jetphotos.net')) {
      return 'JetPhotos';
    } else if (url.includes('flightradar24') || url.includes('fr24')) {
      return 'FlightRadar24';
    }
    
    return null;
  }

  /**
   * Get cached photos for aircraft
   * @param {string} identifier - Aircraft ID (tail/flight/hex)
   * @param {number} limit - Maximum number of photos to return
   * @returns {Promise<Array>} Cached photos
   */
  async getCachedPhotos(identifier, limit = 10) {
    try {
      const photos = await this.database.getAircraftPhotos(identifier, limit);
      return photos || [];
    } catch (error) {
      console.error(`Error getting cached photos for ${identifier}:`, error);
      return [];
    }
  }

  /**
   * Check if cached photos should be refreshed
   * @param {string} lastFetchTime - ISO timestamp of last fetch
   * @param {number} ttl - Time-to-live in days
   * @returns {boolean}
   */
  shouldRefreshPhotos(lastFetchTime, ttl = null) {
    if (!lastFetchTime) return true;
    
    const cacheDays = ttl !== null ? ttl : this.cacheTTL;
    const now = new Date();
    const fetchDate = new Date(lastFetchTime);
    const daysSinceFetch = (now - fetchDate) / (1000 * 60 * 60 * 24);
    
    return daysSinceFetch >= cacheDays;
  }

  /**
   * Prefetch photos for active aircraft without cached photos
   */
  async prefetchPhotosForActiveAircraft() {
    try {
      console.log('🔄 Starting background photo prefetch...');
      
      // Get active aircraft from database
      const activeAircraft = await this.database.getActiveAircraft(100);
      
      let prefetchCount = 0;
      let skippedCount = 0;
      
      for (const aircraft of activeAircraft) {
        // Skip if no tail number
        if (!aircraft.tail) {
          skippedCount++;
          continue;
        }
        
        // Check if photos exist and are fresh
        const cachedPhotos = await this.getCachedPhotos(aircraft.tail);
        
        if (cachedPhotos.length === 0) {
          // No photos cached - fetch them
          try {
            await this.fetchPhotosForAircraft(aircraft.tail);
            prefetchCount++;
            
            // Don't overwhelm the API - spread out requests
            await new Promise(resolve => setTimeout(resolve, this.rateLimit));
          } catch (error) {
            console.error(`Failed to prefetch photos for ${aircraft.tail}:`, error.message);
          }
        } else {
          // Check if photos are stale
          const oldestPhoto = cachedPhotos[cachedPhotos.length - 1];
          
          if (this.shouldRefreshPhotos(oldestPhoto.fetched_at)) {
            try {
              await this.fetchPhotosForAircraft(aircraft.tail);
              prefetchCount++;
              await new Promise(resolve => setTimeout(resolve, this.rateLimit));
            } catch (error) {
              console.error(`Failed to refresh photos for ${aircraft.tail}:`, error.message);
            }
          }
        }
      }
      
      console.log(`✅ Photo prefetch complete: ${prefetchCount} fetched, ${skippedCount} skipped`);
      
      this.emit('prefetch_complete', {
        fetched: prefetchCount,
        skipped: skippedCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error during photo prefetch:', error);
      this.emit('prefetch_failed', { error: error.message });
    }
  }

  /**
   * Start background prefetch job
   * @param {number} intervalMs - Interval in milliseconds
   */
  startBackgroundPrefetch(intervalMs = 30 * 60 * 1000) {
    if (this.prefetchInterval) {
      console.log('⚠️  Background prefetch already running');
      return;
    }
    
    console.log(`🔄 Starting background photo prefetch (every ${intervalMs / 1000 / 60} minutes)`);
    
    // Run immediately
    this.prefetchPhotosForActiveAircraft();
    
    // Then run on interval
    this.prefetchInterval = setInterval(() => {
      this.prefetchPhotosForActiveAircraft();
    }, intervalMs);
  }

  /**
   * Stop background prefetch job
   */
  stopBackgroundPrefetch() {
    if (this.prefetchInterval) {
      clearInterval(this.prefetchInterval);
      this.prefetchInterval = null;
      console.log('🛑 Background photo prefetch stopped');
    }
  }
}

module.exports = AircraftPhotoService;

