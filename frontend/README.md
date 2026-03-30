# CarterA++ Frontend (React + Vite)

Production ready Vite + React 19 app.

## Development

```bash
npm run dev
```

## Build for Production

```bash
npm run build
```

Outputs optimized assets to `dist/`.

## Preview Production Build

```bash
npm run preview
```

Local server at http://localhost:4173.

## 🔧 Port Fix (Frontend Always 5173)

Vite now **strictly uses port 5173** (`strictPort: true`). Won't auto-change if busy.

**Start reliably:**
```bash
# Root (recommended - starts backend:5000 + frontend:5173)
npm run dev
# or clean start (kills ports first)
npm run dev:clean
# or manual stop then start
npm run stop:dev
npm run dev

# Frontend only (from root)
npm run dev:frontend
```

**If "port busy" error:**
```bash
npm run stop:dev  # Kills 5000 + 5173 processes
npm run dev       # Restart both
```

Backend (5000) + frontend (5173) run simultaneously. API proxy works.

## Deployment

- **Netlify/Vercel:** Drag `dist/` or set build command `npm run build`, output dir `dist`.
- **GitHub Pages:** Set base in vite.config.js, use `gh-pages`.
- **Static Hosting:** Upload `dist/` to any static host (AWS S3, Surge).

## ESLint

```bash
npm run lint
```

See eslint.config.js for rules.
