// HTTP side of the server API (room creation, card lookups). The WebSocket side lives in
// store.ts. No env-based configuration yet — this only runs against a local dev server so far
// (§4/§14.5 haven't been reached: there's no deployment story to configure for).

import type { Card } from '@command-table/common';

const HTTP_BASE = 'http://localhost:8080';
export const WS_URL = 'ws://localhost:8080/ws';

export async function createRoom(): Promise<string> {
  const res = await fetch(`${HTTP_BASE}/api/rooms`, { method: 'POST' });
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
