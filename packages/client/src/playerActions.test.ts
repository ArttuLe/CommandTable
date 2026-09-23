import { describe, expect, it, vi } from 'vitest';
import type { Action } from '@command-table/common';
import { playerActionGroups, type PlayerDialog } from './playerActions.js';

function build() {
  const act = vi.fn<(action: Action) => void>();
  const openDialog = vi.fn<(dialog: PlayerDialog) => void>();
  const lookAtLibrary = vi.fn();
  const groups = playerActionGroups({ playerId: 'p1', act, openDialog, lookAtLibrary });
  const item = (label: string) => groups.flatMap((g) => g.items).find((i) => i.label === label)!;
  return { groups, item, act, openDialog, lookAtLibrary };
}

describe('playerActionGroups', () => {
  it('offers every action the More ⋯ menu did, in the same order', () => {
    const { groups } = build();
    expect(groups.map((g) => [g.title, g.items.map((i) => i.label)])).toEqual([
      ['Library', ['Shuffle', 'Search library', 'Peek / Scry…', 'Mill…', 'Mulligan']],
      ['Table', ['Adjust all life…', 'Clear all markers', 'Create token…']],
      ['Random', ['Roll dice…', 'Flip coin']],
      [null, ['Concede']],
    ]);
  });

  it('dispatches the ones that need no answer straight away', () => {
    const { item, act } = build();
    item('Shuffle').run();
    expect(act).toHaveBeenCalledWith({ t: 'SHUFFLE_LIBRARY', playerId: 'p1' });
  });

  it('opens the library for a search, since the action itself is invisible until you look', () => {
    const { item, act, lookAtLibrary } = build();
    item('Search library').run();
    expect(act).toHaveBeenCalledWith({ t: 'SEARCH_LIBRARY', playerId: 'p1' });
    expect(lookAtLibrary).toHaveBeenCalledWith('search');
  });

  it('defers the ones that have a question to ask', () => {
    const { item, openDialog, act } = build();
    item('Mill…').run();
    expect(openDialog).toHaveBeenCalledWith('mill');
    expect(act).not.toHaveBeenCalled();
  });

  it('marks only Concede as dangerous', () => {
    const { groups } = build();
    const dangerous = groups.flatMap((g) => g.items).filter((i) => i.danger);
    expect(dangerous.map((i) => i.label)).toEqual(['Concede']);
  });
});
