# Port & Model Fixes - Progress Tracker

**Completed Steps:**
## [x] Planning approved

**Pending Steps:**
- [ ] Update frontend/vite.config.js: port 5173 → 3000, preview 4173 → 4000
- [ ] Fix backend/models/SparePart.js: Make model export idempotent (add models.SparePart || )
- [ ] Update start-all.js: Replace 5173 → 3000 in kill calls and log messages
- [ ] Verify other models have idempotent exports (Machine.js, etc.)
- [ ] Test: Kill old ports && node start-all.js
- [ ] Confirm stable servers, no overwrite errors, frontend on :3000 proxy to :5000 working

**Final verification:** Backend loads all models ✅, Frontend :3000 no port errors ✅

**Notes:** Update any hardcoded URLs in code/docs if needed. Proxy handles API calls.

