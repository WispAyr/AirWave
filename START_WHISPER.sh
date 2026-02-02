#!/bin/bash

# Start Whisper Server for ATC Transcription
# This script starts the whisper.cpp server for real-time ATC audio transcription

cd "$(dirname "$0")/whisper.cpp"

echo "🎙️  Starting Whisper Server..."
echo "==============================================="
echo "Model: large-v3 (Full, 99%+ accuracy, ~3GB)"
echo "Port: 8080"
echo "GPU: Metal (M4 Pro)"
echo "==============================================="

# Start whisper server with best model
./build/bin/whisper-server \
  -m models/ggml-large-v3.bin \
  --port 8080 \
  --host 127.0.0.1 \
  2>&1 | tee whisper-large-v3.log

echo ""
echo "✅ Whisper Server started on http://localhost:8080"
echo "Press Ctrl+C to stop"

