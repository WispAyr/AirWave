const fs = require('fs');
const path = require('path');

/**
 * Service for managing ATC feed data
 */
class ATCFeedsService {
  constructor() {
    this.feeds = [];
    this.feedsPath = path.join(__dirname, '../data/atc-feeds.json');
    this.loadFeeds();
  }

  /**
   * Load feeds from JSON file
   */
  loadFeeds() {
    try {
      const data = fs.readFileSync(this.feedsPath, 'utf8');
      this.feeds = JSON.parse(data);
      console.log(`✅ Loaded ${this.feeds.length} ATC feeds`);
    } catch (error) {
      console.error('❌ Error loading ATC feeds:', error.message);
      this.feeds = [];
    }
  }

  /**
   * Get all available feeds
   * @returns {Array} All feeds
   */
  getAllFeeds() {
    return this.feeds;
  }

  /**
   * Get feeds by airport ICAO code
   * @param {string} icao - ICAO airport code
   * @returns {Array} Feeds for the specified airport
   */
  getFeedsByAirport(icao) {
    if (!icao) {
      throw new Error('ICAO code is required');
    }
    return this.feeds.filter(feed => feed.icao.toLowerCase() === icao.toLowerCase());
  }

  /**
   * Get feeds by region
   * @param {string} region - Region name
   * @returns {Array} Feeds in the specified region
   */
  getFeedsByRegion(region) {
    if (!region) {
      throw new Error('Region is required');
    }
    return this.feeds.filter(feed => feed.region.toLowerCase() === region.toLowerCase());
  }

  /**
   * Get a specific feed by ID
   * @param {string} id - Feed ID
   * @returns {Object|null} Feed object or null if not found
   */
  getFeedById(id) {
    if (!id) {
      throw new Error('Feed ID is required');
    }
    return this.feeds.find(feed => feed.id === id) || null;
  }

  /**
   * Search feeds by query (airport name, ICAO, or type)
   * @param {string} query - Search query
   * @returns {Array} Matching feeds
   */
  searchFeeds(query) {
    if (!query) {
      return this.feeds;
    }

    const searchTerm = query.toLowerCase();
    return this.feeds.filter(feed => 
      feed.airport.toLowerCase().includes(searchTerm) ||
      feed.icao.toLowerCase().includes(searchTerm) ||
      feed.name.toLowerCase().includes(searchTerm) ||
      feed.type.toLowerCase().includes(searchTerm)
    );
  }
}

module.exports = ATCFeedsService;

