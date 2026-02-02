# Emergency Scanner Monitoring - Setup Guide

## Overview

The Emergency Scanner Monitoring feature provides real-time monitoring of police, fire, EMS, and multi-agency dispatch feeds across the United States. This feature integrates with the existing Whisper.cpp transcription pipeline to provide live audio streaming and AI-powered transcription of emergency scanner communications.

## Architecture

### Components

- **Backend Service**: `broadcastify-feeds-service.js` - Manages emergency scanner feeds
- **Feed Database**: `broadcastify-feeds.json` - JSON configuration of available feeds
- **API Endpoints**: `/api/emergency/*` - RESTful API for feed management and transcription
- **Database Tables**: `emergency_preferences` and `emergency_transcriptions` - SQLite storage
- **Frontend Components**: 
  - `EmergencyAudioPlayer.tsx` - Audio player with feed selection and transcription
  - `EmergencyMap.tsx` - Interactive map showing feed locations
  - `emergencyAudioStore.ts` - Zustand state management

### Data Flow

1. User selects state/county/agency type filters
2. Feed list populates from JSON database
3. User selects feed → Stream URL constructed
4. Audio playback begins via HTML5 audio element
5. (Optional) User starts transcription
6. Audio capture service streams to Whisper.cpp server
7. Transcriptions broadcast via WebSocket
8. Real-time updates displayed in UI and on map

## Prerequisites

### Required
- Whisper.cpp server running (same as ATC transcription)
- FFmpeg installed
- Node.js backend running on port 3000
- Next.js frontend running on port 8000

### Optional
- Broadcastify API key (for dynamic feed updates)

## Initial Setup

### 1. Feed Data Configuration

The emergency scanner feeds are defined in `backend/data/broadcastify-feeds.json`. This file contains 20 sample feeds covering major US cities.

**Feed Structure:**
```json
{
  "id": "sf_police",
  "name": "San Francisco Police",
  "description": "SFPD Main Dispatch - All Districts",
  "state": "California",
  "stateCode": "CA",
  "county": "San Francisco",
  "type": "police",
  "feedId": 4905,
  "listeners": 0,
  "status": "online",
  "coordinates": {
    "lat": 37.7749,
    "lon": -122.4194
  },
  "streamUrl": "https://broadcastify.cdnstream1.com/4905"
}
```

**Adding New Feeds:**

1. Visit [Broadcastify.com](https://www.broadcastify.com)
2. Find desired feed and note the feed ID (in URL)
3. Get dispatch center coordinates (use Google Maps)
4. Add entry to `broadcastify-feeds.json`:

```json
{
  "id": "unique_identifier",
  "name": "Agency Name",
  "description": "Coverage description",
  "state": "State Name",
  "stateCode": "XX",
  "county": "County Name",
  "type": "police|fire|ems|multi",
  "feedId": 12345,
  "listeners": 0,
  "status": "online",
  "coordinates": {
    "lat": 40.7128,
    "lon": -74.0060
  },
  "streamUrl": "https://broadcastify.cdnstream1.com/12345"
}
```

5. Restart backend server to load new feeds

### 2. Broadcastify API Integration (Optional)

For automatic feed discovery and updates:

**Step 1: Request API Access**
- Email: support@broadcastify.com
- Subject: "API Access Request"
- Include: Your use case, organization, and intended application

**Step 2: Configure API Key**
```bash
# Add to backend/.env or AirWave/.env
BROADCASTIFY_API_KEY=your_api_key_here
```

**Step 3: Use API Endpoints**
- States: `https://api.broadcastify.com/audio/?a=states&key=YOUR_KEY`
- Counties: `https://api.broadcastify.com/audio/?a=counties&state=STATE_ID&key=YOUR_KEY`
- Feeds: `https://api.broadcastify.com/audio/?a=feeds&county=COUNTY_ID&key=YOUR_KEY`

**Note:** The current implementation uses a static JSON file. API integration would require additional service methods to fetch and sync feed data.

### 3. Stream URL Patterns

Emergency scanner streams are accessed via Broadcastify's CDN:

**Direct CDN URL:**
```
https://broadcastify.cdnstream1.com/{feedId}
```

**PLS Playlist (Alternative):**
```
https://broadcastify.cdnstream1.com/playlist.pls?feedId={feedId}
```

The audio player will attempt the direct CDN URL first, falling back to playlist parsing if needed.

## Usage

### Accessing the Feature

1. Navigate to `http://localhost:8000/emergency` or click **EMERGENCY** in the header
2. The page displays:
   - Quick stats (total feeds by type)
   - Audio player with filters
   - Interactive map with feed locations

### Selecting and Playing Feeds

**Method 1: Via Audio Player**
1. Select state from dropdown
2. (Optional) Select county to narrow results
3. (Optional) Filter by agency type (Police/Fire/EMS/Multi)
4. Click on a feed in the list
5. Click **LISTEN** button to start playback
6. Adjust volume as needed

**Method 2: Via Map**
1. Use type filter toggles (🔵 Police, 🔴 Fire, etc.)
2. Click on a marker to see feed details
3. Click **LISTEN** button in popup
4. Audio player updates automatically

### Using Transcription

**Requirements:**
- Whisper.cpp server must be running
- Feed must be playing

**Steps:**
1. Start playing a feed
2. Click **🎤 START** button in transcription section
3. Transcriptions appear in real-time
4. Urgent keywords (emergency, officer down, etc.) highlighted in red
5. Click **⏹ STOP** to end transcription

**Features:**
- Real-time AI transcription
- Keyword highlighting for urgent terms
- Transcription history (last 20)
- Automatic timestamps
- WebSocket broadcasting

### Map Interaction

**Features:**
- Color-coded markers by agency type
- Selected feed highlighted with larger marker
- Active feeds (recently transcribed) show pulsing animation
- Filter feeds by type using toggle buttons
- Click markers to select and listen
- **FIT ALL** button to reset view

**Legend:**
- 🔵 Blue = Police
- 🔴 Red = Fire
- 🟢 Green = EMS
- 🟠 Orange = Multi-Agency
- Pulsing = Active (recent transmission)

## API Endpoints

All endpoints are prefixed with `http://localhost:3000/api/emergency`

### Feed Management

**GET /feeds**
- Returns all available feeds
- Response: `{ count: number, feeds: Feed[] }`

**GET /feeds/:id**
- Get specific feed by ID
- Response: `Feed` object or 404

**GET /states**
- List all states with feed counts
- Response: `{ count: number, states: State[] }`

**GET /feeds/state/:stateCode**
- Get feeds for specific state (e.g., CA, TX)
- Response: `{ count: number, stateCode: string, feeds: Feed[] }`

**GET /feeds/county/:county**
- Get feeds for specific county
- Response: `{ count: number, county: string, feeds: Feed[] }`

**GET /feeds/type/:type**
- Get feeds by type (police, fire, ems, multi)
- Response: `{ count: number, type: string, feeds: Feed[] }`

**GET /search?q=query**
- Search feeds by name, location, or description
- Response: `{ count: number, query: string, feeds: Feed[] }`

### Transcription

**POST /transcription/start/:feedId**
- Start transcription for feed
- Response: `{ success: boolean, feedId: string, message: string }`

**POST /transcription/stop/:feedId**
- Stop transcription for feed
- Response: `{ success: boolean, feedId: string, message: string }`

**GET /transcriptions/:feedId?limit=50**
- Get transcription history for feed
- Response: `{ count: number, transcriptions: Transcription[] }`

### Preferences

**GET /preferences**
- Get user preferences
- Response: `{ lastFeedId, volume, autoPlay, favoriteFeeds[] }`

**POST /preferences**
- Save user preferences
- Body: `{ lastFeedId?, volume?, autoPlay?, favoriteFeeds[]? }`
- Response: `{ success: boolean, preferences: object }`

**POST /preferences/favorites/:feedId**
- Add feed to favorites
- Response: `{ success: boolean, feedId: string }`

**DELETE /preferences/favorites/:feedId**
- Remove feed from favorites
- Response: `{ success: boolean, feedId: string }`

## Troubleshooting

### Stream Not Playing

**Symptoms:** Audio player shows "ERROR" or stream won't play

**Solutions:**
1. Check feed status - feed may be offline
2. Try different feed from same area
3. Check browser console for CORS errors
4. Verify stream URL is correct in JSON
5. Some feeds require playlist parsing - check network tab

### No Transcription

**Symptoms:** Transcription button disabled or not working

**Solutions:**
1. Verify Whisper server is running: `http://localhost:8080/health`
2. Check backend logs for Whisper connection errors
3. Ensure FFmpeg is installed and in PATH
4. Check audio capture service initialization
5. Verify WebSocket connection is active

### Map Not Loading

**Symptoms:** Map shows loading spinner or blank

**Solutions:**
1. Check coordinates in feed JSON (lat/lon must be valid)
2. Verify Leaflet CSS is loading
3. Check browser console for JavaScript errors
4. Clear browser cache and reload
5. Ensure react-leaflet packages are installed

### API Errors

**Symptoms:** "Database not available" or 500 errors

**Solutions:**
1. Verify backend server is running on port 3000
2. Check database tables are created (emergency_preferences, emergency_transcriptions)
3. Review backend console for initialization errors
4. Ensure broadcastify-feeds.json is valid JSON
5. Check file permissions on data directory

### Feeds Not Appearing

**Symptoms:** Empty feed list or "No feeds match your filters"

**Solutions:**
1. Check `broadcastify-feeds.json` exists and is valid
2. Verify backend loaded feeds (check console for "✅ Loaded X feeds")
3. Clear filters (set all dropdowns to "ALL")
4. Restart backend server
5. Check for JSON syntax errors

## Legal Notice

⚠️ **IMPORTANT LEGAL INFORMATION** ⚠️

### Scanner Monitoring Laws

Emergency scanner monitoring is **subject to local, state, and federal laws**:

- **Legal in most US states** for receive-only monitoring
- **Prohibited in some states** while operating a vehicle
- **Restricted in certain jurisdictions** (check local laws)
- **Federal restrictions** apply to encrypted communications

**States with Restrictions:**
- California: Illegal to monitor while committing a crime
- Florida: Illegal in vehicles (with exceptions for licensed amateurs)
- Indiana: Illegal to use scanner to aid in crime
- Kentucky: Illegal in vehicles
- Minnesota: Illegal to use scanner to aid in crime
- New York: Illegal in vehicles
- (Check your local laws for current regulations)

### Broadcastify Terms of Service

By using this feature, you agree to Broadcastify's terms:

- ✅ Personal monitoring and listening
- ✅ Educational and research purposes
- ❌ **Recording or archiving prohibited** without permission
- ❌ **Redistribution prohibited** (no rebroadcasting)
- ❌ **Commercial use prohibited** without license
- ❌ **Automated downloading prohibited**

**Stream Credits:** All scanner feeds provided by [Broadcastify.com](https://www.broadcastify.com)

### Ethical Use

This tool is intended for:
- Monitoring public safety communications
- Educational purposes
- Understanding emergency response
- Situational awareness

**Do NOT use for:**
- Interfering with emergency operations
- Criminal activity
- Harassment of emergency personnel
- Selling or profiting from scanner audio

### Liability

Users are solely responsible for compliance with applicable laws. The developers of this software:
- Make no warranties about feed availability or legality
- Are not responsible for user actions or legal violations
- Recommend consulting legal counsel for commercial use

## Future Enhancements

Planned features for future releases:

### Feed Discovery
- Automatic feed discovery via Broadcastify API
- Dynamic feed updates and status monitoring
- Feed reliability scoring
- Community feed ratings

### Advanced Transcription
- Automatic incident detection (keywords, urgency)
- Multi-feed monitoring (listen to multiple feeds)
- Call classification (traffic stop, fire call, EMS, etc.)
- Transcription export (CSV, JSON, PDF)
- Search transcription history

### Mapping Enhancements
- Dispatch call location mapping (if available via feed)
- Incident heatmap overlay
- Coverage radius visualization
- Historical incident tracking
- Route planning around incidents

### Alerts & Notifications
- Keyword-based alerts
- Email/SMS notifications for urgent calls
- Custom alert rules (by feed, type, keyword)
- Desktop notifications
- Mobile push notifications

### Analytics
- Feed activity graphs
- Peak call time analysis
- Agency response time tracking
- Incident type distribution
- Geographic hotspot analysis

### Integration
- Integration with ADS-B for air ambulance tracking
- Cross-reference with ACARS emergency messages
- Weather overlay for emergency conditions
- Traffic integration for incident mapping

## Support & Resources

### Documentation
- Broadcastify: https://www.broadcastify.com
- Whisper.cpp: https://github.com/ggml-org/whisper.cpp
- Leaflet: https://leafletjs.com

### Community
- Report issues: [GitHub Issues]
- Feature requests: [GitHub Discussions]
- Emergency scanner community: [RadioReference.com](https://www.radioreference.com)

### API Keys
- Broadcastify API: support@broadcastify.com
- No API key required for basic functionality

## Credits

- **Scanner Feeds:** [Broadcastify.com](https://www.broadcastify.com)
- **Transcription:** [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (Local AI)
- **Mapping:** [OpenStreetMap](https://www.openstreetmap.org) & [Leaflet](https://leafletjs.com)
- **Icons:** [Lucide React](https://lucide.dev)

## Version History

### v1.0.0 (Initial Release)
- 20 sample feeds covering major US cities
- Real-time audio streaming
- AI-powered transcription
- Interactive map with feed locations
- State/County/Type filtering
- Favorites management
- WebSocket broadcasting
- Keyword highlighting for urgent terms





