# Development & Deployment Setup

This project supports two modes:

1. **Development Mode (Hot Reload)** - Frontend on port 3000, Backend on port 5000
2. **Single-Port Mode (Production)** - Everything on port 5000

## Development Mode (Default)

Best for active development with hot-reload, CSS changes, etc.

### Quick Start
```bash
npm run dev
```

This starts:
- **Backend API**: `http://localhost:5000`
- **Frontend (Hot Reload)**: `http://localhost:3000` ← **Click this for development**

Both ports are still there, but now managed from one start command. No port-juggling needed.

### Individual Servers

**Frontend only (with hot reload):**
```bash
npm run dev:frontend
```

**Backend only:**
```bash
npm run dev:backend
```

## Single-Port Mode (Production)

Everything served from one port (5000). Perfect for staging and production.

### Quick Start
```bash
npm run dev:single-port
```

This will:
1. Build the frontend
2. Start the backend on port 5000
3. **Access at**: `http://localhost:5000`

### Manual Steps
```bash
npm run build                    # Build frontend to dist/
npm --prefix backend start       # Start backend on port 5000
```

## How It Works

### Development Mode
- **Vite Dev Server**: Runs on port 3000 with hot reload
- **API Proxy**: `/api` calls proxied to `http://localhost:5000` via Vite config
- **No Build Step**: Changes instantly visible

### Single-Port Mode  
- **Backend Serves Everything**: Runs on port 5000
- **Static Frontend**: Serves `frontend/dist` as static files
- **SPA Routing**: Non-API routes redirect to `index.html`
- **Build Required**: Frontend must be built before start

## Production Deployment

### Using deploy script

**Windows:**
```bash
deploy.bat
```

**Linux/Mac:**
```bash
./deploy.sh
```

### Using npm
```bash
npm run build                    # Build frontend
npm run start:prod               # Start backend on port 5000
```

## Important Changes vs Old Setup

| Aspect | Old | Now |
|--------|-----|-----|
| **Dev Frontend Port** | 3000 | 3000 (same) |
| **Dev Backend Port** | 5000 | 5000 (same) |
| **Dev Start Command** | `npm run dev` (2 ports, 1 command) | `npm run dev` (2 ports, 1 command) |
| **Prod Frontend Port** | Built separately | 5000 |
| **Prod Backend Port** | 5000 | 5000 |
| **Prod Command** | Deploy separately | `npm run dev:single-port` |

## Troubleshooting

### Ports in use
```bash
npm run stop:dev
```

### Frontend not hot-reloading
Make sure you're using `npm run dev:frontend` or accessing port 3000

### API calls 404 in dev
- Check that backend is running on port 5000
- Vite proxy should handle `/api/*` routes

### Build errors
```bash
npm run stop:dev
npm run dev:clean
```

### Clear everything
```bash
npm run stop:dev
rm -rf frontend/dist
npm run dev
```

## Migration from Old Setup

If you were using separate ports before:

**Old way (still works):**
```bash
npm --prefix backend start    # Terminal 1
npm --prefix frontend run dev # Terminal 2
```

**New way (recommended):**
```bash
npm run dev  # One command, manages both
```

**For production (one port):**
```bash
npm run dev:single-port  # Builds and serves everything on 5000
```

