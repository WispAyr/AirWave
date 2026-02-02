const express = require('express');
const router = express.Router();
const SchemaValidator = require('../utils/schema-validator');
const ATCFeedsService = require('../services/atc-feeds-service');
const BroadcastifyFeedsService = require('../services/broadcastify-feeds-service');
const WhisperClient = require('../services/whisper-client');
const AudioCapture = require('../services/audio-capture');
const VADRecorder = require('../services/vad-recorder');
const YouTubeStreamService = require('../services/youtube-stream-service');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Generic error ID generator
let errorIdCounter = 0;
const generateErrorId = () => {
  errorIdCounter = (errorIdCounter + 1) % 10000;
  return `ERR${String(errorIdCounter).padStart(4, '0')}`;
};

const validator = new SchemaValidator();
const atcFeedsService = new ATCFeedsService();
const broadcastifyFeedsService = new BroadcastifyFeedsService();
const whisperClient = new WhisperClient();

// AudioCapture and VADRecorder will be initialized when database is available
let audioCapture = null;
let vadRecorder = null;
let youtubeStreamService = null;
let youtubeAPIService = null;

// ============================================
// MOUNT MODULAR ROUTERS
// ============================================

router.use('/messages', require('./messages'));
router.use('/hfgcs', require('./hfgcs'));
router.use('/eam', require('./eam'));
router.use('/admin', require('./admin'));
router.use('/admin/broadcast', require('./broadcast'));

// ============================================
// CORE API ENDPOINTS
// ============================================

// Get all available schemas
router.get('/schemas', (req, res) => {
  const schemas = validator.listSchemas();
  res.json({ 
    count: schemas.length,
    schemas: schemas.map(name => ({
      name,
      endpoint: `/api/schemas/${name}`
    }))
  });
});

// Get specific schema
router.get('/schemas/:name', (req, res) => {
  const schema = validator.getSchemaInfo(req.params.name);
  if (schema) {
    res.json(schema);
  } else {
    res.status(404).json({ error: 'Schema not found' });
  }
});

// Get reference data
router.get('/reference/:type', (req, res) => {
  const csvPath = path.join(__dirname, '../../aviation_data_model_v1.0/csv', `${req.params.type}.csv`);
  
  if (fs.existsSync(csvPath)) {
    const data = fs.readFileSync(csvPath, 'utf8');
    res.type('text/csv').send(data);
  } else {
    res.status(404).json({ error: 'Reference data not found' });
  }
});

// Get data source status
router.get('/sources', (req, res) => {
  const dataSourceManager = req.app.locals.dataSourceManager;
  
  if (!dataSourceManager) {
    return res.status(503).json({ 
      error: 'DataSourceManager not available',
      sources: {},
      stats: {}
    });
  }

  try {
    const status = dataSourceManager.getStatus();
    const stats = dataSourceManager.getStats();
    
    res.json({ 
      sources: status,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting source status:', error);
    res.status(500).json({ 
      error: 'Failed to get source status',
      details: error.message
    });
  }
});

// Validate message endpoint
router.post('/validate/:schema', (req, res) => {
  const result = validator.validate(req.params.schema, req.body);
  res.json(result);
});

// Get statistics
router.get('/stats', (req, res) => {
  const database = req.app.locals.database;
  if (database) {
    const stats = database.getCurrentStatistics();
    const dbStats = database.getStats();
    res.json({
      ...stats,
      database: dbStats,
      timestamp: new Date().toISOString()
    });
  } else {
    res.json({
      message: 'Statistics endpoint',
      timestamp: new Date().toISOString()
    });
  }
});

// Get aircraft details by ID
router.get('/aircraft/:id', (req, res) => {
  const database = req.app.locals.database;
  const { id } = req.params;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const aircraft = database.getAircraftByIdentifier(id);
    
    if (!aircraft) {
      return res.status(404).json({ 
        success: false, 
        error: 'Aircraft not found',
        aircraft_id: id 
      });
    }

    res.json({
      success: true,
      aircraft: aircraft
    });
  } catch (error) {
    console.error('Error fetching aircraft:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch aircraft details' 
    });
  }
});

// Get aircraft track data by ID
router.get('/aircraft/:id/track', (req, res) => {
  const database = req.app.locals.database;
  const aircraftTracker = req.app.locals.aircraftTracker;
  const { id } = req.params;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    let track = database.getAircraftByIdentifier(id);
    
    if (!track && aircraftTracker) {
      const memoryTrack = aircraftTracker.getTrack(id);
      if (memoryTrack) {
        track = memoryTrack;
      }
    }
    
    if (!track) {
      return res.status(404).json({ error: 'Aircraft not found' });
    }

    const messages = database.getMessagesByFlight(id, 200);
    
    res.json({
      success: true,
      aircraft: track,
      messages: messages,
      trackPoints: track.track_points || []
    });
  } catch (error) {
    console.error('Error getting aircraft track:', error);
    res.status(500).json({ error: 'Failed to get aircraft track' });
  }
});

// Get messages for specific aircraft
router.get('/aircraft/:id/messages', (req, res) => {
  const database = req.app.locals.database;
  const { id } = req.params;
  const messageType = req.query.type;
  const limit = parseInt(req.query.limit) || 100;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    let messages = database.getMessagesByFlight(id, limit);
    
    if (messageType) {
      messages = messages.filter(msg => msg.category === messageType);
    }
    
    res.json({
      success: true,
      count: messages.length,
      messages: messages
    });
  } catch (error) {
    console.error('Error getting aircraft messages:', error);
    res.status(500).json({ error: 'Failed to get aircraft messages' });
  }
});

// Aircraft photo endpoints
router.get('/aircraft/:id/photo', async (req, res) => {
  const database = req.app.locals.database;
  const photoService = req.app.locals.photoService;
  const { id } = req.params;
  
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const photos = database.getAircraftPhotos(id);
    
    if (photos.length > 0 && photos[0].local_path) {
      const photoPath = photos[0].local_path;
      
      if (fs.existsSync(photoPath)) {
        return res.sendFile(path.resolve(photoPath));
      }
    }
    
    if (photos.length > 0 && photos[0].thumbnail_url) {
      return res.redirect(photos[0].thumbnail_url);
    }
    
    if (photos.length === 0 && photoService) {
      const aircraft = database.getAircraftByIdentifier(id);
      
      if (aircraft && aircraft.tail) {
        photoService.fetchPhotosForAircraft(aircraft.tail).catch(err => {
          console.error('Background photo fetch failed:', err);
        });
      }
    }
    
    return res.status(404).json({ error: 'No photo available' });
  } catch (error) {
    console.error('Error getting aircraft photo:', error);
    res.status(500).json({ error: 'Failed to get aircraft photo' });
  }
});

router.get('/aircraft/:id/photos', async (req, res) => {
  const database = req.app.locals.database;
  const photoService = req.app.locals.photoService;
  const { id } = req.params;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const photos = database.getAircraftPhotos(id);
    
    if (photos.length === 0 && photoService) {
      const aircraft = database.getAircraftByIdentifier(id);
      
      if (aircraft && aircraft.tail) {
        photoService.fetchPhotosForAircraft(aircraft.tail).catch(err => {
          console.error('Background photo fetch failed:', err);
        });
      }
    }
    
    res.json({
      success: true,
      count: photos.length,
      photos: photos
    });
  } catch (error) {
    console.error('Error getting aircraft photos:', error);
    res.status(500).json({ error: 'Failed to get aircraft photos' });
  }
});

router.post('/aircraft/:id/photos/refresh', async (req, res) => {
  const database = req.app.locals.database;
  const photoService = req.app.locals.photoService;
  const { id } = req.params;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }
  
  if (!photoService) {
    return res.status(503).json({ error: 'Photo service not available' });
  }

  try {
    const aircraft = database.getAircraftByIdentifier(id);
    
    if (!aircraft) {
      return res.status(404).json({ error: 'Aircraft not found' });
    }
    
    if (!aircraft.tail) {
      return res.status(400).json({ 
        error: 'Aircraft has no tail number',
        details: 'Cannot fetch photos without registration/tail number'
      });
    }
    
    const photos = await photoService.fetchPhotosForAircraft(aircraft.tail);
    
    res.json({
      success: true,
      count: photos.length,
      photos: photos
    });
  } catch (error) {
    const errorId = generateErrorId();
    logger.error('Error refreshing aircraft photos:', { errorId, error: error.message, aircraftId: id });
    res.status(500).json({ 
      error: 'Failed to refresh photos',
      errorId: errorId
    });
  }
});

router.get('/photos/stats', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const stats = database.getPhotoStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting photo stats:', error);
    res.status(500).json({ error: 'Failed to get photo statistics' });
  }
});

router.post('/photos/prefetch', async (req, res) => {
  const photoService = req.app.locals.photoService;
  
  if (!photoService) {
    return res.status(503).json({ error: 'Photo service not available' });
  }

  try {
    photoService.prefetchPhotosForActiveAircraft().catch(err => {
      console.error('Prefetch failed:', err);
    });
    
    res.json({
      success: true,
      message: 'Photo prefetch started in background'
    });
  } catch (error) {
    console.error('Error starting photo prefetch:', error);
    res.status(500).json({ error: 'Failed to start prefetch' });
  }
});

router.post('/aircraft/:id/photos/download', async (req, res) => {
  const photoDownloader = req.app.locals.photoDownloader;
  const { id } = req.params;
  
  if (!photoDownloader) {
    return res.status(503).json({ error: 'Photo downloader not available' });
  }

  try {
    const paths = await photoDownloader.downloadPhotosForAircraft(id);
    
    res.json({
      success: true,
      downloaded: paths.length,
      paths: paths
    });
  } catch (error) {
    const errorId = generateErrorId();
    logger.error('Error downloading photos:', { errorId, error: error.message, aircraftId: id });
    res.status(500).json({ 
      error: 'Failed to download photos',
      errorId: errorId
    });
  }
});

// Hex to Registration endpoints
router.get('/hex-to-reg/stats', (req, res) => {
  const hexToRegService = req.app.locals.hexToRegService;
  
  if (!hexToRegService) {
    return res.status(503).json({ error: 'Hex-to-reg service not available' });
  }

  try {
    const stats = hexToRegService.getStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting hex-to-reg stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

router.post('/hex-to-reg/update-active', async (req, res) => {
  const hexToRegService = req.app.locals.hexToRegService;
  
  if (!hexToRegService) {
    return res.status(503).json({ error: 'Hex-to-reg service not available' });
  }

  try {
    hexToRegService.updateActiveAircraftRegistrations().catch(err => {
      console.error('Registration update failed:', err);
    });
    
    res.json({
      success: true,
      message: 'Registration update started in background'
    });
  } catch (error) {
    console.error('Error starting registration update:', error);
    res.status(500).json({ error: 'Failed to start update' });
  }
});

router.get('/hex-to-reg/:hex', async (req, res) => {
  const hexToRegService = req.app.locals.hexToRegService;
  const { hex } = req.params;
  
  if (!hexToRegService) {
    return res.status(503).json({ error: 'Hex-to-reg service not available' });
  }

  try {
    const result = await hexToRegService.lookupRegistration(hex);
    
    if (result && result.registration) {
      res.json({
        success: true,
        hex: hex,
        registration: result.registration,
        aircraftType: result.aircraft_type || result.type,
        country: result.country,
        source: result.source
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Registration not found for hex code',
        hex: hex
      });
    }
  } catch (error) {
    console.error('Error looking up hex:', error);
    res.status(500).json({ error: 'Failed to lookup hex code' });
  }
});

// ATC Feeds endpoints
router.get('/atc-feeds', (req, res) => {
  try {
    const feeds = atcFeedsService.getAllFeeds();
    res.json({ count: feeds.length, feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/atc-feeds/:id', (req, res) => {
  try {
    const feed = atcFeedsService.getFeedById(req.params.id);
    if (feed) {
      res.json(feed);
    } else {
      res.status(404).json({ error: 'Feed not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/atc-feeds/airport/:icao', (req, res) => {
  try {
    const feeds = atcFeedsService.getFeedsByAirport(req.params.icao);
    res.json({ count: feeds.length, icao: req.params.icao, feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/atc-feeds/region/:region', (req, res) => {
  try {
    const feeds = atcFeedsService.getFeedsByRegion(req.params.region);
    res.json({ count: feeds.length, region: req.params.region, feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/atc-feeds/search', (req, res) => {
  try {
    const query = req.query.q;
    const feeds = atcFeedsService.searchFeeds(query);
    res.json({ count: feeds.length, query, feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ATC Preferences endpoints
router.get('/atc-preferences', (req, res) => {
  const database = req.app.locals.database;
  
  if (database) {
    try {
      const preferences = database.getATCPreferences('default');
      res.json(preferences);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.json({
      lastFeedId: null,
      volume: 0.7,
      autoPlay: false,
      favoriteFeeds: []
    });
  }
});

router.post('/atc-preferences', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { lastFeedId, volume, autoPlay, favoriteFeeds } = req.body;
    
    if (volume !== undefined && (volume < 0 || volume > 1)) {
      return res.status(400).json({ error: 'Volume must be between 0 and 1' });
    }

    const preferences = {
      lastFeedId: lastFeedId || null,
      volume: volume !== undefined ? volume : 0.7,
      autoPlay: autoPlay !== undefined ? autoPlay : false,
      favoriteFeeds: favoriteFeeds || []
    };

    database.saveATCPreferences('default', preferences);
    res.json({ success: true, preferences });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/atc-preferences/favorites/:feedId', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    database.addFavoriteFeed('default', req.params.feedId);
    res.json({ success: true, feedId: req.params.feedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/atc-preferences/favorites/:feedId', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    database.removeFavoriteFeed('default', req.params.feedId);
    res.json({ success: true, feedId: req.params.feedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ATC Playlist proxy endpoint
router.get('/atc-playlist/:mount', async (req, res) => {
  const { mount } = req.params;
  
  if (!mount) {
    return res.status(400).json({ error: 'Mount point is required' });
  }

  try {
    const axios = require('axios');
    const playlistUrl = `https://www.liveatc.net/play/${mount}.pls`;
    
    const response = await axios.get(playlistUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'AirWave-Mission-Control/1.0'
      }
    });

    const playlistText = response.data;
    const lines = playlistText.split('\n');
    let streamUrl = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('File1=')) {
        streamUrl = trimmed.substring(6).trim();
        break;
      }
    }

    if (!streamUrl) {
      return res.status(404).json({ error: 'No stream URL found in playlist' });
    }

    res.json({ streamUrl });
  } catch (error) {
    console.error('Error fetching playlist:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch playlist',
      details: error.message 
    });
  }
});

// Transcription endpoints - GET /api/transcription/status
router.get('/transcription/status', async (req, res) => {
  try {
    const status = await whisperClient.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ available: false, error: error.message });
  }
});

// Start transcription for a feed
router.post('/transcription/start/:feedId', authenticate, async (req, res) => {
  const { feedId } = req.params;
  const feed = atcFeedsService.getFeedById(feedId);
  
  if (!feed) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  if (!audioCapture) {
    const database = req.app.locals.database;
    audioCapture = new AudioCapture(whisperClient, database);
    
    const wss = req.app.locals.wss;
    if (wss) {
      audioCapture.on('transcription', (data) => {
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'atc_transcription',
              data
            }));
          }
        });
      });
    }
  }

  try {
    const axios = require('axios');
    const playlistUrl = `https://www.liveatc.net/play/${feed.mount}.pls`;
    const response = await axios.get(playlistUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'AirWave-Mission-Control/1.0'
      }
    });
    
    const lines = response.data.split('\n');
    let streamUrl = null;
    for (const line of lines) {
      if (line.trim().startsWith('File1=')) {
        streamUrl = line.substring(6).trim();
        break;
      }
    }

    if (!streamUrl) {
      return res.status(404).json({ error: 'Stream URL not found' });
    }

    const result = await audioCapture.startCapture(feedId, streamUrl);
    res.json({ 
      success: true, 
      feedId, 
      feed: feed.name,
      message: 'Transcription started' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop transcription for a feed
router.post('/transcription/stop/:feedId', authenticate, (req, res) => {
  if (!audioCapture) {
    return res.json({ success: false, message: 'No active captures' });
  }

  const stopped = audioCapture.stopCapture(req.params.feedId);
  res.json({ 
    success: stopped, 
    feedId: req.params.feedId,
    message: stopped ? 'Transcription stopped' : 'Feed was not being transcribed'
  });
});

// Get active transcription captures
router.get('/transcription/active', (req, res) => {
  if (!audioCapture) {
    return res.json({ count: 0, captures: [] });
  }

  const captures = audioCapture.getActiveCaptures();
  res.json({ count: captures.length, captures });
});

// Get transcription history for a feed
router.get('/transcriptions/:feedId', (req, res) => {
  const database = req.app.locals.database;
  const limit = parseInt(req.query.limit) || 50;
  
  if (database) {
    const transcriptions = database.getRecentTranscriptions(req.params.feedId, limit);
    res.json({ count: transcriptions.length, transcriptions });
  } else {
    res.json({ count: 0, transcriptions: [] });
  }
});

// Get all recent transcriptions
router.get('/transcriptions', (req, res) => {
  const database = req.app.locals.database;
  const limit = parseInt(req.query.limit) || 100;
  
  if (database) {
    const transcriptions = database.getAllRecentTranscriptions(limit);
    res.json({ count: transcriptions.length, transcriptions });
  } else {
    res.json({ count: 0, transcriptions: [] });
  }
});

// VOX-based Recording endpoints
router.post('/recording/start/:feedId', authenticate, async (req, res) => {
  const { feedId } = req.params;
  const { splitStereo } = req.body;
  const feed = atcFeedsService.getFeedById(feedId);
  
  if (!feed) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  if (!vadRecorder) {
    const database = req.app.locals.database;
    vadRecorder = new VADRecorder(whisperClient, database, req.app.locals.eamDetector);
    
    const wss = req.app.locals.wss;
    if (wss) {
      vadRecorder.on('transcription', (data) => {
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'atc_recording',
              data
            }));
          }
        });
      });
    }
  }

  try {
    const axios = require('axios');
    const playlistUrl = `https://www.liveatc.net/play/${feed.mount}.pls`;
    const response = await axios.get(playlistUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'AirWave-Mission-Control/1.0' }
    });
    
    const lines = response.data.split('\n');
    let streamUrl = null;
    for (const line of lines) {
      if (line.trim().startsWith('File1=')) {
        streamUrl = line.substring(6).trim();
        break;
      }
    }

    if (!streamUrl) {
      return res.status(404).json({ error: 'Stream URL not found' });
    }

    const result = await vadRecorder.startRecording(feedId, streamUrl, { splitStereo });
    res.json({ 
      success: true, 
      feedId, 
      feed: feed.name,
      message: 'VOX recording started',
      splitStereo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recording/stop/:feedId', authenticate, (req, res) => {
  if (!vadRecorder) {
    return res.json({ success: false, message: 'No active recordings' });
  }

  const stopped = vadRecorder.stopRecording(req.params.feedId);
  res.json({ 
    success: stopped, 
    feedId: req.params.feedId,
    message: stopped ? 'Recording stopped' : 'Feed was not being recorded'
  });
});

router.get('/recording/active', (req, res) => {
  if (!vadRecorder) {
    return res.json({ count: 0, recordings: [] });
  }

  const recordings = vadRecorder.getActiveRecordings();
  res.json({ count: recordings.length, recordings });
});

router.get('/recordings', (req, res) => {
  const database = req.app.locals.database;
  const feedId = req.query.feedId;
  const limit = parseInt(req.query.limit) || 100;
  
  if (database) {
    const recordings = database.getRecordings(feedId, limit);
    res.json({ count: recordings.length, recordings });
  } else {
    res.json({ count: 0, recordings: [] });
  }
});

router.get('/recordings/:segmentId', (req, res) => {
  const database = req.app.locals.database;
  
  if (database) {
    const recording = database.getRecordingBySegmentId(req.params.segmentId);
    if (recording) {
      res.json(recording);
    } else {
      res.status(404).json({ error: 'Recording not found' });
    }
  } else {
    res.status(404).json({ error: 'Database not available' });
  }
});

router.get('/recordings/:segmentId/audio', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  const recording = database.getRecordingBySegmentId(req.params.segmentId);
  if (!recording) {
    return res.status(404).json({ error: 'Recording not found' });
  }

  if (!fs.existsSync(recording.filepath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Content-Disposition', `inline; filename="${recording.filename}"`);
  
  const audioStream = fs.createReadStream(recording.filepath);
  audioStream.pipe(res);
});

router.get('/recording/stats', (req, res) => {
  const database = req.app.locals.database;
  
  if (database) {
    const stats = database.getRecordingStats();
    res.json(stats);
  } else {
    res.json({ error: 'Database not available' });
  }
});

// Emergency Scanner Endpoints
router.get('/emergency/feeds', (req, res) => {
  try {
    const feeds = broadcastifyFeedsService.getAllFeeds();
    res.json({ count: feeds.length, feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/emergency/feeds/:id', (req, res) => {
  try {
    const feed = broadcastifyFeedsService.getFeedById(req.params.id);
    if (feed) {
      res.json(feed);
    } else {
      res.status(404).json({ error: 'Feed not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/emergency/states', (req, res) => {
  try {
    const states = broadcastifyFeedsService.getStates();
    res.json({ count: states.length, states });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/emergency/feeds/state/:stateCode', (req, res) => {
  try {
    const feeds = broadcastifyFeedsService.getFeedsByState(req.params.stateCode);
    res.json({ count: feeds.length, stateCode: req.params.stateCode, feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/emergency/feeds/county/:county', (req, res) => {
  try {
    const feeds = broadcastifyFeedsService.getFeedsByCounty(req.params.county);
    res.json({ count: feeds.length, county: req.params.county, feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/emergency/feeds/type/:type', (req, res) => {
  try {
    const feeds = broadcastifyFeedsService.getFeedsByType(req.params.type);
    res.json({ count: feeds.length, type: req.params.type, feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/emergency/search', (req, res) => {
  try {
    const query = req.query.q;
    const feeds = broadcastifyFeedsService.searchFeeds(query);
    res.json({ count: feeds.length, query, feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/emergency/transcription/start/:feedId', async (req, res) => {
  const { feedId } = req.params;
  const feed = broadcastifyFeedsService.getFeedById(feedId);
  
  if (!feed) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  if (!audioCapture) {
    const database = req.app.locals.database;
    audioCapture = new AudioCapture(whisperClient, database);
    
    const wss = req.app.locals.wss;
    if (wss) {
      audioCapture.on('transcription', (data) => {
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'emergency_transcription',
              data
            }));
          }
        });
      });
    }
  }

  try {
    const streamUrl = feed.streamUrl || `https://broadcastify.cdnstream1.com/${feed.feedId}`;

    const result = await audioCapture.startCapture(feedId, streamUrl);
    res.json({ 
      success: true, 
      feedId, 
      feed: feed.name,
      message: 'Emergency scanner transcription started' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/emergency/transcription/stop/:feedId', (req, res) => {
  if (!audioCapture) {
    return res.json({ success: false, message: 'No active captures' });
  }

  const stopped = audioCapture.stopCapture(req.params.feedId);
  res.json({ 
    success: stopped, 
    feedId: req.params.feedId,
    message: stopped ? 'Emergency scanner transcription stopped' : 'Feed was not being transcribed'
  });
});

router.get('/emergency/transcriptions/:feedId', (req, res) => {
  const database = req.app.locals.database;
  const limit = parseInt(req.query.limit) || 50;
  
  if (database) {
    const transcriptions = database.getRecentTranscriptions(req.params.feedId, limit);
    res.json({ count: transcriptions.length, transcriptions });
  } else {
    res.json({ count: 0, transcriptions: [] });
  }
});

router.get('/emergency/preferences', (req, res) => {
  const database = req.app.locals.database;
  
  if (database) {
    try {
      const preferences = database.getEmergencyPreferences('default');
      res.json(preferences);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.json({
      lastFeedId: null,
      volume: 0.7,
      autoPlay: false,
      favoriteFeeds: []
    });
  }
});

router.post('/emergency/preferences', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { lastFeedId, volume, autoPlay, favoriteFeeds } = req.body;
    
    if (volume !== undefined && (volume < 0 || volume > 1)) {
      return res.status(400).json({ error: 'Volume must be between 0 and 1' });
    }

    const preferences = {
      lastFeedId: lastFeedId || null,
      volume: volume !== undefined ? volume : 0.7,
      autoPlay: autoPlay !== undefined ? autoPlay : false,
      favoriteFeeds: favoriteFeeds || []
    };

    database.saveEmergencyPreferences('default', preferences);
    res.json({ success: true, preferences });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/emergency/preferences/favorites/:feedId', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    database.addEmergencyFavorite('default', req.params.feedId);
    res.json({ success: true, feedId: req.params.feedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/emergency/preferences/favorites/:feedId', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    database.removeEmergencyFavorite('default', req.params.feedId);
    res.json({ success: true, feedId: req.params.feedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// YouTube stream endpoints
const YouTubeAPIService = require('../services/youtube-api-service');

router.get('/youtube/config', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const settings = database.getSettingsByCategory('youtube');
    
    const config = {
      url: null,
      feedId: 'hfgcs_youtube',
      autoStart: false
    };

    settings.forEach(setting => {
      if (setting.key === 'stream_url') {
        config.url = setting.value;
      } else if (setting.key === 'feed_id') {
        config.feedId = setting.value;
      } else if (setting.key === 'auto_start') {
        config.autoStart = setting.value === 'true' || setting.value === true;
      }
    });

    res.json({ success: true, config });
  } catch (error) {
    console.error('Error getting YouTube config:', error);
    res.status(500).json({ error: 'Failed to get YouTube configuration' });
  }
});

router.get('/youtube/live-streams', async (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    if (!youtubeAPIService) {
      youtubeAPIService = new YouTubeAPIService(database);
      await youtubeAPIService.initialize();
    }

    if (!youtubeAPIService.isConfigured()) {
      return res.status(503).json({ 
        success: false, 
        error: 'YouTube API not configured',
        message: 'Please configure YouTube API key in Admin Settings'
      });
    }

    let channelHandle = req.query.channelHandle;
    
    if (!channelHandle) {
      const setting = database.getSetting('channel_handle');
      channelHandle = setting ? setting.value : null;
    }
    
    if (!channelHandle) {
      return res.status(400).json({ 
        success: false,
        error: 'Channel handle not configured',
        message: 'Please configure channel_handle in Admin Settings or provide channelHandle query parameter'
      });
    }

    const streams = await youtubeAPIService.getLiveStreamsForHandle(channelHandle);

    res.json({
      success: true,
      streams,
      channelHandle,
      cached: streams.length > 0
    });
  } catch (error) {
    console.error('Error fetching live streams:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      streams: []
    });
  }
});

router.get('/youtube/channel-info', async (req, res) => {
  const database = req.app.locals.database;
  const { handle } = req.query;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  if (!handle) {
    return res.status(400).json({ error: 'Channel handle is required' });
  }

  try {
    if (!youtubeAPIService) {
      youtubeAPIService = new YouTubeAPIService(database);
      await youtubeAPIService.initialize();
    }

    if (!youtubeAPIService.isConfigured()) {
      return res.status(503).json({ 
        success: false,
        error: 'YouTube API not configured'
      });
    }

    const channelInfo = await youtubeAPIService.getChannelInfo(handle);

    res.json({
      success: true,
      ...channelInfo
    });
  } catch (error) {
    console.error('Error getting channel info:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

router.post('/youtube/test-api-key', async (req, res) => {
  const { apiKey } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  try {
    const valid = await YouTubeAPIService.testApiKey(apiKey);
    
    res.json({
      success: true,
      valid
    });
  } catch (error) {
    console.error('Error testing API key:', error);
    res.json({
      success: true,
      valid: false
    });
  }
});

router.post('/youtube/config', (req, res) => {
  const database = req.app.locals.database;
  const { url, feedId, autoStart } = req.body;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    if (url) {
      database.setSetting('stream_url', url, 'youtube');
    }
    if (feedId) {
      database.setSetting('feed_id', feedId, 'youtube');
    }
    if (autoStart !== undefined) {
      database.setSetting('auto_start', String(autoStart), 'youtube');
    }

    res.json({ success: true, message: 'YouTube configuration saved' });
  } catch (error) {
    console.error('Error saving YouTube config:', error);
    res.status(500).json({ error: 'Failed to save YouTube configuration' });
  }
});

router.post('/youtube/start', authenticate, async (req, res) => {
  const database = req.app.locals.database;
  const { url, feedId, useVOX } = req.body;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  if (!url) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  const streamFeedId = feedId || 'hfgcs_youtube';
  const voxMode = useVOX !== undefined ? useVOX : true;

  try {
    if (!youtubeStreamService) {
      const eamDetector = req.app.locals.eamDetector;
      const eamPreprocessor = req.app.locals.eamPreprocessor;
      const eamAggregator = req.app.locals.eamAggregator;
      
      youtubeStreamService = new YouTubeStreamService(whisperClient, database, eamDetector, eamPreprocessor, eamAggregator);
      
      const wss = req.app.locals.wss;
      if (wss) {
        youtubeStreamService.on('transcription', (data) => {
          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              client.send(JSON.stringify({
                type: 'atc_recording',
                data
              }));
            }
          });
        });

        youtubeStreamService.on('stream_failed', (data) => {
          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              client.send(JSON.stringify({
                type: 'youtube_stream_error',
                data
              }));
            }
          });
        });
      }
    }

    const result = await youtubeStreamService.startStream(url, streamFeedId, { useVOX: voxMode });
    
    res.json({
      success: true,
      feedId: streamFeedId,
      url,
      useVOX: voxMode,
      message: 'YouTube stream monitoring started'
    });
  } catch (error) {
    console.error('Error starting YouTube stream:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/youtube/stop/:feedId', authenticate, (req, res) => {
  const { feedId } = req.params;

  if (!youtubeStreamService) {
    return res.json({ success: false, message: 'No active YouTube streams' });
  }

  try {
    const stopped = youtubeStreamService.stopStream(feedId);
    res.json({
      success: stopped,
      feedId,
      message: stopped ? 'YouTube stream stopped' : 'Stream was not active'
    });
  } catch (error) {
    console.error('Error stopping YouTube stream:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/youtube/status', (req, res) => {
  if (!youtubeStreamService) {
    return res.json({ count: 0, streams: [] });
  }

  try {
    const streams = youtubeStreamService.getActiveStreams();
    res.json({ count: streams.length, streams });
  } catch (error) {
    console.error('Error getting YouTube status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Video Generation Endpoints
router.post('/aircraft/:id/generate-video', async (req, res) => {
  const database = req.app.locals.database;
  const videoRenderer = req.app.locals.videoRenderer;
  const photoDownloader = req.app.locals.photoDownloader;
  const photoService = req.app.locals.photoService;
  const { id } = req.params;
  const options = req.body || {};

  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  if (!videoRenderer) {
    return res.status(503).json({ error: 'Video renderer not available' });
  }

  try {
    const aircraft = database.getAircraftByIdentifier(id);
    if (!aircraft) {
      return res.status(404).json({ error: 'Aircraft not found' });
    }

    const trackPoints = aircraft.track_points || [];
    if (trackPoints.length < 2) {
      return res.status(400).json({ 
        error: 'Insufficient track data',
        details: `Only ${trackPoints.length} position(s) available. Minimum 2 required for video generation.`
      });
    }

    // Ensure photos are available for video generation
    console.log(`📸 Checking photos for ${id}...`);
    let localPhotos = database.getLocalPhotosForAircraft(id);
    
    if (localPhotos.length === 0 && photoService && photoDownloader) {
      try {
        console.log(`   Fetching photos from JetAPI...`);
        await photoService.fetchPhotosForAircraft(id);
        
        console.log(`   Downloading photos locally...`);
        await photoDownloader.downloadPhotosForAircraft(id);
        
        localPhotos = database.getLocalPhotosForAircraft(id);
        console.log(`   ✅ ${localPhotos.length} photos ready for video`);
      } catch (photoError) {
        console.log(`   ⚠️  Could not fetch photos: ${photoError.message}`);
        // Continue without photos - video will still work
      }
    } else {
      console.log(`   ✅ ${localPhotos.length} local photos already available`);
    }

    const result = await videoRenderer.generateAircraftVideo(id, options);
    
    res.json(result);
  } catch (error) {
    const errorId = generateErrorId();
    logger.error('Error generating video:', { errorId, error: error.message, stack: error.stack, aircraftId: id });
    res.status(500).json({ 
      error: 'Failed to generate video',
      errorId: errorId,
      message: 'An internal error occurred. Please contact support with error ID.',
      details: error.message
    });
  }
});

router.get('/aircraft/:id/video-status', (req, res) => {
  const videoRenderer = req.app.locals.videoRenderer;
  const { id } = req.params;

  if (!videoRenderer) {
    return res.status(503).json({ error: 'Video renderer not available' });
  }

  try {
    const video = videoRenderer.getVideoForAircraft(id);
    
    if (video) {
      res.json({
        success: true,
        exists: true,
        video
      });
    } else {
      res.status(404).json({
        success: false,
        exists: false,
        message: 'No video found for this aircraft'
      });
    }
  } catch (error) {
    console.error('Error checking video status:', error);
    res.status(500).json({ error: 'Failed to check video status' });
  }
});

router.get('/video/renderer-status', (req, res) => {
  const videoRenderer = req.app.locals.videoRenderer;

  if (!videoRenderer) {
    return res.status(503).json({ error: 'Video renderer not available' });
  }

  try {
    const status = videoRenderer.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    console.error('Error getting renderer status:', error);
    res.status(500).json({ error: 'Failed to get renderer status' });
  }
});

router.get('/aircraft/:id/download-video', (req, res) => {
  const videoRenderer = req.app.locals.videoRenderer;
  const { id } = req.params;

  if (!videoRenderer) {
    return res.status(503).json({ error: 'Video renderer not available' });
  }

  try {
    const video = videoRenderer.getVideoForAircraft(id);
    
    if (!video || !video.path) {
      return res.status(404).json({ error: 'No video found for this aircraft' });
    }

    if (!fs.existsSync(video.path)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const filename = `${id}_flight_track.mp4`;
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', video.size);

    const fileStream = fs.createReadStream(video.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: 'Failed to download video' });
  }
});

// Twitter Integration Endpoints
router.post('/aircraft/:id/post-to-twitter', async (req, res) => {
  const database = req.app.locals.database;
  const videoRenderer = req.app.locals.videoRenderer;
  const twitterClient = req.app.locals.twitterClient;
  const { id } = req.params;
  const { customText, generateVideoIfMissing } = req.body;

  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  if (!twitterClient) {
    return res.status(503).json({ error: 'Twitter client not available' });
  }

  if (!twitterClient.isEnabled()) {
    return res.status(503).json({ 
      error: 'Twitter API not configured',
      details: 'Please configure Twitter API credentials in .env file'
    });
  }

  try {
    let video = videoRenderer.getVideoForAircraft(id);
    
    if (!video && generateVideoIfMissing !== false) {
      console.log('📹 Video not found, generating...');
      const videoResult = await videoRenderer.generateAircraftVideo(id);
      video = {
        path: videoResult.videoPath,
        ...videoResult
      };
    }

    if (!video || !video.path) {
      return res.status(404).json({ 
        error: 'No video available for this aircraft',
        details: 'Generate a video first or set generateVideoIfMissing to true'
      });
    }

    if (!fs.existsSync(video.path)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const aircraft = database.getAircraftByIdentifier(id);
    const metadata = {
      aircraftData: {
        flight: aircraft.flight || id,
        tail: aircraft.tail || 'N/A',
        type: aircraft.aircraft_type || 'Unknown',
        trackPointCount: (aircraft.track_points || []).length,
        duration: video.duration,
      }
    };

    const result = await twitterClient.postAircraftVideo(
      id,
      video.path,
      metadata,
      customText
    );

    res.json(result);
  } catch (error) {
    const errorId = generateErrorId();
    logger.error('Error posting to Twitter:', { errorId, error: error.message, stack: error.stack, aircraftId: id });
    res.status(500).json({ 
      error: 'Failed to post to Twitter',
      errorId: errorId,
      message: 'An internal error occurred. Please contact support with error ID.'
    });
  }
});

router.get('/twitter/test-connection', async (req, res) => {
  const twitterClient = req.app.locals.twitterClient;

  if (!twitterClient) {
    return res.status(503).json({ error: 'Twitter client not available' });
  }

  try {
    const result = await twitterClient.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Error testing Twitter connection:', error);
    res.status(500).json({ 
      error: 'Failed to test connection',
      details: error.message
    });
  }
});

router.get('/twitter/rate-limit', async (req, res) => {
  const twitterClient = req.app.locals.twitterClient;

  if (!twitterClient) {
    return res.status(503).json({ error: 'Twitter client not available' });
  }

  if (!twitterClient.isEnabled()) {
    return res.status(503).json({ error: 'Twitter API not configured' });
  }

  try {
    const status = await twitterClient.getRateLimitStatus();
    res.json({ success: true, limits: status });
  } catch (error) {
    console.error('Error getting rate limit:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TRAJECTORY PREDICTION ENDPOINTS
// ============================================

// Get predicted trajectory for specific aircraft
router.get('/aircraft/:id/trajectory', (req, res) => {
  const aircraftTracker = req.app.locals.aircraftTracker;
  const { id } = req.params;
  
  if (!aircraftTracker) {
    return res.status(503).json({ error: 'Aircraft tracker not available' });
  }

  try {
    const track = aircraftTracker.getTrack(id);
    
    if (!track) {
      return res.status(404).json({ 
        success: false, 
        error: 'Aircraft not found',
        aircraft_id: id 
      });
    }

    res.json({
      success: true,
      aircraft_id: id,
      callsign: track.flight || track.tail || track.hex,
      predicted_path: track.predicted_path || [],
      prediction_generated_at: track.prediction_generated_at || null,
      prediction_confidence: track.prediction_confidence || 0
    });
  } catch (error) {
    console.error('Error fetching trajectory:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch trajectory' 
    });
  }
});

// Get all active aircraft with predictions
router.get('/trajectories', (req, res) => {
  const aircraftTracker = req.app.locals.aircraftTracker;
  
  if (!aircraftTracker) {
    return res.status(503).json({ error: 'Aircraft tracker not available' });
  }

  try {
    const aircraft = aircraftTracker.getActiveAircraft();
    
    // Filter for aircraft with predictions
    const withPredictions = aircraft.filter(ac => 
      ac.predicted_path && ac.predicted_path.length > 0
    );

    res.json({
      success: true,
      count: withPredictions.length,
      aircraft: withPredictions.map(ac => ({
        id: ac.id,
        callsign: ac.flight || ac.tail || ac.hex,
        aircraft_type: ac.aircraft_type,
        current_position: ac.current_position,
        predicted_path: ac.predicted_path,
        prediction_confidence: ac.prediction_confidence
      }))
    });
  } catch (error) {
    console.error('Error fetching trajectories:', error);
    res.status(500).json({ error: 'Failed to fetch trajectories' });
  }
});

// ============================================
// CONFLICT DETECTION ENDPOINTS
// ============================================

// Get all active conflicts
router.get('/conflicts', (req, res) => {
  const conflictDetector = req.app.locals.conflictDetector;
  
  if (!conflictDetector) {
    return res.status(503).json({ error: 'Conflict detector not available' });
  }

  try {
    const conflicts = conflictDetector.getActiveConflicts();

    res.json({
      success: true,
      count: conflicts.length,
      conflicts: conflicts
    });
  } catch (error) {
    console.error('Error fetching conflicts:', error);
    res.status(500).json({ error: 'Failed to fetch conflicts' });
  }
});

// Get conflict history
router.get('/conflicts/history', (req, res) => {
  const conflictDetector = req.app.locals.conflictDetector;
  const startTime = req.query.start;
  const endTime = req.query.end;
  const limit = parseInt(req.query.limit) || 100;
  
  if (!conflictDetector) {
    return res.status(503).json({ error: 'Conflict detector not available' });
  }

  try {
    const history = conflictDetector.getConflictHistory(startTime, endTime, limit);

    res.json({
      success: true,
      count: history.length,
      conflicts: history
    });
  } catch (error) {
    console.error('Error fetching conflict history:', error);
    res.status(500).json({ error: 'Failed to fetch conflict history' });
  }
});

// Get specific conflict by ID
router.get('/conflicts/:id', (req, res) => {
  const conflictDetector = req.app.locals.conflictDetector;
  const { id } = req.params;
  
  if (!conflictDetector) {
    return res.status(503).json({ error: 'Conflict detector not available' });
  }

  try {
    const conflict = conflictDetector.getConflictById(id);
    
    if (!conflict) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conflict not found',
        conflict_id: id 
      });
    }

    res.json({
      success: true,
      conflict: conflict
    });
  } catch (error) {
    console.error('Error fetching conflict:', error);
    res.status(500).json({ error: 'Failed to fetch conflict' });
  }
});

// ============================================
// PREDICTION CONFIGURATION ENDPOINTS
// ============================================

// Update prediction configuration
router.post('/prediction/config', (req, res) => {
  const configManager = req.app.locals.configManager;
  const { horizon_minutes, enabled } = req.body;
  
  if (!configManager) {
    return res.status(503).json({ error: 'Config manager not available' });
  }

  try {
    if (horizon_minutes !== undefined) {
      configManager.setSetting('prediction', 'horizon_minutes', horizon_minutes.toString());
    }
    if (enabled !== undefined) {
      configManager.setSetting('prediction', 'enabled', enabled.toString());
    }

    res.json({
      success: true,
      message: 'Prediction configuration updated',
      config: {
        horizon_minutes: horizon_minutes || 10,
        enabled: enabled !== undefined ? enabled : true
      }
    });
  } catch (error) {
    console.error('Error updating prediction config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Get prediction configuration
router.get('/prediction/config', (req, res) => {
  const configManager = req.app.locals.configManager;
  
  if (!configManager) {
    return res.status(503).json({ error: 'Config manager not available' });
  }

  try {
    const horizonSetting = configManager.getSetting('prediction', 'horizon_minutes');
    const enabledSetting = configManager.getSetting('prediction', 'enabled');

    res.json({
      success: true,
      config: {
        horizon_minutes: horizonSetting ? parseInt(horizonSetting) : 10,
        enabled: enabledSetting ? enabledSetting === 'true' : true
      }
    });
  } catch (error) {
    console.error('Error fetching prediction config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

module.exports = router;
