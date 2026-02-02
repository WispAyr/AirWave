const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { generateErrorId } = require('../middleware/error-handler');

/**
 * Aircraft photo routes
 */

// Get single photo for aircraft
router.get('/aircraft/:id/photo', async (req, res) => {
  const database = req.app.locals.database;
  const photoService = req.app.locals.photoService;
  const { id } = req.params;
  
  // Set CORS headers for images
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  try {
    // Get cached photos
    const photos = database.getAircraftPhotos(id);
    
    // If we have a downloaded photo, serve it
    if (photos.length > 0 && photos[0].local_path) {
      const photoPath = photos[0].local_path;
      
      if (fs.existsSync(photoPath)) {
        return res.sendFile(path.resolve(photoPath));
      }
    }
    
    // If no local photo, try to fetch and serve thumbnail URL
    if (photos.length > 0 && photos[0].thumbnail_url) {
      return res.redirect(photos[0].thumbnail_url);
    }
    
    // If no photos found and photoService is available, trigger background fetch
    if (photos.length === 0 && photoService) {
      const aircraft = database.getAircraftByIdentifier(id);
      
      if (aircraft && aircraft.tail) {
        photoService.fetchPhotosForAircraft(aircraft.tail).catch(err => {
          console.error('Background photo fetch failed:', err);
        });
      }
    }
    
    // No photo available
    return res.status(404).json({ 
      success: false,
      error: 'No photo available' 
    });
  } catch (error) {
    console.error('Error getting aircraft photo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get aircraft photo',
      details: error.message
    });
  }
});

// Get all photos for aircraft
router.get('/aircraft/:id/photos', async (req, res) => {
  const database = req.app.locals.database;
  const photoService = req.app.locals.photoService;
  const { id } = req.params;
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  try {
    const photos = database.getAircraftPhotos(id);
    
    // If no photos found and photoService is available, trigger background fetch
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
      photos
    });
  } catch (error) {
    console.error('Error getting aircraft photos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get aircraft photos',
      details: error.message
    });
  }
});

// Refresh photos for aircraft
router.post('/aircraft/:id/photos/refresh', async (req, res) => {
  const database = req.app.locals.database;
  const photoService = req.app.locals.photoService;
  const { id } = req.params;
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }
  
  if (!photoService) {
    return res.status(503).json({ 
      success: false,
      error: 'Photo service not available' 
    });
  }

  try {
    const aircraft = database.getAircraftByIdentifier(id);
    
    if (!aircraft) {
      return res.status(404).json({ 
        success: false,
        error: 'Aircraft not found' 
      });
    }
    
    if (!aircraft.tail) {
      return res.status(400).json({ 
        success: false,
        error: 'Aircraft has no tail number',
        details: 'Cannot fetch photos without registration/tail number'
      });
    }
    
    const photos = await photoService.fetchPhotosForAircraft(aircraft.tail);
    
    res.json({
      success: true,
      count: photos.length,
      photos
    });
  } catch (error) {
    const errorId = generateErrorId();
    logger.error('Error refreshing aircraft photos:', { errorId, error: error.message, aircraftId: id });
    res.status(500).json({ 
      success: false,
      error: 'Failed to refresh photos',
      errorId
    });
  }
});

// Download photos for aircraft
router.post('/aircraft/:id/photos/download', async (req, res) => {
  const photoDownloader = req.app.locals.photoDownloader;
  const { id } = req.params;
  
  if (!photoDownloader) {
    return res.status(503).json({ 
      success: false,
      error: 'Photo downloader not available' 
    });
  }

  try {
    const paths = await photoDownloader.downloadPhotosForAircraft(id);
    
    res.json({
      success: true,
      downloaded: paths.length,
      paths
    });
  } catch (error) {
    const errorId = generateErrorId();
    logger.error('Error downloading photos:', { errorId, error: error.message, aircraftId: id });
    res.status(500).json({ 
      success: false,
      error: 'Failed to download photos',
      errorId
    });
  }
});

// Get photo statistics
router.get('/stats', (req, res) => {
  const database = req.app.locals.database;
  
  if (!database) {
    return res.status(503).json({ 
      success: false,
      error: 'Database not available' 
    });
  }

  try {
    const stats = database.getPhotoStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting photo stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get photo statistics',
      details: error.message
    });
  }
});

// Trigger photo prefetch
router.post('/prefetch', async (req, res) => {
  const photoService = req.app.locals.photoService;
  
  if (!photoService) {
    return res.status(503).json({ 
      success: false,
      error: 'Photo service not available' 
    });
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
    res.status(500).json({ 
      success: false,
      error: 'Failed to start prefetch',
      details: error.message
    });
  }
});

module.exports = router;

