// The one piece of authentication in the stack (which otherwise assumes a known friend group on a
// trusted network). It exists because the host runs this on their own laptop: the transport
// decides who can reach the port, this decides who can sit down at the table.

import { timingSafeEqual } from 'node:crypto';
import { generateRoomCode } from './roomCode.js';

// `persisted` is the passphrase a previous run generated and saved (sessionStore.ts). Reusing it
// is what lets a restart be invisible to players: a freshly generated one would be correct but
// would lock out everyone holding the old one, defeating the point of restoring their games.
// An explicit HOST_SECRET always wins — the host asked for that one.
export function resolveHostSecret(env: { HOST_SECRET?: string }, persisted?: string): string {
  return env.HOST_SECRET || persisted || generateRoomCode();
}

export function checkSecret(expected: string, provided: string | undefined): boolean {
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  // timingSafeEqual throws on length mismatch, so the length comparison has to happen first —
  // it leaks the secret's length, which is not the part worth protecting.
  return a.length === b.length && timingSafeEqual(a, b);
}
