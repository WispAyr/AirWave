const EventEmitter = require('events');
const https = require('https');

/**
 * EAM.watch Data Source
 * Fetches Emergency Action Messages from the EAM.watch API
 * https://api.eam.watch
 */
class EAMWatchSource extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.name = 'eam-watch';
    this.enabled = !!config.api_token;
    this.config = {
      api_token: config.api_token || process.env.EAM_WATCH_API_TOKEN,
      base_url: config.base_url || process.env.EAM_WATCH_BASE_URL || 'https://api.eam.watch',
      poll_interval: config.poll_interval || 60000, // Check every 60 seconds
      ...config
    };
    
    this.lastMessageId = null;
    this.polling = false;
    this.pollTimer = null;
    
    this.stats = {
      messagesReceived: 0,
      errors: 0,
      lastPoll: null,
      lastMessage: null
    };
  }

  /**
   * Connect to EAM.watch API and start polling
   */
  connect() {
    if (!this.config.api_token) {
      console.error('❌ EAM.watch: No API token configured');
      return;
    }

    if (this.polling) {
      console.log('⚠️ EAM.watch: Already polling');
      return;
    }

    console.log('📡 Connecting to EAM.watch API...');
    this.polling = true;
    this.poll();
  }

  /**
   * Disconnect and stop polling
   */
  disconnect() {
    console.log('🛑 Disconnecting from EAM.watch...');
    this.polling = false;
    
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Alias for connect() for backwards compatibility
   */
  start() {
    this.connect();
  }

  /**
   * Alias for disconnect() for backwards compatibility
   */
  stop() {
    this.disconnect();
  }

  /**
   * Poll for new messages
   */
  async poll() {
    if (!this.polling) return;

    try {
      this.stats.lastPoll = new Date().toISOString();
      const messages = await this.fetchMessages();
      
      if (messages && messages.length > 0) {
        console.log(`📡 EAM.watch: Received ${messages.length} messages`);
        
        for (const message of messages) {
          this.processMessage(message);
        }
      }
    } catch (error) {
      console.error('❌ EAM.watch poll error:', error.message);
      this.stats.errors++;
    }

    // Schedule next poll
    if (this.polling) {
      this.pollTimer = setTimeout(() => this.poll(), this.config.poll_interval);
    }
  }

  /**
   * Fetch messages from EAM.watch API
   */
  fetchMessages() {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.config.base_url}/v1/messages`);
      
      // Only fetch messages newer than last received
      if (this.lastMessageId) {
        url.searchParams.append('since', this.lastMessageId);
      } else {
        // On first run, get last 10 messages
        url.searchParams.append('limit', '10');
      }

      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.api_token}`,
          'Accept': 'application/json',
          'User-Agent': 'AirWave/1.0'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.data || parsed.messages || parsed);
            } catch (error) {
              reject(new Error(`Failed to parse response: ${error.message}`));
            }
          } else if (res.statusCode === 401) {
            reject(new Error('Invalid API token'));
          } else if (res.statusCode === 429) {
            reject(new Error('Rate limit exceeded'));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Process a message from EAM.watch
   */
  processMessage(message) {
    try {
      // Update last message ID for pagination
      if (message.id) {
        this.lastMessageId = message.id;
      }

      // Convert EAM.watch format to AirWave format
      const normalized = {
        source: 'eam-watch',
        source_type: 'eam',
        timestamp: message.timestamp || message.detected_at || new Date().toISOString(),
        
        // EAM-specific fields
        eam: {
          message_type: message.type || 'EAM',
          header: message.header || null,
          message_body: message.message || message.body || '',
          message_length: message.length || null,
          confidence_score: message.confidence || 100,
          first_detected: message.first_detected || message.timestamp,
          last_detected: message.last_detected || message.timestamp,
          codeword: message.codeword || null,
          time_code: message.time || null,
          authentication: message.auth || message.authentication || null,
          frequency: message.frequency || null,
          station: message.station || null,
          raw_data: message
        },

        // Metadata
        text: message.message || message.body || '',
        metadata: {
          api_source: 'eam.watch',
          message_id: message.id,
          station: message.station,
          frequency: message.frequency
        }
      };

      this.stats.messagesReceived++;
      this.stats.lastMessage = normalized.timestamp;

      // Emit message for processing
      this.emit('message', normalized);
      
      console.log(`📨 EAM.watch: ${normalized.eam.message_type} - ${normalized.eam.header || normalized.eam.codeword || 'Unknown'}`);
    } catch (error) {
      console.error('Error processing EAM.watch message:', error);
      this.stats.errors++;
    }
  }

  /**
   * Get source statistics
   */
  getStats() {
    return {
      name: this.name,
      enabled: this.enabled,
      polling: this.polling,
      ...this.stats
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      console.log('🔍 Testing EAM.watch API connection...');
      const messages = await this.fetchMessages();
      console.log(`✅ EAM.watch API connection successful! Received ${messages ? messages.length : 0} messages`);
      return true;
    } catch (error) {
      console.error('❌ EAM.watch API connection failed:', error.message);
      return false;
    }
  }
}

module.exports = EAMWatchSource;

