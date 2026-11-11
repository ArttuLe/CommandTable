// Which numbered rows a player's rail shows, and in what order.
//
// All four zones are always listed, at zero as much as at ninety-nine: a row that came and went
// would move every row under it, and "graveyard: 0" is itself information you read across the
// table. Mulligans are the exception — they are settled before the game starts and are absent
// from most games entirely, so they earn a row only when there were any. That is the same rule
// the poison and commander-damage badges follow (see vitals.ts).

import type { PlayerState } from '@command-table/common';

export interface RailCount {
  key: string;
  label: string;
  value: number;
}

/** Hand and library are counted by the server; graveyard and exile are public and counted
    off the projection. The caller does that counting — this only decides what is shown. */
export interface ZoneCounts {
  hand: number;
  library: number;
  graveyard: number;
  exile: number;
}

export function railCounts(player: PlayerState, zones: ZoneCounts): RailCount[] {
  const mulligans = player.counters.mulligan ?? 0;
  return [
    { key: 'hand', label: 'Hand', value: zones.hand },
    { key: 'library', label: 'Library', value: zones.library },
    { key: 'graveyard', label: 'Graveyard', value: zones.graveyard },
    { key: 'exile', label: 'Exile', value: zones.exile },
    ...(mulligans > 0 ? [{ key: 'mulligan', label: 'Mulligans', value: mulligans }] : []),
  ];
}
