# Aircraft Tracking - Mission Control View

## Quick Access

Click **TRACK** button in the header (green crosshair icon) or visit: `http://localhost:8501/track`

---

## Features

### SpaceX-Themed Interface

Exactly like the SPAR78 layout you showed:

- **Dark space theme** (`#0a0e1a` background)
- **Cyan accent colors** for primary UI elements
- **Green telemetry displays** for live data
- **Glowing aircraft marker** on map
- **Flight path visualization** with historical trail
- **Altitude profile graph** at bottom
- **Professional mission control aesthetic**

### UI Components

#### Top Left - Aircraft Info Card
- Large callsign display (SPAR78 style)
- Registration and hex code
- Flight status indicator
- Current flight level (FL205 format)
- Stats grid: Altitude, Ground Speed, Positions

#### Top Right - Live Telemetry
- Real-time altitude (in feet)
- Current speed (in knots)
- Heading (in degrees)
- Animated pulse indicator

#### Bottom Left - Position Info
- Precise GPS coordinates
- UTC timestamp
- Dark card with cyan accents

#### Bottom Right - Branding
- AIRWAVE logo
- "Mission Control" subtitle

#### Bottom - Altitude Profile
- Full-width graph showing flight path altitude
- MIN/MAX/AVG flight level statistics
- Gradient-filled area chart
- Cyan color scheme

### Map Display

- **Dark Carto basemap** (matching SpaceX aesthetic)
- **Flight path trail** in cyan
- **Historical positions** as cyan dots
- **Current position** as glowing green marker
- **Smooth path line** connecting all positions
- **Auto-centering** on aircraft

---

## Usage

### Track Specific Aircraft

**By Hex Code:**
```
http://localhost:8501/track?hex=AE01C5
```

**By Flight Number:**
```
http://localhost:8501/track?flight=SPAR78
```

**By Tail Number:**
```
```
http://localhost:8501/track?flight=01-0029
```

### Aircraft Selection

1. Visit `/track` without parameters
2. See list of available aircraft
3. Click any aircraft to track it
4. Shows first 20 aircraft with:
   - Flight number/callsign
   - Hex code
   - Current flight level

### Real-time Updates

- **WebSocket connection** provides live data
- **Position history** updated automatically
- **Flight path** extends as aircraft moves
- **Altitude graph** grows with new data
- **Stats** recalculate in real-time

---

## Data Displayed

### Aircraft Info
- **Callsign/Flight**: e.g., SPAR78
- **Hex Code**: ICAO 24-bit address
- **Registration**: Aircraft tail number
- **Type**: Aircraft model (if available)

### Position Data
- **Latitude/Longitude**: GPS coordinates
- **Altitude**: In feet and flight level
- **Ground Speed**: In knots
- **Track/Heading**: In degrees
- **Timestamp**: UTC time

### Historical Data
- **Flight Path**: Last 100 positions
- **Altitude Profile**: Full altitude history
- **Statistics**:
  - Minimum flight level
  - Maximum flight level
  - Average flight level
  - Total positions tracked

---

## For Broadcasting/OBS

### Full Screen View

Perfect for streaming/recording:

```
http://localhost:8501/track?hex=AE01C5
```

**OBS Browser Source Settings:**
- Width: 1920
- Height: 1080
- FPS: 30
- Custom CSS: (none needed - already themed)

### URL Parameters for OBS Scenes

Set up different OBS scenes for different aircraft:

**Scene 1: Military Tanker**
```
URL: http://localhost:8501/track?flight=RCH425
```

**Scene 2: VIP Transport**
```
URL: http://localhost:8501/track?hex=AE01C5
```

**Scene 3: Auto-select Latest**
```
URL: http://localhost:8501/track
(Shows aircraft list - click one)
```

---

## Styling Details

### Colors Used

- **Background**: `#0a0e1a` (deep space blue)
- **Primary Accent**: `#00d9ff` (cyan)
- **Secondary Accent**: `#00ff88` (green)
- **Cards**: `#0a1628` with 95% opacity
- **Borders**: Cyan/Green at 50% opacity
- **Text**:
  - Primary: White
  - Secondary: Gray 400
  - Accents: Cyan 400, Green 400

### Typography

- **Headers**: Bold, uppercase tracking
- **Data**: Tabular numbers for alignment
- **Mono**: Used for technical data
- **Sizes**: 
  - Callsign: 3xl (30px)
  - Flight Level: 4xl (36px)
  - Telemetry: xl (20px)

### Effects

- **Backdrop blur**: On all cards
- **Pulse animation**: On "Live" indicators
- **Glow effect**: On current aircraft marker
- **Smooth gradients**: On altitude profile

---

## Integration with Main UI

### Header Button

Click **TRACK** in the main header (green crosshair icon)

### Quick Track Buttons ✨ NEW

**ADS-B Feed:**
- Small green crosshair button on each aircraft card (top-right corner)
- Click to instantly track that aircraft

**ACARS Feed:**
- Small green crosshair button next to timestamp
- Click to track the aircraft sending the message

### From Main Map

Right-click any aircraft → "Track Aircraft" (coming soon)

### From HFGCS Page

Click military aircraft to track them (coming soon)

---

## Examples

### Track Military Aircraft

```bash
# SPAR78 - Executive transport
http://localhost:8501/track?flight=SPAR78

# RCH - Reach callsign (military)
http://localhost:8501/track?flight=RCH425

# Any USAF aircraft
http://localhost:8501/track?hex=AE01C5
```

### Track Commercial Aircraft

```bash
# By flight number
http://localhost:8501/track?flight=UAL123

# By tail number
http://localhost:8501/track?flight=N12345
```

### Track by Hex Code

```bash
# More reliable than callsigns
http://localhost:8501/track?hex=A12345
```

---

## Keyboard Shortcuts (Coming Soon)

- `Space` - Pause/Resume tracking
- `R` - Reset view/center on aircraft
- `F` - Toggle fullscreen
- `H` - Toggle UI panels
- `Esc` - Return to aircraft list

---

## Tips & Tricks

### Best Aircraft to Track

1. **Military**: SPAR, RCH, EVAC, CONVOY
2. **VIP**: Air Force One, NASA, Government
3. **Long flights**: Better altitude profiles
4. **Active aircraft**: More position updates

### For Best Results

- Let aircraft build history (10+ minutes)
- Track aircraft in flight (not on ground)
- Use hex codes for reliability
- Keep WebSocket connected

### Performance

- **Smooth** at 100 positions
- **Very smooth** at 50 positions
- Automatically limits to last 100

---

## Troubleshooting

### Aircraft Not Found

**Problem**: "Searching for..." message doesn't resolve

**Solutions**:
1. Check aircraft is in range of data sources
2. Verify hex code or callsign is correct
3. Aircraft may have landed
4. Backend WebSocket not connected

### No Flight Path

**Problem**: Map shows but no trail

**Solutions**:
1. Aircraft just appeared (needs time to build history)
2. Position data not available
3. Aircraft on ground (no positions logged)

### Altitude Profile Empty

**Problem**: Graph shows but no data

**Solutions**:
1. Wait for more position updates
2. Aircraft on ground (altitude = 0)
3. Altitude data not in feed

---

## API Endpoints Used

```bash
# Initial aircraft data
GET http://localhost:3001/api/messages?limit=500

# WebSocket for real-time updates
WS ws://localhost:3001
```

---

## File Locations

```
AirWave/frontend/app/
├── track/
│   └── page.tsx                     # Main tracking page
├── broadcast/scenes/
│   └── AircraftTrackingScene.tsx   # Visual component
└── components/
    └── Header.tsx                   # Added TRACK button
```

---

## Future Enhancements

- [ ] Click aircraft on map to track
- [ ] Multiple aircraft comparison view
- [ ] Playback/time-travel mode
- [ ] Export flight path as KML
- [ ] Share tracking link
- [ ] Notifications on altitude changes
- [ ] Predicted path overlay
- [ ] Wind data overlay
- [ ] Airport approach visualization
- [ ] 3D terrain view

---

## Quick Start

```bash
# 1. Start backend
cd AirWave/backend
node server.js

# 2. Start frontend  
cd AirWave/frontend
npm run dev

# 3. Open tracking page
open http://localhost:8501/track

# 4. Select an aircraft or add ?hex=HEXCODE
open http://localhost:8501/track?flight=SPAR78
```

---

## Support

This matches the exact layout you showed in the SPAR78 screenshot with:
- ✅ Dark space theme
- ✅ Cyan flight path
- ✅ Live telemetry panel
- ✅ Position display
- ✅ Altitude profile graph
- ✅ Mission control branding
- ✅ Professional aesthetic

Enjoy your broadcast-ready aircraft tracking! 🚀✈️

