import { describe, expect, it } from 'vitest';
import type { TurnTracker } from '@command-table/common';
import { turnHighlight, turnLabel } from './turnStatus.js';

const turn = (activePlayerId: string, turnNumber = 1): TurnTracker => ({
  turnNumber,
  activePlayerId,
  phase: 'main',
});

const players = [
  { id: 'me', displayName: 'Eetu' },
  { id: 'b', displayName: 'Alice' },
];

describe('turnHighlight', () => {
  it('marks the active player as theirs when it is someone else', () => {
    expect(turnHighlight('b', turn('b'), 'me')).toBe('theirs');
  });

  it('distinguishes your own turn from an opponent’s', () => {
    expect(turnHighlight('me', turn('me'), 'me')).toBe('mine');
  });

  it('leaves every inactive board unmarked', () => {
    expect(turnHighlight('me', turn('b'), 'me')).toBeNull();
    expect(turnHighlight('c', turn('b'), 'me')).toBeNull();
  });
});

describe('turnLabel', () => {
  it('says "Your turn" rather than your own name', () => {
    expect(turnLabel(turn('me', 4), players, 'me')).toBe('Turn 4 — Your turn');
  });

  it('names the active opponent', () => {
    expect(turnLabel(turn('b', 4), players, 'me')).toBe("Turn 4 — Alice's turn");
  });

  it('degrades gracefully if the active player is not in the list', () => {
    expect(turnLabel(turn('ghost', 2), players, 'me')).toBe('Turn 2 — unknown player');
  });
});
