const AircraftPhotoService = require('../aircraft-photo-service');
const PhotoDownloader = require('../photo-downloader');
const VideoRenderer = require('../video-renderer');
const YouTubeAPIService = require('../youtube-api-service');
const TwitterClient = require('../twitter-client');

/**
 * Initialize media services (photos, video, Twitter, YouTube)
 * @param {Object} params - Parameters object
 * @param {Object} params.database - Database instance
 * @param {Object} params.hexToRegService - Hex-to-registration service
 * @returns {Promise<Object>} Media services object
 */
async function initializeMediaServices({ database, hexToRegService }) {
  console.log('📸 Initializing media services...');
  
  // Initialize aircraft photo service with hex-to-reg service
  const photoService = new AircraftPhotoService(database, hexToRegService);
  photoService.startBackgroundPrefetch(30 * 60 * 1000); // Every 30 minutes
  console.log('✅ Aircraft photo service initialized');
  
  // Initialize photo downloader
  const photoDownloader = new PhotoDownloader(database);
  photoDownloader.startBackgroundDownload(15 * 60 * 1000); // Every 15 minutes
  console.log('✅ Photo downloader initialized');
  
  // Initialize video rendering service
  const videoRenderer = new VideoRenderer(database);
  console.log('✅ Video renderer initialized');
  
  // Initialize Twitter client (gracefully handle missing credentials)
  let twitterClient = null;
  try {
    twitterClient = new TwitterClient();
    console.log('✅ Twitter client initialized');
  } catch (error) {
    console.warn('⚠️  Twitter client initialization skipped:', error.message);
  }
  
  // Initialize YouTube API service
  const youtubeAPIService = new YouTubeAPIService(database);
  try {
    await youtubeAPIService.initialize();
    if (youtubeAPIService.isConfigured()) {
      console.log('✅ YouTube API service initialized and configured');
    } else {
      console.log('⚠️  YouTube API service initialized but not configured - stream auto-discovery disabled');
    }
  } catch (error) {
    console.error('❌ YouTube API service initialization failed:', error.message);
  }
  
  return { photoService, photoDownloader, videoRenderer, twitterClient, youtubeAPIService };
}

/**
 * Cleanup media services on shutdown
 * @param {Object} services - Media services object
 */
function cleanupMediaServices(services) {
  if (services.photoService) {
    services.photoService.stopBackgroundPrefetch();
  }
  if (services.photoDownloader) {
    services.photoDownloader.stopBackgroundDownload();
  }
  console.log('✅ Media services cleaned up');
}

module.exports = {
  initializeMediaServices,
  cleanupMediaServices
};

