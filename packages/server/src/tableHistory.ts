// Bounded snapshot history for undo, per design doc §15.2: "Server keeps a bounded ring buffer
// (say 50) of full TableState snapshots... trivially cheap and avoids the bug surface of
// inverse-action undo." Not part of TableState itself — this is server session state, kept per
// room alongside the current table.
//
// A revision number is not a position in that history. A revert produces a *new, higher* revision
// carrying an *older* revision's content (see undo.ts: clients treat revision as monotonic, §7.3),
// so after one undo the table's number and its content have drifted apart. Each entry therefore
// also carries a `contentRevision`: the revision whose content it holds — itself for a normal
// action, and the restored snapshot's own contentRevision for a revert, which is what makes
// nested reverts walk backwards instead of ping-ponging. "Step back one action" is then always
// contentRevision(last) - 1.
//
// That pointer belongs here rather than on TableState for the same reason the snapshots do: it
// describes the room's undo history, not the game the players can see, and it must not travel to
// clients or survive into a restored session as a promise the buffer can no longer keep.

import type { PlayerId, TableState } from '@command-table/common';

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

  // Self-undo (§15.2) needs no consent "provided no other player has acted since" — since actions
  // apply in strict arrival order, that's exactly: the action the table's content currently sits
  // on is theirs. With no reverts in play that is the most recent entry.
  canSelfUndo(requesterId: PlayerId): boolean {
    const current = this.currentContentRevision();
    return this.entries.find((e) => e.revision === current)?.actorId === requesterId;
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
