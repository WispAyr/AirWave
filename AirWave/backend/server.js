require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const WebSocket = require('ws');
const http = require('http');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

const AirframesClient = require('./services/airframes-client');
const Tar1090Client = require('./services/tar1090-client');
const DataSourceManager = require('./services/data-source-manager');
const OpenSkySource = require('./sources/opensky-source');
const AirframesSource = require('./sources/airframes-source');
const ADSBExchangeSource = require('./sources/adsbexchange-source');
const EAMWatchSource = require('./sources/eam-watch');
const MessageProcessor = require('./services/message-processor');
const VideoRenderer = require('./services/video-renderer');
const TwitterClient = require('./services/twitter-client');
const routes = require('./routes');

// Service initializers
const initializeCoreServices = require('./services/initializers/core-services');
const { initializeTrackingServices, cleanupTrackingServices } = require('./services/initializers/tracking-services');

// Centralized configuration
const config = require('./config');

// Error handling middleware
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// CORS Configuration - restrict origins in production
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const allowedOrigins = allowedOriginsEnv 
  ? allowedOriginsEnv.split(',')
  : ['http://localhost:8501', 'http://localhost:3000'];

const corsOptions = process.env.NODE_ENV === 'production' ? {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
} : {
  origin: true, // Permissive in development
  credentials: false,
};

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Stricter limit for admin routes
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many admin requests, please try again later.',
});

const transcriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Limit transcription operations
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/admin/', adminLimiter);
app.use('/api/transcription/', transcriptionLimiter);
app.use('/api/recording/', transcriptionLimiter);

// Service variables (will be initialized async)
let database;
let validator;
let configManager;
let aircraftTracker;
let hfgcsTracker;
let eamDetector;
let hexToRegService;
let trajectoryPredictor;
let conflictDetector;
let messageProcessor;
let airframesClient;
let tar1090Client;
let dataSourceManager;

// Photo and video services (will be initialized after core services)
let videoRenderer;
let photoService;
let photoDownloader;

// Initialize Twitter client (will gracefully handle missing credentials)
let twitterClient = null;
try {
  twitterClient = new TwitterClient();
} catch (error) {
  console.warn('⚠️  Twitter client initialization skipped:', error.message);
}

// Initialize YouTube API service (will be initialized after database is ready)
const YouTubeAPIService = require('./services/youtube-api-service');
let youtubeAPIService = null;

// Make wss available immediately
app.locals.wss = wss;
// Other services will be added after initialization
// Routes will be mounted after services are initialized

// WebSocket connection handling with auth and heartbeat
const clients = new Set();

wss.on('connection', (ws, req) => {
  // Origin validation in production
  if (process.env.NODE_ENV === 'production') {
    const origin = req.headers.origin;
    if (!allowedOrigins.includes(origin)) {
      logger.warn(`WebSocket blocked origin: ${origin}`);
      ws.close(1008, 'Origin not allowed');
      return;
    }
  }

  // Optional token validation (query param ?token=...)
  // For now we'll log it but not enforce to maintain compatibility
  const url = new URL(req.url, `ws://${req.headers.host}`);
  const token = url.searchParams.get('token');
  if (token) {
    logger.debug('WebSocket connection with token');
  }

  logger.info('📡 Client connected to WebSocket');
  ws.isAlive = true;
  clients.add(ws);

  // Heartbeat - respond to pings
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    logger.info('📴 Client disconnected from WebSocket');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', { error: error.message });
    clients.delete(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to Airwave Mission Control',
    timestamp: new Date().toISOString()
  }));
});

// Heartbeat interval - ping clients every 30 seconds
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      logger.info('Terminating unresponsive WebSocket client');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Broadcast messages to all connected clients with backpressure handling and throttling
let messageQueue = [];
let lastBroadcast = Date.now();
const BROADCAST_INTERVAL = 500; // Batch messages every 500ms

// Event listeners will be set up after services are initialized
function setupEventListeners() {
  messageProcessor.on('message', (data) => {
    // Add to queue instead of sending immediately
    messageQueue.push(data);
    
    // Debug: Log ADS-B messages
    if (data.source_type === 'adsb' && messageQueue.length % 100 === 0) {
      console.log(`📊 Message queue size: ${messageQueue.length} (${data.source_type})`);
    }
  });

  // Broadcast HFGCS aircraft events
  hfgcsTracker.on('hfgcs_aircraft_detected', (aircraft) => {
    const payload = JSON.stringify({ 
      type: 'hfgcs_aircraft', 
      event: 'detected', 
      data: aircraft,
      timestamp: new Date().toISOString()
    });
    clients.forEach(client => { 
      if (client.readyState === WebSocket.OPEN) client.send(payload); 
    });
  });

  hfgcsTracker.on('hfgcs_aircraft_updated', (aircraft) => {
    const payload = JSON.stringify({ 
      type: 'hfgcs_aircraft', 
      event: 'updated', 
      data: aircraft,
      timestamp: new Date().toISOString()
    });
    clients.forEach(client => { 
      if (client.readyState === WebSocket.OPEN) client.send(payload); 
    });
  });

  hfgcsTracker.on('hfgcs_aircraft_lost', (aircraft) => {
    const payload = JSON.stringify({ 
      type: 'hfgcs_aircraft', 
      event: 'lost', 
      data: aircraft,
      timestamp: new Date().toISOString()
    });
    clients.forEach(client => { 
      if (client.readyState === WebSocket.OPEN) client.send(payload); 
    });
  });

  // Broadcast EAM detection events
  eamDetector.on('eam_detected', (eam) => {
    const payload = JSON.stringify({ 
      type: 'eam_detected', 
      data: eam,
      timestamp: new Date().toISOString()
    });
    clients.forEach(client => { 
      if (client.readyState === WebSocket.OPEN) client.send(payload); 
    });
  });

  eamDetector.on('skyking_detected', (skyking) => {
    const payload = JSON.stringify({ 
      type: 'skyking_detected', 
      data: skyking,
      timestamp: new Date().toISOString()
    });
    clients.forEach(client => { 
      if (client.readyState === WebSocket.OPEN) client.send(payload); 
    });
  });

  eamDetector.on('eam_repeat_detected', (repeat) => {
    const payload = JSON.stringify({ 
      type: 'eam_repeat_detected', 
      data: repeat,
      timestamp: new Date().toISOString()
    });
    clients.forEach(client => { 
      if (client.readyState === WebSocket.OPEN) client.send(payload); 
    });
  });

  // Broadcast conflict detection events
  conflictDetector.on('conflict_detected', (conflict) => {
    const payload = JSON.stringify({ 
      type: 'conflict_detected', 
      data: conflict,
      timestamp: new Date().toISOString()
    });
    broadcastToClients(payload);
  });

  conflictDetector.on('conflict_resolved', (conflict) => {
    const payload = JSON.stringify({ 
      type: 'conflict_resolved', 
      data: conflict,
      timestamp: new Date().toISOString()
    });
    broadcastToClients(payload);
  });

  conflictDetector.on('conflict_updated', (conflict) => {
    const payload = JSON.stringify({ 
      type: 'conflict_updated', 
      data: conflict,
      timestamp: new Date().toISOString()
    });
    broadcastToClients(payload);
  });
}

// Broadcast batched messages at intervals
setInterval(() => {
  if (messageQueue.length === 0) return;
  
  const now = Date.now();
  if (now - lastBroadcast < BROADCAST_INTERVAL) return;
  
  // Take up to 100 messages per batch to clear queue faster
  const batch = messageQueue.splice(0, 100);
  lastBroadcast = now;
  
  // Group by message type
  const adsbMessages = batch.filter(d => d.source_type === 'adsb');
  const acarsMessages = batch.filter(d => d.source_type !== 'adsb');
  
  // Send ADS-B as batch
  if (adsbMessages.length > 0) {
    const payload = JSON.stringify({
      type: 'adsb_batch',
      count: adsbMessages.length,
      data: adsbMessages,
      timestamp: new Date().toISOString()
    });
    
    console.log(`📡 Broadcasting ${adsbMessages.length} ADS-B messages to ${clients.size} clients`);
    broadcastToClients(payload);
  }
  
  // Send ACARS individually
  acarsMessages.forEach(data => {
    const payload = JSON.stringify({
      type: 'acars',
      data,
      timestamp: new Date().toISOString()
    });
    broadcastToClients(payload);
  });
  
  // Log if queue is getting backed up
  if (messageQueue.length > 100) {
    logger.warn(`Message queue backed up: ${messageQueue.length} messages pending`);
  }
}, 500); // Check every 500ms

function broadcastToClients(payload) {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // Check backpressure - skip if buffer is too full
      if (client.bufferedAmount > 100000) { // 100KB threshold
        logger.warn('WebSocket client buffer full, skipping message');
        return;
      }
      try {
        client.send(payload);
      } catch (error) {
        logger.error('Error sending WebSocket message:', { error: error.message });
      }
    }
  });
}

// Make rate limiters available to routes
app.locals.apiLimiter = apiLimiter;
app.locals.adminLimiter = adminLimiter;
app.locals.transcriptionLimiter = transcriptionLimiter;

// Error handlers will be mounted after routes are registered

// Start server after async initialization
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    // Initialize core services (database, validator, config manager)
    console.log('🔧 Initializing core services...');
    const coreServices = await initializeCoreServices();
    database = coreServices.database;
    validator = coreServices.validator;
    configManager = coreServices.configManager;
    
    // Set config manager in centralized config module
    config.setConfigManager(configManager);
    console.log('✅ Centralized configuration module initialized');
    
    // Initialize tracking services (aircraft tracker, HFGCS tracker, EAM detector, hex lookup)
    console.log('🛡️  Initializing tracking services...');
    const trackingServices = initializeTrackingServices(database);
    aircraftTracker = trackingServices.aircraftTracker;
    hfgcsTracker = trackingServices.hfgcsTracker;
    eamDetector = trackingServices.eamDetector;
    const eamPreprocessor = trackingServices.eamPreprocessor;
    const eamAggregator = trackingServices.eamAggregator;
    hexToRegService = trackingServices.hexToRegService;
    trajectoryPredictor = trackingServices.trajectoryPredictor;
    conflictDetector = trackingServices.conflictDetector;
    
    // Initialize message processor with all dependencies
    messageProcessor = new MessageProcessor(validator, database, hfgcsTracker, aircraftTracker);
    console.log('✅ Message processor initialized');
    
    // Initialize Airframes client
    airframesClient = new AirframesClient(messageProcessor);
    
    // Initialize TAR1090 client with aircraft tracker
    tar1090Client = new Tar1090Client(messageProcessor, aircraftTracker);
    
    // Load TAR1090 settings and connect if enabled (auto-start)
    const tar1090Config = configManager.getTar1090Config();
    if (tar1090Config.enabled && tar1090Config.url) {
      console.log('🛰️  TAR1090 auto-start enabled, connecting...');
      tar1090Client.connect(tar1090Config.url, tar1090Config.poll_interval);
    } else {
      console.log('🛰️  TAR1090 auto-start disabled');
    }

    // Check YouTube/HFGCS auto-start settings
    const youtubeSettings = database.getSettingsByCategory('youtube');
    let shouldAutoStartYouTube = false;
    let youtubeUrl = null;
    let youtubeFeedId = 'hfgcs_youtube';
    let youtubeUseVOX = true;

    youtubeSettings.forEach(setting => {
      if (setting.key === 'auto_start') {
        shouldAutoStartYouTube = setting.value === 'true' || setting.value === true;
      } else if (setting.key === 'stream_url') {
        youtubeUrl = setting.value;
      } else if (setting.key === 'feed_id') {
        youtubeFeedId = setting.value;
      } else if (setting.key === 'use_vox') {
        youtubeUseVOX = setting.value === 'true' || setting.value === true;
      }
    });

    if (shouldAutoStartYouTube && youtubeUrl) {
      console.log('🎥 HFGCS YouTube auto-start enabled, starting stream...');
      
      // Initialize YouTube stream service
      const YouTubeStreamService = require('./services/youtube-stream-service');
      const WhisperClient = require('./services/whisper-client');
      const whisperClient = new WhisperClient();
      const youtubeStreamService = new YouTubeStreamService(whisperClient, database, eamDetector, eamPreprocessor, eamAggregator);
      
      // Forward transcription events to WebSocket
      youtubeStreamService.on('transcription', (data) => {
        const payload = JSON.stringify({ 
          type: 'transcription', 
          data,
          timestamp: new Date().toISOString()
        });
        wss.clients.forEach(client => { 
          if (client.readyState === 1) client.send(payload); 
        });
      });

      // Start the stream
      youtubeStreamService.startStream(youtubeUrl, youtubeFeedId, { useVOX: youtubeUseVOX })
        .then(result => {
          console.log(`✅ HFGCS YouTube stream auto-started: ${youtubeFeedId} (VOX: ${youtubeUseVOX})`);
          app.locals.youtubeStreamService = youtubeStreamService;
        })
        .catch(error => {
          console.error('❌ Failed to auto-start HFGCS YouTube stream:', error.message);
        });
    } else {
      console.log('🎥 HFGCS YouTube auto-start disabled');
    }

    // Initialize video and photo services
    videoRenderer = new VideoRenderer(database);
    console.log('🎥 Video renderer initialized');
    
    const AircraftPhotoService = require('./services/aircraft-photo-service');
    const PhotoDownloader = require('./services/photo-downloader');
    
    photoService = new AircraftPhotoService(database, hexToRegService);
    console.log('📸 Aircraft photo service initialized');
    photoService.startBackgroundPrefetch(30 * 60 * 1000);
    
    photoDownloader = new PhotoDownloader(database);
    console.log('📥 Photo downloader initialized');
    photoDownloader.startBackgroundDownload(15 * 60 * 1000);

    // Initialize modular data source manager with configs
    dataSourceManager = new DataSourceManager(messageProcessor);
    dataSourceManager.registerSource('opensky', new OpenSkySource());
    dataSourceManager.registerSource('airframes', new AirframesSource());

    // Initialize ADS-B Exchange with API key from config
    const adsbexchangeConfig = configManager.getADSBExchangeConfig();
    dataSourceManager.registerSource('adsbexchange', new ADSBExchangeSource(adsbexchangeConfig));

    // Initialize EAM.watch source with API token
    const eamWatchConfig = {
      api_token: process.env.EAM_WATCH_API_TOKEN,
      base_url: process.env.EAM_WATCH_BASE_URL || 'https://api.eam.watch',
      poll_interval: 60000 // 60 seconds
    };
    dataSourceManager.registerSource('eam_watch', new EAMWatchSource(eamWatchConfig));

    // Start modular data sources (based on config)
    dataSourceManager.startEnabled();
    console.log('📡 Data sources started');

    // Initialize YouTube API service now that database is ready
    youtubeAPIService = new YouTubeAPIService(database);
    youtubeAPIService.initialize().then(() => {
      if (youtubeAPIService.isConfigured()) {
        console.log('✅ YouTube API service initialized and configured');
      } else {
        console.log('⚠️  YouTube API service initialized but not configured - stream auto-discovery disabled');
      }
    }).catch((error) => {
      console.error('❌ Error initializing YouTube API service:', error.message);
    });

    // Setup event listeners now that all services are initialized
    setupEventListeners();
    console.log('✅ Event listeners configured');

    // Mount routes now that services are ready
    app.use('/api', routes);
    console.log('✅ API routes mounted');

    // Health check endpoint (must be before error handlers)
    app.get('/health', (req, res) => {
      const sourceStatus = dataSourceManager ? dataSourceManager.getStatus() : {};
      const enabledSources = Object.entries(sourceStatus)
        .filter(([_, src]) => src.enabled)
        .map(([name, src]) => ({ name, connected: src.stats.connected }));

      res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        tar1090: tar1090Client ? tar1090Client.isConnected() : false,
        airframes: sourceStatus.airframes?.stats?.connected || false,
        adsbexchange: sourceStatus.adsbexchange?.stats?.connected || false,
        opensky: sourceStatus.opensky?.stats?.connected || false,
        enabledSources
      });
    });
    console.log('✅ Health endpoint mounted');

    // Mount error handling middleware (must be AFTER all routes)
    app.use(notFoundHandler);  // 404 handler for unmatched routes
    app.use(errorHandler);     // Centralized error handler
    console.log('✅ Error handlers mounted');

    // Update app.locals now that all services are initialized
    app.locals.database = database;
    app.locals.tar1090Client = tar1090Client;
    app.locals.aircraftTracker = aircraftTracker;
    app.locals.hfgcsTracker = hfgcsTracker;
    app.locals.eamDetector = eamDetector;
    app.locals.eamPreprocessor = eamPreprocessor;
    app.locals.eamAggregator = eamAggregator;
    app.locals.configManager = configManager;
    app.locals.dataSourceManager = dataSourceManager;
    app.locals.videoRenderer = videoRenderer;
    app.locals.twitterClient = twitterClient;
    app.locals.photoService = photoService;
    app.locals.hexToRegService = hexToRegService;
    app.locals.photoDownloader = photoDownloader;
    app.locals.youtubeAPIService = youtubeAPIService;
    app.locals.trajectoryPredictor = trajectoryPredictor;
    app.locals.conflictDetector = conflictDetector;

    // Start HTTP server
    server.listen(PORT, () => {
      logger.info('='.repeat(50));
      logger.info('🚀 AIRWAVE MISSION CONTROL BACKEND 🚀');
      logger.info('='.repeat(50));
      logger.info(`HTTP Server:    http://localhost:${PORT}`);
      logger.info(`WebSocket:      ws://localhost:${PORT}/ws`);
      logger.info(`Environment:    ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Log Level:      ${process.env.LOG_LEVEL || 'info'}`);
      logger.info(`Status:         OPERATIONAL`);
      logger.info('='.repeat(50));
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  logger.info(`🛑 ${signal} received, shutting down gracefully...`);
  
  // Stop heartbeat interval
  clearInterval(heartbeatInterval);
  
  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    client.close(1000, 'Server shutting down');
  });
  
  // Stop background services
  if (airframesClient) airframesClient.disconnect();
  if (tar1090Client) tar1090Client.disconnect();
  if (photoService) photoService.stopBackgroundPrefetch();
  if (photoDownloader) photoDownloader.stopBackgroundDownload();
  
  // Stop data sources
  if (dataSourceManager) {
    dataSourceManager.sources.forEach(source => {
      if (source.disconnect) source.disconnect();
    });
  }
  
  // Cleanup tracking services
  if (aircraftTracker && hfgcsTracker && hexToRegService) {
    cleanupTrackingServices({ aircraftTracker, hfgcsTracker, eamDetector, hexToRegService, conflictDetector });
  }
  
  // Additional cleanup for conflict detector
  if (conflictDetector) {
    conflictDetector.stopMonitoring();
  }
  
  // Close HTTP server
  server.close(() => {
    logger.info('✅ HTTP server closed');
    
    // Close database connection
    database.close();
    logger.info('✅ Database closed');
    
    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('⚠️  Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 10000);
};

// Handle both SIGTERM and SIGINT
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

