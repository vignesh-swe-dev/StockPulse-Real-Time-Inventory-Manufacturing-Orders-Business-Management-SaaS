# Run StockPulse locally

Requires **Node.js 18.18 or newer**. No database server or Docker is needed.

## Real data (default)

StockPulse starts **empty** and stores your real business data in `backend/data/stockpulse-data.json`. It is saved after every change and reloaded when the backend restarts. Back up that file to back up your data. Set `DATA_FILE=/path/to/file.json` to keep it somewhere else.

1. Open http://localhost:3000 and choose **Create your company account**.
2. Go to **Setup & Masters** and add a warehouse and customers.
3. Add products, then receive your opening stock on the Inventory page.

Sample data is only loaded if you ask for it: `node scripts/dev.mjs --demo` (stored in a separate `demo-data.json`, so it never mixes with real data).

## One command (backend + frontend together)

```bash
cd stockpulse
node scripts/dev.mjs        # or: npm run dev
```

Windows: double-click `start-local.bat`. Mac/Linux: `./start-local.sh`.

The first run installs the frontend packages automatically. Then open:

| What | Address |
|------|---------|
| Marketing website | http://localhost:3000/welcome |
| App | http://localhost:3000 |
| Sign-in page | http://localhost:3000/login |
| API | http://localhost:4000/api/v1 (health: `/api/v1/health`) |

## Options

| Command | What it does |
|---------|--------------|
| `node scripts/dev.mjs backend` | Backend only (restarts when files change if run via `npm run dev --prefix backend`) |
| `node scripts/dev.mjs frontend` | Frontend only |
| `node scripts/dev.mjs --prod` | Build the frontend and run it in production mode |
| `npm test` | Run the backend test suite |

Change ports with environment variables, for example `BACKEND_PORT=5000 FRONTEND_PORT=3001 node scripts/dev.mjs`.
(On Windows PowerShell: `$env:BACKEND_PORT=5000; node scripts/dev.mjs`.)

## Run the two parts separately

```bash
# Terminal 1 - backend
cd backend
npm run dev            # auto-restart on change; use `npm start` for a plain run

# Terminal 2 - frontend
cd frontend
npm install
npm run dev
```

If the backend is on another address, copy `frontend/.env.local.example` to `frontend/.env.local` and edit `NEXT_PUBLIC_API_URL`.

Local browser origins (`localhost` / `127.0.0.1`) are allowed by the backend automatically. For a deployed site set `ALLOWED_ORIGINS=https://your-site.com` on the backend.

## Notes
- Data persists in `backend/data/` across restarts. Delete that folder to start again from an empty database.
- Demo mode (`--demo`) signs in with `vikram@sahyadri.in` / `SahyadriSecure#2026`.
- Fonts (Sora, Inter, JetBrains Mono) load from Google Fonts, so an internet connection is needed for the full look.
