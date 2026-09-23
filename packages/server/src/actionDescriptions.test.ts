import { describe, expect, it } from 'vitest';
import { describeAction } from './actionDescriptions.js';

const P = 'p1';

describe('describeAction: MOVE_OBJECT', () => {
  it('names the zone the card landed in, which is the part everyone is watching for', () => {
    const to = (zone: 'hand' | 'graveyard' | 'exile' | 'battlefield' | 'commandZone') =>
      describeAction({ t: 'MOVE_OBJECT', objectId: 'o1', toZone: { playerId: P, zone } });

    expect(to('hand')).toBe('moved a card to a hand');
    expect(to('graveyard')).toBe('moved a card to a graveyard');
    expect(to('exile')).toBe('moved a card to exile');
    expect(to('battlefield')).toBe('moved a card to the battlefield');
    expect(to('commandZone')).toBe('moved a card to the command zone');
  });

  it('distinguishes the two ends of a library, since which one matters to a scry', () => {
    const lib = (toPosition?: number) =>
      describeAction({ t: 'MOVE_OBJECT', objectId: 'o1', toZone: { playerId: P, zone: 'library' }, toPosition });

    expect(lib(0)).toBe('moved a card to the top of a library');
    expect(lib()).toBe('moved a card into a library');
    expect(lib(3)).toBe('moved a card into a library');
  });

  it('handles the two table-level zones, which have no owner', () => {
    expect(describeAction({ t: 'MOVE_OBJECT', objectId: 'o1', toZone: { zone: 'stack' } })).toBe(
      'moved a card to the stack'
    );
    expect(describeAction({ t: 'MOVE_OBJECT', objectId: 'o1', toZone: { zone: 'limbo' } })).toBe(
      'moved a card out of the game'
    );
  });
});
