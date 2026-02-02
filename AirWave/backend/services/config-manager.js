const EventEmitter = require('events');

class ConfigManager extends EventEmitter {
  constructor(database) {
    super();
    this.database = database;
    this.config = {};
    this.defaults = {
      airframes: {
        api_key: process.env.AIRFRAMES_API_KEY || '',
        api_url: process.env.AIRFRAMES_API_URL || 'https://api.airframes.io',
        ws_url: process.env.AIRFRAMES_WS_URL || 'wss://api.airframes.io'
      },
      tar1090: {
        enabled: false,
        url: 'http://192.168.1.120/skyaware/data/aircraft.json',
        poll_interval: 2000
      },
      adsbexchange: {
        api_key: process.env.ADSBEXCHANGE_API_KEY || '',
        api_url: process.env.ADSBEXCHANGE_API_URL || 'https://adsbexchange.com/api/aircraft',
        default_lat: parseFloat(process.env.ADSBEXCHANGE_DEFAULT_LAT) || null,
        default_lon: parseFloat(process.env.ADSBEXCHANGE_DEFAULT_LON) || null,
        default_dist: parseInt(process.env.ADSBEXCHANGE_DEFAULT_DIST) || 10,
        poll_interval: 10000
      },
      opensky: {
        default_lat: parseFloat(process.env.OPENSKY_DEFAULT_LAT) || null,
        default_lon: parseFloat(process.env.OPENSKY_DEFAULT_LON) || null,
        default_radius: parseInt(process.env.OPENSKY_DEFAULT_RADIUS) || 250000,
        poll_interval: 10000
      },
      eam_watch: {
        api_token: process.env.EAM_WATCH_API_TOKEN || '',
        base_url: process.env.EAM_WATCH_BASE_URL || 'https://api.eam.watch',
        poll_interval: 60000
      },
      whisper: {
        server_url: process.env.WHISPER_SERVER_URL || 'http://localhost:8080',
        language: 'en',
        model: 'base.en',
        temperature: 0.0,
        beam_size: 5
      },
      audio: {
        sample_rate: 16000,
        chunk_duration: 30,
        vad_threshold: 0.5,
        vad_min_silence_duration: 500,
        vad_speech_pad: 30
      },
      system: {
        database_retention_days: 7,
        log_level: 'info',
        enable_metrics: true
      }
    };
  }

  async initialize() {
    console.log('🔧 Initializing ConfigManager...');
    
    // Load all settings from database
    await this.reload();
    
    console.log('✅ ConfigManager initialized');
  }

  async reload() {
    try {
      const settings = this.database.getAllSettings();
      
      // Group settings by category
      this.config = {};
      settings.forEach(setting => {
        if (!this.config[setting.category]) {
          this.config[setting.category] = {};
        }
        
        // Parse JSON values if needed
        let value = setting.value;
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Keep as string if not JSON
        }
        
        this.config[setting.category][setting.key] = value;
      });

      // Merge with defaults
      for (const category in this.defaults) {
        if (!this.config[category]) {
          this.config[category] = { ...this.defaults[category] };
        } else {
          this.config[category] = {
            ...this.defaults[category],
            ...this.config[category]
          };
        }
      }

      return true;
    } catch (error) {
      console.error('Error reloading config:', error);
      // Use defaults on error
      this.config = { ...this.defaults };
      return false;
    }
  }

  get(category, key, defaultValue = null) {
    if (!this.config[category]) {
      return defaultValue !== null ? defaultValue : this.defaults[category]?.[key];
    }
    
    const value = this.config[category][key];
    return value !== undefined ? value : 
           (defaultValue !== null ? defaultValue : this.defaults[category]?.[key]);
  }

  async set(category, key, value) {
    try {
      // Convert value to string for storage
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      // Save to database
      this.database.setSetting(key, stringValue, category);
      
      // Update in-memory config
      if (!this.config[category]) {
        this.config[category] = {};
      }
      this.config[category][key] = value;

      // Emit change event
      this.emit('config:changed', { category, key, value });
      
      return true;
    } catch (error) {
      console.error('Error setting config:', error);
      return false;
    }
  }

  getCategory(category) {
    return this.config[category] || this.defaults[category] || {};
  }

  async setCategory(category, settings) {
    try {
      for (const [key, value] of Object.entries(settings)) {
        await this.set(category, key, value);
      }
      return true;
    } catch (error) {
      console.error('Error setting category:', error);
      return false;
    }
  }

  getAllSettings() {
    return { ...this.config };
  }

  getDefaults() {
    return { ...this.defaults };
  }

  async applyChanges(service) {
    // Emit service-specific change event
    this.emit(`service:restart`, service);
    return true;
  }

  // Convenience getters for common settings
  getAirframesConfig() {
    return this.getCategory('airframes');
  }

  getTar1090Config() {
    return this.getCategory('tar1090');
  }

  getWhisperConfig() {
    return this.getCategory('whisper');
  }

  getAudioConfig() {
    return this.getCategory('audio');
  }

  getSystemConfig() {
    return this.getCategory('system');
  }

  getADSBExchangeConfig() {
    return this.getCategory('adsbexchange');
  }

  getOpenSkyConfig() {
    return this.getCategory('opensky');
  }
}

module.exports = ConfigManager;

