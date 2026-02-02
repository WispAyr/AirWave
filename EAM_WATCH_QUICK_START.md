# EAM.watch Quick Start Guide

## ✅ Setup Status: COMPLETE

Your EAM.watch API token has been securely integrated and is ready to use.

## 🚀 Quick Start

### Start the Backend
```bash
cd /Users/ewanrichardson/Development/airwave/AirWave
npm start
```

### Expected Log Output
```
📡 Starting enabled data sources...
═══════════════════════════════════════
🔌 Starting EAM.watch...
📡 Connecting to EAM.watch API...
✅ Data sources started
```

## 🔍 Verify It's Working

### 1. Check Logs
Look for messages like:
```
📡 EAM.watch: Received 2 messages
📨 EAM.watch: EAM - ABC123
📨 EAM.watch: SKYKING - BRAVO
```

### 2. Query the API
```bash
# Get all EAM messages
curl http://localhost:3000/api/eam | jq

# Get statistics
curl http://localhost:3000/api/eam/statistics | jq
```

### 3. Check Database
```bash
cd AirWave
sqlite3 backend/data/airwave.db "SELECT * FROM eam_messages LIMIT 5;"
```

### 4. Monitor WebSocket
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'eam_detected' || data.type === 'skyking_detected') {
    console.log('🚨 EAM Message:', data);
  }
};
```

## 📊 Data Flow

```
EAM.watch API (every 60s)
    ↓
EAM.watch Source
    ↓
Message Processor
    ↓
┌─────────────┬──────────────┐
│   Database  │  WebSocket   │
│ (eam_msgs)  │  (clients)   │
└─────────────┴──────────────┘
```

## 🔑 Configuration Files

| File | Purpose |
|------|---------|
| `.env` | **SECURE** - Contains your API token |
| `backend/sources/eam-watch.js` | Data source implementation |
| `backend/config/data-sources.json` | Source configuration |
| `EAM_WATCH_INTEGRATION.md` | Full documentation |

## 🎯 Key Features

- ✅ **Automatic Polling**: Fetches new messages every 60 seconds
- ✅ **Pagination**: Only fetches messages you haven't seen
- ✅ **Database Storage**: All messages saved to `eam_messages` table
- ✅ **Real-time Broadcasting**: WebSocket notifications to all clients
- ✅ **Error Handling**: Graceful failure with retry logic
- ✅ **Type Detection**: Automatically identifies EAM vs SKYKING messages

## ⚠️ Security Checklist

- ✅ Token stored in `.env` (gitignored)
- ✅ HTTPS enforced for API calls
- ✅ Bearer token authentication
- ⚠️ **DO NOT** commit `.env` to git
- ⚠️ **DO NOT** share your token

## 📱 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/eam` | Get all EAM messages (with filters) |
| `GET /api/eam/:id` | Get specific message by ID |
| `GET /api/eam/search?q=query` | Search messages |
| `GET /api/eam/statistics` | Get EAM statistics |

### Query Parameters
```
/api/eam?type=SKYKING&minConfidence=80&limit=20&offset=0
```

## 🛠️ Troubleshooting

### Problem: No messages appearing
**Solution**: 
1. Check `.env` has the correct token
2. Verify backend logs for errors
3. Ensure internet connectivity

### Problem: API token error
**Solution**:
```bash
# Verify token is in .env
grep EAM_WATCH_API_TOKEN AirWave/.env

# Token expires: October 25, 2026
# Request new token if needed
```

### Problem: Database errors
**Solution**:
```bash
# Check if table exists
sqlite3 backend/data/airwave.db ".schema eam_messages"

# Restart backend to re-run migrations
npm restart
```

## 📚 Documentation

- **Full Integration Guide**: `EAM_WATCH_INTEGRATION.md`
- **Setup Summary**: `EAM_WATCH_SETUP_COMPLETE.md`
- **This Guide**: `EAM_WATCH_QUICK_START.md`

## 🔄 Token Expiry

Your current token expires: **October 25, 2026**

To rotate the token:
1. Obtain new token from EAM.watch
2. Update `.env` file
3. Restart the backend

## 🎉 You're All Set!

The EAM.watch integration is production-ready. Just start the backend and you'll receive live Emergency Action Messages automatically.

For questions or issues, check the full documentation or backend logs.




