// `npm run host` — everything the hosting machine needs, in one command (see
// playing-with-a-friend.md). Starts the server and the client together, and prints the URL to
// send your friend so nobody has to assemble it out of `tailscale status` by hand.
//
// Guests run nothing at all: they open the printed link. There is deliberately no `npm run
// guest` to pair with this.

import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { resolveHostSecret } from '../packages/server/src/hostSecret.js';
import { savedHostSecret } from '../packages/server/src/sessionStore.js';

const CLIENT_PORT = process.env.CLIENT_PORT ?? '5173';
const SERVER_PORT = process.env.PORT ?? '8080';

// The name a friend can actually reach us by, best first: the tailnet name works from anywhere,
// a LAN address only from the same network, and localhost only from this machine.
function shareableHost(): { host: string; via: string } {
  try {
    const status = JSON.parse(execFileSync('tailscale', ['status', '--json'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
    const dnsName: string | undefined = status?.Self?.DNSName;
    if (dnsName) return { host: dnsName.replace(/\.$/, ''), via: 'Tailscale' };
  } catch {
    // Tailscale isn't installed or isn't running — fall through to the local network.
  }

  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return { host: address.address, via: 'this network only' };
      }
    }
  }

  return { host: 'localhost', via: 'this machine only' };
}

// The server's own session path, which it resolves from its package directory. The saved
// passphrase has to be read here, not just by the server: whatever this prints is handed to the
// server as HOST_SECRET, which outranks the saved one — so leaving it out minted a new passphrase
// on every restart, and nobody holding the old one could get back in.
const sessionPath = resolve('packages/server', process.env.SESSION_PATH ?? './data/sessions.json');
const secret = resolveHostSecret(process.env, savedHostSecret(sessionPath));
const { host, via } = shareableHost();

console.log(`
  Command Table — starting up.

  Send your friend:  http://${host}:${CLIENT_PORT}   (${via})
  Passphrase:        ${secret}

  They need nothing else — no checkout, no card index, just the link.
  Set HOST_SECRET to choose your own passphrase.
`);

if (via !== 'Tailscale') {
  console.log(`  Tailscale isn't running, so that address won't reach anyone outside your
  network. See playing-with-a-friend.md.
`);
}

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
  { stdio: 'inherit', env: { ...process.env, HOST_SECRET: secret, PORT: SERVER_PORT } },
);

child.on('exit', (code) => process.exit(code ?? 0));
