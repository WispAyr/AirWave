# EAM.watch Integration - Setup Complete ✅

## Summary

Your **EAM.watch API token** has been securely integrated into AirWave Mission Control. The system is now configured to receive real-time Emergency Action Messages (EAMs) and Skyking broadcasts from the HFGCS network.

## What Was Done

### 1. **Secure Token Storage** 🔒
- ✅ Created `.env` file from template
- ✅ Stored EAM.watch API token securely
- ✅ Added base URL configuration
- ✅ Updated `env.template` for future reference
- ⚠️ `.env` is gitignored and will NOT be committed

### 2. **Data Source Integration** 📡
- ✅ Created new `eam-watch.js` data source (`backend/sources/`)
- ✅ Registered with Data Source Manager
- ✅ Added to `data-sources.json` configuration
- ✅ Integrated with backend server initialization

### 3. **Message Processing** ⚙️
- ✅ Updated message processor to handle EAM messages
- ✅ Configured database storage to `eam_messages` table
- ✅ Added WebSocket broadcasting for real-time alerts
- ✅ Implemented validation skipping for EAM messages

### 4. **Configuration Management** 📋
- ✅ Added EAM.watch config to ConfigManager
- ✅ Environment variable support
- ✅ 60-second polling interval

### 5. **Documentation** 📚
- ✅ Created comprehensive `EAM_WATCH_INTEGRATION.md`
- ✅ API usage guide
- ✅ Troubleshooting section
- ✅ WebSocket event documentation

## File Changes

```
AirWave/
├── .env                                    [CREATED] - Secure token storage
├── env.template                            [UPDATED] - Added EAM.watch vars
├── EAM_WATCH_INTEGRATION.md               [CREATED] - Integration docs
├── backend/
│   ├── server.js                          [UPDATED] - Registered source
│   ├── sources/
│   │   └── eam-watch.js                   [CREATED] - Data source impl
│   ├── services/
│   │   ├── config-manager.js              [UPDATED] - Added config
│   │   └── message-processor.js           [UPDATED] - EAM handling
│   └── config/
│       └── data-sources.json              [UPDATED] - Source config
```

## How to Start

The EAM.watch integration will automatically start when you launch the backend:

```bash
cd AirWave
npm start
```

You should see in the logs:
```
🚀 Starting EAM.watch source...
📡 Data sources started
```

## API Token Details

- **Token**: Securely stored in `.env`
- **Endpoint**: `https://api.eam.watch`
- **Poll Interval**: 60 seconds
- **Expires**: October 25, 2026 (based on JWT expiry)

## Features

### Real-Time Message Reception
- Polls EAM.watch API every 60 seconds
- Fetches only new messages (pagination support)
- Automatic deduplication

### Message Types Supported
- **EAM**: Emergency Action Messages with headers and coded bodies
- **SKYKING**: Alert broadcasts with codewords and authentication
- **HFGCS**: General high-frequency military communications

### Database Storage
All messages are stored in the `eam_messages` table with:
- Message type, header, body
- Confidence scores
- Timestamps (first/last detected)
- Metadata (station, frequency, etc.)

### WebSocket Broadcasting
Connected clients receive real-time notifications:
- `eam_detected` - New EAM message
- `skyking_detected` - New Skyking broadcast
- `eam_repeat_detected` - Repeated message

## Testing

### 1. Test API Connection
The integration includes a test method. Check backend logs on startup.

### 2. Monitor WebSocket
Connect to `ws://localhost:3000/ws` and watch for EAM events.

### 3. Check Database
```bash
sqlite3 backend/data/airwave.db "SELECT * FROM eam_messages ORDER BY created_at DESC LIMIT 10;"
```

### 4. Use API Endpoints
```bash
# Get all EAM messages
curl http://localhost:3000/api/eam

# Get statistics
curl http://localhost:3000/api/eam/statistics

# Search messages
curl "http://localhost:3000/api/eam/search?q=SKYKING"
```

## Security Reminders

1. ✅ **Token is secured** in `.env` (gitignored)
2. ⚠️ **Never commit** the `.env` file
3. 🔄 **Rotate tokens** periodically for security
4. 🔒 **HTTPS only** for API communication

## Next Steps

### Optional Enhancements
- [ ] Add frontend UI for viewing EAM messages
- [ ] Configure alerts for specific message types
- [ ] Set up message filtering rules
- [ ] Enable audio notifications for critical messages
- [ ] Add export functionality for analysis

### Frontend Integration
The existing EAM UI components in the frontend will automatically receive and display messages from the EAM.watch API:
- `frontend/app/emergency/page.tsx` - Emergency monitoring page
- WebSocket integration already in place

## Troubleshooting

### Common Issues

**No messages appearing:**
1. Check `.env` has correct token
2. Verify backend logs for connection errors
3. Ensure `eam_watch` is enabled in `data-sources.json`

**API errors:**
- Check token hasn't expired
- Verify network connectivity
- Review rate limiting (60s interval should be safe)

**Database errors:**
- Ensure `eam_messages` table exists (auto-created on startup)
- Check database permissions

## Documentation

For detailed information, see:
- `AirWave/EAM_WATCH_INTEGRATION.md` - Complete integration guide
- `AirWave/README.md` - Main project documentation
- `AirWave/API.md` - API endpoint reference

## Support

The EAM.watch integration is production-ready and will:
- ✅ Auto-start with the backend
- ✅ Handle errors gracefully
- ✅ Retry on connection failures
- ✅ Store messages persistently
- ✅ Broadcast to all connected clients

---

**Status**: ✅ READY TO RUN

Your AirWave system is now configured to receive live Emergency Action Messages from the EAM.watch API!




