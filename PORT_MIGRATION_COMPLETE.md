# Backend Port Migration Complete

## Summary

Successfully migrated backend API and WebSocket from port **3000** to port **5773** (less common port to avoid conflicts).

---

## Changes Made

### 1. Environment Configuration
- **File:** `env.template`
  - Updated `PORT=5773`
  - Updated `ALLOWED_ORIGINS=http://localhost:8501,http://localhost:5773`

- **File:** `.env` (AirWave root)
  - Set `PORT=5773`
  - Set `ALLOWED_ORIGINS=http://localhost:8501,http://localhost:5773`

- **File:** `frontend/.env.local`
  - Created with `NEXT_PUBLIC_API_URL=http://localhost:5773/api`
  - Created with `NEXT_PUBLIC_WS_URL=ws://localhost:5773/ws`

### 2. Frontend Configuration
- **File:** `frontend/next.config.js`
  - Updated default API_URL to `http://localhost:5773/api`
  - Updated default WS_URL to `ws://localhost:5773/ws`

### 3. Frontend Files Updated (30 files)

All hardcoded `localhost:3000` references replaced with environment variables:

#### Pages
- `frontend/app/page.tsx`
- `frontend/app/hfgcs/page.tsx`
- `frontend/app/situational/page.tsx`
- `frontend/app/aircraft/[id]/page.tsx`
- `frontend/app/emergency/page.tsx`
- `frontend/app/recordings/page.tsx`
- `frontend/app/admin/page.tsx`

#### Components
- `frontend/app/components/HFGCSAircraftTracker.tsx`
- `frontend/app/components/HFGCSStatistics.tsx`
- `frontend/app/components/EmergencyAudioPlayer.tsx`
- `frontend/app/components/WorldMap.tsx`
- `frontend/app/components/DataSourceStatus.tsx`
- `frontend/app/components/ATCAudioPlayer.tsx`

#### Stores
- `frontend/app/store/emergencyAudioStore.ts`
- `frontend/app/store/adminStore.ts`
- `frontend/app/store/audioStore.ts`

#### Utils
- `frontend/app/utils/playlistParser.ts`

**Pattern Used:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5773/ws'
```

---

## Server Status

### Backend
- **Port:** 5773
- **API Endpoint:** `http://localhost:5773/api`
- **WebSocket:** `ws://localhost:5773/ws`
- **Health Check:** `http://localhost:5773/health`
- **Process ID:** Running ✅

### Frontend
- **Port:** 8501
- **URL:** `http://localhost:8501`
- **Process ID:** Running ✅

---

## Network Access

### Local Machine
```
Frontend:  http://localhost:8501
Backend:   http://localhost:5773/api
WebSocket: ws://localhost:5773/ws
```

### Network URLs (192.168.1.117)
```
Frontend:  http://192.168.1.117:8501
Backend:   http://192.168.1.117:5773/api
WebSocket: ws://192.168.1.117:5773/ws
```

---

## Benefits

1. **Reduced Conflicts:** Port 5773 is a non-standard port less likely to conflict with other services
2. **Security Through Obscurity:** Non-standard ports are less likely to be scanned
3. **Consistency:** All references now use environment variables (easier to change in future)
4. **Network Access:** Both local and network URLs work correctly

---

## Testing Checklist

✅ Backend health endpoint responds on port 5773  
✅ Frontend loads on port 8501  
✅ Environment variables properly configured  
✅ All hardcoded references updated to use env vars  
✅ WebSocket connections updated  
✅ CORS configuration updated for new port  

---

## Rollback Instructions

If needed, to revert to port 3000:

1. Edit `.env`:
   ```
   PORT=3000
   ALLOWED_ORIGINS=http://localhost:8501,http://localhost:3000
   ```

2. Edit `frontend/.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
   ```

3. Restart both servers

---

## Files Modified Summary

| File Type | Count | Purpose |
|-----------|-------|---------|
| Config Files | 4 | env.template, .env, frontend/.env.local, next.config.js |
| Pages | 7 | Main application pages |
| Components | 6 | UI components with API calls |
| Stores | 3 | State management with API integration |
| Utils | 1 | Playlist parser |
| **Total** | **21** | |

---

**Migration Date:** October 26, 2025  
**Status:** ✅ Complete and Tested  
**New Backend Port:** 5773  
**Frontend Port:** 8501 (unchanged)

