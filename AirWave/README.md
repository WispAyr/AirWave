# 🚀 AIRWAVE Mission Control

Real-time aviation data mission control system powered by [Airframes.io](https://airframes.io).

## Overview

AIRWAVE is a full-stack real-time aviation communications monitoring system that captures, validates, and visualizes ACARS messages from aircraft worldwide. Built with a SpaceX-inspired mission control aesthetic.

### Features

- ✈️ **Live ACARS Feed** - Real-time aircraft communications streaming
- 📊 **Message Validation** - 23 aviation data schemas for standards compliance
- 🗺️ **Interactive World Map** - Live aircraft tracking with Leaflet
- 📍 **Position Tracking** - Parse and display aircraft positions globally
- 🛰️ **ADS-B/TAR1090 Integration** - Local aircraft tracking from TAR1090 feed (NEW!)
- 🎧 **Live ATC Audio** - Stream live air traffic control communications
- 🎥 **YouTube Livestream Monitoring** - Monitor HFGCS or other radio livestreams from YouTube with VOX recording
- 📺 **YouTube Live Stream Auto-Discovery** - Automatically fetch and select live streams from configured channels (NEW!)
- 🛡️ **HFGCS Aircraft Tracking** - Real-time tracking of E-6B Mercury and E-4B Nightwatch aircraft (NEW!)
- 🚨 **Multi-Segment EAM Detection** - Detects Emergency Action Messages across multiple audio segments with temporal correlation (NEW!)
- 🎬 **Video Generation** - Create shareable videos of aircraft tracks using Remotion (NEW!)
- 🐦 **Twitter Integration** - Post aircraft track videos directly to Twitter/X (NEW!)
- 📸 **Aircraft Photos** - Automatic photo caching from JetPhotos and FlightRadar24 (NEW!)
- 📡 **YouTube Broadcast Overlay** - Full-screen overlay system for live streaming with multiple viewing modes, OBS integration, and real-time narrative generation (NEW!)
- 📈 **Analytics Dashboard** - Statistics and insights on message patterns
- ⚙️ **Web Admin Panel** - Runtime configuration without server restarts (NEW!)
- 🎨 **Mission Control UI** - SpaceX-themed dark interface with real-time updates
- 🔄 **WebSocket Streaming** - Low-latency message delivery
- 💾 **Data Storage** - Message archiving and historical analysis with SQLite

## Architecture

### Backend (Node.js + Express)
- **Airframes.io Integration** - Live ACARS data ingestion
- **TAR1090 Client** - ADS-B aircraft tracking from local feed
- **Aircraft Photo Service** - JetAPI integration for photo caching
- **Schema Validation** - JSON Schema validation using aviation_data_model_v1.0
- **WebSocket Server** - Real-time data broadcasting
- **Message Processing** - Categorization, enrichment, and parsing
- **Configuration Manager** - Database-backed runtime configuration
- **REST API** - Schema, reference data, and admin endpoints
- **SQLite Database** - Fast indexed queries with full-text search
- **Data Persistence** - Survives restarts, searchable history
- **Video Renderer** - Programmatic video generation using Remotion
- **Twitter API v2 Client** - Social media integration for sharing tracks

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

## HFGCS Livestream Monitoring

Monitor High Frequency Global Communications System (HFGCS) livestreams from YouTube with automatic voice activity detection and transcription.

**Features:**
- Real-time audio capture from YouTube livestreams
- VOX-based recording (captures only when speech is detected)
- Whisper AI transcription of military radio communications
- Noise reduction optimized for HF radio frequencies
- Automatic segment storage and playback
- **Multi-segment EAM detection** with temporal correlation (NEW!)

**Supported Streams:**
- HFGCS frequencies (8992 kHz, 11175 kHz, etc.)
- Any YouTube livestream with audio content
- WebSDR and KiwiSDR rebroadcasts

**Access:** Navigate to the HFGCS page via the header navigation or visit `http://localhost:3000/hfgcs` (Next.js frontend)

### Multi-Segment EAM Detection

AirWave now supports detecting Emergency Action Messages that span multiple audio segments, which is common in HF radio transmissions due to:
- Signal fading and interference
- Repeated transmissions
- Long message duration (30-60 seconds)

**How It Works:**

1. **Trigger Detection:** When a transcription contains EAM indicators ("stand by", "message follows"), the system triggers multi-segment analysis

2. **Temporal Correlation:** Fetches related recordings from the same feed within a ±2 minute window

3. **Aggregation:** Combines transcriptions in chronological order

4. **Enhanced Detection:** Runs pattern matching on the combined text with flexible patterns

5. **Confidence Scoring:** Assigns higher confidence to multi-segment detections that show proper temporal coherence

**Pre-processing:**
- Removes Whisper artifacts ([Unknown] markers, timestamps)
- Normalizes common phonetic transcription errors (Force→Foxtrot, Strong→Sierra)
- Converts NATO phonetics to alphanumeric characters

**Configuration:**
- Time window: 120 seconds (configurable in `EAMSegmentAggregator`)
- Maximum segments: 10 per aggregation
- Minimum confidence: 40 for multi-segment EAMs

**UI Indicators:**
- Multi-segment EAMs display a chain-link icon and segment count
- Filter option to show only multi-segment detections
- Statistics show multi-segment detection rate

## YouTube Live Stream Auto-Discovery

Automatically discover and select live streams from configured YouTube channels using the YouTube Data API v3.

### Features

- **Automatic Stream Discovery** - Fetch currently live streams from any YouTube channel
- **Real-time Stream Selection** - Choose from a dropdown of available live streams
- **Viewer Count Display** - See concurrent viewer counts for each stream
- **Auto-refresh** - Streams automatically refresh every 5 minutes
- **Fallback to Manual Entry** - Option to manually enter YouTube URLs if preferred
- **Caching** - Intelligent caching to minimize API quota usage (5-minute cache)

### Configuration

#### 1. Obtain a YouTube Data API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**
4. Navigate to **Credentials** → **Create Credentials** → **API Key**
5. (Recommended) Restrict the key to YouTube Data API v3 only
6. Copy the API key

#### 2. Configure in Admin Settings

1. Navigate to the **Admin Settings** page (`/admin`)
2. Select the **YouTube** section
3. Paste your API key in the **YouTube Data API Key** field
4. Click **Test API Key** to verify it works
5. Enter the default channel handle (e.g., `@neetintel`)
6. Click **Validate** to verify the channel exists
7. Click **Save Changes**

#### 3. Use Auto-Discovery on HFGCS Page

1. Navigate to the **HFGCS** page
2. Click **Edit** in the Stream Configuration section
3. Use the **Auto-Select** mode to see available live streams
4. Select a stream from the dropdown
5. Click **Save Configuration**
6. Start monitoring as normal

### API Quota Limits

- Default quota: **10,000 units per day**
- Each stream search costs approximately **100 units**
- Caching minimizes quota usage:
  - Channel ID lookups: cached for 24 hours
  - Live stream lists: cached for 5 minutes
- To request a quota increase, visit the [Google Cloud Console](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas)

### Troubleshooting

**No live streams found:**
- Verify the channel has active live streams
- Check the channel handle is correct (must start with `@`)
- Try refreshing the stream list

**YouTube API not configured:**
- Add your API key in Admin Settings
- Verify the API key is valid using the Test button
- Ensure YouTube Data API v3 is enabled in Google Cloud Console

**API quota exceeded:**
- Wait for quota reset (midnight Pacific Time)
- Request a quota increase from Google Cloud Console
- Caching helps reduce quota usage automatically

**Invalid API key:**
- Verify the key is correctly copied
- Check the key hasn't been restricted too tightly
- Ensure YouTube Data API v3 is enabled for the project

## Video Generation

Generate shareable videos of aircraft flight tracks with animated maps, telemetry overlays, and SpaceX mission control styling using Remotion.

### Features

- **Automated Video Creation** - Programmatically generate videos from tracked aircraft positions
- **1080p HD Output** - High-quality 1920x1080 @ 30fps MP4 videos
- **Animated Flight Paths** - Progressive reveal of flight tracks with waypoint markers
- **Live Telemetry Overlay** - Real-time altitude, speed, and heading display
- **SpaceX Aesthetic** - Mission control themed overlays and effects
- **Customizable Duration** - Adjust video length to match your needs
- **Automatic Cleanup** - Videos are automatically deleted after 24 hours

### Usage

1. Navigate to any aircraft detail page (e.g., `/aircraft/UAL123`)
2. Ensure the aircraft has at least 2 tracked positions
3. Click the "Generate Video" button in the header
4. Wait for rendering to complete (typically 10-30 seconds)
5. Video is automatically saved and ready for download or sharing

### Video Specifications

- **Resolution**: 1920x1080 (Full HD)
- **Frame Rate**: 30 fps
- **Codec**: H.264 (maximum compatibility)
- **Duration**: 10 seconds (default, configurable)
- **File Size**: ~5-15 MB depending on track complexity
- **Format**: MP4

### Development

Preview and customize video compositions using Remotion Studio:

```bash
npm run remotion:studio
```

This opens an interactive preview at `http://localhost:5000` where you can:
- Preview compositions in real-time
- Adjust props and settings
- Test with different aircraft data
- Export videos manually

### Configuration

Video rendering settings can be configured in `remotion.config.ts`:

```typescript
Config.setConcurrency(2);      // CPU threads to use
Config.setJpegQuality(80);     // Quality (1-100)
Config.setCodec('h264');       // Video codec
```

Environment variables in `.env`:

```bash
VIDEO_DEFAULT_FPS=30           # Default frame rate
VIDEO_DEFAULT_DURATION=10      # Default duration in seconds
VIDEO_CLEANUP_HOURS=24         # Auto-cleanup after hours
```

## Broadcast Overlay System

AirWave includes a professional broadcast overlay system designed for YouTube streaming and OBS integration.

### Viewing Modes

**Airport Focus Mode**
- Monitor specific airports (EGPK, EGLL, KJFK, etc.)
- Configurable radius (10-100nm)
- Arrivals/departures tracking
- Runway visualization
- Real-time traffic statistics

**Military Watch Mode**
- Track US military aircraft (TACAMO, Nightwatch, tankers, bombers)
- HFGCS activity monitoring
- EAM alert integration
- Mission duration tracking
- Refueling operation detection

**Global Overview Mode**
- Worldwide aircraft tracking
- Regional statistics
- Data source status
- Message throughput visualization
- Top airlines and routes

**EAM Alert Mode**
- Automatic activation on EAM detection
- Full-screen alert display
- Related HFGCS aircraft context
- Multi-segment message reconstruction
- Auto-return to previous mode

### Configuration

1. Navigate to Admin panel → Broadcast tab
2. Configure each mode's settings
3. Customize layout (header, info panel, ticker)
4. Set narrative update intervals
5. Enable/disable transitions and auto-rotation
6. Apply presets for common scenarios

### OBS Integration

**Browser Source Setup:**

1. Add Browser Source in OBS
2. URL: `http://localhost:3000/broadcast?mode=military_watch`
3. Width: 1920, Height: 1080
4. Custom CSS (optional): For transparent background
5. Refresh browser when source is active: Enabled

**Query Parameters:**
- `mode`: airport_focus | military_watch | global_overview | eam_alert
- `transparent`: true | false (for chroma key)
- `airport`: ICAO code (for airport_focus mode)
- `region`: conus | europe | northatlantic | global (for military_watch)

**Example URLs:**
- Airport: `http://localhost:3000/broadcast?mode=airport_focus&airport=EGPK`
- Military: `http://localhost:3000/broadcast?mode=military_watch&region=conus`
- Transparent: `http://localhost:3000/broadcast?mode=global_overview&transparent=true`

### Keyboard Controls

- `M`: Toggle mode selection menu
- `H`: Hide/show info panel
- `T`: Toggle ticker bar
- `F`: Toggle full-screen alert mode
- `ESC`: Return to default view

### Narrative System

The broadcast overlay includes an intelligent narrative generation system that provides context-aware commentary:

- Updates every 15 seconds (configurable)
- Mode-specific templates
- Highlights significant events
- Tracks aircraft movements and patterns
- Generates human-readable summaries

### Performance Optimization

- Optimized for 1920x1080 Full HD streaming
- GPU-accelerated animations
- Efficient WebSocket message handling
- Marker clustering for global view
- Configurable aircraft limits

## Twitter Integration

Share aircraft track videos directly to Twitter/X with automatic video upload and tweet generation.

### Setup

1. **Create Twitter Developer Account**
   - Visit [Twitter Developer Portal](https://developer.twitter.com/)
   - Create a new app with OAuth 2.0 enabled
   - Enable "Read and Write" permissions

2. **Generate API Credentials**
   - Required scopes: `tweet.read`, `tweet.write`, `media.write`, `users.read`
   - Copy API Key, API Secret, Access Token, and Access Secret

3. **Configure Environment Variables**
   
   Copy `env.template` to `.env` and add your credentials:

   ```bash
   TWITTER_API_KEY=your_api_key_here
   TWITTER_API_SECRET=your_api_secret_here
   TWITTER_ACCESS_TOKEN=your_access_token_here
   TWITTER_ACCESS_SECRET=your_access_secret_here
   ```

4. **Restart Backend**
   
   ```bash
   npm run server
   ```

### Usage

1. Navigate to an aircraft detail page
2. Generate a video (or click "Post to X" to auto-generate)
3. Click the "Post to X" button
4. Video is uploaded and tweet is posted automatically
5. Tweet URL is displayed with a link to view

### Tweet Format

Tweets are automatically generated with:

- Flight identifier (flight number or tail number)
- Aircraft type
- Track statistics (positions tracked, duration)
- Aviation hashtags (#Aviation #FlightTracking #ACARS #ADSB)

Example tweet:
```
✈️ Flight UAL123 (Boeing 737-800)
📍 245 positions tracked
⏱️ 42.5 minutes of flight data

#Aviation #FlightTracking #AirWave #ACARS #ADSB
```

You can also provide custom tweet text in the API call.

### Rate Limits

Twitter API v2 has the following limits:
- **Media uploads**: 5 MB/min upload rate
- **Tweets**: 50 tweets per 24 hours (varies by account tier)

The app handles rate limits gracefully and will display errors if limits are exceeded.

### Optional Configuration

Twitter integration is **completely optional**. The app works perfectly without it:
- Video generation works independently
- No Twitter credentials needed for core functionality
- Simply skip the Twitter setup steps if not needed

## Aircraft Photos

AirWave automatically fetches and caches aircraft photos from JetAPI, providing high-quality photos from JetPhotos and FlightRadar24.

### Features

- **Automatic Caching** - Photos are fetched from JetAPI (jetapi.dev) and stored in the database
- **7-Day TTL** - Photos are cached for 7 days by default to reduce API calls
- **Background Prefetch** - Active aircraft without photos are automatically prefetched every 30 minutes
- **Manual Refresh** - Force refresh photos for any aircraft via the UI or API
- **Photo Sources** - JetPhotos and FlightRadar24 integration
- **URL Storage** - Photos are stored as URLs, not downloaded locally
- **Photographer Credits** - Full attribution with photographer names and upload dates

### How It Works

1. When you view an aircraft detail page, the system checks for cached photos
2. If no photos exist, they are automatically fetched from JetAPI in the background
3. Photos are stored with metadata (photographer, source, upload date, aircraft type)
4. A background job runs every 30 minutes to prefetch photos for active aircraft
5. You can manually refresh photos at any time using the refresh button

### Configuration

Configure photo service settings in `.env`:

```bash
JETAPI_BASE_URL=https://www.jetapi.dev/api
JETAPI_DEFAULT_PHOTO_COUNT=5       # Number of photos to fetch per aircraft
JETAPI_CACHE_TTL_DAYS=7             # How long to cache photos before refreshing
JETAPI_RATE_LIMIT_MS=1000           # Minimum milliseconds between requests
JETAPI_PREFETCH_INTERVAL_MINUTES=30 # Background prefetch interval
```

### API Usage

**Get cached photos:**
```bash
GET /api/aircraft/:id/photos
```

**Force refresh photos:**
```bash
POST /api/aircraft/:id/photos/refresh
```

**Get photo statistics:**
```bash
GET /api/photos/stats
```

**Trigger background prefetch:**
```bash
POST /api/photos/prefetch
```

### Notes

- JetAPI is a free service and no API key is required
- Photos are fetched from publicly available sources
- Rate limiting is implemented to respect the service (1 request per second)
- Photos are stored as URLs in the database to minimize storage requirements
- The service handles errors gracefully and retries failed requests

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- yt-dlp (for YouTube stream extraction)

### Installation

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install
```

### Install yt-dlp

**macOS (Homebrew):**
```bash
brew install yt-dlp
```

**Linux (pip):**
```bash
pip install yt-dlp
```

**Windows:**
Download from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) and add to PATH.

**Verify installation:**
```bash
yt-dlp --version
```

### Configuration

#### Option 1: Environment Variables (Initial Setup)

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
WHISPER_SERVER_URL=http://localhost:8080
```

⚠️ **Never commit your `.env` file!** It's in `.gitignore` for security.

#### Option 2: Admin Panel (Runtime Configuration)

After initial startup, you can configure all settings via the web admin panel at http://localhost:8501/admin. Settings stored in the database take precedence over environment variables and persist across restarts.

### YouTube Stream Configuration

Configure HFGCS or other YouTube livestreams via the Admin panel:

1. Navigate to Admin → YOUTUBE tab
2. Enter the YouTube livestream URL (e.g., `https://www.youtube.com/watch?v=PxkRgL9xm3o`)
3. Set a Feed ID (default: `hfgcs_youtube`)
4. Save configuration
5. Navigate to the HFGCS page to start monitoring

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
- **Admin Panel:** http://localhost:8501/admin
- **HFGCS Monitor:** http://localhost:8501/hfgcs
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
GET  /api/atc-feeds            - List all ATC feeds
GET  /api/atc-feeds/:id        - Get specific feed
GET  /api/atc-feeds/airport/:icao - Get feeds by airport
GET  /api/atc-preferences      - Get user preferences
POST /api/atc-preferences      - Save user preferences
GET  /api/aircraft/:id/photos  - Get cached photos for aircraft
POST /api/aircraft/:id/photos/refresh - Force refresh photos
GET  /api/photos/stats         - Photo cache statistics
GET  /health                   - Health check

# Admin endpoints
GET    /api/admin/settings                - Get all settings by category
GET    /api/admin/settings/:category      - Get settings for specific category
POST   /api/admin/settings                - Save/update a setting
PUT    /api/admin/settings/:key           - Update specific setting
DELETE /api/admin/settings/:key           - Delete a setting
POST   /api/admin/tar1090/start           - Start TAR1090 client
POST   /api/admin/tar1090/stop            - Stop TAR1090 client
GET    /api/admin/tar1090/status          - Get TAR1090 connection status
POST   /api/admin/services/restart/:service - Restart a service
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

## HFGCS Aircraft Tracking

The system automatically identifies and tracks High Frequency Global Communications System (HFGCS) aircraft in real-time:

### Aircraft Types

- **E-6B Mercury (TACAMO)** - 16 aircraft, callsigns: IRON*, GOTO FMS
  - Take Charge And Move Out (TACAMO) - Airborne nuclear command post
  - Based on Boeing 707-320 airframe
  - VLF/LF communications with submarines
- **E-4B Nightwatch** - 4 aircraft, callsigns: GORDO*, TITAN*, SLICK*
  - National Airborne Operations Center (NAOC)
  - Airborne command post for National Command Authority
  - Designed to survive nuclear attack

### Detection Methods

The tracker identifies HFGCS aircraft using multiple detection strategies:

- **Mode-S hex codes** - ICAO 24-bit address (ADFEB3-ADFEB6 for E-4B, BuNo-derived for E-6B)
- **Callsign pattern matching** - Recognizes known military callsigns
- **Aircraft type identification** - Matches E6, E-6, E6B, E-6B, E4, E-4, E4B, E-4B, TACAMO, NIGHTWATCH
- **Bureau/tail number matching** - Cross-references known tail numbers

### Features

- **Real-time Detection** - Automatically identifies HFGCS aircraft from ADS-B and ACARS sources
- **Active Tracking** - Monitors position, altitude, speed, and heading
- **Historical Data** - Stores all HFGCS aircraft activity in database
- **Statistics Dashboard** - View total detected, currently active, breakdown by type
- **Message Archive** - All messages from HFGCS aircraft are tagged and archived
- **WebSocket Broadcasting** - Real-time updates when HFGCS aircraft detected/updated/lost

### Usage

1. Navigate to **HFGCS Monitor** (http://localhost:3000/hfgcs)
2. The top section shows real-time HFGCS aircraft tracking
3. Active aircraft are displayed with:
   - Aircraft type (E-6B or E-4B) with color coding
   - Detection method badge (hex/callsign/tail/type)
   - Current position, altitude, speed, heading
   - Last seen timestamp
4. Statistics panel shows:
   - Currently active aircraft count
   - Total HFGCS aircraft detected (all time)
   - Breakdown: E-6B vs E-4B counts
   - Total messages received
   - Last activity timestamp
5. Click any aircraft to view full track history and messages

### API Endpoints

- `GET /api/hfgcs/aircraft` - Get all active HFGCS aircraft
- `GET /api/hfgcs/aircraft/:id` - Get specific HFGCS aircraft details
- `GET /api/hfgcs/statistics` - Get tracking statistics
- `GET /api/hfgcs/history?days=7` - Get historical activity

## Live ATC Audio

Stream live air traffic control communications from airports worldwide:
- 🎧 Select from 20+ major airports
- 📻 Multiple frequencies per airport (Tower, Ground, Approach)
- ⭐ Save favorite feeds
- 🔊 Volume control and playback management

### Available Feeds
- Major US airports: JFK, LAX, ORD, ATL, DFW, etc.
- European hubs: Heathrow, Charles de Gaulle, Frankfurt, etc.
- Asia-Pacific: Tokyo Narita, Sydney, Singapore, etc.

### Legal Notice
Audio streams are provided by LiveATC.net. This application links to publicly available streams for educational and monitoring purposes. Users must comply with LiveATC.net's terms of service. Third-party redistribution of streams is prohibited.

## TAR1090 Integration

Connect to your local TAR1090 instance for ADS-B aircraft tracking:

### Configuration

1. Navigate to **Admin Panel** (http://localhost:8501/admin)
2. Click on **TAR1090** tab
3. Configure:
   - **TAR1090 URL:** Your local aircraft.json endpoint (e.g., `http://192.168.1.120/skyaware/data/aircraft.json`)
   - **Poll Interval:** Update frequency in milliseconds (default: 2000ms)
4. Click **START** to begin tracking

### Data Integration

- ADS-B aircraft data is automatically integrated with ACARS messages
- Position updates are tracked with significant change detection
- Aircraft data includes: position, altitude, ground speed, heading, squawk code
- All data is stored in the same database with `source_type: 'adsb'` distinction

### Requirements

- Running TAR1090 instance on your local network
- Network accessibility to the TAR1090 web interface
- Aircraft.json endpoint must be accessible from the AirWave backend

## Admin Panel

The web-based admin panel provides runtime configuration without server restarts:

### Features

- **Service Status:** Real-time monitoring of Airframes.io, TAR1090, and Whisper connections
- **Airframes.io Settings:** API key, URLs, WebSocket configuration
- **TAR1090 Settings:** Enable/disable, URL, poll interval control
- **Whisper Settings:** Server URL, language, model selection
- **Audio Settings:** Sample rate, chunk duration, VAD thresholds
- **System Settings:** Database retention, logging level

### Access

Navigate to http://localhost:8501/admin or click the **ADMIN** button in the header.

All settings are persisted in the SQLite database and applied immediately without requiring a server restart.

## Data Storage

Messages are stored in SQLite database:
- **Location:** `backend/data/airwave.db`
- **Format:** Structured SQLite with JSON fields for complex data
- **Retention:** Configurable cleanup via admin panel (default: 7 days)
- **Features:** Full-text search, indexed queries, aggregated statistics
- **Settings:** Admin configurations stored in dedicated table

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

