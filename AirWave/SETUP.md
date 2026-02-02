# 🛠️ Setup Instructions

## Prerequisites

- **Node.js 18+** installed
- **npm** or **yarn** package manager
- **Git** (optional, for cloning)

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/airwave.git
cd airwave
```

### 2. Install Dependencies

**Backend:**
```bash
npm install
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

### 3. Get Airframes.io API Key

1. Visit [https://app.airframes.io](https://app.airframes.io)
2. Sign up for a free account
3. Verify your email
4. Generate an API key from your dashboard
5. Copy the API key

### 4. Configure Environment

**Create `.env` file:**
```bash
cp .env.template .env
```

**Edit `.env` and add your API key:**
```env
AIRFRAMES_API_KEY=your_actual_api_key_here
```

**Alternative:** Use `.env.example` as reference:
```bash
cp .env.example .env
# Then edit .env with your real API key
```

### 5. Start the Application

**Option A - Both servers together:**
```bash
npm run dev
```

**Option B - Separate terminals:**

*Terminal 1 (Backend):*
```bash
npm run server
```

*Terminal 2 (Frontend):*
```bash
cd frontend && npm run dev
```

### 6. Access the Dashboard

Open your browser to:
```
http://localhost:8501
```

You should see:
- ✅ SpaceX-themed mission control dashboard
- ✅ Live ACARS messages streaming
- ✅ Interactive world map
- ✅ Real-time statistics

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `AIRFRAMES_API_KEY` | Your Airframes.io API key | `abc123...` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Backend HTTP port |
| `WS_PORT` | `3001` | WebSocket port |
| `FRONTEND_PORT` | `8501` | Frontend port |
| `NODE_ENV` | `development` | Environment mode |

---

## Troubleshooting

### Port Already in Use

The app auto-kills processes on ports 3000, 3001, and 8501. If issues persist:

```bash
# Kill manually
lsof -ti:3000 | xargs kill -9
lsof -ti:8501 | xargs kill -9
```

### API Key Not Working

1. Verify key is correct (check for extra spaces)
2. Ensure `.env` file is in project root
3. Restart the server after changing `.env`
4. Check API key is active on Airframes.io dashboard

### No Messages Appearing

1. Check backend console for connection status
2. Verify WebSocket connection (green indicator in header)
3. Check browser console (F12) for errors
4. Ensure API key has permissions

### Database Issues

```bash
# Reset database
rm -f backend/data/airwave.db*

# Restart server (database recreates automatically)
npm run server
```

---

## Development

### Project Structure

```
airwave/
├── backend/              # Node.js + Express backend
│   ├── server.js        # Main server
│   ├── services/        # Airframes client, processor, database
│   └── routes/          # API routes
├── frontend/            # Next.js frontend
│   └── app/             # React components
├── aviation_data_model_v1.0/  # Schemas
└── .env                 # Your config (NOT in Git!)
```

### Available Scripts

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
```

---

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Use production API endpoints
3. Configure CORS for your domain
4. Setup SSL/TLS certificates
5. Use environment secrets manager

### Build Frontend

```bash
cd frontend
npm run build
npm start
```

### Process Manager (PM2)

```bash
npm install -g pm2

# Start backend
pm2 start backend/server.js --name airwave-backend

# Start frontend
cd frontend
pm2 start npm --name airwave-frontend -- start
```

---

## Docker (Optional)

### Docker Compose

```bash
docker-compose up -d
```

### Manual Docker

```bash
# Build
docker build -t airwave .

# Run
docker run -p 3000:3000 -p 8501:8501 \
  -e AIRFRAMES_API_KEY=your_key \
  airwave
```

---

## Security Notes

### ⚠️ NEVER Commit

- `.env` file with real API keys
- `backend/data/*.db` (contains data)
- Any files with sensitive information

### ✅ Safe to Commit

- `.env.example` (template without keys)
- `.env.template` (template without keys)
- Source code
- Documentation
- Configuration files (without secrets)

---

## Getting Help

### Documentation

- `README.md` - Project overview
- `QUICK_START.md` - 60-second setup
- `API.md` - API reference
- `DATABASE_ARCHITECTURE.md` - Database design
- `DEVELOPMENT.md` - Development guide

### Resources

- [Airframes.io Documentation](https://docs.airframes.io)
- [Next.js Documentation](https://nextjs.org/docs)
- [Node.js Documentation](https://nodejs.org/docs)

### Support

- Check existing documentation
- Review console logs (backend & browser)
- Verify environment variables
- Test API key on Airframes.io directly

---

## Next Steps

After successful setup:

1. ✅ Verify messages are streaming
2. ✅ Check database is persisting data
3. ✅ Explore the interactive map
4. ✅ Try search functionality
5. ✅ Review statistics dashboard
6. 📖 Read `FUTURE_FEATURES.md` for ideas

---

**Enjoy your aviation mission control! 🚀✈️**

