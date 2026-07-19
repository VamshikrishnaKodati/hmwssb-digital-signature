#!/bin/bash
# Setup script for HMWSSB Digital Signature System
set -e

echo "=== HMWSSB Digital Signature System Setup ==="

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js v20+ is required. Current: $(node -v)"
  exit 1
fi
echo "Node.js version: $(node -v) ✓"

# Install server dependencies
echo "Installing server dependencies..."
cd server && npm install && cd ..

# Install client dependencies
echo "Installing client dependencies..."
cd client && npm install && cd ..

# Generate .env if missing
if [ ! -f server/.env ]; then
  echo "Generating server/.env from template..."
  cp server/.env.example server/.env
  # Generate JWT_SECRET
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" server/.env
  echo "Generated JWT_SECRET ✓"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the application:"
echo "  Docker:  docker compose up --build"
echo "  Local:   cd server && npm run dev  (terminal 1)"
echo "           cd client && npm run dev  (terminal 2)"
echo ""
