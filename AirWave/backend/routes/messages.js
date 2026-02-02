const express = require('express');
const router = express.Router();

/**
 * Message and aircraft query routes
 */

// Get recent messages from database
router.get('/recent', (req, res) => {
  const database = req.app.locals.database;
  const limit = parseInt(req.query.limit) || 100;
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  const messages = database.getRecentMessages(limit);
  res.json({ count: messages.length, messages });
});

// Search messages
router.get('/search', (req, res) => {
  const database = req.app.locals.database;
  const query = req.query.q;
  const limit = parseInt(req.query.limit) || 100;
  
  if (!query) {
    return res.status(400).json({ 
      success: false,
      error: 'Query parameter "q" is required' 
    });
  }
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  const messages = database.searchMessages(query, limit);
  res.json({ count: messages.length, query, messages });
});

// Get messages for specific flight
router.get('/flight/:flight', (req, res) => {
  const database = req.app.locals.database;
  const { flight } = req.params;
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  const messages = database.getMessagesForFlight(flight);
  res.json({ 
    success: true,
    flight,
    count: messages.length,
    messages 
  });
});

// Get active aircraft
router.get('/aircraft/active', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  const aircraft = database.getActiveAircraft();
  res.json({ 
    success: true,
    count: aircraft.length,
    aircraft 
  });
});

// Get aircraft positions for map
router.get('/aircraft/positions', (req, res) => {
  const database = req.app.locals.database;
  const aircraftTracker = req.app.locals.aircraftTracker;
  const hfgcsTracker = req.app.locals.hfgcsTracker;
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  try {
    let positions = [];
    
    // Get ADS-B positions from tracker
    if (aircraftTracker) {
      const trackedAircraft = aircraftTracker.getActiveAircraft();
      positions = trackedAircraft.map(ac => ({
        id: ac.id || ac.hex || ac.tail,
        hex: ac.hex,
        tail: ac.tail,
        flight: ac.flight,
        aircraft_type: ac.aircraft_type,
        position: ac.current_position,
        predicted_path: ac.predicted_path || [],
        prediction_confidence: ac.prediction_confidence || 0,
        last_seen: ac.last_seen,
        timestamp: ac.current_position?.timestamp,
        source: { type: 'adsb' },
        category: 'adsb'
      }));
    }
    
    // Add HFGCS aircraft
    if (hfgcsTracker) {
      const hfgcsAircraft = hfgcsTracker.getActiveAircraft();
      hfgcsAircraft.forEach(ac => {
        positions.push({
          id: ac.id,
          hex: ac.hex,
          callsign: ac.callsign,
          tail: ac.tail,
          flight: ac.callsign,
          aircraft_type: ac.type,
          position: ac.position,
          last_seen: ac.last_seen,
          source: { type: 'hfgcs' },
          category: 'hfgcs',
          hfgcs_classification: ac.type
        });
      });
    }
    
    res.json({ 
      success: true,
      count: positions.length,
      positions 
    });
  } catch (error) {
    console.error('Error getting aircraft positions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get aircraft positions',
      details: error.message
    });
  }
});

// Get aircraft details by ID
router.get('/aircraft/:id', (req, res) => {
  const database = req.app.locals.database;
  const { id } = req.params;
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  try {
    const aircraft = database.getAircraftByIdentifier(id);
    
    if (!aircraft) {
      return res.status(404).json({ 
        success: false,
        error: 'Aircraft not found',
        id 
      });
    }
    
    res.json({ 
      success: true,
      aircraft 
    });
  } catch (error) {
    console.error('Error getting aircraft:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get aircraft details',
      details: error.message
    });
  }
});

// Get aircraft track data
router.get('/aircraft/:id/track', (req, res) => {
  const database = req.app.locals.database;
  const aircraftTracker = req.app.locals.aircraftTracker;
  const { id } = req.params;
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  try {
    let track = [];
    
    // Get track from tracker if available
    if (aircraftTracker) {
      const aircraft = aircraftTracker.getAircraft(id);
      if (aircraft && aircraft.track) {
        track = aircraft.track;
      }
    }
    
    // Also get messages for this aircraft
    const messages = database.getMessagesForAircraft(id);
    
    res.json({ 
      success: true,
      aircraft_id: id,
      track,
      messages,
      track_points: track.length,
      message_count: messages.length
    });
  } catch (error) {
    console.error('Error getting aircraft track:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get aircraft track',
      details: error.message
    });
  }
});

// Get messages for specific aircraft
router.get('/aircraft/:id/messages', (req, res) => {
  const database = req.app.locals.database;
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 100;
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  try {
    const messages = database.getMessagesForAircraft(id, limit);
    
    res.json({ 
      success: true,
      aircraft_id: id,
      count: messages.length,
      messages 
    });
  } catch (error) {
    console.error('Error getting aircraft messages:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get aircraft messages',
      details: error.message
    });
  }
});

module.exports = router;

