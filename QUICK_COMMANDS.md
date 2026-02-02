# ⚡ Quick Commands

## Push to GitHub

### First Time Setup

```bash
# 1. Create a new repository on GitHub
# Go to: https://github.com/new
# Name it: airwave
# Don't initialize with README

# 2. Add your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/airwave.git

# 3. Run the push script
./PUSH_TO_GITHUB.sh
```

### Or Manually

```bash
# Add all files
git add -A

# Commit
git commit -m "Initial commit: AIRWAVE Mission Control"

# Push
git push -u origin main
```

---

## Run the Application

### Quick Start

```bash
./START_APP.sh
```

### Manual Start

```bash
# Install dependencies (first time only)
npm install
cd AirWave/frontend && npm install && cd ../..

# Setup environment (first time only)
cp AirWave/.env.example AirWave/.env
# Edit AirWave/.env and add your API key

# Start both servers
npm run dev

# Or start separately:
# Terminal 1:
cd AirWave/backend && node server.js

# Terminal 2:
cd AirWave/frontend && PORT=8501 npm run dev
```

### Access

- **Frontend:** http://localhost:8501
- **Backend API:** http://localhost:3000/api
- **WebSocket:** ws://localhost:3000/ws

---

## Common Tasks

### Clean & Rebuild

```bash
# Remove all build artifacts and dependencies
rm -rf node_modules AirWave/frontend/node_modules AirWave/frontend/.next

# Reinstall
npm install
cd AirWave/frontend && npm install
```

### Reset Database

```bash
# Remove database
rm -f AirWave/backend/data/*.db*

# Restart app (database recreates automatically)
./START_APP.sh
```

### View Logs

```bash
# Backend logs
tail -f AirWave/backend/logs/*.log

# Or just watch the console output
```

### Kill Ports

```bash
# If ports are stuck
lsof -ti:3000 | xargs kill -9
lsof -ti:8501 | xargs kill -9
```

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `cleanup.sh` | Remove sensitive files before Git commit |
| `PUSH_TO_GITHUB.sh` | Safely push to GitHub with checks |
| `START_APP.sh` | Start both backend and frontend |

---

## Environment Setup

### Required: Get API Key

1. Visit https://app.airframes.io
2. Sign up (free)
3. Generate API key
4. Add to `AirWave/.env`:

```env
AIRFRAMES_API_KEY=your_actual_key_here
```

---

## Troubleshooting

### Port Already in Use

```bash
# Kill processes
./cleanup.sh
# Or manually
lsof -ti:3000 | xargs kill -9
lsof -ti:8501 | xargs kill -9
```

### Dependencies Out of Date

```bash
npm update
cd AirWave/frontend && npm update
```

### Git Issues

```bash
# Reset to last commit
git reset --hard HEAD

# Discard all changes
git clean -fd
git checkout .
```

---

## Development Workflow

```bash
# 1. Make changes to code
# 2. Test locally
./START_APP.sh

# 3. Commit changes
git add .
git commit -m "Description of changes"

# 4. Push to GitHub
git push

# 5. Repeat!
```

---

**Quick Reference Card - Keep This Handy! 📋**

