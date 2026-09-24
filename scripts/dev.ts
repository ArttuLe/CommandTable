// `npm run dev` — the local-only counterpart to `npm run host`. Same two processes, but with
// no passphrase to type and `/devtest/:playerAmount/:playerName` open, so looking at a change
// costs one URL instead of a room, a decklist per seat and a host start.
//
// Nothing here is reachable from `npm run host`: both are switched on by DEV_MODE, which only
// this script sets (see server.ts).

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const CLIENT_PORT = process.env.CLIENT_PORT ?? '5173';
const SERVER_PORT = process.env.PORT ?? '8080';

// A server that can't bind its port dies in the log while Vite keeps serving, and the page
// then talks to whatever *was* already on that port — usually an older server with no DEV_MODE,
// which answers /api/devtest with a 404 and makes it look like DEV_MODE never took. Refuse to
// start instead of handing over that puzzle.
async function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(Number(port));
  });
}

if (!(await portIsFree(Number(SERVER_PORT)))) {
  console.error(`
  Port ${SERVER_PORT} is already taken — most likely a server left over from an earlier run.

    lsof -i :${SERVER_PORT}          # who has it
    PORT=8081 npm run dev     # or just use another port

`);
  process.exit(1);
}

console.log(`
  Command Table — development.

  Table for four:  http://localhost:${CLIENT_PORT}/devtest/4/Alice
                   ...and Bob, Carol, Dave in other tabs for the other seats.
  Table for two:   http://localhost:${CLIENT_PORT}/devtest/2/Alice
  Normal lobby:    http://localhost:${CLIENT_PORT}

  No passphrase — type anything the lobby asks for. Dev tables are saved separately from real
  games, so nothing here touches data/sessions.json.
`);

const child = spawn(
  'npx',
  [
    'concurrently',
    '--names', 'server,client',
    '--prefix-colors', 'blue,magenta',
    '--kill-others',
    'npm run dev --workspace @command-table/server',
    'npm run dev --workspace @command-table/client',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, DEV_MODE: '1', SESSION_PATH: './data/dev-sessions.json', PORT: SERVER_PORT },
  },
);

child.on('exit', (code) => process.exit(code ?? 0));
