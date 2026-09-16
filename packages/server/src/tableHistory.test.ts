import { describe, expect, it } from 'vitest';
import { TableHistory } from './tableHistory.js';
import type { TableState } from '@command-table/common';

const ALICE = 'alice';
const BOB = 'bob';

function stateAt(revision: number): TableState {
  return {
    roomId: 'ROOM1',
    objects: {},
    players: [],
    turn: { turnNumber: 1, activePlayerId: ALICE, phase: 'main' },
    log: [],
    revision,
    createdAt: 0,
  };
}

describe('TableHistory', () => {
  it('returns the initial state for its own revision', () => {
    const history = new TableHistory(stateAt(0));
    expect(history.snapshotAt(0)).toBe(history.snapshotAt(0));
    expect(history.snapshotAt(0)?.revision).toBe(0);
  });

  it('returns the recorded snapshot for a given revision', () => {
    const history = new TableHistory(stateAt(0));
    const s1 = stateAt(1);
    history.record(ALICE, s1);
    expect(history.snapshotAt(1)).toBe(s1);
  });

  it('returns undefined for a revision it never saw', () => {
    const history = new TableHistory(stateAt(0));
    history.record(ALICE, stateAt(1));
    expect(history.snapshotAt(5)).toBeUndefined();
  });

  it('drops the oldest entries beyond capacity', () => {
    const history = new TableHistory(stateAt(0), 2);
    history.record(ALICE, stateAt(1));
    history.record(BOB, stateAt(2));
    history.record(ALICE, stateAt(3));
    expect(history.snapshotAt(1)).toBeUndefined();
    expect(history.snapshotAt(2)?.revision).toBe(2);
    expect(history.snapshotAt(3)?.revision).toBe(3);
  });

  it('canSelfUndo is true only when the requester made the most recent recorded change', () => {
    const history = new TableHistory(stateAt(0));
    history.record(ALICE, stateAt(1));
    expect(history.canSelfUndo(ALICE)).toBe(true);
    expect(history.canSelfUndo(BOB)).toBe(false);

    history.record(BOB, stateAt(2));
    expect(history.canSelfUndo(ALICE)).toBe(false);
    expect(history.canSelfUndo(BOB)).toBe(true);
  });

  it('canSelfUndo is false on a freshly started game with no history yet', () => {
    const history = new TableHistory(stateAt(0));
    expect(history.canSelfUndo(ALICE)).toBe(false);
  });

  it('currentRevision reflects the initial state until anything is recorded', () => {
    const history = new TableHistory(stateAt(0));
    expect(history.currentRevision()).toBe(0);
    history.record(ALICE, stateAt(1));
    expect(history.currentRevision()).toBe(1);
  });
});
