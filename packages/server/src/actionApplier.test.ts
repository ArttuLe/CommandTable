import { describe, expect, it } from 'vitest';
import { applyAction } from './actionApplier.js';
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
      { id: ALICE, displayName: 'Alice', seat: 0, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active' },
      { id: BOB, displayName: 'Bob', seat: 1, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active' },
    ],
    turn: { turnNumber: 1, activePlayerId: ALICE, phase: 'main' },
    log: [],
    revision: 0,
    createdAt: 0,
  };
}

describe('applyAction: MOVE_OBJECT', () => {
  it('moves an object to a new zone and increments revision', () => {
    const state = makeState([card({ id: 'c1' })]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'c1', toZone: { playerId: ALICE, zone: 'hand' } });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].zone).toEqual({ playerId: ALICE, zone: 'hand' });
    expect(result.state.revision).toBe(1);
  });

  it('sets hand visibility to the owner only when moved to hand', () => {
    const state = makeState([card({ id: 'c1' })]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'c1', toZone: { playerId: ALICE, zone: 'hand' } });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].faceVisibility).toEqual({ kind: 'players', ids: [ALICE] });
  });

  it('sets battlefield visibility to all when face up', () => {
    const state = makeState([card({ id: 'c1' })]);
    const result = applyAction(state, {
      t: 'MOVE_OBJECT',
      objectId: 'c1',
      toZone: { playerId: ALICE, zone: 'battlefield' },
    });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].faceVisibility).toEqual({ kind: 'all' });
  });

  it('sets battlefield visibility to the controller only when moved face down', () => {
    const state = makeState([card({ id: 'c1', controllerId: BOB })]);
    const result = applyAction(state, {
      t: 'MOVE_OBJECT',
      objectId: 'c1',
      toZone: { playerId: ALICE, zone: 'battlefield' },
      faceDown: true,
    });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['c1'].faceDown).toBe(true);
    expect(result.state.objects['c1'].faceVisibility).toEqual({ kind: 'players', ids: [BOB] });
  });

  it('rejects moving an object that does not exist', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'ghost', toZone: { playerId: ALICE, zone: 'hand' } });
    expect(result.ok).toBe(false);
  });

  it('does not mutate the original state (immutable apply)', () => {
    const state = makeState([card({ id: 'c1' })]);
    applyAction(state, { t: 'MOVE_OBJECT', objectId: 'c1', toZone: { playerId: ALICE, zone: 'hand' } });
    expect(state.objects['c1'].zone).toEqual({ playerId: ALICE, zone: 'library' });
  });

  it('increments the owner\'s commander tax count when a commander is cast from the command zone (§12.2)', () => {
    const state = makeState([card({ id: 'cmd1', zone: { playerId: ALICE, zone: 'commandZone' } })]);
    state.players[0].commanderIds = ['cmd1'];

    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'cmd1', toZone: { zone: 'stack' } });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.players.find((p) => p.id === ALICE)?.commanderCastCount['cmd1']).toBe(1);
  });

  it('increments commander tax again on a second cast', () => {
    let state = makeState([card({ id: 'cmd1', zone: { playerId: ALICE, zone: 'commandZone' } })]);
    state.players[0].commanderIds = ['cmd1'];

    let result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'cmd1', toZone: { zone: 'stack' } });
    if (!result.ok) throw new Error('unreachable');
    result = applyAction(result.state, { t: 'MOVE_OBJECT', objectId: 'cmd1', toZone: { playerId: ALICE, zone: 'commandZone' } });
    if (!result.ok) throw new Error('unreachable');
    result = applyAction(result.state, { t: 'MOVE_OBJECT', objectId: 'cmd1', toZone: { zone: 'stack' } });

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.players.find((p) => p.id === ALICE)?.commanderCastCount['cmd1']).toBe(2);
  });

  it('does not increment tax for a non-commander object moving to the stack', () => {
    const state = makeState([card({ id: 'spell', zone: { playerId: ALICE, zone: 'hand' } })]);
    const result = applyAction(state, { t: 'MOVE_OBJECT', objectId: 'spell', toZone: { zone: 'stack' } });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.players.find((p) => p.id === ALICE)?.commanderCastCount).toEqual({});
  });
});

describe('applyAction: SHUFFLE_LIBRARY', () => {
  it('reassigns library positions via the injected RNG without changing zone or count', () => {
    const state = makeState([
      card({ id: 'l1', position: 0 }),
      card({ id: 'l2', position: 1 }),
      card({ id: 'l3', position: 2 }),
    ]);

    const result = applyAction(state, { t: 'SHUFFLE_LIBRARY', playerId: ALICE }, ALICE, { randomInt: () => 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const positions = ['l1', 'l2', 'l3'].map((id) => result.state.objects[id].position).sort();
    expect(positions).toEqual([0, 1, 2]);
  });

  it('rejects an unknown player id', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'SHUFFLE_LIBRARY', playerId: 'ghost' });
    expect(result.ok).toBe(false);
  });
});

describe('applyAction: DRAW', () => {
  it('moves the top N library cards to hand, in library order', () => {
    const state = makeState([
      card({ id: 'top', position: 0 }),
      card({ id: 'middle', position: 1 }),
      card({ id: 'bottom', position: 2 }),
    ]);

    const result = applyAction(state, { t: 'DRAW', playerId: ALICE, count: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['top'].zone.zone).toBe('hand');
    expect(result.state.objects['middle'].zone.zone).toBe('hand');
    expect(result.state.objects['bottom'].zone.zone).toBe('library');
  });

  it('draws fewer cards than requested if the library runs out, without erroring', () => {
    const state = makeState([card({ id: 'only', position: 0 })]);
    const result = applyAction(state, { t: 'DRAW', playerId: ALICE, count: 5 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['only'].zone.zone).toBe('hand');
  });

  it('sets drawn cards visible to the owner only', () => {
    const state = makeState([card({ id: 'top', position: 0 })]);
    const result = applyAction(state, { t: 'DRAW', playerId: ALICE, count: 1 });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.objects['top'].faceVisibility).toEqual({ kind: 'players', ids: [ALICE] });
  });
});

describe('applyAction: PASS_TURN', () => {
  it('advances to the next seat in player order and increments turn number', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'PASS_TURN' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.turn.activePlayerId).toBe(BOB);
    expect(result.state.turn.turnNumber).toBe(2);
  });

  it('wraps around to the first player after the last', () => {
    const state = makeState([]);
    state.turn.activePlayerId = BOB;
    const result = applyAction(state, { t: 'PASS_TURN' });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.turn.activePlayerId).toBe(ALICE);
  });

  it('skips eliminated or conceded players', () => {
    const state = makeState([]);
    state.players[1].status = 'eliminated';
    state.players.push({ id: 'carol', displayName: 'Carol', seat: 2, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active' });

    const result = applyAction(state, { t: 'PASS_TURN' });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.turn.activePlayerId).toBe('carol');
  });
});

describe('log entries (§15.1: every action produces one)', () => {
  it('appends a public log entry attributed to the given actor, at the new revision', () => {
    const state = makeState([card({ id: 'c1' })]);
    const result = applyAction(state, { t: 'TAP', objectId: 'c1' }, BOB);

    if (!result.ok) throw new Error('unreachable');
    expect(result.state.log).toHaveLength(1);
    expect(result.state.log[0]).toMatchObject({ actorId: BOB, revision: 1, visibility: { kind: 'all' } });
    expect(result.state.log[0].text.length).toBeGreaterThan(0);
  });

  it('does not append a log entry when the action is rejected', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'TAP', objectId: 'ghost' }, ALICE);
    expect(result.ok).toBe(false);
  });

  it('preserves prior log entries and appends rather than replaces', () => {
    let state = makeState([card({ id: 'c1' })]);
    state = unwrap(applyAction(state, { t: 'TAP', objectId: 'c1' }, ALICE));
    state = unwrap(applyAction(state, { t: 'UNTAP', objectId: 'c1' }, BOB));
    expect(state.log).toHaveLength(2);
    expect(state.log.map((e) => e.actorId)).toEqual([ALICE, BOB]);
  });

  it('defaults the actor to a placeholder when none is given', () => {
    const state = makeState([card({ id: 'c1' })]);
    const result = applyAction(state, { t: 'TAP', objectId: 'c1' });
    if (!result.ok) throw new Error('unreachable');
    expect(result.state.log[0].actorId).toBe('system');
  });
});

function unwrap(result: ReturnType<typeof applyAction>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.state;
}
