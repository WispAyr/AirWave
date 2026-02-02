const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

class TwitterClient {
  constructor() {
    this.client = null;
    this.enabled = false;
    
    this.initialize();
  }

  /**
   * Initialize Twitter client with credentials from environment variables
   */
  initialize() {
    try {
      const apiKey = process.env.TWITTER_API_KEY;
      const apiSecret = process.env.TWITTER_API_SECRET;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessSecret = process.env.TWITTER_ACCESS_SECRET;

      if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        console.warn('⚠️  Twitter API credentials not found in environment variables');
        console.warn('   Video posting to Twitter will be disabled');
        console.warn('   Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_SECRET to enable');
        return;
      }

      // Initialize Twitter API client with OAuth 1.0a (User Context)
      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });

      this.enabled = true;
      console.log('✅ Twitter API client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Twitter client:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Check if Twitter integration is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Upload a video to Twitter using chunked upload
   * @param {string} filePath - Path to the video file
   * @returns {Promise<string>} Media ID
   */
  async uploadVideo(filePath) {
    if (!this.enabled) {
      throw new Error('Twitter API is not enabled. Check your credentials.');
    }

    console.log(`📤 Uploading video to Twitter: ${path.basename(filePath)}`);

    try {
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
      console.log(`   File size: ${fileSizeMB} MB`);

      // Twitter video size limit is 512MB
      if (fileStats.size > 512 * 1024 * 1024) {
        throw new Error(`Video file too large: ${fileSizeMB} MB (max 512 MB)`);
      }

      // Upload video using the v1 media upload endpoint (chunked upload)
      const mediaId = await this.client.v1.uploadMedia(filePath, {
        mimeType: 'video/mp4',
        target: 'tweet',
      });

      console.log(`✅ Video uploaded successfully: ${mediaId}`);
      return mediaId;
    } catch (error) {
      console.error('❌ Video upload failed:', error);
      throw new Error(`Twitter upload failed: ${error.message}`);
    }
  }

  /**
   * Post a tweet with uploaded video
   * @param {string} text - Tweet text
   * @param {string} mediaId - Media ID from uploadVideo
   * @returns {Promise<object>} Tweet data including URL
   */
  async postTweetWithVideo(text, mediaId) {
    if (!this.enabled) {
      throw new Error('Twitter API is not enabled. Check your credentials.');
    }

    console.log(`🐦 Posting tweet with video...`);
    console.log(`   Text: "${text}"`);

    try {
      // Create tweet with media using v2 API
      const tweet = await this.client.v2.tweet({
        text: text,
        media: {
          media_ids: [mediaId],
        },
      });

      const tweetId = tweet.data.id;
      
      // Get username for URL construction
      const user = await this.client.v2.me();
      const username = user.data.username;
      
      const tweetUrl = `https://twitter.com/${username}/status/${tweetId}`;
      
      console.log(`✅ Tweet posted successfully!`);
      console.log(`   URL: ${tweetUrl}`);

      return {
        id: tweetId,
        url: tweetUrl,
        username: username,
        text: text,
      };
    } catch (error) {
      console.error('❌ Tweet posting failed:', error);
      throw new Error(`Failed to post tweet: ${error.message}`);
    }
  }

  /**
   * Generate tweet text from aircraft metadata
   * @param {object} aircraftData - Aircraft metadata
   * @returns {string} Tweet text
   */
  generateTweetText(aircraftData) {
    const { flight, tail, type, trackPointCount, duration } = aircraftData;
    
    const parts = [];
    
    // Main identifier
    if (flight && flight !== 'N/A') {
      parts.push(`✈️ Flight ${flight}`);
    } else if (tail && tail !== 'N/A') {
      parts.push(`✈️ Aircraft ${tail}`);
    } else {
      parts.push(`✈️ Aircraft Track`);
    }

    // Aircraft type
    if (type && type !== 'Unknown') {
      parts.push(`(${type})`);
    }

    // Track info
    if (trackPointCount) {
      parts.push(`\n📍 ${trackPointCount} positions tracked`);
    }

    if (duration) {
      const durationMin = (duration / 60).toFixed(1);
      parts.push(`\n⏱️ ${durationMin} minutes of flight data`);
    }

    // Hashtags
    parts.push(`\n\n#Aviation #FlightTracking #AirWave #ACARS #ADSB`);

    return parts.join(' ');
  }

  /**
   * Convenience method to upload video and post tweet in one call
   * @param {string} aircraftId - Aircraft identifier
   * @param {string} videoPath - Path to video file
   * @param {object} metadata - Aircraft metadata
   * @param {string} customText - Optional custom tweet text
   * @returns {Promise<object>} Tweet data
   */
  async postAircraftVideo(aircraftId, videoPath, metadata, customText = null) {
    if (!this.enabled) {
      throw new Error('Twitter API is not enabled. Configure credentials in .env file.');
    }

    const startTime = Date.now();
    console.log(`\n🚀 Posting aircraft video to Twitter...`);
    console.log(`   Aircraft: ${aircraftId}`);
    console.log(`   Video: ${path.basename(videoPath)}`);

    try {
      // Verify video file exists
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      // Upload video
      const mediaId = await this.uploadVideo(videoPath);

      // Generate or use custom tweet text
      const tweetText = customText || this.generateTweetText(metadata.aircraftData || {});

      // Post tweet
      const result = await this.postTweetWithVideo(tweetText, mediaId);

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Video posted to Twitter successfully in ${elapsedTime}s`);

      return {
        success: true,
        tweetUrl: result.url,
        tweetId: result.id,
        username: result.username,
        text: result.text,
      };
    } catch (error) {
      console.error(`\n❌ Failed to post video to Twitter:`, error.message);
      throw error;
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus() {
    if (!this.enabled) {
      return { error: 'Twitter API not enabled' };
    }

    try {
      const rateLimits = await this.client.v2.rateLimitStatuses();
      return rateLimits;
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return { error: error.message };
    }
  }

  /**
   * Test connection to Twitter API
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, error: 'Twitter API not enabled' };
    }

    try {
      const user = await this.client.v2.me();
      return {
        success: true,
        username: user.data.username,
        name: user.data.name,
        id: user.data.id,
      };
    } catch (error) {
      console.error('Twitter connection test failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = TwitterClient;





