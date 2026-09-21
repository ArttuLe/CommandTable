import { describe, expect, it } from 'vitest';
import { libraryDirtiedBy, libraryMoveAction } from './libraryMoves.js';

const act = (move: Parameters<typeof libraryMoveAction>[0], libraryCount = 93) =>
  libraryMoveAction(move, 'obj-1', 'me', libraryCount);

describe('libraryMoveAction', () => {
  it('moves a revealed card out of the library', () => {
    expect(act('hand')).toEqual({ t: 'MOVE_OBJECT', objectId: 'obj-1', toZone: { playerId: 'me', zone: 'hand' } });
    expect(act('battlefield')).toEqual({
      t: 'MOVE_OBJECT',
      objectId: 'obj-1',
      toZone: { playerId: 'me', zone: 'battlefield' },
    });
  });

  it('puts a card back on top, where DRAW takes from', () => {
    expect(act('top')).toEqual({
      t: 'MOVE_OBJECT',
      objectId: 'obj-1',
      toZone: { playerId: 'me', zone: 'library' },
      toPosition: 0,
    });
  });

  // SHUFFLE_LIBRARY renumbers positions densely 0..n-1, so the card count is always one past
  // the last card — this is what makes peek usable as a scry.
  it('puts a card below every other card in the library', () => {
    expect(act('bottom', 93)).toMatchObject({ toPosition: 93 });
    expect(act('bottom', 1)).toMatchObject({ toPosition: 1 });
  });

  it('distinguishes top from bottom even when the library is empty', () => {
    expect(act('top', 0)).not.toEqual(act('bottom', 1));
  });
});

describe('libraryDirtiedBy', () => {
  it('owes the table a shuffle after a search', () => {
    expect(libraryDirtiedBy('search')).toBe(true);
  });

  it('never shuffles after a peek — a scry depends on the order it just saw', () => {
    expect(libraryDirtiedBy('peek')).toBe(false);
  });
});
