// Whose turn it is, and how each board should be marked for it.
//
// `TurnTracker` has been in every projection since Phase 2 but was never rendered — the only way
// to tell whose turn it was, was to read the log. The highlight is deliberately two states, not a
// per-seat color palette: one accent for "the active player" and a distinct one for "that's you"
// means reading one fact, not remembering four colors.

import type { PlayerId, TurnTracker } from '@command-table/common';

export type TurnHighlight = 'mine' | 'theirs' | null;

export function turnHighlight(playerId: PlayerId, turn: TurnTracker, myId: PlayerId): TurnHighlight {
  if (playerId !== turn.activePlayerId) return null;
  return playerId === myId ? 'mine' : 'theirs';
}

/** The top bar's status line: "Turn 4 — Your turn" / "Turn 4 — Alice's turn". */
export function turnLabel(
  turn: TurnTracker,
  players: readonly { id: PlayerId; displayName: string }[],
  myId: PlayerId
): string {
  if (turn.activePlayerId === myId) return `Turn ${turn.turnNumber} — Your turn`;
  const active = players.find((p) => p.id === turn.activePlayerId);
  return `Turn ${turn.turnNumber} — ${active ? `${active.displayName}'s turn` : 'unknown player'}`;
}

/**
 * PASS_TURN advances the table from whoever is active, so pressing it on someone else's turn
 * ends *their* turn — a misclick (or a stray "P") that nothing undoes for them. On your own turn
 * it stays a single click.
 */
export function passTurnWarning(activeName: string): string {
  return `It is ${activeName}'s turn. Passing now ends ${activeName}'s turn. Pass anyway?`;
}
