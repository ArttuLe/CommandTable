import { describe, expect, it } from 'vitest';
import { railCounts } from './railCounts.js';
import type { PlayerState } from '@command-table/common';

const player = (counters: Record<string, number> = {}) => ({ counters }) as PlayerState;
const zones = { hand: 7, library: 92, graveyard: 3, exile: 1 };

describe('railCounts', () => {
  it('lists the four zones in a fixed order', () => {
    expect(railCounts(player(), zones)).toEqual([
      { key: 'hand', label: 'Hand', value: 7 },
      { key: 'library', label: 'Library', value: 92 },
      { key: 'graveyard', label: 'Graveyard', value: 3 },
      { key: 'exile', label: 'Exile', value: 1 },
    ]);
  });

  // An empty graveyard is a fact about the table, and a row that vanished at zero would shift
  // every row under it the first time somebody's creature died.
  it('keeps every zone row at zero', () => {
    const empty = railCounts(player(), { hand: 0, library: 0, graveyard: 0, exile: 0 });
    expect(empty.map((c) => c.key)).toEqual(['hand', 'library', 'graveyard', 'exile']);
  });

  it('adds a mulligan row only once there have been mulligans', () => {
    expect(railCounts(player(), zones).map((c) => c.key)).not.toContain('mulligan');
    expect(railCounts(player({ mulligan: 0 }), zones).map((c) => c.key)).not.toContain('mulligan');

    expect(railCounts(player({ mulligan: 2 }), zones).at(-1)).toEqual({
      key: 'mulligan',
      label: 'Mulligans',
      value: 2,
    });
  });

  // Poison shares the counters bag with mulligans and must not be mistaken for one.
  it('ignores counters that are not mulligans', () => {
    expect(railCounts(player({ poison: 4 }), zones)).toHaveLength(4);
  });
});
