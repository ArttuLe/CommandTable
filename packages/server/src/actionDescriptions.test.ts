import { describe, expect, it } from 'vitest';
import type { Action, PlayerState, TableState } from '@command-table/common';
import { describeAction as describeOnTable } from './actionDescriptions.js';

const P = 'p1';
const BOB = 'p2';

function table(alice: Partial<PlayerState> = {}, bob: Partial<PlayerState> = {}): TableState {
  const player = (id: string, displayName: string, overrides: Partial<PlayerState>): PlayerState => ({
    id, displayName, seat: 0, connected: true, life: 40, counters: {}, commanderDamageTaken: {},
    commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false, ...overrides,
  });
  return { players: [player(P, 'Alice', alice), player(BOB, 'Bob', bob)] } as TableState;
}

/** Lines that only read the action, taken by Alice on an unchanged table. */
const describeAction = (action: Action) => describeOnTable(action, table(), table(), P);

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

// The log is the referee, and life totals are what tables argue about: every line carries the
// amount and the result, and names the player when it wasn't the actor's own total.
describe('describeAction: life, poison and commander damage', () => {
  const life = (playerIds: string[], was: Partial<PlayerState>, now: Partial<PlayerState>, wasBob = {}, nowBob = {}) =>
    describeOnTable({ t: 'SET_LIFE', playerIds, update: { mode: 'delta', amount: 0 } }, table(was, wasBob), table(now, nowBob), P);

  it('says how much life changed and what it came to', () => {
    expect(life([P], { life: 40 }, { life: 37 })).toBe('lost 3 life (40 → 37)');
    expect(life([P], { life: 37 }, { life: 39 })).toBe('gained 2 life (37 → 39)');
    expect(life([BOB], {}, {}, { life: 40 }, { life: 35 })).toBe('made Bob lose 5 life (40 → 35)');
    expect(life([BOB], {}, {}, { life: 35 }, { life: 36 })).toBe('made Bob gain 1 life (35 → 36)');
  });

  it('gives each player their own result when one change hits several', () => {
    expect(life([P, BOB], { life: 40 }, { life: 37 }, { life: 20 }, { life: 17 })).toBe(
      'changed 2 life totals: Alice lost 3 (40 → 37), Bob lost 3 (20 → 17)'
    );
  });

  it('counts poison the same way, and leaves other player counters with just their result', () => {
    const counter = (playerId: string, key: string, was: number, now: number) =>
      describeOnTable(
        { t: 'SET_PLAYER_COUNTER', playerId, key, update: { mode: 'delta', amount: 0 } },
        table({ counters: { [key]: was } }, { counters: { [key]: was } }),
        table({ counters: { [key]: now } }, { counters: { [key]: now } }),
        P
      );
    expect(counter(P, 'poison', 0, 2)).toBe('took 2 poison (0 → 2)');
    expect(counter(P, 'poison', 2, 1)).toBe('removed 1 poison (2 → 1)');
    expect(counter(BOB, 'poison', 3, 5)).toBe('gave Bob 2 poison (3 → 5)');
    expect(counter(BOB, 'poison', 5, 3)).toBe('removed 2 poison from Bob (5 → 3)');
    expect(counter(P, 'energy', 0, 2)).toBe("changed the 'energy' counter (0 → 2)");
    expect(counter(BOB, 'energy', 2, 1)).toBe("changed Bob's 'energy' counter (2 → 1)");
  });

  // "a card" is the commander, which the client names (logText.ts).
  it('says how much commander damage changed, from which commander, and what it came to', () => {
    const damage = (toPlayerId: string, was: number, now: number) =>
      describeOnTable(
        { t: 'SET_COMMANDER_DAMAGE', toPlayerId, fromCommanderObjectId: 'cmd', update: { mode: 'delta', amount: 0 } },
        table({ commanderDamageTaken: { cmd: was } }, { commanderDamageTaken: { cmd: was } }),
        table({ commanderDamageTaken: { cmd: now } }, { commanderDamageTaken: { cmd: now } }),
        P
      );
    expect(damage(P, 0, 4)).toBe('took 4 commander damage from a card (0 → 4)');
    expect(damage(P, 4, 3)).toBe('took back 1 commander damage from a card (4 → 3)');
    expect(damage(BOB, 17, 21)).toBe('gave Bob 4 commander damage from a card (17 → 21)');
    expect(damage(BOB, 21, 17)).toBe("took back 4 of Bob's commander damage from a card (21 → 17)");
  });
});
