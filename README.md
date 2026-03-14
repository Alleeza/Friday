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

3. Start the frontend and backend together:

```bash
npm run dev
```

4. Open the local Vite URL shown in the terminal, usually `http://localhost:5173`.

The backend stores the current project in the SQLite database [friday.db](C:/Users/Allee/OneDrive/Pictures/Desktop/Fri/Friday/server/storage/friday.db), so saved scene layout and block scripts survive refreshes.
Use the Save button beside Play in the sandbox to persist the current assets and scripts.
If the backend is not reachable during local development, the app falls back to browser `localStorage` so saved refresh persistence still works on `localhost`.

## Available scripts

- `npm run dev` starts the backend and Vite together.
- `npm run dev:api` starts only the backend API server.
- `npm run dev:vite` starts only the Vite frontend.
- `npm run build` creates a production build.
- `npm run preview` serves the production build locally.
- `npm run start` serves the production build and persistence API from the Node backend.

## Current local blocker

This repo is currently not runnable in the checked environment because `node` and `npm` are not installed yet.
