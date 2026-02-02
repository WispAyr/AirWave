#!/bin/bash

echo "🚀 Starting AIRWAVE Mission Control..."
echo ""

# Check if we're in the right directory
if [ ! -d "AirWave" ]; then
    echo "❌ Error: AirWave directory not found!"
    echo "Please run this script from the project root."
    exit 1
fi

# Check if .env exists
if [ ! -f "AirWave/.env" ]; then
    echo "⚠️  No .env file found!"
    echo ""
    echo "Creating .env from template..."
    
    if [ -f "AirWave/.env.example" ]; then
        cp AirWave/.env.example AirWave/.env
        echo "✅ Created AirWave/.env"
        echo ""
        echo "⚠️  IMPORTANT: Edit AirWave/.env and add your Airframes.io API key!"
        echo "   Get one free at: https://app.airframes.io"
        echo ""
        read -p "Press Enter after you've added your API key..."
    else
        echo "❌ No .env.example found either!"
        exit 1
    fi
fi

# Check for node_modules in root
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

# Check for frontend node_modules
if [ ! -d "AirWave/frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd AirWave/frontend
    npm install
    cd ../..
fi

echo ""
echo "✅ Dependencies installed!"
echo ""

# Kill existing processes on our ports
echo "🔪 Cleaning up ports..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8501 | xargs kill -9 2>/dev/null || true
sleep 1

echo ""
echo "🚀 Starting servers..."
echo ""
echo "Backend will start on:  http://localhost:3000"
echo "Frontend will start on: http://localhost:8501"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start both servers using the root npm script if it exists, otherwise manually
if grep -q "\"dev\"" package.json 2>/dev/null; then
    npm run dev
else
    # Start manually
    echo "Starting backend..."
    cd AirWave/backend
    node server.js &
    BACKEND_PID=$!
    
    echo "Starting frontend..."
    cd ../frontend
    PORT=8501 npm run dev &
    FRONTEND_PID=$!
    
    # Wait for Ctrl+C
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
    wait
fi

