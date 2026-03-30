@echo off
setlocal
REM Production deployment script for Windows (PM2)

echo [1/6] Installing dependencies...
call npm ci
if errorlevel 1 (
  echo Root dependency install failed!
  exit /b 1
)

call npm --prefix backend ci
if errorlevel 1 (
  echo Backend dependency install failed!
  exit /b 1
)

call npm --prefix frontend ci
if errorlevel 1 (
  echo Frontend dependency install failed!
  exit /b 1
)

echo [2/6] Running backend tests...
call npm --prefix backend test -- --silent
if errorlevel 1 (
  echo Backend tests failed!
  exit /b 1
)

echo [3/6] Building frontend...
call npm --prefix frontend run build

if errorlevel 1 (
  echo Frontend build failed!
  exit /b 1
)

echo [4/6] Starting/reloading backend with PM2 (production)...
call npx pm2 startOrReload ecosystem.config.js --env production
if errorlevel 1 (
  echo PM2 start/reload failed!
  exit /b 1
)

echo [5/6] Running load CI guard...
call node scripts/performance.load.js
if errorlevel 1 (
  echo Load guard failed!
  exit /b 1
)

echo [6/6] Deployment checks complete.
echo Deployment finished successfully.
