# 🚀 AIRWAVE Mission Control

Real-time aviation data mission control system powered by [Airframes.io](https://airframes.io).

## Overview

AIRWAVE is a full-stack real-time aviation communications monitoring system that captures, validates, and visualizes ACARS messages from aircraft worldwide. Built with a SpaceX-inspired mission control aesthetic.

### Features

- ✈️ **Live ACARS Feed** - Real-time aircraft communications streaming
- 📊 **Message Validation** - 23 aviation data schemas for standards compliance
- 🗺️ **Interactive World Map** - Live aircraft tracking with Leaflet (NEW!)
- 📍 **Position Tracking** - Parse and display aircraft positions globally
- 📈 **Analytics Dashboard** - Statistics and insights on message patterns
- 🎨 **Mission Control UI** - SpaceX-themed dark interface with real-time updates
- 🔄 **WebSocket Streaming** - Low-latency message delivery
- 💾 **Data Storage** - Message archiving and historical analysis

## Architecture

### Backend (Node.js + Express)
- **Airframes.io Integration** - Live ACARS data ingestion
- **Schema Validation** - JSON Schema validation using aviation_data_model_v1.0
- **WebSocket Server** - Real-time data broadcasting
- **Message Processing** - Categorization, enrichment, and parsing
- **REST API** - Schema and reference data endpoints
- **SQLite Database** - Fast indexed queries with full-text search
- **Data Persistence** - Survives restarts, searchable history

### Frontend (Next.js 14 + React + TypeScript)
- **Real-time Dashboard** - WebSocket-powered live updates
- **SpaceX Theme** - Dark, futuristic mission control aesthetic  
- **Message Feed** - Categorized ACARS messages with metadata
- **Statistics** - Live metrics and analytics
- **Flight Tracker** - Active flight monitoring
- **Charts** - Message type distribution visualization

### Aviation Data Model v1.0
23 validated schemas covering:
- ACARS communications
- CPDLC (Controller-Pilot Data Link)
- ADSC (Automatic Dependent Surveillance)
- OOOI events (Out, Off, On, In)
- Flight phases
- Weather data
- Position reports
- Reference data (airports, airlines, units)

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install
```

### Configuration

**Get your API key from [Airframes.io](https://app.airframes.io)**

1. Create `.env` file:
```bash
cp .env.template .env
```

2. Add your API key to `.env`:
```env
AIRFRAMES_API_KEY=your_actual_api_key_here
AIRFRAMES_API_URL=https://api.airframes.io
PORT=3000
WS_PORT=3001
FRONTEND_PORT=8501
```

⚠️ **Never commit your `.env` file!** It's in `.gitignore` for security.

### Running the Application

**Development Mode (recommended):**
```bash
# From project root - runs both backend and frontend
npm run dev
```

**Separate terminals:**
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### Access Points

- **Frontend Dashboard:** http://localhost:8501
- **Backend API:** http://localhost:3000/api
- **WebSocket:** ws://localhost:3000/ws
- **Health Check:** http://localhost:3000/health

## API Endpoints

### Backend REST API

```
GET  /api/schemas              - List all available schemas
GET  /api/schemas/:name        - Get specific schema
GET  /api/reference/:type      - Get reference data (aviation_units, phonetic_alphabet, flight_phase)
POST /api/validate/:schema     - Validate message against schema
GET  /api/stats                - Get system statistics
GET  /health                   - Health check
```

### WebSocket Events

**Client → Server:**
```json
{
  "type": "subscribe",
  "channels": ["acars", "vdlm2", "hfdl"]
}
```

**Server → Client:**
```json
{
  "type": "acars",
  "data": {
    "id": "msg_...",
    "timestamp": "2024-...",
    "flight": "UAL123",
    "text": "...",
    "category": "oooi",
    "validation": { "valid": true }
  }
}
```

## Message Categories

The system automatically categorizes ACARS messages:

- **OOOI** - Out, Off, On, In events (flight milestones)
- **Position** - Aircraft position reports
- **CPDLC** - Controller-Pilot Data Link Communications
- **Weather** - METAR, TAF, weather data
- **Performance** - ETA, fuel reports
- **ATC Request** - Pilot requests (altitude changes, etc.)
- **Freetext** - Uncategorized messages

## Flight Phases

Based on aviation_data_model_v1.0:
- TAXI - Ground movement
- TAKEOFF - Initial climb
- CRUISE - Enroute level flight
- DESCENT - Descent toward destination
- APPROACH - Terminal area approach
- LANDING - Touchdown and rollout

## Data Storage

Messages are stored in JSONL format:
- **Location:** `backend/data/messages.jsonl`
- **Format:** One JSON object per line
- **Retention:** Automatic cleanup of messages >7 days old
- **Stats:** Aggregated statistics in `backend/data/stats.json`

## Development

### Project Structure

```
airwave/
├── aviation_data_model_v1.0/     # Aviation schemas and reference data
│   ├── schemas/                   # 23 JSON schemas
│   ├── csv/                       # Reference dictionaries
│   └── ontology/                  # RDF/OWL ontology
├── backend/
│   ├── server.js                  # Main server
│   ├── services/
│   │   ├── airframes-client.js    # Airframes.io integration
│   │   ├── message-processor.js   # Message enrichment
│   │   └── database.js            # Data persistence
│   ├── utils/
│   │   └── schema-validator.js    # JSON Schema validation
│   ├── routes/
│   │   └── index.js               # API routes
│   └── data/                      # Message storage
├── frontend/
│   ├── app/
│   │   ├── components/            # React components
│   │   ├── store/                 # State management (Zustand)
│   │   ├── page.tsx               # Main dashboard
│   │   └── layout.tsx             # App layout
│   └── package.json
└── package.json
```

### Adding New Features

1. **Backend changes:** Modify services or add routes
2. **Frontend components:** Add to `frontend/app/components/`
3. **State management:** Update `frontend/app/store/messageStore.ts`
4. **Styling:** Use Tailwind + SpaceX theme variables

### Testing

```bash
# Run tests
npm test

# Validate schemas
npm run validate
```

## Deployment

### Production Build

```bash
# Build frontend
cd frontend && npm run build

# Start production server
npm start
```

### Environment Variables

Set in production:
```env
NODE_ENV=production
AIRFRAMES_API_KEY=your_key_here
PORT=3000
FRONTEND_PORT=8501
```

## Troubleshooting

### Port Already in Use
The app automatically kills processes on ports 3000, 3001, and 8501 before starting.

### WebSocket Connection Issues
- Check firewall settings
- Verify backend is running on port 3000
- Ensure WS_URL in frontend matches backend

### No Messages Appearing
- Verify Airframes.io API key is valid
- Check backend console for connection status
- System currently uses simulated data (see `setupMockConnection()` in airframes-client.js)

## Live Data Integration

To connect to real Airframes.io WebSocket:
1. Check [Airframes.io API docs](https://docs.airframes.io) for WebSocket endpoint
2. Update `AIRFRAMES_WS_URL` in `.env`
3. Modify `airframes-client.js` to use `connectWebSocket()` instead of `setupMockConnection()`

## Aviation Data Model

Reference the schemas for message validation:
- FANS-1/A CPDLC messages
- ATN B1 CPDLC messages  
- ADSC contracts
- OOOI events
- Flight phases
- Aircraft identifiers
- Aerodrome registry
- ICAO regions
- Q-codes
- Phonetic alphabet

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For issues related to:
- **Airframes.io API:** [docs.airframes.io](https://docs.airframes.io)
- **This project:** Open an issue on GitHub

---

**Built with 🚀 for aviation enthusiasts and data engineers**

