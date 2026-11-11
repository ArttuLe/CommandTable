import { describe, expect, it } from 'vitest';
import { applyAction } from '../actionApplier.js';
import type { GameObject, TableState } from '@command-table/common';

const ALICE = 'alice';
const BOB = 'bob';
const CAROL = 'carol';

function card(overrides: Partial<GameObject>): GameObject {
  return {
    id: 'obj',
    ownerId: ALICE,
    controllerId: ALICE,
    source: { kind: 'card', scryfallId: 's', oracleId: 'o' },
    zone: { playerId: ALICE, zone: 'library' },
    position: 0,
    faceVisibility: { kind: 'none' },
    faceDown: false,
    currentFace: 0,
    tapped: false,
    flipped: false,
    counters: {},
    attachedTo: null,
    annotation: null,
    markers: [],
    ...overrides,
  };
}

function makeState(objects: GameObject[]): TableState {
  return {
    roomId: 'ROOM1',
    objects: Object.fromEntries(objects.map((o) => [o.id, o])),
    players: [
      { id: ALICE, displayName: 'Alice', seat: 0, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false },
      { id: BOB, displayName: 'Bob', seat: 1, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false },
      { id: CAROL, displayName: 'Carol', seat: 2, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false },
    ],
    turn: { turnNumber: 1, activePlayerId: ALICE, phase: 'main' },
    log: [],
    revision: 0,
    createdAt: 0,
    setupComplete: true,
  };
}

function unwrap(state: TableState, action: Parameters<typeof applyAction>[1]) {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.state;
}

describe('SET_LIFE', () => {
  it('applies a delta to a single player', () => {
    const state = makeState([]);
    const next = unwrap(state, { t: 'SET_LIFE', playerIds: [ALICE], update: { mode: 'delta', amount: -3 } });
    expect(next.players.find((p) => p.id === ALICE)?.life).toBe(37);
    expect(next.players.find((p) => p.id === BOB)?.life).toBe(40);
  });

  it('applies the same change to multiple players at once (Blasphemous Act)', () => {
    const state = makeState([]);
    const next = unwrap(state, { t: 'SET_LIFE', playerIds: [ALICE, BOB, CAROL], update: { mode: 'delta', amount: -13 } });
    expect(next.players.map((p) => p.life)).toEqual([27, 27, 27]);
  });

  it('sets an absolute value', () => {
    const state = makeState([]);
    const next = unwrap(state, { t: 'SET_LIFE', playerIds: [ALICE], update: { mode: 'set', amount: 1 } });
    expect(next.players.find((p) => p.id === ALICE)?.life).toBe(1);
  });

  it('rejects an unknown player id in the batch', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'SET_LIFE', playerIds: [ALICE, 'ghost'], update: { mode: 'delta', amount: -1 } });
    expect(result.ok).toBe(false);
  });
});

describe('SET_PLAYER_COUNTER', () => {
  it('sets an arbitrary player counter', () => {
    const state = makeState([]);
    const next = unwrap(state, { t: 'SET_PLAYER_COUNTER', playerId: ALICE, key: 'poison', update: { mode: 'delta', amount: 3 } });
    expect(next.players.find((p) => p.id === ALICE)?.counters.poison).toBe(3);
  });
});

describe('SET_COMMANDER_DAMAGE', () => {
  it('tracks damage keyed by the source commander object id', () => {
    const state = makeState([card({ id: 'cmd1' })]);
    const next = unwrap(state, {
      t: 'SET_COMMANDER_DAMAGE',
      toPlayerId: BOB,
      fromCommanderObjectId: 'cmd1',
      update: { mode: 'delta', amount: 21 },
    });
    expect(next.players.find((p) => p.id === BOB)?.commanderDamageTaken['cmd1']).toBe(21);
  });

  it('rejects a nonexistent commander object', () => {
    const state = makeState([]);
    const result = applyAction(state, {
      t: 'SET_COMMANDER_DAMAGE',
      toPlayerId: BOB,
      fromCommanderObjectId: 'ghost',
      update: { mode: 'delta', amount: 1 },
    });
    expect(result.ok).toBe(false);
  });
});

describe('MULLIGAN', () => {
  it('shuffles the hand back into the library, draws a fresh 7, and increments the mulligan counter', () => {
    const hand = Array.from({ length: 7 }, (_, i) =>
      card({ id: `hand-${i}`, zone: { playerId: ALICE, zone: 'hand' }, faceVisibility: { kind: 'players', ids: [ALICE] } })
    );
    const library = Array.from({ length: 10 }, (_, i) => card({ id: `lib-${i}`, position: i }));
    const state = makeState([...hand, ...library]);

    const next = unwrap(state, { t: 'MULLIGAN', playerId: ALICE });

    const newHand = Object.values(next.objects).filter(
      (o) => 'playerId' in o.zone && o.zone.playerId === ALICE && o.zone.zone === 'hand'
    );
    const newLibrary = Object.values(next.objects).filter(
      (o) => 'playerId' in o.zone && o.zone.playerId === ALICE && o.zone.zone === 'library'
    );
    expect(newHand).toHaveLength(7);
    expect(newLibrary).toHaveLength(10);
    expect(next.players.find((p) => p.id === ALICE)?.counters.mulligan).toBe(1);
  });

  it('increments the mulligan counter again on a second mulligan', () => {
    const hand = Array.from({ length: 7 }, (_, i) => card({ id: `hand-${i}`, zone: { playerId: ALICE, zone: 'hand' } }));
    const library = Array.from({ length: 10 }, (_, i) => card({ id: `lib-${i}`, position: i }));
    let state = makeState([...hand, ...library]);
    state = unwrap(state, { t: 'MULLIGAN', playerId: ALICE });
    state = unwrap(state, { t: 'MULLIGAN', playerId: ALICE });
    expect(state.players.find((p) => p.id === ALICE)?.counters.mulligan).toBe(2);
  });
});

describe('the opening-hand step', () => {
  it('records that a player has settled on their hand', () => {
    const state = makeState([]);
    const next = unwrap(state, { t: 'KEEP_HAND', playerId: ALICE });

    expect(next.players.find((p) => p.id === ALICE)?.keptHand).toBe(true);
    expect(next.players.find((p) => p.id === BOB)?.keptHand).toBe(false);
  });

  it('un-keeps a hand that is then mulliganed away', () => {
    let state = makeState([]);
    state = unwrap(state, { t: 'KEEP_HAND', playerId: ALICE });
    state = unwrap(state, { t: 'MULLIGAN', playerId: ALICE });

    expect(state.players.find((p) => p.id === ALICE)?.keptHand).toBe(false);
  });

  it('rejects keeping a hand for a player who is not at the table', () => {
    expect(applyAction(makeState([]), { t: 'KEEP_HAND', playerId: 'nobody' }).ok).toBe(false);
  });

  it('ends the setup step when the host begins play', () => {
    const state = { ...makeState([]), setupComplete: false };
    expect(unwrap(state, { t: 'BEGIN_PLAY' }).setupComplete).toBe(true);
  });

  // Never block a legal play. A player who has wandered off must not be able to hold the
  // table hostage — the client warns the host instead.
  it('lets the host begin play even with hands still unkept', () => {
    const state = { ...makeState([]), setupComplete: false };
    const next = unwrap(state, { t: 'BEGIN_PLAY' });

    expect(next.setupComplete).toBe(true);
    expect(next.players.every((p) => !p.keptHand)).toBe(true);
  });
});
