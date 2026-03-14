# Friday

UNIHACK frontend for the Friday team.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Setup

1. Install Node.js if it is not already on your machine.
2. Install dependencies:

```bash
npm install
```

3. Create `.env.local` from `.env.example` and fill in at least:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

4. Run the SQL in [schema.sql](C:/Users/Allee/OneDrive/Pictures/Desktop/Fri/Friday/supabase/schema.sql) inside your Supabase project.

5. Start the frontend and backend together:

```bash
npm run dev
```

6. Open the local Vite URL shown in the terminal, usually `http://localhost:5173`.

Project saves and published share snapshots are stored in Supabase. The browser keeps only a stable local editor ID so each device can reopen its own draft while the actual project data works on Vercel and across refreshes.

## Vercel deployment

- Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to your Vercel project environment variables.
- Deploy normally with Vercel.
- [vercel.json](C:/Users/Allee/OneDrive/Pictures/Desktop/Fri/Friday/vercel.json) rewrites `/play/<shareId>` back to the SPA entry so shared game links work on refresh.

The deployed API entrypoints are:

- [project-state.js](C:/Users/Allee/OneDrive/Pictures/Desktop/Fri/Friday/api/project-state.js)
- [index.js](C:/Users/Allee/OneDrive/Pictures/Desktop/Fri/Friday/api/published-project/index.js)
- [[shareId].js](C:/Users/Allee/OneDrive/Pictures/Desktop/Fri/Friday/api/published-project/[shareId].js)

The share page now loads published snapshots through `GET /api/published-project?shareId=...`, which is more reliable on Vercel than depending on the nested dynamic API file alone.

## Available scripts

- `npm run dev` starts the backend and Vite together.
- `npm run dev:api` starts only the backend API server.
- `npm run dev:vite` starts only the Vite frontend.
- `npm run build` creates a production build.
- `npm run preview` serves the production build locally.
- `npm run start` serves the production build and persistence API from the local Node backend.

## PowerShell note

If PowerShell blocks `npm` with an execution policy error, use `npm.cmd` instead.
