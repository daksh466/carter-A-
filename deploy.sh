#!/bin/bash
set -euo pipefail

echo "[1/6] Installing dependencies..."
npm ci
npm --prefix backend ci
npm --prefix frontend ci

echo "[2/6] Running backend tests..."
npm --prefix backend test -- --silent

echo "[3/6] Building frontend assets..."
npm --prefix frontend run build

echo "[4/6] Starting/reloading backend with PM2 (production)..."
npx pm2 startOrReload ecosystem.config.js --env production

echo "[5/6] Running load CI guard..."
node scripts/performance.load.js

echo "[6/6] Deployment checks complete."
echo "Deployment finished successfully."
