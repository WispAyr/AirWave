const AircraftTracker = require('../aircraft-tracker');
const HFGCSAircraftTracker = require('../hfgcs-aircraft-tracker');
const EAMDetector = require('../eam-detector');
const EAMPreprocessor = require('../eam-preprocessor');
const EAMSegmentAggregator = require('../eam-segment-aggregator');
const HexToRegService = require('../hex-to-reg-service');
const TrajectoryPredictor = require('../trajectory-predictor');
const ConflictDetector = require('../conflict-detector');

/**
 * Initialize tracking services (aircraft tracker, HFGCS tracker, EAM detector, hex lookup)
 * @param {Object} database - Database instance
 * @returns {Object} Tracking services object
 */
function initializeTrackingServices(database) {
  console.log('🛡️  Initializing tracking services...');
  
  // Initialize trajectory predictor (no dependencies)
  const trajectoryPredictor = new TrajectoryPredictor();
  console.log('✅ Trajectory predictor initialized');
  
  // Initialize aircraft tracker for ADS-B position history
  const aircraftTracker = new AircraftTracker(database, trajectoryPredictor);
  aircraftTracker.startCleanup(); // Start periodic cleanup of stale tracks
  console.log('✅ Aircraft tracker initialized');
  
  // Initialize HFGCS aircraft tracker
  const hfgcsTracker = new HFGCSAircraftTracker(database, aircraftTracker);
  hfgcsTracker.startCleanup();
  console.log('✅ HFGCS aircraft tracker initialized');
  
  // Initialize EAM services
  const eamPreprocessor = new EAMPreprocessor();
  console.log('✅ EAM Preprocessor initialized');
  
  const eamAggregator = new EAMSegmentAggregator(database);
  console.log('✅ EAM Segment Aggregator initialized');
  
  const eamDetector = new EAMDetector(database, eamPreprocessor, eamAggregator);
  console.log('✅ EAM Detector initialized with multi-segment support');
  
  // Initialize hex-to-registration lookup service
  const hexToRegService = new HexToRegService(database);
  hexToRegService.startBackgroundLookup(10 * 60 * 1000); // Every 10 minutes
  console.log('✅ Hex-to-registration service initialized');
  
  // Initialize conflict detector
  const conflictDetector = new ConflictDetector(aircraftTracker, trajectoryPredictor);
  conflictDetector.startMonitoring(30000); // Check every 30 seconds
  console.log('✅ Conflict detector initialized');
  
  return { 
    aircraftTracker, 
    hfgcsTracker, 
    eamDetector, 
    eamPreprocessor, 
    eamAggregator, 
    hexToRegService,
    trajectoryPredictor,
    conflictDetector
  };
}

/**
 * Cleanup tracking services on shutdown
 * @param {Object} services - Tracking services object
 */
function cleanupTrackingServices(services) {
  services.aircraftTracker.stopCleanup();
  services.hfgcsTracker.stopCleanup();
  services.hexToRegService.stopBackgroundLookup();
  if (services.conflictDetector) {
    services.conflictDetector.stopMonitoring();
  }
  console.log('✅ Tracking services cleaned up');
}

module.exports = {
  initializeTrackingServices,
  cleanupTrackingServices
};

