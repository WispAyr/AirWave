const express = require('express');
const router = express.Router();

/**
 * Hex-to-registration lookup routes
 */

// Get registration for hex code
router.get('/:hex', async (req, res) => {
  const hexToRegService = req.app.locals.hexToRegService;
  
  if (!hexToRegService) {
    return res.status(503).json({ 
      success: false,
      error: 'Hex-to-registration service not available' 
    });
  }

  try {
    const hex = req.params.hex.toUpperCase();
    const registration = await hexToRegService.lookupHex(hex);
    
    if (registration) {
      res.json({ 
        success: true,
        hex,
        registration: registration.registration,
        type: registration.type,
        manufacturer: registration.manufacturer,
        model: registration.model,
        operator: registration.operator,
        cached: registration.cached || false
      });
    } else {
      res.status(404).json({ 
        success: false,
        error: 'Registration not found for hex code',
        hex
      });
    }
  } catch (error) {
    console.error('Hex lookup error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to lookup registration',
      details: error.message
    });
  }
});

// Get registration status (stats)
router.get('/stats', (req, res) => {
  const hexToRegService = req.app.locals.hexToRegService;
  
  if (!hexToRegService) {
    return res.status(503).json({ 
      success: false,
      error: 'Hex-to-registration service not available' 
    });
  }

  const stats = hexToRegService.getStats();
  res.json({ success: true, stats });
});

module.exports = router;

