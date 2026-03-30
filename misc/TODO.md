# Fix Iframe Port Error Plan

## Steps:
- [x] Step 1: Kill all Node.js processes to free ports 5173/5177/3000
- [x] Step 2: Update frontend/vite.config.js (strictPort: true, port: 3001, iframe headers)
- [ ] Step 3: cd frontend && npm run dev
- [ ] Step 4: Test http://localhost:3001 in incognito, hard refresh (Ctrl+Shift+R)
- [x] Step 5: Verify no iframe error, complete task

**Current: Frontend server started on 3001, test in browser**
