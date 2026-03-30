#!/bin/bash
# Development script with better error handling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[dev-manager]${NC} $1"
}

error() {
  echo -e "${RED}[dev-manager]${NC} $1"
}

log "Starting Carter CRM on single port (5000)..."

# Clean up port 5000
log "Cleaning up port 5000..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
sleep 1

# Build frontend
log "Building frontend..."
npm --prefix frontend run build > /dev/null 2>&1

if [ $? -ne 0 ]; then
  error "Frontend build failed!"
  exit 1
fi

log "Frontend built successfully!"
log "Starting backend on port 5000..."
log "Access app at: http://localhost:5000"

npm --prefix backend start
