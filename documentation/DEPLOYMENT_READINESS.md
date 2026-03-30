# Deployment Strategy and Production Readiness

## 1) Deployment Strategy

### Backend
- Runtime: Node.js (`backend/server.js`)
- Process manager: PM2 using `ecosystem.config.js`
- Environments:
  - development: `npx pm2 startOrReload ecosystem.config.js --env development`
  - staging: `npx pm2 startOrReload ecosystem.config.js --env staging`
  - production: `npx pm2 startOrReload ecosystem.config.js --env production`
- Zero-downtime style reload via PM2 cluster mode (`instances: max`).

### Database
- Use managed MongoDB (Atlas or equivalent).
- Connection variable precedence:
  - `DB_URI` (preferred)
  - `MONGO_URI` (fallback)
- Startup index assurance:
  - `backend/config/db.js` ensures indexes for `SparePart` and `Transfer` after successful connect.

### Frontend
- Build static assets with:
  - `npm --prefix frontend run build`
- Output directory: `frontend/dist`
- Hosting:
  - Option A: serve with backend static middleware
  - Option B: deploy to CDN/static hosting and point API via `VITE_API_URL`.

## 2) Environment Configuration

Required production variables:
- `NODE_ENV=production`
- `DB_URI=<secure atlas uri>`
- `SLOW_ENDPOINT_MS=250`
- `P95_THRESHOLD_MS=250`
- `AUTH_TOKEN=<optional bearer token for guarded environments>`
- `SPAREPART_BATCH_DEBUG=false`

Recommended:
- `TRANSFER_DEBUG=false`
- `FRONTEND_URL=<public frontend origin>`
- `JWT_SECRET=<strong secret>`

## 3) Production Readiness Checklist

### Validation commands
- Single command test run:
  - `npm run test:all`
- CI performance guard:
  - `npm run perf:guard`

### Checklist
- [ ] All tests passing from single command.
- [ ] CI guard active: fails if `errorCount > 0` or `p95 > P95_THRESHOLD_MS`.
- [ ] Debug toggles off in production (`SPAREPART_BATCH_DEBUG=false`, `TRANSFER_DEBUG=false`).
- [ ] Error responses are consistent JSON with `success` and `message` fields.
- [ ] Metrics endpoint decision made:
  - internal access only at network edge, or
  - app-level token gate enabled with `METRICS_REQUIRE_AUTH=true` and `METRICS_AUTH_TOKEN`.
- [ ] Health endpoint reachable at `/api/health`.
- [ ] PM2 process healthy (`npx pm2 ls`, `npx pm2 logs carter-backend --lines 200`).

## 4) Deployment Commands

### Staging
- `npm run deploy:staging`
- Verifies PM2 staging process and runs CI load guard.

### Linux/macOS
- `./deploy.sh`

### Windows
- `deploy.bat`

Both scripts perform:
1. Dependency install
2. Backend tests
3. Frontend build
4. Performance CI guard
5. PM2 production reload

## 5) Basic Monitoring Alerts (Starter)

Use `/api/metrics` and `/api/metrics/prometheus` for alerting.

Suggested alerts:
- Error rate alert:
  - trigger if `totals.errorRate > 1` for 5 minutes
- Latency alert:
  - trigger if `totals.p95Ms > 250` for 5 minutes
- Slow request alert:
  - trigger if `totals.slowRate > 5` for 10 minutes
- Availability alert:
  - trigger if `/api/health` fails 3 consecutive checks

## 6) Security Notes
- Do not commit real production credentials.
- Rotate `JWT_SECRET` and database credentials regularly.
- Restrict metrics and management endpoints at network edge.
