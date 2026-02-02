const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class DataSourceManager extends EventEmitter {
  constructor(messageProcessor) {
    super();
    this.messageProcessor = messageProcessor;
    this.sources = new Map();
    this.config = this.loadConfig();
    this.stats = {
      bySource: {},
      totalMessages: 0
    };
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../config/data-sources.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('✅ Loaded data source configuration');
      return config;
    } catch (error) {
      console.error('Error loading data source config:', error);
      return { sources: {} };
    }
  }

  registerSource(name, sourceInstance) {
    this.sources.set(name, sourceInstance);
    this.stats.bySource[name] = {
      messages: 0,
      errors: 0,
      connected: false,
      lastMessage: null
    };

    // Listen to source events
    sourceInstance.on('message', (message) => {
      this.handleSourceMessage(name, message);
    });

    sourceInstance.on('connected', () => {
      this.stats.bySource[name].connected = true;
      console.log(`✅ ${this.config.sources[name]?.name || name} connected`);
      this.emit('source_connected', name);
    });

    sourceInstance.on('disconnected', () => {
      this.stats.bySource[name].connected = false;
      console.log(`📴 ${this.config.sources[name]?.name || name} disconnected`);
      this.emit('source_disconnected', name);
    });

    sourceInstance.on('error', (error) => {
      this.stats.bySource[name].errors++;
      console.error(`❌ ${name} error:`, error.message);
    });

    console.log(`📡 Registered data source: ${name}`);
  }

  handleSourceMessage(source, message) {
    // Normalize message format
    const normalized = {
      ...message,
      source_name: source,
      source_type: this.config.sources[source]?.type || 'unknown',
      received_at: new Date().toISOString()
    };

    // Update stats
    this.stats.bySource[source].messages++;
    this.stats.bySource[source].lastMessage = new Date().toISOString();
    this.stats.totalMessages++;

    // Process through message processor
    this.messageProcessor.process(normalized);

    // Emit for logging/monitoring
    this.emit('message', { source, message: normalized });
  }

  startEnabled() {
    console.log('');
    console.log('📡 Starting enabled data sources...');
    console.log('═══════════════════════════════════════');
    
    let enabledCount = 0;
    Object.entries(this.config.sources).forEach(([name, config]) => {
      if (config.enabled) {
        const source = this.sources.get(name);
        if (source) {
          console.log(`🔌 Starting ${config.name}...`);
          source.connect();
          enabledCount++;
        } else {
          console.log(`⚠️  ${config.name} not registered`);
        }
      } else {
        console.log(`⏸️  ${config.name} - disabled`);
      }
    });
    
    console.log('═══════════════════════════════════════');
    console.log(`✅ ${enabledCount} source(s) enabled`);
    console.log('');
  }

  stopAll() {
    console.log('🛑 Stopping all data sources...');
    this.sources.forEach((source, name) => {
      if (source.disconnect) {
        source.disconnect();
      }
    });
  }

  getStatus() {
    const status = {};
    Object.entries(this.config.sources).forEach(([name, config]) => {
      status[name] = {
        ...config,
        stats: this.stats.bySource[name] || {
          messages: 0,
          errors: 0,
          connected: false,
          lastMessage: null
        }
      };
    });
    return status;
  }

  enableSource(name) {
    if (this.config.sources[name]) {
      this.config.sources[name].enabled = true;
      this.saveConfig();
      
      const source = this.sources.get(name);
      if (source && source.connect) {
        source.connect();
      }
      return true;
    }
    return false;
  }

  disableSource(name) {
    if (this.config.sources[name]) {
      this.config.sources[name].enabled = false;
      this.saveConfig();
      
      const source = this.sources.get(name);
      if (source && source.disconnect) {
        source.disconnect();
      }
      return true;
    }
    return false;
  }

  saveConfig() {
    try {
      const configPath = path.join(__dirname, '../config/data-sources.json');
      fs.writeFileSync(configPath, JSON.stringify({ sources: this.config.sources }, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  getStats() {
    return this.stats;
  }
}

module.exports = DataSourceManager;

