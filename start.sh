#!/bin/bash
# Start script for local development
set -e

echo "Starting HMWSSB Digital Signature System..."

# Check if .env exists
if [ ! -f server/.env ]; then
  echo "No .env found. Running setup first..."
  bash setup.sh
fi

# Start server in background
echo "Starting server on port 5001..."
cd server && npm run dev &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Start client
echo "Starting client on port 5173..."
cd ../client && npm run dev &
CLIENT_PID=$!

echo ""
echo "Server: http://localhost:5001"
echo "Client: http://localhost:5173"
echo "Health: http://localhost:5001/api/health"
echo ""
echo "Press Ctrl+C to stop..."

# Cleanup on exit
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM
wait
