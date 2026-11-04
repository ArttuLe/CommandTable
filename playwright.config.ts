// End-to-end tests (see e2e/). They drive `/devtest/:playerAmount/:playerName` in a real browser
// to cover what the pure-logic Vitest modules structurally cannot: measured layout, the CSS that
// acts on it, and anything two clients have to agree about.

import { existsSync } from 'node:fs';

import { defineConfig } from '@playwright/test';

// Ports of our own, so a `npm run dev` you already have open on 8080/5173 keeps working and its
// dev table is left alone.
// The server cannot boot without the ingested card index, and it is gitignored (see the README).
// Without it there is nothing to start, so the servers are left out and the specs skip themselves
// — starting them anyway would bury the reason under a SQLite stack trace.
const hasCardIndex = existsSync(new URL('./packages/server/data/cards.sqlite3', import.meta.url));

const SERVER_PORT = 8091;
const CLIENT_PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  // The dev table is shared per seat count (see e2e/seat.ts), so specs must not race each other.
  workers: 1,
  // No retries on purpose: a spec that passes on the second go is the failure this suite exists
  // to catch, not noise to hide.
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    // --card-w steps at viewport breakpoints (tokens.css), and the geometry specs measure it.
    viewport: { width: 1280, height: 800 },
    // Leaves the change pulse in the DOM but drops its 400ms animation (styles.css).
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: !hasCardIndex ? undefined : [
    {
      // Not `npm run dev`: that runs the server under `tsx watch`, and a restart mid-run would
      // swap the dev table out from under a test. A fresh process each run is also what makes
      // the tables pristine — devRoomsByCount is in-process and never restored (server.ts).
      // The session file is dropped first: restored rooms are dead weight here, because the
      // dev-table map that would reuse them is in-process and never restored (server.ts). Without
      // this, every run leaves a few more tables for the next one to load.
      command: 'rm -f data/e2e-sessions.json && npx tsx src/server.ts',
      cwd: 'packages/server',
      // A TCP check: every /api route either 404s or needs arguments, so there is nothing to GET.
      port: SERVER_PORT,
      reuseExistingServer: false,
      env: { DEV_MODE: '1', PORT: String(SERVER_PORT), SESSION_PATH: './data/e2e-sessions.json' },
      stdout: 'pipe',
    },
    {
      // The dev server, never a build: App.tsx gates the /devtest route on import.meta.env.DEV.
      command: 'npm run dev --workspace @command-table/client',
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer: false,
      env: { CLIENT_PORT: String(CLIENT_PORT), VITE_SERVER_PORT: String(SERVER_PORT) },
    },
  ],
});
