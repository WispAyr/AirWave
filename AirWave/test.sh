#!/bin/bash

echo "🚀 AIRWAVE Test Suite"
echo "===================="
echo ""

# Test backend health
echo "1. Testing backend health..."
curl -s http://localhost:3000/health | jq .
echo ""

# Test schemas endpoint
echo "2. Testing schemas endpoint..."
curl -s http://localhost:3000/api/schemas | jq '.count'
echo ""

# Test specific schema
echo "3. Testing specific schema..."
curl -s http://localhost:3000/api/schemas/oooi_events | jq '.title'
echo ""

# Test reference data
echo "4. Testing reference data..."
curl -s http://localhost:3000/api/reference/aviation_units
echo ""

echo "✅ Tests complete!"
echo ""
echo "Access points:"
echo "  Frontend: http://localhost:8501"
echo "  Backend:  http://localhost:3000"
echo "  WebSocket: ws://localhost:3000/ws"

