# 🚀 AIRWAVE Quick Start Guide

Get up and running in 60 seconds!

## Prerequisites
- Node.js 18+ installed
- Terminal access
- Airframes.io API key ([Get one free](https://app.airframes.io))

## Installation & Launch

```bash
# 1. Clone repository
git clone https://github.com/yourusername/airwave.git
cd airwave

# 2. Install dependencies
npm install
cd frontend && npm install && cd ..

# 3. Setup environment
cp .env.template .env
# Edit .env and add your API key from https://app.airframes.io

# 4. Start everything (one command)
npm run dev
```

That's it! The application will:
- Kill any processes on ports 3000, 3001, 8501
- Start backend server on port 3000
- Start frontend on port 8501
- Connect WebSocket for real-time data

## Access the Application

Open your browser to:
### 🎯 **http://localhost:8501**

You should see:
- SpaceX-themed mission control dashboard
- Live ACARS message feed (updates every 5 seconds)
- Real-time statistics
- Active flight tracker
- Message type charts

## What You'll See

1. **Header** - Connection status, system health, UTC time
2. **Statistics Cards** - Total messages, top category, top airline
3. **Live Feed** - Scrolling ACARS messages with syntax highlighting
4. **Charts** - Message type distribution
5. **Flight Tracker** - Active flights list
6. **World Map** - Global coverage visualization (placeholder)

## Alternative: Run Separately

### Backend Only
```bash
npm run server
# Access: http://localhost:3000
# WebSocket: ws://localhost:3000/ws
```

### Frontend Only
```bash
cd frontend && npm run dev
# Access: http://localhost:8501
```

## Test the API

```bash
# Health check
curl http://localhost:3000/health

# List schemas
curl http://localhost:3000/api/schemas | jq

# Get reference data
curl http://localhost:3000/api/reference/aviation_units
```

## Sample Messages

You'll see realistic ACARS messages like:

```
✈ UAL123 [UAL]
POS N3745W12230,281234,350,KSFO,KJFK
CATEGORY: position | CRUISE
```

```
✈ DL456 [DAL]
OUT 1420 OFF 1425
CATEGORY: oooi | TAKEOFF
✈ OUT @ 1420
```

```
✈ AA789 [AAL]
#M1BM/C CLIMB TO AND MAINTAIN FL350
CATEGORY: cpdlc | CRUISE
```

## Troubleshooting

### Port Already in Use
The app auto-kills ports 3000, 3001, 8501 before starting. If issues persist:
```bash
# Manual kill
lsof -ti:3000 | xargs kill -9
lsof -ti:8501 | xargs kill -9
```

### WebSocket Not Connecting
1. Ensure backend is running: `curl http://localhost:3000/health`
2. Check browser console for errors
3. Verify firewall settings

### No Messages Appearing
- Backend generates mock messages every 5 seconds
- Check backend console for errors
- Verify WebSocket connection (green indicator in header)

### Build Errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

cd frontend
rm -rf node_modules package-lock.json .next
npm install
```

## Features Demo

### Real-time Updates
Messages appear automatically - no refresh needed!

### Message Categories
- 🟢 OOOI (Out, Off, On, In events)
- 🔵 Position reports
- 🔷 Weather data
- ⚡ CPDLC messages
- 🟡 Performance data

### Flight Phases
- TAXI → TAKEOFF → CRUISE → DESCENT → APPROACH → LANDING

### Validation
Each message shows validation status (✓ VALID / ✗ INVALID)

## Next Steps

1. **Explore the Code**
   - Backend: `/backend`
   - Frontend: `/frontend/app`
   - Schemas: `/aviation_data_model_v1.0/schemas`

2. **Read Documentation**
   - `README.md` - Full documentation
   - `API.md` - API reference
   - `DEVELOPMENT.md` - Development guide

3. **Connect to Real Data**
   - Get Airframes.io WebSocket endpoint
   - Update `/backend/services/airframes-client.js`
   - Switch from mock to live connection

4. **Customize**
   - Modify SpaceX theme in `tailwind.config.js`
   - Add new components in `/frontend/app/components`
   - Extend message processing in `/backend/services/message-processor.js`

## Project Structure

```
airwave/
├── backend/           # Node.js backend
│   ├── server.js      # Main server
│   ├── services/      # Airframes client, processor, database
│   └── utils/         # Schema validator
├── frontend/          # Next.js frontend
│   └── app/
│       ├── components/ # React components
│       └── store/     # State management
└── aviation_data_model_v1.0/  # 23 schemas
```

## Commands Cheat Sheet

```bash
# Development (both servers)
npm run dev

# Backend only
npm run server

# Frontend only
cd frontend && npm run dev

# Production build
cd frontend && npm run build
npm start

# Tests
npm test

# Schema validation
npm run validate
```

## Support

- 📖 **Documentation:** See `README.md`
- 🔧 **API Reference:** See `API.md`
- 🐛 **Issues:** Check console logs
- 💬 **Airframes.io:** https://docs.airframes.io

## Success Indicators

You'll know it's working when you see:

✅ Backend console shows:
```
╔═══════════════════════════════════════════════╗
║   🚀 AIRWAVE MISSION CONTROL BACKEND 🚀      ║
╠═══════════════════════════════════════════════╣
║  HTTP Server:    http://localhost:3000       ║
║  WebSocket:      ws://localhost:3000/ws      ║
║  Status:         OPERATIONAL                  ║
║  Airframes.io:   CONNECTED                    ║
╚═══════════════════════════════════════════════╝
```

✅ Frontend shows:
- Green "CONNECTED" indicator in header
- Messages appearing in live feed
- Statistics updating
- No loading spinner

## Enjoy! 🚀✈️

Your aviation mission control is now operational!

---

**Built with:** Node.js + Express + WebSocket + Next.js + React + TypeScript + Tailwind CSS  
**Theme:** SpaceX Mission Control  
**Data Source:** Airframes.io (currently simulated)

