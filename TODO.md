# Fix Frontend Vercel API Errors (404/401s)

## Status: Planning → Implementation

**Root Causes:**
- Backend route import path mismatches (src/ vs backend/src/)
- Missing app.use() mounts for /api/alerts, /api/purchase-orders
- Auth middleware blocking unauth requests (no JWT token in prod demo)
- Chart width/height: Already mitigated in Dashboard.jsx with ResizeObserver + minHeight

## Step-by-Step Plan (Backend First)

### [x] 1. Fix server.js (High Priority)
- Updated imports to backend/src/routes/*
- Added /api/alert
```
- Update all route imports: require('./backend/src/routes/xxxRoutes')
- Add missing mounts:
  app.use('/api/alerts', alertRoutes);
  app.use('/api/purchase-orders', purchaseRoutes);
- Fix storeRoutes path (already partially inline)
- Remove auth from GET routes for demo
```

### [ ] 2. Standardize Route Files
```
- backend/src/routes/ordersRoutes.js etc. → use controllers without auth on GET
- Stub data if controllers empty: res.json({success:true, data:[]})
```

### [ ] 3. Test Backend Locally
```
cd backend
npm install
npm start
Test: curl http://localhost:5000/api/orders
Expect: 200 JSON not 404/401
```

### [ ] 4. Deploy Backend (Render)
```
git add backend/
git commit -m \"fix: standardize backend routes/imports/public APIs\"
git push
Monitor Render logs
```

### [ ] 5. Verify Frontend
```
- Reload Vercel site
- Check console: no more 404/401
- Charts render (already fixed)
```

### [ ] 6. Re-enable Auth Later
```
- Add login/register page
- Store JWT in localStorage
```

**Next Action:** Edit server.js → Mark Step 1 complete
