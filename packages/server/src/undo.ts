// Reverts to a prior TableState snapshot, per design doc §15.2. Undo produces a new *forward*
// revision whose content matches the target snapshot — it never rewinds the revision counter
// itself, since clients/other machinery treat revision as monotonic (§7.3).
//
// "Undo cannot un-reveal information. If an undo would restore hidden state a player has
// already seen, note it in the log" — computeLeakedViewers is a best-effort implementation of
// that: it flags any player who could see an object in the state being discarded but can no
// longer see it (or it no longer exists) after the revert. It can't undo their memory, so per
// the doc, the honest move is just to say so.

import type { LogEntry, PlayerId, TableState, Visibility } from '@command-table/common';

export interface UndoOutcome {
  state: TableState;
  leakedTo: PlayerId[];
}

export function applyUndo(current: TableState, target: TableState, actorId: PlayerId): UndoOutcome {
  const leakedTo = computeLeakedViewers(current, target);
  const revision = current.revision + 1;
  const timestamp = Date.now();

  const entries: LogEntry[] = [
    ...current.log,
    { revision, timestamp, actorId, text: 'reverted the game to an earlier point', visibility: { kind: 'all' }, undoable: false },
  ];
  if (leakedTo.length > 0) {
    entries.push({
      revision,
      timestamp,
      actorId,
      text: `note: information hidden again by this revert may still be known to ${leakedTo.length} player(s), since undo can't erase what they've already seen`,
      visibility: { kind: 'all' },
      undoable: false,
    });
  }

  return { state: { ...target, log: entries, revision }, leakedTo };
}

function computeLeakedViewers(current: TableState, target: TableState): PlayerId[] {
  const allPlayerIds = current.players.map((p) => p.id);
  const leaked = new Set<PlayerId>();

  for (const obj of Object.values(current.objects)) {
    const viewersNow = viewersOf(obj.faceVisibility, allPlayerIds);
    const afterRevert = target.objects[obj.id];
    const viewersAfter = afterRevert ? viewersOf(afterRevert.faceVisibility, allPlayerIds) : new Set<PlayerId>();
    for (const viewer of viewersNow) {
      if (!viewersAfter.has(viewer)) {
        leaked.add(viewer);
      }
    }
  }

  return [...leaked];
}

function viewersOf(visibility: Visibility, allPlayerIds: PlayerId[]): Set<PlayerId> {
  switch (visibility.kind) {
    case 'all':
      return new Set(allPlayerIds);
    case 'none':
      return new Set();
    case 'players':
      return new Set(visibility.ids);
  }
}
