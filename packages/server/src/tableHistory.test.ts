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
    setupComplete: true,
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

  it('undoTarget steps back from the most recent action', () => {
    const history = new TableHistory(stateAt(0));
    history.record(ALICE, stateAt(1));
    history.record(BOB, stateAt(2));
    expect(history.undoTarget()).toBe(1);
  });

  it('undoTarget steps back past what a revert already undid', () => {
    const history = new TableHistory(stateAt(0));
    history.record(BOB, stateAt(1));
    history.record(ALICE, stateAt(2));
    // Reverting to revision 1 lands on revision 3 carrying revision 1's content.
    history.recordRevert(ALICE, stateAt(3), 1);
    expect(history.undoTarget()).toBe(0);
  });

  it('undoTarget follows nested reverts back to the content they restored', () => {
    const history = new TableHistory(stateAt(0));
    history.record(ALICE, stateAt(1));
    history.record(ALICE, stateAt(2));
    history.record(ALICE, stateAt(3));
    history.recordRevert(ALICE, stateAt(4), 2);
    history.recordRevert(ALICE, stateAt(5), 1);
    expect(history.undoTarget()).toBe(0);
  });

  it('undoTarget returns to the newest action recorded after a revert', () => {
    const history = new TableHistory(stateAt(0));
    history.record(ALICE, stateAt(1));
    history.recordRevert(ALICE, stateAt(2), 0);
    history.record(BOB, stateAt(3));
    expect(history.undoTarget()).toBe(2);
  });

  it('undoTarget falls below the initial revision when there is nothing to undo', () => {
    const history = new TableHistory(stateAt(0));
    expect(history.undoTarget()).toBe(-1);
    expect(history.initialRevision()).toBe(0);
  });

  it('canSelfUndo is false once a revert leaves the content on another player action', () => {
    const history = new TableHistory(stateAt(0));
    history.record(BOB, stateAt(1));
    history.record(ALICE, stateAt(2));
    history.recordRevert(ALICE, stateAt(3), 1);
    // The table now carries Bob's revision-1 content, so undoing further needs consent.
    expect(history.canSelfUndo(ALICE)).toBe(false);
    expect(history.canSelfUndo(BOB)).toBe(true);
  });
});
