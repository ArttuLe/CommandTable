// Reverts to a prior TableState snapshot. Undo produces a new *forward* revision whose content
// matches the target snapshot — it never rewinds the revision counter itself, since
// clients/other machinery treat revision as monotonic.
//
// Undo cannot un-reveal information, so an undo that would restore hidden state a player has
// already seen is noted in the log. computeLeakedViewers is a best-effort implementation of
// that: it flags any player who could see an object in the state being discarded but can no
// longer see it (or it no longer exists) after the revert. It can't undo their memory, so the
// honest move is just to say so.

import type { LogEntry, PlayerId, TableState, Visibility } from '@command-table/common';

export interface UndoOutcome {
  state: TableState;
  leakedTo: PlayerId[];
}

export function applyUndo(current: TableState, target: TableState, actorId: PlayerId): UndoOutcome {
  const leakedTo = computeLeakedViewers(current, target);
  const revision = current.revision + 1;
  const timestamp = Date.now();

  const entries: LogEntry[] = [...current.log, { revision, timestamp, actorId, ...undoneLine(current, target), visibility: { kind: 'all' }, undoable: false }];
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

// Names what was taken back — the action that produced the revision after the target — in the
// words its own line used, keeping its card reference so the client can name the card (logText.ts).
function undoneLine(current: TableState, target: TableState): Pick<LogEntry, 'text' | 'subject'> {
  const undone = current.log.find((e) => e.revision === target.revision + 1);
  if (!undone) return { text: 'reverted the game to an earlier point' };
  const who = current.players.find((p) => p.id === undone.actorId)?.displayName ?? undone.actorId;
  return { text: `undid: ${who} ${undone.text}`, subject: undone.subject };
}

function computeLeakedViewers(current: TableState, target: TableState): PlayerId[] {
  const allPlayerIds = current.players.map((p) => p.id);
  const leaked = new Set<PlayerId>();

  for (const obj of Object.values(current.objects)) {
    // A card that went out of someone's sight since the target carries a fresh id now (see
    // rekeyIfHidden), so it is looked up by what it is as well: same owner, same printing.
    const afterRevert = target.objects[obj.id] ?? sameCardIn(target, obj);
    // Something everyone could see that didn't exist yet at the target — a token, a copy — reveals
    // nothing by disappearing. Counting it put a false "may still be known" note on every undone
    // token. A hidden one that vanishes is still a leak: someone saw what nobody else did.
    if (!afterRevert && obj.faceVisibility.kind === 'all') continue;
    const viewersNow = viewersOf(obj.faceVisibility, allPlayerIds);
    const viewersAfter = afterRevert ? viewersOf(afterRevert.faceVisibility, allPlayerIds) : new Set<PlayerId>();
    for (const viewer of viewersNow) {
      if (!viewersAfter.has(viewer)) {
        leaked.add(viewer);
      }
    }
  }

  return [...leaked];
}

function sameCardIn(target: TableState, obj: TableState['objects'][string]): TableState['objects'][string] | undefined {
  const source = JSON.stringify(obj.source);
  return Object.values(target.objects).find(
    (candidate) => candidate.ownerId === obj.ownerId && JSON.stringify(candidate.source) === source
  );
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

export type UndoVoteOutcome = 'applied' | 'rejected' | 'pending';

/**
 * Where a rewind vote stands (majority consent of connected players). It passes once more
 * than half approve, and fails once enough have refused that more than half no longer can. The
 * requester's own approval is one of the ballots — alone at the table, it is already the majority.
 */
export function tallyUndoVotes(
  votes: ReadonlyMap<PlayerId, boolean>,
  connected: ReadonlySet<PlayerId>
): { approvals: number; needed: number; outcome: UndoVoteOutcome } {
  // Only ballots from players still at the table: one who voted and left would otherwise count
  // against a smaller table — down to none, where a lone stale approval applied a rewind nobody
  // present had agreed to.
  const ballots = [...votes].filter(([id]) => connected.has(id)).map(([, approve]) => approve);
  const connectedCount = connected.size;
  const approvals = ballots.filter(Boolean).length;
  const rejections = ballots.length - approvals;
  const needed = Math.floor(connectedCount / 2) + 1;
  const outcome = approvals >= needed ? 'applied' : rejections * 2 >= connectedCount ? 'rejected' : 'pending';
  return { approvals, needed, outcome };
}
