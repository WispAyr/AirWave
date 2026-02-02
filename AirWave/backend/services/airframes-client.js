const axios = require('axios');
const WebSocket = require('ws');
const EventEmitter = require('events');

class AirframesClient extends EventEmitter {
  constructor(messageProcessor) {
    super();
    this.apiKey = process.env.AIRFRAMES_API_KEY;
    this.apiUrl = process.env.AIRFRAMES_API_URL || 'https://api.airframes.io';
    this.wsUrl = process.env.AIRFRAMES_WS_URL || 'wss://api.airframes.io';
    this.messageProcessor = messageProcessor;
    this.ws = null;
    this.connected = false;
    this.reconnectInterval = 5000;
    this.reconnectTimer = null;
    this.restPollInterval = null;
    this.wsAttempts = 0;
    this.maxWsAttempts = 3;
  }

  isConnected() {
    return this.connected;
  }

  connect() {
    console.log('🛰️  Connecting to Airframes.io...');
    
    // Try WebSocket first
    this.connectWebSocket();
  }

  async tryRestAPI() {
    console.log('🔄 Attempting REST API connection...');
    
    const endpoints = [
      `${this.apiUrl}/messages?apikey=${this.apiKey}`,
      `${this.apiUrl}/v1/messages?key=${this.apiKey}`,
      `${this.apiUrl}/api/messages?token=${this.apiKey}`,
      `https://app.airframes.io/api/messages?key=${this.apiKey}`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔌 Trying REST: ${endpoint.replace(this.apiKey, '****')}`);
        const response = await axios.get(endpoint, {
          timeout: 5000,
          headers: {
            'User-Agent': 'AIRWAVE-MissionControl/1.0',
            'Accept': 'application/json'
          }
        });

        if (response.status === 200 && response.data) {
          console.log('✅ REST API connection successful!');
          this.startRestPolling(endpoint);
          return true;
        }
      } catch (error) {
        console.log(`❌ Failed: ${error.response?.status || error.message}`);
      }
    }

    console.log('⚠️  All REST API attempts failed');
    return false;
  }

  startRestPolling(endpoint) {
    console.log('📡 Starting REST API polling (every 10 seconds)...');
    this.connected = true;
    
    const poll = async () => {
      try {
        const response = await axios.get(endpoint, { timeout: 5000 });
        if (response.data && Array.isArray(response.data.messages)) {
          response.data.messages.forEach(msg => this.handleMessage(msg));
        } else if (response.data && Array.isArray(response.data)) {
          response.data.forEach(msg => this.handleMessage(msg));
        }
      } catch (error) {
        console.error('REST poll error:', error.message);
      }
    };

    // Poll immediately, then every 10 seconds
    poll();
    this.restPollInterval = setInterval(poll, 10000);
  }

  connectWebSocket() {
    this.wsAttempts++;
    
    if (this.wsAttempts > this.maxWsAttempts) {
      console.log(`⚠️  WebSocket failed after ${this.maxWsAttempts} attempts`);
      console.log('🔄 Switching to REST API polling...');
      this.tryRestAPI().then(success => {
        if (!success) {
          console.log('');
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║  ⚠️  AIRFRAMES.IO API ACCESS REQUIRED                     ║');
          console.log('╠════════════════════════════════════════════════════════════╣');
          console.log('║  Your API key doesn\'t have real-time access               ║');
          console.log('║                                                            ║');
          console.log('║  To get live data:                                        ║');
          console.log('║  1. Email: [email protected]                ║');
          console.log('║  2. Request: WebSocket or REST API access                 ║');
          console.log('║  3. Include your API key for upgrade                      ║');
          console.log('║                                                            ║');
          console.log('║  Meanwhile: Using database with historical data           ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log('');
        }
      });
      return;
    }

    try {
      // Try multiple WebSocket endpoint formats
      const wsEndpoints = [
        `wss://api.airframes.io/ws?apikey=${this.apiKey}`,
        `wss://api.airframes.io/stream?key=${this.apiKey}`,
        `wss://feed.airframes.io/messages?token=${this.apiKey}`,
        `wss://app.airframes.io/ws?auth=${this.apiKey}`,
        `${this.wsUrl}/live?apikey=${this.apiKey}`
      ];
      
      const wsUrl = wsEndpoints[this.wsAttempts - 1] || wsEndpoints[0];
      console.log(`🔌 WebSocket attempt ${this.wsAttempts}/${this.maxWsAttempts}: ${wsUrl.replace(this.apiKey, '****')}`);
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'User-Agent': 'AIRWAVE-MissionControl/1.0',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      this.ws.on('open', () => {
        console.log('✅ Connected to Airframes.io Live WebSocket!');
        this.connected = true;
        this.wsAttempts = 0; // Reset on success
        this.emit('connected');
        
        // Try different subscription formats
        const subscriptions = [
          { type: 'subscribe', channels: ['acars', 'vdlm2', 'hfdl', 'iridium'] },
          { action: 'subscribe', feed: 'all' },
          { subscribe: true },
          'SUBSCRIBE ALL'
        ];

        subscriptions.forEach(sub => {
          try {
            this.ws.send(typeof sub === 'string' ? sub : JSON.stringify(sub));
          } catch (e) {
            // Ignore
          }
        });
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📥 Live message:', message.flight || message.tail || 'received');
          this.handleMessage(message);
        } catch (error) {
          // Try handling as plain text or other format
          console.log('📥 Raw message:', data.toString().substring(0, 100));
        }
      });

      this.ws.on('close', () => {
        console.log('📴 WebSocket disconnected');
        this.connected = false;
        if (this.wsAttempts < this.maxWsAttempts) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error) => {
        console.error(`❌ WebSocket error (attempt ${this.wsAttempts}):`, error.message);
        this.connected = false;
      });
    } catch (error) {
      console.error('Failed to create WebSocket:', error.message);
      if (this.wsAttempts < this.maxWsAttempts) {
        this.scheduleReconnect();
      }
    }
  }

  handleMessage(message) {
    // Process through message processor
    this.messageProcessor.process(message);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    const delay = this.reconnectInterval;
    console.log(`⏰ Reconnecting in ${delay / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.restPollInterval) {
      clearInterval(this.restPollInterval);
      this.restPollInterval = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    console.log('🛑 Airframes client disconnected');
  }

  async getRecentMessages(limit = 50) {
    const endpoints = [
      `${this.apiUrl}/messages/recent?limit=${limit}&key=${this.apiKey}`,
      `${this.apiUrl}/messages?limit=${limit}&apikey=${this.apiKey}`,
      `https://app.airframes.io/api/messages?limit=${limit}&key=${this.apiKey}`
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(endpoint, { timeout: 5000 });
        if (response.data) {
          return response.data.messages || response.data;
        }
      } catch (error) {
        // Try next endpoint
      }
    }

    console.log('⚠️  Could not fetch recent messages from API');
    return [];
  }
}

module.exports = AirframesClient;
