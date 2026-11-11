// Bounded snapshot history for undo: a ring buffer of full TableState snapshots, which is
// trivially cheap and avoids the bug surface of inverse-action undo. Not part of TableState
// itself — this is server session state, kept per room alongside the current table.
//
// A revision number is not a position in that history. A revert produces a *new, higher* revision
// carrying an *older* revision's content (see undo.ts: clients treat revision as monotonic),
// so after one undo the table's number and its content have drifted apart. Each entry therefore
// also carries a `contentRevision`: the revision whose content it holds — itself for a normal
// action, and the restored snapshot's own contentRevision for a revert, which is what makes
// nested reverts walk backwards instead of ping-ponging. "Step back one action" is then always
// contentRevision(last) - 1.
//
// That pointer belongs here rather than on TableState for the same reason the snapshots do: it
// describes the room's undo history, not the game the players can see, and it must not survive
// into a restored session as a promise the buffer can no longer keep. Clients get only what it
// resolves to, beside the state rather than in it: which action Undo would take back (undoable).

import type { PlayerId, TableState, UndoableAction } from '@command-table/common';

const DEFAULT_CAPACITY = 50;

interface HistoryEntry {
  revision: number;
  contentRevision: number;
  actorId: PlayerId;
  state: TableState;
}

export class TableHistory {
  private entries: HistoryEntry[] = [];

  constructor(private readonly initialState: TableState, private readonly capacity: number = DEFAULT_CAPACITY) {}

  record(actorId: PlayerId, state: TableState): void {
    this.push({ revision: state.revision, contentRevision: state.revision, actorId, state });
  }

  // `restoredFrom` is the revision whose snapshot was reverted to; its own content revision is
  // looked up here so callers never have to reason about reverts of reverts.
  recordRevert(actorId: PlayerId, state: TableState, restoredFrom: number): void {
    const entry = this.entries.find((e) => e.revision === restoredFrom);
    this.push({ revision: state.revision, contentRevision: entry?.contentRevision ?? restoredFrom, actorId, state });
  }

  snapshotAt(targetRevision: number): TableState | undefined {
    if (targetRevision === this.initialState.revision) {
      return this.initialState;
    }
    return this.entries.find((e) => e.revision === targetRevision)?.state;
  }

  // The one action step back from wherever the table's content currently sits. Below
  // initialRevision() there is nothing left to undo.
  undoTarget(): number {
    return this.currentContentRevision() - 1;
  }

  initialRevision(): number {
    return this.initialState.revision;
  }

  // The action Undo would take back: the one the table's content currently sits on, which is
  // only the newest entry while no revert is in play. Null when there is nothing behind it, or
  // the snapshot before it has left the buffer. Sent with every state so the client can name it.
  undoable(): UndoableAction | null {
    const target = this.undoTarget();
    if (target < this.initialRevision() || !this.snapshotAt(target)) return null;
    const revision = this.currentContentRevision();
    const entry = this.entries.find((e) => e.revision === revision);
    return entry ? { revision, actorId: entry.actorId } : null;
  }

  // Self-undo needs no consent if no other player has acted since, and since actions
  // apply in strict arrival order, that's exactly: the action Undo would take back is theirs.
  canSelfUndo(requesterId: PlayerId): boolean {
    return this.undoable()?.actorId === requesterId;
  }

  private currentContentRevision(): number {
    return this.entries.at(-1)?.contentRevision ?? this.initialState.revision;
  }

  private push(entry: HistoryEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.capacity) {
      this.entries.shift();
    }
  }
}
