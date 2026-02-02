const WebSocket = require('ws');
const EventEmitter = require('events');

class AirframesSource extends EventEmitter {
  constructor() {
    super();
    this.apiKey = process.env.AIRFRAMES_API_KEY;
    this.wsUrl = process.env.AIRFRAMES_WS_URL || 'wss://api.airframes.io';
    this.ws = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.attempts = 0;
    this.maxAttempts = 3;
  }

  connect() {
    if (this.attempts >= this.maxAttempts) {
      console.log('⚠️  Airframes.io: Maximum connection attempts reached');
      console.log('💡 Check AIRFRAMES_API_STATUS.md for API access instructions');
      return;
    }

    this.attempts++;
    console.log(`🔌 Airframes.io attempt ${this.attempts}/${this.maxAttempts}`);

    const wsEndpoints = [
      `wss://api.airframes.io/ws?apikey=${this.apiKey}`,
      `wss://api.airframes.io/stream?key=${this.apiKey}`,
      `wss://feed.airframes.io/messages?token=${this.apiKey}`
    ];

    const wsUrl = wsEndpoints[this.attempts - 1] || wsEndpoints[0];

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('✅ Airframes.io WebSocket connected!');
        this.connected = true;
        this.attempts = 0;
        this.emit('connected');
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.emit('message', message);
        } catch (error) {
          console.error('Airframes message parse error:', error);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
      });

      this.ws.on('error', (error) => {
        this.connected = false;
        this.emit('error', error);
        
        // Try next endpoint
        if (this.attempts < this.maxAttempts) {
          setTimeout(() => this.connect(), 3000);
        }
      });
    } catch (error) {
      this.emit('error', error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.emit('disconnected');
  }

  isConnected() {
    return this.connected;
  }
}

module.exports = AirframesSource;

