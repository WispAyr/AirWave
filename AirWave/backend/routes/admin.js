const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

/**
 * Admin, Settings, and Data Source Control Routes
 */

// ============================================
// SETTINGS ENDPOINTS
// ============================================

// Get all settings grouped by category
router.get('/settings', authenticate, (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const allSettings = database.getAllSettings();
    
    // Group by category
    const grouped = {};
    allSettings.forEach(setting => {
      if (!grouped[setting.category]) {
        grouped[setting.category] = {};
      }
      
      // Try to parse JSON values
      let value = setting.value;
      try {
        value = JSON.parse(value);
      } catch (e) {
        // Keep as string
      }
      
      grouped[setting.category][setting.key] = value;
    });

    res.json({ success: true, settings: grouped });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Get settings for a specific category
router.get('/settings/:category', authenticate, (req, res) => {
  const database = req.app.locals.database;
  const { category } = req.params;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const settings = database.getSettingsByCategory(category);
    
    // Convert to object
    const settingsObj = {};
    settings.forEach(setting => {
      let value = setting.value;
      try {
        value = JSON.parse(value);
      } catch (e) {
        // Keep as string
      }
      settingsObj[setting.key] = value;
    });

    res.json({ success: true, category, settings: settingsObj });
  } catch (error) {
    console.error('Error getting settings for category:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Save/update a setting
router.post('/settings', authenticate, (req, res) => {
  const database = req.app.locals.database;
  const { key, value, category } = req.body;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  if (!key || value === undefined || !category) {
    return res.status(400).json({ error: 'Missing required fields: key, value, category' });
  }

  try {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const success = database.setSetting(key, stringValue, category);
    
    if (success) {
      res.json({ success: true, message: 'Setting saved' });
    } else {
      res.status(500).json({ error: 'Failed to save setting' });
    }
  } catch (error) {
    console.error('Error saving setting:', error);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

// Update a specific setting
router.put('/settings/:key', authenticate, (req, res) => {
  const database = req.app.locals.database;
  const { key } = req.params;
  const { value, category } = req.body;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  if (value === undefined || !category) {
    return res.status(400).json({ error: 'Missing required fields: value, category' });
  }

  try {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const success = database.setSetting(key, stringValue, category);
    
    if (success) {
      res.json({ success: true, message: 'Setting updated' });
    } else {
      res.status(500).json({ error: 'Failed to update setting' });
    }
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Delete a setting
router.delete('/settings/:key', authenticate, (req, res) => {
  const database = req.app.locals.database;
  const { key } = req.params;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const success = database.deleteSetting(key);
    
    if (success) {
      res.json({ success: true, message: 'Setting deleted' });
    } else {
      res.status(404).json({ error: 'Setting not found' });
    }
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

// ============================================
// TAR1090 CONTROL ENDPOINTS
// ============================================

router.post('/tar1090/start', authenticate, (req, res) => {
  const tar1090Client = req.app.locals.tar1090Client;
  const { url, pollInterval } = req.body;
  
  if (!tar1090Client) {
    return res.status(503).json({ error: 'TAR1090 client not available' });
  }

  try {
    const targetUrl = url || tar1090Client.tar1090Url || 'http://192.168.1.120/skyaware/data/aircraft.json';
    const targetInterval = pollInterval || tar1090Client.pollInterval || 2000;
    
    console.log('Starting TAR1090 with:', { url: targetUrl, pollInterval: targetInterval });
    
    const success = tar1090Client.connect(targetUrl, targetInterval);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'TAR1090 client started (connecting...)',
        status: {
          connected: tar1090Client.isConnected(),
          url: tar1090Client.tar1090Url,
          pollInterval: tar1090Client.pollInterval
        }
      });
    } else {
      res.status(400).json({ 
        error: 'Failed to start TAR1090 client. URL not configured.',
        details: 'Please provide a TAR1090 URL in the request or settings.'
      });
    }
  } catch (error) {
    console.error('Error starting TAR1090 client:', error);
    res.status(500).json({ 
      error: 'Failed to start TAR1090 client',
      details: error.message 
    });
  }
});

router.post('/tar1090/stop', authenticate, (req, res) => {
  const tar1090Client = req.app.locals.tar1090Client;
  
  if (!tar1090Client) {
    return res.status(503).json({ error: 'TAR1090 client not available' });
  }

  try {
    tar1090Client.disconnect();
    res.json({ 
      success: true, 
      message: 'TAR1090 client stopped',
      status: {
        connected: false
      }
    });
  } catch (error) {
    console.error('Error stopping TAR1090 client:', error);
    res.status(500).json({ error: 'Failed to stop TAR1090 client' });
  }
});

router.get('/tar1090/status', (req, res) => {
  const tar1090Client = req.app.locals.tar1090Client;
  
  if (!tar1090Client) {
    return res.status(503).json({ error: 'TAR1090 client not available' });
  }

  try {
    res.json({
      success: true,
      status: {
        connected: tar1090Client.isConnected(),
        messageCount: tar1090Client.getMessageCount(),
        url: tar1090Client.tar1090Url,
        pollInterval: tar1090Client.pollInterval
      }
    });
  } catch (error) {
    console.error('Error getting TAR1090 status:', error);
    res.status(500).json({ error: 'Failed to get TAR1090 status' });
  }
});

// ============================================
// DATABASE MAINTENANCE ENDPOINTS
// ============================================

router.get('/database/stats', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const stats = database.getDatabaseStats();
    const tableSizes = database.getTableSizes();
    
    res.json({
      success: true,
      stats: stats,
      tables: tableSizes
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({ error: 'Failed to get database statistics' });
  }
});

router.post('/database/optimize', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const result = database.optimizeDatabase();
    res.json(result);
  } catch (error) {
    console.error('Error optimizing database:', error);
    res.status(500).json({ error: 'Failed to optimize database' });
  }
});

router.post('/database/clear-messages', (req, res) => {
  const database = req.app.locals.database;
  const { olderThanDays } = req.body;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const deleted = database.clearMessages(olderThanDays);
    res.json({
      success: true,
      deleted: deleted,
      olderThanDays: olderThanDays || 'all'
    });
  } catch (error) {
    console.error('Error clearing messages:', error);
    res.status(500).json({ error: 'Failed to clear messages' });
  }
});

router.post('/database/clear-aircraft', (req, res) => {
  const database = req.app.locals.database;
  const { olderThanHours } = req.body;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const deleted = database.clearStaleAircraft(olderThanHours || 24);
    res.json({
      success: true,
      deleted: deleted,
      olderThanHours: olderThanHours || 24
    });
  } catch (error) {
    console.error('Error clearing aircraft:', error);
    res.status(500).json({ error: 'Failed to clear aircraft' });
  }
});

router.post('/database/clear-transcriptions', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const deleted = database.clearTranscriptions();
    res.json({
      success: true,
      deleted: deleted
    });
  } catch (error) {
    console.error('Error clearing transcriptions:', error);
    res.status(500).json({ error: 'Failed to clear transcriptions' });
  }
});

router.post('/database/clear-recordings', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const deleted = database.clearRecordingEntries();
    res.json({
      success: true,
      deleted: deleted,
      note: 'Database entries cleared. Use /admin/files/clear-recordings to delete audio files.'
    });
  } catch (error) {
    console.error('Error clearing recording entries:', error);
    res.status(500).json({ error: 'Failed to clear recording entries' });
  }
});

router.post('/database/clear-photos', (req, res) => {
  const database = req.app.locals.database;
  const { olderThanDays } = req.body;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const deleted = database.clearPhotoEntries(olderThanDays);
    res.json({
      success: true,
      deleted: deleted,
      olderThanDays: olderThanDays || 'all',
      note: 'Database entries cleared. Use /admin/files/clear-photos to delete image files.'
    });
  } catch (error) {
    console.error('Error clearing photo entries:', error);
    res.status(500).json({ error: 'Failed to clear photo entries' });
  }
});

router.post('/database/clear-hex-cache', (req, res) => {
  const database = req.app.locals.database;
  const hexToRegService = req.app.locals.hexToRegService;
  const { olderThanDays } = req.body;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const deleted = database.clearHexToRegCache(olderThanDays);
    
    // Also clear memory cache if service available
    if (hexToRegService) {
      hexToRegService.clearCache();
    }
    
    res.json({
      success: true,
      deleted: deleted,
      olderThanDays: olderThanDays || 'all',
      memoryCacheCleared: !!hexToRegService
    });
  } catch (error) {
    console.error('Error clearing hex cache:', error);
    res.status(500).json({ error: 'Failed to clear hex cache' });
  }
});

router.post('/database/reset-statistics', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const deleted = database.resetStatistics();
    res.json({
      success: true,
      deleted: deleted
    });
  } catch (error) {
    console.error('Error resetting statistics:', error);
    res.status(500).json({ error: 'Failed to reset statistics' });
  }
});

router.post('/database/maintenance', (req, res) => {
  const database = req.app.locals.database;
  const options = req.body || {};
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const result = database.runMaintenance(options);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error running maintenance:', error);
    res.status(500).json({ error: 'Failed to run maintenance' });
  }
});

// ============================================
// FILE SYSTEM MAINTENANCE ENDPOINTS
// ============================================

router.post('/files/clear-videos', (req, res) => {
  const videoRenderer = req.app.locals.videoRenderer;
  const { maxAgeHours } = req.body;
  
  if (!videoRenderer) {
    return res.status(503).json({ error: 'Video renderer not available' });
  }

  try {
    videoRenderer.cleanupOldVideos(maxAgeHours || 24);
    res.json({
      success: true,
      message: `Cleared videos older than ${maxAgeHours || 24} hours`
    });
  } catch (error) {
    console.error('Error clearing videos:', error);
    res.status(500).json({ error: 'Failed to clear videos' });
  }
});

router.post('/files/clear-photos', (req, res) => {
  const photoDownloader = req.app.locals.photoDownloader;
  const { maxAgeDays } = req.body;
  
  if (!photoDownloader) {
    return res.status(503).json({ error: 'Photo downloader not available' });
  }

  try {
    const result = photoDownloader.cleanupOldPhotos(maxAgeDays || 30);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error clearing photos:', error);
    res.status(500).json({ error: 'Failed to clear photos' });
  }
});

router.get('/files/stats', (req, res) => {
  const videoRenderer = req.app.locals.videoRenderer;
  const photoDownloader = req.app.locals.photoDownloader;
  
  try {
    const stats = {
      videos: videoRenderer ? videoRenderer.getStats() : null,
      photos: photoDownloader ? photoDownloader.getStats() : null
    };
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting file stats:', error);
    res.status(500).json({ error: 'Failed to get file statistics' });
  }
});

// ============================================
// ADS-B EXCHANGE CONTROL ENDPOINTS
// ============================================

router.post('/adsbexchange/start', authenticate, async (req, res) => {
  const dataSourceManager = req.app.locals.dataSourceManager;
  const configManager = req.app.locals.configManager;
  
  if (!dataSourceManager) {
    return res.status(503).json({ error: 'DataSourceManager not available' });
  }

  try {
    const { apiKey, pollInterval, lat, lon, dist } = req.body;
    
    // Update config if provided
    if (configManager && (apiKey || pollInterval || lat || lon || dist)) {
      const updates = {};
      if (apiKey) updates.api_key = apiKey;
      if (pollInterval) updates.poll_interval = parseInt(pollInterval);
      if (lat !== undefined) updates.default_lat = parseFloat(lat);
      if (lon !== undefined) updates.default_lon = parseFloat(lon);
      if (dist !== undefined) updates.default_dist = parseInt(dist);
      
      await configManager.setCategory('adsbexchange', updates);
      console.log('✅ ADS-B Exchange config updated:', updates);
    }
    
    // Get the source instance and update its configuration
    const source = dataSourceManager.sources.get('adsbexchange');
    if (source && apiKey) {
      let cleanApiKey = apiKey;
      if (cleanApiKey.startsWith('api-auth:')) {
        cleanApiKey = cleanApiKey.substring('api-auth:'.length);
        console.log('ℹ️  Stripped api-auth: prefix from API key');
      }
      source.apiKey = cleanApiKey;
      console.log('✅ ADS-B Exchange API key applied to source instance');
    }
    if (source && pollInterval) {
      source.updateInterval = parseInt(pollInterval);
    }
    if (source && lat !== undefined) {
      source.defaultLat = parseFloat(lat);
    }
    if (source && lon !== undefined) {
      source.defaultLon = parseFloat(lon);
    }
    if (source && dist !== undefined) {
      source.defaultDist = parseInt(dist);
    }
    
    const success = dataSourceManager.enableSource('adsbexchange');
    
    if (success) {
      res.json({
        success: true,
        message: 'ADS-B Exchange source enabled and starting',
        note: 'Check connection status in a few seconds'
      });
    } else {
      res.status(400).json({ error: 'Failed to enable ADS-B Exchange source' });
    }
  } catch (error) {
    console.error('Error starting ADS-B Exchange:', error);
    res.status(500).json({ 
      error: 'Failed to start ADS-B Exchange',
      details: error.message 
    });
  }
});

router.post('/adsbexchange/stop', authenticate, (req, res) => {
  const dataSourceManager = req.app.locals.dataSourceManager;
  
  if (!dataSourceManager) {
    return res.status(503).json({ error: 'DataSourceManager not available' });
  }

  try {
    const success = dataSourceManager.disableSource('adsbexchange');
    
    res.json({
      success,
      message: success ? 'ADS-B Exchange source disabled' : 'Failed to disable source'
    });
  } catch (error) {
    console.error('Error stopping ADS-B Exchange:', error);
    res.status(500).json({ error: 'Failed to stop ADS-B Exchange' });
  }
});

router.get('/adsbexchange/status', (req, res) => {
  const dataSourceManager = req.app.locals.dataSourceManager;
  const configManager = req.app.locals.configManager;
  
  if (!dataSourceManager) {
    return res.status(503).json({ error: 'DataSourceManager not available' });
  }

  try {
    const status = dataSourceManager.getStatus();
    const adsbexStatus = status.adsbexchange;
    
    if (adsbexStatus) {
      const currentConfig = configManager ? configManager.getADSBExchangeConfig() : {};
      
      res.json({
        success: true,
        status: {
          enabled: adsbexStatus.enabled,
          connected: adsbexStatus.stats?.connected || false,
          messages: adsbexStatus.stats?.messages || 0,
          errors: adsbexStatus.stats?.errors || 0,
          lastMessage: adsbexStatus.stats?.lastMessage || null,
          config: currentConfig
        }
      });
    } else {
      res.status(404).json({ error: 'ADS-B Exchange source not found' });
    }
  } catch (error) {
    console.error('Error getting ADS-B Exchange status:', error);
    res.status(500).json({ error: 'Failed to get ADS-B Exchange status' });
  }
});

router.post('/adsbexchange/poll-interval', (req, res) => {
  const dataSourceManager = req.app.locals.dataSourceManager;
  const configManager = req.app.locals.configManager;
  const { pollInterval } = req.body;
  
  if (!dataSourceManager) {
    return res.status(503).json({ error: 'DataSourceManager not available' });
  }

  if (!pollInterval || pollInterval < 5000) {
    return res.status(400).json({ 
      error: 'Invalid poll interval',
      details: 'Poll interval must be at least 5000ms (5 seconds) to respect rate limits'
    });
  }

  try {
    if (configManager) {
      configManager.set('adsbexchange', 'poll_interval', parseInt(pollInterval));
    }
    
    const source = dataSourceManager.sources.get('adsbexchange');
    if (source && source.setPollInterval) {
      source.setPollInterval(parseInt(pollInterval));
    }
    
    res.json({
      success: true,
      message: 'Poll interval updated',
      pollInterval: parseInt(pollInterval)
    });
  } catch (error) {
    console.error('Error updating poll interval:', error);
    res.status(500).json({ error: 'Failed to update poll interval' });
  }
});

// ============================================
// OPENSKY NETWORK CONTROL ENDPOINTS
// ============================================

router.post('/opensky/start', authenticate, async (req, res) => {
  const dataSourceManager = req.app.locals.dataSourceManager;
  const configManager = req.app.locals.configManager;
  
  if (!dataSourceManager) {
    return res.status(503).json({ error: 'DataSourceManager not available' });
  }

  try {
    const { pollInterval, lat, lon, radius } = req.body;
    
    if (configManager && (pollInterval || lat || lon || radius)) {
      const updates = {};
      if (pollInterval) updates.poll_interval = parseInt(pollInterval);
      if (lat !== undefined) updates.default_lat = parseFloat(lat);
      if (lon !== undefined) updates.default_lon = parseFloat(lon);
      if (radius !== undefined) updates.default_radius = parseInt(radius);
      
      await configManager.setCategory('opensky', updates);
      console.log('✅ OpenSky Network config updated:', updates);
    }
    
    const source = dataSourceManager.sources.get('opensky');
    if (source && pollInterval) {
      source.updateInterval = parseInt(pollInterval);
    }
    if (source && lat !== undefined) {
      source.defaultLat = parseFloat(lat);
    }
    if (source && lon !== undefined) {
      source.defaultLon = parseFloat(lon);
    }
    if (source && radius !== undefined) {
      source.defaultRadius = parseInt(radius);
    }
    
    const success = dataSourceManager.enableSource('opensky');
    
    if (success) {
      res.json({
        success: true,
        message: 'OpenSky Network source enabled and starting',
        note: 'Check connection status in a few seconds'
      });
    } else {
      res.status(400).json({ error: 'Failed to enable OpenSky Network source' });
    }
  } catch (error) {
    console.error('Error starting OpenSky Network:', error);
    res.status(500).json({ 
      error: 'Failed to start OpenSky Network',
      details: error.message 
    });
  }
});

router.post('/opensky/stop', authenticate, (req, res) => {
  const dataSourceManager = req.app.locals.dataSourceManager;
  
  if (!dataSourceManager) {
    return res.status(503).json({ error: 'DataSourceManager not available' });
  }

  try {
    const success = dataSourceManager.disableSource('opensky');
    
    res.json({
      success,
      message: success ? 'OpenSky Network source disabled' : 'Failed to disable source'
    });
  } catch (error) {
    console.error('Error stopping OpenSky Network:', error);
    res.status(500).json({ error: 'Failed to stop OpenSky Network' });
  }
});

router.get('/opensky/status', (req, res) => {
  const dataSourceManager = req.app.locals.dataSourceManager;
  const configManager = req.app.locals.configManager;
  
  if (!dataSourceManager) {
    return res.status(503).json({ error: 'DataSourceManager not available' });
  }

  try {
    const status = dataSourceManager.getStatus();
    const openskyStatus = status.opensky;
    
    if (openskyStatus) {
      const currentConfig = configManager ? configManager.getOpenSkyConfig() : {};
      
      res.json({
        success: true,
        status: {
          enabled: openskyStatus.enabled,
          connected: openskyStatus.stats?.connected || false,
          messages: openskyStatus.stats?.messages || 0,
          errors: openskyStatus.stats?.errors || 0,
          lastMessage: openskyStatus.stats?.lastMessage || null,
          config: currentConfig
        }
      });
    } else {
      res.status(404).json({ error: 'OpenSky Network source not found' });
    }
  } catch (error) {
    console.error('Error getting OpenSky Network status:', error);
    res.status(500).json({ error: 'Failed to get OpenSky Network status' });
  }
});

// ============================================
// AIRFRAMES CONTROL ENDPOINTS
// ============================================

router.post('/airframes/start', authenticate, async (req, res) => {
  const dataSourceManager = req.app.locals.dataSourceManager;
  const configManager = req.app.locals.configManager;
  
  if (!dataSourceManager) {
    return res.status(503).json({ error: 'DataSourceManager not available' });
  }

  try {
    const { apiKey, apiUrl, wsUrl } = req.body;
    
    if (configManager && (apiKey || apiUrl || wsUrl)) {
      const updates = {};
      if (apiKey) updates.api_key = apiKey;
      if (apiUrl) updates.api_url = apiUrl;
      if (wsUrl) updates.ws_url = wsUrl;
      
      await configManager.setCategory('airframes', updates);
      console.log('✅ Airframes config updated:', updates);
    }
    
    const source = dataSourceManager.sources.get('airframes');
    if (source && apiKey) {
      source.apiKey = apiKey;
      console.log('✅ Airframes API key applied to source instance');
    }
    if (source && apiUrl) {
      source.apiUrl = apiUrl;
    }
    if (source && wsUrl) {
      source.wsUrl = wsUrl;
    }
    
    const success = dataSourceManager.enableSource('airframes');
    
    if (success) {
      res.json({
        success: true,
        message: 'Airframes source enabled and starting',
        note: 'Check connection status in a few seconds'
      });
    } else {
      res.status(400).json({ error: 'Failed to enable Airframes source' });
    }
  } catch (error) {
    console.error('Error starting Airframes:', error);
    res.status(500).json({ 
      error: 'Failed to start Airframes',
      details: error.message 
    });
  }
});

router.post('/airframes/stop', authenticate, (req, res) => {
  const dataSourceManager = req.app.locals.dataSourceManager;
  
  if (!dataSourceManager) {
    return res.status(503).json({ error: 'DataSourceManager not available' });
  }

  try {
    const success = dataSourceManager.disableSource('airframes');
    
    if (success) {
      res.json({
        success: true,
        message: 'Airframes source disabled'
      });
    } else {
      res.status(400).json({ error: 'Failed to disable Airframes source' });
    }
  } catch (error) {
    console.error('Error stopping Airframes:', error);
    res.status(500).json({ 
      error: 'Failed to stop Airframes',
      details: error.message 
    });
  }
});

// ============================================
// SERVICE RESTART ENDPOINT
// ============================================

router.post('/services/restart/:service', (req, res) => {
  const { service } = req.params;
  
  res.json({
    success: true,
    message: `Service restart requested: ${service}`,
    note: 'Service restart functionality will be implemented based on service architecture'
  });
});

module.exports = router;




