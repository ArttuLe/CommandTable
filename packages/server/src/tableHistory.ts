// Bounded snapshot history for undo, per design doc §15.2: "Server keeps a bounded ring buffer
// (say 50) of full TableState snapshots... trivially cheap and avoids the bug surface of
// inverse-action undo." Not part of TableState itself — this is server session state, kept per
// room alongside the current table.

import type { PlayerId, TableState } from '@command-table/common';

const DEFAULT_CAPACITY = 50;

interface HistoryEntry {
  revision: number;
  actorId: PlayerId;
  state: TableState;
}

export class TableHistory {
  private entries: HistoryEntry[] = [];

  constructor(private readonly initialState: TableState, private readonly capacity: number = DEFAULT_CAPACITY) {}

  record(actorId: PlayerId, state: TableState): void {
    this.entries.push({ revision: state.revision, actorId, state });
    if (this.entries.length > this.capacity) {
      this.entries.shift();
    }
  }

  snapshotAt(targetRevision: number): TableState | undefined {
    if (targetRevision === this.initialState.revision) {
      return this.initialState;
    }
    return this.entries.find((e) => e.revision === targetRevision)?.state;
  }

  currentRevision(): number {
    return this.entries.at(-1)?.revision ?? this.initialState.revision;
  }

  lastActorId(): PlayerId | undefined {
    return this.entries.at(-1)?.actorId;
  }

  // Self-undo (§15.2) needs no consent "provided no other player has acted since" — since
  // actions apply in strict arrival order, that's exactly: the most recent entry is theirs.
  canSelfUndo(requesterId: PlayerId): boolean {
    return this.lastActorId() === requesterId;
  }
}
