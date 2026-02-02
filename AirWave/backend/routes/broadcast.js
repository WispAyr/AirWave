const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Default configuration
const DEFAULT_CONFIG = {
  modes: {
    airport_focus: {
      defaultAirport: 'EGPK',
      radius: 50,
      showRunways: true,
      showWeather: false
    },
    military_watch: {
      focusRegion: 'conus',
      highlightTypes: ['E-6B', 'E-4B', 'KC-135', 'KC-46'],
      showEAMAlerts: true,
      autoSwitchOnEAM: true
    },
    global_overview: {
      showHeatmap: false,
      clusterMarkers: true,
      maxAircraft: 500
    },
    eam_alert: {
      autoReturn: true,
      returnDelay: 30,
      playSound: true
    }
  },
  layout: {
    showHeader: true,
    showInfoPanel: true,
    showTicker: true,
    transparent: false
  },
  narrative: {
    enabled: true,
    updateInterval: 15,
    templates: {}
  },
  transitions: {
    enabled: true,
    duration: 500,
    autoRotate: false,
    rotateInterval: 300
  }
};

// Preset configurations
const PRESETS = {
  'uk_airports': {
    id: 'uk_airports',
    name: 'UK Airports',
    description: 'Monitor major UK airports (Prestwick, Glasgow, Edinburgh, Heathrow)',
    config: {
      ...DEFAULT_CONFIG,
      modes: {
        ...DEFAULT_CONFIG.modes,
        airport_focus: {
          defaultAirport: 'EGPK',
          radius: 50,
          showRunways: true,
          showWeather: true
        }
      }
    }
  },
  'us_military': {
    id: 'us_military',
    name: 'US Military',
    description: 'Track US military aircraft with HFGCS and EAM monitoring',
    config: {
      ...DEFAULT_CONFIG,
      modes: {
        ...DEFAULT_CONFIG.modes,
        military_watch: {
          focusRegion: 'conus',
          highlightTypes: ['E-6B', 'E-4B', 'KC-135', 'KC-46', 'B-1B', 'B-52'],
          showEAMAlerts: true,
          autoSwitchOnEAM: true
        }
      }
    }
  },
  'global_traffic': {
    id: 'global_traffic',
    name: 'Global Traffic',
    description: 'Worldwide aviation monitoring with statistics',
    config: {
      ...DEFAULT_CONFIG,
      modes: {
        ...DEFAULT_CONFIG.modes,
        global_overview: {
          showHeatmap: true,
          clusterMarkers: true,
          maxAircraft: 1000
        }
      }
    }
  },
  'eam_watch': {
    id: 'eam_watch',
    name: 'EAM Watch',
    description: 'Focus on Emergency Action Message detection and TACAMO monitoring',
    config: {
      ...DEFAULT_CONFIG,
      modes: {
        ...DEFAULT_CONFIG.modes,
        military_watch: {
          focusRegion: 'global',
          highlightTypes: ['E-6B', 'E-4B'],
          showEAMAlerts: true,
          autoSwitchOnEAM: true
        },
        eam_alert: {
          autoReturn: false,
          returnDelay: 60,
          playSound: true
        }
      }
    }
  }
};

/**
 * GET /api/admin/broadcast/config
 * Get current broadcast configuration
 */
router.get('/config', async (req, res) => {
  try {
    const database = req.app.locals.database;
    
    if (!database) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Fetch all broadcast settings
    const settings = database.getSettingsByCategory('broadcast');

    // If no settings exist, return defaults
    if (!settings || settings.length === 0) {
      return res.json({ success: true, config: DEFAULT_CONFIG });
    }

    // Parse settings into config object
    const config = { ...DEFAULT_CONFIG };
    settings.forEach(setting => {
      try {
        const value = JSON.parse(setting.value);
        const key = setting.key.replace('broadcast.', '');
        if (config[key]) {
          config[key] = { ...config[key], ...value };
        }
      } catch (err) {
        console.error(`Error parsing broadcast setting ${setting.key}:`, err);
      }
    });

    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching broadcast config:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch broadcast configuration',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/broadcast/config
 * Save broadcast configuration
 */
router.post('/config', authenticate, async (req, res) => {
  try {
    const database = req.app.locals.database;
    const config = req.body;

    if (!database) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Validate config structure
    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration format'
      });
    }

    // Save each config section
    const sections = ['modes', 'layout', 'narrative', 'transitions'];
    for (const section of sections) {
      if (config[section]) {
        database.setSetting(
          `broadcast.${section}`,
          JSON.stringify(config[section]),
          'broadcast'
        );
      }
    }

    res.json({ 
      success: true, 
      message: 'Broadcast configuration saved successfully' 
    });
  } catch (error) {
    console.error('Error saving broadcast config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save broadcast configuration',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/broadcast/modes
 * List available broadcast modes
 */
router.get('/modes', (req, res) => {
  const modes = [
    {
      id: 'airport_focus',
      name: 'Airport Focus',
      description: 'Monitor specific airports with arrivals, departures, and runway visualization',
      icon: 'Plane'
    },
    {
      id: 'military_watch',
      name: 'Military Watch',
      description: 'Track US military aircraft including TACAMO, Nightwatch, and tanker operations',
      icon: 'Shield'
    },
    {
      id: 'global_overview',
      name: 'Global Overview',
      description: 'Worldwide aviation monitoring with statistics and heatmaps',
      icon: 'Globe'
    },
    {
      id: 'eam_alert',
      name: 'EAM Alert',
      description: 'Emergency Action Message detection with related HFGCS aircraft context',
      icon: 'AlertTriangle'
    }
  ];

  res.json({ success: true, modes });
});

/**
 * GET /api/admin/broadcast/presets
 * Get preset configurations
 */
router.get('/presets', (req, res) => {
  const presets = Object.values(PRESETS);
  res.json({ success: true, presets });
});

/**
 * POST /api/admin/broadcast/preset/:name
 * Apply a preset configuration
 */
router.post('/preset/:name', authenticate, async (req, res) => {
  try {
    const database = req.app.locals.database;
    const presetName = req.params.name;
    const preset = PRESETS[presetName];

    if (!database) {
      return res.status(503).json({ error: 'Database not available' });
    }

    if (!preset) {
      return res.status(404).json({
        success: false,
        error: 'Preset not found'
      });
    }

    // Save preset config
    const sections = ['modes', 'layout', 'narrative', 'transitions'];
    for (const section of sections) {
      if (preset.config[section]) {
        database.setSetting(
          `broadcast.${section}`,
          JSON.stringify(preset.config[section]),
          'broadcast'
        );
      }
    }

    res.json({
      success: true,
      message: `Preset "${preset.name}" applied successfully`,
      config: preset.config
    });
  } catch (error) {
    console.error('Error applying preset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply preset',
      details: error.message
    });
  }
});

/**
 * PUT /api/admin/broadcast/mode/:mode
 * Update specific mode configuration
 */
router.put('/mode/:mode', authenticate, async (req, res) => {
  try {
    const database = req.app.locals.database;
    const modeName = req.params.mode;
    const modeConfig = req.body;

    if (!database) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Validate mode name
    const validModes = ['airport_focus', 'military_watch', 'global_overview', 'eam_alert'];
    if (!validModes.includes(modeName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode name'
      });
    }

    // Get current config
    const currentModesSetting = database.getSetting('broadcast.modes');
    const modes = currentModesSetting ? JSON.parse(currentModesSetting.value) : DEFAULT_CONFIG.modes;

    // Update specific mode
    modes[modeName] = { ...modes[modeName], ...modeConfig };

    // Save updated config
    database.setSetting('broadcast.modes', JSON.stringify(modes), 'broadcast');

    res.json({
      success: true,
      message: `Mode "${modeName}" updated successfully`
    });
  } catch (error) {
    console.error('Error updating mode config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update mode configuration',
      details: error.message
    });
  }
});

/**
 * DELETE /api/admin/broadcast/config
 * Reset configuration to defaults
 */
router.delete('/config', authenticate, async (req, res) => {
  try {
    const database = req.app.locals.database;

    if (!database) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Delete all broadcast settings
    const sections = ['modes', 'layout', 'narrative', 'transitions'];
    for (const section of sections) {
      database.deleteSetting(`broadcast.${section}`);
    }

    res.json({
      success: true,
      message: 'Broadcast configuration reset to defaults'
    });
  } catch (error) {
    console.error('Error resetting broadcast config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset configuration',
      details: error.message
    });
  }
});

module.exports = router;

