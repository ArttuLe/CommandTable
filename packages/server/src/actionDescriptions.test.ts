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

describe('describeAction: markers', () => {
  const set = (marker: string) => describeAction({ t: 'SET_MARKER', objectId: 'o1', marker });
  const clear = (marker: string) => describeAction({ t: 'CLEAR_MARKER', objectId: 'o1', marker });
  const ID = '8f6ef480-fa88-4d74-8248-8283d12dfda8';

  // Combat markers carry an object id in the string (markers.ts) — the log is read by people, and
  // "set the 'block:8f6e…' marker" is the model talking to them.
  it('says what a combat marker means, and never prints the id inside it', () => {
    expect(set('attacking')).toBe('declared an attacker');
    expect(clear('attacking')).toBe('took back an attack');
    expect(set(`block:${ID}`)).toBe('declared a block');
    expect(clear(`block:${ID}`)).toBe('took back a block');
    expect(set(`target:${ID}`)).toBe('pointed a card at a target');
    expect(clear(`target:${ID}`)).toBe('cleared a target');
    for (const line of [set(`block:${ID}`), clear(`target:${ID}`)]) expect(line).not.toContain(ID);
  });

  it('quotes a label, which is the players’ own word', () => {
    expect(set('flying')).toBe("labelled a card 'flying'");
    expect(clear('flying')).toBe("took the 'flying' label off a card");
  });
});
