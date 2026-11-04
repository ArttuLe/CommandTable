// When a game is over. Nothing enforces the rules, so nothing decides a loss but the player:
// a game is over when everyone but one has conceded — and until now that moment passed without a
// word, the last memory of a multi-hour game being "End game" in a gear menu.

import type { PlayerState } from '@command-table/common';

export function winnerOf(players: readonly PlayerState[]): PlayerState | null {
  if (players.length < 2) return null;
  const stillIn = players.filter((p) => p.status === 'active');
  return stillIn.length === 1 ? stillIn[0] : null;
}
