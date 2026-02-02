const { google } = require('googleapis');

/**
 * Service for interacting with YouTube Data API v3 to fetch live streams
 * Implements caching to minimize API quota usage
 */
class YouTubeAPIService {
  constructor(database) {
    this.database = database;
    this.youtube = null;
    this.apiKey = null;
    
    // Cache for channel IDs (24 hour TTL)
    this.channelCache = new Map();
    this.channelCacheTTL = 24 * 60 * 60 * 1000; // 24 hours
    
    // Cache for live streams (5 minute TTL)
    this.streamCache = new Map();
    this.streamCacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the service by loading API key from database
   */
  async initialize() {
    try {
      const setting = this.database.getSetting('youtube_api_key');
      
      if (setting && setting.value) {
        this.apiKey = setting.value;
        this.youtube = google.youtube({
          version: 'v3',
          auth: this.apiKey
        });
        console.log('✅ YouTube API service initialized');
      } else {
        console.log('⚠️  YouTube API key not configured - stream auto-discovery disabled');
      }
    } catch (error) {
      console.error('❌ Error initializing YouTube API service:', error.message);
    }
  }

  /**
   * Check if the service is configured with an API key
   */
  isConfigured() {
    return this.youtube !== null && this.apiKey !== null;
  }

  /**
   * Resolve a channel handle (e.g., @neetintel) to a channel ID
   * Results are cached for 24 hours
   */
  async getChannelIdFromHandle(handle) {
    if (!this.isConfigured()) {
      throw new Error('YouTube API not configured');
    }

    // Clean handle - ensure it starts with @
    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;

    // Check cache first
    const cached = this.channelCache.get(cleanHandle);
    if (cached && Date.now() - cached.timestamp < this.channelCacheTTL) {
      console.log(`📦 Using cached channel ID for ${cleanHandle}`);
      return cached.channelId;
    }

    try {
      console.log(`🔍 Resolving channel handle: ${cleanHandle}`);
      
      const response = await this.youtube.channels.list({
        part: 'id,snippet',
        forHandle: cleanHandle.substring(1) // Remove @ for API call
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error(`Channel not found: ${cleanHandle}`);
      }

      const channelId = response.data.items[0].id;
      
      // Cache the result
      this.channelCache.set(cleanHandle, {
        channelId,
        channelTitle: response.data.items[0].snippet.title,
        timestamp: Date.now()
      });

      console.log(`✅ Resolved ${cleanHandle} to channel ID: ${channelId}`);
      return channelId;
    } catch (error) {
      console.error(`❌ Error resolving channel handle ${cleanHandle}:`, error.message);
      
      // Return cached data if available, even if expired
      if (cached) {
        console.log(`⚠️  Using stale cache for ${cleanHandle}`);
        return cached.channelId;
      }
      
      throw error;
    }
  }

  /**
   * Fetch currently live streams from a channel ID
   * Returns detailed stream information including viewer count
   */
  async getLiveStreamsForChannel(channelId, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('YouTube API not configured');
    }

    const maxResults = options.maxResults || 5;

    // Check cache first
    const cacheKey = `${channelId}_${maxResults}`;
    const cached = this.streamCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.streamCacheTTL) {
      console.log(`📦 Using cached live streams for channel ${channelId}`);
      return cached.streams;
    }

    try {
      console.log(`🔍 Fetching live streams for channel: ${channelId}`);
      
      // Search for live broadcasts
      const searchResponse = await this.youtube.search.list({
        part: 'id,snippet',
        channelId: channelId,
        eventType: 'live',
        type: 'video',
        maxResults: maxResults
      });

      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        console.log(`📭 No live streams found for channel ${channelId}`);
        
        // Cache empty result
        this.streamCache.set(cacheKey, {
          streams: [],
          timestamp: Date.now()
        });
        
        return [];
      }

      // Get detailed video information including live streaming details
      const videoIds = searchResponse.data.items.map(item => item.id.videoId);
      
      const videosResponse = await this.youtube.videos.list({
        part: 'id,snippet,liveStreamingDetails',
        id: videoIds.join(',')
      });

      // Format the results
      const streams = videosResponse.data.items.map(video => ({
        videoId: video.id,
        title: video.snippet.title,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnailUrl: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
        scheduledStartTime: video.liveStreamingDetails?.scheduledStartTime,
        actualStartTime: video.liveStreamingDetails?.actualStartTime,
        concurrentViewers: video.liveStreamingDetails?.concurrentViewers || 0,
        channelTitle: video.snippet.channelTitle
      }));

      console.log(`✅ Found ${streams.length} live stream(s) for channel ${channelId}`);

      // Cache the results
      this.streamCache.set(cacheKey, {
        streams,
        timestamp: Date.now()
      });

      return streams;
    } catch (error) {
      console.error(`❌ Error fetching live streams for channel ${channelId}:`, error.message);
      
      // Return cached data if available, even if expired
      if (cached) {
        console.log(`⚠️  Using stale cache for channel ${channelId}`);
        return cached.streams;
      }
      
      return [];
    }
  }

  /**
   * Convenience method to get live streams for a channel handle
   * Combines handle resolution and stream fetching
   */
  async getLiveStreamsForHandle(handle, options = {}) {
    try {
      const channelId = await this.getChannelIdFromHandle(handle);
      return await this.getLiveStreamsForChannel(channelId, options);
    } catch (error) {
      console.error(`❌ Error getting live streams for handle ${handle}:`, error.message);
      throw error;
    }
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.channelCache.clear();
    this.streamCache.clear();
    console.log('🗑️  YouTube API cache cleared');
  }

  /**
   * Test if an API key is valid by making a simple API call
   */
  static async testApiKey(apiKey) {
    try {
      const youtube = google.youtube({
        version: 'v3',
        auth: apiKey
      });

      // Make a simple request to test the key
      const response = await youtube.search.list({
        part: 'id',
        maxResults: 1,
        q: 'test'
      });

      return response.status === 200;
    } catch (error) {
      console.error('❌ API key test failed:', error.message);
      return false;
    }
  }

  /**
   * Get channel information from a handle
   */
  async getChannelInfo(handle) {
    if (!this.isConfigured()) {
      throw new Error('YouTube API not configured');
    }

    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;

    try {
      const response = await this.youtube.channels.list({
        part: 'id,snippet',
        forHandle: cleanHandle.substring(1)
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error(`Channel not found: ${cleanHandle}`);
      }

      const channel = response.data.items[0];
      return {
        channelId: channel.id,
        channelTitle: channel.snippet.title,
        handle: cleanHandle
      };
    } catch (error) {
      console.error(`❌ Error getting channel info for ${cleanHandle}:`, error.message);
      throw error;
    }
  }
}

module.exports = YouTubeAPIService;

