import { describe, expect, it } from 'vitest';
import { applyUndo, tallyUndoVotes } from './undo.js';
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
      { id: ALICE, displayName: 'Alice', seat: 0, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false },
      { id: BOB, displayName: 'Bob', seat: 1, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false },
    ],
    turn: { turnNumber: 1, activePlayerId: ALICE, phase: 'main' },
    log: [],
    revision,
    createdAt: 0,
    setupComplete: true,
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

describe('applyUndo: objects the revert simply removes', () => {
  it('does not report a leak for a token that did not exist at the target', () => {
    const before = makeState([], 1);
    const after = makeState([card({ id: 'tok', zone: { playerId: ALICE, zone: 'battlefield' }, faceVisibility: { kind: 'all' } })], 2);
    expect(applyUndo(after, before, ALICE).leakedTo).toEqual([]);
  });
});

describe('tallyUndoVotes', () => {
  const votes = (...ballots: boolean[]) => new Map(ballots.map((approve, i) => [`p${i}`, approve]));
  const seats = (n: number) => new Set(Array.from({ length: n }, (_, i) => `p${i}`));

  it('passes on a strict majority of the connected players', () => {
    expect(tallyUndoVotes(votes(true, true), seats(3))).toEqual({ approvals: 2, needed: 2, outcome: 'applied' });
  });

  it('waits while neither side has it', () => {
    expect(tallyUndoVotes(votes(true), seats(3))).toEqual({ approvals: 1, needed: 2, outcome: 'pending' });
  });

  it('fails as soon as a majority is out of reach', () => {
    expect(tallyUndoVotes(votes(true, false, false), seats(4)).outcome).toBe('rejected');
  });

  // The requester's own approval counts. Alone at the table it already is the majority, but the
  // vote used to be opened anyway — with nobody connected to cast another ballot, it never closed.
  // Bob approved and left; Alice, alone and still deciding, must not be outvoted by his absence.
  it('ignores the ballot of a player who is no longer connected', () => {
    const left = new Map([['bob', true], ['alice', false]]);
    expect(tallyUndoVotes(new Map([['bob', true]]), new Set(['alice'])).outcome).toBe('pending');
    expect(tallyUndoVotes(left, new Set(['alice'])).outcome).toBe('rejected');
  });

  it('passes at once when the requester is the only one connected', () => {
    expect(tallyUndoVotes(votes(true), seats(1)).outcome).toBe('applied');
  });
});
