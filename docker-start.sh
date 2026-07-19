#!/bin/bash
# Docker start script
set -e

echo "Starting HMWSSB Digital Signature System with Docker..."
docker compose up --build -d

echo ""
echo "Waiting for services to be ready..."
sleep 5

# Check health
for i in 1 2 3 4 5; do
  if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "Server is healthy!"
    break
  fi
  echo "Waiting for server... ($i/5)"
  sleep 3
done

echo ""
echo "Services:"
echo "  Frontend: http://localhost"
echo "  Backend:  http://localhost:5000"
echo "  Health:   http://localhost:5000/api/health"
echo "  MongoDB:  localhost:27017"
