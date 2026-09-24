// HTTP side of the server API (room creation, card lookups). The WebSocket side lives in
// store.ts.
//
// The server host is taken from whatever hostname the page was loaded from, so the same build
// works unchanged whether you opened it as localhost, a LAN address, or the hosting machine's
// tailnet name (see playing-with-a-friend.md). Only the port is configurable, and only
// because the server's PORT is.

import type { Card } from '@command-table/common';

const SERVER_PORT = import.meta.env.VITE_SERVER_PORT ?? '8080';
const SERVER_HOST = `${window.location.hostname}:${SERVER_PORT}`;

const HTTP_BASE = `http://${SERVER_HOST}`;
export const WS_URL = `ws://${SERVER_HOST}/ws`;

export async function createRoom(secret: string): Promise<string> {
  const res = await fetch(`${HTTP_BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'X-Host-Secret': secret },
  });
  if (!res.ok) throw new Error('wrong passphrase');
  const body = (await res.json()) as { roomId: string };
  return body.roomId;
}

const cardCache = new Map<string, Card | null>();

export async function fetchCard(scryfallId: string): Promise<Card | null> {
  if (cardCache.has(scryfallId)) {
    return cardCache.get(scryfallId) ?? null;
  }
  const res = await fetch(`${HTTP_BASE}/api/cards/${encodeURIComponent(scryfallId)}`);
  const card = res.ok ? ((await res.json()) as Card) : null;
  cardCache.set(scryfallId, card);
  return card;
}

// Dev-only (see devRoute.ts): asks the server for a seat at a table it has already built and
// started. Returns the credentials the store's `resume` wants — a rejoin token is the only way
// into a game that is already running.
export async function joinDevTable(
  playerAmount: number,
  playerName: string
): Promise<{ roomId: string; displayName: string; rejoinToken: string }> {
  const res = await fetch(`${HTTP_BASE}/api/devtest/${playerAmount}/${encodeURIComponent(playerName)}`);
  if (!res.ok) throw new Error(`no dev table at ${SERVER_HOST} — is that server running with DEV_MODE=1? (${res.status})`);
  return res.json();
}
