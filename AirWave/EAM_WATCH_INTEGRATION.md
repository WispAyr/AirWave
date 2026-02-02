# EAM.watch API Integration

## Overview

AirWave now integrates with the **EAM.watch API** to receive real-time Emergency Action Messages (EAMs) and Skyking broadcasts from High Frequency Global Communications System (HFGCS) stations.

## Configuration

### API Token

Your EAM.watch API token has been securely stored in the `.env` file:

```bash
EAM_WATCH_API_TOKEN=<your_token_here>
EAM_WATCH_BASE_URL=https://api.eam.watch
```

**⚠️ IMPORTANT**: The `.env` file is gitignored and should never be committed to version control.

### Data Source Configuration

The EAM.watch data source is configured in `backend/config/data-sources.json`:

```json
{
  "eam_watch": {
    "enabled": true,
    "name": "EAM.watch",
    "type": "eam",
    "description": "Emergency Action Messages from EAM.watch API",
    "requires_api_key": true,
    "status": "active",
    "data_types": ["eam", "skyking", "hfgcs"],
    "config": {
      "api_token": "",
      "base_url": "https://api.eam.watch",
      "poll_interval": 60000
    }
  }
}
```

## How It Works

### Message Flow

1. **Polling**: The EAM.watch source polls the API every 60 seconds for new messages
2. **Processing**: Messages are normalized to AirWave format and processed
3. **Storage**: EAM messages are saved to the `eam_messages` database table
4. **Broadcasting**: Messages are broadcast to connected WebSocket clients in real-time

### Message Types

The integration handles three types of messages:

- **EAM (Emergency Action Messages)**: Coded emergency messages with headers and message bodies
- **SKYKING**: Special alert broadcasts with codewords, time codes, and authentication
- **HFGCS**: General High Frequency Global Communications System traffic

### Data Source Implementation

Location: `backend/sources/eam-watch.js`

Key features:
- Automatic polling with configurable interval
- Pagination support (only fetches new messages)
- Rate limiting and error handling
- Message normalization to AirWave format
- WebSocket broadcasting integration

## Database Schema

EAM messages are stored in the `eam_messages` table with the following structure:

```sql
CREATE TABLE eam_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_type TEXT NOT NULL,       -- 'EAM' or 'SKYKING'
  header TEXT,                      -- 6-character EAM header
  message_body TEXT NOT NULL,       -- Message content
  message_length INTEGER,           -- Declared message length
  confidence_score INTEGER,         -- Confidence (0-100)
  repeat_count INTEGER DEFAULT 1,   -- Number of times repeated
  first_detected TEXT NOT NULL,     -- First detection timestamp
  last_detected TEXT NOT NULL,      -- Last detection timestamp
  recording_ids TEXT,               -- NULL for API messages
  raw_transcription TEXT,           -- Original message text
  codeword TEXT,                    -- SKYKING codeword
  time_code TEXT,                   -- SKYKING time
  authentication TEXT,              -- SKYKING authentication
  multi_segment BOOLEAN DEFAULT 0,  -- Multi-segment detection
  segment_count INTEGER DEFAULT 1,  -- Number of segments
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Get EAM Messages
```bash
GET /api/eam
Query params:
  - type: Filter by message type (EAM/SKYKING)
  - minConfidence: Minimum confidence score
  - limit: Number of messages to return
  - offset: Pagination offset
```

### Get Specific EAM
```bash
GET /api/eam/:id
```

### Search EAMs
```bash
GET /api/eam/search?q=<query>
```

### Get EAM Statistics
```bash
GET /api/eam/statistics
```

## WebSocket Events

EAM messages are broadcast to all connected clients via WebSocket:

```javascript
// EAM detected
{
  "type": "eam_detected",
  "data": {
    "message_type": "EAM",
    "header": "ABC123",
    "message_body": "...",
    "confidence_score": 95,
    "timestamp": "2025-10-26T12:00:00.000Z"
  }
}

// SKYKING detected
{
  "type": "skyking_detected",
  "data": {
    "message_type": "SKYKING",
    "codeword": "ALPHA",
    "time_code": "45",
    "authentication": "XY",
    "timestamp": "2025-10-26T12:00:00.000Z"
  }
}
```

## Testing the Integration

### Test API Connection

The EAM.watch source includes a connection test method:

```javascript
const eamWatch = new EAMWatchSource({
  api_token: process.env.EAM_WATCH_API_TOKEN
});

await eamWatch.testConnection();
```

### Monitor Logs

When the backend starts, you should see:

```
🚀 Starting EAM.watch source...
📡 Data sources started
```

When messages are received:

```
📡 EAM.watch: Received 3 messages
📨 EAM.watch: EAM - ABC123
📨 EAM.watch: SKYKING - BRAVO
```

## Troubleshooting

### No API Token Error

```
❌ EAM.watch: No API token configured
```

**Solution**: Ensure `EAM_WATCH_API_TOKEN` is set in your `.env` file.

### Invalid API Token

```
❌ EAM.watch API connection failed: Invalid API token
```

**Solution**: Verify your API token is correct and hasn't expired.

### Rate Limiting

```
❌ EAM.watch poll error: Rate limit exceeded
```

**Solution**: The poll interval is set to 60 seconds. This error indicates you may be polling too frequently. Increase `poll_interval` in the config.

## Security Notes

1. **Never commit** the `.env` file to git
2. **Rotate API tokens** regularly for security
3. **Use HTTPS** for all API communications (enforced by default)
4. **Rate limiting** is applied to prevent abuse
5. **Authentication** uses Bearer token authorization

## Future Enhancements

Potential improvements for the EAM.watch integration:

- [ ] WebSocket streaming instead of polling
- [ ] Message deduplication across sources (API + local detection)
- [ ] Enhanced filtering and alerting rules
- [ ] Historical message replay
- [ ] Message verification and crowdsourced corrections
- [ ] Integration with emergency notification systems

## Resources

- **EAM.watch API Documentation**: https://api.eam.watch/docs
- **HFGCS Background**: https://en.wikipedia.org/wiki/High_Frequency_Global_Communications_System
- **EAM Format Reference**: VE3IPS Blog - Emergency Action Messages
- **AirWave Documentation**: See `README.md` and other docs in the project root

## Support

For issues with the EAM.watch API integration:
1. Check the backend logs for error messages
2. Verify your API token is valid
3. Test the connection using the test method
4. Review the `eam_messages` database table for stored messages

For EAM.watch API issues, contact their support team.




