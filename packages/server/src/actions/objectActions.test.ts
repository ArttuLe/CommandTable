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
    revision: 0,
    createdAt: 0,
  };
}

function unwrap(state: TableState, action: Parameters<typeof applyAction>[1]) {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.state;
}

describe('TAP / UNTAP / UNTAP_ALL', () => {
  it('taps and untaps a single object', () => {
    let state = makeState([card({ id: 'c1' })]);
    state = unwrap(state, { t: 'TAP', objectId: 'c1' });
    expect(state.objects['c1'].tapped).toBe(true);
    state = unwrap(state, { t: 'UNTAP', objectId: 'c1' });
    expect(state.objects['c1'].tapped).toBe(false);
  });

  it('untaps every battlefield permanent the player controls, and no one else\'s', () => {
    const state = makeState([
      card({ id: 'mine1', tapped: true, controllerId: ALICE }),
      card({ id: 'mine2', tapped: true, controllerId: ALICE }),
      card({ id: 'theirs', tapped: true, controllerId: BOB, zone: { playerId: BOB, zone: 'battlefield' } }),
      card({ id: 'my-hand-card', tapped: true, controllerId: ALICE, zone: { playerId: ALICE, zone: 'hand' } }),
    ]);

    const next = unwrap(state, { t: 'UNTAP_ALL', playerId: ALICE });

    expect(next.objects['mine1'].tapped).toBe(false);
    expect(next.objects['mine2'].tapped).toBe(false);
    expect(next.objects['theirs'].tapped).toBe(true);
    expect(next.objects['my-hand-card'].tapped).toBe(true); // not a battlefield permanent
  });
});

describe('SET_COUNTER', () => {
  it('sets an absolute value', () => {
    const state = makeState([card({ id: 'c1', counters: { '+1/+1': 2 } })]);
    const next = unwrap(state, { t: 'SET_COUNTER', objectId: 'c1', key: '+1/+1', update: { mode: 'set', amount: 5 } });
    expect(next.objects['c1'].counters['+1/+1']).toBe(5);
  });

  it('applies a delta on top of an absent counter', () => {
    const state = makeState([card({ id: 'c1' })]);
    const next = unwrap(state, { t: 'SET_COUNTER', objectId: 'c1', key: 'stun', update: { mode: 'delta', amount: 3 } });
    expect(next.objects['c1'].counters['stun']).toBe(3);
  });
});

describe('ATTACH / UNATTACH', () => {
  it('attaches and unattaches', () => {
    let state = makeState([card({ id: 'aura' }), card({ id: 'creature' })]);
    state = unwrap(state, { t: 'ATTACH', objectId: 'aura', toObjectId: 'creature' });
    expect(state.objects['aura'].attachedTo).toBe('creature');
    state = unwrap(state, { t: 'UNATTACH', objectId: 'aura' });
    expect(state.objects['aura'].attachedTo).toBeNull();
  });

  it('rejects attaching to a nonexistent object', () => {
    const state = makeState([card({ id: 'aura' })]);
    const result = applyAction(state, { t: 'ATTACH', objectId: 'aura', toObjectId: 'ghost' });
    expect(result.ok).toBe(false);
  });
});

describe('markers', () => {
  it('sets a marker without duplicating it', () => {
    let state = makeState([card({ id: 'c1' })]);
    state = unwrap(state, { t: 'SET_MARKER', objectId: 'c1', marker: 'attacking' });
    state = unwrap(state, { t: 'SET_MARKER', objectId: 'c1', marker: 'attacking' });
    expect(state.objects['c1'].markers).toEqual(['attacking']);
  });

  it('clears a specific marker', () => {
    let state = makeState([card({ id: 'c1', markers: ['attacking', 'goaded'] })]);
    state = unwrap(state, { t: 'CLEAR_MARKER', objectId: 'c1', marker: 'attacking' });
    expect(state.objects['c1'].markers).toEqual(['goaded']);
  });

  it('CLEAR_ALL_MARKERS clears markers on every object table-wide', () => {
    const state = makeState([
      card({ id: 'a', markers: ['attacking'], controllerId: ALICE }),
      card({ id: 'b', markers: ['blocking'], controllerId: BOB, zone: { playerId: BOB, zone: 'battlefield' } }),
    ]);
    const next = unwrap(state, { t: 'CLEAR_ALL_MARKERS' });
    expect(next.objects['a'].markers).toEqual([]);
    expect(next.objects['b'].markers).toEqual([]);
  });
});

describe('TRANSFORM / TURN_FACE_DOWN / TURN_FACE_UP', () => {
  it('toggles currentFace', () => {
    let state = makeState([card({ id: 'c1', currentFace: 0 })]);
    state = unwrap(state, { t: 'TRANSFORM', objectId: 'c1' });
    expect(state.objects['c1'].currentFace).toBe(1);
    state = unwrap(state, { t: 'TRANSFORM', objectId: 'c1' });
    expect(state.objects['c1'].currentFace).toBe(0);
  });

  it('turning a battlefield object face down restricts visibility to its controller', () => {
    const state = makeState([card({ id: 'c1', controllerId: BOB })]);
    const next = unwrap(state, { t: 'TURN_FACE_DOWN', objectId: 'c1' });
    expect(next.objects['c1'].faceDown).toBe(true);
    expect(next.objects['c1'].faceVisibility).toEqual({ kind: 'players', ids: [BOB] });
  });

  it('turning back face up restores visible-to-all', () => {
    let state = makeState([card({ id: 'c1' })]);
    state = unwrap(state, { t: 'TURN_FACE_DOWN', objectId: 'c1' });
    state = unwrap(state, { t: 'TURN_FACE_UP', objectId: 'c1' });
    expect(state.objects['c1'].faceDown).toBe(false);
    expect(state.objects['c1'].faceVisibility).toEqual({ kind: 'all' });
  });
});

describe('SET_ANNOTATION', () => {
  it('sets and clears a free-text annotation', () => {
    let state = makeState([card({ id: 'c1' })]);
    state = unwrap(state, { t: 'SET_ANNOTATION', objectId: 'c1', annotation: 'chose blue' });
    expect(state.objects['c1'].annotation).toBe('chose blue');
    state = unwrap(state, { t: 'SET_ANNOTATION', objectId: 'c1', annotation: null });
    expect(state.objects['c1'].annotation).toBeNull();
  });
});

describe('CHANGE_CONTROLLER', () => {
  it('moves a battlefield object into the new controller\'s battlefield zone', () => {
    const state = makeState([card({ id: 'c1', ownerId: ALICE, controllerId: ALICE })]);
    const next = unwrap(state, { t: 'CHANGE_CONTROLLER', objectId: 'c1', newControllerId: BOB });
    expect(next.objects['c1'].controllerId).toBe(BOB);
    expect(next.objects['c1'].zone).toEqual({ playerId: BOB, zone: 'battlefield' });
    expect(next.objects['c1'].ownerId).toBe(ALICE); // ownership never changes (§7.1)
  });
});

describe('CREATE_TOKEN / CREATE_COPY / DELETE_OBJECT', () => {
  it('creates the requested quantity of tokens, visible to all on the battlefield', () => {
    const state = makeState([]);
    const next = unwrap(state, {
      t: 'CREATE_TOKEN',
      ownerId: ALICE,
      zone: { playerId: ALICE, zone: 'battlefield' },
      source: { adhoc: { name: 'Squirrel', typeLine: 'Token Creature — Squirrel', power: '1', toughness: '1' } },
      quantity: 3,
    });
    const tokens = Object.values(next.objects).filter((o) => o.source.kind === 'token');
    expect(tokens).toHaveLength(3);
    expect(tokens[0].faceVisibility).toEqual({ kind: 'all' });
    expect(tokens[0].ownerId).toBe(ALICE);
  });

  it('creates a copy referencing the original object and its scryfallId', () => {
    const state = makeState([card({ id: 'orig', source: { kind: 'card', scryfallId: 'sol-ring', oracleId: 'o' } })]);
    const next = unwrap(state, { t: 'CREATE_COPY', ofObjectId: 'orig', ownerId: BOB, zone: { playerId: BOB, zone: 'battlefield' } });
    const copy = Object.values(next.objects).find((o) => o.source.kind === 'copy');
    expect(copy).toBeDefined();
    if (copy?.source.kind === 'copy') {
      expect(copy.source.ofObjectId).toBe('orig');
      expect(copy.source.scryfallId).toBe('sol-ring');
    }
    expect(copy?.ownerId).toBe(BOB);
  });

  it('deletes a token/copy from the table', () => {
    const state = makeState([card({ id: 'c1' })]);
    const next = unwrap(state, { t: 'DELETE_OBJECT', objectId: 'c1' });
    expect(next.objects['c1']).toBeUndefined();
  });

  it('rejects deleting an object that does not exist', () => {
    const state = makeState([]);
    const result = applyAction(state, { t: 'DELETE_OBJECT', objectId: 'ghost' });
    expect(result.ok).toBe(false);
  });
});
