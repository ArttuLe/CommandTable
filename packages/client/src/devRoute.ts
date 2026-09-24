// `/devtest/:playerAmount/:playerName` — the dev-only shortcut into a table that is already
// running (see packages/server/src/devtest/devTable.ts). Pure parsing, so the one piece of
// routing in an app that otherwise has none is testable without a browser.

export interface DevRoute {
  playerAmount: number;
  playerName: string;
}

// Mirrors MIN_DEV_PLAYERS / MAX_DEV_PLAYERS on the server; the server is the one that enforces
// it, this just avoids asking for a table it would refuse.
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

export function parseDevRoute(pathname: string): DevRoute | null {
  const match = /^\/devtest\/(\d+)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;

  const playerAmount = Number(match[1]);
  if (playerAmount < MIN_PLAYERS || playerAmount > MAX_PLAYERS) return null;

  const playerName = decodeURIComponent(match[2]).trim();
  if (!playerName) return null;

  return { playerAmount, playerName };
}
