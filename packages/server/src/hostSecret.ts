// The one piece of authentication in the stack (§2 otherwise assumes a known friend group on a
// trusted network). It exists because the host runs this on their own laptop: the transport
// decides who can reach the port, this decides who can sit down at the table.

import { timingSafeEqual } from 'node:crypto';
import { generateRoomCode } from './roomCode.js';

export function resolveHostSecret(env: { HOST_SECRET?: string }): string {
  return env.HOST_SECRET || generateRoomCode();
}

export function checkSecret(expected: string, provided: string | undefined): boolean {
  if (provided === undefined) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  // timingSafeEqual throws on length mismatch, so the length comparison has to happen first —
  // it leaks the secret's length, which is not the part worth protecting.
  return a.length === b.length && timingSafeEqual(a, b);
}
