// The projection boundary is the one place that calls for thorough testing: for any state and
// any viewer, assert that no hidden object's source appears anywhere in the projected output.

import { describe, expect, it } from 'vitest';
import { projectFor } from './projection.js';
import type { GameObject, LogEntry, TableState } from '@command-table/common';
import { isRedacted } from '@command-table/common';

const ALICE = 'alice';
const BOB = 'bob';

function card(overrides: Partial<GameObject>): GameObject {
  return {
    id: 'default-id',
    ownerId: ALICE,
    controllerId: ALICE,
    source: { kind: 'card', scryfallId: 's1', oracleId: 'o1' },
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

function makeState(objects: GameObject[], log: LogEntry[] = []): TableState {
  return {
    roomId: 'ROOM1',
    objects: Object.fromEntries(objects.map((o) => [o.id, o])),
    players: [
      { id: ALICE, displayName: 'Alice', seat: 0, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false },
      { id: BOB, displayName: 'Bob', seat: 1, connected: true, life: 40, counters: {}, commanderDamageTaken: {}, commanderCastCount: {}, commanderIds: [], status: 'active', keptHand: false },
    ],
    turn: { turnNumber: 1, activePlayerId: ALICE, phase: 'main' },
    log,
    revision: 1,
    createdAt: 0,
    setupComplete: true,
  };
}

function logEntry(overrides: Partial<LogEntry>): LogEntry {
  return { revision: 1, timestamp: 0, actorId: ALICE, text: 'did something', visibility: { kind: 'all' }, undoable: true, ...overrides };
}

describe('projectFor', () => {
  it('omits library objects entirely and reports only a count', () => {
    const state = makeState([
      card({ id: 'lib1', zone: { playerId: ALICE, zone: 'library' }, faceVisibility: { kind: 'none' } }),
      card({ id: 'lib2', zone: { playerId: ALICE, zone: 'library' }, faceVisibility: { kind: 'none' } }),
    ]);

    const projected = projectFor(state, BOB);

    expect(projected.objects['lib1']).toBeUndefined();
    expect(projected.objects['lib2']).toBeUndefined();
    expect(projected.libraryCounts[ALICE]).toBe(2);
  });

  it('includes a peeked library card only for the player it was revealed to', () => {
    const state = makeState([
      card({ id: 'peeked', zone: { playerId: ALICE, zone: 'library' }, faceVisibility: { kind: 'players', ids: [ALICE] } }),
    ]);

    const forAlice = projectFor(state, ALICE);
    const forBob = projectFor(state, BOB);

    expect(forAlice.objects['peeked']).toBeDefined();
    expect(isRedacted(forAlice.objects['peeked'])).toBe(false);
    expect(forBob.objects['peeked']).toBeUndefined();
    // Both viewers still see the same library count regardless of the peek.
    expect(forAlice.libraryCounts[ALICE]).toBe(1);
    expect(forBob.libraryCounts[ALICE]).toBe(1);
  });

  it('shows a player their own hand in full but only a count to others', () => {
    const state = makeState([
      card({ id: 'hand1', zone: { playerId: ALICE, zone: 'hand' }, faceVisibility: { kind: 'players', ids: [ALICE] } }),
    ]);

    const forAlice = projectFor(state, ALICE);
    const forBob = projectFor(state, BOB);

    expect(forAlice.objects['hand1']).toBeDefined();
    expect(forBob.objects['hand1']).toBeUndefined();
    expect(forBob.handCounts[ALICE]).toBe(1);
  });

  it('redacts a face-down battlefield object for non-controllers instead of omitting it', () => {
    const state = makeState([
      card({
        id: 'morph',
        controllerId: ALICE,
        zone: { playerId: ALICE, zone: 'battlefield' },
        faceDown: true,
        faceVisibility: { kind: 'players', ids: [ALICE] },
        tapped: true,
      }),
    ]);

    const forBob = projectFor(state, BOB);
    const redacted = forBob.objects['morph'];

    expect(redacted).toBeDefined();
    expect(isRedacted(redacted)).toBe(true);
    expect(redacted).not.toHaveProperty('source');
    expect(redacted).not.toHaveProperty('ownerId');
    expect(redacted).not.toHaveProperty('annotation');
    if (isRedacted(redacted)) {
      expect(redacted.tapped).toBe(true);
      expect(redacted.controllerId).toBe(ALICE);
    }
  });

  it('shows battlefield face-up, graveyard, and command zone objects to everyone', () => {
    const state = makeState([
      card({ id: 'bf', zone: { playerId: ALICE, zone: 'battlefield' }, faceVisibility: { kind: 'all' } }),
      card({ id: 'gy', zone: { playerId: ALICE, zone: 'graveyard' }, faceVisibility: { kind: 'all' } }),
      card({ id: 'cmd', zone: { playerId: ALICE, zone: 'commandZone' }, faceVisibility: { kind: 'all' } }),
    ]);

    const forBob = projectFor(state, BOB);

    expect(isRedacted(forBob.objects['bf'])).toBe(false);
    expect(isRedacted(forBob.objects['gy'])).toBe(false);
    expect(isRedacted(forBob.objects['cmd'])).toBe(false);
  });

  it('never leaks a hidden object\'s source, ownerId, or annotation to a viewer it is not visible to', () => {
    const zones: GameObject['zone'][] = [
      { playerId: ALICE, zone: 'library' },
      { playerId: ALICE, zone: 'hand' },
      { playerId: ALICE, zone: 'battlefield' },
      { playerId: ALICE, zone: 'exile' },
      { zone: 'stack' },
      { zone: 'limbo' },
    ];
    const visibilities: GameObject['faceVisibility'][] = [
      { kind: 'all' },
      { kind: 'none' },
      { kind: 'players', ids: [ALICE] },
      { kind: 'players', ids: [BOB] },
    ];

    const objects: GameObject[] = [];
    let i = 0;
    for (const zone of zones) {
      for (const faceVisibility of visibilities) {
        objects.push(card({ id: `obj-${i++}`, zone, faceVisibility, annotation: 'secret note' }));
      }
    }
    const state = makeState(objects);

    for (const viewer of [ALICE, BOB]) {
      const projected = projectFor(state, viewer);
      for (const obj of Object.values(projected.objects)) {
        if (isRedacted(obj)) {
          expect(obj).not.toHaveProperty('source');
          expect(obj).not.toHaveProperty('ownerId');
          expect(obj).not.toHaveProperty('annotation');
        }
      }
    }
  });

  it('filters log entries by visibility just like objects (private entries are projected)', () => {
    const state = makeState(
      [],
      [
        logEntry({ text: 'public event', visibility: { kind: 'all' } }),
        logEntry({ text: 'alice-only event', visibility: { kind: 'players', ids: [ALICE] } }),
      ]
    );

    const forAlice = projectFor(state, ALICE);
    const forBob = projectFor(state, BOB);

    expect(forAlice.log.map((e) => e.text)).toEqual(['public event', 'alice-only event']);
    expect(forBob.log.map((e) => e.text)).toEqual(['public event']);
  });
});
