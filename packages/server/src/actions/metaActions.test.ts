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
    zone: { playerId: ALICE, zone: 'battlefield' },
    position: 0,
    faceVisibility: { kind: 'all' },
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

function unwrap(state: TableState, action: Parameters<typeof applyAction>[1], actorId = ALICE, deps?: Parameters<typeof applyAction>[3]) {
  const result = applyAction(state, action, actorId, deps);
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.state;
}

describe('ROLL_DICE', () => {
  it('logs the result of the injected RNG, 1-indexed', () => {
    const state = makeState([]);
    const next = unwrap(state, { t: 'ROLL_DICE', playerId: ALICE, sides: 6 }, ALICE, { randomInt: () => 3 });
    expect(next.log.at(-1)?.text).toBe('rolled a d6: 4');
  });

  it('rejects a die with fewer than 2 sides', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'ROLL_DICE', playerId: ALICE, sides: 1 }, ALICE);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown player', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'ROLL_DICE', playerId: 'ghost', sides: 6 }, ALICE);
    expect(result.ok).toBe(false);
  });
});

describe('FLIP_COIN', () => {
  it('logs heads or tails based on the injected RNG', () => {
    const state = makeState([]);
    const heads = unwrap(state, { t: 'FLIP_COIN', playerId: ALICE }, ALICE, { randomInt: () => 0 });
    expect(heads.log.at(-1)?.text).toBe('flipped a coin: heads');
    const tails = unwrap(state, { t: 'FLIP_COIN', playerId: ALICE }, ALICE, { randomInt: () => 1 });
    expect(tails.log.at(-1)?.text).toBe('flipped a coin: tails');
  });
});

describe('SAY', () => {
  it('logs the literal chat text, publicly', () => {
    const state = makeState([]);
    const next = unwrap(state, { t: 'SAY', playerId: ALICE, text: 'good luck, have fun' });
    expect(next.log.at(-1)).toMatchObject({ text: 'good luck, have fun', visibility: { kind: 'all' } });
  });
});

describe('CONCEDE', () => {
  it('moves everything the conceding player owns to limbo, hidden', () => {
    const state = makeState([card({ id: 'mine', ownerId: ALICE, controllerId: ALICE })]);
    const next = unwrap(state, { t: 'CONCEDE', playerId: ALICE });
    expect(next.objects['mine'].zone).toEqual({ zone: 'limbo' });
    expect(next.objects['mine'].faceVisibility).toEqual({ kind: 'none' });
  });

  it('reverts control of objects it controls but does not own, back to their owner', () => {
    const state = makeState([card({ id: 'stolen', ownerId: BOB, controllerId: ALICE, zone: { playerId: ALICE, zone: 'battlefield' } })]);
    const next = unwrap(state, { t: 'CONCEDE', playerId: ALICE });
    expect(next.objects['stolen'].controllerId).toBe(BOB);
    expect(next.objects['stolen'].zone.zone).not.toBe('limbo'); // it's Bob's card; it stays on the table
  });

  it('sets status to conceded and logs the life total at the time', () => {
    const state = makeState([]);
    state.players[0].life = 17;
    const next = unwrap(state, { t: 'CONCEDE', playerId: ALICE });
    expect(next.players.find((p) => p.id === ALICE)?.status).toBe('conceded');
    expect(next.log.at(-1)?.text).toContain('conceded at 17 life');
  });

  it('excludes a conceded player from future turn rotation', () => {
    let state = makeState([]);
    state = unwrap(state, { t: 'CONCEDE', playerId: ALICE });
    const passed = unwrap(state, { t: 'PASS_TURN' });
    expect(passed.turn.activePlayerId).toBe(BOB);
  });
});
