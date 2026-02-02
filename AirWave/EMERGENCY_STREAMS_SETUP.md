# Emergency Scanner Streams - Quick Setup

## Problem
The sample feeds in `broadcastify-feeds.json` use placeholder feed IDs that don't work. You need **real** Broadcastify feed IDs.

## Solution: Get Real Working Feeds

### Method 1: Manual Feed Discovery (Recommended)

1. **Visit Broadcastify:**
   - Go to https://www.broadcastify.com/listen/
   - Browse by state → county
   - Find feeds you want to monitor

2. **Get Feed Details:**
   - Click on a feed
   - Note the URL: `https://www.broadcastify.com/listen/feed/12345`
   - The number (12345) is your feed ID
   - Click "Listen" and check browser network tab for the actual stream URL

3. **Find Coordinates:**
   - Google the dispatch center location
   - Get lat/lon coordinates (use Google Maps)

4. **Update broadcastify-feeds.json:**

```json
{
  "id": "la_lapd_metro",
  "name": "LAPD Metro Division",
  "description": "Los Angeles Police - Metropolitan Division",
  "state": "California",
  "stateCode": "CA",
  "county": "Los Angeles",
  "type": "police",
  "feedId": 20003,  // REAL feed ID from Broadcastify
  "listeners": 0,
  "status": "online",
  "coordinates": {
    "lat": 34.0522,
    "lon": -118.2437
  },
  "streamUrl": "https://broadcastify.cdnstream1.com/20003"
}
```

### Method 2: Alternative Free Streams

If Broadcastify doesn't work, try these alternatives:

**OpenMHz** (Texas only):
- URL: https://openmhz.com/
- Free, no API key needed
- Stream format: Check their API docs

**Broadcastify Archive** (Premium):
- May require Broadcastify Premium subscription
- Better reliability
- More feeds available

### Method 3: Test Streams

Here are some PUBLIC test streams you can use right now:

```json
[
  {
    "id": "test_stream_1",
    "name": "Test Emergency Feed",
    "description": "Test stream for development",
    "state": "Test",
    "stateCode": "TS",
    "county": "Test County",
    "type": "multi",
    "feedId": 0,
    "listeners": 0,
    "status": "online",
    "coordinates": {
      "lat": 39.8283,
      "lon": -98.5795
    },
    "streamUrl": "http://stream.live.vc.bbcmedia.co.uk/bbc_world_service"
  }
]
```

## Quick Fix: Use BBC World Service as Test

Replace one feed in `broadcastify-feeds.json` with this working stream:

```json
{
  "id": "test_bbc",
  "name": "Test Audio Stream (BBC)",
  "description": "BBC World Service - Test Stream",
  "state": "Test",
  "stateCode": "TS",
  "county": "Test",
  "type": "multi",
  "feedId": 0,
  "listeners": 0,
  "status": "online",
  "coordinates": {
    "lat": 51.5074,
    "lon": -0.1278
  },
  "streamUrl": "http://stream.live.vc.bbcmedia.co.uk/bbc_world_service"
}
```

Then restart the backend and test!

## Troubleshooting

### Stream Won't Play

1. **CORS Issues:**
   - Some streams block cross-origin requests
   - You may need a proxy

2. **Authentication Required:**
   - Broadcastify may require login/session
   - Consider using Broadcastify API (requires API key)

3. **Stream Format:**
   - Ensure it's a direct audio stream (MP3, AAC, etc.)
   - Not all feeds support direct streaming

### How to Test a Stream URL

```bash
# Test with curl
curl -I "STREAM_URL_HERE"

# Should return HTTP 200 and Content-Type: audio/...

# Test playback
ffplay "STREAM_URL_HERE"
```

## Getting Broadcastify API Access

For production use, get an API key:

1. **Email:** support@broadcastify.com
2. **Subject:** "API Access Request"
3. **Include:**
   - Your use case
   - Organization (if any)
   - Intended application

With API access, you can:
- Get live feed lists
- Check feed status
- Get real stream URLs
- Monitor feed availability

## Next Steps

1. Replace at least one feed with a working test stream
2. Restart backend: `cd AirWave/backend && npm start`
3. Test in browser: http://localhost:8501/emergency
4. If working, gradually add more real feeds





