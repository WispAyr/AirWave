const express = require('express');
const router = express.Router();

/**
 * EAM (Emergency Action Message) Routes
 */

// Get all EAM messages with filtering
router.get('/', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const options = {
      messageType: req.query.type || null,
      minConfidence: parseInt(req.query.minConfidence) || 0,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const messages = database.getEAMMessages(options);
    
    res.json({
      success: true,
      count: messages.length,
      messages,
      filters: {
        type: options.messageType,
        minConfidence: options.minConfidence,
        limit: options.limit,
        offset: options.offset
      }
    });
  } catch (error) {
    console.error('Error getting EAM messages:', error);
    res.status(500).json({ error: 'Failed to get EAM messages' });
  }
});

// Get specific EAM by ID
router.get('/:id', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const message = database.getEAMById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'EAM message not found' });
    }
    
    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Error getting EAM by ID:', error);
    res.status(500).json({ error: 'Failed to get EAM message' });
  }
});

// Search EAMs
router.get('/search', (req, res) => {
  const database = req.app.locals.database;
  const query = req.query.q;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  if (!query) {
    return res.status(400).json({ error: 'Search query required' });
  }

  try {
    const limit = parseInt(req.query.limit) || 50;
    const messages = database.searchEAMs(query, limit);
    
    res.json({
      success: true,
      query,
      count: messages.length,
      messages
    });
  } catch (error) {
    console.error('Error searching EAMs:', error);
    res.status(500).json({ error: 'Failed to search EAMs' });
  }
});

// Get EAM statistics
router.get('/statistics', (req, res) => {
  const database = req.app.locals.database;
  const eamDetector = req.app.locals.eamDetector;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const dbStats = database.getEAMStatistics();
    const detectorStats = eamDetector ? eamDetector.getEAMStatistics() : null;
    
    res.json({
      success: true,
      stats: {
        database: dbStats,
        detector: detectorStats
      }
    });
  } catch (error) {
    console.error('Error getting EAM statistics:', error);
    res.status(500).json({ error: 'Failed to get EAM statistics' });
  }
});

// Get multi-segment EAM statistics
router.get('/statistics/multi-segment', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const stats = database.db.prepare(`
      SELECT 
        COUNT(*) as total_multi_segment,
        AVG(segment_count) as avg_segments,
        MAX(segment_count) as max_segments,
        AVG(confidence_score) as avg_confidence
      FROM eam_messages
      WHERE multi_segment = 1
    `).get();
    
    const distribution = database.db.prepare(`
      SELECT segment_count, COUNT(*) as count
      FROM eam_messages
      WHERE multi_segment = 1
      GROUP BY segment_count
      ORDER BY segment_count
    `).all();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        distribution
      }
    });
  } catch (error) {
    console.error('Error getting multi-segment statistics:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Get EAMs for a specific recording
router.get('/by-recording/:segmentId', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const messages = database.getEAMsByRecordingId(req.params.segmentId);
    
    res.json({
      success: true,
      segmentId: req.params.segmentId,
      count: messages.length,
      messages
    });
  } catch (error) {
    console.error('Error getting EAMs by recording ID:', error);
    res.status(500).json({ error: 'Failed to get EAMs for recording' });
  }
});

// Verify/correct EAM (authenticated)
router.post('/:id/verify', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { verified, correctedBody, notes } = req.body;
    
    // Note: In production, you'd add proper verification fields to the database
    // For now, just acknowledge the request
    
    res.json({
      success: true,
      message: 'EAM verified',
      id: req.params.id,
      verified
    });
  } catch (error) {
    console.error('Error verifying EAM:', error);
    res.status(500).json({ error: 'Failed to verify EAM' });
  }
});

// Delete false positive EAM (authenticated)
router.delete('/:id', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const deleted = database.deleteEAM(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'EAM message not found' });
    }
    
    res.json({
      success: true,
      message: 'EAM deleted'
    });
  } catch (error) {
    console.error('Error deleting EAM:', error);
    res.status(500).json({ error: 'Failed to delete EAM' });
  }
});

module.exports = router;

