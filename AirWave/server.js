const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3002;
const WS_PORT = process.env.WS_PORT || 3003;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname)));

// JSON middleware
app.use(express.json());

// WebSocket server for real-time updates
let wss;
try {
  wss = new WebSocket.Server({ port: WS_PORT });
  console.log(`[AirWave] WebSocket server running on port ${WS_PORT}`);
} catch (error) {
  console.error(`[AirWave] Failed to start WebSocket server on port ${WS_PORT}:`, error);
  // Continue without WebSocket if it fails
  wss = null;
}

// WebSocket connections
if (wss) {
  wss.on('connection', (ws) => {
    console.log('[AirWave] Client connected');

    ws.on('message', (message) => {
      console.log('[AirWave] Received message:', message.toString());
    });

    ws.on('close', () => {
      console.log('[AirWave] Client disconnected');
    });
  });

  wss.on('error', (error) => {
    console.error('[AirWave] WebSocket server error:', error);
  });
}

// Broadcast to all WebSocket clients
function broadcast(data) {
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

// Utility functions
function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
}

// In-memory data storage
let aircraft = [];
let conflicts = [];
let messages = [];

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT,
    wsPort: WS_PORT
  });
});

// Get all aircraft
app.get('/api/aircraft', (req, res) => {
  res.json({ aircraft });
});

// Get aircraft stats
app.get('/api/stats', (req, res) => {
  const stats = {
    totalAircraft: aircraft.length,
    activeFlights: aircraft.filter(a => a.status === 'active').length,
    conflicts: conflicts.length,
    messages: messages.length,
    timestamp: new Date().toISOString()
  };
  res.json(stats);
});

// Get conflicts
app.get('/api/conflicts', (req, res) => {
  res.json({ conflicts });
});

// Get messages
app.get('/api/messages', (req, res) => {
  res.json({ messages });
});

// Add aircraft (for testing)
app.post('/api/aircraft', (req, res) => {
  const newAircraft = {
    id: `AC${Date.now()}`,
    callsign: req.body.callsign || 'UNKNOWN',
    icao: req.body.icao || '000000',
    latitude: req.body.latitude || 0,
    longitude: req.body.longitude || 0,
    altitude: req.body.altitude || 0,
    speed: req.body.speed || 0,
    heading: req.body.heading || 0,
    status: 'active',
    lastUpdate: new Date().toISOString()
  };

  aircraft.push(newAircraft);
  broadcast({ type: 'aircraft_update', data: newAircraft });

  res.json({ success: true, aircraft: newAircraft });
});

// Add conflict (for testing)
app.post('/api/conflicts', (req, res) => {
  const newConflict = {
    id: `CF${Date.now()}`,
    aircraft1: req.body.aircraft1,
    aircraft2: req.body.aircraft2,
    severity: req.body.severity || 'minor',
    description: req.body.description || 'Potential conflict detected',
    timestamp: new Date().toISOString()
  };

  conflicts.push(newConflict);
  broadcast({ type: 'conflict_alert', data: newConflict });

  res.json({ success: true, conflict: newConflict });
});

// Add message (for testing)
app.post('/api/messages', (req, res) => {
  const newMessage = {
    id: `MSG${Date.now()}`,
    type: req.body.type || 'info',
    content: req.body.content || 'Test message',
    timestamp: new Date().toISOString()
  };

  messages.push(newMessage);
  broadcast({ type: 'message', data: newMessage });

  res.json({ success: true, message: newMessage });
});

// Clear all data
app.post('/api/clear', (req, res) => {
  aircraft = [];
  conflicts = [];
  messages = [];
  broadcast({ type: 'data_cleared' });
  res.json({ success: true });
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`[AirWave] Server running on http://localhost:${PORT}`);
  console.log(`[AirWave] WebSocket server running on ws://localhost:${WS_PORT}`);
  console.log('[AirWave] Ready to receive aviation data...');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[AirWave] Port ${PORT} is already in use. Please free the port or use a different port.`);
    process.exit(1);
  } else {
    console.error(`[AirWave] Server error:`, error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[AirWave] Received SIGTERM, shutting down gracefully');
  if (wss) {
    wss.close();
  }
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[AirWave] Received SIGINT, shutting down gracefully');
  if (wss) {
    wss.close();
  }
  server.close(() => {
    process.exit(0);
  });
});