import { describe, expect, it } from 'vitest';
import { applyUndo } from './undo.js';
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

function makeState(objects: GameObject[], revision: number): TableState {
  return {
    roomId: 'ROOM1',
    objects: Object.fromEntries(objects.map((o) => [o.id, o])),
    players: [
      { id: ALICE, displayName: 'Alice', seat: 0, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active' },
      { id: BOB, displayName: 'Bob', seat: 1, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active' },
    ],
    turn: { turnNumber: 1, activePlayerId: ALICE, phase: 'main' },
    log: [],
    revision,
    createdAt: 0,
  };
}

describe('applyUndo', () => {
  it('restores the target snapshot\'s content at a new, forward revision', () => {
    const target = makeState([card({ id: 'c1', tapped: false })], 3);
    const current = makeState([card({ id: 'c1', tapped: true })], 5);

    const outcome = applyUndo(current, target, ALICE);

    expect(outcome.state.objects['c1'].tapped).toBe(false);
    expect(outcome.state.revision).toBe(6); // current + 1, not back to 3
  });

  it('keeps the current log and appends a new entry describing the revert, rather than truncating it', () => {
    const target = makeState([], 0);
    const current = makeState([], 2);
    current.log = [
      { revision: 1, timestamp: 0, actorId: ALICE, text: 'did a thing', visibility: { kind: 'all' }, undoable: true },
    ];

    const outcome = applyUndo(current, target, ALICE);

    expect(outcome.state.log[0].text).toBe('did a thing');
    expect(outcome.state.log.at(-1)?.text).toContain('reverted');
  });

  it('reports no leaked viewers when nothing hidden changes visibility', () => {
    const target = makeState([card({ id: 'c1', faceVisibility: { kind: 'all' } })], 0);
    const current = makeState([card({ id: 'c1', faceVisibility: { kind: 'all' } })], 1);

    const outcome = applyUndo(current, target, ALICE);

    expect(outcome.leakedTo).toEqual([]);
  });

  it('flags a player who could see an object that becomes hidden again after the revert', () => {
    // Bob peeked at Alice's library card (current state); reverting to before the peek means
    // the object either doesn't exist yet or is hidden again — but Bob still remembers it.
    const target = makeState([], 0);
    const current = makeState(
      [card({ id: 'peeked', zone: { playerId: ALICE, zone: 'library' }, faceVisibility: { kind: 'players', ids: [BOB] } })],
      1
    );

    const outcome = applyUndo(current, target, ALICE);

    expect(outcome.leakedTo).toEqual([BOB]);
    expect(outcome.state.log.at(-1)?.text).toMatch(/1 player/);
  });

  it('does not flag the object\'s own future visibility change as a leak when it stays visible', () => {
    const target = makeState([card({ id: 'c1', faceVisibility: { kind: 'players', ids: [ALICE] } })], 0);
    const current = makeState([card({ id: 'c1', faceVisibility: { kind: 'players', ids: [ALICE] } })], 1);

    const outcome = applyUndo(current, target, ALICE);

    expect(outcome.leakedTo).toEqual([]);
  });
});
