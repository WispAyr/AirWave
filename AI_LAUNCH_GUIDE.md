# AI Launch Guide for AirWave Mission Control

This guide provides step-by-step instructions for AI assistants (like Cursor AI) to launch the AirWave application.

## Project Overview

**AirWave** is a real-time aviation data mission control system that:
- Monitors ACARS messages from aircraft worldwide
- Tracks aircraft positions in real-time
- Processes Emergency Action Messages (EAM)
- Provides a SpaceX-inspired mission control dashboard
- Supports multiple data sources (Airframes.io, OpenSky, ADS-B Exchange, TAR1090, EAM.watch)

## Project Structure

```
airwave/
└── AirWave/                    # Main application directory
    ├── backend/                # Node.js/Express backend
    │   ├── server.js           # Main server entry point
    │   ├── kill-port.js        # Port cleanup utility (auto-runs)
    │   ├── services/           # Core services
    │   ├── routes/             # API routes
    │   └── config/             # Configuration files
    ├── frontend/               # Next.js 14 frontend
    │   ├── app/                # Next.js app directory
    │   └── package.json
    ├── .env                    # Environment variables (REQUIRED)
    └── package.json            # Root package.json with scripts
```

## Prerequisites Check

Before launching, verify:

1. **Node.js 18+** is installed
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **Dependencies are installed**
   ```bash
   cd /Users/ewanrichardson/Development/airwave/AirWave
   ls node_modules  # Should exist and contain packages
   cd frontend
   ls node_modules  # Should exist and contain packages
   ```

3. **Environment file exists**
   ```bash
   cd /Users/ewanrichardson/Development/airwave/AirWave
   ls .env  # Should exist
   ```

## Launch Instructions

### Method 1: Single Command (Recommended)

From the **AirWave** directory, run:

```bash
cd /Users/ewanrichardson/Development/airwave/AirWave && npm run dev
```

This command:
- Automatically kills processes on ports 3000, 3001, and 8501 (via `kill-port.js`)
- Starts the backend server on port **5773** (from `.env`)
- Starts the frontend Next.js dev server on port **8501**
- Uses `concurrently` to run both processes simultaneously
- Uses `nodemon` for backend auto-reload on file changes

### Method 2: Separate Terminals

If you need separate terminal windows:

**Terminal 1 - Backend:**
```bash
cd /Users/ewanrichardson/Development/airwave/AirWave
npm run server
```

**Terminal 2 - Frontend:**
```bash
cd /Users/ewanrichardson/Development/airwave/AirWave/frontend
npm run dev
```

## Port Configuration

The application uses the following ports (configured in `.env`):

- **Backend API:** `5773` (default, set via `PORT` in `.env`)
- **Frontend:** `8501` (hardcoded in frontend package.json)
- **WebSocket:** Same as backend port (5773) at `/ws` endpoint

**Note:** The `kill-port.js` script automatically frees ports 3000, 3001, and 8501 before starting, but the backend actually runs on 5773.

## Verification Steps

After launching, verify the application is running:

1. **Check Backend Health:**
   ```bash
   curl http://localhost:5773/health
   ```
   Should return a JSON health status.
   
   **Note:** Backend may take 10-15 seconds to fully initialize all services.

2. **Check Frontend:**
   ```bash
   curl http://localhost:8501
   ```
   Should return HTML (Next.js app).
   
   **Note:** If you see a CSS parsing error about `@import`, the frontend is still starting. Wait a moment and refresh.

3. **Check WebSocket:**
   The WebSocket endpoint is available at `ws://localhost:5773/ws`

4. **Check Running Processes:**
   ```bash
   ps aux | grep -E "(node|next)" | grep -v grep
   ```
   Should show `concurrently`, `nodemon`, and `next-server` processes.

## Access Points

Once running, access the application at:

- **Frontend Dashboard:** http://localhost:8501
- **Backend API:** http://localhost:5773/api
- **Health Check:** http://localhost:5773/health
- **WebSocket:** ws://localhost:5773/ws

## Environment Variables

The application requires a `.env` file in the `AirWave` directory. Key variables:

- `PORT=5773` - Backend server port
- `AIRFRAMES_API_KEY` - API key for Airframes.io (optional, app works without it)
- `EAM_WATCH_API_TOKEN` - Token for EAM.watch API (optional)
- `ALLOWED_ORIGINS` - CORS allowed origins
- `NODE_ENV=development` - Environment mode

**Note:** The app will start without API keys, but some features may not work.

## Troubleshooting

### Port Already in Use

The `kill-port.js` script should handle this automatically. If issues persist:

```bash
# Manually kill processes
lsof -ti:5773 | xargs kill -9
lsof -ti:8501 | xargs kill -9
```

### Frontend CSS Build Error

If you see a CSS parsing error about `@import` rules:
- The `@import 'leaflet/dist/leaflet.css'` should be at the top of `globals.css`
- Try clearing Next.js cache: `rm -rf frontend/.next`
- Restart the dev server

### Dependencies Missing

If you get module not found errors:

```bash
cd /Users/ewanrichardson/Development/airwave/AirWave
npm install

cd frontend
npm install
```

### Backend Won't Start

Check for:
1. `.env` file exists in `AirWave/` directory
2. Node.js version is 18+
3. All dependencies installed
4. No syntax errors in `backend/server.js`

## Production Build

To build for production:

```bash
cd /Users/ewanrichardson/Development/airwave/AirWave/frontend
npm run build

cd ..
npm start  # Runs backend only (frontend must be built first)
```

## Key Files for AI Assistants

When modifying the application, key files to be aware of:

- **Backend Entry:** `AirWave/backend/server.js`
- **Frontend Entry:** `AirWave/frontend/app/page.tsx`
- **API Routes:** `AirWave/backend/routes/index.js`
- **Port Cleanup:** `AirWave/backend/kill-port.js` (runs automatically)
- **Config:** `AirWave/backend/config/index.js`
- **Environment:** `AirWave/.env`

## Scripts Reference

From `AirWave/package.json`:

- `npm run dev` - Start both backend and frontend in development mode
- `npm run server` - Start backend only (with port cleanup)
- `npm run client` - Start frontend only
- `npm start` - Start backend in production mode
- `npm test` - Run tests
- `npm run validate` - Validate aviation data schemas

## Important Notes for AI Assistants

1. **Always work from the `AirWave` directory**, not the root `airwave` directory
2. **Port cleanup is automatic** - `kill-port.js` runs before server starts
3. **Backend port is 5773**, not 3000 (check `.env` for actual value)
4. **Frontend port is 8501** (hardcoded in frontend package.json)
5. **Environment file is required** - check `AirWave/.env` exists
6. **Dependencies are in two places** - root `node_modules` and `frontend/node_modules`

## Quick Launch Command for AI

For AI assistants, use this exact command:

```bash
cd /Users/ewanrichardson/Development/airwave/AirWave && npm run dev
```

This single command handles everything: port cleanup, backend startup, and frontend startup.

## Stopping the Application

To stop the application:
- Press `Ctrl+C` in the terminal running `npm run dev`
- Or kill the processes:
  ```bash
  lsof -ti:5773 | xargs kill -9
  lsof -ti:8501 | xargs kill -9
  ```

---

**Last Updated:** 2026-01-23
**Application Version:** 1.0.0
**Node.js Required:** 18+
