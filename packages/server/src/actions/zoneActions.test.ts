import { describe, expect, it } from 'vitest';
import { applyAction } from '../actionApplier.js';
import type { GameObject, TableState } from '@command-table/common';

const ALICE = 'alice';
const BOB = 'bob';

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

describe('MILL', () => {
  it('moves the top N library cards to the graveyard, visible to all', () => {
    const state = makeState([
      card({ id: 'top', position: 0 }),
      card({ id: 'mid', position: 1 }),
      card({ id: 'bottom', position: 2 }),
    ]);
    const next = unwrap(state, { t: 'MILL', playerId: ALICE, count: 2 });
    expect(next.objects['top'].zone.zone).toBe('graveyard');
    expect(next.objects['top'].faceVisibility).toEqual({ kind: 'all' });
    expect(next.objects['mid'].zone.zone).toBe('graveyard');
    expect(next.objects['bottom'].zone.zone).toBe('library');
  });
});

describe('PEEK_TOP', () => {
  it('reveals the top N cards to the owner only, without moving them', () => {
    const state = makeState([card({ id: 'top', position: 0 }), card({ id: 'bottom', position: 1 })]);
    const next = unwrap(state, { t: 'PEEK_TOP', playerId: ALICE, count: 1 });
    expect(next.objects['top'].faceVisibility).toEqual({ kind: 'players', ids: [ALICE] });
    expect(next.objects['top'].zone.zone).toBe('library');
    expect(next.objects['bottom'].faceVisibility).toEqual({ kind: 'none' });
  });
});

describe('REVEAL / HIDE', () => {
  it('REVEAL sets arbitrary visibility without changing zone', () => {
    const state = makeState([card({ id: 'c1', zone: { playerId: ALICE, zone: 'hand' } })]);
    const next = unwrap(state, { t: 'REVEAL', objectId: 'c1', to: { kind: 'players', ids: [ALICE, BOB] } });
    expect(next.objects['c1'].faceVisibility).toEqual({ kind: 'players', ids: [ALICE, BOB] });
    expect(next.objects['c1'].zone.zone).toBe('hand');
  });

  it('HIDE reverts to the zone\'s default visibility', () => {
    let state = makeState([card({ id: 'c1', zone: { playerId: ALICE, zone: 'hand' } })]);
    state = unwrap(state, { t: 'REVEAL', objectId: 'c1', to: { kind: 'all' } });
    state = unwrap(state, { t: 'HIDE', objectId: 'c1' });
    expect(state.objects['c1'].faceVisibility).toEqual({ kind: 'players', ids: [ALICE] });
  });
});

describe('SEARCH_LIBRARY', () => {
  it('reveals the entire library to its owner without moving or reordering it', () => {
    const state = makeState([card({ id: 'a', position: 0 }), card({ id: 'b', position: 1 })]);
    const next = unwrap(state, { t: 'SEARCH_LIBRARY', playerId: ALICE });
    expect(next.objects['a'].faceVisibility).toEqual({ kind: 'players', ids: [ALICE] });
    expect(next.objects['b'].faceVisibility).toEqual({ kind: 'players', ids: [ALICE] });
    expect(next.objects['a'].zone.zone).toBe('library');
    expect(next.objects['a'].position).toBe(0);
  });

  it('a later SHUFFLE_LIBRARY re-hides everything searched', () => {
    let state = makeState([card({ id: 'a', position: 0 }), card({ id: 'b', position: 1 })]);
    state = unwrap(state, { t: 'SEARCH_LIBRARY', playerId: ALICE });
    const result = applyAction(state, { t: 'SHUFFLE_LIBRARY', playerId: ALICE }, ALICE, { randomInt: () => 0 });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['a'].faceVisibility).toEqual({ kind: 'none' });
    expect(result.state.objects['b'].faceVisibility).toEqual({ kind: 'none' });
  });
});

describe('MOVE_ALL', () => {
  it('moves every object from one zone to another, recomputing visibility per destination', () => {
    const state = makeState([
      card({ id: 'h1', zone: { playerId: ALICE, zone: 'hand' }, faceVisibility: { kind: 'players', ids: [ALICE] } }),
      card({ id: 'h2', zone: { playerId: ALICE, zone: 'hand' }, faceVisibility: { kind: 'players', ids: [ALICE] } }),
      card({ id: 'other', zone: { playerId: BOB, zone: 'hand' } }),
    ]);
    const next = unwrap(state, {
      t: 'MOVE_ALL',
      fromZone: { playerId: ALICE, zone: 'hand' },
      toZone: { playerId: ALICE, zone: 'graveyard' },
    });
    expect(next.objects['h1'].zone.zone).toBe('graveyard');
    expect(next.objects['h1'].faceVisibility).toEqual({ kind: 'all' });
    expect(next.objects['h2'].zone.zone).toBe('graveyard');
    expect(next.objects['other'].zone.zone).toBe('hand');
  });

  it('strips battlefield state on the way out, like MOVE_OBJECT does (CR 400.7)', () => {
    const state = makeState([
      card({
        id: 'wiped',
        zone: { playerId: ALICE, zone: 'battlefield' },
        tapped: true,
        counters: { '+1/+1': 2 },
        markers: ['attacking'],
      }),
    ]);
    const next = unwrap(state, {
      t: 'MOVE_ALL',
      fromZone: { playerId: ALICE, zone: 'battlefield' },
      toZone: { playerId: ALICE, zone: 'graveyard' },
    });
    expect(next.objects['wiped']).toMatchObject({ tapped: false, counters: {}, markers: [] });
  });
});

describe('MOVE_ALL: the same new-object rules as MOVE_OBJECT', () => {
  it('turns face-down cards face up and lets everyone see them', () => {
    const state = makeState([card({ id: 'm', zone: { playerId: ALICE, zone: 'battlefield' }, faceDown: true, faceVisibility: { kind: 'players', ids: [ALICE] } })]);
    const result = applyAction(state, { t: 'MOVE_ALL', fromZone: { playerId: ALICE, zone: 'battlefield' }, toZone: { playerId: ALICE, zone: 'exile' } });
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.objects['m']).toMatchObject({ faceDown: false, faceVisibility: { kind: 'all' } });
  });

  it('puts the moved cards under the library, not tied with its top card', () => {
    const state = makeState([
      card({ id: 'top', zone: { playerId: ALICE, zone: 'library' }, position: 0 }),
      card({ id: 'g1', zone: { playerId: ALICE, zone: 'graveyard' } }),
      card({ id: 'g2', zone: { playerId: ALICE, zone: 'graveyard' } }),
    ]);
    const result = applyAction(state, { t: 'MOVE_ALL', fromZone: { playerId: ALICE, zone: 'graveyard' }, toZone: { playerId: ALICE, zone: 'library' } });
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.objects['top'].position).toBe(0);
    expect([result.state.objects['g1'].position, result.state.objects['g2'].position].sort()).toEqual([1, 2]);
  });
});
