# AirWave Broadcast Overlay Guide

## Quick Access

The broadcast system is now accessible from the main UI header:

- **BROADCAST** button (cyan TV icon) - Main broadcast overlay system
- **EGPK** button (blue map pin icon) - EGPK Ground Operations View

Direct links:
- Broadcast: `http://localhost:8501/broadcast`
- EGPK Ground: `http://localhost:8501/egpk-ground`

---

## URL Parameters

Control the broadcast page using URL parameters:

### Mode Selection

```bash
# Global Overview (default)
http://localhost:8501/broadcast

# Airport Focus - Monitor specific airport
http://localhost:8501/broadcast?mode=airport_focus&airport=EGPK

# Military Watch - Track military aircraft & EAMs
http://localhost:8501/broadcast?mode=military_watch

# EAM Alert - Auto-triggered on EAM detection
http://localhost:8501/broadcast?mode=eam_alert
```

### Other Parameters

```bash
# Transparent background (for OBS overlay)
?transparent=true

# Custom airport code (with airport_focus mode)
?airport=KJFK

# Custom region (with military_watch mode)
?region=conus

# Combine parameters
http://localhost:8501/broadcast?mode=military_watch&transparent=true
```

---

## Configuration

### Admin Panel (Recommended)

1. Go to **Admin** → **Broadcast** tab
2. Configure settings for each mode:
   - **Airport Focus**: Default airport, radius, runway display
   - **Military Watch**: Focus region, aircraft types, EAM auto-switch
   - **Global Overview**: Heatmap, clustering, max aircraft
   - **EAM Alert**: Auto-return, delay, sound alerts

### API Configuration

```bash
# Get current config
curl http://localhost:3001/api/admin/broadcast/config

# Update config
curl -X PUT http://localhost:3001/api/admin/broadcast/config \
  -H "Content-Type: application/json" \
  -d '{
    "modes": {
      "airport_focus": {
        "defaultAirport": "KJFK",
        "radius": 75
      }
    }
  }'

# Reset to defaults
curl -X POST http://localhost:3001/api/admin/broadcast/reset
```

---

## EGPK Ground Operations View

A dedicated view for Glasgow Prestwick International Airport (EGPK) featuring:

### Features

- **Satellite Imagery**: High-resolution aerial view of the airport
- **Runway Display**: Both runways (13/31 and 03/21) with centerlines
- **Taxiway Network**: Yellow highlighted taxiways (TWY A, B)
- **Parking Stands**: 12 terminal and remote stands with real-time occupancy
- **Ground Aircraft**: Red markers showing aircraft on ground with heading
- **Airborne Traffic**: Green markers for aircraft within 10nm
- **Terminal Area**: Highlighted terminal building zone
- **Real-time Stats**: Live count of ground/airborne traffic and stand availability

### Access

Direct link: `http://localhost:8501/egpk-ground`

Or click **EGPK** button in main header (blue map pin icon)

### Map Legend

- **White thick lines**: Runways with yellow dashed centerlines
- **Yellow lines**: Taxiways
- **Green circles**: Available parking stands
- **Red circles**: Occupied parking stands
- **Red aircraft icons**: Aircraft on ground
- **Green aircraft icons**: Airborne aircraft nearby
- **Cyan circle**: Airport reference point

### Use Cases

- **Ground Operations**: Monitor aircraft movements on the ground
- **Stand Management**: Track parking stand occupancy
- **Training**: Learn airport layout and procedures
- **Streaming**: Professional ground control view for broadcasts
- **Local Aviation**: Monitor EGPK traffic in detail

---

## Viewing Modes

### 1. **Global Overview**
- Worldwide aircraft tracking
- Regional statistics
- Data source status indicators
- Real-time message throughput

**Best for:** General monitoring, stream intro/outro

### 2. **Airport Focus**
- Monitor specific airports (EGPK, KJFK, EGLL, etc.)
- Arrivals/departures within radius
- Traffic statistics
- Optional runway visualization

**Best for:** Local aviation events, airport-specific content

### 3. **Military Watch**
- Track US military aircraft (TACAMO, Nightwatch, tankers)
- HFGCS activity monitoring
- Real-time EAM alert integration
- Mission duration tracking

**Best for:** Military aviation enthusiasts, HFGCS streaming

### 4. **EAM Alert**
- Full-screen Emergency Action Message display
- Automatic scene switch on EAM detection
- Auto-return to previous mode after delay
- Audio alert support

**Best for:** Critical alerts during military watch streams

---

## OBS Setup

### Browser Source Configuration

1. **Add Browser Source** in OBS
2. **URL:** `http://localhost:8501/broadcast?mode=military_watch&transparent=true`
3. **Width:** 1920
4. **Height:** 1080
5. **FPS:** 30
6. **Custom CSS:** (optional)
   ```css
   body { background-color: rgba(0,0,0,0); margin: 0px auto; overflow: hidden; }
   ```
7. **Enable:**
   - ✅ Shutdown source when not visible
   - ✅ Refresh browser when scene becomes active

### Scene Switching

Create different OBS scenes for each mode:

**Scene: Military Watch**
- URL: `?mode=military_watch&transparent=true`

**Scene: Airport Focus - JFK**
- URL: `?mode=airport_focus&airport=KJFK&transparent=true`

**Scene: Global View**
- URL: `?mode=global_overview&transparent=true`

Switch between scenes using OBS hotkeys or Stream Deck.

---

## Layout Control

### Header Display
- **Show:** Full branding, mode indicator, time, data sources
- **Hide:** Set `config.layout.showHeader = false` in admin panel

### Info Panel
- **Show:** Statistics, narrative, mode-specific data
- **Hide:** Set `config.layout.showInfoPanel = false`

### Ticker Bar
- **Show:** Scrolling real-time events
- **Hide:** Set `config.layout.showTicker = false`

### Transparent Background
- **Enable:** Add `?transparent=true` to URL
- **Disable:** Remove parameter (default)

---

## Narrative System

The broadcast page includes automatic narrative generation:

- Updates every 15 seconds (configurable)
- Context-aware based on current mode
- Uses real-time data from stores
- Templates rotate for variety

**Enable/Disable:** Admin Panel → Broadcast → Narrative Settings

---

## Troubleshooting

### Page keeps refreshing
✅ **Fixed!** - Now uses correct backend port (3001) and no retry loops

### WebSocket not connecting
- Check backend is running: `http://localhost:3001/health`
- Verify WS_URL in `.env`: `NEXT_PUBLIC_WS_URL=ws://localhost:3001`

### API 404 errors
- Backend server must be running on port 3001
- Frontend is on port 8501 (Streamlit)
- All API calls now correctly route to backend

### No aircraft showing
- Wait for WebSocket data to arrive
- Check backend logs for data ingestion
- Verify data sources in Admin panel

### OBS not transparent
- Add `?transparent=true` to URL
- Check OBS custom CSS is applied
- Ensure "Shutdown source when not visible" is enabled

---

## Examples

### YouTube Live Stream Overlay
```
http://localhost:8501/broadcast?mode=military_watch&transparent=true
```

### Airport Traffic Monitor
```
http://localhost:8501/broadcast?mode=airport_focus&airport=EGLL
```

### Full-screen Display (No transparency)
```
http://localhost:8501/broadcast?mode=global_overview
```

### Multiple Monitor Setup
- **Monitor 1:** Main AirWave UI (`http://localhost:8501`)
- **Monitor 2:** Broadcast Overlay (`http://localhost:8501/broadcast?mode=military_watch`)
- **OBS:** Browser source with transparent overlay

---

## Quick Commands

```bash
# Start backend (required)
cd AirWave/backend
node server.js

# Start frontend (required)
cd AirWave/frontend
npm run dev

# Access broadcast
open http://localhost:8501/broadcast

# Test configuration
curl http://localhost:3001/api/admin/broadcast/config
```

---

## Tips

1. **Use transparent mode** for OBS overlays
2. **Bookmark different modes** with specific URLs
3. **Configure in Admin** before going live
4. **Test WebSocket** connection first
5. **Monitor backend logs** for data flow
6. **Use query params** for quick mode switching
7. **Set up OBS scenes** for each broadcast mode
8. **Enable auto-return** for EAM alerts to resume previous mode

---

## Support

For issues or questions:
- Check backend console: `AirWave/backend/server.js`
- Check frontend console: Browser DevTools
- Review API docs: `AirWave/API.md`
- See main README: `AirWave/README.md`

