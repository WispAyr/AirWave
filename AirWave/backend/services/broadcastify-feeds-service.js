const fs = require('fs');
const path = require('path');

/**
 * Service for managing Broadcastify emergency scanner feeds
 */
class BroadcastifyFeedsService {
  constructor() {
    this.feeds = [];
    this.feedsPath = path.join(__dirname, '../data/broadcastify-feeds.json');
    this.loadFeeds();
  }

  /**
   * Load feeds from JSON file
   */
  loadFeeds() {
    try {
      const data = fs.readFileSync(this.feedsPath, 'utf8');
      this.feeds = JSON.parse(data);
      console.log(`✅ Loaded ${this.feeds.length} Broadcastify emergency scanner feeds`);
    } catch (error) {
      console.error('❌ Error loading Broadcastify feeds:', error.message);
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
   * Get feeds by US state code
   * @param {string} stateCode - Two-letter state code (e.g., 'CA', 'TX')
   * @returns {Array} Feeds for the specified state
   */
  getFeedsByState(stateCode) {
    if (!stateCode) {
      throw new Error('State code is required');
    }
    return this.feeds.filter(feed => feed.stateCode.toLowerCase() === stateCode.toLowerCase());
  }

  /**
   * Get feeds by county name
   * @param {string} countyName - County name
   * @returns {Array} Feeds in the specified county
   */
  getFeedsByCounty(countyName) {
    if (!countyName) {
      throw new Error('County name is required');
    }
    return this.feeds.filter(feed => feed.county.toLowerCase() === countyName.toLowerCase());
  }

  /**
   * Get feeds by agency type
   * @param {string} type - Agency type (police/fire/ems/multi)
   * @returns {Array} Feeds of the specified type
   */
  getFeedsByType(type) {
    if (!type) {
      throw new Error('Agency type is required');
    }
    const validTypes = ['police', 'fire', 'ems', 'multi'];
    if (!validTypes.includes(type.toLowerCase())) {
      throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }
    return this.feeds.filter(feed => feed.type.toLowerCase() === type.toLowerCase());
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
   * Search feeds by query (name, location, county, state, or description)
   * @param {string} query - Search query
   * @returns {Array} Matching feeds
   */
  searchFeeds(query) {
    if (!query) {
      return this.feeds;
    }

    const searchTerm = query.toLowerCase();
    return this.feeds.filter(feed => 
      feed.name.toLowerCase().includes(searchTerm) ||
      feed.description.toLowerCase().includes(searchTerm) ||
      feed.county.toLowerCase().includes(searchTerm) ||
      feed.state.toLowerCase().includes(searchTerm) ||
      feed.stateCode.toLowerCase().includes(searchTerm) ||
      feed.type.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get list of available states with feed counts
   * @returns {Array} States with feed counts
   */
  getStates() {
    const stateMap = new Map();
    
    this.feeds.forEach(feed => {
      const existing = stateMap.get(feed.stateCode) || { 
        stateCode: feed.stateCode, 
        state: feed.state, 
        count: 0 
      };
      existing.count++;
      stateMap.set(feed.stateCode, existing);
    });

    return Array.from(stateMap.values()).sort((a, b) => 
      a.state.localeCompare(b.state)
    );
  }

  /**
   * Get counties for a specific state
   * @param {string} stateCode - Two-letter state code
   * @returns {Array} Counties with feed counts
   */
  getCountiesByState(stateCode) {
    if (!stateCode) {
      throw new Error('State code is required');
    }

    const countyMap = new Map();
    const stateFeeds = this.getFeedsByState(stateCode);
    
    stateFeeds.forEach(feed => {
      const existing = countyMap.get(feed.county) || { 
        county: feed.county, 
        count: 0 
      };
      existing.count++;
      countyMap.set(feed.county, existing);
    });

    return Array.from(countyMap.values()).sort((a, b) => 
      a.county.localeCompare(b.county)
    );
  }
}

module.exports = BroadcastifyFeedsService;





