const express = require('express');
const router = express.Router();

/**
 * HFGCS Aircraft Tracking Routes
 */

// Get all active HFGCS aircraft
router.get('/aircraft', (req, res) => {
  const database = req.app.locals.database;
  const hfgcsTracker = req.app.locals.hfgcsTracker;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    // Get active aircraft from tracker (in-memory)
    const activeAircraft = hfgcsTracker ? hfgcsTracker.getActiveAircraft() : [];
    
    // Get recent aircraft from database
    const dbAircraft = database.getActiveHFGCSAircraft(50);
    
    res.json({
      success: true,
      count: activeAircraft.length,
      active: activeAircraft,
      recent: dbAircraft
    });
  } catch (error) {
    console.error('Error getting HFGCS aircraft:', error);
    res.status(500).json({ error: 'Failed to get HFGCS aircraft' });
  }
});

// Get specific HFGCS aircraft by ID
router.get('/aircraft/:id', (req, res) => {
  const database = req.app.locals.database;
  const { id } = req.params;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const aircraft = database.getHFGCSAircraftById(id);
    
    if (!aircraft) {
      return res.status(404).json({ error: 'HFGCS aircraft not found' });
    }

    // Get messages for this aircraft
    const messages = database.getMessagesByFlight(id, 200);
    
    res.json({
      success: true,
      aircraft: aircraft,
      messages: messages
    });
  } catch (error) {
    console.error('Error getting HFGCS aircraft:', error);
    res.status(500).json({ error: 'Failed to get HFGCS aircraft' });
  }
});

// Get HFGCS configuration
router.get('/config', (req, res) => {
  const hfgcsTracker = req.app.locals.hfgcsTracker;
  
  if (!hfgcsTracker) {
    return res.status(503).json({ error: 'HFGCS tracker not available' });
  }
  
  try {
    const config = hfgcsTracker.getConfiguration();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error getting HFGCS config:', error);
    res.status(500).json({ error: 'Failed to get HFGCS configuration' });
  }
});

// Update HFGCS configuration (requires auth in production)
router.post('/config', (req, res) => {
  const hfgcsTracker = req.app.locals.hfgcsTracker;
  const { enabled_types } = req.body;
  
  if (!hfgcsTracker) {
    return res.status(503).json({ error: 'HFGCS tracker not available' });
  }
  
  try {
    hfgcsTracker.updateEnabledTypes(enabled_types);
    res.json({ success: true, message: 'HFGCS configuration updated' });
  } catch (error) {
    console.error('Error updating HFGCS config:', error);
    res.status(500).json({ error: 'Failed to update HFGCS configuration' });
  }
});

// Get HFGCS tracking statistics
router.get('/statistics', (req, res) => {
  const database = req.app.locals.database;
  const hfgcsTracker = req.app.locals.hfgcsTracker;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    // Get tracker stats (in-memory)
    const trackerStats = hfgcsTracker ? hfgcsTracker.getStats() : null;
    
    // Get database stats
    const dbStats = database.getHFGCSStatistics();
    
    res.json({
      success: true,
      stats: {
        ...dbStats,
        activeCount: trackerStats?.activeCount || 0,
        lastActivityFormatted: trackerStats?.lastActivityFormatted || dbStats.last_activity
      }
    });
  } catch (error) {
    console.error('Error getting HFGCS statistics:', error);
    res.status(500).json({ error: 'Failed to get HFGCS statistics' });
  }
});

// Get HFGCS historical activity
router.get('/history', (req, res) => {
  const database = req.app.locals.database;
  const days = parseInt(req.query.days) || 7;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const history = database.getHFGCSHistory(days);
    
    res.json({
      success: true,
      days: days,
      count: history.length,
      aircraft: history
    });
  } catch (error) {
    console.error('Error getting HFGCS history:', error);
    res.status(500).json({ error: 'Failed to get HFGCS history' });
  }
});

module.exports = router;




